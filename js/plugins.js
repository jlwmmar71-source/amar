/* ══════════════════════════════════════════════
   plugins.js — نظام البلاجنز (الإضافات)
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const PluginSystem = (() => {
  const _registry  = new Map();   /* name → plugin */
  const _hooks     = new Map();   /* hookName → [handlers] */
  const _disabled  = new Set();   /* أسماء المعطّلة */

  /* ═══════════════════════════════════════════════════════
     هيكل البلاجن المطلوب:
     {
       name:        'my-plugin',
       version:     '1.0.0',
       description: '...',
       author:      '...',
       hooks:       { 'before:send': fn, 'after:reply': fn, ... },
       tools:       [ { name, description, execute } ],
       init:        async () => {},
       destroy:     () => {}
     }
  ═══════════════════════════════════════════════════════ */

  /* ── تسجيل Hook ── */
  function _registerHook(hookName, fn, pluginName) {
    if (!_hooks.has(hookName)) _hooks.set(hookName, []);
    _hooks.get(hookName).push({ fn, plugin: pluginName, priority: 10 });
    Logger.debug('PLUGINS', `Hook مسجّل: ${hookName} ← ${pluginName}`);
  }

  /* ── تشغيل Hook ── */
  async function _runHook(hookName, context) {
    const handlers = _hooks.get(hookName) || [];
    let ctx = { ...context };

    for (const { fn, plugin } of handlers) {
      if (_disabled.has(plugin)) continue;
      try {
        const result = await fn(ctx);
        if (result !== undefined) ctx = { ...ctx, ...result };
      } catch (err) {
        Logger.error('PLUGINS', `خطأ في hook ${hookName} (${plugin}): ${err.message}`);
      }
    }
    return ctx;
  }

  return {

    /* ═══════════════════════════════════
       تسجيل بلاجن جديد
       ═══════════════════════════════════ */
    async register(plugin) {
      if (!plugin?.name) {
        Logger.error('PLUGINS', 'البلاجن يجب أن يحتوي على اسم');
        return false;
      }

      if (_registry.has(plugin.name)) {
        Logger.warn('PLUGINS', `بلاجن موجود بالفعل: ${plugin.name}`);
        return false;
      }

      /* تسجيل Hooks */
      if (plugin.hooks) {
        for (const [hookName, fn] of Object.entries(plugin.hooks)) {
          _registerHook(hookName, fn, plugin.name);
        }
      }

      /* تسجيل الأدوات */
      if (Array.isArray(plugin.tools)) {
        plugin.tools.forEach(tool => {
          Logger.debug('PLUGINS', `أداة مسجّلة: ${tool.name} ← ${plugin.name}`);
        });
      }

      /* تهيئة البلاجن */
      if (typeof plugin.init === 'function') {
        try {
          await plugin.init();
        } catch (err) {
          Logger.error('PLUGINS', `فشل تهيئة ${plugin.name}: ${err.message}`);
          return false;
        }
      }

      plugin._registeredAt = new Date().toISOString();
      _registry.set(plugin.name, plugin);
      Logger.info('PLUGINS', `✅ بلاجن مسجّل: ${plugin.name} v${plugin.version || '?'}`);
      return true;
    },

    /* ═══════════════════════════════════
       إلغاء تسجيل بلاجن
       ═══════════════════════════════════ */
    async unregister(name) {
      const plugin = _registry.get(name);
      if (!plugin) return false;

      if (typeof plugin.destroy === 'function') {
        try { await plugin.destroy(); } catch {}
      }

      /* إزالة Hooks */
      for (const [hookName, handlers] of _hooks.entries()) {
        _hooks.set(hookName, handlers.filter(h => h.plugin !== name));
      }

      _registry.delete(name);
      _disabled.delete(name);
      Logger.info('PLUGINS', `🗑️ تم إلغاء تسجيل: ${name}`);
      return true;
    },

    /* ═══════════════════════════════════
       تفعيل / تعطيل
       ═══════════════════════════════════ */
    enable(name)  { _disabled.delete(name);  Logger.info('PLUGINS', `✅ مفعّل: ${name}`); },
    disable(name) { _disabled.add(name);     Logger.info('PLUGINS', `⛔ معطّل: ${name}`); },

    /* ═══════════════════════════════════
       تشغيل Hook
       ═══════════════════════════════════ */
    async run(hookName, context = {}) {
      return _runHook(hookName, context);
    },

    /* ═══════════════════════════════════
       الأدوات المتاحة من جميع البلاجنز
       ═══════════════════════════════════ */
    getTools() {
      const tools = [];
      for (const [name, plugin] of _registry.entries()) {
        if (_disabled.has(name)) continue;
        if (Array.isArray(plugin.tools)) {
          tools.push(...plugin.tools.map(t => ({ ...t, _plugin: name })));
        }
      }
      return tools;
    },

    /* ═══════════════════════════════════
       تشغيل أداة بالاسم
       ═══════════════════════════════════ */
    async executeTool(toolName, args = {}) {
      for (const [pluginName, plugin] of _registry.entries()) {
        if (_disabled.has(pluginName)) continue;
        const tool = plugin.tools?.find(t => t.name === toolName);
        if (tool) {
          Logger.info('PLUGINS', `تشغيل أداة: ${toolName} (${pluginName})`);
          const t = Logger.time(`tool:${toolName}`);
          try {
            const result = await tool.execute(args);
            t.end();
            return { ok: true, result, tool: toolName, plugin: pluginName };
          } catch (err) {
            t.end();
            Logger.error('PLUGINS', `فشل أداة ${toolName}: ${err.message}`);
            return { ok: false, error: err.message, tool: toolName };
          }
        }
      }
      return { ok: false, error: `لا توجد أداة باسم: ${toolName}` };
    },

    /* ═══════════════════════════════════
       قائمة البلاجنز
       ═══════════════════════════════════ */
    list() {
      return [..._registry.values()].map(p => ({
        name:        p.name,
        version:     p.version || '?',
        description: p.description || '',
        author:      p.author || '',
        enabled:     !_disabled.has(p.name),
        tools:       (p.tools || []).map(t => t.name),
        hooks:       Object.keys(p.hooks || {}),
        registeredAt: p._registeredAt
      }));
    },

    /* ═══════════════════════════════════
       فتح لوحة إدارة البلاجنز
       ═══════════════════════════════════ */
    openPanel() {
      PluginsUI.open();
    }
  };
})();

