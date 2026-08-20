// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  أجسام اختبارات خدمات الإشعارات — مشتركة، تُشغَّل لكل مسار على حدة   [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الجسم مشترك لأن **الآلية** مشتركة (مطالبة · سعة · ذرّية · تعويض)، لكن كل        ║
// ║  مسار يُشغَّل بمجموعاته وحقوله وحساباته الحقيقية — فلا يُفترَض تماثل السلوك.       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildNoteEnv, makeCounters, tenantPath, countAt, createSharedStore, ACCOUNTS, KINDS } from './noteTestKit.mjs';

const without = (...codes) => {
    const out = {};
    for (const [k, a] of Object.entries(ACCOUNTS)) if (!codes.includes(a.code)) out[k] = a;
    return out;
};
const grab = async fn => { try { return { value: await fn(), err: null }; } catch (e) { return { value: null, err: e }; } };

/** إرجاع كامل / جزئي عبر كميات صريحة — الفاتورة القياسية: 1500+500 = 2300 شاملة الضريبة. */
const FULL = undefined;          // بلا كميات ⇒ إرجاع كامل (2300)
const PART_A = [2, 0];           // 1500 + 225 = 1725
const PART_B = [0, 5];           //  500 +  75 =  575

export function header(title) {
    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║  ${title.padEnd(54)}║`);
    console.log(`╚══════════════════════════════════════════════════════════╝`);
}

// ═══════════════════════════════════════════════════════════════════════════════
export async function runIdempotencySuite(kind) {
    const { ok, eq, summary } = makeCounters();
    const K = buildNoteEnv(kind).K;
    header(`Idempotency — ${K.label} · Phase 7 Step D`);

    console.log('\n[1] الإصدار المفرد');
    {
        const env = buildNoteEnv(kind);
        const noteKey = env.newNoteKey();
        const r = await env.service({ noteKey, invoiceKey: env.invoiceKey, returnQuantities: FULL });
        ok('إصدار واحد ينجح', r.success && !r.alreadyPosted);
        eq('مستند واحد', countAt(env.store, 'T1', K.noteCollection), 1);
        eq('قيد واحد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
        eq('حركتا مخزون', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 2);
        const note = tenantPath(env.store, 'T1', `${K.noteCollection}/${noteKey}`);
        eq('حالة المستند posted', note.status, 'posted');
        ok('المستند مربوط بالقيد', note.journalEntryKey === r.journalId);
        ok('رقم الإشعار بالصيغة المتوقّعة', new RegExp(`^${K.numberPrefix}-\\d{4}-\\d{5}$`).test(r.noteNumber), r.noteNumber);
        ok('مفتاح Idempotency حتمي', r.idempotencyKey === `${kind}Note:${noteKey}:POST`, r.idempotencyKey);
    }

    console.log('\n[2] نفس noteKey مرّتين — تسلسلي');
    {
        const env = buildNoteEnv(kind);
        const noteKey = env.newNoteKey();
        const r1 = await env.service({ noteKey, invoiceKey: env.invoiceKey, returnQuantities: PART_A });
        const r2 = await env.service({ noteKey, invoiceKey: env.invoiceKey, returnQuantities: PART_A });
        ok('الطلب الثاني idempotent لا فاشل', r2.success && r2.alreadyPosted === true);
        eq('ولا مستند ثانٍ', countAt(env.store, 'T1', K.noteCollection), 1);
        eq('ولا قيد ثانٍ', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
        eq('ولا حركات إضافية', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
        eq('ويعيد نفس القيد', r2.journalId, r1.journalId);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        eq('ولا يتضاعف أثر الفاتورة', inv[K.fields.notedAmount], 1725);
        eq('ولا يتكرّر المفتاح في المصفوفة', inv[K.fields.keys].length, 1);
    }

    console.log('\n[3] نفس noteKey متزامناً');
    for (const n of [2, 5, 10]) {
        const env = buildNoteEnv(kind);
        const noteKey = env.newNoteKey();
        const rs = await Promise.allSettled(
            Array.from({ length: n }, () => env.service({ noteKey, invoiceKey: env.invoiceKey, returnQuantities: PART_A }))
        );
        const fulfilled = rs.filter(r => r.status === 'fulfilled').map(r => r.value);
        const fresh = fulfilled.filter(r => !r.alreadyPosted);
        eq(`${n} طلباً متزامناً ⇒ إصدار أصلي واحد`, fresh.length, 1);
        eq(`${n} ⇒ مستند واحد`, countAt(env.store, 'T1', K.noteCollection), 1);
        eq(`${n} ⇒ قيد واحد`, countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
        eq(`${n} ⇒ حركة واحدة`, countAt(env.store, 'T1', 'ledger/inventoryMovements'), 1);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        eq(`${n} ⇒ أثر مالي مفرد على الفاتورة`, inv[K.fields.notedAmount], 1725);
    }

    console.log('\n[4] مفاتيح مختلفة ⇒ إشعارات مختلفة (ليست idempotent)');
    {
        const env = buildNoteEnv(kind);
        const a = await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_A });
        const b = await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_B });
        ok('كلاهما نجح', a.success && b.success && !a.alreadyPosted && !b.alreadyPosted);
        eq('مستندان', countAt(env.store, 'T1', K.noteCollection), 2);
        eq('قيدان', countAt(env.store, 'T1', 'ledger/journalEntries'), 2);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        eq('والمجموع 2300 (لا ضياع تحديث — BUG-012)', inv[K.fields.notedAmount], 2300);
        eq('والمفتاحان محفوظان', inv[K.fields.keys].length, 2);
        eq('والفاتورة صارت مُلغاة بالكامل', inv[K.fields.fully], true);
    }

    console.log('\n[5] noteKey مفقود ⇒ رفض صريح');
    {
        const env = buildNoteEnv(kind);
        const { err } = await grab(() => env.service({ invoiceKey: env.invoiceKey }));
        ok('ValidationError — المرساة مطلوبة', err && err.name === 'ValidationError', err && err.name);
    }
    return summary();
}

// ═══════════════════════════════════════════════════════════════════════════════
export async function runAllocationSuite(kind) {
    const { ok, eq, summary } = makeCounters();
    const K = buildNoteEnv(kind).K;
    header(`السعة المتبقّية والتجاوز — ${K.label}`);

    console.log('\n[1] رفض التجاوز (قرار المالك 3 — BUG-013)');
    {
        const env = buildNoteEnv(kind);
        await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_A }); // 1725
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL })); // 2300 > 575
        ok('الإشعار الثاني الكامل يُرفض', err && err.name === 'AllocationConflictError', err && `${err.name}: ${err.message}`);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        eq('والمبلغ يبقى 1725 لا 2300', inv[K.fields.notedAmount], 1725);
        eq('ولا قيد ثانٍ', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
        eq('ولا مستند ثانٍ', countAt(env.store, 'T1', K.noteCollection), 1);
        ok('ولا أثر دفتري مُتجاوِز (لا 4025)', true);
    }

    console.log('\n[2] الاستهلاك الكامل بجزأين متكاملين');
    {
        const env = buildNoteEnv(kind);
        const a = await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_A });
        const b = await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_B });
        eq('1725 ثم 575', [a.invoiceState.notedAmount, b.invoiceState.notedAmount], [1725, 2300]);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        eq('المجموع 2300 بالضبط', inv[K.fields.notedAmount], 2300);
        eq('والحالة مُلغاة بالكامل', inv[K.fields.fully], true);
        eq('والمتبقّي صفر', b.invoiceState.remainingAfter, 0);
    }

    console.log('\n[3] السباق الحقيقي — إشعاران متزامنان لا يتّسع لهما المتبقّي');
    for (const n of [2, 5, 10]) {
        const env = buildNoteEnv(kind);
        // كلٌّ منهما 1725 والفاتورة 2300 ⇒ واحد فقط يسع
        const rs = await Promise.allSettled(
            Array.from({ length: n }, () => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_A }))
        );
        const okCount = rs.filter(r => r.status === 'fulfilled').length;
        const conflicts = rs.filter(r => r.status === 'rejected' && r.reason.name === 'AllocationConflictError').length;
        eq(`${n} متزامناً ⇒ ناجح واحد فقط`, okCount, 1);
        eq(`${n} ⇒ والباقي تعارض سعة مُصنَّف`, conflicts, n - 1);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        eq(`${n} ⇒ المبلغ 1725 لا ${1725 * n}`, inv[K.fields.notedAmount], 1725);
        eq(`${n} ⇒ قيد واحد`, countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
        eq(`${n} ⇒ مستند واحد`, countAt(env.store, 'T1', K.noteCollection), 1);
        eq(`${n} ⇒ مفتاح واحد في المصفوفة`, inv[K.fields.keys].length, 1);
    }

    console.log('\n[4] السباق المتكامل — كلاهما يسع فيُقبلان معاً');
    {
        const env = buildNoteEnv(kind);
        const rs = await Promise.allSettled([
            env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_A }),
            env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_B })
        ]);
        eq('كلاهما نجح', rs.filter(r => r.status === 'fulfilled').length, 2);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        eq('والمجموع 2300 (لا ضياع تحديث ولا تجاوز)', inv[K.fields.notedAmount], 2300);
        eq('ومفتاحان محفوظان', inv[K.fields.keys].length, 2);
        eq('وقيدان', countAt(env.store, 'T1', 'ledger/journalEntries'), 2);
    }

    console.log('\n[5] فاتورة مُلغاة بالكامل ترفض أي إشعار جديد');
    {
        const env = buildNoteEnv(kind);
        await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL });
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_A }));
        ok('يُرفض عند حارس fullyNoted', err && err.name === 'ValidationError', err && `${err.name}: ${err.message}`);
        eq('ولا قيد إضافي', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    }
    return summary();
}

// ═══════════════════════════════════════════════════════════════════════════════
export async function runAtomicitySuite(kind) {
    const { ok, eq, summary } = makeCounters();
    const K = buildNoteEnv(kind).K;
    header(`الذرّية — ${K.label}`);

    console.log('\n[1] كتابة ذرّية واحدة تضمّ المستند والقيد وكل الحركات');
    {
        const env = buildNoteEnv(kind);
        const calls = [];
        const realUpdate = env.port.update;
        env.port.update = async (r, v) => { calls.push({ path: r.path, keys: Object.keys(v) }); return realUpdate(r, v); };
        await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL });
        const atomic = calls.filter(c => c.path === '/');
        eq('استدعاء ذرّي واحد على الجذر', atomic.length, 1);
        ok('يضمّ المستند', atomic[0].keys.some(k => k.startsWith(K.noteCollection)));
        ok('يضمّ القيد', atomic[0].keys.some(k => k.startsWith('ledger/journalEntries/')));
        eq('ويضمّ الحركتين معاً', atomic[0].keys.filter(k => k.startsWith('ledger/inventoryMovements/')).length, 2);
    }

    console.log('\n[2] فشل الكتابة الذرّية ⇒ لا شيء يبقى + تعويض الفاتورة');
    {
        const env = buildNoteEnv(kind);
        const realUpdate = env.port.update;
        env.port.update = async (r, v) => { if (r.path === '/') throw new Error('network unavailable'); return realUpdate(r, v); };
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL }));
        ok('AtomicityError مُصنَّف', err && err.name === 'AtomicityError', err && err.name);
        eq('لا مستند', countAt(env.store, 'T1', K.noteCollection), 0);
        eq('لا قيد', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
        eq('لا حركات', countAt(env.store, 'T1', 'ledger/inventoryMovements'), 0);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        ok('والفاتورة عُوِّضت بالكامل', !inv[K.fields.notedAmount] && !inv[K.fields.fully] && !inv[K.fields.keys],
            JSON.stringify({ a: inv[K.fields.notedAmount], f: inv[K.fields.fully], k: inv[K.fields.keys] }));
    }

    console.log('\n[3] إعادة المحاولة بعد الفشل تنجح');
    {
        const env = buildNoteEnv(kind);
        const realUpdate = env.port.update;
        let failed = false;
        env.port.update = async (r, v) => { if (!failed && r.path === '/') { failed = true; throw new Error('network unavailable'); } return realUpdate(r, v); };
        const k1 = env.newNoteKey();
        await grab(() => env.service({ noteKey: k1, invoiceKey: env.invoiceKey, returnQuantities: FULL }));
        const r2 = await env.service({ noteKey: k1, invoiceKey: env.invoiceKey, returnQuantities: FULL });
        ok('إعادة المحاولة بنفس المفتاح تنجح (المطالبة حُرِّرت)', r2.success && !r2.alreadyPosted, JSON.stringify(r2));
        eq('مستند واحد', countAt(env.store, 'T1', K.noteCollection), 1);
        eq('قيد واحد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        eq('وأثر مالي مفرد', inv[K.fields.notedAmount], 2300);
    }

    console.log('\n[4] فشل حجز الأرقام ⇒ صفر كتابة');
    {
        const env = buildNoteEnv(kind);
        const real = env.port.runTransaction;
        env.port.runTransaction = async (r, fn) => {
            if (String(r.path).includes(`counters/${K.counterKind}`)) throw new Error('permission_denied');
            return real(r, fn);
        };
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL }));
        ok('خطأ مستودع محايد', err && err.name === 'RepositoryError', err && err.name);
        eq('لا مستند', countAt(env.store, 'T1', K.noteCollection), 0);
        eq('لا قيد', countAt(env.store, 'T1', 'ledger/journalEntries'), 0);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        ok('والفاتورة لم تُمَسّ', !inv[K.fields.notedAmount]);
    }
    return summary();
}

// ═══════════════════════════════════════════════════════════════════════════════
export async function runTenantSuite(kind) {
    const { ok, eq, summary } = makeCounters();
    const K = buildNoteEnv(kind).K;
    header(`عزل المستأجرين — ${K.label}`);

    console.log('\n[1] نفس noteKey ونفس invoiceKey في مستأجرَين — متزامن');
    {
        const shared = createSharedStore();
        const A = buildNoteEnv(kind, { shared, tenantId: 'TA', invoiceKey: 'INV-SAME', invoice: KINDS[kind].makeInvoice({ number: 'A-001' }) });
        const B = buildNoteEnv(kind, { shared, tenantId: 'TB', invoiceKey: 'INV-SAME', invoice: KINDS[kind].makeInvoice({ number: 'B-999' }) });
        const SAME_KEY = 'NOTE-SAME-KEY';

        const [ra, rb] = await Promise.all([
            A.service({ noteKey: SAME_KEY, invoiceKey: 'INV-SAME', returnQuantities: FULL }),
            B.service({ noteKey: SAME_KEY, invoiceKey: 'INV-SAME', returnQuantities: FULL })
        ]);
        ok('كلا المستأجرَين أصدر بنجاح', ra.success && !ra.alreadyPosted && rb.success && !rb.alreadyPosted);
        eq('TA: مستند واحد', countAt(shared, 'TA', K.noteCollection), 1);
        eq('TB: مستند واحد', countAt(shared, 'TB', K.noteCollection), 1);
        eq('TA: قيد واحد', countAt(shared, 'TA', 'ledger/journalEntries'), 1);
        eq('TB: قيد واحد', countAt(shared, 'TB', 'ledger/journalEntries'), 1);

        const jA = Object.values(tenantPath(shared, 'TA', 'ledger/journalEntries'))[0];
        const jB = Object.values(tenantPath(shared, 'TB', 'ledger/journalEntries'))[0];
        ok('TA: قيده يشير لفاتورته', jA.description.includes('A-001') && !jA.description.includes('B-999'));
        ok('TB: قيده يشير لفاتورته', jB.description.includes('B-999') && !jB.description.includes('A-001'));

        ok('الترقيم لا يُتقاسَم (كلاهما 00001)', ra.noteNumber.endsWith('00001') && rb.noteNumber.endsWith('00001'), `${ra.noteNumber}/${rb.noteNumber}`);
        eq('TA: حركاته في نطاقه', countAt(shared, 'TA', 'ledger/inventoryMovements'), 2);
        eq('TB: حركاته في نطاقه', countAt(shared, 'TB', 'ledger/inventoryMovements'), 2);
        ok('لا كتابة في `ledger/` العام', tenantPath(shared, '', '') === undefined || shared.root.ledger === undefined);
        eq('جذر المتجر يحوي tenants فقط', Object.keys(shared.root), ['tenants']);
        eq('وتحته المستأجران فقط', Object.keys(shared.root.tenants).sort(), ['TA', 'TB']);
    }

    console.log('\n[2] فشل مستأجر لا يمسّ الآخر');
    {
        const shared = createSharedStore();
        const A = buildNoteEnv(kind, { shared, tenantId: 'TA', invoiceKey: 'INV-1' });
        const B = buildNoteEnv(kind, { shared, tenantId: 'TB', invoiceKey: 'INV-1' });
        const realUpdate = B.port.update;
        B.port.update = async (r, v) => { if (r.path === '/') throw new Error('network unavailable'); return realUpdate(r, v); };

        const [ra, rb] = await Promise.allSettled([
            A.service({ noteKey: A.newNoteKey(), invoiceKey: 'INV-1', returnQuantities: FULL }),
            B.service({ noteKey: 'BKEY', invoiceKey: 'INV-1', returnQuantities: FULL })
        ]);
        ok('TA نجح', ra.status === 'fulfilled');
        ok('TB فشل بـAtomicityError', rb.status === 'rejected' && rb.reason.name === 'AtomicityError');
        eq('TA: قيده موجود', countAt(shared, 'TA', 'ledger/journalEntries'), 1);
        eq('TB: لا قيد', countAt(shared, 'TB', 'ledger/journalEntries'), 0);
        const invB = tenantPath(shared, 'TB', `${K.invoiceCollection}/INV-1`);
        ok('TB: فاتورته عُوِّضت', !invB[K.fields.notedAmount]);
        const invA = tenantPath(shared, 'TA', `${K.invoiceCollection}/INV-1`);
        eq('TA: فاتورته صحيحة', invA[K.fields.notedAmount], 2300);
    }

    console.log('\n[3] مستأجر لا يرى فاتورة الآخر');
    {
        const shared = createSharedStore();
        const A = buildNoteEnv(kind, { shared, tenantId: 'TA', invoiceKey: 'ONLY-A' });
        const B = buildNoteEnv(kind, { shared, tenantId: 'TB', invoiceKey: 'ONLY-B' });
        const { err } = await grab(() => B.service({ noteKey: B.newNoteKey(), invoiceKey: 'ONLY-A', returnQuantities: FULL }));
        ok('ValidationError «غير موجودة»', err && err.name === 'ValidationError', err && err.name);
        eq('ولا كتابة في نطاق A', countAt(shared, 'TA', 'ledger/journalEntries'), 0);
        eq('ولا في نطاق B', countAt(shared, 'TB', 'ledger/journalEntries'), 0);
    }
    return summary();
}

// ═══════════════════════════════════════════════════════════════════════════════
export async function runFailureSuite(kind) {
    const { ok, eq, summary } = makeCounters();
    const K = buildNoteEnv(kind).K;
    header(`حقن الفشل A–M — ${K.label}`);
    const clean = env => countAt(env.store, 'T1', 'ledger/journalEntries') === 0
        && countAt(env.store, 'T1', 'ledger/inventoryMovements') === 0
        && countAt(env.store, 'T1', K.noteCollection) === 0;

    console.log('\n[A] فاتورة مصدر مفقودة');
    {
        const env = buildNoteEnv(kind, { invoice: null });
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: 'GHOST', returnQuantities: FULL }));
        ok('A · ValidationError', err && err.name === 'ValidationError', err && err.name);
        ok('A · صفر كتابة', clean(env));
    }

    console.log('\n[B] حساب مفقود — منع BUG-010');
    for (const code of K.missingAccountCodes) {
        const env = buildNoteEnv(kind, { accounts: without(code) });
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL }));
        ok(`B · غياب ${code} ⇒ MissingAccountError`, err && err.name === 'MissingAccountError', err && `${err.name}: ${err.message}`);
        ok(`B · غياب ${code} ⇒ صفر كتابة (لا مستند ولا مخزون ولا فاتورة)`, clean(env));
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        ok(`B · غياب ${code} ⇒ الفاتورة لم تُمَسّ`, !inv[K.fields.notedAmount] && !inv[K.fields.fully]);
    }

    console.log('\n[C·D] إشعار/كميات غير صالحة');
    {
        const env = buildNoteEnv(kind);
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: [0, 0] }));
        ok('C · كل الكميات صفر ⇒ رفض', err && err.name === 'ValidationError', err && err.name);
        ok('C · صفر كتابة', clean(env));
    }
    {
        const env = buildNoteEnv(kind);
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: [-1, -1] }));
        ok('D · كمّية سالبة ⇒ رفض', err && err.name === 'ValidationError', err && err.name);
    }
    {
        const env = buildNoteEnv(kind);
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: [1, 1, 1, 1] }));
        ok('D2 · كميات أكثر من السطور ⇒ رفض', err && err.name === 'ValidationError');
    }
    {
        const env = buildNoteEnv(kind, { invoice: K.makeInvoice({ status: 'draft' }) });
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL }));
        ok('D3 · فاتورة غير مرحّلة ⇒ رفض (حارس محفوظ)', err && err.name === 'ValidationError');
    }

    console.log('\n[E·F] فشل حجز الأرقام / المطالبة');
    {
        const env = buildNoteEnv(kind);
        const real = env.port.runTransaction;
        env.port.runTransaction = async (r, fn) => {
            if (String(r.path).includes('counters/jrn')) throw new Error('network unavailable');
            return real(r, fn);
        };
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL }));
        ok('E · RepositoryError/UNAVAILABLE', err && err.name === 'RepositoryError' && err.code === 'UNAVAILABLE', err && `${err.name}/${err.code}`);
        ok('E · صفر كتابة', clean(env));
    }
    {
        const env = buildNoteEnv(kind);
        env.port.runTransaction = async r => {
            if (String(r.path).endsWith('/status')) throw new Error('permission_denied');
            throw new Error('unexpected');
        };
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL }));
        ok('F · PERMISSION_DENIED مترجَم', err && err.name === 'RepositoryError' && err.code === 'PERMISSION_DENIED', err && `${err.name}/${err.code}`);
    }

    console.log('\n[G·H·I] فشل الكتابة الذرّية (مستند + قيد + حركات معاً)');
    {
        const env = buildNoteEnv(kind);
        const realUpdate = env.port.update;
        env.port.update = async (r, v) => { if (r.path === '/') throw new Error('disk full'); return realUpdate(r, v); };
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL }));
        ok('G·H·I · AtomicityError واحدة', err && err.name === 'AtomicityError');
        ok('H · لا قيد', countAt(env.store, 'T1', 'ledger/journalEntries') === 0);
        ok('I · لا حركة (ولا واحدة من اثنتين)', countAt(env.store, 'T1', 'ledger/inventoryMovements') === 0);
        ok('G · لا مستند', countAt(env.store, 'T1', K.noteCollection) === 0);
        ok('السبب الأصلي محفوظ في التفاصيل', err.details && err.details.cause === 'disk full');
    }

    console.log('\n[J] فشل التعويض نفسه');
    {
        const env = buildNoteEnv(kind);
        const realUpdate = env.port.update;
        const realTx = env.port.runTransaction;
        env.port.update = async (r, v) => { if (r.path === '/') throw new Error('disk full'); return realUpdate(r, v); };
        let allocDone = false;
        env.port.runTransaction = async (r, fn) => {
            // ⚠️ الرمي يجب أن يسبق التنفيذ الفعلي، وإلا طُبِّق التعويض ثم رُمي فبدا ناجحاً
            if (String(r.path).includes(K.invoiceCollection)) {
                if (allocDone) throw new Error('compensation failed');   // نداء التعويض فقط
                allocDone = true;
            }
            return realTx(r, fn);
        };
        const { err } = await grab(() => env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: FULL }));
        ok('J · الخطأ الأصلي هو ما يُبلَّغ لا خطأ التعويض', err && err.name === 'AtomicityError', err && err.name);
        ok('J · ولا كتابة مالية عالقة (لا قيد ولا مستند)',
            countAt(env.store, 'T1', 'ledger/journalEntries') === 0 && countAt(env.store, 'T1', K.noteCollection) === 0);
        const inv = tenantPath(env.store, 'T1', `${K.invoiceCollection}/INV-1`);
        ok('J · لكن الفاتورة تبقى مُخصَّصة — حدّ موثَّق صراحةً (تعويض أفضل جهد)', inv[K.fields.notedAmount] === 2300, JSON.stringify(inv[K.fields.notedAmount]));
    }

    console.log('\n[K·L] التكرار والتزامن');
    {
        const env = buildNoteEnv(kind);
        const noteKey = env.newNoteKey();
        await env.service({ noteKey, invoiceKey: env.invoiceKey, returnQuantities: PART_A });
        const r = await env.service({ noteKey, invoiceKey: env.invoiceKey, returnQuantities: PART_A });
        ok('K · التكرار ⇒ alreadyPosted بلا كتابة', r.alreadyPosted === true);
        eq('K · قيد واحد', countAt(env.store, 'T1', 'ledger/journalEntries'), 1);
    }
    {
        const env = buildNoteEnv(kind);
        const rs = await Promise.allSettled(Array.from({ length: 4 }, () =>
            env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: PART_A })));
        eq('L · 4 إشعارات متزامنة على سعة تكفي واحداً ⇒ ناجح واحد', rs.filter(r => r.status === 'fulfilled').length, 1);
    }

    console.log('\n[M] طلب عابر للمستأجرين');
    {
        const shared = createSharedStore();
        const A = buildNoteEnv(kind, { shared, tenantId: 'TA', invoiceKey: 'A-ONLY' });
        const B = buildNoteEnv(kind, { shared, tenantId: 'TB', invoiceKey: 'B-ONLY' });
        const { err } = await grab(() => B.service({ noteKey: B.newNoteKey(), invoiceKey: 'A-ONLY', returnQuantities: FULL }));
        ok('M · لا يرى فاتورة المستأجر الآخر', err && err.name === 'ValidationError');
        eq('M · صفر كتابة في A', countAt(shared, 'TA', 'ledger/journalEntries'), 0);
        eq('M · صفر كتابة في B', countAt(shared, 'TB', 'ledger/journalEntries'), 0);
    }
    return summary();
}
