/* ══════════════════════════════════════════════════════════════
   ai-learning-engine.js — محرك التعلّم الذكي (AI Learning Engine)
   التعلم من التعديلات السابقة، تحسين اختيار النماذج والتوزيع
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.AILearningEngine = (function () {

  const STORE_KEY = 'galaoum_learning_v1';
  let _log = []; /* [{ taskType, modelId, success, quality, ts }] */
  const MAX_LOG = 500;

  function _load() {
    try { _log = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { _log = []; }
  }
  function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(_log.slice(-MAX_LOG))); } catch {}
  }

  /* ── تسجيل نتيجة قرار سابق (اختيار نموذج/خطة) ── */
  function recordDecision(taskType, modelId, success, quality) {
    _log.push({ taskType, modelId, success, quality: quality || (success ? 70 : 20), ts: Date.now() });
    _save();

    /* تحديث سجل القدرات إن وُجد */
    if (typeof CapabilityRegistry !== 'undefined') {
      CapabilityRegistry.recordOutcome(modelId, taskType, success, quality);
    }
  }

  /* ── التوصية بأفضل نموذج بناءً على التاريخ الفعلي ── */
  function recommend(taskType) {
    const relevant = _log.filter(l => l.taskType === taskType);
    if (!relevant.length) return null;

    const byModel = {};
    for (const r of relevant) {
      if (!byModel[r.modelId]) byModel[r.modelId] = { total: 0, sum: 0 };
      byModel[r.modelId].total += 1;
      byModel[r.modelId].sum   += r.quality;
    }

    let best = null;
    for (const [modelId, stats] of Object.entries(byModel)) {
      const avg = stats.sum / stats.total;
      if (!best || avg > best.avg) best = { modelId, avg, samples: stats.total };
    }
    return best;
  }

  /* ── إحصائيات عامة عن معدل النجاح مع الوقت (هل يتحسن الأداء؟) ── */
  function trend(taskType) {
    const relevant = _log.filter(l => l.taskType === taskType).slice(-20);
    if (relevant.length < 4) return 'insufficient_data';
    const half = Math.floor(relevant.length / 2);
    const firstAvg = relevant.slice(0, half).reduce((s, r) => s + r.quality, 0) / half;
    const secondAvg = relevant.slice(half).reduce((s, r) => s + r.quality, 0) / (relevant.length - half);
    if (secondAvg > firstAvg + 5) return 'improving';
    if (secondAvg < firstAvg - 5) return 'declining';
    return 'stable';
  }

  _load();
  return { recordDecision, recommend, trend };
})();
