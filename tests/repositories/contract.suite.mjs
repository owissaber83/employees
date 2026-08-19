// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  مجموعة اختبارات العقد — يجب أن يجتازها **كل** تنفيذ                          ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  هذه هي القيمة العملية لطبقة المستودع: مجموعة واحدة تُشغَّل على تنفيذ Firebase   ║
// ║  وعلى تنفيذ الذاكرة معاً. اجتيازهما معاً يعني أن العقد محايد عن التخزين فعلاً،  ║
// ║  وأن تنفيذ PostgreSQL مستقبلاً سيُقاس بنفس المسطرة قبل تبديله.                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export async function runContractSuite(name, makeRepo, t) {
    const { eq, ok } = t;
    const L = s => `[${name}] ${s}`;

    // ── القراءة على مستودع فارغ ──────────────────────────────────────────────
    {
        const repo = await makeRepo();
        eq(L('قائمة فارغة تعيد مصفوفة فارغة'), await repo.list(), []);
        eq(L('getByKey لمفتاح غير موجود ⇒ null'), await repo.getByKey('لا-يوجد'), null);
        eq(L('getByCode لرمز غير موجود ⇒ null'), await repo.getByCode('9999'), null);
        eq(L('getByKey بمفتاح فارغ ⇒ null'), await repo.getByKey(''), null);
    }

    // ── الإنشاء والقراءة ─────────────────────────────────────────────────────
    {
        const repo = await makeRepo();
        const key = await repo.create({ code: '1110', nameAr: 'الصندوق', type: 'asset', nature: 'debit' });
        ok(L('create يعيد مفتاحاً'), !!key, String(key));

        const all = await repo.list();
        eq(L('السجل يظهر في القائمة'), all.length, 1);
        eq(L('ويحمل __key'), all[0].__key, key);
        eq(L('وبياناته سليمة'), all[0].code, '1110');

        const byKey = await repo.getByKey(key);
        eq(L('getByKey يعيد السجل بمفتاحه'), byKey.nameAr, 'الصندوق');
        const byCode = await repo.getByCode('1110');
        eq(L('getByCode يعيد نفس السجل'), byCode.__key, key);
    }

    // ── 🔒 حجز الرمز الذرّي ──────────────────────────────────────────────────
    {
        const repo = await makeRepo();
        await repo.create({ code: '1110', nameAr: 'الصندوق' });
        let err = null;
        try { await repo.create({ code: '1110', nameAr: 'صندوق آخر' }); }
        catch (e) { err = e; }
        ok(L('رمز مكرّر يُرفض'), !!err);
        eq(L('بخطأ محايد CODE_TAKEN لا خطأ Firebase خام'), err && err.code, 'CODE_TAKEN');
        eq(L('ولا يُنشأ سجل ثانٍ'), (await repo.list()).length, 1);
    }

    // ── التحديث ─────────────────────────────────────────────────────────────
    {
        const repo = await makeRepo();
        const key = await repo.create({ code: '1110', nameAr: 'الصندوق', active: true });
        await repo.update(key, { nameAr: 'الصندوق الرئيسي', active: false });
        const a = await repo.getByKey(key);
        eq(L('التحديث يغيّر الحقول المطلوبة'), a.nameAr, 'الصندوق الرئيسي');
        eq(L('والحقول الأخرى تُحدَّث كذلك'), a.active, false);
        eq(L('والحقول غير المذكورة تبقى'), a.code, '1110');
    }

    // ── 🛡️ الحقول المشتقّة لا تُكتب ──────────────────────────────────────────
    {
        const repo = await makeRepo();
        const key = await repo.create({ code: '2110', nameAr: 'الموردون', __key: 'مزيّف' });
        const a = await repo.getByKey(key);
        eq(L('__key الممرَّر لا يُخزَّن (حماية المخطّط)'), a.__key, key);
        await repo.update(key, { __key: 'مزيّف2', nameAr: 'الموردون التجاريون' });
        eq(L('ولا يُكتب عبر update'), (await repo.getByKey(key)).__key, key);
    }

    // ── الحذف ───────────────────────────────────────────────────────────────
    {
        const repo = await makeRepo();
        const key = await repo.create({ code: '1110', nameAr: 'الصندوق' });
        await repo.remove(key);
        eq(L('الحذف يزيل السجل'), await repo.getByKey(key), null);
        eq(L('والقائمة تفرغ'), (await repo.list()).length, 0);

        // BUG-002 — سلوك قائم يجب أن يُحاكى لا أن يُصحَّح
        let err = null;
        try { await repo.create({ code: '1110', nameAr: 'صندوق جديد' }); } catch (e) { err = e; }
        ok(L('⚠️ BUG-002: الرمز يبقى محجوزاً بعد الحذف (سلوك قائم محفوظ)'), err && err.code === 'CODE_TAKEN');
    }

    // ── الاشتراك اللحظي ─────────────────────────────────────────────────────
    {
        const repo = await makeRepo();
        const seen = [];
        const unsub = repo.subscribe(list => seen.push(list.length));
        await repo.create({ code: '1110', nameAr: 'الصندوق' });
        await repo.create({ code: '1120', nameAr: 'البنك' });
        ok(L('الاشتراك يُبلَّغ عند كل تغيير'), seen[seen.length - 1] === 2, JSON.stringify(seen));
        unsub();
        const before = seen.length;
        await repo.create({ code: '1130', nameAr: 'العملاء' });
        eq(L('وإلغاء الاشتراك يوقف التبليغ'), seen.length, before);
    }

    // ── الأخطاء محايدة ──────────────────────────────────────────────────────
    {
        const repo = await makeRepo();
        let e1 = null, e2 = null;
        try { await repo.update('', { x: 1 }); } catch (e) { e1 = e; }
        try { await repo.remove(''); } catch (e) { e2 = e; }
        eq(L('update بلا مفتاح ⇒ NOT_FOUND'), e1 && e1.code, 'NOT_FOUND');
        eq(L('remove بلا مفتاح ⇒ NOT_FOUND'), e2 && e2.code, 'NOT_FOUND');
        ok(L('الأخطاء من نوع RepositoryError لا Error خام'), e1 && e1.name === 'RepositoryError');
    }
}
