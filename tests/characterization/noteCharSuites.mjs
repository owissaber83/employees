// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  اختبار توصيفي — ترقيم الإشعارات والسعة والدقّة                     [Phase 7-D] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يوثّق سلوك `generateCNNumber`/`generateDNNumber` **القديمتين** بتشغيلهما من     ║
// ║  الملف الحيّ (BUG-011)، ثم يُثبت أن العدّاد المعامِلاتي الجديد لا يُعيد إنتاجه.     ║
// ║  🔒 لا إصلاح للقديم — توصيف فقط.                                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { extractFunction } from './legacy-loader.mjs';
import { computeNoteCapacity, NOTE_TOLERANCE } from '../../src/domain/accounting/notes/computeNoteCapacity.js';
import { buildNoteEnv, makeCounters, tenantPath, countAt, createSharedStore, KINDS } from '../services/noteTestKit.mjs';

const CFG = {
    credit: { fn: 'generateCNNumber', coll: 'creditNotes', pfx: 'CN', label: 'الإشعار الدائن' },
    debit: { fn: 'generateDNNumber', coll: 'debitNotes', pfx: 'DN', label: 'الإشعار المدين' }
};

/** يُحمّل مولّد الرقم القديم بلقطة مُعطاة. */
function legacyGen(kind, notes) {
    const c = CFG[kind];
    const win = { [c.coll]: notes };
    return new Function('window', `${extractFunction(c.fn)}\nreturn ${c.fn};`)(win);
}

