/* ══════════════════════════════════════════════
   job-queue.js — نظام إدارة المهام
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.JobQueue = (function () {

  const STORE_KEY = 'galaoum_jobs_v1';
  let _jobs = [];
  let _running = new Map(); /* id → {cancel} */
  let _listeners = [];

  function _save() {
    try {
      const toSave = _jobs.slice(-100).map(j => ({ ...j, _fn: undefined }));
      localStorage.setItem(STORE_KEY, JSON.stringify(toSave));
    } catch {}
  }

  function _load() {
    try { _jobs = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { _jobs = []; }
  }

  function _notify() { _listeners.forEach(fn => fn(_jobs)); }

  /* ── إضافة مهمة ── */
  function add(opts) {
    const job = {
      id:       _id(),
      title:    opts.title || 'مهمة',
      priority: opts.priority || 5,
      status:   'pending',
      progress: 0,
      logs:     [],
      created:  new Date().toISOString(),
      started:  null,
      finished: null,
      result:   null,
      error:    null,
      _fn:      opts.fn || null
    };
    _jobs.unshift(job);
    _save();
    _notify();
    if (typeof Logger !== 'undefined') Logger.info('JOB', `➕ مهمة جديدة: ${job.title} [${job.id}]`);
    if (opts.autoRun !== false) _runJob(job.id);
    return job.id;
  }

  /* ── تشغيل مهمة ── */
  async function _runJob(id) {
    const job = _jobs.find(j => j.id === id);
    if (!job || !job._fn) { _updateJob(id, { status: 'done', progress: 100 }); return; }

    _updateJob(id, { status: 'running', started: new Date().toISOString(), progress: 0 });

    let cancelled = false;
    _running.set(id, { cancel: () => { cancelled = true; } });

    try {
      const result = await job._fn({
        progress: (p, msg) => {
          if (cancelled) throw new Error('تم الإلغاء');
          _updateJob(id, { progress: p });
          if (msg) _appendLog(id, msg);
        },
        log: (msg) => _appendLog(id, msg),
        isCancelled: () => cancelled
      });
      if (!cancelled) _updateJob(id, { status: 'done', progress: 100, result, finished: new Date().toISOString() });
    } catch (e) {
      const isCancelled = e.message === 'تم الإلغاء';
      _updateJob(id, { status: isCancelled ? 'cancelled' : 'failed', error: e.message, finished: new Date().toISOString() });
    } finally {
      _running.delete(id);
    }
    _notify();
  }

  /* ── إيقاف مهمة ── */
  function cancel(id) {
    const ctrl = _running.get(id);
    if (ctrl) { ctrl.cancel(); if (typeof Logger !== 'undefined') Logger.warn('JOB', `⏹ إيقاف: ${id}`); }
  }

  /* ── إعادة تشغيل ── */
  function retry(id) {
    const job = _jobs.find(j => j.id === id);
    if (!job) return;
    _updateJob(id, { status: 'pending', progress: 0, logs: [], error: null, result: null });
    _runJob(id);
  }

  /* ── حذف مهمة ── */
  function remove(id) {
    cancel(id);
    _jobs = _jobs.filter(j => j.id !== id);
    _save();
    _notify();
  }

  /* ── تنفيذ متوازٍ ── */
  async function runParallel(tasks) {
    const ids = tasks.map(t => add({ ...t, autoRun: false }));
    await Promise.all(ids.map(id => _runJob(id)));
    return ids;
  }

  /* ── مساعدات ── */
  function _updateJob(id, changes) {
    const idx = _jobs.findIndex(j => j.id === id);
    if (idx === -1) return;
    _jobs[idx] = { ..._jobs[idx], ...changes };
    _save();
    _renderPanel();
  }

  function _appendLog(id, msg) {
    const idx = _jobs.findIndex(j => j.id === id);
    if (idx === -1) return;
    _jobs[idx].logs = [...(_jobs[idx].logs || []).slice(-49), `[${_time()}] ${msg}`];
    _save();
  }

  function log(msg) {
    if (typeof Logger !== 'undefined') Logger.info('JOB', msg);
  }

  function getJobs() { return [..._jobs]; }

  function getRunning() {
    return _jobs.filter(j => j.status === 'running').length;
  }

  function onUpdate(fn) { _listeners.push(fn); }

  function _id() { return 'j' + Date.now() + Math.random().toString(36).slice(2,5); }
  function _time() { return new Date().toTimeString().slice(0,8); }

  /* ── واجهة اللوحة ── */
  function openPanel() {
    const p = document.getElementById('jobs-panel');
    if (p) { p.style.display = 'flex'; _renderPanel(); }
  }

  function closePanel() {
    const p = document.getElementById('jobs-panel');
    if (p) p.style.display = 'none';
  }

  function _renderPanel() {
    const list = document.getElementById('jobs-list');
    if (!list) return;
    if (_jobs.length === 0) {
      list.innerHTML = '<div style="color:#475569;padding:16px;text-align:center">لا توجد مهام</div>';
      return;
    }
    const stIcons = { pending:'⏳', running:'🔄', done:'✅', failed:'❌', cancelled:'⏸' };
    list.innerHTML = _jobs.slice(0, 20).map(j => `
      <div class="job-item job-${j.status}">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;font-weight:700;color:#e2e8f0">${stIcons[j.status]||'?'} ${j.title}</span>
          <span style="font-size:10px;color:#475569">${j.status}</span>
        </div>
        <div class="job-progress-bar"><div class="job-progress-fill" style="width:${j.progress}%"></div></div>
        <div style="font-size:10px;color:#64748b">${j.progress}% — ${j.logs?.slice(-1)[0]||''}</div>
        <div style="display:flex;gap:6px;margin-top:5px">
          ${j.status==='running' ? `<button onclick="JobQueue.cancel('${j.id}')" class="job-btn">⏹</button>` : ''}
          ${['failed','cancelled'].includes(j.status) ? `<button onclick="JobQueue.retry('${j.id}')" class="job-btn">🔄</button>` : ''}
          <button onclick="JobQueue.remove('${j.id}')" class="job-btn job-btn-del">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  /* ── مثال: مهمة اختبار ── */
  function addSampleJob() {
    add({
      title: 'مهمة تجريبية',
      fn: async ({ progress, log }) => {
        for (let i = 0; i <= 100; i += 20) {
          await new Promise(r => setTimeout(r, 400));
          progress(i, `الخطوة ${i/20+1}/6`);
        }
        return { success: true };
      }
    });
  }

  function init() {
    _load();
    if (typeof Logger !== 'undefined') Logger.info('JOB', '⚙️ Job Queue جاهز');
  }

  return { init, add, cancel, retry, remove, runParallel, getJobs, getRunning, onUpdate, log, openPanel, closePanel, addSampleJob };

})();
