/* ══════════════════════════════════════════════
   recovery-manager.js — مدير الاستعادة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.RecoveryManager = (function () {

  const STORE_KEY    = 'galaoum_recovery_v1';
  const SNAP_KEY     = 'galaoum_snapshots_v1';
  const MAX_SNAPS    = 20;
  const AUTO_SNAP_MS = 1000 * 60 * 5; /* كل 5 دقائق */

  let _checkpoints = [];
  let _autoTimer   = null;
  let _currentTask = null; /* المهمة الجارية للاستكمال */

  /* ── تحميل ── */
  function _load() {
    try { _checkpoints = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); } catch { _checkpoints = []; }
  }

  function _save() {
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(_checkpoints.slice(-MAX_SNAPS))); } catch {}
  }

  /* ── أخذ Snapshot كامل للحالة ── */
  function snapshot(label) {
    const snap = {
      id:      _id(),
      label:   label || 'snapshot تلقائي',
      created: new Date().toISOString(),
      state:   _captureState()
    };
    _checkpoints.unshift(snap);
    _save();
    if (typeof Logger !== 'undefined') Logger.info('RECOVERY', `📸 Snapshot: "${label}" (${_checkpoints.length} محفوظ)`);
    return snap.id;
  }

  /* ── جمع حالة جميع الأنظمة ── */
  function _captureState() {
    const state = {};

    /* المحادثات */
    try { state.conversations = localStorage.getItem('galaoum_convs_v3'); } catch {}
    /* الذاكرة */
    try { state.memory = localStorage.getItem('galaoum_memory_v2'); } catch {}
    /* الذاكرة الموسعة */
    try {
      if (typeof Memory !== 'undefined') state.enhancedMemory = JSON.stringify(Memory.getProject());
    } catch {}
    /* Git */
    try { state.git = localStorage.getItem('galaoum_git_v1'); } catch {}
    /* API Hub */
    try { state.apiHub = localStorage.getItem('galaoum_apihub_v1'); } catch {}
    /* المهمة الجارية */
    state.currentTask = _currentTask;
    state.timestamp   = Date.now();

    return state;
  }

  /* ── استعادة Snapshot ── */
  function restore(id) {
    const snap = _checkpoints.find(s => s.id === id) || _checkpoints[0];
    if (!snap) throw new Error('لا يوجد snapshot للاستعادة');

    const { state } = snap;

    try {
      if (state.conversations) localStorage.setItem('galaoum_convs_v3', state.conversations);
      if (state.memory)        localStorage.setItem('galaoum_memory_v2', state.memory);
      if (state.git)           localStorage.setItem('galaoum_git_v1', state.git);
      if (state.apiHub)        localStorage.setItem('galaoum_apihub_v1', state.apiHub);

      if (state.enhancedMemory && typeof Memory !== 'undefined') {
        try { Memory.updateProject(JSON.parse(state.enhancedMemory)); } catch {}
      }

      if (typeof Logger !== 'undefined') Logger.info('RECOVERY', `♻️ استعادة: "${snap.label}" (${snap.created})`);
      if (typeof Toast  !== 'undefined') Toast.success(`♻️ تمت الاستعادة: "${snap.label}"`);

      return snap;
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.error('RECOVERY', `فشل الاستعادة: ${e.message}`);
      throw e;
    }
  }

  /* ── استعادة آخر نجاح ── */
  function restoreLast() {
    const last = _checkpoints[0];
    if (!last) throw new Error('لا توجد snapshots');
    return restore(last.id);
  }

  /* ── تسجيل المهمة الجارية ── */
  function setCurrentTask(task) {
    _currentTask = { ...task, savedAt: new Date().toISOString() };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(_currentTask)); } catch {}
  }

  function clearCurrentTask() {
    _currentTask = null;
    localStorage.removeItem(STORE_KEY);
  }

  /* ── استكمال مهمة متوقفة ── */
  function getInterruptedTask() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
  }

  /* ── قائمة الـ Snapshots ── */
  function listSnapshots() { return [..._checkpoints]; }

  function deleteSnapshot(id) {
    _checkpoints = _checkpoints.filter(s => s.id !== id);
    _save();
  }

  /* ── مراقبة الأخطاء العامة ── */
  function _setupErrorGuard() {
    window.addEventListener('error', e => {
      if (typeof Logger !== 'undefined') Logger.error('RECOVERY', `خطأ عام: ${e.message}`);
      /* Snapshot تلقائي عند خطأ فادح */
      snapshot(`auto (خطأ: ${e.message?.slice(0,40)})`);
    });

    window.addEventListener('unhandledrejection', e => {
      if (typeof Logger !== 'undefined') Logger.warn('RECOVERY', `Promise رُفض: ${e.reason}`);
    });
  }

  /* ── تلقائي ── */
  function startAutoSnapshot() {
    if (_autoTimer) return;
    _autoTimer = setInterval(() => snapshot('auto snapshot'), AUTO_SNAP_MS);
  }

  function stopAutoSnapshot() {
    clearInterval(_autoTimer);
    _autoTimer = null;
  }

  /* ── Panic Recovery ── */
  async function panic() {
    if (typeof Logger !== 'undefined') Logger.warn('RECOVERY', '🚨 Panic Recovery بدأ');
    try { restoreLast(); } catch {}
    /* محاولة إصلاح الأنظمة */
    const systems = [
      ['SmartCache',  () => SmartCache?.evict()],
      ['JobQueue',    () => { if (typeof JobQueue !== 'undefined') JobQueue.getJobs().filter(j=>j.status==='running').forEach(j=>JobQueue.cancel(j.id)); }],
      ['VirtualFS',   () => {}]
    ];
    for (const [name, fn] of systems) {
      try { fn(); if (typeof Logger !== 'undefined') Logger.info('RECOVERY', `✅ إصلاح ${name}`); }
      catch { if (typeof Logger !== 'undefined') Logger.warn('RECOVERY', `⚠️ فشل إصلاح ${name}`); }
    }
    if (typeof Toast !== 'undefined') Toast.success('♻️ Recovery مكتمل');
  }

  /* ── واجهة اللوحة ── */
  function openPanel() {
    const p = document.getElementById('recovery-panel');
    if (p) { p.style.display = 'flex'; _renderPanel(); }
  }

  function closePanel() {
    const p = document.getElementById('recovery-panel');
    if (p) p.style.display = 'none';
  }

  function _renderPanel() {
    const el = document.getElementById('recovery-list');
    if (!el) return;
    const snaps = listSnapshots();
    if (snaps.length === 0) {
      el.innerHTML = '<div style="color:#475569;padding:12px;text-align:center">لا توجد snapshots — انقر "أخذ Snapshot" للبدء</div>';
      return;
    }
    el.innerHTML = snaps.map(s => `
      <div class="recovery-item">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:700;color:#e2e8f0">📸 ${s.label}</span>
          <span style="font-size:9px;color:#475569">${_fmt(s.created)}</span>
        </div>
        <div style="display:flex;gap:5px;margin-top:6px">
          <button onclick="RecoveryManager.restore('${s.id}');RecoveryManager.openPanel()" class="recovery-btn">♻️ استعادة</button>
          <button onclick="RecoveryManager.deleteSnapshot('${s.id}');RecoveryManager.openPanel()" class="recovery-btn recovery-btn-del">🗑️</button>
        </div>
      </div>`).join('');
  }

  function _fmt(iso) { try { return new Date(iso).toLocaleString('ar'); } catch { return iso; } }
  function _id()     { return 'snap_' + Date.now(); }

  function init() {
    _load();
    _setupErrorGuard();
    startAutoSnapshot();
    /* استكمال مهمة متوقفة */
    const interrupted = getInterruptedTask();
    if (interrupted && typeof Logger !== 'undefined') {
      Logger.warn('RECOVERY', `⚠️ مهمة غير مكتملة: "${interrupted.title}" — منذ ${_fmt(interrupted.savedAt)}`);
    }
    if (typeof Logger !== 'undefined') Logger.info('RECOVERY', `♻️ Recovery Manager جاهز — ${_checkpoints.length} snapshots`);
  }

  return { init, snapshot, restore, restoreLast, setCurrentTask, clearCurrentTask, getInterruptedTask, listSnapshots, deleteSnapshot, startAutoSnapshot, stopAutoSnapshot, panic, openPanel, closePanel };

})();
