/* ══════════════════════════════════════════════
   smart-cache.js — نظام Cache ذكي
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.SmartCache = (function () {

  const STORE_KEY = 'galaoum_cache_v1';
  const MAX_ENTRIES = 500;
  const DEFAULT_TTL = 1000 * 60 * 30; /* 30 دقيقة */

  let _cache = new Map(); /* key → { value, expires, hits, created } */
  let _stats = { hits: 0, misses: 0, evictions: 0 };

  /* ── تحميل من localStorage ── */
  function _load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      const now = Date.now();
      _cache = new Map(
        Object.entries(raw).filter(([, v]) => v.expires > now)
      );
    } catch { _cache = new Map(); }
  }

  function _persist() {
    try {
      const obj = {};
      for (const [k, v] of _cache) obj[k] = v;
      localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    } catch {}
  }

  /* ── الحصول على قيمة ── */
  function get(key) {
    const entry = _cache.get(key);
    if (!entry) { _stats.misses++; return null; }
    if (entry.expires < Date.now()) { _cache.delete(key); _stats.misses++; return null; }
    entry.hits++;
    _stats.hits++;
    return entry.value;
  }

  /* ── حفظ قيمة ── */
  function set(key, value, ttl) {
    /* إخلاء مساحة إذا امتلأ الكاش */
    if (_cache.size >= MAX_ENTRIES) _evict();

    _cache.set(key, {
      value,
      expires: Date.now() + (ttl || DEFAULT_TTL),
      hits:    0,
      created: Date.now()
    });
    _persist();
  }

  /* ── حذف مفتاح ── */
  function del(key) { _cache.delete(key); _persist(); }

  /* ── مسح كامل ── */
  function clear() { _cache.clear(); localStorage.removeItem(STORE_KEY); _stats = { hits: 0, misses: 0, evictions: 0 }; }

  /* ── دالة التخزين المؤقت ── */
  async function cached(key, fn, ttl) {
    const hit = get(key);
    if (hit !== null) return hit;
    const result = await fn();
    set(key, result, ttl);
    return result;
  }

  /* ── تنظيف القديم ── */
  function _evict() {
    const now = Date.now();
    /* أولاً: احذف المنتهية ── */
    for (const [k, v] of _cache) {
      if (v.expires < now) { _cache.delete(k); _stats.evictions++; }
    }
    /* إذا لا يزال ممتلئاً: احذف الأقل استخداماً (LRU) */
    if (_cache.size >= MAX_ENTRIES) {
      const sorted = [..._cache.entries()].sort((a, b) => a[1].hits - b[1].hits);
      const toRemove = sorted.slice(0, Math.floor(MAX_ENTRIES * 0.2));
      toRemove.forEach(([k]) => { _cache.delete(k); _stats.evictions++; });
    }
  }

  /* ── إحصائيات ── */
  function stats() {
    const total = _stats.hits + _stats.misses;
    return {
      size:      _cache.size,
      maxSize:   MAX_ENTRIES,
      hits:      _stats.hits,
      misses:    _stats.misses,
      evictions: _stats.evictions,
      hitRate:   total ? Math.round((_stats.hits / total) * 100) + '%' : '0%',
      sizeBytes: _estimateSize()
    };
  }

  function _estimateSize() {
    try {
      return new TextEncoder().encode(localStorage.getItem(STORE_KEY) || '').length;
    } catch { return 0; }
  }

  /* ── تنظيف تلقائي كل 10 دقائق ── */
  function _autoClean() {
    setInterval(() => {
      const before = _cache.size;
      _evict();
      const removed = before - _cache.size;
      if (removed > 0 && typeof Logger !== 'undefined') Logger.info('CACHE', `🧹 تنظيف: حُذف ${removed} مدخلة`);
    }, 1000 * 60 * 10);
  }

  function init() {
    _load();
    _autoClean();
    if (typeof Logger !== 'undefined') Logger.info('CACHE', `⚡ Smart Cache جاهز — ${_cache.size} مدخلة محفوظة`);
  }

  return { init, get, set, del, clear, cached, stats, evict: _evict };

})();
