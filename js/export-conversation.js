/* ══════════════════════════════════════════════
   export-conversation.js — تصدير المحادثة
   Galaoum AI Engine v6.0 — by عمار جلعوم
   ══════════════════════════════════════════════ */

window.ExportConversation = (function () {

  /* ─── جمع الرسائل الحالية من DOM ─── */
  function _getMessages() {
    const msgs = [];
    document.querySelectorAll('#chat-box > div').forEach(el => {
      const isUser = el.classList.contains('user-msg') || el.querySelector('[class*="user"]');
      const textEl = el.querySelector('.msg-content, .message-content, p, div') || el;
      const raw    = textEl.innerText || textEl.textContent || '';
      if (raw.trim()) msgs.push({ role: isUser ? 'user' : 'bot', text: raw.trim() });
    });
    /* fallback: localStorage */
    if (!msgs.length) {
      try {
        const mem = JSON.parse(localStorage.getItem('galaoum_memory') || '[]');
        mem.forEach(m => msgs.push({ role: m.role, text: m.content || '' }));
      } catch {}
    }
    return msgs;
  }

  /* ─── تصدير Markdown ─── */
  function exportMarkdown() {
    const msgs  = _getMessages();
    if (!msgs.length) { if (typeof Toast!=='undefined') Toast.warn('لا توجد رسائل للتصدير'); return; }
    const title = `# محادثة Galaoum AI — ${new Date().toLocaleDateString('ar-SA')}\n\n`;
    const body  = msgs.map(m =>
      m.role === 'user'
        ? `## 👤 المستخدم\n${m.text}\n`
        : `## 🤖 Galaoum AI\n${m.text}\n`
    ).join('\n---\n\n');
    _download(title + body, `galaoum-chat-${Date.now()}.md`, 'text/markdown');
    if (typeof Toast!=='undefined') Toast.success('تم تصدير المحادثة كـ Markdown');
  }

  /* ─── تصدير HTML ─── */
  function exportHTML() {
    const msgs  = _getMessages();
    if (!msgs.length) { if (typeof Toast!=='undefined') Toast.warn('لا توجد رسائل للتصدير'); return; }
    const rows  = msgs.map(m => {
      const isUser = m.role === 'user';
      return `<div style="display:flex;justify-content:${isUser?'flex-end':'flex-start'};margin:8px 0">
        <div style="max-width:75%;padding:12px 16px;border-radius:${isUser?'18px 18px 4px 18px':'18px 18px 18px 4px'};
          background:${isUser?'linear-gradient(135deg,#7c3aed,#5b21b6)':'rgba(255,255,255,.07)'};
          color:#e2e8f0;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word">
          ${m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;')}
        </div>
      </div>`;
    }).join('');
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head>
<meta charset="UTF-8"><title>محادثة Galaoum AI</title>
<style>body{background:#030008;color:#e2e8f0;font-family:system-ui,sans-serif;padding:24px;max-width:800px;margin:0 auto}</style>
</head><body>
<h1 style="color:#c4b5fd;margin-bottom:20px">🤖 Galaoum AI — ${new Date().toLocaleDateString('ar-SA')}</h1>
<div>${rows}</div></body></html>`;
    _download(html, `galaoum-chat-${Date.now()}.html`, 'text/html');
    if (typeof Toast!=='undefined') Toast.success('تم تصدير المحادثة كـ HTML');
  }

  /* ─── تصدير PDF عبر طباعة ─── */
  function exportPDF() {
    const msgs = _getMessages();
    if (!msgs.length) { if (typeof Toast!=='undefined') Toast.warn('لا توجد رسائل للتصدير'); return; }
    const rows = msgs.map(m => {
      const isUser = m.role === 'user';
      return `<div style="margin:12px 0;padding:12px 16px;
        border-right:4px solid ${isUser?'#7c3aed':'#3b82f6'};
        background:${isUser?'#f5f3ff':'#eff6ff'};border-radius:8px">
        <strong style="color:${isUser?'#7c3aed':'#1d4ed8'}">${isUser?'👤 المستخدم':'🤖 Galaoum AI'}</strong><br>
        <span style="font-size:13px;line-height:1.7;white-space:pre-wrap">${m.text.replace(/</g,'&lt;')}</span>
      </div>`;
    }).join('');
    const printWin = window.open('','_blank','width=800,height=600');
    if (!printWin) { if (typeof Toast!=='undefined') Toast.warn('السماح بالنوافذ المنبثقة لاستخدام تصدير PDF'); return; }
    printWin.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head>
<meta charset="UTF-8"><title>Galaoum Chat</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#111;max-width:750px;margin:0 auto}
@media print{button{display:none}}</style></head><body>
<h1 style="color:#7c3aed">🤖 محادثة Galaoum AI — ${new Date().toLocaleDateString('ar-SA')}</h1>
<p style="color:#666">${msgs.length} رسالة</p>
${rows}
<button onclick="window.print()" style="margin-top:20px;padding:10px 20px;background:#7c3aed;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px">🖨️ طباعة / حفظ PDF</button>
</body></html>`);
    printWin.document.close();
    if (typeof Toast!=='undefined') Toast.success('فُتح نافذة الطباعة — اختر "حفظ كـ PDF"');
  }

  /* ─── تصدير JSON (نسخة احتياطية) ─── */
  function exportJSON() {
    const msgs = _getMessages();
    const data = { exportDate: new Date().toISOString(), app: 'Galaoum AI Engine v6.0', messages: msgs };
    _download(JSON.stringify(data, null, 2), `galaoum-backup-${Date.now()}.json`, 'application/json');
    if (typeof Toast!=='undefined') Toast.success('تم التصدير كـ JSON');
  }

  /* ─── مساعد التنزيل ─── */
  function _download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* ─── لوحة التصدير ─── */
  let _panel = null;

  function openPanel() {
    if (!_panel) {
      _panel = document.createElement('div');
      _panel.innerHTML = `
        <div onclick="ExportConversation.closePanel()" style="
          position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);
          z-index:9100;display:flex;align-items:center;justify-content:center;padding:20px;
        ">
          <div onclick="event.stopPropagation()" style="
            width:100%;max-width:400px;
            background:linear-gradient(135deg,#0d0521,#07010f);
            border:1px solid rgba(124,58,237,.35);border-radius:18px;
            box-shadow:0 20px 60px rgba(0,0,0,.8);overflow:hidden;
          ">
            <div style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between">
              <span style="font-size:16px;font-weight:800;color:#c4b5fd">💾 تصدير المحادثة</span>
              <button onclick="ExportConversation.closePanel()" style="background:none;border:none;color:#64748b;font-size:18px;cursor:pointer">✕</button>
            </div>
            <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
              ${[
                ['📝','Markdown','.md','exportMarkdown','تنسيق نصي منظّم'],
                ['🌐','HTML','.html','exportHTML','صفحة ويب جاهزة'],
                ['🖨️','PDF','عبر الطباعة','exportPDF','احفظ كـ PDF من المتصفح'],
                ['💾','JSON','.json (نسخ احتياطي)','exportJSON','بيانات كاملة قابلة للاستعادة']
              ].map(([icon,label,ext,fn,desc]) => `
                <button onclick="ExportConversation.${fn}()" style="
                  display:flex;align-items:center;gap:12px;padding:14px 16px;
                  background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);
                  border-radius:12px;cursor:pointer;font-family:inherit;text-align:right;
                  transition:all .2s;
                " onmouseover="this.style.borderColor='rgba(124,58,237,.4)';this.style.background='rgba(124,58,237,.08)'"
                   onmouseout="this.style.borderColor='rgba(255,255,255,.09)';this.style.background='rgba(255,255,255,.04)'">
                  <span style="font-size:24px">${icon}</span>
                  <div>
                    <div style="font-size:14px;font-weight:700;color:#e2e8f0">${label} <span style="font-size:11px;color:#475569">${ext}</span></div>
                    <div style="font-size:11px;color:#475569;margin-top:2px">${desc}</div>
                  </div>
                </button>`
              ).join('')}
            </div>
          </div>
        </div>`;
      document.body.appendChild(_panel);
    }
    _panel.style.display = 'block';
  }

  function closePanel() {
    if (_panel) _panel.style.display = 'none';
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey||e.metaKey) && e.shiftKey && (e.key==='E'||e.key==='e')) {
        e.preventDefault(); openPanel();
      }
    });
  }

  return { init, openPanel, closePanel, exportMarkdown, exportHTML, exportPDF, exportJSON };
})();
