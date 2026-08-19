// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  محاكي RTDB — يحاكي عقد Firebase لا سلوكه الشبكي                              ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  يشمل غلاف `ref` الواعي بالمستأجر بنفس منطق app.js، كي تُثبت الاختبارات        ║
// ║  أن المستودع يكتب داخل مسار المستأجر لا في النطاق العام.                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

export function createFakeRtdb({ tenantId = 'T1' } = {}) {
    const store = {};
    let seq = 0;
    const listeners = [];

    const get = (o, path) => path.split('/').filter(Boolean).reduce((a, k) => (a == null ? a : a[k]), o);
    const set = (o, path, v) => {
        const parts = path.split('/').filter(Boolean);
        let cur = o;
        for (let i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        if (v === undefined) delete cur[parts[parts.length - 1]];
        else cur[parts[parts.length - 1]] = v;
    };

    // نفس منطق app.js:172 — البادئة تُضاف لمسارات ledger فقط
    const scope = path => (tenantId && (path === 'ledger' || path.startsWith('ledger/')))
        ? `tenants/${tenantId}/${path}` : path;

    const notify = () => listeners.forEach(l => {
        const v = get(store, l.path);
        l.cb({ exists: () => v != null, val: () => v });
    });

    const port = {
        db: { __fake: true },
        ref: (_db, path) => ({ path: scope(path) }),
        get: async r => { const v = get(store, r.path); return { exists: () => v != null, val: () => v }; },
        push: async (r, data) => { const key = `k${++seq}`; set(store, `${r.path}/${key}`, data); notify(); return { key }; },
        update: async (r, patch) => {
            Object.keys(patch).forEach(k => set(store, `${r.path}/${k}`, patch[k]));
            notify();
        },
        remove: async r => { set(store, r.path, undefined); notify(); },
        onValue: (r, cb) => {
            const l = { path: r.path, cb };
            listeners.push(l);
            const v = get(store, r.path);
            cb({ exists: () => v != null, val: () => v });
            return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); };
        },
        runTransaction: async (r, fn) => {
            const current = get(store, r.path);
            const next = fn(current);
            if (next === undefined) return { committed: false, snapshot: { val: () => current } };
            set(store, r.path, next);
            return { committed: true, snapshot: { val: () => next } };
        }
    };

    return { port, store, rawPath: p => get(store, p) };
}
