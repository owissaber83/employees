// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  بناء قيد تكلفة المشروع الشهرية — نقيّة، من createJournalForPMC     [Phase 7-E] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  مطابقة حرفية لمنطق البناء في accounting.js:2922 — **باستثناء** الكتابة         ║
// ║  (`push`)، وتوليد رقم القيد، وحلّ الحسابات (مسؤولية طبقة الخدمة).                ║
// ║                                                                              ║
// ║  📌 **BUG-004:** الدالة القديمة مُعرَّفة مرّتين (`:1025` و`:2922`). قُورنتا آلياً   ║
// ║  في هذه المرحلة: **متطابقتان بايتاً ببايت** (2320 حرفاً · 55 سطراً). في JS يفوز   ║
// ║  التعريف الأخير عند التنفيذ، والتطابق يجعل الفارق منعدماً سلوكياً — ولذلك         ║
// ║  `extractFunction` (تُرجع الأولى) آمنة هنا. **لم يُحذَف أيّ تعريف** (يستلزم        ║
// ║  تعديل `public/` — ممنوع بلا تفويض صريح).                                      ║
// ║                                                                              ║
// ║  🔎 تفاصيل تكسر التطابق لو أُهملت:                                             ║
// ║   • السطران يحملان `projectId` **و**`costCenter` بنفس القيمة (خلافاً لبقيّة       ║
// ║     القيود التي تحمل `costCenter` وحده).                                       ║
// ║   • `date` = `pmcData.date` وإلا `month + '-01'`.                              ║
// ║   • لا تقريب ولا تحويل عملة إطلاقاً — المبلغ يُكتب كما ورد.                      ║
// ║   • `sourceKey` = `pmcData.key` (قد يكون `undefined` في القديم — انظر §الحدود).  ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ValidationError, MissingAccountError } from '../../../services/accounting/errors/ValidationError.js';

/**
 * @param {object} p
 * @param {object} p.pmc          سجل التكلفة {amount,date,month,description,reference,projectId,createdBy,key}
 * @param {object} p.categoryInfo ناتج getPMCCategoryInfo (لأجل `ar` في الوصف)
 * @param {object|null} p.debitAccount   حساب مُحلَّل {code,nameAr}
 * @param {object|null} p.creditAccount
 * @param {string} p.journalNumber
 * @param {string} p.now  ISO
 * @returns {{journal:object, warnings:string[]}}
 */
export function buildPMCJournal({ pmc, categoryInfo, debitAccount, creditAccount, journalNumber, now }) {
    if (!pmc) throw new ValidationError('سجل تكلفة المشروع مطلوب');
    // مقابل حارسَي القديم اللذين يعرضان toast ويعيدان null — هنا خطأ مُصنَّف يصعد للمستدعي
    if (!debitAccount) {
        throw new MissingAccountError('حساب المدين الافتراضي لنوع التكلفة غير موجود في شجرة الحسابات',
            { category: pmc.category });
    }
    if (!creditAccount) {
        throw new MissingAccountError('حساب الدائن الافتراضي لنوع التكلفة غير موجود في شجرة الحسابات',
            { category: pmc.category });
    }

    const catAr = (categoryInfo && categoryInfo.ar) || '';
    const amount = pmc.amount;
    const lines = [
        {
            accountCode: debitAccount.code,
            accountName: debitAccount.nameAr,
            description: pmc.description || `تكلفة ${catAr} - ${pmc.name == null ? '' : pmc.name}`,
            costCenter: pmc.projectId || '',
            projectId: pmc.projectId || '',
            debit: amount,
            credit: 0
        },
        {
            accountCode: creditAccount.code,
            accountName: creditAccount.nameAr,
            description: `استحقاق تكلفة ${catAr} - ${pmc.name == null ? '' : pmc.name}`,
            costCenter: pmc.projectId || '',
            projectId: pmc.projectId || '',
            debit: 0,
            credit: amount
        }
    ];

    const journal = {
        number: journalNumber,
        date: pmc.date || pmc.month + '-01',
        reference: pmc.reference || `PMC-${pmc.month}`,
        description: `تكلفة مشروع شهرية: ${pmc.description || catAr}`,
        lines,
        totalDebit: amount,
        totalCredit: amount,
        status: 'posted',
        sourceType: 'project_monthly_cost',
        sourceKey: pmc.key,
        createdAt: now,
        createdBy: pmc.createdBy,
        postedAt: now,
        postedBy: pmc.createdBy
    };

    return { journal, warnings: [] };
}
