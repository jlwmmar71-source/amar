/* ══════════════════════════════════════════════
   monitoring-dashboard.js — لوحة المراقبة المباشرة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.MonitoringDashboard = (function () {

  let _open = false;
  let _timer = null;
  const REFRESH_MS = 2000;

  /* ── فتح اللوحة ── */
  function open() {
    const p = document.getElementById('monitor-panel');
    if (!p) return;
    p.style.display = 'flex';
    _open = true;
    _startRefresh();
    _render();
  }

  function close() {
    const p = document.getElementById('monitor-panel');
    if (p) p.style.display = 'none';
    _open = false;
    _stopRefresh();
  }

  function toggle() { _open ? close() : open(); }

  /* ── تحديث تلقائي ── */
  function _startRefresh() {
    _stopRefresh();
    _timer = setInterval(_render, REFRESH_MS);
  }

  function _stopRefresh() {
    clearInterval(_timer);
    _timer = null;
  }

  /* ── رسم اللوحة ── */
  function _render() {
    _renderAgents();
    _renderTools();
    _renderJobs();
    _renderResources();
    _renderLogs();
  }

  function _renderAgents() {
    const el = document.getElementById('mon-agents');
    if (!el) return;
    const agents = [
      { name: 'Workflow Engine', active: typeof WorkflowEngine !== 'undefined', icon: '⚙️' },
      { name: 'AI Agent',        active: typeof Agent          !== 'undefined', icon: '🤖' },
      { name: 'Decision Engine', active: typeof DecisionEngine !== 'undefined', icon: '🧠' },
      { name: 'Executive',       active: typeof Executive      !== 'undefined', icon: '📋' },
      { name: 'Deployment',      active: typeof DeploymentEngine !== 'undefined', icon: '🚀' },
      { name: 'Terminal',        active: typeof TerminalEngine !== 'undefined', icon: '💻' },
      { name: 'Git Manager',     active: typeof GitManager     !== 'undefined', icon: '🔀' },
      { name: 'Database',        active: typeof DatabaseManager!== 'undefined', icon: '🗄️' },
      { name: 'Job Queue',       active: typeof JobQueue       !== 'undefined', icon: '⚡' },
      { name: 'API Hub',         active: typeof ApiHub         !== 'undefined', icon: '📡' },
      { name: 'Smart Cache',     active: typeof SmartCache     !== 'undefined', icon: '⚡' },
      { name: 'VirtualFS',       active: typeof VirtualFS      !== 'undefined', icon: '📂' },
      { name: 'Browser Auto',    active: typeof BrowserAutomation !== 'undefined', icon: '🌐' },
      { name: 'Artifact Mgr',   active: typeof ArtifactManager !== 'undefined', icon: '📦' },
      { name: 'Recovery',        active: typeof RecoveryManager!== 'undefined', icon: '♻️' },
      { name: 'Resource Mgr',   active: typeof ResourceManager !== 'undefined', icon: '📊' }
    ];
    el.innerHTML = agents.map(a => `
      <div class="mon-agent-item">
        <span class="mon-dot ${a.active ? 'mon-dot-green' : 'mon-dot-red'}"></span>
        <span>${a.icon} ${a.name}</span>
      </div>`).join('');
  }

  function _renderTools() {
    const el = document.getElementById('mon-tools');
    if (!el) return;
    const tools = [
      { name: 'Plugins',  cnt: typeof PluginSystem !== 'undefined' ? Object.keys(PluginSystem._plugins || {}).length : 0, icon: '🧩' },
      { name: 'APIs',     cnt: typeof ApiHub !== 'undefined' ? ApiHub.list().length : 0, icon: '📡' },
      { name: 'Jobs',     cnt: typeof JobQueue !== 'undefined' ? JobQueue.getJobs().length : 0, icon: '⚙️' },
      { name: 'Cache',    cnt: typeof SmartCache !== 'undefined' ? SmartCache.stats().size : 0, icon: '⚡' }
    ];
    el.innerHTML = tools.map(t => `
      <div class="mon-tool-card">
        <div style="font-size:18px">${t.icon}</div>
        <div style="font-size:10px;color:#94a3b8">${t.name}</div>
        <div style="font-size:16px;font-weight:800;color:#e2e8f0">${t.cnt}</div>
      </div>`).join('');
  }

  function _renderJobs() {
    const el = document.getElementById('mon-jobs');
    if (!el) return;
    if (typeof JobQueue === 'undefined') { el.innerHTML = '<div style="color:#475569;font-size:11px">JobQueue غير متاح</div>'; return; }
    const jobs = JobQueue.getJobs().slice(0, 6);
    if (jobs.length === 0) { el.innerHTML = '<div style="color:#475569;font-size:11px">لا توجد مهام</div>'; return; }
    const icons = { pending:'⏳', running:'🔄', done:'✅', failed:'❌', cancelled:'⏸' };
    el.innerHTML = jobs.map(j => `
      <div class="mon-job-row">
        <span>${icons[j.status]||'?'} ${j.title}</span>
        <span class="mon-badge mon-badge-${j.status}">${j.progress}%</span>
      </div>`).join('');
  }

  function _renderResources() {
    if (typeof ResourceManager === 'undefined') return;
    const m = ResourceManager.metrics();
    _setTxt('mon-ram',     m.ram    + ' MB');
    _setTxt('mon-cpu',     m.cpu    + ' ms');
    _setTxt('mon-storage', m.storage+ ' MB');
    _setTxt('mon-uptime',  _fmt(m.uptime));
    _setTxt('mon-ops',     m.ops    + '');

    const cacheStats = typeof SmartCache !== 'undefined' ? SmartCache.stats() : null;
    if (cacheStats) {
      _setTxt('mon-cache-hit', cacheStats.hitRate);
      _setTxt('mon-cache-size', cacheStats.size + ' مدخلة');
    }
  }

  function _renderLogs() {
    const el = document.getElementById('mon-logs');
    if (!el || typeof Logger === 'undefined') return;
    const logs = Logger._logs ? Logger._logs.slice(-8).reverse() : [];
    if (logs.length === 0) { el.innerHTML = '<div style="color:#475569;font-size:10px">لا توجد سجلات</div>'; return; }
    const lvlClr = { 0:'#64748b', 1:'#94a3b8', 2:'#f97316', 3:'#ef4444' };
    el.innerHTML = logs.map(l => `
      <div class="mon-log-row" style="color:${lvlClr[l.level]||'#94a3b8'}">
        <span style="font-family:monospace;font-size:9px">${l.time||''}</span>
        <span style="font-size:9px">[${l.tag||''}]</span>
        <span style="font-size:10px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.message||''}</span>
      </div>`).join('');
  }

  function _setTxt(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

  function _fmt(s) {
    if (!s) return '0ث';
    if (s < 60) return s + 'ث';
    if (s < 3600) return Math.floor(s/60) + 'د';
    return Math.floor(s/3600) + 'س';
  }

  function init() {
    if (typeof Logger !== 'undefined') Logger.info('MONITOR', '📊 Monitoring Dashboard جاهز');
  }

  return { init, open, close, toggle };

})();
