/* ══════════════════════════════════════════════
   shortcuts-panel.js — لوحة الاختصارات الكاملة
   Galaoum AI Engine v6.0 — by عمار جلعوم
   ══════════════════════════════════════════════ */

window.ShortcutsPanel = (function () {
  let _panel = null;

  const SHORTCUTS = [
    { group: '⚡ الأوامر السريعة', items: [
      { keys: ['/', 'أمر'], desc: 'أوامر سريعة (/image /code /search ...)' },
      { keys: ['?'],         desc: 'فتح لوحة الاختصارات هذه' },
      { keys: ['Ctrl','K'],  desc: 'بحث في المحادثات' },
      { keys: ['Ctrl','E','⇧'], desc: 'تصدير المحادثة' },
    ]},
    { group: '🤖 الأنظمة', items: [
      { keys: ['Ctrl','L'],       desc: 'سجل العمليات' },
      { keys: ['Ctrl','⇧','P'],  desc: 'إدارة الإضافات' },
      { keys: ['Ctrl','⇧','M'],  desc: 'الذاكرة الذكية' },
      { keys: ['Ctrl','T'],       desc: 'Terminal' },
      { keys: ['Ctrl','G'],       desc: 'Git Manager' },
      { keys: ['Ctrl','D'],       desc: 'قاعدة البيانات' },
      { keys: ['Ctrl','M'],       desc: 'لوحة المراقبة' },
    ]},
    { group: '📋 النصوص والكود', items: [
      { keys: ['كود', '📋'],     desc: 'نسخ أي كتلة كود بنقرة واحدة' },
      { keys: ['Ctrl','⇧','D'],  desc: 'تصدير التوثيق' },
      { keys: ['Ctrl','⇧','A'],  desc: 'تصدير سجل الأمان' },
      { keys: ['Ctrl','⇧','S'],  desc: 'بحث دلالي في المشروع' },
    ]},
    { group: '🌐 Slash Commands', items: [
      { keys: ['/image'],     desc: 'توليد صورة فوراً' },
      { keys: ['/code'],      desc: 'كتابة كود بدون كشف نية' },
      { keys: ['/search'],    desc: 'بحث على الإنترنت' },
      { keys: ['/build'],     desc: 'بناء تطبيق كامل' },
      { keys: ['/translate'], desc: 'ترجمة نص' },
      { keys: ['/run'],       desc: 'تشغيل كود مباشرة' },
      { keys: ['/summarize'], desc: 'تلخيص نص' },
      { keys: ['/fix'],       desc: 'إصلاح كود' },
      { keys: ['/help'],      desc: 'عرض جميع الأوامر' },
    ]},
    { group: '⌨️ التنقل', items: [
      { keys: ['Esc'],        desc: 'إغلاق أي لوحة مفتوحة' },
      { keys: ['↑','↓'],     desc: 'تصفح سجل الأوامر في Terminal' },
    ]},
  ];

  function _build() {
    if (_panel) return;
    _panel = document.createElement('div');
    _panel.id = 'shortcuts-panel';

    const groups = SHORTCUTS.map(g => `
      <div style="margin-bottom:18px">
        <div style="font-size:12px;font-weight:800;color:#7c3aed;margin-bottom:8px;
          padding-bottom:5px;border-bottom:1px solid rgba(124,58,237,.2)">${g.group}</div>
        ${g.items.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;
            padding:6px 0;border-bottom:1px solid rgba(255,255,255,.03)">
            <span style="font-size:12px;color:#94a3b8">${s.desc}</span>
            <div style="display:flex;gap:4px;margin-right:8px">
              ${s.keys.map(k => `<kbd style="
                display:inline-block;padding:2px 7px;border-radius:5px;
                background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);
                color:#c4b5fd;font-family:monospace;font-size:11px;white-space:nowrap">${k}</kbd>`).join('<span style="color:#334155;font-size:10px;padding:0 2px">+</span>')}
            </div>
          </div>`).join('')}
      </div>`).join('');

    _panel.innerHTML = `
      <div onclick="ShortcutsPanel.close()" style="
        position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);
        z-index:9200;display:flex;align-items:center;justify-content:center;padding:20px;
      ">
        <div onclick="event.stopPropagation()" style="
          width:100%;max-width:700px;max-height:85vh;
          background:linear-gradient(135deg,#0d0521,#07010f);
          border:1px solid rgba(124,58,237,.35);border-radius:18px;
          box-shadow:0 20px 60px rgba(0,0,0,.85);display:flex;flex-direction:column;
        ">
          <div style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.07);
            display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:10px">
              <span style="font-size:22px">⌨️</span>
              <div>
                <div style="font-size:16px;font-weight:800;color:#c4b5fd">لوحة الاختصارات</div>
                <div style="font-size:11px;color:#475569">Galaoum AI Engine v6.0</div>
              </div>
            </div>
            <button onclick="ShortcutsPanel.close()" style="
              background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
              color:#64748b;width:34px;height:34px;border-radius:9px;cursor:pointer;font-size:16px">✕</button>
          </div>
          <div style="overflow-y:auto;padding:18px 20px;flex:1">${groups}</div>
          <div style="padding:10px 20px;border-top:1px solid rgba(255,255,255,.06);
            font-size:11px;color:#334155;text-align:center;flex-shrink:0">
            اضغط <kbd style="padding:1px 6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#94a3b8;font-family:monospace">?</kbd> أو <kbd style="padding:1px 6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:4px;color:#94a3b8;font-family:monospace">Esc</kbd> للإغلاق
          </div>
        </div>
      </div>`;

    document.body.appendChild(_panel);
  }

  function open() {
    _build();
    _panel.style.display = 'block';
  }

  function close() {
    if (_panel) _panel.style.display = 'none';
  }

  function toggle() {
    if (_panel?.style.display === 'block') close(); else open();
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '?') { e.preventDefault(); toggle(); }
      if (e.key === 'Escape') close();
    });
  }

  return { init, open, close, toggle };
})();
