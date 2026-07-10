/* ══════════════════════════════════════════════
   artifact-manager.js — نظام إدارة الملفات الناتجة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.ArtifactManager = (function () {

  const DB_NAME = 'galaoum_artifacts';
  const DB_VER  = 1;
  const STORE   = 'artifacts';
  let _db = null;
  let _meta = {}; /* id → metadata (cached) */

  /* ── IndexedDB ── */
  function _open() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: 'id' });
          s.createIndex('type', 'type', { unique: false });
          s.createIndex('created', 'created', { unique: false });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = () => reject(req.error);
    });
  }

  async function _tx(mode) {
    const db = await _open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  /* ── أنواع Artifacts ── */
  const TYPES = { BUILD: 'build', REPORT: 'report', LOG: 'log', SCREENSHOT: 'screenshot', BACKUP: 'backup', DEPLOYMENT: 'deployment' };

  /* ── حفظ artifact ── */
  async function save(opts) {
    const id = opts.id || _id();
    const entry = {
      id,
      type:     opts.type || TYPES.BUILD,
      name:     opts.name || 'artifact',
      content:  opts.content || '',
      mimeType: opts.mimeType || 'text/plain',
      size:     (opts.content || '').length,
      tags:     opts.tags || [],
      created:  new Date().toISOString(),
      meta:     opts.meta || {}
    };
    const store = await _tx('readwrite');
    await _promisify(store.put(entry));
    _meta[id] = { ...entry, content: undefined };
    if (typeof Logger !== 'undefined') Logger.info('ARTIFACT', `📦 حفظ: ${entry.name} (${entry.type})`);
    return id;
  }

  /* ── قراءة artifact ── */
  async function get(id) {
    const store = await _tx('readonly');
    return _promisify(store.get(id));
  }

  /* ── قائمة (بدون محتوى) ── */
  async function list(type) {
    const store = await _tx('readonly');
    const all = await _promisify(store.getAll());
    const filtered = type ? all.filter(a => a.type === type) : all;
    return filtered.map(a => ({ ...a, content: undefined })).sort((a, b) => b.created.localeCompare(a.created));
  }

  /* ── حذف artifact ── */
  async function remove(id) {
    const store = await _tx('readwrite');
    await _promisify(store.delete(id));
    delete _meta[id];
  }

  /* ── تنظيف القديم (أكثر من 30 يوم) ── */
  async function cleanup(maxAgeDays) {
    const days = maxAgeDays || 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const all = await list();
    const old = all.filter(a => a.created < cutoff);
    for (const a of old) await remove(a.id);
    if (old.length > 0 && typeof Logger !== 'undefined') Logger.info('ARTIFACT', `🧹 حذف ${old.length} artifact قديم`);
    return old.length;
  }

  /* ── تنزيل artifact ── */
  async function download(id) {
    const art = await get(id);
    if (!art) throw new Error('Artifact غير موجود');
    const blob = new Blob([art.content], { type: art.mimeType || 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = art.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── حفظ سريع لأنواع مختلفة ── */
  async function saveLog(content, name) {
    return save({ type: TYPES.LOG, name: name || `log-${Date.now()}.txt`, content, mimeType: 'text/plain' });
  }

  async function saveReport(content, name) {
    return save({ type: TYPES.REPORT, name: name || `report-${Date.now()}.md`, content, mimeType: 'text/markdown' });
  }

  async function saveScreenshot(dataUrl, name) {
    return save({ type: TYPES.SCREENSHOT, name: name || `screenshot-${Date.now()}.png`, content: dataUrl, mimeType: 'image/png' });
  }

  async function saveBackup(content, name) {
    return save({ type: TYPES.BACKUP, name: name || `backup-${Date.now()}.json`, content, mimeType: 'application/json' });
  }

  /* ── مساعدات ── */
  function _promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  function _id() { return 'art_' + Date.now() + '_' + Math.random().toString(36).slice(2,5); }

  /* ── واجهة اللوحة ── */
  async function openPanel() {
    const p = document.getElementById('artifact-panel');
    if (p) { p.style.display = 'flex'; await _renderPanel(); }
  }

  function closePanel() {
    const p = document.getElementById('artifact-panel');
    if (p) p.style.display = 'none';
  }

  async function _renderPanel() {
    const el = document.getElementById('artifact-list');
    if (!el) return;
    const arts = await list();
    if (arts.length === 0) {
      el.innerHTML = '<div style="color:#475569;padding:16px;text-align:center">لا توجد artifacts</div>';
      return;
    }
    const icons = { build:'🏗️', report:'📋', log:'📜', screenshot:'📸', backup:'💾', deployment:'🚀' };
    el.innerHTML = arts.slice(0, 30).map(a => `
      <div class="artifact-item">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;font-weight:700;color:#e2e8f0">${icons[a.type]||'📄'} ${a.name}</span>
          <span style="font-size:9px;color:#475569">${_fmtSize(a.size)}</span>
        </div>
        <div style="font-size:10px;color:#64748b">${a.type} — ${_fmtDate(a.created)}</div>
        <div style="display:flex;gap:5px;margin-top:5px">
          <button onclick="ArtifactManager.download('${a.id}')" class="artifact-btn">⬇️ تنزيل</button>
          <button onclick="ArtifactManager.remove('${a.id}').then(()=>ArtifactManager.openPanel())" class="artifact-btn artifact-btn-del">🗑️</button>
        </div>
      </div>`).join('');
  }

  function _fmtSize(n) { if (!n) return '—'; if (n < 1024) return n+'B'; if (n < 1048576) return (n/1024).toFixed(1)+'KB'; return (n/1048576).toFixed(1)+'MB'; }
  function _fmtDate(iso) { try { return new Date(iso).toLocaleDateString('ar'); } catch { return iso; } }

  function init() {
    _open().catch(() => {});
    if (typeof Logger !== 'undefined') Logger.info('ARTIFACT', '📦 Artifact Manager جاهز');
  }

  return { init, save, get, list, remove, cleanup, download, saveLog, saveReport, saveScreenshot, saveBackup, openPanel, closePanel, TYPES };

})();
