/* ══════════════════════════════════════════════════════════════
   provider-gateway.js — بوابة موحّدة لجميع المزودين (Unified Gateway)
   واجهة واحدة لاستدعاء أي مزود، تحويل تلقائي عند الفشل
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.ProviderGateway = (function () {

  /* ── سجل المزودين: كل مزود دالة call(prompt, opts) => Promise<string> ── */
  const _providers = {};

  function registerProvider(name, callFn) {
    if (typeof callFn === 'function') _providers[name] = callFn;
  }

  /* ── استدعاء موحّد مع تحويل تلقائي عند فشل المزود الأساسي ──
     order: قائمة أولوية المزودين، افتراضياً حسب CostManager إن وُجد */
  async function call(prompt, opts = {}) {
    let order = opts.providers || Object.keys(_providers);
    if (typeof CostManager !== 'undefined') {
      order = CostManager.prioritize(order);
    }

    const errors = [];
    for (const name of order) {
      const fn = _providers[name];
      if (!fn) continue;
      try {
        const start = Date.now();
        const output = await fn(prompt, opts);
        const latencyMs = Date.now() - start;

        if (typeof CostManager !== 'undefined') CostManager.record(name, opts.estCost || 0);
        if (typeof CapabilityRegistry !== 'undefined' && opts.taskType) {
          CapabilityRegistry.recordOutcome(name, opts.taskType, true, undefined);
        }
        return { provider: name, output, latencyMs, ok: true };
      } catch (e) {
        errors.push({ provider: name, error: String(e) });
        if (typeof CapabilityRegistry !== 'undefined' && opts.taskType) {
          CapabilityRegistry.recordOutcome(name, opts.taskType, false, 0);
        }
        continue; /* جرّب المزود التالي */
      }
    }
    return { ok: false, errors };
  }

  function listProviders() { return Object.keys(_providers); }

  return { registerProvider, call, listProviders };
})();
