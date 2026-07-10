/* ══════════════════════════════════════════════════════════════
   tool-registry.js — سجل الأدوات الموحّد (Universal Tool Registry)
   تسجيل الأدوات، اكتشاف الجديدة، ربطها تلقائياً، إدارة الصلاحيات
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.ToolRegistry = (function () {

  const _tools = {}; /* { name: { fn, permissions, description } } */

  /* ── تسجيل أداة جديدة ── */
  function register(name, fn, opts = {}) {
    if (typeof fn !== 'function') throw new Error('الأداة يجب أن تكون دالة');
    _tools[name] = {
      fn,
      permissions: opts.permissions || [],
      description: opts.description || ''
    };
    if (typeof Logger !== 'undefined') Logger.info('TOOLS', `🔧 تم تسجيل الأداة: ${name}`);
  }

  /* ── استدعاء أداة مع فحص الصلاحيات ── */
  async function invoke(name, args, grantedPermissions = []) {
    const tool = _tools[name];
    if (!tool) throw new Error(`الأداة غير موجودة: ${name}`);
    const missing = tool.permissions.filter(p => !grantedPermissions.includes(p));
    if (missing.length) {
      throw new Error(`صلاحيات ناقصة لاستخدام ${name}: ${missing.join(', ')}`);
    }
    return await tool.fn(args);
  }

  function list() {
    return Object.entries(_tools).map(([name, t]) => ({
      name, description: t.description, permissions: t.permissions
    }));
  }

  function has(name) { return !!_tools[name]; }

  /* ── اكتشاف تلقائي: تسجيل أي دالة global مطابقة لنمط ToolXxx.run ── */
  function autoDiscover() {
    let found = 0;
    for (const key of Object.keys(window)) {
      if (/^Tool[A-Z]/.test(key) && window[key] && typeof window[key].run === 'function') {
        if (!has(key)) {
          register(key, window[key].run, { description: 'أداة مكتشفة تلقائياً' });
          found++;
        }
      }
    }
    return found;
  }

  return { register, invoke, list, has, autoDiscover };
})();