/* ══════════════════════════════════════════════
   PluginsUI — واجهة إدارة البلاجنز
   ══════════════════════════════════════════════ */
const PluginsUI = (() => {
  let _panel = null;

  function _build() {
    const div = document.createElement('div');
    div.id = 'plugins-panel';
    div.innerHTML = `
      <div id="plugins-header">
        <span style="font-size:15px;font-weight:800;color:#fca5a5">🧩 إدارة الإضافات</span>
        <button onclick="PluginsUI.close()" style="background:none;border:none;color:#64748b;font-size:16px;cursor:pointer">✕</button>
      </div>
      <div id="plugins-body" style="padding:12px;overflow-y:auto;flex:1"></div>
    `;
    document.body.appendChild(div);
    return div;
  }

  return {
    open() {
      if (!_panel) _panel = _build();
      _panel.classList.add('open');
      this.refresh();
    },
    close() {
      if (_panel) _panel.classList.remove('open');
    },
    refresh() {
      const body = document.getElementById('plugins-body');
      if (!body) return;
      const plugins = PluginSystem.list();

      if (plugins.length === 0) {
        body.innerHTML = '<div style="text-align:center;color:#475569;padding:30px;font-size:13px">لا توجد إضافات مسجّلة بعد</div>';
        return;
      }

      body.innerHTML = plugins.map(p => `
        <div style="
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
          border-radius:12px;padding:14px;margin-bottom:10px;
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <span style="font-size:13px;font-weight:700;color:#e2e8f0">${p.name}</span>
              <span style="font-size:10px;color:#475569;margin-right:6px">v${p.version}</span>
            </div>
            <div style="display:flex;gap:6px">
              <button onclick="PluginSystem.${p.enabled ? 'disable' : 'enable'}('${p.name}');PluginsUI.refresh()" style="
                padding:3px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;
                background:${p.enabled ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)'};
                border:1px solid ${p.enabled ? 'rgba(239,68,68,0.3)' : 'rgba(74,222,128,0.3)'};
                color:${p.enabled ? '#fca5a5' : '#4ade80'};
              ">${p.enabled ? '⛔ تعطيل' : '✅ تفعيل'}</button>
              <button onclick="PluginSystem.unregister('${p.name}').then(()=>PluginsUI.refresh())" style="
                padding:3px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;
                background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#f87171;
              ">🗑️</button>
            </div>
          </div>
          <div style="font-size:11px;color:#64748b;margin-bottom:6px">${p.description}</div>
          ${p.tools.length ? `<div style="font-size:10px;color:#475569">🔧 أدوات: ${p.tools.join(', ')}</div>` : ''}
        </div>
      `).join('');
    }
  };
})();

