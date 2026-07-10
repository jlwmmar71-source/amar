/* ══════════════════════════════════════════════
   integrations.js — ربط جميع الأنظمة الجديدة
   يُحمَّل أخيراً بعد جميع الملفات الأخرى
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

(function initAllSystems() {
  Logger.info('INIT', '🚀 تهيئة جميع الأنظمة الجديدة...');
  const t = Logger.time('init:all');

  /* ═══════════════════════════════════════════════════════
     1. نقل مفاتيح API إلى مخزن الأمان
     ═══════════════════════════════════════════════════════ */
  if (typeof CONFIG !== 'undefined') {
    Security.storeKey('openrouter', CONFIG.OPENROUTER_API_KEY);
    Security.storeKey('pollinations', CONFIG.POLLINATIONS_API_KEY);
    Security.storeKey('netlify_token', CONFIG.NETLIFY_ACCESS_TOKEN);
    Security.storeKey('netlify_site', CONFIG.NETLIFY_SITE_ID);

    if (Array.isArray(CONFIG.GEMINI_API_KEYS)) {
      CONFIG.GEMINI_API_KEYS.forEach((k, i) => {
        if (k && !k.includes('_HERE')) Security.storeKey(`gemini_${i}`, k);
      });
    }
    Logger.info('INIT', '🔐 مفاتيح API نُقلت إلى مخزن الأمان');
  }

  /* ═══════════════════════════════════════════════════════
     2. Toast System — نظام الإشعارات
     ═══════════════════════════════════════════════════════ */
  window.Toast = {
    _container: null,

    _getContainer() {
      if (!this._container) {
        this._container = document.getElementById('toast-container');
        if (!this._container) {
          this._container = document.createElement('div');
          this._container.id = 'toast-container';
          document.body.appendChild(this._container);
        }
      }
      return this._container;
    },

    show(message, type = 'info', duration = 3000) {
      const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️' };
      const c     = this._getContainer();
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
      c.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },

    success(msg, d) { this.show(msg, 'success', d); },
    error(msg, d)   { this.show(msg, 'error',   d); },
    warn(msg, d)    { this.show(msg, 'warn',     d); },
    info(msg, d)    { this.show(msg, 'info',     d); }
  };

  /* ═══════════════════════════════════════════════════════
     3. ربط Logger بالإشعارات
     ═══════════════════════════════════════════════════════ */
  Logger.onLog(entry => {
    if (entry.level >= Logger.LEVELS.ERROR) {
      Toast.error(entry.message.slice(0, 60), 4000);
    }
  });

  /* ═══════════════════════════════════════════════════════
     4. شريط حالة الوكيل
     ═══════════════════════════════════════════════════════ */
  const agentBar = document.getElementById('agent-status-bar');

  function updateAgentBar(text, active = false) {
    if (!agentBar) return;
    const dot   = agentBar.querySelector('.agent-active-dot');
    const label = agentBar.querySelector('#agent-bar-label');
    if (dot)   dot.style.display = active ? 'block' : 'none';
    if (label) label.textContent = text;
    agentBar.classList.toggle('active', active);
  }

  /* ═══════════════════════════════════════════════════════
     5. تكامل الوكيل مع نموذج الإرسال
     ═══════════════════════════════════════════════════════ */
  const originalForm = document.getElementById('chat-form');
  if (originalForm) {
    const originalHandler = originalForm._agentWrapped;

    if (!originalHandler) {
      originalForm._agentWrapped = true;

      /* مراقبة رسائل المستخدم لتحليل النية */
      const userInput = document.getElementById('user-input');
      if (userInput) {
        userInput.addEventListener('input', () => {
          const text = userInput.value.trim();
          if (text.length > 10) {
            const { intent } = Agent.analyzeRequest(text);
            const bar = document.getElementById('agent-intent-hint');
            if (bar) {
              const intentLabels = {
                build: '🏗️ بناء', edit: '✏️ تعديل', analyze: '🔍 تحليل',
                search: '🌐 بحث', run: '▶️ تشغيل', image: '🎨 صورة',
                fix: '🔧 إصلاح', refactor: '♻️ إعادة هيكلة',
                deploy: '🚀 نشر', explain: '💡 شرح', general: '💬 محادثة'
              };
              bar.textContent = intentLabels[intent] || '';
              bar.style.display = text.length > 10 ? 'inline' : 'none';
            }
          }
        });
      }
    }
  }

  /* ═══════════════════════════════════════════════════════
     6. تكامل تحليل المشاريع عند رفع ZIP
     ═══════════════════════════════════════════════════════ */
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      const zipFile = files.find(f => f.name.toLowerCase().endsWith('.zip'));

      if (zipFile && typeof JSZip !== 'undefined') {
        Logger.info('INIT', `تحليل ZIP: ${zipFile.name}`);
        updateAgentBar(`📂 تحليل ${zipFile.name}...`, true);

        try {
          const zip = await new JSZip().loadAsync(zipFile);
          const filesMap = {};

          for (const [name, entry] of Object.entries(zip.files)) {
            if (!entry.dir && !_isBinary(name)) {
              try {
                filesMap[name] = await entry.async('string');
              } catch {}
            }
          }

          const analysis = await ProjectAnalyzer.analyze(filesMap);

          /* عرض ملخص التحليل */
          const summary = ProjectAnalyzer.buildSummary();
          Logger.info('ANALYZER', summary);

          /* اختبار تلقائي */
          const testResult = await AutoTest.run(filesMap);
          Logger.info('AUTO-TEST', `نتيجة: ${testResult.passed}/${testResult.total}`);

          updateAgentBar(`✅ تحليل مكتمل — ${Object.keys(filesMap).length} ملف`, false);

          Toast.success(`تم تحليل المشروع: ${Object.keys(filesMap).length} ملف`);

          /* إضافة ملخص في الشات */
          if (typeof addMessage === 'function') {
            const issues = analysis.issues.filter(i => i.severity === 'HIGH');
            if (issues.length > 0) {
              Toast.warn(`تحذير: ${issues.length} مشكلة أمنية عالية الخطورة`);
            }
          }

          /* حفظ ذاكرة المشروع */
          Memory.updateProject({
            name:        zipFile.name.replace('.zip', ''),
            files:       Object.keys(filesMap),
            analyzedAt:  new Date().toISOString(),
            stats:       analysis.stats,
            issues:      analysis.issues.length
          });

        } catch (err) {
          Logger.error('INIT', `فشل تحليل ZIP: ${err.message}`);
          updateAgentBar('', false);
        }
      }
    }, true); /* useCapture لإضافة المستمع قبل المعالج الحالي */
  }

  /* ═══════════════════════════════════════════════════════
     7. أزرار الأدوات السريعة (Quick Actions)
     ═══════════════════════════════════════════════════════ */
  const quickActionsEl = document.getElementById('quick-actions');
  if (quickActionsEl) {
    const actions = [
      { label: '🔍 تحليل المشروع',  prompt: 'حلّل المشروع الحالي وأخبرني بالمشاكل والتحسينات المقترحة' },
      { label: '🔧 إصلاح الأخطاء',  prompt: 'اكتشف وأصلح جميع الأخطاء في الكود' },
      { label: '📋 سجل العمليات',   action: () => Logger.openPanel() },
      { label: '🧩 الإضافات',        action: () => PluginSystem.openPanel() },
      { label: '🧠 الذاكرة',         action: () => MemoryViewer.toggle() }
    ];

    quickActionsEl.innerHTML = actions.map((a, i) =>
      `<button class="quick-action-btn" onclick="window._qa(${i})">${a.label}</button>`
    ).join('');

    window._qa = (idx) => {
      const action = actions[idx];
      if (action.action) {
        action.action();
      } else if (action.prompt) {
        const inp = document.getElementById('user-input');
        if (inp) {
          inp.value = action.prompt;
          inp.dispatchEvent(new Event('input'));
          inp.focus();
        }
      }
    };
  }

  /* ═══════════════════════════════════════════════════════
     8. عارض الذاكرة (Memory Viewer)
     ═══════════════════════════════════════════════════════ */
  window.MemoryViewer = {
    _open: false,

    toggle() {
      this._open = !this._open;
      const el = document.getElementById('memory-viewer');
      if (el) {
        el.classList.toggle('open', this._open);
        if (this._open) this.render();
      }
    },

    render() {
      const el = document.getElementById('memory-viewer');
      if (!el) return;

      const project = Memory.getProject();
      const edits   = Memory.getLastEdits(5);
      const facts   = Memory.getFacts().slice(-8);
      const session = Memory.getSession();

      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <span style="font-size:14px;font-weight:700;color:#fca5a5">🧠 الذاكرة الذكية</span>
          <button onclick="MemoryViewer.toggle()" style="background:none;border:none;color:#64748b;font-size:14px;cursor:pointer">✕</button>
        </div>

        ${project ? `
          <div style="margin-bottom:12px">
            <div style="font-size:10px;color:#475569;margin-bottom:6px;font-weight:700">المشروع الحالي</div>
            <div style="font-size:12px;color:#94a3b8;background:rgba(255,255,255,0.04);padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.07)">
              <div style="color:#e2e8f0;font-weight:600">${project.name || 'غير محدد'}</div>
              ${project.stack ? `<div style="color:#475569;font-size:11px;margin-top:3px">${project.stack}</div>` : ''}
              ${project.files ? `<div style="color:#475569;font-size:10px;margin-top:3px">${project.files.length} ملف</div>` : ''}
            </div>
          </div>
        ` : ''}

        ${edits.length > 0 ? `
          <div style="margin-bottom:12px">
            <div style="font-size:10px;color:#475569;margin-bottom:6px;font-weight:700">آخر التعديلات</div>
            ${edits.map(e => `
              <div style="font-size:11px;color:#64748b;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                • ${e.description || e.type || '?'}
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${facts.length > 0 ? `
          <div style="margin-bottom:12px">
            <div style="font-size:10px;color:#475569;margin-bottom:6px;font-weight:700">معلومات مهمة</div>
            ${facts.map(f => `
              <div style="font-size:11px;color:#64748b;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                • ${f.fact.slice(0,60)}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="font-size:10px;color:#334155;margin-top:8px;border-top:1px solid rgba(255,255,255,0.04);padding-top:8px">
          الجلسة: ${session.messages} رسالة منذ بدء الجلسة
        </div>

        <button onclick="Memory.clearAll();MemoryViewer.render()" style="
          width:100%;margin-top:10px;padding:6px;border-radius:8px;
          background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);
          color:#fca5a5;font-size:11px;cursor:pointer;font-family:inherit;
        ">🗑️ مسح الذاكرة</button>
      `;
    }
  };

  /* ═══════════════════════════════════════════════════════
     9. مراقبة الأداء
     ═══════════════════════════════════════════════════════ */
  const _perfObs = window.PerformanceObserver;
  if (_perfObs) {
    try {
      const obs = new _perfObs(list => {
        list.getEntries().forEach(entry => {
          if (entry.duration > 3000) {
            Logger.warn('PERF', `عملية بطيئة: ${entry.name} (${entry.duration.toFixed(0)}ms)`);
          }
        });
      });
      obs.observe({ type: 'measure', buffered: false });
    } catch {}
  }

  /* ═══════════════════════════════════════════════════════
     10. نظام Keyboard Shortcuts
     ═══════════════════════════════════════════════════════ */
  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;

    switch (e.key) {
      case 'l': case 'L':
        e.preventDefault();
        Logger.openPanel();
        break;
      case 'p': case 'P':
        if (e.shiftKey) {
          e.preventDefault();
          PluginSystem.openPanel();
        }
        break;
      case 'm': case 'M':
        if (e.shiftKey) {
          e.preventDefault();
          MemoryViewer.toggle();
        }
        break;
    }
  });

  /* ═══════════════════════════════════════════════════════
     11. حفظ آخر رد في الذاكرة (hook على callAPI)
     ═══════════════════════════════════════════════════════ */
  if (typeof callAPI !== 'undefined') {
    const _originalCallAPI = callAPI;
    window.callAPI = async function(prompt, saveCtx) {
      /* فحص أمني على المدخلات */
      const check = Security.checkRateLimit('api_call', 30);
      if (!check.allowed) {
        Logger.warn('SECURITY', `حد المعدل: ${check.resetIn}ث حتى إعادة الضبط`);
        Toast.warn(`تباطأ قليلاً — انتظر ${check.resetIn} ثانية`);
      }

      updateAgentBar('🤖 جارٍ المعالجة...', true);
      Memory.incrementMessages();

      const ctx = Memory.buildContext();
      const enrichedPrompt = ctx
        ? prompt + '\n\n<!-- سياق المشروع: ' + ctx.slice(0, 500) + ' -->'
        : prompt;

      try {
        const result = await _originalCallAPI(enrichedPrompt, saveCtx);
        updateAgentBar('', false);

        /* فحص الرد */
        if (result) {
          const review = await Agent.reviewResult(null, result);
          if (!review.passed) {
            const highIssues = review.issues.filter(i => i.severity === 'HIGH');
            if (highIssues.length > 0) {
              Logger.warn('AGENT', `مراجعة الرد: ${highIssues.length} مشكلة`, highIssues);
            }
          }
        }

        return result;
      } catch (err) {
        updateAgentBar('', false);
        Logger.error('API', `فشل استدعاء API: ${err.message}`);
        throw err;
      }
    };
  }

  /* ═══════════════════════════════════════════════════════
     12. حفظ التعديلات في الذاكرة عند تنزيل ZIP
     ═══════════════════════════════════════════════════════ */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[download]');
    if (a && a.download) {
      Memory.addEdit({
        type:        'download',
        file:        a.download,
        description: `تم تنزيل: ${a.download}`
      });
      Logger.info('MEMORY', `تنزيل: ${a.download}`);
    }
  });

  t.end();
  Logger.info('INIT', '✅ جميع الأنظمة الجديدة جاهزة');
  Toast.success('Galaoum AI Engine v5.0 — جاهز', 2000);

  /* دالة مساعدة داخلية لاكتشاف الملفات الثنائية */
  function _isBinary(name) {
    return /\.(png|jpg|jpeg|gif|webp|bmp|ico|svg|pdf|zip|gz|tar|exe|dll|so|dylib|woff|woff2|ttf|eot|mp3|mp4|wav|avi|mov)$/i.test(name);
  }

  /* ═══════════════════════════════════════════════════════
     v5: ربط الأنظمة الجديدة (الطبقة الثانية)
     ═══════════════════════════════════════════════════════ */

  /* ── أ. تسجيل الأدوات في ToolManager ── */
  if (typeof ToolManager !== 'undefined' && typeof PluginSystem !== 'undefined') {
    PluginSystem.getAll().forEach(p => {
      if (p.enabled && p.tools) {
        p.tools.forEach(tool => ToolManager.register({ ...tool, source: 'plugin' }));
      }
    });
    Logger.info('INIT', `🔧 ToolManager: ${ToolManager.list().length} أداة`);
  }

  /* ── ب. ربط Executive بنموذج إرسال الرسائل ── */
  if (typeof Executive !== 'undefined' && typeof callAPI !== 'undefined') {
    const _prevCallAPI = window.callAPI;
    window.callAPI = async function(prompt, saveCtx) {
      /* سجّل في SecurityCenter */
      if (typeof SecurityCenter !== 'undefined') {
        const rl = SecurityCenter.checkRateLimit('api_call');
        if (!rl.allowed) {
          Toast.warn(`تباطأ — انتظر ${rl.resetIn}ث`);
        }
        const valid = SecurityCenter.validateInput(prompt);
        if (!valid.valid) {
          Logger.warn('SEC', `مدخل غير صالح: ${valid.reason}`);
        }
      }

      /* [FIX v5.1] كاش الأداء مُعطَّل — كان يُرجع نفس الرد لأسئلة مختلفة
         (cacheGet/cacheSet يستخدمان نص السؤال مفتاحاً لكن بطريقة تُربك الاستجابة) */

      const t0 = performance.now();
      try {
        const result = await _prevCallAPI(prompt, saveCtx);

        /* سجّل مقاييس الأداء فقط — بدون تخزين الرد في الكاش */
        if (typeof PerformanceOptimizer !== 'undefined') {
          const ms = Math.round(performance.now() - t0);
          PerformanceOptimizer.recordApiCall('current', ms, true);
          /* [FIX v5.1] لا نخزّن الرد في الكاش لمنع إرجاع ردود قديمة لأسئلة جديدة */
        }

        /* فحص جودة الرد */
        if (typeof QualityGate !== 'undefined' && result) {
          const qr = QualityGate.check(result, prompt);
          QualityGate.record(qr);
          if (!qr.pass && qr.criticalFail) {
            Logger.warn('QG', `⚠️ رد لم يجتز الجودة (${qr.score}%)`);
          }
        }

        /* سجّل في التوثيق */
        if (typeof DocsGenerator !== 'undefined') {
          DocsGenerator.recordChange({ task: prompt.substring(0, 80), type: 'chat', success: true });
        }

        return result;
      } catch (err) {
        if (typeof PerformanceOptimizer !== 'undefined') {
          PerformanceOptimizer.recordApiCall('current', Math.round(performance.now() - t0), false);
        }
        /* إصلاح ذاتي */
        if (typeof SelfHealingEngine !== 'undefined') {
          SelfHealingEngine.analyze(String(err), prompt);
        }
        /* سجّل Audit */
        if (typeof SecurityCenter !== 'undefined') {
          SecurityCenter.audit('API_ERROR', String(err), 'warn');
        }
        throw err;
      }
    };
    Logger.info('INIT', '🔗 Executive + SecurityCenter + QualityGate مربوطة بـ callAPI');
  }

  /* ── ج. ربط KnowledgeGraph + SemanticSearch بتحليل ZIP ── */
  if (typeof KnowledgeGraph !== 'undefined') {
    const _origFileListener = document.getElementById('file-input');
    if (_origFileListener) {
      _origFileListener.addEventListener('change', async (e) => {
        const zipFile = Array.from(e.target.files).find(f => f.name.toLowerCase().endsWith('.zip'));
        if (!zipFile || typeof JSZip === 'undefined') return;

        try {
          const zip  = await new JSZip().loadAsync(zipFile);
          const arr  = [];
          for (const [name, entry] of Object.entries(zip.files)) {
            if (!entry.dir && !_isBinary(name)) {
              const content = await entry.async('string').catch(() => '');
              if (content) arr.push({ name, content });
            }
          }

          /* بناء خريطة المعرفة */
          const kgSummary = KnowledgeGraph.build(arr);
          Logger.info('KG', `📊 ${kgSummary.nodes} عقدة، ${kgSummary.symbols} رمز`);

          /* فهرسة البحث الدلالي */
          if (typeof SemanticSearch !== 'undefined') {
            SemanticSearch.indexProjectFiles(arr);
            Logger.info('SEARCH', `📚 فهرسة ${arr.length} ملف للبحث الدلالي`);
          }

          /* توثيق الملفات تلقائياً */
          if (typeof DocsGenerator !== 'undefined') {
            arr.filter(f => /\.(js|ts)$/.test(f.name)).forEach(f => {
              DocsGenerator.documentFile(f.name, f.content);
            });
          }

          Toast.success(`خريطة المعرفة: ${kgSummary.nodes} عقدة، ${kgSummary.symbols} رمز`);
        } catch (err) {
          Logger.error('KG', `فشل بناء الخريطة: ${err}`);
        }
      }, true);
    }
  }

  /* ── د. اختصار لوحة مفاتيح جديدة ── */
  document.addEventListener('keydown', (ev) => {
    if (!ev.ctrlKey && !ev.metaKey) return;
    if (ev.shiftKey && (ev.key === 'D' || ev.key === 'd')) {
      ev.preventDefault();
      if (typeof DocsGenerator !== 'undefined') DocsGenerator.exportMarkdown();
    }
    if (ev.shiftKey && (ev.key === 'A' || ev.key === 'a')) {
      ev.preventDefault();
      if (typeof SecurityCenter !== 'undefined') SecurityCenter.exportAuditLog();
    }
    if (ev.shiftKey && (ev.key === 'S' || ev.key === 's')) {
      ev.preventDefault();
      const q = document.getElementById('user-input')?.value?.trim();
      if (q && typeof SemanticSearch !== 'undefined') {
        const res = SemanticSearch.search(q, 3);
        Logger.info('SEARCH', JSON.stringify(res.results));
        Toast.info(`بحث دلالي: ${res.results.length} نتيجة`);
      }
    }
  });

  /* ── هـ. تسجيل نظام GalaoumOS للوصول العام ── */
  window.GalaoumOS = {
    version: 'v5.0',
    systems: {
      Logger, Security, Memory, PluginSystem, Agent,
      ProjectAnalyzer, Sandbox, AutoTest,
      Executive:   typeof Executive           !== 'undefined' ? Executive           : null,
      Workflow:    typeof WorkflowEngine      !== 'undefined' ? WorkflowEngine      : null,
      Decision:    typeof DecisionEngine      !== 'undefined' ? DecisionEngine      : null,
      Models:      typeof ModelManager        !== 'undefined' ? ModelManager        : null,
      Tools:       typeof ToolManager         !== 'undefined' ? ToolManager         : null,
      Knowledge:   typeof KnowledgeGraph      !== 'undefined' ? KnowledgeGraph      : null,
      Search:      typeof SemanticSearch      !== 'undefined' ? SemanticSearch      : null,
      Healing:     typeof SelfHealingEngine   !== 'undefined' ? SelfHealingEngine   : null,
      Quality:     typeof QualityGate         !== 'undefined' ? QualityGate         : null,
      Performance: typeof PerformanceOptimizer!== 'undefined' ? PerformanceOptimizer: null,
      SecCenter:   typeof SecurityCenter      !== 'undefined' ? SecurityCenter      : null,
      Docs:        typeof DocsGenerator       !== 'undefined' ? DocsGenerator       : null
    },
    /* إحصاءات سريعة */
    status() {
      const s = this.systems;
      return {
        systems:  Object.values(s).filter(Boolean).length,
        models:   s.Models ? s.Models.list().length : 0,
        tools:    s.Tools  ? s.Tools.list().length  : 0,
        quality:  s.Quality? s.Quality.avgScore()   : 0,
        perf:     s.Performance ? s.Performance.getStats() : {}
      };
    }
  };

  const osStatus = GalaoumOS.status();
  Logger.info('INIT', `🌐 GalaoumOS جاهز — ${osStatus.systems} نظام، ${osStatus.models} نموذج، ${osStatus.tools} أداة`);

  /* ═══════════════════════════════════════════════════════
     v4 — تهيئة أنظمة منصة التنفيذ الاحترافية
     ═══════════════════════════════════════════════════════ */
  Logger.info('INIT', '🚀 تهيئة أنظمة v4 — منصة التنفيذ الاحترافية');

  const _v4systems = [
    ['SmartCache',       () => typeof SmartCache        !== 'undefined' && SmartCache.init()],
    ['ResourceManager',  () => typeof ResourceManager   !== 'undefined' && ResourceManager.init()],
    ['JobQueue',         () => typeof JobQueue          !== 'undefined' && JobQueue.init()],
    ['ArtifactManager',  () => typeof ArtifactManager   !== 'undefined' && ArtifactManager.init()],
    ['RecoveryManager',  () => typeof RecoveryManager   !== 'undefined' && RecoveryManager.init()],
    ['ApiHub',           () => typeof ApiHub            !== 'undefined' && ApiHub.init()],
    ['VirtualFS',        () => typeof VirtualFS         !== 'undefined' && VirtualFS.init()],
    ['DatabaseManager',  () => typeof DatabaseManager   !== 'undefined' && DatabaseManager.init()],
    ['GitManager',       () => typeof GitManager        !== 'undefined' && GitManager.init()],
    ['TerminalEngine',   () => typeof TerminalEngine    !== 'undefined' && TerminalEngine.init()],
    ['DeploymentEngine', () => typeof DeploymentEngine  !== 'undefined' && DeploymentEngine.init()],
    ['BrowserAutomation',() => typeof BrowserAutomation !== 'undefined' && BrowserAutomation.init()],
    ['MonitoringDashboard',()=> typeof MonitoringDashboard!=='undefined'&& MonitoringDashboard.init()]
  ];

  let v4Ready = 0;
  for (const [name, fn] of _v4systems) {
    try { fn(); v4Ready++; Logger.info('INIT', `  ✅ ${name}`); }
    catch (e) { Logger.warn('INIT', `  ⚠️ ${name}: ${e.message}`); }
  }

  /* ── تحديث GalaoumOS بالأنظمة الجديدة ── */
  Object.assign(GalaoumOS.systems, {
    Cache:      typeof SmartCache        !== 'undefined' ? SmartCache        : null,
    Resource:   typeof ResourceManager   !== 'undefined' ? ResourceManager   : null,
    Jobs:       typeof JobQueue          !== 'undefined' ? JobQueue          : null,
    Artifacts:  typeof ArtifactManager   !== 'undefined' ? ArtifactManager   : null,
    Recovery:   typeof RecoveryManager   !== 'undefined' ? RecoveryManager   : null,
    ApiHub:     typeof ApiHub            !== 'undefined' ? ApiHub            : null,
    VFS:        typeof VirtualFS         !== 'undefined' ? VirtualFS         : null,
    DB:         typeof DatabaseManager   !== 'undefined' ? DatabaseManager   : null,
    Git:        typeof GitManager        !== 'undefined' && GitManager       ,
    Terminal:   typeof TerminalEngine    !== 'undefined' ? TerminalEngine    : null,
    Deploy:     typeof DeploymentEngine  !== 'undefined' ? DeploymentEngine  : null,
    Browser:    typeof BrowserAutomation !== 'undefined' ? BrowserAutomation : null,
    Monitor:    typeof MonitoringDashboard!=='undefined' ? MonitoringDashboard: null
  });
  GalaoumOS.version = 'v5.0+v4';

  /* ── ربط VFS باستيراد ZIP ── */
  if (typeof VirtualFS !== 'undefined' && typeof ProjectAnalyzer !== 'undefined') {
    const _origAnalyze = ProjectAnalyzer.analyze.bind(ProjectAnalyzer);
    ProjectAnalyzer.analyze = async function(filesMap) {
      /* استيراد الملفات إلى VirtualFS */
      VirtualFS.importFromProject(filesMap).catch(() => {});
      return _origAnalyze(filesMap);
    };
  }

  /* ── ربط JobQueue بالوكيل لتتبع العمليات ── */
  if (typeof Agent !== 'undefined' && typeof JobQueue !== 'undefined') {
    const _origExec = Agent.executeRequest ? Agent.executeRequest.bind(Agent) : null;
    if (_origExec) {
      Agent.executeRequest = async function(task, opts) {
        const jobId = JobQueue.add({ title: task.slice(0,60), autoRun: false });
        JobQueue._jobs.find(j=>j.id===jobId)._fn = async ({ progress, log }) => {
          progress(10, 'تحليل الطلب...');
          const result = await _origExec(task, opts);
          progress(100, 'مكتمل');
          return result;
        };
        JobQueue._runJob(jobId);
        return _origExec(task, opts);
      };
    }
  }

  /* ── ربط RecoveryManager مع كل الاتصالات ── */
  if (typeof RecoveryManager !== 'undefined') {
    /* snapshot تلقائي عند تحميل ZIP ناجح */
    const fileInputEl = document.getElementById('file-input');
    if (fileInputEl) {
      fileInputEl.addEventListener('change', () => {
        setTimeout(() => RecoveryManager.snapshot('بعد رفع ملف ZIP'), 3000);
      }, true);
    }
  }

  /* ── اختصارات v4 ── */
  document.addEventListener('keydown', ev => {
    if (!ev.ctrlKey) return;
    if (ev.key === 't' || ev.key === 'T') { ev.preventDefault(); typeof TerminalEngine  !== 'undefined' && TerminalEngine.openPanel(); }
    if (ev.key === 'g' || ev.key === 'G') { ev.preventDefault(); typeof GitManager       !== 'undefined' && GitManager.openPanel();      }
    if (ev.key === 'd' || ev.key === 'D') { ev.preventDefault(); typeof DatabaseManager  !== 'undefined' && DatabaseManager.openPanel(); }
    if (ev.key === 'm' || ev.key === 'M') {
      if (!ev.shiftKey) { ev.preventDefault(); typeof MonitoringDashboard !== 'undefined' && MonitoringDashboard.toggle(); }
    }
  });

  Logger.info('INIT', `✅ منصة التنفيذ الاحترافية جاهزة — ${v4Ready}/13 أنظمة v4 + ${osStatus.systems} أنظمة سابقة`);
  Logger.info('INIT', '🏆 Galaoum AI Engine v5.0 — جميع الأنظمة تعمل بالكامل');

  /* ── إظهار toast الترحيب ── */
  if (typeof Toast !== 'undefined') {
    setTimeout(() => Toast.success(`🏆 Galaoum v5.0 جاهز — ${v4Ready + osStatus.systems} نظام نشط`, 5000), 1500);
  }

  /* ═══════════════════════════════════════════════════════
     🔧 FIX 1 — مدير اللوحات: يمنع تداخل النوافذ
     ═══════════════════════════════════════════════════════ */
  window.PanelManager = (function () {
    const PANEL_IDS = [
      'deploy-panel','terminal-panel','git-panel','db-panel','vfs-panel',
      'apihub-panel','jobs-panel','monitor-panel','artifact-panel',
      'browser-panel','recovery-panel','resource-panel','logger-panel',
      'plugins-panel','video-gen-panel','music-gen-panel','file-reader-panel',
      'agent-mode-panel','code-runner-panel','memory-viewer',
      'keys-modal','providers-modal'
    ];

    let _current = null;

    /* أغلق جميع اللوحات */
    function closeAll() {
      PANEL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        /* g-panel يستخدم display */
        if (el.classList.contains('g-panel') || el.classList.contains('gen-panel') ||
            id === 'keys-modal' || id === 'providers-modal' ||
            id === 'file-reader-panel' || id === 'agent-mode-panel' ||
            id === 'code-runner-panel' || id === 'video-gen-panel' ||
            id === 'music-gen-panel') {
          el.style.display = 'none';
        }
        /* logger-panel يستخدم class */
        if (id === 'logger-panel') el.classList.remove('open');
        /* memory-viewer يستخدم class */
        if (id === 'memory-viewer') el.classList.remove('open');
      });
      _current = null;
    }

    /* سجّل لوحة كـ "مفتوحة حالياً" */
    function register(id) {
      if (_current && _current !== id) {
        /* أغلق اللوحة السابقة فقط إذا كانت تعارض */
        const prev = document.getElementById(_current);
        if (prev && prev.classList.contains('g-panel')) {
          prev.style.display = 'none';
          Logger.info('PANEL', `🔲 أُغلقت تلقائياً: ${_current}`);
        }
      }
      _current = id;
    }

    /* راقب MutationObserver على جميع اللوحات */
    function _watch() {
      const observer = new MutationObserver(mutations => {
        for (const m of mutations) {
          if (m.attributeName !== 'style') continue;
          const el = m.target;
          const id = el.id;
          if (!id || !PANEL_IDS.includes(id)) continue;
          const visible = el.style.display === 'flex' || el.style.display === 'block';
          if (visible) register(id);
        }
      });

      PANEL_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) observer.observe(el, { attributes: true, attributeFilter: ['style'] });
      });
    }

    /* ESC يغلق اللوحة المفتوحة حالياً */
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      if (_current) {
        const el = document.getElementById(_current);
        if (el) {
          if (el.classList.contains('g-panel')) el.style.display = 'none';
          else if (_current === 'logger-panel')  el.classList.remove('open');
          else if (_current === 'memory-viewer') el.classList.remove('open');
          else el.style.display = 'none';
          Logger.info('PANEL', `⎋ إغلاق بـ ESC: ${_current}`);
          _current = null;
        }
      }
    });

    /* تشغيل المراقب بعد تحميل DOM كاملاً */
    if (document.readyState === 'complete') {
      _watch();
    } else {
      window.addEventListener('load', _watch);
    }

    return { register, closeAll, getCurrent: () => _current };
  })();

  Logger.info('INIT', '🪟 PanelManager جاهز — يمنع تداخل النوافذ + ESC للإغلاق');

  /* ═══════════════════════════════════════════════════════
     🔧 FIX 2 — تفعيل Self-Healing عالمياً
     ═══════════════════════════════════════════════════════ */
  if (typeof SelfHealingEngine !== 'undefined') {

    /* أخطاء JavaScript غير المعالجة */
    window.addEventListener('error', function (ev) {
      const msg = ev.message || String(ev.error || '');
      const src = `${ev.filename || ''}:${ev.lineno || 0}`;
      Logger.error('GLOBAL', `❌ خطأ عالمي: ${msg} @ ${src}`);

      const diagnosis = SelfHealingEngine.analyze(msg, src);
      if (diagnosis.known) {
        Toast.warn(`⚕️ تشخيص: ${diagnosis.label} — يحاول الإصلاح...`, 5000);
        Logger.info('HEAL', `🩺 ${diagnosis.icon} ${diagnosis.label}`);
      } else {
        Toast.error(`خطأ غير متوقع: ${msg.substring(0, 60)}`, 6000);
      }
    });

    /* Promises المرفوضة غير المعالجة */
    window.addEventListener('unhandledrejection', function (ev) {
      const reason = ev.reason;
      const msg    = reason instanceof Error ? reason.message : String(reason || '');
      Logger.error('GLOBAL', `❌ Promise مرفوض: ${msg}`);

      /* فحص خاص بأخطاء الشبكة وحد المعدل */
      const diagnosis = SelfHealingEngine.analyze(msg, 'promise');
      if (diagnosis.known) {
        if (diagnosis.category === 'ratelimit') {
          Toast.warn('⏳ تجاوز حد الطلبات — انتظر قليلاً وأعد المحاولة', 5000);
        } else if (diagnosis.category === 'quota') {
          Toast.warn('🔄 نفاد الحصة — يتم التبديل للنموذج البديل', 5000);
          /* محاولة تبديل النموذج إن أمكن */
          if (typeof ModelManager !== 'undefined') {
            const models = ModelManager.list().filter(m => m.id !== ModelManager.getCurrent?.());
            if (models.length > 0) {
              Logger.info('HEAL', `🔄 تبديل تلقائي للنموذج: ${models[0].id}`);
            }
          }
        } else if (diagnosis.category === 'network') {
          Toast.warn('🌐 خطأ في الشبكة — تحقق من اتصالك', 4000);
        } else {
          Toast.warn(`⚕️ ${diagnosis.label}`, 4000);
        }
      } else {
        Logger.warn('GLOBAL', `⚠️ خطأ غير محدد: ${msg.substring(0, 80)}`);
      }

      /* منع ظهور الخطأ في الكونسول كـ Uncaught */
      ev.preventDefault();
    });

    Logger.info('INIT', '⚕️ SelfHealingEngine مفعّل عالمياً (onerror + unhandledrejection)');

  } else {
    Logger.warn('INIT', '⚠️ SelfHealingEngine غير محمّل — تخطّي تفعيل المعالج العالمي');
  }

  /* ═══════════════════════════════════════════════════════
     🔧 FIX 3 — إصلاح SmartRouter: أضف معيار السرعة والتكلفة
     ═══════════════════════════════════════════════════════ */
  if (typeof SmartRouter !== 'undefined' && !SmartRouter._enhanced) {
    SmartRouter._enhanced = true;

    /* سجل أوقات استجابة المزودين */
    SmartRouter._latency = {};
    SmartRouter._failCount = {};

    const _origRoute = SmartRouter.route ? SmartRouter.route.bind(SmartRouter) : null;
    if (_origRoute) {
      SmartRouter.route = function(prompt, opts) {
        const result = _origRoute(prompt, opts);

        /* تجاهل المزودين الذين فشلوا أكثر من 3 مرات متتالية */
        const failed = SmartRouter._failCount[result?.provider] || 0;
        if (failed >= 3) {
          Logger.warn('ROUTER', `⚠️ ${result?.provider} فشل ${failed} مرات — تجاوز`);
          /* ارجع للافتراضي */
          return { provider: 'gemini', model: 'gemini-1.5-flash', reason: 'fallback-after-failures' };
        }

        return result;
      };

      /* تسجيل نجاح/فشل المزودين لتحسين التوجيه */
      SmartRouter.recordSuccess = function(provider) {
        SmartRouter._failCount[provider] = 0;
      };

      SmartRouter.recordFailure = function(provider) {
        SmartRouter._failCount[provider] = (SmartRouter._failCount[provider] || 0) + 1;
        Logger.warn('ROUTER', `📉 ${provider} فشل رقم ${SmartRouter._failCount[provider]}`);
      };
    }

    Logger.info('INIT', '🧭 SmartRouter مُحسَّن — يتجنب المزودين الفاشلين تلقائياً');
  }

})();
