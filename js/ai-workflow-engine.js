/* ══════════════════════════════════════════════════════════════
   ai-workflow-engine.js — محرك سير العمل الذكي (AI Workflow Engine)
   تنفيذ مهام متسلسلة/متوازية مع إعادة المحاولة عند الفشل
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.AIWorkflowEngine = (function () {

  /* ── تنفيذ خطوات متسلسلة ──
     steps: [{ name, run: async (ctx) => any, retries }] */
  async function runSequential(steps, ctx = {}) {
    const results = [];
    for (const step of steps) {
      const res = await _runWithRetry(step, ctx);
      results.push(res);
      if (res.output !== undefined) ctx[step.name] = res.output;
      if (!res.ok && step.stopOnFail !== false) break;
    }
    return { ctx, results };
  }

  /* ── تنفيذ خطوات متوازية ── */
  async function runParallel(steps, ctx = {}) {
    const results = await Promise.all(steps.map(step => _runWithRetry(step, ctx)));
    steps.forEach((step, i) => {
      if (results[i].output !== undefined) ctx[step.name] = results[i].output;
    });
    return { ctx, results };
  }

  /* ── تنفيذ خطوة واحدة مع إعادة المحاولة ── */
  async function _runWithRetry(step, ctx) {
    const maxRetries = step.retries != null ? step.retries : 2;
    let attempt = 0, lastErr = null;
    while (attempt <= maxRetries) {
      try {
        const output = await step.run(ctx);
        return { name: step.name, ok: true, output, attempts: attempt + 1 };
      } catch (e) {
        lastErr = e;
        attempt += 1;
      }
    }
    return { name: step.name, ok: false, error: String(lastErr), attempts: attempt };
  }

  /* ── تشغيل سير عمل مُعرَّف بمخطط { sequence: [...], parallel: [...] } ── */
  async function run(workflow, ctx = {}) {
    let state = { ctx, results: [] };
    if (Array.isArray(workflow.sequence) && workflow.sequence.length) {
      const r = await runSequential(workflow.sequence, state.ctx);
      state.ctx = r.ctx; state.results.push(...r.results);
    }
    if (Array.isArray(workflow.parallel) && workflow.parallel.length) {
      const r = await runParallel(workflow.parallel, state.ctx);
      state.ctx = r.ctx; state.results.push(...r.results);
    }
    return state;
  }

  return { runSequential, runParallel, run };
})();
