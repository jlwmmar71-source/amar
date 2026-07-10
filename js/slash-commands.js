/* ══════════════════════════════════════════════
   slash-commands.js — نظام الأوامر السريعة /
   Galaoum AI Engine v6.0 — by عمار جلعوم
   ══════════════════════════════════════════════ */

window.SlashCommands = (function () {

  /* ═══════ دوال مساعدة آمنة ═══════ */

  /* توليد صورة — يجرب مزودين متعددين */
  async function _genImage(prompt) {
    /* Pollinations AI — مجاني بدون مفتاح */
    const encoded = encodeURIComponent(prompt);
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=512&nologo=true&seed=${Date.now()}`;
    /* تحقق أن الصورة قابلة للتحميل */
    await new Promise((res, rej) => {
      const img = new Image();
      img.onload  = res;
      img.onerror = () => rej(new Error('فشل تحميل الصورة'));
      img.src = url;
    });
    return url;
  }

  /* بحث ويب آمن */
  async function _webSearch(query) {
    if (typeof searchWeb === 'function') return searchWeb(query);
    /* fallback: اطلب من AI الإجابة من معرفته */
    return `[بحث غير متاح — الإجابة من معرفة النموذج]\nالسؤال: ${query}`;
  }

  /* تحليل ملفات الرد */
  function _parseFiles(reply) {
    if (typeof parseFilesFromReply === 'function') return parseFilesFromReply(reply);
    /* fallback parser */
    const files = [];
    const re = /\[FILE:\s*([^\]]+)\]\s*([\s\S]*?)(?=\[FILE:|$)/g;
    let m;
    while ((m = re.exec(reply)) !== null) {
      if (m[1] && m[2]) files.push({ name: m[1].trim(), content: m[2].trim() });
    }
    return files;
  }

  /* تشغيل كود آمن — داخل iframe sandbox معزول عن الصفحة الرئيسية */
  async function _execCode(lang, code) {
    /* استخدام Code Runner الموجود إن توفّر */
    if (typeof executeCode === 'function') return executeCode(lang, code);

    /* تشغيل JS داخل iframe مُغلق (sandboxed) بدلاً من new Function مباشرة */
    if (lang === 'javascript' || lang === 'js') {
      return new Promise((resolve) => {
        const timeoutMs = 5000;
        const iframe = document.createElement('iframe');
        iframe.setAttribute('sandbox', 'allow-scripts'); /* لا DOM، لا storage، لا network */
        iframe.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
        document.body.appendChild(iframe);

        const logs = [];
        const timer = setTimeout(() => {
          cleanup();
          resolve({ exitCode: 1, stderr: '⏱ انتهت مهلة التشغيل (5 ثوانٍ)' });
        }, timeoutMs);

        function cleanup() { clearTimeout(timer); window.removeEventListener('message', handler); iframe.remove(); }
        function handler(e) {
          if (e.source !== iframe.contentWindow) return;
          cleanup();
          resolve(e.data);
        }
        window.addEventListener('message', handler);

        /* نُوصِّل المخرجات عبر postMessage لتجنب أي وصول للـ parent */
        const safeCode = `
          (function() {
            const logs = [];
            const c = { log: (...a) => logs.push(a.map(String).join(' ')), error: (...a) => logs.push('ERR: '+a.map(String).join(' ')), warn: (...a) => logs.push('WARN: '+a.map(String).join(' ')) };
            try {
              const fn = new Function('console', ${JSON.stringify(code)});
              fn(c);
              parent.postMessage({ exitCode: 0, output: logs.join('\\n') || '(لا مخرجات)' }, '*');
            } catch(e) {
              parent.postMessage({ exitCode: 1, stderr: e.message }, '*');
            }
          })();`;

        try {
          iframe.contentWindow.document.open();
          iframe.contentWindow.document.write('<script>' + safeCode + '</script>');
          iframe.contentWindow.document.close();
        } catch(e) {
          cleanup();
          resolve({ exitCode: 1, stderr: 'فشل إنشاء sandbox: ' + e.message });
        }
      });
    }

    return { exitCode: 1, stderr: 'تشغيل ' + lang + ' يتطلب Code Runner — يرجى فتح المحطة الطرفية في القائمة الجانبية' };
  }

  /* ═══════ تعريف جميع الأوامر ═══════ */
  const COMMANDS = {
    image: {
      icon: '🎨', label: 'توليد صورة',
      hint: '/image <وصف الصورة>',
      example: '/image غروب شمس على البحر بألوان دافئة',
      handler: async (args, addMsg, updateMsg) => {
        if (!args) { addMsg('bot', '🎨 استخدم: <code>/image وصف الصورة</code>'); return; }
        const id = addMsg('bot', '🎨 <span class="spin">⟳</span> جارٍ توليد الصورة...');
        try {
          const url = await _genImage(args);
          updateMsg(id,
            '🎨 <strong>تم توليد الصورة!</strong>' +
            '<div style="margin-top:10px"><img src="' + url + '" style="max-width:100%;border-radius:12px;border:1px solid rgba(124,58,237,.2)" ' +
            'onerror="this.outerHTML=\'<p style=color:#fca5a5>⚠️ فشل تحميل الصورة — جرّب وصفاً آخر</p>\'"></div>' +
            '<a href="' + url + '" download="galaoum_img.jpg" target="_blank" ' +
            'style="display:inline-block;margin-top:8px;padding:6px 14px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-size:13px">⬇️ تحميل</a>'
          );
        } catch (e) { updateMsg(id, '❌ فشل توليد الصورة: ' + e.message); }
      }
    },

    code: {
      icon: '💻', label: 'كتابة كود',
      hint: '/code <وصف ما تريد>',
      example: '/code دالة Python لحساب فيبوناتشي',
      handler: async (args, addMsg, updateMsg) => {
        if (!args) { addMsg('bot', '💻 استخدم: <code>/code وصف الكود</code>'); return; }
        const id = addMsg('bot', '💻 <span class="spin">⟳</span> جارٍ كتابة الكود...');
        try {
          if (typeof callAPI !== 'function') throw new Error('callAPI غير متاح');
          const reply = await callAPI('اكتب الكود التالي كاملاً بدون اختصار: ' + args, true);
          updateMsg(id, typeof renderMarkdown === 'function' ? renderMarkdown(reply) : reply);
        } catch (e) { updateMsg(id, '❌ خطأ: ' + e.message); }
      }
    },

    search: {
      icon: '🌐', label: 'بحث على الإنترنت',
      hint: '/search <موضوع البحث>',
      example: '/search أحدث أخبار الذكاء الاصطناعي',
      handler: async (args, addMsg, updateMsg) => {
        if (!args) { addMsg('bot', '🌐 استخدم: <code>/search موضوع البحث</code>'); return; }
        const id = addMsg('bot', '🌐 <span class="spin">⟳</span> جارٍ البحث...');
        try {
          const webData = await _webSearch(args);
          if (typeof callAPI !== 'function') throw new Error('callAPI غير متاح');
          const reply = await callAPI(
            args + '\n\nمعلومات من البحث:\n' + webData + '\n\nأجب بالعربية بشكل مفيد ومنظّم.', false
          );
          updateMsg(id, '🌐 <strong>نتائج البحث:</strong><br><br>' +
            (typeof renderMarkdown === 'function' ? renderMarkdown(reply) : reply));
        } catch (e) { updateMsg(id, '❌ فشل البحث: ' + e.message); }
      }
    },

    build: {
      icon: '🏗️', label: 'بناء تطبيق كامل',
      hint: '/build <وصف التطبيق>',
      example: '/build تطبيق قائمة مهام بـ HTML CSS JS',
      handler: async (args, addMsg, updateMsg) => {
        if (!args) { addMsg('bot', '🏗️ استخدم: <code>/build وصف التطبيق</code>'); return; }
        const id = addMsg('bot', '🏗️ <span class="spin">⟳</span> جارٍ بناء التطبيق...');
        try {
          if (typeof callAPI !== 'function') throw new Error('callAPI غير متاح');
          const prompt = `اكتب تطبيقاً كاملاً جاهزاً للنشر:\n${args}\n\nالمطلوب:\n- جميع الملفات كاملة مع [FILE: اسم_الملف]\n- كود يعمل مباشرة`;
          const reply  = await callAPI(prompt, false);
          const parsed = _parseFiles(reply);
          if (parsed.length > 0 && typeof JSZip !== 'undefined') {
            const z    = new JSZip();
            parsed.forEach(f => z.file(f.name, f.content));
            const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = 'app.zip';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            updateMsg(id,
              '🏗️ <strong>تم بناء التطبيق! ' + parsed.length + ' ملف</strong><br><br>' +
              (typeof renderMarkdown === 'function' ? renderMarkdown(reply.split('[FILE:')[0].trim()) : '') +
              '<br>📥 <strong>بدأ التنزيل تلقائياً</strong>'
            );
          } else {
            updateMsg(id, typeof renderMarkdown === 'function' ? renderMarkdown(reply) : reply);
          }
        } catch (e) { updateMsg(id, '❌ خطأ: ' + e.message); }
      }
    },

    translate: {
      icon: '🌍', label: 'ترجمة نص',
      hint: '/translate <النص> [to en/ar/fr/...]',
      example: '/translate Hello world to ar',
      handler: async (args, addMsg, updateMsg) => {
        if (!args) { addMsg('bot', '🌍 استخدم: <code>/translate النص</code>'); return; }
        const id     = addMsg('bot', '🌍 <span class="spin">⟳</span> جارٍ الترجمة...');
        const toLang = (args.match(/\bto\s+(ar|en|fr|de|es|tr|it|zh|ja|ko|ru)\b/i) || [])[1] || 'en';
        const langNames = { ar:'العربية', en:'الإنجليزية', fr:'الفرنسية', de:'الألمانية', es:'الإسبانية', tr:'التركية', it:'الإيطالية', zh:'الصينية', ja:'اليابانية', ko:'الكورية', ru:'الروسية' };
        const clean  = args.replace(/\bto\s+\w+\b/i, '').trim();
        try {
          if (typeof callAPI !== 'function') throw new Error('callAPI غير متاح');
          const reply = await callAPI('ترجم إلى ' + (langNames[toLang] || toLang) + ' فقط بدون شرح:\n\n' + clean, false);
          updateMsg(id, '🌍 <strong>الترجمة إلى ' + (langNames[toLang] || toLang) + ':</strong><br><br>' + reply.trim());
        } catch (e) { updateMsg(id, '❌ فشل الترجمة: ' + e.message); }
      }
    },

    run: {
      icon: '▶️', label: 'تشغيل كود',
      hint: '/run <الكود>',
      example: '/run console.log("Hello")',
      handler: async (args, addMsg, updateMsg) => {
        if (!args) { addMsg('bot', '▶️ استخدم: <code>/run الكود هنا</code>'); return; }
        const id   = addMsg('bot', '▶️ <span class="spin">⟳</span> جارٍ التشغيل...');
        const lang = /^(import |from |print\(|def |class )/.test(args) ? 'python' : 'javascript';
        try {
          const result = await _execCode(lang, args);
          const ok     = result.exitCode === 0;
          updateMsg(id,
            '▶️ <strong>(' + lang + ')</strong><br>' +
            '<div style="margin:8px 0;border-radius:8px;overflow:hidden;border:1px solid #3730a3">' +
            '<pre style="margin:0;padding:12px;background:' + (ok?'#0a1628':'#1a0a0a') + ';font-size:12px;color:' + (ok?'#d1fae5':'#fca5a5') + ';white-space:pre-wrap">' +
            ((result.output || result.stderr || 'لا يوجد مخرجات').replace(/</g,'&lt;').replace(/>/g,'&gt;')) +
            '</pre></div>' + (ok ? '✅ نجح التنفيذ' : '❌ انتهى بخطأ')
          );
        } catch (e) { updateMsg(id, '❌ خطأ: ' + e.message); }
      }
    },

    summarize: {
      icon: '📋', label: 'تلخيص نص',
      hint: '/summarize <النص>',
      example: '/summarize تاريخ الذكاء الاصطناعي',
      handler: async (args, addMsg, updateMsg) => {
        if (!args) { addMsg('bot', '📋 استخدم: <code>/summarize النص</code>'); return; }
        const id = addMsg('bot', '📋 <span class="spin">⟳</span> جارٍ التلخيص...');
        try {
          if (typeof callAPI !== 'function') throw new Error('callAPI غير متاح');
          const reply = await callAPI('لخّص في نقاط واضحة ومختصرة:\n\n' + args, false);
          updateMsg(id, '📋 <strong>الملخص:</strong><br><br>' + (typeof renderMarkdown==='function' ? renderMarkdown(reply) : reply));
        } catch (e) { updateMsg(id, '❌ خطأ: ' + e.message); }
      }
    },

    fix: {
      icon: '🔧', label: 'إصلاح كود',
      hint: '/fix <الكود الخاطئ>',
      example: '/fix funtion hello() { consol.log("hi") }',
      handler: async (args, addMsg, updateMsg) => {
        if (!args) { addMsg('bot', '🔧 استخدم: <code>/fix الكود الخاطئ</code>'); return; }
        const id = addMsg('bot', '🔧 <span class="spin">⟳</span> جارٍ الإصلاح...');
        try {
          if (typeof callAPI !== 'function') throw new Error('callAPI غير متاح');
          const reply = await callAPI('أصلح الأخطاء في الكود التالي واشرح ما تم إصلاحه:\n\n```\n' + args + '\n```', false);
          updateMsg(id, typeof renderMarkdown === 'function' ? renderMarkdown(reply) : reply);
        } catch (e) { updateMsg(id, '❌ خطأ: ' + e.message); }
      }
    },

    help: {
      icon: '❓', label: 'قائمة الأوامر',
      hint: '/help',
      example: '/help',
      handler: async (args, addMsg) => {
        const rows = Object.entries(COMMANDS).map(([cmd, c]) =>
          `<tr>
            <td style="padding:6px 10px;color:#c4b5fd;font-family:monospace;white-space:nowrap">/${cmd}</td>
            <td style="padding:6px 10px;color:#94a3b8">${c.icon} ${c.label}</td>
            <td style="padding:6px 10px;color:#475569;font-size:11px">${c.example}</td>
          </tr>`
        ).join('');
        addMsg('bot',
          '❓ <strong>الأوامر السريعة — Slash Commands</strong><br><br>' +
          '<table style="border-collapse:collapse;width:100%;font-size:13px">' +
          '<thead><tr>' +
          '<th style="padding:6px 10px;color:#7c3aed;text-align:right;border-bottom:1px solid rgba(124,58,237,.2)">الأمر</th>' +
          '<th style="padding:6px 10px;color:#7c3aed;text-align:right;border-bottom:1px solid rgba(124,58,237,.2)">الوظيفة</th>' +
          '<th style="padding:6px 10px;color:#7c3aed;text-align:right;border-bottom:1px solid rgba(124,58,237,.2)">مثال</th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table>' +
          '<br><small style="color:#334155">اكتب / في حقل الرسالة لرؤية الاقتراحات</small>'
        );
      }
    }
  };

  /* ═══════ واجهة اقتراحات الأوامر ═══════ */
  let _suggestEl = null;

  function _ensureSuggest() {
    if (_suggestEl) return;
    _suggestEl = document.createElement('div');
    _suggestEl.id = 'slash-suggest';
    _suggestEl.style.cssText = [
      'display:none;position:absolute;bottom:calc(100% + 6px);right:0;left:0',
      'background:linear-gradient(135deg,#0d0521,#07010f)',
      'border:1px solid rgba(124,58,237,.35);border-radius:14px',
      'box-shadow:0 8px 40px rgba(0,0,0,.6);z-index:500',
      'overflow:hidden;max-height:280px;overflow-y:auto'
    ].join(';');
    const form = document.getElementById('chat-form');
    if (form) { form.style.position = 'relative'; form.appendChild(_suggestEl); }
    else document.body.appendChild(_suggestEl);
  }

  function _showSuggestions(filter) {
    _ensureSuggest();
    const cmds = Object.entries(COMMANDS).filter(([k]) =>
      !filter || k.startsWith(filter.toLowerCase())
    );
    if (!cmds.length) { _hideSuggestions(); return; }
    _suggestEl.innerHTML = cmds.map(([cmd, c]) =>
      `<div class="slash-item" onclick="SlashCommands._pick('${cmd}')" style="
        display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;
        border-bottom:1px solid rgba(255,255,255,.04);
      " onmouseover="this.style.background='rgba(124,58,237,.15)'"
         onmouseout="this.style.background=''">
        <span style="font-size:18px">${c.icon}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#c4b5fd">/${cmd}</div>
          <div style="font-size:11px;color:#475569">${c.hint}</div>
        </div>
      </div>`
    ).join('');
    _suggestEl.style.display = 'block';
  }

  function _hideSuggestions() {
    if (_suggestEl) _suggestEl.style.display = 'none';
  }

  function _pick(cmd) {
    const inp = document.getElementById('user-input');
    if (inp) { inp.value = '/' + cmd + ' '; inp.focus(); }
    _hideSuggestions();
  }

  /* ═══════ معالجة الإدخال ═══════ */
  function _onInput(e) {
    const val = e.target.value;
    if (val === '/') _showSuggestions('');
    else if (val.startsWith('/') && !val.includes(' ')) _showSuggestions(val.slice(1));
    else _hideSuggestions();
  }

  /* ═══════ معالجة الإرسال ═══════ */
  function tryHandle(text) {
    if (!text.startsWith('/')) return false;
    const parts   = text.trim().split(/\s+/);
    const cmdName = parts[0].slice(1).toLowerCase();
    const args    = parts.slice(1).join(' ');
    const cmd     = COMMANDS[cmdName];
    if (!cmd) return false;

    const addMsg    = typeof window.addMessage    === 'function' ? window.addMessage    : () => 'id';
    const updateMsg = typeof window.updateMessage === 'function' ? window.updateMessage : () => {};
    cmd.handler(args, addMsg, updateMsg);
    return true;
  }

  /* ═══════ تهيئة ═══════ */
  function init() {
    const inp = document.getElementById('user-input');
    if (!inp) return;
    inp.addEventListener('input', _onInput);
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#slash-suggest') && !e.target.closest('#user-input')) _hideSuggestions();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') _hideSuggestions();
    });
  }

  return { init, tryHandle, _pick, COMMANDS };
})();
