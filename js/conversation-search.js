/* ══════════════════════════════════════════════
   conversation-search.js — بحث في المحادثات
   Galaoum AI Engine v6.0 — by عمار جلعوم
   ══════════════════════════════════════════════ */

window.ConversationSearch = (function () {

  let _panelEl = null;

  /* ─── تعقيم HTML لمنع XSS ─── */
  function _escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /* ─── تمييز النتيجة (تعمل على نص مُعقَّم فقط) ─── */
  function _highlight(escapedText, escapedQuery) {
    if (!escapedQuery) return escapedText;
    /* نعقّم نمط البحث أيضاً ثم نبحث في النص المعقّم */
    const cleanPattern = escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escapedText.replace(
      new RegExp('(' + cleanPattern + ')', 'gi'),
      '<mark style="background:rgba(124,58,237,.4);color:#e2e8f0;border-radius:3px;padding:0 2px">$1</mark>'
    );
  }

  /* ─── بناء اللوحة ─── */
  function _build() {
    if (_panelEl) return;
    _panelEl = document.createElement('div');
    _panelEl.id = 'conv-search-panel';
    _panelEl.innerHTML = `
      <div id="csp-overlay" onclick="ConversationSearch.close()" style="
        position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);
        z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding-top:80px;
      ">
        <div onclick="event.stopPropagation()" style="
          width:100%;max-width:640px;
          background:linear-gradient(135deg,#0d0521,#07010f);
          border:1px solid rgba(124,58,237,.35);border-radius:18px;
          box-shadow:0 20px 60px rgba(0,0,0,.8);overflow:hidden;
        ">
          <div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">🔍</span>
            <input id="csp-input" type="text" placeholder="ابحث في المحادثات..." autocomplete="off" style="
              flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);
              border-radius:10px;padding:9px 14px;color:#e2e8f0;font-size:14px;
              font-family:inherit;outline:none;direction:rtl;
            ">
            <button onclick="ConversationSearch.close()" style="
              background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
              color:#64748b;width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:14px;
            ">✕</button>
          </div>
          <div id="csp-stats" style="padding:8px 18px;font-size:11px;color:#475569;border-bottom:1px solid rgba(255,255,255,.04)"></div>
          <div id="csp-results" style="max-height:420px;overflow-y:auto;padding:8px 0"></div>
        </div>
      </div>`;
    document.body.appendChild(_panelEl);

    document.getElementById('csp-input')?.addEventListener('input', _debounce(_doSearch, 250));
    document.getElementById('csp-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  /* ─── جمع الرسائل من localStorage ─── */
  function _getAllMessages() {
    const results = [];
    try {
      const convRaw = localStorage.getItem('galaoum_conversations');
      if (convRaw) {
        const convs = JSON.parse(convRaw);
        if (Array.isArray(convs)) {
          convs.forEach(conv => {
            (conv.messages || []).forEach(msg => {
              const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
              if (content.trim()) results.push({
                convId:   String(conv.id || 'default'),
                convName: _escHtml(String(conv.name || 'محادثة')),
                role:     msg.role === 'user' ? 'user' : 'bot',
                content,
                time: msg.time || conv.updatedAt || ''
              });
            });
          });
        }
      }
      const memRaw = localStorage.getItem('galaoum_memory');
      if (memRaw) {
        const mem = JSON.parse(memRaw);
        if (Array.isArray(mem)) {
          mem.forEach(msg => {
            const content = String(msg.content || '').trim();
            if (content) results.push({ convId: 'default', convName: 'المحادثة', role: msg.role === 'user' ? 'user' : 'bot', content, time: '' });
          });
        }
      }
    } catch {}
    return results;
  }

  /* ─── تنفيذ البحث ─── */
  function _doSearch() {
    const query   = document.getElementById('csp-input')?.value?.trim() || '';
    const results = document.getElementById('csp-results');
    const stats   = document.getElementById('csp-stats');
    if (!results || !stats) return;

    if (!query || query.length < 2) {
      results.innerHTML = '<div style="text-align:center;padding:24px;color:#475569;font-size:13px">اكتب حرفين على الأقل للبحث</div>';
      stats.textContent = '';
      return;
    }

    const all     = _getAllMessages();
    const lower   = query.toLowerCase();
    const matched = all.filter(m => m.content.toLowerCase().includes(lower));

    stats.textContent = matched.length + ' نتيجة من ' + all.length + ' رسالة';

    if (!matched.length) {
      results.innerHTML = '<div style="text-align:center;padding:24px;color:#475569;font-size:13px">لا توجد نتائج</div>';
      return;
    }

    const escQuery = _escHtml(query);

    /* امسح القديم وأنشئ العناصر برمجياً لتجنب XSS في inline handlers */
    results.innerHTML = '';
    const fragment = document.createDocumentFragment();

    matched.slice(0, 50).forEach((m, i) => {
      /* استخرج مقطع حول الكلمة المبحوثة */
      const lc    = m.content.toLowerCase();
      const idx   = lc.indexOf(lower);
      const start = Math.max(0, idx - 80);
      const end   = Math.min(m.content.length, idx + 120);
      const raw   = (start > 0 ? '...' : '') + m.content.slice(start, end) + (end < m.content.length ? '...' : '');

      /* عقّم النص أولاً ثم أبرز النتيجة */
      const safeSnippet = _highlight(_escHtml(raw), escQuery);
      const icon        = m.role === 'user' ? '👤' : '🤖';

      const card = document.createElement('div');
      card.style.cssText = 'padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .15s';

      /* رأس البطاقة */
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:5px';
      header.innerHTML =
        `<span style="font-size:14px">${icon}</span>` +
        `<span style="font-size:11px;color:#7c3aed;font-weight:600">${m.convName}</span>` +
        (m.time
          ? `<span style="font-size:10px;color:#334155;margin-right:auto">${_escHtml(new Date(m.time).toLocaleDateString('ar-SA'))}</span>`
          : '');

      /* مقطع النص (HTML مُعقَّم + تمييز بـ <mark> فقط) */
      const snippet = document.createElement('div');
      snippet.style.cssText = 'font-size:12px;color:#94a3b8;line-height:1.6;word-break:break-word';
      snippet.innerHTML = safeSnippet; /* آمن: مصدره _escHtml + <mark> فقط */

      card.appendChild(header);
      card.appendChild(snippet);

      /* Hover */
      card.addEventListener('mouseenter', () => { card.style.background = 'rgba(124,58,237,.08)'; });
      card.addEventListener('mouseleave', () => { card.style.background = ''; });

      /* Click — convId يُمرَّر عبر closure وليس عبر HTML string */
      const convId = m.convId; /* قيمة خام — لا تدخل HTML أبداً */
      card.addEventListener('click', () => goTo(convId, i));

      fragment.appendChild(card);
    });

    results.appendChild(fragment);
  }

  /* ─── الانتقال للمحادثة ─── */
  function goTo(convId, msgIdx) {
    close();
    if (convId !== 'default' && typeof switchConversation === 'function') {
      switchConversation(convId);
    }
    setTimeout(() => {
      const chatBox = document.getElementById('chat-box');
      if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }, 300);
    if (typeof Toast !== 'undefined') Toast.info('تم الانتقال للمحادثة');
  }

  /* ─── فتح / إغلاق ─── */
  function open() {
    _build();
    _panelEl.style.display = 'block';
    setTimeout(() => document.getElementById('csp-input')?.focus(), 100);
    const all   = _getAllMessages();
    const stats = document.getElementById('csp-stats');
    if (stats) stats.textContent = all.length + ' رسالة محفوظة — ابدأ الكتابة للبحث';
    const results = document.getElementById('csp-results');
    if (results) results.innerHTML = '<div style="text-align:center;padding:24px;color:#475569;font-size:13px">🔍 ابحث في محادثاتك السابقة</div>';
  }

  function close() {
    if (_panelEl) _panelEl.style.display = 'none';
  }

  function _debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  function init() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F' || e.key === 'k' || e.key === 'K')) {
        const chatBox = document.getElementById('chat-box');
        if (chatBox) {
          if (_panelEl?.style.display === 'block') { e.preventDefault(); close(); }
          else { e.preventDefault(); open(); }
        }
      }
    });
  }

  return { init, open, close, goTo };
})();
