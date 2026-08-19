// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  تنفيذ في الذاكرة — للاختبار                                                  ║
// ║  ────────────────────────────────────────────────────────────────────────────  ║
// ║  ليس بديلاً للإنتاج، بل برهانٌ على أن العقد قابل للتنفيذ بتخزين مختلف تماماً.   ║
// ║  إن مرّ هذا التنفيذ وتنفيذ Firebase على **نفس مجموعة الاختبارات**، فالعقد      ║
// ║  محايد فعلاً عن التخزين — وهو الشرط العملي لاستبداله بـPostgreSQL لاحقاً.       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { ChartOfAccountsRepository, stripDerived } from '../contracts/ChartOfAccountsRepository.js';
import { RepositoryError, REPO_ERRORS } from '../contracts/errors.js';

export class InMemoryChartOfAccountsRepository extends ChartOfAccountsRepository {
    constructor(seed = {}) {
        super();
        this._data = { ...seed };
        this._claims = new Set();
        Object.values(this._data).forEach(a => { if (a && a.code) this._claims.add(a.code); });
        this._subs = new Set();
        this._n = 0;
    }

    _records() { return Object.keys(this._data).map(k => ({ ...this._data[k], __key: k })); }
    _emit() { this._subs.forEach(cb => cb(this._records())); }

    async list() { return this._records(); }

    async getByKey(key) {
        return key && this._data[key] ? { ...this._data[key], __key: key } : null;
    }

    async getByCode(code) {
        return (await this.list()).find(a => a.code === code) || null;
    }

    async create(account) {
        const data = stripDerived(account);
        if (!data || !data.code) throw new RepositoryError(REPO_ERRORS.UNKNOWN, 'رمز الحساب مطلوب');
        if (this._claims.has(data.code)) {
            throw new RepositoryError(REPO_ERRORS.CODE_TAKEN, 'رمز الحساب محجوز — اختر رمزاً مختلفاً');
        }
        this._claims.add(data.code);
        const key = `mem-${++this._n}`;
        this._data[key] = data;
        this._emit();
        return key;
    }

    async update(key, patch) {
        if (!key) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الحساب مطلوب');
        this._data[key] = { ...(this._data[key] || {}), ...stripDerived(patch) };
        this._emit();
    }

    /** يحاكي BUG-002 عمداً: الحجز لا يُحرَّر — كي يطابق سلوك الإنتاج. */
    async remove(key) {
        if (!key) throw new RepositoryError(REPO_ERRORS.NOT_FOUND, 'مفتاح الحساب مطلوب');
        delete this._data[key];
        this._emit();
    }

    subscribe(onChange) {
        this._subs.add(onChange);
        onChange(this._records());
        return () => this._subs.delete(onChange);
    }
}
