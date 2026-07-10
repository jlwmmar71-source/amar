/* ══════════════════════════════════════════════
   database-manager.js — مدير قواعد البيانات
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.DatabaseManager = (function () {

  const DB_KEY = 'galaoum_db_v1';
  let _db = null;      /* sql.js SQLite instance */
  let _sqlJsReady = false;
  let _connections = {}; /* اتصالات PostgreSQL/MySQL (محاكاة) */
  let _queryLog = [];

  /* ── تحميل sql.js ── */
  async function _loadSqlJs() {
    if (_sqlJsReady) return true;
    return new Promise(resolve => {
      if (typeof initSqlJs !== 'undefined') { _initDb(); resolve(true); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/sql-wasm.min.js';
      s.onload = () => { _initDb(); _sqlJsReady = true; resolve(true); };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  function _initDb() {
    if (typeof initSqlJs === 'undefined') return;
    initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/${f}` })
      .then(SQL => {
        /* استعادة قاعدة بيانات موجودة أو إنشاء جديدة */
        const saved = localStorage.getItem(DB_KEY);
        if (saved) {
          const arr = Uint8Array.from(atob(saved), c => c.charCodeAt(0));
          _db = new SQL.Database(arr);
        } else {
          _db = new SQL.Database();
        }
        _sqlJsReady = true;
        if (typeof Logger !== 'undefined') Logger.info('DB', '🗄️ SQLite جاهز');
      })
      .catch(e => {
        if (typeof Logger !== 'undefined') Logger.error('DB', `فشل تحميل SQLite: ${e.message}`);
      });
  }

  /* ── تنفيذ استعلام SQLite ── */
  async function query(sql, params) {
    if (!_sqlJsReady) await _loadSqlJs();
    if (!_db) throw new Error('قاعدة البيانات غير جاهزة — جارٍ التحميل');

    const start = Date.now();
    try {
      const stmt = _db.prepare(sql);
      if (params) stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();

      _saveDb();
      const ms = Date.now() - start;
      _logQuery(sql, ms, rows.length, null);
      return { rows, rowCount: rows.length, ms };
    } catch (e) {
      _logQuery(sql, Date.now() - start, 0, e.message);
      throw e;
    }
  }

  /* ── تنفيذ أمر (INSERT/UPDATE/DELETE/CREATE) ── */
  async function exec(sql) {
    if (!_sqlJsReady) await _loadSqlJs();
    if (!_db) throw new Error('قاعدة البيانات غير جاهزة');

    const start = Date.now();
    try {
      _db.run(sql);
      _saveDb();
      _logQuery(sql, Date.now() - start, null, null);
      return { ok: true };
    } catch (e) {
      _logQuery(sql, Date.now() - start, null, e.message);
      throw e;
    }
  }

  /* ── قائمة الجداول ── */
  async function listTables() {
    const r = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    return r.rows.map(row => row.name);
  }

  /* ── وصف جدول ── */
  async function describeTable(name) {
    const r = await query(`PRAGMA table_info(${name})`);
    return r.rows;
  }

  /* ── إنشاء جدول ── */
  async function createTable(name, columns) {
    const cols = columns.map(c => `${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}${c.nn ? ' NOT NULL' : ''}${c.default !== undefined ? ` DEFAULT ${c.default}` : ''}`).join(', ');
    await exec(`CREATE TABLE IF NOT EXISTS ${name} (${cols})`);
    if (typeof Logger !== 'undefined') Logger.info('DB', `📋 إنشاء جدول: ${name}`);
    return true;
  }

  /* ── حذف جدول ── */
  async function dropTable(name) {
    await exec(`DROP TABLE IF EXISTS ${name}`);
    if (typeof Logger !== 'undefined') Logger.info('DB', `🗑️ حذف جدول: ${name}`);
  }

  /* ── نسخ احتياطي ── */
  function backup() {
    if (!_db) throw new Error('لا توجد قاعدة بيانات');
    const data = _db.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `galaoum-db-backup-${Date.now()}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof Logger !== 'undefined') Logger.info('DB', '💾 نسخ احتياطي محفوظ');
  }

  /* ── استعادة من ملف ── */
  function restore(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (!_sqlJsReady) { reject(new Error('sql.js غير محمّل')); return; }
          if (typeof initSqlJs === 'undefined') { reject(new Error('sql.js غير محمّل')); return; }
          initSqlJs({ locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.11.0/${f}` }).then(SQL => {
            _db = new SQL.Database(new Uint8Array(e.target.result));
            _saveDb();
            if (typeof Logger !== 'undefined') Logger.info('DB', '♻️ قاعدة البيانات مستعادة');
            resolve(true);
          });
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ── اتصال محاكاة PostgreSQL/MySQL ── */
  function addConnection(opts) {
    const conn = {
      id:     _id(),
      type:   opts.type || 'postgresql',
      host:   opts.host || 'localhost',
      port:   opts.port || (opts.type === 'mysql' ? 3306 : 5432),
      db:     opts.db || 'mydb',
      user:   opts.user || 'admin',
      status: 'disconnected',
      added:  new Date().toISOString()
    };
    _connections[conn.id] = conn;
    if (typeof Logger !== 'undefined') Logger.info('DB', `🔌 اتصال جديد: ${conn.type}@${conn.host}:${conn.port}/${conn.db}`);
    return conn.id;
  }

  async function testConnection(id) {
    const conn = _connections[id];
    if (!conn) throw new Error('الاتصال غير موجود');
    /* محاكاة: نجاح دائم في البيئة الحالية */
    conn.status = 'connected';
    if (typeof Toast !== 'undefined') Toast.success(`✅ متصل: ${conn.type}@${conn.host}`);
    return true;
  }

  function getConnections() { return Object.values(_connections); }

  /* ── حفظ قاعدة البيانات ── */
  function _saveDb() {
    if (!_db) return;
    try {
      const data = _db.export();
      const b64 = btoa(String.fromCharCode(...data));
      localStorage.setItem(DB_KEY, b64);
    } catch {}
  }

  function _logQuery(sql, ms, rows, err) {
    _queryLog.unshift({ sql: sql.slice(0, 200), ms, rows, err, ts: new Date().toISOString() });
    _queryLog = _queryLog.slice(0, 100);
    if (err && typeof Logger !== 'undefined') Logger.error('DB', `خطأ SQL: ${err}`);
  }

  function getQueryLog() { return [..._queryLog]; }
  function _id() { return 'db' + Math.random().toString(36).slice(2,7); }

  /* ── واجهة اللوحة ── */
  async function openPanel() {
    const p = document.getElementById('db-panel');
    if (p) { p.style.display = 'flex'; await _renderPanel(); }
    if (!_sqlJsReady) { await _loadSqlJs(); }
  }

  function closePanel() {
    const p = document.getElementById('db-panel');
    if (p) p.style.display = 'none';
  }

  async function _renderPanel() {
    const tablesEl = document.getElementById('db-tables');
    if (!tablesEl) return;
    try {
      const tables = await listTables();
      tablesEl.innerHTML = tables.length
        ? tables.map(t => `<div class="db-table-item" onclick="DatabaseManager.loadTable('${t}')">${t}</div>`).join('')
        : '<div style="color:#475569;padding:8px">لا توجد جداول</div>';
    } catch { tablesEl.innerHTML = '<div style="color:#475569;padding:8px">جارٍ تحميل SQLite...</div>'; }
  }

  async function loadTable(name) {
    try {
      const rows = await query(`SELECT * FROM ${name} LIMIT 50`);
      _renderTable(name, rows.rows);
    } catch (e) {
      if (typeof Toast !== 'undefined') Toast.error(e.message);
    }
  }

  function _renderTable(name, rows) {
    const el = document.getElementById('db-results');
    if (!el) return;
    if (rows.length === 0) { el.innerHTML = `<div style="color:#64748b;padding:8px">الجدول "${name}" فارغ</div>`; return; }
    const cols = Object.keys(rows[0]);
    el.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:#fca5a5;margin-bottom:6px">${name} — ${rows.length} صفوف</div>
      <div style="overflow-x:auto"><table class="db-table">
        <thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${r[c]??''}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
  }

  async function runQueryFromUI() {
    const sqlEl = document.getElementById('db-query-input');
    if (!sqlEl) return;
    const sql = sqlEl.value.trim();
    if (!sql) return;
    try {
      const result = await query(sql);
      _renderTable('نتائج', result.rows);
      if (typeof Toast !== 'undefined') Toast.success(`✅ ${result.rowCount} نتيجة`);
    } catch (e) {
      if (typeof Toast !== 'undefined') Toast.error(e.message);
    }
  }

  function init() {
    _loadSqlJs();
    if (typeof Logger !== 'undefined') Logger.info('DB', '🗄️ Database Manager جاهز');
  }

  return { init, query, exec, listTables, describeTable, createTable, dropTable, backup, restore, addConnection, testConnection, getConnections, getQueryLog, openPanel, closePanel, loadTable, runQueryFromUI };

})();
