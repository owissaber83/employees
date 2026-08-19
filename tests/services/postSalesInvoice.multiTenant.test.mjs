// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  عزل المستأجرين — ترحيل فاتورة المبيعات                            [Phase 7-C] ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  متجر **واحد مشترك** يخدم مستأجرَين — كما في الإنتاج تماماً. نفس مفتاح الفاتورة   ║
// ║  في الاثنين، ترحيل متزامن، ثم إثبات صفر تسرّب على: الفاتورة · القيد · حركات      ║
// ║  المخزون · العدّادات.                                                          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { buildSalesEnv, makeCounters, createSharedStore, tenantPath, countAt, salesInvoice, rawPath } from './salesInvoiceTestKit.mjs';

const { ok, eq, summary } = makeCounters();
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  عزل المستأجرين — فاتورة المبيعات · Phase 7 Step C        ║');
console.log('╚══════════════════════════════════════════════════════════╝');

const KEY = 'SINV-SAME';

console.log('\n[1] نفس مفتاح الفاتورة في مستأجرَين — ترحيل متزامن');
{
    const shared = createSharedStore();
    const A = buildSalesEnv({
        shared, tenantId: 'TA', invoiceKey: KEY,
        invoice: salesInvoice({ number: 'A-001', netBeforeTax: 20000, vatTotal: 3000, grandTotal: 23000, lines: [{ itemId: 'IT1', qty: 5, unitPrice: 4000 }] }),
        currentUser: { uid: 'userA' }
    });
    const B = buildSalesEnv({
        shared, tenantId: 'TB', invoiceKey: KEY,
        invoice: salesInvoice({ number: 'B-999', netBeforeTax: 1000, vatTotal: 150, grandTotal: 1150, lines: [{ itemId: 'IT2', qty: 3, unitPrice: 30 }] }),
        currentUser: { uid: 'userB' }
    });

    const [rA, rB] = await Promise.all([
        A.service({ invoiceKey: KEY }),
        B.service({ invoiceKey: KEY })
    ]);

    ok('كلا المستأجرَين رحّل بنجاح (لا يحجب أحدهما الآخر)', rA.success && !rA.alreadyPosted && rB.success && !rB.alreadyPosted);

    eq('TA: قيد واحد', countAt(shared, 'TA', 'ledger/journalEntries'), 1);
    eq('TB: قيد واحد', countAt(shared, 'TB', 'ledger/journalEntries'), 1);

    const jA = Object.values(tenantPath(shared, 'TA', 'ledger/journalEntries'))[0];
    const jB = Object.values(tenantPath(shared, 'TB', 'ledger/journalEntries'))[0];
    eq('TA: مبلغ قيده يخصّه', jA.totalDebit, 23000);
    eq('TB: مبلغ قيده يخصّه', jB.totalDebit, 1150);
    ok('TA: مرجع القيد يخصّه', jA.reference.includes('A-001') && !jA.reference.includes('B-999'));
    ok('TB: مرجع القيد يخصّه', jB.reference.includes('B-999') && !jB.reference.includes('A-001'));
    eq('TA: مُرحِّله userA', jA.postedBy, 'userA');
    eq('TB: مُرحِّله userB', jB.postedBy, 'userB');

    eq('TA: حركة مخزون واحدة', countAt(shared, 'TA', 'ledger/inventoryMovements'), 1);
    eq('TB: حركة مخزون واحدة', countAt(shared, 'TB', 'ledger/inventoryMovements'), 1);
    const mA = Object.values(tenantPath(shared, 'TA', 'ledger/inventoryMovements'))[0];
    const mB = Object.values(tenantPath(shared, 'TB', 'ledger/inventoryMovements'))[0];
    eq('TA: صنف حركته يخصّه', mA.itemId, 'IT1');
    eq('TB: صنف حركته يخصّه', mB.itemId, 'IT2');
    eq('TA: كمّيته', mA.qty, 5);
    eq('TB: كمّيته', mB.qty, 3);

    const invA = tenantPath(shared, 'TA', `ledger/salesInvoices/${KEY}`);
    const invB = tenantPath(shared, 'TB', `ledger/salesInvoices/${KEY}`);
    eq('TA: فاتورته مربوطة بقيده هو', invA.journalEntryKey, rA.journalId);
    eq('TB: فاتورته مربوطة بقيده هو', invB.journalEntryKey, rB.journalId);
    // ⚠️ لا نُقارن المفتاحين نصّياً: مولّد المفاتيح في المحاكي عدّاد **لكل منفذ**، فقد
    // يتصادف تطابق النصّ بين مستأجرَين — بينما push الحقيقي في Firebase فريد عالمياً.
    // الثابت الحقيقي المُختبَر: مفتاح كل فاتورة يُحلّ داخل شجرة مستأجرها هو، ولمحتواه هو.
    ok('مفتاح قيد TA يُحلّ داخل TA بمحتوى TA',
        (tenantPath(shared, 'TA', 'ledger/journalEntries') || {})[invA.journalEntryKey]?.reference.includes('A-001'));
    ok('مفتاح قيد TB يُحلّ داخل TB بمحتوى TB',
        (tenantPath(shared, 'TB', 'ledger/journalEntries') || {})[invB.journalEntryKey]?.reference.includes('B-999'));
    eq('TA: رقم فاتورته لم يتبدّل', invA.number, 'A-001');
    eq('TB: رقم فاتورته لم يتبدّل', invB.number, 'B-999');

    // العدّادات: كلٌّ في نطاقه — كلاهما يبدأ من 1، لا يتقاسمان تسلسلاً
    const cA = tenantPath(shared, 'TA', 'ledger/counters');
    const cB = tenantPath(shared, 'TB', 'ledger/counters');
    ok('TA: عدّاداته داخل نطاقه', !!cA && !!cA.jrn && !!cA.invmov);
    ok('TB: عدّاداته داخل نطاقه', !!cB && !!cB.jrn && !!cB.invmov);
    ok('العدّاد لا يُتقاسَم (كلاهما 00001)', rA.journalNumber.endsWith('00001') && rB.journalNumber.endsWith('00001'),
        `${rA.journalNumber} / ${rB.journalNumber}`);
    ok('وأرقام حركات المخزون كذلك', rA.movementNumbers[0].endsWith('00001') && rB.movementNumbers[0].endsWith('00001'));

    // لا شيء كُتب خارج نطاق أي مستأجر
    ok('لا كتابة في `ledger/` العام (خارج المستأجرين)', rawPath(shared, 'ledger') === undefined,
        JSON.stringify(rawPath(shared, 'ledger') || null));
    eq('جذر المتجر يحوي tenants فقط', Object.keys(shared.root), ['tenants']);
    eq('وتحته المستأجران فقط', Object.keys(shared.root.tenants).sort(), ['TA', 'TB']);
}

