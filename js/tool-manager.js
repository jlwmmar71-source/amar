/* ══════════════════════════════════════════════════════════════
   tool-manager.js — مدير الأدوات الموحّد (Tool Manager)
   تسجيل، تحميل، تشغيل، ومراقبة جميع الأدوات
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.ToolManager = (function () {

  /* ══ سجل الأدوات ══ */
  const _tools   = new Map();   // id → toolDef
  const _running = new Set();   // الأدوات الجارية الآن
  const _stats   = new Map();   // id → { calls, errors, totalMs }

  /* ══ تعريف الأداة ══ */
  /*
    {
      id:          'tool_id',
      name:        'اسم الأداة',
      description: 'وصف',
      category:    'search|code|image|file|util',
      enabled:     true,
      run:         async (params) => result
    }
  */

  /* ══ تسجيل أداة ══ */
  function register(toolDef) {
    if (!toolDef || !toolDef.id || typeof toolDef.run !== 'function') {
      Logger.warn('TOOLS', '⚠️ تعريف أداة غير صالح');
      return false;
    }
    if (_tools.has(toolDef.id)) {
      Logger.info('TOOLS', `🔄 تحديث أداة: ${toolDef.id}`);
    }
    _tools.set(toolDef.id, { enabled: true, ...toolDef });
    _stats.set(toolDef.id, { calls: 0, errors: 0, totalMs: 0 });
    Logger.info('TOOLS', `🔧 أداة مسجّلة: ${toolDef.name || toolDef.id}`);
    return true;
  }

  /* ══ تشغيل أداة واحدة ══ */
  async function run(toolId, params = {}) {
    const tool = _tools.get(toolId);
    if (!tool) {
      Logger.error('TOOLS', `❌ أداة غير موجودة: ${toolId}`);
      return { success: false, error: 'أداة غير موجودة' };
    }
    if (!tool.enabled) {
      return { success: false, error: 'الأداة معطّلة' };
    }

    /* فحص أمني */
    if (typeof Security !== 'undefined') {
      const safe = Security.checkDomain && params.url
        ? Security.checkDomain(params.url) : true;
      if (!safe) return { success: false, error: 'URL غير مسموح' };
    }

    _running.add(toolId);
    const st = _stats.get(toolId);
    const t0 = performance.now();

    try {
      Logger.info('TOOLS', `▶ تشغيل: ${tool.name || toolId}`);
      const result = await Promise.race([
        tool.run(params),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
      ]);
      const ms = Math.round(performance.now() - t0);
      st.calls++;
      st.totalMs += ms;
      Logger.info('TOOLS', `✓ ${tool.name || toolId} (${ms}ms)`);
      return { success: true, result, ms };
    } catch (err) {
      st.errors++;
      Logger.error('TOOLS', `✗ ${tool.name || toolId}: ${err.message}`);
      /* إعادة المحاولة مرة واحدة */
      if (!params._retry) {
        Logger.info('TOOLS', `⟳ إعادة محاولة ${toolId}...`);
        return run(toolId, { ...params, _retry: true });
      }
      return { success: false, error: err.message };
    } finally {
      _running.delete(toolId);
    }
  }

  /* ══ تشغيل أدوات متعددة بالتوازي ══ */
  async function runParallel(toolCalls) {
    /*
      toolCalls: [{ toolId: 'x', params: {} }, ...]
    */
    const promises = toolCalls.map(({ toolId, params }) =>
      run(toolId, params || {}).then(r => ({ toolId, ...r }))
    );
    const results = await Promise.allSettled(promises);
    return results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason });
  }

  /* ══ تعطيل / تفعيل أداة ══ */
  function toggle(toolId, enabled) {
    const tool = _tools.get(toolId);
    if (!tool) return;
    tool.enabled = enabled;
    Logger.info('TOOLS', `${enabled ? '✅' : '❌'} أداة ${toolId} ${enabled ? 'مفعّلة' : 'معطّلة'}`);
  }

  /* ══ اختيار الأداة المناسبة لمهمة ══ */
  function selectFor(task) {
    const t = (task || '').toLowerCase();
    const candidates = [];
    _tools.forEach(tool => {
      if (!tool.enabled) return;
      let score = 0;
      if (tool.category === 'search'  && /بحث|search|ابحث|أحدث/.test(t))  score += 5;
      if (tool.category === 'code'    && /كود|code|تشغيل|run/.test(t))      score += 5;
      if (tool.category === 'image'   && /صورة|image|رسم/.test(t))          score += 5;
      if (tool.category === 'file'    && /ملف|file|zip|مشروع/.test(t))      score += 5;
      if (score > 0) candidates.push({ tool, score });
    });
    candidates.sort((a, b) => b.score - a.score);
    return candidates.map(c => c.tool);
  }

  /* ══ إحصاءات ══ */
  function getStats() {
    const out = [];
    _tools.forEach((tool, id) => {
      const s = _stats.get(id) || {};
      out.push({
        id, name: tool.name, enabled: tool.enabled,
        calls:   s.calls  || 0,
        errors:  s.errors || 0,
        avgMs:   s.calls  ? Math.round(s.totalMs / s.calls) : 0
      });
    });
    return out;
  }

  /* ══ قائمة جميع الأدوات ══ */
  function list() {
    const out = [];
    _tools.forEach(t => out.push(t));
    return out;
  }

  /* ══ تسجيل الأدوات المدمجة الافتراضية ══ */
  function _registerBuiltins() {
    /* أداة البحث */
    register({
      id: 'web_search', name: 'البحث على الإنترنت', category: 'search',
      description: 'بحث عبر DuckDuckGo وJina AI',
      run: async ({ query }) => {
        if (!query) throw new Error('يجب تحديد query');
        const url = `https://r.jina.ai/https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        const r = await fetch(url);
        const text = await r.text();
        return text.substring(0, 2000);
      }
    });

    /* أداة قراءة رابط */
    register({
      id: 'read_url', name: 'قراءة صفحة ويب', category: 'search',
      description: 'قراءة محتوى أي رابط عبر Jina AI Reader',
      run: async ({ url }) => {
        if (!url || !url.startsWith('http')) throw new Error('رابط غير صالح');
        const r = await fetch(`https://r.jina.ai/${url}`);
        const text = await r.text();
        return text.substring(0, 3000);
      }
    });

    /* أداة توليد صورة */
    register({
      id: 'image_gen', name: 'توليد صورة', category: 'image',
      description: 'توليد صورة عبر Pollinations AI',
      run: async ({ prompt, width = 512, height = 512 }) => {
        if (!prompt) throw new Error('يجب تحديد prompt');
        const encoded = encodeURIComponent(prompt);
        const url = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true`;
        return { imageUrl: url, prompt };
      }
    });

    /* أداة تشغيل كود */
    register({
      id: 'code_runner', name: 'تشغيل كود', category: 'code',
      description: 'تشغيل JavaScript في بيئة معزولة',
      run: async ({ code, lang = 'js' }) => {
        if (!code) throw new Error('يجب تحديد code');
        if (typeof Sandbox !== 'undefined') {
          return Sandbox.run(code);
        }
        throw new Error('Sandbox غير متاح');
      }
    });

    /* أداة تحليل ملف */
    register({
      id: 'file_analyzer', name: 'تحليل ملف/مشروع', category: 'file',
      description: 'تحليل ملفات وZIP وإنشاء خريطة المشروع',
      run: async ({ files }) => {
        if (!files || !files.length) throw new Error('يجب تحديد files');
        if (typeof ProjectAnalyzer !== 'undefined') {
          return ProjectAnalyzer.analyze(files);
        }
        return { error: 'ProjectAnalyzer غير متاح' };
      }
    });

    Logger.info('TOOLS', `🔧 ${_tools.size} أدوات مدمجة مسجّلة`);
  }

  /* تهيئة */
  _registerBuiltins();

  return { register, run, runParallel, toggle, selectFor, getStats, list };
})();
