// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عدّة اختبار خدمتَي PMC والقيد اليدوي                               [Phase 7-E] ║
// ║  تُبنى على المحاكي الواقعي `fakePostingRtdb.mjs` (Phase 6) — لا نسخة موازية.    ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { createSharedStore, createTenantPort, rawPath } from './fakePostingRtdb.mjs';
import { FirebaseProjectCostPostingRepository } from '../../src/repositories/firebase/FirebaseProjectCostPostingRepository.js';
import { FirebaseManualJournalPostingRepository } from '../../src/repositories/firebase/FirebaseManualJournalPostingRepository.js';
import { InMemoryChartOfAccountsRepository } from '../../src/repositories/memory/InMemoryChartOfAccountsRepository.js';
import { createPostProjectMonthlyCostService } from '../../src/services/accounting/posting/postProjectMonthlyCost.js';
import { createPostManualJournalService } from '../../src/services/accounting/posting/postManualJournal.js';

export { createSharedStore, createTenantPort, rawPath };

export const COA = {
    a5110: { code: '5110', nameAr: 'مشتريات مواد' }, a2110: { code: '2110', nameAr: 'الموردون' },
    a5210: { code: '5210', nameAr: 'أجور' }, a2130: { code: '2130', nameAr: 'رواتب مستحقة' },
    a1110: { code: '1110', nameAr: 'الصندوق' }, a1180: { code: '1180', nameAr: 'ضريبة مدخلات' },
    a2140: { code: '2140', nameAr: 'ضريبة مخرجات' }, a4100: { code: '4100', nameAr: 'إيرادات' },
    hdr: { code: '5000', nameAr: 'مصروفات', nature: 'header' }
};

export function makeCounters() {
    let pass = 0, fail = 0;
    const eq = (n, a, b) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log(`  ❌ ${n}\n       متوقّع: ${JSON.stringify(b)}\n       فعلي  : ${JSON.stringify(a)}`); } };
    const ok = (n, c, d) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n + (d ? '\n       ' + d : '')); } };
    const summary = () => { console.log(`\n${'═'.repeat(58)}\n  ✅ ناجح: ${pass}    ❌ فاشل: ${fail}\n${'═'.repeat(58)}`); return fail; };
    return { eq, ok, summary };
}

export const pmcRecord = (o = {}) => ({
    projectId: 'P1', category: 'materials', amount: 5000, month: '2026-05',
    date: '2026-05-15', description: 'توريد حديد', reference: 'REF-1',
    name: 'بند أ', createdBy: 'u-test', ...o
});

/** بيئة PMC. */
export function buildPMCEnv({ tenantId = 'T1', pmcKey = 'PMC-1', record = pmcRecord(), accounts = COA, shared, customCategories = {} } = {}) {
    const store = shared || createSharedStore();
    const port = createTenantPort(store, tenantId);
    if (record) port.update(port.ref(port.db, `ledger/projectMonthlyCosts/${pmcKey}`), record);
    const coa = new InMemoryChartOfAccountsRepository(JSON.parse(JSON.stringify(accounts)));
    const repo = new FirebaseProjectCostPostingRepository(port);
    const service = createPostProjectMonthlyCostService({
        chartOfAccountsRepo: coa, projectCostPostingRepo: repo,
        getProjectCost: async k => { const s = await port.get(port.ref(port.db, `ledger/projectMonthlyCosts/${k}`)); return s.exists() ? s.val() : null; },
        getCustomCategories: async () => customCategories
    });
    return { store, port, coa, repo, service, pmcKey, tenantId };
}

/** بيئة القيد اليدوي. */
export function buildMJEnv({ tenantId = 'T1', accounts = COA, shared, projects = {}, costCenters = {}, cfg = { currency: 'SAR' } } = {}) {
    const store = shared || createSharedStore();
    const port = createTenantPort(store, tenantId);
    const coa = new InMemoryChartOfAccountsRepository(JSON.parse(JSON.stringify(accounts)));
    const repo = new FirebaseManualJournalPostingRepository(port);
    let n = 0;
    const service = createPostManualJournalService({
        chartOfAccountsRepo: coa, manualJournalPostingRepo: repo,
        getDimensions: async () => ({ projects, costCenters }),
        cfg, currentUser: { uid: 'u1' }, newGroupId: () => `ag${++n}`
    });
    const newJournalKey = () => port.push(port.ref(port.db, 'ledger/journalEntries')).key;
    return { store, port, coa, repo, service, tenantId, newJournalKey };
}

export const SIMPLE_LINES = () => ([
    { accountCode: '5110', accountName: 'مشتريات', debit: 1000, credit: 0, description: 'شراء' },
    { accountCode: '1110', accountName: 'الصندوق', debit: 0, credit: 1000 }
]);
export const HEADER = (o = {}) => ({ date: '2026-05-15', reference: 'R1', description: 'قيد يدوي', notes: '', book: 'GEN', ...o });

export const tenantPath = (store, tenantId, path) => rawPath(store, `tenants/${tenantId}/${path}`);
export const countAt = (store, tenantId, path) => Object.keys(tenantPath(store, tenantId, path) || {}).length;
