/* ══════════════════════════════════════════════
   file-system-manager.js — مدير الملفات الاحترافي
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.VirtualFS = (function () {

  const DB_NAME  = 'galaoum_vfs';
  const DB_VER   = 1;
  const STORE    = 'files';
  let _db = null;
  let _cwd = '/';

  /* ── فتح IndexedDB ── */
  function _open() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'path' });
        }
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function _tx(mode) {
    const db = await _open();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  /* ── قراءة ── */
  async function read(path) {
    const store = await _tx('readonly');
    return new Promise((resolve) => {
      const req = store.get(_abs(path));
      req.onsuccess = () => resolve(req.result ? req.result.content : null);
      req.onerror   = () => resolve(null);
    });
  }

  /* ── كتابة ── */
  async function write(path, content) {
    const abs = _abs(path);
    const store = await _tx('readwrite');
    return new Promise((resolve, reject) => {
      const entry = { path: abs, content, size: new TextEncoder().encode(content).length, modified: new Date().toISOString(), type: _type(abs) };
      const req = store.put(entry);
      req.onsuccess = () => { if (typeof Logger !== 'undefined') Logger.info('VFS', `✏️ كتابة: ${abs}`); resolve(true); };
      req.onerror   = () => reject(req.error);
    });
  }

  /* ── حذف ── */
  async function del(path) {
    const abs = _abs(path);
    const store = await _tx('readwrite');
    return new Promise((resolve) => {
      const req = store.delete(abs);
      req.onsuccess = () => { if (typeof Logger !== 'undefined') Logger.info('VFS', `🗑️ حذف: ${abs}`); resolve(true); };
      req.onerror   = () => resolve(false);
    });
  }

  /* ── نقل / إعادة تسمية ── */
  async function move(from, to) {
    const content = await read(from);
    if (content === null) throw new Error(`الملف غير موجود: ${from}`);
    await write(to, content);
    await del(from);
    if (typeof Logger !== 'undefined') Logger.info('VFS', `📦 نقل: ${from} → ${to}`);
    return true;
  }

  /* ── نسخ ── */
  async function copy(from, to) {
    const content = await read(from);
    if (content === null) throw new Error(`الملف غير موجود: ${from}`);
    await write(to, content);
    return true;
  }

  /* ── إنشاء مجلد (placeholder) ── */
  async function mkdir(dirPath) {
    await write(_abs(dirPath) + '/.keep', '');
    return true;
  }

  /* ── قائمة الملفات في مجلد ── */
  async function ls(dirPath) {
    const dir = _abs(dirPath || _cwd).replace(/\/?$/, '/');
    const store = await _tx('readonly');
    return new Promise((resolve) => {
      const entries = [];
      const req = store.openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (!cursor) { resolve(entries); return; }
        const p = cursor.value.path;
        if (p.startsWith(dir) && p.slice(dir.length).split('/').filter(Boolean).length === 1) {
          entries.push({ name: p.slice(dir.length), path: p, size: cursor.value.size, modified: cursor.value.modified, type: cursor.value.type });
        }
        cursor.continue();
      };
      req.onerror = () => resolve([]);
    });
  }

  /* ── بحث نصي ── */
  async function search(query, dirPath) {
    const store = await _tx('readonly');
    return new Promise((resolve) => {
      const results = [];
      const dir = dirPath ? _abs(dirPath) : '/';
      const req = store.openCursor();
      req.onsuccess = e => {
        const cursor = e.target.result;
        if (!cursor) { resolve(results); return; }
        const v = cursor.value;
        if (v.path.startsWith(dir) && typeof v.content === 'string' && v.content.includes(query)) {
          const idx = v.content.indexOf(query);
          const snippet = v.content.slice(Math.max(0, idx-40), idx+60);
          results.push({ path: v.path, snippet });
        }
        cursor.continue();
      };
      req.onerror = () => resolve([]);
    });
  }

  /* ── مقارنة ملفين ── */
  async function compare(pathA, pathB) {
    const [a, b] = await Promise.all([read(pathA), read(pathB)]);
    if (a === null) throw new Error(`الملف غير موجود: ${pathA}`);
    if (b === null) throw new Error(`الملف غير موجود: ${pathB}`);
    const lA = a.split('\n'), lB = b.split('\n');
    const diffs = [];
    const max = Math.max(lA.length, lB.length);
    for (let i = 0; i < max; i++) {
      if (lA[i] !== lB[i]) diffs.push({ line: i + 1, a: lA[i] ?? '', b: lB[i] ?? '' });
    }
    return { identical: diffs.length === 0, differences: diffs };
  }

  /* ── ضغط ملفات (zip) ── */
  async function compress(paths, zipName) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip غير محمّل');
    const zip = new JSZip();
    for (const p of paths) {
      const content = await read(p);
      if (content !== null) zip.file(p.replace(/^\//, ''), content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = zipName || `archive-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }

  /* ── فك ضغط ── */
  async function extract(file, targetDir) {
    if (typeof JSZip === 'undefined') throw new Error('JSZip غير محمّل');
    const zip = await new JSZip().loadAsync(file);
    const dir = _abs(targetDir || '/');
    for (const [name, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue;
      const content = await entry.async('string');
      await write(dir + '/' + name, content);
    }
    return true;
  }

  /* ── استيراد من المشروع الحالي ── */
  async function importFromProject(filesMap) {
    for (const [path, content] of Object.entries(filesMap || {})) {
      if (typeof content === 'string') await write('/' + path, content);
    }
    if (typeof Logger !== 'undefined') Logger.info('VFS', `📥 استيراد ${Object.keys(filesMap).length} ملف`);
  }

  /* ── تغيير المجلد الحالي ── */
  function cd(path) { _cwd = _abs(path); return _cwd; }
  function pwd()    { return _cwd; }

  /* ── مساعدات ── */
  function _abs(p) {
    if (!p) return _cwd;
    if (p.startsWith('/')) return p.replace(/\/+$/, '') || '/';
    return (_cwd.replace(/\/+$/, '') + '/' + p).replace(/\/+$/, '');
  }

  function _type(p) {
    const ext = p.split('.').pop()?.toLowerCase();
    const map = { js:'javascript', ts:'typescript', py:'python', html:'html', css:'css', json:'json', md:'markdown', txt:'text' };
    return map[ext] || 'file';
  }

  /* ── واجهة ── */
  function openPanel() {
    const p = document.getElementById('vfs-panel');
    if (p) { p.style.display = 'flex'; _renderPanel(); }
  }

  function closePanel() {
    const p = document.getElementById('vfs-panel');
    if (p) p.style.display = 'none';
  }

  async function _renderPanel() {
    const el = document.getElementById('vfs-list');
    if (!el) return;
    const entries = await ls('/');
    if (entries.length === 0) {
      el.innerHTML = '<div style="color:#475569;padding:12px;text-align:center">نظام الملفات فارغ — ارفع ZIP لاستيراد الملفات</div>';
      return;
    }
    el.innerHTML = entries.map(e => `
      <div class="vfs-entry">
        <span>${_ico(e.type)} ${e.name}</span>
        <span style="font-size:10px;color:#475569">${_fmt(e.size)}</span>
      </div>`).join('');
  }

  function _ico(t) { return { javascript:'📄', html:'🌐', css:'🎨', json:'📋', python:'🐍', markdown:'📝' }[t] || '📄'; }
  function _fmt(bytes) { if (!bytes) return '—'; if (bytes < 1024) return bytes + 'B'; return (bytes/1024).toFixed(1) + 'KB'; }

  function init() {
    if (typeof Logger !== 'undefined') Logger.info('VFS', '📂 File System Manager جاهز');
  }

  return { init, read, write, del, move, copy, mkdir, ls, search, compare, compress, extract, importFromProject, cd, pwd, openPanel, closePanel };

})();
