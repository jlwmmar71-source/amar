/* ══════════════════════════════════════════════════════════════
   prompt-optimizer.js — محرك تحسين الـ Prompts (Prompt Optimization)
   تحسين الـ Prompt تلقائياً، اختيار الأفضل، التعلم من النتائج
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.PromptOptimizer = (function () {

  const STORE_KEY = 'galaoum_prompt_opt_v1';
  let _history = {}; /* { taskType: [{ template, avgScore, uses }] } */

  function _load() {
    try { _history = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { _history = {}; }
  }
  function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(_history)); } catch {}
  }

  /* ── توليد صيغ بديلة بسيطة من prompt أساسي ── */
  function generateVariants(basePrompt) {
    return [
      basePrompt,
      `${basePrompt}\n\nكن دقيقاً وواضحاً في إجابتك.`,
      `${basePrompt}\n\nأجب خطوة بخطوة قبل إعطاء الإجابة النهائية.`,
      `مهم جداً: ${basePrompt}`
    ];
  }

  /* ── تسجيل نتيجة استخدام صيغة معينة ── */
  function recordResult(taskType, template, qualityScore) {
    if (!_history[taskType]) _history[taskType] = [];
    let entry = _history[taskType].find(e => e.template === template);
    if (!entry) {
      entry = { template, avgScore: qualityScore, uses: 1 };
      _history[taskType].push(entry);
    } else {
      entry.avgScore = Math.round((entry.avgScore * entry.uses + qualityScore) / (entry.uses + 1));
      entry.uses += 1;
    }
    _save();
  }

  /* ── اختيار أفضل صيغة معروفة لمهمة معينة، أو توليد جديدة ── */
  function bestPrompt(taskType, basePrompt) {
    const entries = _history[taskType];
    if (entries && entries.length) {
      const best = [...entries].sort((a, b) => b.avgScore - a.avgScore)[0];
      if (best.avgScore >= 60) return best.template;
    }
    return basePrompt;
  }

  function getHistory(taskType) { return _history[taskType] || []; }

  _load();
  return { generateVariants, recordResult, bestPrompt, getHistory };
})();
