/* ══════════════════════════════════════════════
   context-compress.js — ضغط السياق الذكي
   Galaoum AI Engine v6.0 — by عمار جلعوم
   ══════════════════════════════════════════════ */

window.ContextCompress = (function () {

  const MAX_MSGS        = 20;
  const COMPRESS_TO     = 8;
  const SUMMARY_KEY     = 'galaoum_ctx_summary';
  const COMPRESS_ENABLED= 'galaoum_ctx_compress';

  let _enabled   = true;
  let _summary   = '';
  let _lastCheck = 0;
  let _baseAPI   = null;   /* نسخة callAPI قبل أي hook — تُعيَّن عند أول ربط */
  let _hooking   = false;

  /* ─── تهيئة ─── */
  function init() {
    try {
      const s = localStorage.getItem(COMPRESS_ENABLED);
      if (s === '0') _enabled = false;
      _summary = localStorage.getItem(SUMMARY_KEY) || '';
    } catch {}
    _hookCallAPI();
  }

  /* ─── ربط دالة callAPI بأمان — يُعيد المحاولة حتى تتوفر ─── */
  function _hookCallAPI() {
    if (_hooking) return;
    _hooking = true;

    const _tryHook = () => {
      if (typeof window.callAPI !== 'function') {
        setTimeout(_tryHook, 600); return;
      }
      /* احفظ النسخة الأصلية مرة واحدة فقط */
      if (!_baseAPI) _baseAPI = window.callAPI;

      const _wrapped = window.callAPI;
      window.callAPI = async function(prompt, saveCtx) {
        if (_enabled) await _checkAndCompress();
        return _wrapped(prompt, saveCtx);
      };
    };

    setTimeout(_tryHook, 800); /* انتظر حتى تنتهي كل الـ hooks الأخرى في integrations.js */
  }

  /* ─── التلخيص باستخدام callAPI الأصلية مباشرة ─── */
  async function _summarize(text) {
    /* استخدم أصل callAPI المحفوظ لتجنب loop */
    const apiFn = _baseAPI || (typeof window._origCallAPI === 'function' ? window._origCallAPI : window.callAPI);
    if (typeof apiFn !== 'function') return null;

    const prompt = `لخّص المحادثة التالية في 3-5 جمل مختصرة بالعربية، مع الحفاظ على أهم النقاط:\n\n${text}\n\nالملخص:`;
    try {
      return await apiFn(prompt, false);
    } catch { return null; }
  }

  /* ─── فحص وضغط السياق إن لزم ─── */
  async function _checkAndCompress() {
    if (Date.now() - _lastCheck < 8000) return;
    _lastCheck = Date.now();

    try {
      let history = [];
      try {
        const raw = localStorage.getItem('galaoum_memory');
        if (raw) history = JSON.parse(raw) || [];
      } catch { return; }

      if (!Array.isArray(history) || history.length < MAX_MSGS) return;

      const old    = history.slice(0, history.length - COMPRESS_TO);
      const recent = history.slice(-COMPRESS_TO);
      if (!old.length) return;

      /* بناء نص التلخيص */
      const toSummarize = old.map(m =>
        `${m.role === 'user' ? '👤' : '🤖'}: ${(m.content || '').slice(0, 300)}`
      ).join('\n');

      const newSummary = await _summarize(toSummarize);
      if (!newSummary) return;

      _summary = _summary
        ? `[سابق]: ${_summary.slice(0, 400)} | [جديد]: ${newSummary}`
        : newSummary;

      try { localStorage.setItem(SUMMARY_KEY, _summary.slice(0, 2000)); } catch {}

      /* حفظ النسخة المضغوطة مع الملخص في الرأس */
      const compressed = [
        { role: 'assistant', content: `[ملخص تلقائي للمحادثة السابقة]: ${_summary}` },
        ...recent
      ];

      try { localStorage.setItem('galaoum_memory', JSON.stringify(compressed)); } catch {}

      if (typeof Toast !== 'undefined') Toast.info(`🧠 ضُغط ${old.length} رسالة قديمة تلقائياً`, 4000);
      if (typeof Logger !== 'undefined') Logger.info('CTX-COMPRESS', `ضُغط ${old.length} رسالة → ملخص`);

    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.warn('CTX-COMPRESS', e.message);
    }
  }

  /* ─── ضغط يدوي فوري ─── */
  async function compressNow() {
    _lastCheck = 0;
    await _checkAndCompress();
  }

  /* ─── إحصاءات ─── */
  function getStats() {
    let history = [];
    try { history = JSON.parse(localStorage.getItem('galaoum_memory') || '[]') || []; } catch {}
    const est = history.reduce((a, m) => a + Math.ceil((m.content || '').length / 4), 0);
    return {
      messages:  history.length,
      estTokens: est,
      summary:   _summary ? _summary.slice(0, 100) + '...' : 'لا يوجد',
      enabled:   _enabled
    };
  }

  function setEnabled(v) {
    _enabled = v;
    try { localStorage.setItem(COMPRESS_ENABLED, v ? '1' : '0'); } catch {}
    if (typeof Toast !== 'undefined') Toast.info(v ? '🧠 ضغط السياق: مفعّل' : '🧠 ضغط السياق: معطّل');
  }

  function isEnabled()  { return _enabled; }
  function getSummary() { return _summary; }
  function clearSummary() {
    _summary = '';
    try { localStorage.removeItem(SUMMARY_KEY); } catch {}
  }

  return { init, compressNow, getStats, setEnabled, isEnabled, getSummary, clearSummary };
})();
