/* ══════════════════════════════════════════════════════════════
   consensus-engine.js — محرك الإجماع (Consensus Engine)
   مقارنة نتائج عدة نماذج، تقييم الجودة، دمج أفضل النتائج
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.ConsensusEngine = (function () {

  /* ── تقييم نتيجة واحدة ── */
  function _score(result) {
    const out = (result.output || '').trim();
    if (!out) return 0;
    let s = 0;
    s += Math.min(out.length / 500, 1) * 30;                 /* اكتمال الرد */
    if (!/^(error|خطأ|failed|فشل)/i.test(out)) s += 30;       /* لا يبدأ بخطأ */
    if (result.errorFree !== false) s += 20;                 /* بدون استثناء */
    if (typeof result.latencyMs === 'number') {
      s += Math.max(0, 20 - result.latencyMs / 1000);         /* أسرع = أفضل */
    } else {
      s += 10;
    }
    return Math.round(s);
  }

  /* ── ثقة الإجماع بين أفضل نتيجتين ── */
  function _confidence(ranked) {
    if (ranked.length < 2) return ranked.length ? 100 : 0;
    const gap = ranked[0].score - ranked[1].score;
    return Math.max(0, Math.min(100, 50 + gap));
  }

  /* ── مقارنة نتائج عدة نماذج واستبعاد الضعيف ──
     results: [{ model, output, latencyMs, errorFree }] */
  function evaluate(results, opts) {
    const minScore = (opts && opts.minScore) || 0;
    if (!Array.isArray(results) || !results.length) return null;

    const scored = results
      .map(r => ({ ...r, score: _score(r) }))
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;

    return {
      best:       scored[0],
      ranked:     scored,
      excluded:   results.length - scored.length,
      confidence: _confidence(scored)
    };
  }

  /* ── دمج أفضل النتائج (يرجع نص أفضل رد فقط) ── */
  function merge(results) {
    const ev = evaluate(results);
    return ev ? ev.best.output : '';
  }

  return { evaluate, merge };
})();
