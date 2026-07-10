/* ══════════════════════════════════════════════════════════════
   model-benchmark.js — اختبار الأداء الديناميكي للنماذج
   اختبار السرعة، الجودة، الاستقرار، وترتيب النماذج تلقائياً
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.ModelBenchmark = (function () {

  const STORE_KEY = 'galaoum_benchmark_v1';
  let _results = {}; /* { modelId: { speedMs, qualityAvg, stability, runs } } */

  function _load() {
    try { _results = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch { _results = {}; }
  }
  function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(_results)); } catch {}
  }

  /* ── تشغيل اختبار حقيقي على نموذج واحد ──
     callFn(prompt) يجب أن ترجع Promise<string> */
  async function runOne(modelId, callFn, prompt) {
    const p = prompt || 'اكتب جملة قصيرة للاختبار.';
    const start = Date.now();
    let output = '', ok = true;
    try {
      output = await callFn(p);
    } catch (e) {
      ok = false;
    }
    const speedMs = Date.now() - start;
    const quality = ok && output && output.trim().length > 5 ? Math.min(100, output.trim().length) : 0;

    if (!_results[modelId]) _results[modelId] = { speedMs: 0, qualityAvg: 0, stability: 100, runs: 0 };
    const r = _results[modelId];
    r.speedMs    = Math.round((r.speedMs * r.runs + speedMs) / (r.runs + 1));
    r.qualityAvg = Math.round((r.qualityAvg * r.runs + quality) / (r.runs + 1));
    r.stability  = Math.round((r.stability * r.runs + (ok ? 100 : 0)) / (r.runs + 1));
    r.runs += 1;
    _save();

    if (typeof CapabilityRegistry !== 'undefined') {
      CapabilityRegistry.recordOutcome(modelId, 'benchmark', ok, quality);
    }
    return { modelId, ok, speedMs, quality };
  }

  /* ── تشغيل الاختبار على مجموعة نماذج { modelId: callFn } ── */
  async function runAll(models, prompt) {
    const out = [];
    for (const [modelId, callFn] of Object.entries(models)) {
      out.push(await runOne(modelId, callFn, prompt));
    }
    return ranking();
  }

  /* ── الترتيب التلقائي حسب السرعة + الجودة + الاستقرار ── */
  function ranking() {
    return Object.entries(_results)
      .map(([modelId, r]) => ({
        modelId,
        ...r,
        composite: Math.round(r.qualityAvg * 0.5 + r.stability * 0.3 + Math.max(0, 100 - r.speedMs / 100) * 0.2)
      }))
      .sort((a, b) => b.composite - a.composite);
  }

  function getResults() { return _results; }

  _load();
  return { runOne, runAll, ranking, getResults };
})();
