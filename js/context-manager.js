/* ══════════════════════════════════════════════════════════════
   context-manager.js — مدير السياق (Context Manager)
   إدارة سياق المشروع، ضغط السياق الطويل، منع فقدان المعلومات
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.ContextManager = (function () {

  const STORE_KEY   = 'galaoum_context_v1';
  const MAX_CHARS    = 6000;   /* الحد قبل الضغط */
  const KEEP_RECENT  = 4;      /* عدد آخر العناصر التي تُحفظ كاملة دوماً */

  let _items = []; /* [{ text, important, ts }] */

  function _load() {
    try { _items = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { _items = []; }
  }
  function _save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(_items)); } catch {}
  }

  /* ── إضافة عنصر سياق جديد ── */
  function add(text, important = false) {
    _items.push({ text, important, ts: Date.now() });
    if (_totalChars() > MAX_CHARS) compress();
    _save();
  }

  function _totalChars() {
    return _items.reduce((n, i) => n + i.text.length, 0);
  }

  /* ── ضغط السياق: تلخيص العناصر القديمة غير المهمة ── */
  function compress() {
    const recent    = _items.slice(-KEEP_RECENT);
    const older     = _items.slice(0, -KEEP_RECENT);
    const important = older.filter(i => i.important);
    const summarizable = older.filter(i => !i.important);

    let summary = null;
    if (summarizable.length) {
      const joined = summarizable.map(i => i.text).join(' ');
      summary = {
        text: '[ملخص] ' + joined.slice(0, 400) + (joined.length > 400 ? '…' : ''),
        important: false,
        ts: Date.now(),
        isSummary: true
      };
    }

    _items = [...important, ...(summary ? [summary] : []), ...recent];
    _save();
  }

  /* ── استرجاع السياق الحالي كنص واحد ── */
  function getContext() {
    return _items.map(i => i.text).join('\n');
  }

  function getImportant() {
    return _items.filter(i => i.important);
  }

  function clear() { _items = []; _save(); }

  _load();
  return { add, compress, getContext, getImportant, clear };
})();