console.log('\n[2] فشل مستأجر لا يمسّ الآخر');
{
    const shared = createSharedStore();
    const A = buildSalesEnv({ shared, tenantId: 'TA', invoiceKey: KEY, invoice: salesInvoice({ number: 'A-001' }) });
    const B = buildSalesEnv({ shared, tenantId: 'TB', invoiceKey: KEY, invoice: salesInvoice({ number: 'B-999' }) });

    // نُفشل الكتابة الذرّية على الجذر فقط — ونُمرّر ما عداها (وإلا عطّلنا الاسترجاع نفسه)
    const realUpdateB = B.port.update;
    B.port.update = async (r, v) => { if (r.path === '/') throw new Error('network unavailable'); return realUpdateB(r, v); };

    const [rA, rB] = await Promise.allSettled([A.service({ invoiceKey: KEY }), B.service({ invoiceKey: KEY })]);
    ok('TA نجح', rA.status === 'fulfilled' && rA.value.success);
    ok('TB فشل بـAtomicityError', rB.status === 'rejected' && rB.reason.name === 'AtomicityError');
    eq('TA: قيده موجود', countAt(shared, 'TA', 'ledger/journalEntries'), 1);
    eq('TB: لا قيد', countAt(shared, 'TB', 'ledger/journalEntries'), 0);
    eq('TA: فاتورته posted', tenantPath(shared, 'TA', `ledger/salesInvoices/${KEY}`).status, 'posted');
    eq('TB: فاتورته رجعت draft', tenantPath(shared, 'TB', `ledger/salesInvoices/${KEY}`).status, 'draft');
    eq('TA: حركته موجودة', countAt(shared, 'TA', 'ledger/inventoryMovements'), 1);
    eq('TB: لا حركات', countAt(shared, 'TB', 'ledger/inventoryMovements'), 0);
}

console.log('\n[3] شجرة حسابات مختلفة لكل مستأجر');
{
    const shared = createSharedStore();
    const A = buildSalesEnv({
        shared, tenantId: 'TA', invoiceKey: 'S1',
        accounts: { a: { code: '1130', nameAr: 'عملاء أ' }, b: { code: '4100', nameAr: 'إيرادات أ' }, c: { code: '2140', nameAr: 'ضريبة أ' } }
    });
    const B = buildSalesEnv({
        shared, tenantId: 'TB', invoiceKey: 'S1',
        accounts: { a: { code: '1130', nameAr: 'عملاء ب' }, b: { code: '4100', nameAr: 'إيرادات ب' }, c: { code: '2140', nameAr: 'ضريبة ب' } }
    });
    await Promise.all([A.service({ invoiceKey: 'S1' }), B.service({ invoiceKey: 'S1' })]);
    const jA = Object.values(tenantPath(shared, 'TA', 'ledger/journalEntries'))[0];
    const jB = Object.values(tenantPath(shared, 'TB', 'ledger/journalEntries'))[0];
    eq('TA: أسماء حساباته هو', jA.lines.find(l => l.accountCode === '1130').accountName, 'عملاء أ');
    eq('TB: أسماء حساباته هو', jB.lines.find(l => l.accountCode === '1130').accountName, 'عملاء ب');
}

process.exit(summary() ? 1 : 0);
