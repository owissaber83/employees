// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  محاكي RTDB واقعي — لاختبار الذرّية وعزل المستأجرين معاً            [Phase 6]  ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الفارق عن tests/repositories/fakeRtdb.mjs (Phase 3): ذاك يحاكي مستأجراً واحداً  ║
// ║  ومسار مفرد لكل استدعاء `update`. هذا يحاكي **بدقّة** آلية app.js الفعلية:       ║
// ║     ref(db, path)         → app.js:172  (بادئة tenants/{tid}/ لمسارات ledger/*)  ║
// ║     scopeUpdates(values)  → app.js:184  (كل مفتاح في كائن التحديث يُفحَص على حدة) ║
// ║  وهذا هو ما يجعله صالحاً لاختبار **التحديث الذرّي متعدّد المسارات المطلقة**       ║
// ║  (`update(ref(db,'/'), {'ledger/a':x,'ledger/b':y})`) — النمط الذي بنى عليه      ║
// ║  FirebaseJournalPostingRepository الذرّية (§6)، ولا يغطّيه محاكي Phase 3.        ║
// ║                                                                              ║
// ║  ⚠️ متجر واحد **مشترك** بين عدّة "مستأجرين" (منافذ) — يتيح إثبات عدم التسرّب      ║
// ║  فعلياً بدل افتراضه (§7، §13 «Multi-tenancy»).                                 ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

const get = (o, path) => String(path).split('/').filter(Boolean).reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, path, v) => {
    const parts = String(path).split('/').filter(Boolean);
    if (!parts.length) return;
    let cur = o;
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (v === undefined) delete cur[parts[parts.length - 1]];
    else cur[parts[parts.length - 1]] = v;
};

/**
 * ينشئ "متجراً" مشتركاً يمكن ربط عدّة منافذ (كل واحد بمستأجره) به — يحاكي
 * قاعدة بيانات RTDB واحدة تخدم عدّة شركات معاً، بالضبط كما في الإنتاج.
 */
export function createSharedStore() {
    return { root: {}, listeners: [] };
}

/**
 * ينشئ منفذاً مرتبطاً بمستأجر واحد على متجر مشترك — يقابل جلسة مستخدم واحدة
 * بعد `buildRefs()` في app.js.
 * @param {{root:object}} shared من createSharedStore()
 * @param {string|null} tenantId  null ⇒ نطاق عام (بلا بادئة) — لمحاكاة عمليات تشغيلية/اختبارية بلا مستأجر
 */
export function createTenantPort(shared, tenantId) {
    let seq = 0;

    // مطابقة حرفية لـ app.js:172
    const scopePath = path => {
        if (typeof path === 'string' && tenantId && (path === 'ledger' || path.startsWith('ledger/'))) {
            return `tenants/${tenantId}/${path}`;
        }
        return path;
    };
    // مطابقة حرفية لـ app.js:184 — scopeUpdates
    const scopeValues = values => {
        if (!tenantId || !values || typeof values !== 'object') return values;
        const out = {};
        for (const k in values) {
            const clean = String(k).replace(/^\/+/, '');
            out[(clean === 'ledger' || clean.startsWith('ledger/')) ? `tenants/${tenantId}/${clean}` : k] = values[k];
        }
        return out;
    };

    const notify = () => shared.listeners.forEach(l => {
        const v = get(shared.root, l.path);
        l.cb({ exists: () => v != null, val: () => v });
    });

    return {
        db: { __fake: true },
        tenantId,
        // مطابقة حرفية للنمط: path==='/' لا يُطابَق أي شرط سكوب فيبقى كما هو (جذر حقيقي)
        ref: (_db, path) => ({ path: path === '/' || path == null ? '/' : scopePath(path) }),
        get: async r => { const v = get(shared.root, r.path); return { exists: () => v != null, val: () => v }; },
        push: (r, data) => {
            const key = `k${Date.now().toString(36)}${++seq}`;
            if (data !== undefined) { set(shared.root, `${r.path}/${key}`, data); notify(); }
            return { key };
        },
        // ⚠️ هذا هو الجوهر: مثل window.update الحقيقي — يُطبِّق scopeUpdates على
        // **قيم الكائن** (المفاتيح) لا على المرجع فقط، ثم يكتب كل مفتاح ناتج
        // كمسار مستقلّ من الجذر — يحاكي التحديث الذرّي متعدّد المسارات بدقّة.
        update: async (r, values) => {
            const scoped = scopeValues(values);
            Object.keys(scoped).forEach(k => set(shared.root, `${r.path === '/' ? '' : r.path}/${k}`, scoped[k]));
            notify();
        },
        remove: async r => { set(shared.root, r.path, undefined); notify(); },
        onValue: (r, cb) => {
            const l = { path: r.path, cb };
            shared.listeners.push(l);
            const v = get(shared.root, r.path);
            cb({ exists: () => v != null, val: () => v });
            return () => { const i = shared.listeners.indexOf(l); if (i >= 0) shared.listeners.splice(i, 1); };
        },
        runTransaction: async (r, fn) => {
            const current = get(shared.root, r.path);
            const next = fn(current);
            if (next === undefined) return { committed: false, snapshot: { val: () => current } };
            set(shared.root, r.path, next);
            notify();
            return { committed: true, snapshot: { val: () => next } };
        }
    };
}

/** قراءة مباشرة من المتجر لمسار مطلق حقيقي — للتأكيدات في الاختبارات فقط. */
export function rawPath(shared, path) { return get(shared.root, path); }