/* ══════════════════════════════════════════════
   البلاجنز المدمجة (Built-in Plugins)
   ══════════════════════════════════════════════ */

/* بلاجن البحث الذكي */
PluginSystem.register({
  name: 'smart-search',
  version: '1.0.0',
  description: 'بحث ذكي في الإنترنت مع مقارنة المصادر والتحقق من الصحة',
  author: 'Galaoum AI',
  tools: [
    {
      name: 'web_search',
      description: 'البحث في الإنترنت وتلخيص النتائج',
      async execute({ query, maxResults = 5 }) {
        Logger.info('PLUGIN:SEARCH', `بحث عن: ${query}`);
        if (typeof searchWeb === 'function') {
          const results = await searchWeb(query);
          return { query, results: results?.slice(0, maxResults) || [], source: 'duckduckgo' };
        }
        return { error: 'محرك البحث غير متاح' };
      }
    },
    {
      name: 'read_url',
      description: 'قراءة محتوى رابط وتلخيصه',
      async execute({ url }) {
        Logger.info('PLUGIN:SEARCH', `قراءة رابط: ${url}`);
        if (!Security.isDomainAllowed(url)) {
          return { error: 'النطاق غير مسموح به' };
        }
        if (typeof readURL === 'function') {
          return await readURL(url);
        }
        return { error: 'قراءة الرابط غير متاحة' };
      }
    }
  ]
});

/* بلاجن تشغيل الكود */
PluginSystem.register({
  name: 'code-runner',
  version: '1.0.0',
  description: 'تشغيل الأكواد بأمان في بيئة معزولة',
  author: 'Galaoum AI',
  tools: [
    {
      name: 'run_code',
      description: 'تشغيل كود برمجي',
      async execute({ code, language }) {
        Logger.info('PLUGIN:CODE', `تشغيل كود ${language}`);
        const scan = Security.scanCode(code);
        if (!scan.safe && scan.riskLevel === 'HIGH') {
          Logger.warn('PLUGIN:CODE', 'كود خطير — تم الرفض');
          return { error: 'الكود يحتوي على أنماط خطيرة' };
        }
        if (typeof executeCode === 'function') {
          return await executeCode(code, language);
        }
        return { error: 'بيئة التشغيل غير متاحة' };
      }
    }
  ]
});

/* بلاجن توليد الصور */
PluginSystem.register({
  name: 'image-gen',
  version: '1.0.0',
  description: 'توليد صور باستخدام الذكاء الاصطناعي',
  author: 'Galaoum AI',
  tools: [
    {
      name: 'generate_image',
      description: 'توليد صورة من وصف نصي',
      async execute({ prompt, width = 1024, height = 1024 }) {
        Logger.info('PLUGIN:IMAGE', `توليد صورة: ${prompt.slice(0, 50)}...`);
        if (typeof generateImage === 'function') {
          return await generateImage(prompt, width, height);
        }
        return { error: 'توليد الصور غير متاح' };
      }
    }
  ]
});

Logger.info('SYSTEM', '✅ نظام البلاجنز جاهز');
