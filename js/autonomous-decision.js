/* ══════════════════════════════════════════════════════════════
   autonomous-decision.js — محرك القرار المستقل (Autonomous Decision)
   اتخاذ القرار تلقائياً، ترتيب الأولويات، إعادة التخطيط عند الفشل
   Galaoum AI Engine v5.0 — إضافة جديدة (يكمل decision.js الأساسي)
   ══════════════════════════════════════════════════════════════ */

window.AutonomousDecision = (function () {

  /* ── options: [{ id, score, cost, risk }] — اختيار الأفضل حسب معادلة موزونة ── */
  function choosePlan(options, weights = { score: 0.6, cost: -0.2, risk: -0.2 }) {
    if (!Array.isArray(options) || !options.length) return null;
    const ranked = options
      .map(o => ({
        ...o,
        weighted: (o.score || 0) * weights.score + (o.cost || 0) * weights.cost + (o.risk || 0) * weights.risk
      }))
      .sort((a, b) => b.weighted - a.weighted);
    return { chosen: ranked[0], ranked };
  }

  /* ── ترتيب مهام حسب الأولوية (أهمية × إلحاح) ── */
  function prioritize(tasks) {
    return [...tasks].sort((a, b) => {
      const aScore = (a.importance || 1) * (a.urgency || 1);
      const bScore = (b.importance || 1) * (b.urgency || 1);
      return bScore - aScore;
    });
  }

  /* ── تنفيذ خطة مع إعادة التخطيط التلقائي عند الفشل ──
     execFn(plan) => Promise, planOptions: بدائل الخطط ── */
  async function executeWithReplan(planOptions, execFn, maxAttempts = 3) {
    let { ranked } = choosePlan(planOptions) || { ranked: [] };
    let attempt = 0;
    for (const plan of ranked) {
      if (attempt >= maxAttempts) break;
      attempt += 1;
      try {
        const result = await execFn(plan);
        return { ok: true, plan, result, attempts: attempt };
      } catch (e) {
        continue; /* جرّب الخطة التالية في الترتيب */
      }
    }
    return { ok: false, attempts: attempt, error: 'فشلت كل الخطط المتاحة' };
  }

  return { choosePlan, prioritize, executeWithReplan };
})();
