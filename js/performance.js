/* ══════════════════════════════════════════════════════════════
   performance.js — محسّن الأداء (Performance Optimizer)
   يراقب ويحسّن: ذاكرة، معالج، استجابة، تحميل ملفات، بحث
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.PerformanceOptimizer = (function () {

  /* ══ سجل القياسات ══ */
  const _metrics = {
    apiCalls:   [],     // [{ts, ms, model, success}]
    renderTimes:[],     // [{ts, ms, component}]
    memory:     [],     // [{ts, usedJSHeapSize}]
    cacheHits:  0,
    cacheMisses:0
  };

  /* ══ ذاكرة التخزين المؤقت (Response Cache) ══ */
  const _cache   = new Map();   // hash → { response, ts }
  const CACHE_TTL = 10 * 60 * 1000; // 10 دقائق

  /* ── توليد مفتاح الكاش ── */
  function _hashKey(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    }
    return String(h);
  }

  /* ═══════════════════════════════════════════════════════
     كاش الردود
     ═══════════════════════════════════════════════════════ */
  function cacheGet(key) {
    const k = _hashKey(key);
    const entry = _cache.get(k);
    if (!entry) { _metrics.cacheMisses++; return null; }
    if (Date.now() - entry.ts > CACHE_TTL) {
      _cache.delete(k);
      _metrics.cacheMisses++;
      return null;
    }
    _metrics.cacheHits++;
    Logger.info('PERF', `💾 Cache hit (${Math.round((Date.now() - entry.ts) / 1000)}s old)`);
    return entry.response;
  }

  function cacheSet(key, response) {
    const k = _hashKey(key);
    _cache.set(k, { response, ts: Date.now() });
    /* تنظيف الكاش إذا تجاوز 200 عنصر */
    if (_cache.size > 200) {
      const oldest = [..._cache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
      if (oldest) _cache.delete(oldest[0]);
    }
  }

  function cacheClear() {
    _cache.clear();
    Logger.info('PERF', '🗑️ تم مسح الكاش');
  }

  /* ═══════════════════════════════════════════════════════
     تسجيل مقاييس API
     ═══════════════════════════════════════════════════════ */
  function recordApiCall(model, ms, success) {
    _metrics.apiCalls.push({ ts: Date.now(), model, ms, success });
    if (_metrics.apiCalls.length > 200) _metrics.apiCalls.shift();

    if (ms > 10000) {
      Logger.warn('PERF', `🐢 استجابة بطيئة: ${model} (${ms}ms)`);
    }
  }

  function recordRender(component, ms) {
    _metrics.renderTimes.push({ ts: Date.now(), component, ms });
    if (_metrics.renderTimes.length > 100) _metrics.renderTimes.shift();
  }

  /* ═══════════════════════════════════════════════════════
     مراقبة الذاكرة
     ═══════════════════════════════════════════════════════ */
  function sampleMemory() {
    if (!performance.memory) return;
    const mb = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    _metrics.memory.push({ ts: Date.now(), mb });
    if (_metrics.memory.length > 60) _metrics.memory.shift();

    if (mb > 200) {
      Logger.warn('PERF', `⚠️ استخدام ذاكرة عالٍ: ${mb}MB`);
      _cleanup();
    }
  }

  /* تشغيل عيّنات الذاكرة كل دقيقة */
  setInterval(sampleMemory, 60000);

  /* ═══════════════════════════════════════════════════════
     تنظيف الموارد
     ═══════════════════════════════════════════════════════ */
  function _cleanup() {
    /* تنظيف الكاش القديم */
    const now = Date.now();
    _cache.forEach((v, k) => {
      if (now - v.ts > CACHE_TTL) _cache.delete(k);
    });

    /* تقليم سجل الأحداث القديمة */
    const cutoff = now - 30 * 60 * 1000; // آخر 30 دقيقة
    _metrics.apiCalls    = _metrics.apiCalls.filter(m => m.ts > cutoff);
    _metrics.renderTimes = _metrics.renderTimes.filter(m => m.ts > cutoff);

    Logger.info('PERF', '🧹 تنظيف الموارد اكتمل');
  }

  /* ═══════════════════════════════════════════════════════
     Lazy Loading للصور
     ═══════════════════════════════════════════════════════ */
  function lazyLoadImages() {
    const imgs = document.querySelectorAll('img[data-src]');
    if (!imgs.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      });
    }, { threshold: 0.1 });

    imgs.forEach(img => observer.observe(img));
    Logger.info('PERF', `🖼️ Lazy loading: ${imgs.length} صورة`);
  }

  /* ═══════════════════════════════════════════════════════
     Debounce و Throttle مساعدتان
     ═══════════════════════════════════════════════════════ */
  function debounce(fn, ms = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  function throttle(fn, ms = 1000) {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last < ms) return;
      last = now;
      return fn(...args);
    };
  }

  /* ═══════════════════════════════════════════════════════
     إحصاءات الأداء الكاملة
     ═══════════════════════════════════════════════════════ */
  function getStats() {
    const api   = _metrics.apiCalls;
    const totalCalls  = api.length;
    const successRate = totalCalls
      ? Math.round(api.filter(c => c.success).length / totalCalls * 100)
      : 0;
    const avgMs = totalCalls
      ? Math.round(api.reduce((s, c) => s + c.ms, 0) / totalCalls)
      : 0;
    const slowCalls = api.filter(c => c.ms > 5000).length;

    const memory = _metrics.memory;
    const lastMem = memory[memory.length - 1]?.mb || 0;

    const hitRate = (_metrics.cacheHits + _metrics.cacheMisses)
      ? Math.round(_metrics.cacheHits / (_metrics.cacheHits + _metrics.cacheMisses) * 100)
      : 0;

    return {
      api: { total: totalCalls, successRate, avgMs, slowCalls },
      cache: { size: _cache.size, hits: _metrics.cacheHits, misses: _metrics.cacheMisses, hitRate },
      memory: { currentMB: lastMem, samples: memory.length },
      render: { count: _metrics.renderTimes.length }
    };
  }

  /* ═══════════════════════════════════════════════════════
     عرض لوحة الأداء في Console
     ═══════════════════════════════════════════════════════ */
  function printReport() {
    const s = getStats();
    Logger.info('PERF', [
      `📊 تقرير الأداء:`,
      `  API: ${s.api.total} طلب، نجاح ${s.api.successRate}%، متوسط ${s.api.avgMs}ms`,
      `  كاش: ${s.cache.size} مخزّن، معدل ضرب ${s.cache.hitRate}%`,
      `  ذاكرة: ${s.memory.currentMB}MB`
    ].join('\n'));
  }

  /* ═══════════════════════════════════════════════════════
     PerformanceObserver — رصد العمليات البطيئة
     ═══════════════════════════════════════════════════════ */
  (function _setupObserver() {
    try {
      const obs = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.duration > 3000) {
            Logger.warn('PERF', `🐢 عملية بطيئة: "${entry.name}" (${Math.round(entry.duration)}ms)`);
          }
        });
      });
      obs.observe({ entryTypes: ['measure', 'resource', 'longtask'] });
    } catch {}
  })();

  return {
    cacheGet, cacheSet, cacheClear,
    recordApiCall, recordRender,
    sampleMemory, lazyLoadImages,
    debounce, throttle,
    getStats, printReport, cleanup: _cleanup
  };
})();
