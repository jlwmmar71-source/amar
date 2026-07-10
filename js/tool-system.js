/* ══════════════════════════════════════════════
   tool-system.js — نظام الأدوات المتكاملة
   Galaoum AI Engine v6.0 — by عمار جلعوم
   ══════════════════════════════════════════════ */

window.ToolSystem = (function () {

  /* ════════════════════════════════════════════
     تعريفات الأدوات (12 أداة)
     كل أداة: emoji, label, desc, schema, exec
     ════════════════════════════════════════════ */
  const _tools = {

    /* ─── 1. حساب رياضي ─── */
    calculate: {
      emoji: '🔢', label: 'حساب رياضي',
      desc:   'تقييم معادلة أو عملية حسابية (دعم: + - * / ** % sqrt log sin cos)',
      schema: '{"expr":"2*(3+4)**2"}',
      exec: async ({ expr }) => {
        if (!expr) throw new Error('expr مطلوب');

        /* الخطوة 1: تحويل الاختصارات والدوال إلى Math.xxx */
        const FN_MAP = [
          /* الترتيب: الأطول أولاً لتجنب التداخل */
          ['log10(', 'Math.log10('], ['log2(',  'Math.log2(' ],
          ['log(',   'Math.log('  ], ['sqrt(',  'Math.sqrt(' ],
          ['cbrt(',  'Math.cbrt(' ], ['asin(',  'Math.asin(' ],
          ['acos(',  'Math.acos(' ], ['atan(',  'Math.atan(' ],
          ['sin(',   'Math.sin('  ], ['cos(',   'Math.cos('  ],
          ['tan(',   'Math.tan('  ], ['abs(',   'Math.abs('  ],
          ['floor(', 'Math.floor('], ['ceil(',  'Math.ceil(' ],
          ['round(', 'Math.round('], ['pow(',   'Math.pow('  ],
          ['max(',   'Math.max('  ], ['min(',   'Math.min('  ],
          ['exp(',   'Math.exp('  ],
          /* رموز خاصة */
          ['√(', 'Math.sqrt('], ['π',  'Math.PI'], ['^', '**']
        ];
        let safe = String(expr);
        for (const [from, to] of FN_MAP) safe = safe.split(from).join(to);

        /* ثوابت منفردة */
        safe = safe
          .replace(/√(\d+\.?\d*)/g, 'Math.sqrt($1)')
          .replace(/\bPI\b/g, 'Math.PI')
          .replace(/\bE\b/g,  'Math.E' );

        /* الخطوة 2: فحص أمان — بعد إزالة Math.xxx يجب أن يبقى فقط:
           أرقام، عوامل حسابية، أقواس، فراغات، نقطة عشرية، فاصلة */
        const stripped = safe.replace(/Math\.\w+/g, '0');
        const dangerous = stripped.match(/[^0-9\s+\-*/%().,'",]/);
        if (dangerous) {
          throw new Error('رمز غير مسموح به في المعادلة: "' + dangerous[0] + '"');
        }

        /* الخطوة 3: التنفيذ في scope معزول */
        // eslint-disable-next-line no-new-func
        const fn  = new Function('Math', '"use strict"; return (' + safe + ');');
        const res = fn(Math);
        if (typeof res !== 'number' || !isFinite(res)) {
          throw new Error('نتيجة غير صالحة: ' + String(res));
        }
        return { result: res, expr, formatted: res.toLocaleString('ar-SA') };
      }
    },

    /* ─── 2. بحث على الإنترنت ─── */
    search: {
      emoji: '🌐', label: 'بحث على الإنترنت',
      desc:   'البحث عن معلومات حديثة عبر الإنترنت',
      schema: '{"query":"أحدث أخبار الذكاء الاصطناعي 2025"}',
      exec: async ({ query }) => {
        if (!query) throw new Error('query مطلوب');
        if (typeof searchWeb !== 'function') throw new Error('نظام البحث غير متاح');
        const results = await searchWeb(query);
        return (results || 'لا نتائج').substring(0, 2000);
      }
    },

    /* ─── 3. جلب محتوى رابط ─── */
    fetch_url: {
      emoji: '🔗', label: 'جلب محتوى رابط',
      desc:   'قراءة محتوى أي صفحة ويب أو مستند عبر الإنترنت',
      schema: '{"url":"https://example.com/article"}',
      exec: async ({ url }) => {
        if (!url) throw new Error('url مطلوب');
        if (!/^https?:\/\//i.test(url)) throw new Error('الرابط يجب أن يبدأ بـ http أو https');
        /* محاولة 1: readURL المدمجة في المشروع */
        if (typeof readURL === 'function') {
          const c = await readURL(url);
          if (c) return c.substring(0, 2500);
        }
        /* محاولة 2: Jina AI Reader */
        const res  = await fetch('https://r.jina.ai/' + url, {
          headers: { Accept: 'text/plain' },
          signal:  typeof AbortSignal !== 'undefined' && AbortSignal.timeout
                    ? AbortSignal.timeout(15000) : undefined
        });
        const text = await res.text();
        return (text || 'لا محتوى').substring(0, 2500);
      }
    },

    /* ─── 4. تشغيل كود برمجي ─── */
    run_code: {
      emoji: '▶', label: 'تشغيل كود',
      desc:   'تنفيذ كود Python أو JavaScript أو C++ أو Rust وغيرها',
      schema: '{"lang":"python","code":"print(sum(range(1,101)))"}',
      exec: async ({ lang, code }) => {
        if (!lang || !code) throw new Error('lang و code مطلوبان');
        if (typeof executeCode !== 'function') throw new Error('مشغّل الكود غير متاح');
        const r = await executeCode(lang, code);
        return {
          output:   (r.output   || '').substring(0, 1000),
          stderr:   (r.stderr   || '').substring(0, 500),
          exitCode: r.exitCode,
          language: r.language || lang,
          version:  r.version  || '',
          ok:       r.exitCode === 0
        };
      }
    },

    /* ─── 5. الوقت والتاريخ ─── */
    datetime: {
      emoji: '📅', label: 'الوقت والتاريخ',
      desc:   'الحصول على التاريخ والوقت الحاليين ومعلومات التوقيت',
      schema: '{}',
      exec: async () => {
        const n   = new Date();
        const DAY = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
        const MON = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                     'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
        return {
          dateISO:   n.toISOString().split('T')[0],
          timeLocal: n.toTimeString().split(' ')[0],
          dayAr:     DAY[n.getDay()],
          monthAr:   MON[n.getMonth()],
          year:      n.getFullYear(),
          unix:      Math.floor(Date.now() / 1000),
          timezone:  Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale_ar: n.toLocaleString('ar-SA', {
            weekday:'long', year:'numeric', month:'long', day:'numeric',
            hour:'2-digit', minute:'2-digit'
          })
        };
      }
    },

    /* ─── 6. قراءة الذاكرة ─── */
    memory_read: {
      emoji: '🧠', label: 'قراءة الذاكرة',
      desc:   'استرداد المعلومات والسياق المحفوظ من الجلسات السابقة',
      schema: '{}',
      exec: async () => {
        const data = {};
        /* MemoryEnhanced */
        if (typeof MemoryEnhanced !== 'undefined') {
          try { Object.assign(data, MemoryEnhanced.getAll ? MemoryEnhanced.getAll() : {}); } catch {}
        }
        /* ملاحظات مخصصة */
        try {
          const raw = localStorage.getItem('galaoum_agent_notes');
          if (raw) data.notes = JSON.parse(raw);
        } catch {}
        /* سياق المحادثة الحالية */
        try {
          const convs = JSON.parse(localStorage.getItem('galaoum_convs') || '[]');
          const active = localStorage.getItem('galaoum_active_conv');
          const cur = convs.find(c => c.id === active);
          if (cur && cur.messages) {
            data.currentConversationSummary = cur.messages.slice(-4).map(m =>
              (m.sender === 'user' ? 'المستخدم: ' : 'AI: ') +
              (m.html || '').replace(/<[^>]+>/g, '').substring(0, 100)
            ).join('\n');
          }
        } catch {}
        return Object.keys(data).length ? data : { info: 'لا توجد ذكريات محفوظة بعد' };
      }
    },

    /* ─── 7. كتابة في الذاكرة ─── */
    memory_write: {
      emoji: '💾', label: 'حفظ في الذاكرة',
      desc:   'حفظ معلومة مهمة أو حقيقة في الذاكرة الدائمة',
      schema: '{"key":"اسم الموضوع","value":"المعلومة المهمة"}',
      exec: async ({ key, value }) => {
        if (!key || value === undefined) throw new Error('key و value مطلوبان');
        if (typeof saveMemory === 'function') saveMemory(String(key), String(value));
        try {
          const raw   = JSON.parse(localStorage.getItem('galaoum_agent_notes') || '{}');
          raw[key]    = { value: String(value), ts: new Date().toISOString() };
          localStorage.setItem('galaoum_agent_notes', JSON.stringify(raw));
        } catch {}
        return { saved: true, key, value };
      }
    },

    /* ─── 8. توليد صورة ─── */
    generate_image: {
      emoji: '🖼️', label: 'توليد صورة',
      desc:   'توليد صورة احترافية بالذكاء الاصطناعي من وصف نصي',
      schema: '{"prompt":"a futuristic city at night, cinematic lighting, 4k"}',
      exec: async ({ prompt }) => {
        if (!prompt) throw new Error('prompt مطلوب');
        if (typeof generateImage !== 'function') throw new Error('مولّد الصور غير متاح');
        const url = await generateImage(prompt);
        if (!url) throw new Error('لم يتم إرجاع رابط الصورة');
        return { url, prompt };
      }
    },

    /* ─── 9. تدوين ملاحظة ─── */
    note: {
      emoji: '📝', label: 'تدوين ملاحظة',
      desc:   'حفظ ملاحظة أو قائمة مهام سريعة للرجوع إليها لاحقاً',
      schema: '{"content":"الملاحظة أو المهمة المراد حفظها","tag":"اختياري"}',
      exec: async ({ content, tag }) => {
        if (!content) throw new Error('content مطلوب');
        try {
          const raw   = JSON.parse(localStorage.getItem('galaoum_notes_list') || '[]');
          raw.unshift({ content: String(content), tag: tag || '', ts: new Date().toISOString() });
          localStorage.setItem('galaoum_notes_list', JSON.stringify(raw.slice(0, 100)));
        } catch {}
        if (typeof Toast !== 'undefined') Toast.success('📝 تم حفظ الملاحظة', 1500);
        return { saved: true, content, tag: tag || '' };
      }
    },

    /* ─── 10. استعلام قاعدة البيانات ─── */
    db_query: {
      emoji: '🗄️', label: 'استعلام قاعدة البيانات',
      desc:   'تنفيذ استعلام SQL على قاعدة البيانات المحلية (SQLite)',
      schema: '{"sql":"SELECT name FROM sqlite_master WHERE type=\'table\'"}',
      exec: async ({ sql }) => {
        if (!sql) throw new Error('sql مطلوب');
        if (typeof DatabaseManager === 'undefined') throw new Error('قاعدة البيانات غير متاحة — افتحها أولاً من الشريط الجانبي');
        const r = await DatabaseManager.query(sql);
        return { rows: (r.rows || []).slice(0, 30), rowCount: r.rowCount || 0, ms: r.ms || 0 };
      }
    },

    /* ─── 11. قراءة ملف ─── */
    file_read: {
      emoji: '📁', label: 'قراءة ملف',
      desc:   'قراءة محتوى ملف من نظام الملفات الافتراضي',
      schema: '{"path":"/src/index.js"}',
      exec: async ({ path }) => {
        if (!path) throw new Error('path مطلوب');
        if (typeof VirtualFS === 'undefined') throw new Error('نظام الملفات غير متاح');
        const file = await VirtualFS.readFile(path).catch(() => null);
        if (!file) throw new Error('الملف غير موجود: ' + path);
        const c = String(file.content || file);
        return { path, content: c.substring(0, 2000), size: c.length,
                 truncated: c.length > 2000 };
      }
    },

    /* ─── 12. معلومات النظام والمتصفح ─── */
    system_info: {
      emoji: '🌡️', label: 'معلومات النظام',
      desc:   'الحصول على معلومات المتصفح والجهاز والموارد المتاحة',
      schema: '{}',
      exec: async () => ({
        userAgent:  navigator.userAgent.substring(0, 100),
        language:   navigator.language,
        languages:  navigator.languages ? navigator.languages.join(', ') : navigator.language,
        online:     navigator.onLine,
        memory:     navigator.deviceMemory ? navigator.deviceMemory + 'GB RAM' : 'غير معروف',
        cores:      navigator.hardwareConcurrency || '?',
        screen:     screen.width + 'x' + screen.height + ' @ ' + (window.devicePixelRatio || 1) + 'x',
        viewport:   window.innerWidth + 'x' + window.innerHeight,
        timezone:   Intl.DateTimeFormat().resolvedOptions().timeZone,
        cookieEnabled: navigator.cookieEnabled,
        localStorage: (() => { try { return !!localStorage; } catch { return false; } })(),
        webGPU:     'gpu' in navigator ? 'متاح' : 'غير متاح'
      })
    }
  };

  /* ════════════════════════════════════════════
     System Prompt للـ AI — يُحقن في كل رسالة
     عند تفعيل وضع الأدوات
     ════════════════════════════════════════════ */
  function getSystemPrompt() {
    const toolList = Object.entries(_tools).map(([name, t]) =>
      `  • ${t.emoji} \`${name}\` — ${t.desc}\n` +
      `    مثال: \`{"name":"${name}","args":${t.schema}}\``
    ).join('\n\n');

    return `
══════════════════════════════════════════
🛠️  نظام الأدوات المتكاملة — Galaoum AI
══════════════════════════════════════════
يمكنك استدعاء أي أداة عند الحاجة بهذا الشكل الدقيق:

<tool_call>
{"name":"اسم_الأداة","args":{"مفتاح":"قيمة"}}
</tool_call>

الأدوات المتاحة (${Object.keys(_tools).length} أداة):
${toolList}

القواعد:
✦ استخدم الأداة فقط عند الحاجة الفعلية
✦ يمكن استخدام أدوات متعددة في رد واحد (ضعها تباعاً)
✦ انتظر نتيجة الأدوات قبل إعطاء الرد النهائي
✦ إذا كانت المعلومة متوفرة في ذاكرتك، لا تحتاج لأداة
✦ عند إنهاء الأدوات، اكتب ردك النهائي بدون <tool_call>
══════════════════════════════════════════`.trim();
  }

  /* ════════════════════════════════════════════
     تحليل استدعاءات الأدوات من رد AI
     يستخرج <tool_call>...</tool_call> ويحذفها من النص
     ════════════════════════════════════════════ */
  function parseToolCalls(text) {
    if (!text) return { text: '', calls: [] };

    const calls = [];
    const cleaned = text.replace(/<tool_call>([\s\S]*?)<\/tool_call>/gi, (_, inner) => {
      try {
        const obj = JSON.parse(inner.trim());
        const name = obj.name || obj.tool;
        if (name && _tools[name]) {
          calls.push({ name, args: obj.args || obj.arguments || {} });
        } else if (name) {
          /* أداة غير معروفة — نسجّلها كخطأ */
          calls.push({ name, args: obj.args || {}, unknown: true });
        }
      } catch {}
      return '';
    }).replace(/\n{3,}/g, '\n\n').trim();

    return { text: cleaned, calls };
  }

  /* ════════════════════════════════════════════
     تنفيذ أداة بالاسم والمعاملات
     ════════════════════════════════════════════ */
  async function execute(toolName, args) {
    const tool = _tools[toolName];
    if (!tool) throw new Error(`أداة غير موجودة: "${toolName}"`);

    const TIMEOUT = 35000;
    return Promise.race([
      tool.exec(args || {}),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error(`انتهت مهلة الأداة "${toolName}" (${TIMEOUT/1000}ث)`)), TIMEOUT)
      )
    ]);
  }

  /* ── مساعدات ── */
  function getToolInfo(name) { return _tools[name] || null; }
  function getAll()           { return { ..._tools }; }
  function listNames()        { return Object.keys(_tools); }

  return { getSystemPrompt, parseToolCalls, execute, getToolInfo, getAll, listNames };
})();
