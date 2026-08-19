// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ مستودع شجرة الحسابات على Firebase RTDB                                 ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  الملف **الوحيد** في مسار شجرة الحسابات الذي يعرف أن التخزين RTDB.             ║
// ║                                                                              ║
// ║  المسارات وأسماء الحقول منقولة حرفياً عن accounting.js — لا تغيير في المخطّط:  ║
// ║    ledger/chartOfAccounts            السجلات                                  ║
// ║    ledger/counters/coaCode/{code}    حجز الرمز الذرّي                          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ChartOfAccountsRepository, stripDerived } from '../contracts/ChartOfAccountsRepository.js';
import { RepositoryError, REPO_ERRORS, translateRtdbError } from '../contracts/errors.js';

const PATH = 'ledger/chartOfAccounts';
const CLAIM = code => `ledger/counters/coaCode/${code}`;

/** يحوّل كائن RTDB المفتاحي إلى مصفوفة سجلات تحمل `__key`. */
export function toRecords(value) {
    if (!value || typeof value !== 'object') return [];
    return Object.keys(value).map(k => ({ ...value[k], __key: k }));
}

export class FirebaseChartOfAccountsRepository extends ChartOfAccountsRepository {
    /**
     * @param {object} port منفذ RTDB من createRtdbPort
     * @param {object} [opts] `cache` دالة تعيد الذاكرة المحلية (window.chartOfAccounts)
     */
    constructor(port, opts = {}) {
        super();
        if (!port) throw new RepositoryError(REPO_ERRORS.UNAVAILABLE, 'منفذ RTDB مطلوب');
        this._p = port;
        this._readCache = opts.cache || null;
    }

    _ref(path) { return this._p.ref(this._p.db, path); }

    async list() {
        // الذاكرة المحلية يملؤها onValue القائم؛ استخدامها يتجنّب قراءة زائدة
        // ويطابق ما تراه الواجهة القديمة بالضبط.
        if (this._readCache) {
            const cached = this._readCache();
            if (cached && typeof cached === 'object') return toRecords(cached);
        }
        try {
            const snap = await this._p.get(this._ref(PATH));
            return toRecords(snap && snap.exists() ? snap.val() : null);
        } catch (e) { throw translateRtdbError(e); }
    }

    async getByKey(key) {
        if (!key) return null;
        if (this._readCache) {
            const c = this._readCache();
            if (c && c[key]) return { ...c[key], __key: key };
        }
        try {
            const snap = await this._p.get(this._ref(`${PATH}/${key}`));
            return snap && snap.exists() ? { ...snap.val(), __key: key } : null;
        } catch (e) { throw translateRtdbError(e); }
    }

    async getByCode(code) {
        if (!code) return null;
        const all = await this.list();
        return all.find(a => a.code === code) || null;
    }

    /**
     * حجزٌ ذرّي للرمز على الخادم ثم إضافة — نفس تسلسل accounting.js:894.
     * الحجز يسبق الإضافة عمداً: فحص التكرار من الذاكرة المحلية وحده لا يمنع
     * مستخدمَين متزامنَين.
     */
    async create(account) {
        const data = stripDerived(account);
        const code = data && data.code;
        if (!code) throw new RepositoryError(REPO_ERRORS.UNKNOWN, 'رمز الحساب مطلوب');

        let claim;
        try {
            claim = await this._p.runTransaction(this._ref(CLAIM(code)),
                current => (current ? undefined : true));
        } catch (e) { throw translateRtdbError(e); }

        if (!claim || !claim.committed) {
            throw new RepositoryError(REPO_ERRORS.CODE_TAKEN,
                'رمز الحساب محجوز — اختر رمزاً مختلفاً');
        }

        try {
            const r = await this._p.push(this._ref(PATH), data);
            return r && r.key;
        } catch (e) { throw translateRtdbError(e); }
    }

    async update(key, patch) {
        if (!key) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الحساب مطلوب');
        try {
            await this._p.update(this._ref(`${PATH}/${key}`), stripDerived(patch));
        } catch (e) { throw translateRtdbError(e); }
    }

    /** ⚠️ لا يحرّر حجز الرمز — سلوك قائم موثّق في BUGS_TO_FIX (BUG-002). لم يُغيَّر. */
    async remove(key) {
        if (!key) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الحساب مطلوب');
        try {
            await this._p.remove(this._ref(`${PATH}/${key}`));
        } catch (e) { throw translateRtdbError(e); }
    }

    subscribe(onChange) {
        const unsub = this._p.onValue(this._ref(PATH), snap => {
            onChange(toRecords(snap && snap.exists() ? snap.val() : null));
        });
        return typeof unsub === 'function' ? unsub : () => {};
    }
}
