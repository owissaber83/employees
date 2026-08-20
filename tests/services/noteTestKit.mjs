// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عدّة اختبار خدمات إشعارات الإرجاع                                  [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  تُبنى على المحاكي الواقعي `fakePostingRtdb.mjs` (Phase 6) الذي يحاكي `ref()`    ║
// ║  و`scopeUpdates()` من app.js حرفياً — فيثبت عزل المستأجرين والذرّية معاً.        ║
// ║  **لا نسخة موازية من المحاكي** (§6).                                          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { createSharedStore, createTenantPort, rawPath } from './fakePostingRtdb.mjs';
import { FirebaseCreditNotePostingRepository } from '../../src/repositories/firebase/FirebaseCreditNotePostingRepository.js';
import { FirebaseDebitNotePostingRepository } from '../../src/repositories/firebase/FirebaseDebitNotePostingRepository.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';
import { createPostCreditNoteService } from '../../src/services/accounting/posting/postCreditNote.js';
import { createPostDebitNoteService } from '../../src/services/accounting/posting/postDebitNote.js';
import {
    ACCOUNTS, CUSTOMERS, VENDORS, ITEMS, MOVEMENTS, salesInvoice, purchaseInvoice
} from '../fixtures/accounting/note-world.mjs';

export { createSharedStore, createTenantPort, rawPath, ACCOUNTS, ITEMS, MOVEMENTS, salesInvoice, purchaseInvoice };

export function makeCounters() {
    let pass = 0, fail = 0;
    const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
    const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
    const summary = () => { console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`); return fail; };
    return { eq, ok, summary };
}

/** إعدادات المسارين — يُبقي أجسام الاختبارات مشتركة والسلوك مُختبَراً لكلٍّ على حدة. */
export const KINDS = {
    credit: {
        label: 'الإشعار الدائن',
        noteCollection: 'ledger/creditNotes',
        invoiceCollection: 'ledger/salesInvoices',
        counterKind: 'cn', movementType: 'in', numberPrefix: 'CN',
        fields: { notedAmount: 'creditedAmount', keys: 'creditNoteKeys', fully: 'fullyCredited', number: 'creditNoteNumber' },
        makeInvoice: salesInvoice,
        missingAccountCodes: ['1130', '4100', '2140']
    },
    debit: {
        label: 'الإشعار المدين',
        noteCollection: 'ledger/debitNotes',
        invoiceCollection: 'ledger/purchaseInvoices',
        counterKind: 'dn', movementType: 'out', numberPrefix: 'DN',
        fields: { notedAmount: 'debitedAmount', keys: 'debitNoteKeys', fully: 'fullyDebited', number: 'debitNoteNumber' },
        makeInvoice: purchaseInvoice,
        missingAccountCodes: ['2110', '5110', '1180']
    }
};

/**
 * بيئة كاملة لأحد المسارين على منفذ مستأجر واحد فوق متجر مشترك.
 * @param {'credit'|'debit'} kind
 */
export function buildNoteEnv(kind, {
    tenantId = 'T1', invoiceKey = 'INV-1', invoice, accounts = ACCOUNTS,
    items = ITEMS, movements = MOVEMENTS, warehouses = {}, shared,
    cfg = { baseCurrencyCode: 'SAR', arApMode: 'aggregate' }, currentUser = { uid: 'u1' }
} = {}) {
    const K = KINDS[kind];
    const store = shared || createSharedStore();
    const port = createTenantPort(store, tenantId);
    const inv = invoice === undefined ? K.makeInvoice() : invoice;
    if (inv) port.update(port.ref(port.db, `${K.invoiceCollection}/${invoiceKey}`), inv);

    const coa = new InMemoryChartOfAccountsRepository(JSON.parse(JSON.stringify(accounts)));
    const readInvoice = async k => {
        const s = await port.get(port.ref(port.db, `${K.invoiceCollection}/${k}`));
        return s.exists() ? s.val() : null;
    };
    const snapshot = async () => ({ items, movements, warehouses });

    let repo, service;
    if (kind === 'credit') {
        repo = new FirebaseCreditNotePostingRepository(port);
        service = createPostCreditNoteService({
            chartOfAccountsRepo: coa, creditNotePostingRepo: repo,
            getSalesInvoice: readInvoice,
            getCustomer: async id => CUSTOMERS[id] || null,
            getInventorySnapshot: snapshot, cfg, currentUser
        });
    } else {
        repo = new FirebaseDebitNotePostingRepository(port);
        service = createPostDebitNoteService({
            chartOfAccountsRepo: coa, debitNotePostingRepo: repo,
            getPurchaseInvoice: readInvoice,
            getVendor: async id => VENDORS[id] || null,
            getInventorySnapshot: snapshot, cfg, currentUser
        });
    }

    /** مفتاح إشعار مُولَّد محلّياً — مرساة Idempotency (لا يكتب شيئاً بذاته). */
    const newNoteKey = () => port.push(port.ref(port.db, K.noteCollection)).key;

    return { K, store, port, coa, repo, service, invoiceKey, tenantId, newNoteKey };
}

export const tenantPath = (store, tenantId, path) => rawPath(store, `tenants/${tenantId}/${path}`);
export const countAt = (store, tenantId, path) => Object.keys(tenantPath(store, tenantId, path) || {}).length;
