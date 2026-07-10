/* ══════════════════════════════════════════════
   v6-init.js — تهيئة ميزات v6.0
   Galaoum AI Engine v6.0 — by عمار جلعوم

   يُحمَّل آخر ملف لضمان تحميل جميع وحدات v6
   ══════════════════════════════════════════════ */

window.addEventListener('load', function initV6Features() {

  /* تحقق بسيط أن Logger موجود */
  const log = typeof Logger !== 'undefined'
    ? (m) => Logger.info('V6', m)
    : (m) => console.log('[V6]', m);

  log('🆕 تهيئة ميزات v6.0...');

  /* ═══════════════════════════════════════════════════
     1. ⚡ Streaming Engine — Typewriter Effect
        يعترض updateMessage ويطبّق التأثير على الردود النهائية فقط
     ═══════════════════════════════════════════════════ */
  if (typeof StreamingEngine !== 'undefined') {
    log('⚡ StreamingEngine: جاهز');

    if (typeof window.updateMessage === 'function') {
      const _origUpdate = window.updateMessage;
      let _twBusy = false;

      window.updateMessage = function(id, html, extras) {
        /* تجاهل التأثير في الحالات التالية:
           - الـ streaming معطّل
           - Typewriter آخر شغّال (منع التداخل)
           - يوجد ملفات للتحميل (extras.downloads)
           - النص يحتوي دوّار تحميل (spinner)
           - النص قصير جداً (< 80 حرف = رسائل حالة وليس ردوداً) */
        const hasDownloads = extras && extras.downloads && extras.downloads.length > 0;
        const isSpinner = html && (html.includes('"spin"') || html.includes("class='spin'"));
        const isTooShort = !html || html.length < 80;

        if (!StreamingEngine.isEnabled() || _twBusy || hasDownloads || isSpinner || isTooShort) {
          return _origUpdate(id, html, extras);
        }

        /* ابحث عن فقاعة الرسالة وعنصر المحتوى */
        const el = document.getElementById(id);
        if (!el) return _origUpdate(id, html, extras);
        const contentEl = el.querySelector('.msg-bot');
        if (!contentEl) return _origUpdate(id, html, extras);

        /* ابدأ Typewriter بشكل غير متزامن (non-blocking) */
        _twBusy = true;
        contentEl.innerHTML = '';
        const chatBoxEl = document.getElementById('chat-box');
        const indicator = document.getElementById('streaming-indicator');
        if (indicator) indicator.classList.add('active');

        (async () => {
          try {
            const chunks = html.match(/.{1,5}/gs) || [html];
            let built = '';
            for (const chunk of chunks) {
              built += chunk;
              contentEl.innerHTML = built + '<span class="stream-cursor"></span>';
              if (chatBoxEl) chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
              await new Promise(r => setTimeout(r, 7));
            }
            contentEl.innerHTML = html;
          } finally {
            _twBusy = false;
            if (indicator) indicator.classList.remove('active');
            if (chatBoxEl) chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
            if (typeof saveChat === 'function') saveChat();
          }
        })();
        /* الدالة ترجع فوراً — الـ typewriter يكمل في الخلفية */
      };

      log('⚡ Typewriter مرتبط بـ updateMessage (فقط الردود النهائية)');
    }
  }

  /* ═══════════════════════════════════════════════════
     2. / Slash Commands
     ═══════════════════════════════════════════════════ */
  if (typeof SlashCommands !== 'undefined') {
    SlashCommands.init();
    log('⚡ SlashCommands: ' + Object.keys(SlashCommands.COMMANDS).length + ' أمر');

    const chatForm = document.getElementById('chat-form');
    if (chatForm && !chatForm._slashHooked) {
      chatForm._slashHooked = true;
      chatForm.addEventListener('submit', (e) => {
        const inp  = document.getElementById('user-input');
        if (!inp) return;
        const text = inp.value.trim();
        if (!text.startsWith('/')) return;

        e.preventDefault();
        e.stopImmediatePropagation();
        inp.value = '';
        inp.style.height = 'auto';
        if (typeof addMessage === 'function') addMessage('user', text);
        SlashCommands.tryHandle(text);
      }, true /* capture — قبل معالج الإرسال الأصلي */);
    }
  }

  /* ═══════════════════════════════════════════════════
     3. 🎨 Syntax Highlight + Copy Button
     ═══════════════════════════════════════════════════ */
  if (typeof SyntaxHighlight !== 'undefined') {
    SyntaxHighlight.init();
    log('🎨 SyntaxHighlight: مراقب رسائل الكود');
  }

  /* ═══════════════════════════════════════════════════
     4. 🔍 Conversation Search
     ═══════════════════════════════════════════════════ */
  if (typeof ConversationSearch !== 'undefined') {
    ConversationSearch.init();
    log('🔍 ConversationSearch: Ctrl+K');
  }

  /* ═══════════════════════════════════════════════════
     5. 💾 Export Conversation
     ═══════════════════════════════════════════════════ */
  if (typeof ExportConversation !== 'undefined') {
    ExportConversation.init();
    log('💾 ExportConversation: Ctrl+Shift+E');
  }

  /* ═══════════════════════════════════════════════════
     6. 🧠 Context Compress
     ═══════════════════════════════════════════════════ */
  if (typeof ContextCompress !== 'undefined') {
    ContextCompress.init();
    const stats = ContextCompress.getStats();
    log('🧠 ContextCompress: ' + stats.messages + ' رسالة ~' + stats.estTokens + ' token');
  }

  /* ═══════════════════════════════════════════════════
     7. 📱 PWA — تسجيل في GalaoumOS
     ═══════════════════════════════════════════════════ */
  if (typeof GalaoumOS !== 'undefined') {
    Object.assign(GalaoumOS.systems, {
      Streaming: typeof StreamingEngine    !== 'undefined' ? StreamingEngine    : null,
      Slash:     typeof SlashCommands      !== 'undefined' ? SlashCommands      : null,
      Highlight: typeof SyntaxHighlight    !== 'undefined' ? SyntaxHighlight    : null,
      Search:    typeof ConversationSearch !== 'undefined' ? ConversationSearch : null,
      Export:    typeof ExportConversation !== 'undefined' ? ExportConversation : null,
      Compress:  typeof ContextCompress    !== 'undefined' ? ContextCompress    : null,
      Shortcuts: typeof ShortcutsPanel     !== 'undefined' ? ShortcutsPanel     : null,
    });
    GalaoumOS.version = 'v6.0';
    log('🌐 GalaoumOS → v6.0 مُحدَّث');
  }

  /* ═══════════════════════════════════════════════════
     8. ⌨️ Shortcuts Panel
     ═══════════════════════════════════════════════════ */
  if (typeof ShortcutsPanel !== 'undefined') {
    ShortcutsPanel.init();
    log('⌨️ ShortcutsPanel: ? للفتح');
  }

  /* ═══════════════════════════════════════════════════
     اختصار Escape العام لإغلاق جميع لوحات v6
     ═══════════════════════════════════════════════════ */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (typeof ConversationSearch !== 'undefined') ConversationSearch.close();
    if (typeof ExportConversation !== 'undefined') ExportConversation.closePanel();
    if (typeof ShortcutsPanel     !== 'undefined') ShortcutsPanel.close();
  });

  /* ═══════════════════════════════════════════════════
     9. 💭 Thinking Engine — عرض كتل التفكير
        يعترض updateMessage ويعرض <think> قبل الرد
     ═══════════════════════════════════════════════════ */
  if (typeof ThinkingEngine !== 'undefined') {
    ThinkingEngine.setEnabled(true);
    ThinkingEngine.setAutoExpand(false);
    log('💭 ThinkingEngine: جاهز — يعرض <think> كـ كتل قابلة للطيّ');

    /* Wrap updateMessage لمعالجة كتل التفكير
       يعمل فقط في المحادثة العادية (خارج AgentLoop) */
    const _prevUpdate = window.updateMessage;
    if (typeof _prevUpdate === 'function') {
      window.updateMessage = function(id, html, extras) {
        /* تجاهل إذا: AgentLoop يتحكم في الرسالة، أو spinner، أو قصير جداً */
        if (typeof AgentLoop !== 'undefined' && AgentLoop.isEnabled()) {
          return _prevUpdate(id, html, extras);
        }
        const isSpinner = html && (html.includes('"spin"') || html.includes("class='spin'"));
        if (isSpinner || !html || html.length < 40) return _prevUpdate(id, html, extras);

        /* استخراج كتلة التفكير من HTML (إذا كان النص خاماً) */
        const { thinking, reply } = ThinkingEngine.parseThinking(html);
        if (!thinking) return _prevUpdate(id, html, extras);

        /* بناء HTML يشمل كتلة التفكير + الرد */
        const thinkBlock = ThinkingEngine.buildBlock(thinking, -1);
        const combined   = thinkBlock + (reply || '');
        return _prevUpdate(id, combined, extras);
      };
      log('💭 ThinkingEngine: مرتبط بـ updateMessage');
    }
  }

  /* ═══════════════════════════════════════════════════
     10. 🛠️ Tool System + Agent Loop
         يُهيَّأ بعد Thinking Engine
     ═══════════════════════════════════════════════════ */
  if (typeof AgentLoop !== 'undefined') {
    AgentLoop.init();
    const toolCount = typeof ToolSystem !== 'undefined'
      ? ToolSystem.listNames().length : 0;
    log(`🛠️ AgentLoop: جاهز — ${toolCount} أداة متاحة`);

    /* إضافة اختصار لوحة المفاتيح: Alt+T لتفعيل / تعطيل الأدوات */
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        AgentLoop.toggle();
      }
      /* Alt+Shift+T لفتح لوحة الأدوات */
      if (e.altKey && e.shiftKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        AgentLoop.openPanel();
      }
    });

    /* تسجيل في GalaoumOS */
    if (typeof GalaoumOS !== 'undefined') {
      GalaoumOS.systems.AgentLoop     = AgentLoop;
      GalaoumOS.systems.ThinkingEngine = ThinkingEngine;
      GalaoumOS.systems.ToolSystem     = typeof ToolSystem !== 'undefined' ? ToolSystem : null;
    }

    log('🛠️ اختصار: Alt+T لتفعيل الأدوات، Alt+Shift+T للوحة');
  }

  /* ─── تحقق من عدد الأنظمة المُهيَّأة ─── */
  const v6Systems = [
    'StreamingEngine', 'SlashCommands', 'SyntaxHighlight',
    'ConversationSearch', 'ExportConversation', 'ContextCompress', 'ShortcutsPanel',
    'ThinkingEngine', 'AgentLoop', 'ToolSystem'
  ];
  const ready = v6Systems.filter(s => typeof window[s] !== 'undefined').length;

  log('✅ v6.0 مُهيَّأ — ' + ready + '/' + v6Systems.length + ' نظام');

  if (typeof Toast !== 'undefined') {
    Toast.success('Galaoum AI Engine v6.0 ⚡ — ' + ready + ' ميزة جديدة', 2500);
  }
});
