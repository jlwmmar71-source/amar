/* ══════════════════════════════════════════════════════════════
   capability-registry.js — سجل قدرات النماذج (Capability Registry)
   حفظ قدرات كل نموذج، معرفة الأفضل لكل مهمة، تحديث تلقائي
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.CapabilityRegistry = (function () {

  const STORE_KEY = 'galaoum_capabilities_v1';
  let _registry = {}; /* { modelId: { tasks: {taskType: {score, samples}}, meta } } */

  function _load() {
    try { _registry = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { _registry = {}; }
  }
  function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(_registry)); } catch {}
  }

  /* ── تسجيل/تحديث نموذج جديد ── */
  function register(modelId, meta) {
    if (!_registry[modelId]) _registry[modelId] = { tasks: {}, meta: {} };
    if (meta) _registry[modelId].meta = { ..._registry[modelId].meta, ...meta };
    _save();
  }

  /* ── تحديث القدرة تلقائياً بعد كل استخدام حقيقي ──
     success: هل نجحت المهمة، quality: 0-100 */
  function recordOutcome(modelId, taskType, success, quality) {
    register(modelId);
    const tasks = _registry[modelId].tasks;
    if (!tasks[taskType]) tasks[taskType] = { score: 50, samples: 0 };
    const t = tasks[taskType];
    const q = typeof quality === 'number' ? quality : (success ? 70 : 20);
    /* متوسط متحرك مرجّح */
    t.score   = Math.round((t.score * t.samples + q) / (t.samples + 1));
    t.samples += 1;
    _save();
  }

  /* ── أفضل نموذج لمهمة معيّنة ── */
  function bestFor(taskType) {
    let best = null;
    for (const [modelId, data] of Object.entries(_registry)) {
      const t = data.tasks[taskType];
      if (t && (!best || t.score > best.score)) {
        best = { modelId, score: t.score, samples: t.samples };
      }
    }
    return best;
  }

  function getAll() { return _registry; }
  function getModel(modelId) { return _registry[modelId] || null; }

  _load();
  return { register, recordOutcome, bestFor, getAll, getModel };
})();
