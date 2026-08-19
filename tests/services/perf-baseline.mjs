// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خط أساس أداء الترحيل الذرّي — تقرير أرقام لا اختبار نجاح/فشل        [Phase 6] ║
// ║  التشغيل: npm run svc:perf                                                    ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §17: «استخدم خط أساس Phase 5 مرجعاً. لا تُحسِّن قبل الأوان. سجّل قياسات ذات       ║
// ║  معنى: بناء القيد · التحقّق · بحث Idempotency · تحضير التحديث الذرّي».           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { createSharedStore, createTenantPort } from './fakePostingRtdb.mjs';
import { FirebaseJournalPostingRepository } from '../../src/repositories/firebase/FirebaseJournalPostingRepository.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';
import { createPostPurchaseInvoiceService } from '../../src/services/accounting/posting/postPurchaseInvoice.js';
import { buildPurchaseInvoiceJournal } from '../../src/domain/accounting/posting/buildPurchaseInvoiceJournal.js';
import { validateJournal } from '../../src/domain/accounting/posting/validateJournal.js';
import { assertBalanced } from '../../src/domain/accounting/posting/assertBalanced.js';

const ACCOUNTS = { a5110: { code: '5110', nameAr: 'مشتريات' }, a2110: { code: '2110', nameAr: 'الموردون' }, a1180: { code: '1180', nameAr: 'ضريبة مدخلات' } };
const VENDOR = { code: 'SUP-01', nameAr: 'مورد' };

async function time(label, iterations, fn) {
    await fn(); // إحماء
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) await fn();
    const ms = (performance.now() - t0) / iterations;
    console.log(`  ${label.padEnd(46)} ${ms.toFixed(3).padStart(10)} ms/عملية   (متوسط ${iterations})`);
    return ms;
}

console.log('\n⏱️  خط أساس أداء الترحيل الذرّي (postPurchaseInvoice)\n');

// ── 1) بناء القيد + التحقّق البنيوي + assertBalanced (المسار النقيّ بالكامل) ──
{
    const inputs = {
        invoiceKey: 'K', invoice: { number: 'P-1', vendorId: 'V1', vendorRef: 'R', date: '2026-01-01', debitAccountCode: '5110', netBeforeTax: 10000, vatTotal: 1500, grandTotal: 11500, currency: 'SAR', exchangeRate: 1 },
        vendor: VENDOR, expenseAccount: ACCOUNTS.a5110, vendorAccount: ACCOUNTS.a2110, vatInputAccount: ACCOUNTS.a1180,
        baseCurrencyCode: 'SAR', now: '2026-01-01T00:00:00Z', userId: 'u1'
    };
    await time('buildPurchaseInvoiceJournal (بناء نقيّ)', 2000, async () => buildPurchaseInvoiceJournal({ ...inputs, journalNumber: 'JV-TEST' }));
    const { journal } = buildPurchaseInvoiceJournal({ ...inputs, journalNumber: 'JV-TEST' });
    await time('validateJournal', 2000, async () => validateJournal(journal));
    await time('assertBalanced', 2000, async () => assertBalanced(journal));
}

// ── 2) الترحيل الكامل عبر الخدمة (بحث الحسابات + بوّابة Idempotency + الكتابة الذرّية) ──
{
    const shared = createSharedStore();
    const port = createTenantPort(shared, 'PERF');
    const coa = new InMemoryChartOfAccountsRepository(ACCOUNTS);
    const postingRepo = new FirebaseJournalPostingRepository(port);
    const vendors = { V1: VENDOR };

    const service = createPostPurchaseInvoiceService({
        chartOfAccountsRepo: coa, journalPostingRepo: postingRepo,
        getInvoice: async k => { const s = await port.get(port.ref(port.db, `ledger/purchaseInvoices/${k}`)); return s.exists() ? s.val() : null; },
        getVendor: async id => vendors[id] || null,
        cfg: { baseCurrencyCode: 'SAR', arApMode: 'aggregate' }, currentUser: { uid: 'u1' }
    });

    let n = 0;
    await time('postPurchaseInvoice (الخدمة الكاملة، فاتورة جديدة كل مرّة)', 500, async () => {
        const key = `PINV-PERF-${++n}`;
        await port.update(port.ref(port.db, `ledger/purchaseInvoices/${key}`), {
            number: key, vendorId: 'V1', vendorRef: 'R', date: '2026-01-01', debitAccountCode: '5110',
            netBeforeTax: 10000, vatTotal: 1500, grandTotal: 11500, currency: 'SAR', exchangeRate: 1, status: 'draft'
        });
        return service({ invoiceKey: key });
    });

    // ── 3) مسار "مُرحَّلة بالفعل" — بوّابة Idempotency وحدها، بلا بناء قيد ──
    const dupKey = 'PINV-DUP';
    await port.update(port.ref(port.db, `ledger/purchaseInvoices/${dupKey}`), {
        number: dupKey, vendorId: 'V1', vendorRef: 'R', date: '2026-01-01', debitAccountCode: '5110',
        netBeforeTax: 10000, vatTotal: 1500, grandTotal: 11500, currency: 'SAR', exchangeRate: 1, status: 'draft'
    });
    await service({ invoiceKey: dupKey });
    await time('postPurchaseInvoice (طلب مكرَّر — Idempotency فقط)', 500, async () => service({ invoiceKey: dupKey }));

    console.log(`\n  إجمالي القيود المُنشأة في هذا القياس: ${n + 1}`);
}

console.log('\n⚠️  أرقام مرجعية — لا تحسين في Phase 6 (§17). قارن بخط أساس Phase 5 (tests/golden-master/perf-baseline.mjs).');
