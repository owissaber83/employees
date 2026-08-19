// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  خط أساس أداء ترحيل السند — تقرير أرقام لا اختبار نجاح/فشل             [Phase 7] ║
// ║  التشغيل: npm run svc:voucher:perf                                            ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  §17 (مطلوب صراحةً): قياس عند 1 / 10 / 100 / 1000 تخصيص فاتورة على نفس السند —   ║
// ║  توصيف Big-O، لا تحسين مسبق لأوانه.                                            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { createSharedStore, createTenantPort } from './fakePostingRtdb.mjs';
import { FirebaseVoucherPostingRepository } from '../../src/repositories/firebase/FirebaseVoucherPostingRepository.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';
import { createPostVoucherService } from '../../src/services/accounting/posting/postVoucher.js';

const ACCOUNTS = { a1010: { code: '1010', nameAr: 'الصندوق' }, a1130: { code: '1130', nameAr: 'العملاء' } };

async function time(label, fn) {
    const t0 = performance.now();
    await fn();
    return performance.now() - t0;
}

console.log('\n⏱️  خط أساس أداء ترحيل السند + التخصيص متعدّد الفواتير (postVoucher)\n');
console.log('  N تخصيصات       زمن الترحيل الكامل (ms)     ms/تخصيص');
console.log('  ' + '─'.repeat(58));

const sizes = [1, 10, 100, 1000];
const results = [];

async function measure(n, label) {
    const shared = createSharedStore();
    const port = createTenantPort(shared, label);
    const coa = new InMemoryChartOfAccountsRepository(ACCOUNTS);
    const postingRepo = new FirebaseVoucherPostingRepository(port);

    const allocations = {};
    for (let i = 0; i < n; i++) {
        const invKey = `INV-${i}`;
        allocations[invKey] = 10;
        await port.update(port.ref(port.db, `ledger/salesInvoices/${invKey}`), { grandTotal: 100, paidAmount: 0 });
    }
    await port.update(port.ref(port.db, 'ledger/receipts/RV1'), {
        number: 'RV-1', type: 'receipt', partyId: 'C1', date: '2026-01-01', amount: n * 10,
        cashAccountCode: '1010', currency: 'SAR', exchangeRate: 1, status: 'draft', allocations
    });

    const service = createPostVoucherService({
        chartOfAccountsRepo: coa, voucherPostingRepo: postingRepo,
        getVoucher: async k => { const s = await port.get(port.ref(port.db, `ledger/receipts/${k}`)); return s.exists() ? s.val() : null; },
        getCustomer: async () => ({ nameAr: 'عميل' }),
        cfg: { baseCurrencyCode: 'SAR', arApMode: 'aggregate' }, currentUser: { uid: 'u1' }
    });

    return time(`N=${n}`, () => service({ voucherKey: 'RV1', voucherType: 'receipt' }));
}

await measure(1, 'WARMUP'); // إحماء — يستبعد أثر JIT/أول تحميل للوحدات من القياس الفعلي

for (const n of sizes) {
    const ms = await measure(n, `PERF-${n}`);
    results.push({ n, ms });
    console.log(`  ${String(n).padStart(6)}            ${ms.toFixed(2).padStart(10)} ms            ${(ms / n).toFixed(3).padStart(8)} ms`);
}

console.log('\n  ═══ توصيف Big-O ═══');
const ratio10to1 = results[1].ms / results[0].ms;
const ratio100to10 = results[2].ms / results[1].ms;
const ratio1000to100 = results[3].ms / results[2].ms;
console.log(`  نسبة الزمن 10/1:    ${ratio10to1.toFixed(1)}×`);
console.log(`  نسبة الزمن 100/10:  ${ratio100to10.toFixed(1)}×`);
console.log(`  نسبة الزمن 1000/100:${ratio1000to100.toFixed(1)}×`);
console.log('  التصميم: حلقة runTransaction تتابعية واحدة لكل فاتورة (لا توازي) — O(N) بالتصميم،');
console.log('  حيث N = عدد الفواتير المخصَّصة على نفس السند. لا يمكن استبدالها بكتابة متوازية بلا');
console.log('  فقدان ضمان التزامن (§6) — كل معاملة تتطلّب عزلاً حقيقياً بمفردها.');
console.log('  ⚠️ النسب أعلاه على هذا المحاكي (in-memory، بلا زمن شبكة) دون-خطّية لأن التكلفة الثابتة');
console.log('  لكل استدعاء (بناء القيد، دقّة الحسابات) تهيمن عند N صغير. في الإنتاج الحقيقي على RTDB،');
console.log('  كل runTransaction فردي هو رحلة شبكة (round-trip) — فالتكلفة الفعلية ستكون أقرب للخطّية');
console.log('  (O(N) بمعامل يهيمن عليه زمن الشبكة لا وحدة المعالجة)، وربما أوضح من هذه الأرقام.');
console.log('\n⚠️  أرقام مرجعية — لا تحسين في Phase 7 (§17). قارن بخط أساس Phase 6 (tests/services/perf-baseline.mjs).');
