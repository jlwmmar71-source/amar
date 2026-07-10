/* ══════════════════════════════════════════════
   resource-manager.js — مدير الموارد
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.ResourceManager = (function () {

  const MAX_RAM_MB  = 200;
  const MAX_OPS     = 50;
  const SAMPLE_MS   = 2000;

  let _metrics = { ram: 0, cpu: 0, storage: 0, ops: 0, startTime: Date.now() };
  let _history  = [];
  let _alerts   = [];
  let _timer    = null;

  /* ── قياس RAM (Heap) ── */
  function getRamMB() {
    if (performance?.memory) {
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
    /* تقدير من localStorage */
    let total = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        total += (localStorage.getItem(k) || '').length;
      }
    } catch {}
    return Math.round(total / 1024 / 10); /* تقريب خشن */
  }

  /* ── قياس التخزين ── */
  async function getStorageMB() {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { used: Math.round((est.usage || 0) / 1024 / 1024), quota: Math.round((est.quota || 0) / 1024 / 1024) };
    }
    let size = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        size += (localStorage.getItem(localStorage.key(i)) || '').length;
      }
    } catch {}
    return { used: Math.round(size / 1024), quota: 5120 };
  }

  /* ── قياس CPU (عبر PerformanceObserver) ── */
  let _cpuLoad = 0;
  function _measureCpu() {
    const start = performance.now();
    /* حساب بسيط لوزن الـ event loop */
    setTimeout(() => {
      const lag = performance.now() - start - 0; /* 0ms مطلوب */
      _cpuLoad = Math.min(100, Math.round(lag));
    }, 0);
    return _cpuLoad;
  }

  /* ── أخذ عينة ── */
  async function sample() {
    const ram = getRamMB();
    const cpu = _measureCpu();
    const storage = await getStorageMB();
    const ops = typeof JobQueue !== 'undefined' ? JobQueue.getRunning() : 0;
    const uptime = Math.round((Date.now() - _metrics.startTime) / 1000);

    _metrics = { ram, cpu, storage: storage.used, storageQuota: storage.quota, ops, uptime };
    _history.push({ ...metrics(), ts: Date.now() });
    if (_history.length > 60) _history.shift();

    _checkLimits(ram, ops);
    _updateDashboard();
    return _metrics;
  }

  function _checkLimits(ram, ops) {
    if (ram > MAX_RAM_MB) {
      const msg = `⚠️ RAM عالٍ: ${ram} MB`;
      _alerts.push({ msg, ts: new Date().toISOString() });
      if (typeof Logger !== 'undefined') Logger.warn('RESOURCE', msg);
      if (typeof SmartCache !== 'undefined') SmartCache.evict();
    }
    if (ops > MAX_OPS) {
      const msg = `⚠️ عمليات كثيرة: ${ops}`;
      _alerts.push({ msg, ts: new Date().toISOString() });
      if (typeof Logger !== 'undefined') Logger.warn('RESOURCE', msg);
    }
  }

  function metrics() { return { ..._metrics }; }
  function history() { return [..._history]; }
  function alerts()  { return [..._alerts.slice(-20)]; }

  /* ── بدء المراقبة ── */
  function startMonitoring() {
    if (_timer) return;
    _timer = setInterval(sample, SAMPLE_MS);
    sample();
    if (typeof Logger !== 'undefined') Logger.info('RESOURCE', '📊 مراقبة الموارد بدأت');
  }

  function stopMonitoring() {
    clearInterval(_timer);
    _timer = null;
  }

  /* ── تحرير الذاكرة ── */
  function freeMemory() {
    if (typeof SmartCache !== 'undefined') SmartCache.evict();
    if (typeof ArtifactManager !== 'undefined') ArtifactManager.cleanup();
    _alerts = [];
    if (typeof Logger !== 'undefined') Logger.info('RESOURCE', '🧹 تحرير الذاكرة');
    if (typeof Toast !== 'undefined') Toast.success('تم تحرير الذاكرة');
  }

  /* ── تحديث واجهة المراقبة ── */
  function _updateDashboard() {
    const el = id => document.getElementById(id);
    _setText('rm-ram',     `${_metrics.ram} MB`);
    _setText('rm-cpu',     `${_metrics.cpu} ms تأخير`);
    _setText('rm-storage', `${_metrics.storage} MB`);
    _setText('rm-ops',     `${_metrics.ops}`);
    _setText('rm-uptime',  _fmtUptime(_metrics.uptime));

    const ramPct = Math.min(100, Math.round(_metrics.ram / MAX_RAM_MB * 100));
    const ramBar = el('rm-ram-bar');
    if (ramBar) { ramBar.style.width = ramPct + '%'; ramBar.style.background = ramPct > 80 ? '#ef4444' : ramPct > 60 ? '#f97316' : '#22c55e'; }
  }

  function _setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

  function _fmtUptime(s) {
    if (s < 60) return `${s}ث`;
    if (s < 3600) return `${Math.floor(s/60)}د ${s%60}ث`;
    return `${Math.floor(s/3600)}س ${Math.floor((s%3600)/60)}د`;
  }

  function openPanel() {
    const p = document.getElementById('resource-panel');
    if (p) { p.style.display = 'flex'; sample(); }
  }

  function closePanel() {
    const p = document.getElementById('resource-panel');
    if (p) p.style.display = 'none';
  }

  function init() {
    startMonitoring();
    if (typeof Logger !== 'undefined') Logger.info('RESOURCE', '⚡ Resource Manager جاهز');
  }

  return { init, sample, metrics, history, alerts, startMonitoring, stopMonitoring, freeMemory, openPanel, closePanel };

})();
