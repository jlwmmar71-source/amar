/* ══════════════════════════════════════════════════════════════
   cost-manager.js — مدير التكلفة الذكي (Smart Cost Manager)
   حساب استهلاك كل مزود، توزيع حسب التكلفة، منع استنزاف الرصيد
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.CostManager = (function () {

  const STORE_KEY = 'galaoum_cost_v1';
  const FREE_PROVIDERS = ['pollinations', 'gemini', 'huggingface']; /* مزودون مجانيون معروفون */

  let _usage = {}; /* { provider: { calls, estCost, lastUsed } } */
  let _budget = null; /* حد أقصى اختياري بالعملة/الوحدة */

  function _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      _usage  = raw.usage  || {};
      _budget = raw.budget != null ? raw.budget : null;
    } catch { _usage = {}; _budget = null; }
  }
  function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ usage: _usage, budget: _budget })); } catch {}
  }

  /* ── تسجيل استخدام مزود ── */
  function record(provider, estCost) {
    if (!_usage[provider]) _usage[provider] = { calls: 0, estCost: 0, lastUsed: null };
    _usage[provider].calls    += 1;
    _usage[provider].estCost  += (estCost || 0);
    _usage[provider].lastUsed = new Date().toISOString();
    _save();
  }

  function setBudget(amount) { _budget = amount; _save(); }

  function totalCost() {
    return Object.values(_usage).reduce((sum, u) => sum + u.estCost, 0);
  }

  /* ── هل تجاوزنا الحد المسموح؟ ── */
  function isOverBudget() {
    return _budget != null && totalCost() >= _budget;
  }

  /* ── ترتيب المزودين حسب الأولوية: المجاني أولاً، ثم الأقل تكلفة ──
     candidates: [providerId] */
  function prioritize(candidates) {
    return [...candidates].sort((a, b) => {
      const aFree = FREE_PROVIDERS.includes(a) ? 0 : 1;
      const bFree = FREE_PROVIDERS.includes(b) ? 0 : 1;
      if (aFree !== bFree) return aFree - bFree;
      const aCost = (_usage[a] && _usage[a].estCost) || 0;
      const bCost = (_usage[b] && _usage[b].estCost) || 0;
      return aCost - bCost;
    });
  }

  function getUsage() { return _usage; }

  _load();
  return { record, setBudget, totalCost, isOverBudget, prioritize, getUsage };
})();
