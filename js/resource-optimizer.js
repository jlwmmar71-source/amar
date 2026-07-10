/* ══════════════════════════════════════════════════════════════
   resource-optimizer.js — محسّن الموارد (Resource Optimizer)
   إدارة الذاكرة والمعالج، تنظيف الموارد، مراقبة الأداء لحظياً
   Galaoum AI Engine v5.0 — إضافة جديدة (يكمل resource-manager.js)
   ══════════════════════════════════════════════════════════════ */

window.ResourceOptimizer = (function () {

  let _monitorTimer = null;
  const _cleanupTasks = [];
  const _samples = [];
  const MAX_SAMPLES = 50;

  /* ── تسجيل مهمة تنظيف (مثلاً مسح كاش، إغلاق اتصال) ── */
  function registerCleanup(fn) {
    if (typeof fn === 'function') _cleanupTasks.push(fn);
  }

  /* ── تنفيذ كل مهام التنظيف المسجّلة ── */
  function runCleanup() {
    let ran = 0;
    for (const fn of _cleanupTasks) {
      try { fn(); ran++; } catch {}
    }
    return ran;
  }

  /* ── أخذ عيّنة أداء لحظية ── */
  function sample() {
    const s = { ts: Date.now() };
    if (performance && performance.memory) {
      s.usedMB  = Math.round(performance.memory.usedJSHeapSize / 1048576);
      s.limitMB = Math.round(performance.memory.jsHeapSizeLimit / 1048576);
      s.usagePct = Math.round((s.usedMB / s.limitMB) * 100);
    }
    _samples.push(s);
    if (_samples.length > MAX_SAMPLES) _samples.shift();

    /* تنظيف تلقائي إن تجاوز الاستخدام 85% */
    if (s.usagePct != null && s.usagePct > 85) runCleanup();
    return s;
  }

  /* ── بدء مراقبة دورية ── */
  function startMonitoring(intervalMs = 30000) {
    stopMonitoring();
    _monitorTimer = setInterval(sample, intervalMs);
    sample();
  }

  function stopMonitoring() {
    if (_monitorTimer) clearInterval(_monitorTimer);
    _monitorTimer = null;
  }

  function getSamples() { return _samples; }
  function latest() { return _samples[_samples.length - 1] || null; }

  return { registerCleanup, runCleanup, sample, startMonitoring, stopMonitoring, getSamples, latest };
})();
