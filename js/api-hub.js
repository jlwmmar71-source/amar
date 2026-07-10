/* ══════════════════════════════════════════════
   api-hub.js — مركز إدارة APIs
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.ApiHub = (function () {

  const STORE_KEY = 'galaoum_apihub_v1';
  let _apis = {};     /* id → apiDef */
  let _usage = {};    /* id → { calls, errors, lastMs } */

  function _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      _apis  = raw.apis  || {};
      _usage = raw.usage || {};
    } catch { _apis = {}; _usage = {}; }
  }

  function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ apis: _apis, usage: _usage })); } catch {}
  }

  /* ── تسجيل API ── */
  function register(opts) {
    const id = opts.id || _id(opts.name);
    _apis[id] = {
      id,
      name:     opts.name || 'API',
      baseUrl:  opts.baseUrl || '',
      keyParam: opts.keyParam || 'key',
      keyEnv:   opts.keyEnv  || null,
      headers:  opts.headers || {},
      timeout:  opts.timeout || 10000,
      retries:  opts.retries || 2,
      added:    new Date().toISOString()
    };
    _usage[id] = _usage[id] || { calls: 0, errors: 0, lastMs: 0, lastCall: null };
    _save();
    if (typeof Logger !== 'undefined') Logger.info('APIHUB', `📡 API مسجّل: ${opts.name}`);
    return id;
  }

  /* ── الحصول على API ── */
  function get(id) { return _apis[id] || null; }
  function list()  { return Object.values(_apis); }

  /* ── حذف API ── */
  function remove(id) {
    delete _apis[id];
    delete _usage[id];
    _save();
  }

  /* ── اختبار الاتصال ── */
  async function testConnection(id) {
    const api = _apis[id];
    if (!api) throw new Error('API غير موجود');
    const start = Date.now();
    try {
      const url = api.baseUrl.includes('?') ? api.baseUrl + '&ping=1' : api.baseUrl;
      const r = await Promise.race([
        fetch(url, { headers: api.headers, signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 5000))
      ]);
      const ms = Date.now() - start;
      _usage[id].lastMs = ms;
      const ok = r.ok || r.status < 500;
      if (ok) { if (typeof Toast !== 'undefined') Toast.success(`✅ ${api.name}: ${ms}ms`); }
      else     { if (typeof Toast !== 'undefined') Toast.warn(`⚠️ ${api.name}: HTTP ${r.status}`); }
      return { ok, status: r.status, ms };
    } catch (e) {
      _usage[id].errors++;
      _save();
      if (typeof Toast !== 'undefined') Toast.error(`❌ ${api.name}: ${e.message}`);
      return { ok: false, error: e.message, ms: Date.now() - start };
    }
  }

  /* ── إرسال طلب عبر API ── */
  async function call(id, opts) {
    const api = _apis[id];
    if (!api) throw new Error('API غير موجود');

    let attempts = 0;
    const maxRetries = api.retries || 1;

    while (attempts <= maxRetries) {
      const start = Date.now();
      try {
        const url  = opts.url || api.baseUrl;
        const hdrs = { ...api.headers, ...(opts.headers || {}) };
        const key  = _resolveKey(api);
        if (key && api.keyParam) hdrs[api.keyParam] = key;

        const r = await fetch(url, {
          method:  opts.method || 'GET',
          headers: hdrs,
          body:    opts.body ? JSON.stringify(opts.body) : undefined,
          signal:  AbortSignal.timeout ? AbortSignal.timeout(api.timeout) : undefined
        });

        const ms = Date.now() - start;
        _usage[id].calls++;
        _usage[id].lastMs = ms;
        _usage[id].lastCall = new Date().toISOString();
        _save();

        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json().catch(() => r.text());
        return { ok: true, data, ms };

      } catch (e) {
        attempts++;
        if (attempts > maxRetries) {
          _usage[id].errors++;
          _save();
          if (typeof Logger !== 'undefined') Logger.error('APIHUB', `❌ ${api.name}: ${e.message}`);
          throw e;
        }
        await new Promise(r => setTimeout(r, 500 * attempts));
      }
    }
  }

  /* ── مراقبة الاستهلاك ── */
  function getUsage(id) {
    if (id) return _usage[id] || null;
    return { ..._usage };
  }

  function resetUsage(id) {
    if (id) _usage[id] = { calls: 0, errors: 0, lastMs: 0, lastCall: null };
    else Object.keys(_usage).forEach(k => _usage[k] = { calls: 0, errors: 0, lastMs: 0, lastCall: null });
    _save();
  }

  /* ── مساعدات ── */
  function _resolveKey(api) {
    if (api.keyEnv && typeof Security !== 'undefined') return Security.getKey(api.keyEnv);
    return null;
  }

  function _id(name) { return (name || 'api').toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).slice(2,5); }

  /* ── واجهة اللوحة ── */
  function openPanel() {
    const p = document.getElementById('apihub-panel');
    if (p) { p.style.display = 'flex'; _renderPanel(); }
  }

  function closePanel() {
    const p = document.getElementById('apihub-panel');
    if (p) p.style.display = 'none';
  }

  function _renderPanel() {
    const el = document.getElementById('apihub-list');
    if (!el) return;
    const apis = list();
    if (apis.length === 0) {
      el.innerHTML = '<div style="color:#475569;padding:16px;text-align:center">لا توجد APIs مسجّلة</div>';
      return;
    }
    el.innerHTML = apis.map(a => {
      const u = _usage[a.id] || {};
      return `
        <div class="apihub-item">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700;color:#e2e8f0;font-size:12px">📡 ${a.name}</span>
            <div style="display:flex;gap:5px">
              <button onclick="ApiHub.testConnection('${a.id}')" class="apihub-btn">اختبار</button>
              <button onclick="ApiHub.remove('${a.id}');ApiHub.openPanel()" class="apihub-btn apihub-btn-del">🗑️</button>
            </div>
          </div>
          <div style="font-size:10px;color:#64748b;margin-top:4px;word-break:break-all">${a.baseUrl}</div>
          <div style="display:flex;gap:12px;margin-top:6px;font-size:10px;color:#475569">
            <span>📊 ${u.calls||0} طلب</span>
            <span>❌ ${u.errors||0} خطأ</span>
            <span>⚡ ${u.lastMs||0}ms</span>
          </div>
        </div>`;
    }).join('');
  }

  /* ── تسجيل APIs الموجودة تلقائياً ── */
  function _autoRegisterBuiltins() {
    if (!_apis['openrouter']) {
      register({ id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1/models', keyParam: 'Authorization', keyEnv: 'openrouter' });
    }
    if (!_apis['gemini']) {
      register({ id: 'gemini', name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models', keyEnv: 'gemini_0' });
    }
    if (!_apis['pollinations']) {
      register({ id: 'pollinations', name: 'Pollinations', baseUrl: 'https://image.pollinations.ai' });
    }
    if (!_apis['duckduckgo']) {
      register({ id: 'duckduckgo', name: 'DuckDuckGo Search', baseUrl: 'https://api.duckduckgo.com' });
    }
    if (!_apis['wandbox']) {
      register({ id: 'wandbox', name: 'Wandbox (Code Runner)', baseUrl: 'https://wandbox.org/api/compile.json' });
    }
  }

  function init() {
    _load();
    _autoRegisterBuiltins();
    _save();
    if (typeof Logger !== 'undefined') Logger.info('APIHUB', `📡 API Hub جاهز — ${Object.keys(_apis).length} APIs`);
  }

  return { init, register, get, list, remove, testConnection, call, getUsage, resetUsage, openPanel, closePanel };

})();