export async function runNoteCharSuite(kind) {
    const { ok, eq, summary } = makeCounters();
    const C = CFG[kind];
    const Y = new Date().getFullYear();
    const N = n => ({ number: `${C.pfx}-${Y}-${String(n).padStart(5, '0')}` });

    console.log(`\n╔══════════════════════════════════════════════════════════╗`);
    console.log(`║  توصيفي — ${C.label} · الترقيم والسعة · Phase 7-D`.padEnd(59) + '║');
    console.log(`╚══════════════════════════════════════════════════════════╝`);

    // ── [1] سلوك الترقيم القديم (§11) — توصيف لا إصلاح ────────────────────────
    console.log('\n[1] الترقيم القديم — توصيف السلوك الفعلي');
    eq('1 · مجموعة فارغة ⇒ 00001', legacyGen(kind, {})(), `${C.pfx}-${Y}-00001`);
    eq('2 · تسلسل 1..3 ⇒ 00004', legacyGen(kind, { a: N(1), b: N(2), c: N(3) })(), `${C.pfx}-${Y}-00004`);
    eq('3 · فجوة (1,5) ⇒ 00006 (لا تُملأ الفجوة)', legacyGen(kind, { a: N(1), b: N(5) })(), `${C.pfx}-${Y}-00006`);
    eq('4 · 🔴 حُذف الأعلى ⇒ **إعادة استخدام رقم**', legacyGen(kind, { a: N(1) })(), `${C.pfx}-${Y}-00002`);
    eq('5 · سنة سابقة فقط ⇒ 00001 (عزل السنة سليم)', legacyGen(kind, { a: { number: `${C.pfx}-${Y - 1}-00042` } })(), `${C.pfx}-${Y}-00001`);
    eq('6 · رقم مشوّه بلا مقطع ⇒ يُعامَل كصفر', legacyGen(kind, { a: { number: `${C.pfx}-${Y}-` } })(), `${C.pfx}-${Y}-00001`);
    eq('7 · رقم نصّي ⇒ يُعامَل كصفر', legacyGen(kind, { a: { number: `${C.pfx}-${Y}-ABCDE` } })(), `${C.pfx}-${Y}-00001`);
    eq('8 · سجل بلا number ⇒ لا ينهار', legacyGen(kind, { a: {} })(), `${C.pfx}-${Y}-00001`);
    eq('9 · بادئة أخرى تُتجاهَل', legacyGen(kind, { a: { number: `XX-${Y}-00009` } })(), `${C.pfx}-${Y}-00001`);
    {
        const g = legacyGen(kind, { a: N(1) });
        const first = g(), second = g();   // اللقطة لا تتحدّث بين النداءين
        eq('10 · 🔴 نداءان قبل تحديث اللقطة ⇒ **رقم مكرَّر**', second, first);
    }

    // ── [2] العدّاد المعامِلاتي الجديد (قرار المالك 2) ─────────────────────────
    console.log('\n[2] العدّاد المعامِلاتي الجديد — لا يُعيد إنتاج BUG-011');
    {
        const env = buildNoteEnv(kind);
        const r1 = await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: [2, 0] });
        const r2 = await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: [0, 5] });
        eq('11 · أول إشعار 00001', r1.noteNumber, `${C.pfx}-${Y}-00001`);
        eq('12 · الثاني 00002', r2.noteNumber, `${C.pfx}-${Y}-00002`);
        ok('13 · لا تكرار', r1.noteNumber !== r2.noteNumber);
        const counters = tenantPath(env.store, 'T1', 'ledger/counters');
        ok('14 · العدّاد داخل مجموعة counters القائمة', counters && counters[C.pfx.toLowerCase()], JSON.stringify(Object.keys(counters || {})));
    }
    {
        // إشعارات متزامنة على فاتورة تتّسع لها جميعاً ⇒ أرقام فريدة
        const env = buildNoteEnv(kind);
        const rs = await Promise.allSettled(Array.from({ length: 5 }, (_, i) =>
            env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: [0.4, 0] })));
        const nums = rs.filter(r => r.status === 'fulfilled').map(r => r.value.noteNumber);
        eq('15 · خمسة إشعارات متزامنة ⇒ خمسة أرقام', nums.length, 5);
        eq('16 · 🟢 كلها فريدة (لا تكرار كما في القديم)', new Set(nums).size, 5);
    }
    {
        // فشل بعد الحجز ⇒ فجوة مقبولة، لا تكرار
        const env = buildNoteEnv(kind);
        const realUpdate = env.port.update;
        let failed = false;
        env.port.update = async (r, v) => { if (!failed && r.path === '/') { failed = true; throw new Error('boom'); } return realUpdate(r, v); };
        try { await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: [2, 0] }); } catch (e) { /* متوقّع */ }
        const r = await env.service({ noteKey: env.newNoteKey(), invoiceKey: env.invoiceKey, returnQuantities: [2, 0] });
        eq('17 · بعد فشل ⇒ الرقم 00002 (فجوة مقبولة صراحةً)', r.noteNumber, `${C.pfx}-${Y}-00002`);
        eq('18 · ومستند واحد فقط في النهاية', countAt(env.store, 'T1', CFG[kind].coll === 'creditNotes' ? 'ledger/creditNotes' : 'ledger/debitNotes'), 1);
    }
    {
        // عزل العدّاد بين مستأجرَين
        const shared = createSharedStore();
        const A = buildNoteEnv(kind, { shared, tenantId: 'TA' });
        const B = buildNoteEnv(kind, { shared, tenantId: 'TB' });
        const [ra, rb] = await Promise.all([
            A.service({ noteKey: A.newNoteKey(), invoiceKey: 'INV-1', returnQuantities: [2, 0] }),
            B.service({ noteKey: B.newNoteKey(), invoiceKey: 'INV-1', returnQuantities: [2, 0] })
        ]);
        ok('19 · عدّاد كل مستأجر مستقلّ (كلاهما 00001)', ra.noteNumber.endsWith('00001') && rb.noteNumber.endsWith('00001'), `${ra.noteNumber}/${rb.noteNumber}`);
    }

    // ── [3] السعة المتبقّية — دقّة وعتبات ──────────────────────────────────────
    console.log('\n[3] السعة المتبقّية — الدقّة والعتبات');
    const cap = p => computeNoteCapacity({ invoiceKey: 'I', noteKey: 'N', ...p });
    eq('20 · فاتورة 100 · سابق 0 · إشعار 100 ⇒ كامل', cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: 100 }).fullyNoted, true);
    eq('21 · وباقٍ صفر', cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: 100 }).remainingAfter, 0);
    eq('22 · جزئي 60 ⇒ ليس كاملاً', cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: 60 }).fullyNoted, false);
    eq('23 · والباقي 40', cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: 60 }).remainingAfter, 40);
    eq('24 · 60 ثم 40 ⇒ كامل', cap({ grandTotal: 100, currentNotedAmount: 60, noteAmount: 40 }).fullyNoted, true);
    ok('25 · 60 ثم 41 ⇒ يُرفض', (() => { try { cap({ grandTotal: 100, currentNotedAmount: 60, noteAmount: 41 }); return false; } catch (e) { return e.name === 'AllocationConflictError'; } })());
    // تجاوز **ضمن** التسامح يُقبل: 99.99 + 0.02 = 100.01 وليس > 100 + 0.01
    ok('26 · تجاوز ضمن التسامح يُقبل', (() => { try { cap({ grandTotal: 100, currentNotedAmount: 99.99, noteAmount: 0.02 }); return true; } catch (e) { return false; } })());
    // ⚠️ مبلغ يساوي التسامح بالضبط يُرفض — الحارس القديم `grandTotal <= 0.01` محفوظ حرفياً
    ok('26b · مبلغ = التسامح بالضبط يُرفض (حارس القديم محفوظ)', (() => { try { cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: NOTE_TOLERANCE }); return false; } catch (e) { return e.name === 'ValidationError'; } })());
    ok('27 · مبلغ صفر يُرفض', (() => { try { cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: 0 }); return false; } catch (e) { return e.name === 'ValidationError'; } })());
    ok('28 · مبلغ سالب يُرفض', (() => { try { cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: -5 }); return false; } catch (e) { return e.name === 'ValidationError'; } })());
    ok('29 · إجمالي فاتورة صفر يُرفض', (() => { try { cap({ grandTotal: 0, currentNotedAmount: 0, noteAmount: 5 }); return false; } catch (e) { return e.name === 'ValidationError'; } })());
    eq('30 · المفتاح يُضاف للمصفوفة', cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: 10, existingKeys: ['X'] }).nextKeys, ['X', 'N']);
    eq('31 · ولا يتكرّر', cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: 10, existingKeys: ['N'] }).nextKeys, ['N']);
    eq('32 · توافق رجعي مع الحقل المفرد', cap({ grandTotal: 100, currentNotedAmount: 0, noteAmount: 10, legacySingleKey: 'OLD' }).nextKeys, ['OLD', 'N']);
    // 99.99 + 0.02 = 100.01 ⇒ مكتمل ⇒ يُقصّ إلى 100 بالضبط (نفس `upd.creditedAmount = grandTotal`)
    eq('33 · القصّ عند الاكتمال (سلوك القديم محفوظ)', cap({ grandTotal: 100, currentNotedAmount: 99.99, noteAmount: 0.02 }).nextNotedAmount, 100);

    console.log('\n[4] دقّة مالية على حدود التقريب');
    for (const [g, c, a, label] of [
        [0.02, 0, 0.02, '0.02 كاملة'],
        [100, 0, 0.015, '0.015'],
        [100, 0, 0.025, '0.025'],
        [1000000, 999999.98, 0.02, 'مبلغ كبير + سنتان'],
        [100, 33.33, 66.67, 'أثلاث'],
        [100, 33.33, 33.33, 'ثلث على ثلث']
    ]) {
        let r = null, threw = null;
        try { r = cap({ grandTotal: g, currentNotedAmount: c, noteAmount: a }); } catch (e) { threw = e; }
        if (threw) { ok(`34 · ${label}: رُفض بخطأ مُصنَّف`, false, `${threw.name}: ${threw.message}`); continue; }
        const expected = Math.round((c + a) * 100) / 100;
        const capped = Math.round(g * 100) / 100;
        ok(`34 · ${label}: النتيجة مقرَّبة ومتّسقة`,
            r.nextNotedAmount === (r.fullyNoted ? capped : expected),
            `next=${r.nextNotedAmount} expected=${expected} capped=${capped} full=${r.fullyNoted}`);
        ok(`34b · ${label}: المتبقّي غير سالب ومقرَّب`,
            r.remainingAfter >= -0.001 && Math.round(r.remainingAfter * 100) / 100 === r.remainingAfter,
            String(r.remainingAfter));
    }
    return summary();
}
