/* ══════════════════════════════════════════════════════════════
   workflow.js — محرك سير العمل (Workflow Engine)
   يحوّل أي طلب إلى مراحل مرتّبة: تحليل→تخطيط→تنفيذ→مراجعة→إصلاح→اختبار→إنهاء
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.WorkflowEngine = (function () {

  /* ══ الحالات الممكنة لكل مرحلة ══ */
  const STAGE_STATUS = { PENDING: 'pending', RUNNING: 'running', DONE: 'done', SKIPPED: 'skipped', FAILED: 'failed' };

  /* ══ تعريف مراحل Workflow ══ */
  const STAGE_DEFS = [
    {
      id: 'analyze',
      label: 'تحليل الطلب',
      icon: '🔍',
      run: async (ctx) => {
        const intent = typeof Agent !== 'undefined' ? Agent.detectIntent(ctx.task) : { type: 'general' };
        const hasProject = typeof Memory !== 'undefined' && !!Memory.getProject()?.name;
        return { intent, hasProject, taskLength: ctx.task.length, lang: detectLang(ctx.task) };
      }
    },
    {
      id: 'plan',
      label: 'وضع الخطة',
      icon: '📋',
      run: async (ctx) => {
        const { intent } = ctx.stageResults.analyze || {};
        const steps = _buildPlan(ctx.task, intent?.type || 'general', ctx.decision);
        return { steps, totalSteps: steps.length };
      }
    },
    {
      id: 'execute',
      label: 'تنفيذ المهمة',
      icon: '⚡',
      run: async (ctx) => {
        /* التنفيذ الفعلي يتم بواسطة api.js — هنا نُعدّ السياق فقط */
        const { intent, hasProject } = ctx.stageResults.analyze || {};
        const context = [];
        if (hasProject && typeof Memory !== 'undefined') {
          const proj = Memory.getProject();
          if (proj) context.push(`المشروع: ${proj.name} (${proj.type || 'غير محدد'})`);
        }
        if (typeof Memory !== 'undefined') {
          const facts = Memory.getFacts().slice(0, 3);
          facts.forEach(f => context.push(f));
        }
        return {
          contextAdded: context.length,
          contextLines: context,
          intentType:   intent?.type || 'general',
          readyForAPI:  true
        };
      }
    },
    {
      id: 'review',
      label: 'مراجعة النتيجة',
      icon: '👀',
      run: async (ctx) => {
        /* مراجعة النتيجة التي سيرجعها API */
        const apiResult = ctx.apiResponse || '';
        const issues = [];
        if (!apiResult || apiResult.trim().length < 5) issues.push('الرد فارغ أو قصير جداً');
        if (apiResult.includes('ERROR') || apiResult.includes('خطأ:')) issues.push('الرد يحتوي على رسالة خطأ');
        return { issues, hasIssues: issues.length > 0, responseLength: apiResult.length };
      }
    },
    {
      id: 'fix',
      label: 'إصلاح المشاكل',
      icon: '🔧',
      skip: (ctx) => {
        const review = ctx.stageResults.review;
        return !review?.hasIssues;
      },
      run: async (ctx) => {
        const { issues } = ctx.stageResults.review || {};
        if (!issues || issues.length === 0) return { fixed: 0 };
        if (typeof SelfHealingEngine !== 'undefined') {
          for (const issue of issues) SelfHealingEngine.analyze(issue, ctx.task);
        }
        return { fixed: issues.length, issues };
      }
    },
    {
      id: 'test',
      label: 'اختبار النتيجة',
      icon: '🧪',
      skip: (ctx) => {
        const analysis = ctx.stageResults.analyze;
        return !['build', 'edit', 'fix', 'refactor'].includes(analysis?.intent?.type);
      },
      run: async (ctx) => {
        if (typeof AutoTest !== 'undefined') {
          const code = _extractCode(ctx.apiResponse || '');
          if (code) {
            const result = AutoTest.checkJS(code);
            return { ran: true, passed: result.passed, errors: result.errors || [] };
          }
        }
        return { ran: false, skipped: 'لا يوجد كود للاختبار' };
      }
    },
    {
      id: 'finalize',
      label: 'الإنهاء',
      icon: '✅',
      run: async (ctx) => {
        /* حفظ في الذاكرة */
        if (typeof Memory !== 'undefined') {
          Memory.addEdit({
            task:    ctx.task.substring(0, 120),
            stages:  Object.keys(ctx.stageResults),
            success: true,
            ts:      Date.now()
          });
        }
        return { saved: true, timestamp: new Date().toISOString() };
      }
    }
  ];

  /* ═══════════════════════════════════════════════════════
     تشغيل Workflow كامل
     ═══════════════════════════════════════════════════════ */
  async function run(task, decision, parentOp) {
    const ctx = {
      task,
      decision:     decision || {},
      stageResults: {},
      apiResponse:  '',
      parentOp
    };

    const stages = [];
    _renderProgressBar(stages, STAGE_DEFS);

    for (const def of STAGE_DEFS) {
      const stage = { id: def.id, label: def.label, icon: def.icon, status: STAGE_STATUS.PENDING, result: null };
      stages.push(stage);

      /* فحص هل نتخطى هذه المرحلة */
      if (def.skip && def.skip(ctx)) {
        stage.status = STAGE_STATUS.SKIPPED;
        _renderProgressBar(stages, STAGE_DEFS);
        Logger.info('WFLOW', `⏭ تخطي مرحلة: ${def.label}`);
        continue;
      }

      stage.status = STAGE_STATUS.RUNNING;
      _renderProgressBar(stages, STAGE_DEFS);
      Logger.info('WFLOW', `▶ مرحلة: ${def.icon} ${def.label}`);

      try {
        const result = await def.run(ctx);
        stage.result = result;
        stage.status = STAGE_STATUS.DONE;
        ctx.stageResults[def.id] = result;
        _renderProgressBar(stages, STAGE_DEFS);
      } catch (err) {
        stage.status = STAGE_STATUS.FAILED;
        stage.error  = String(err);
        Logger.error('WFLOW', `✗ فشلت مرحلة ${def.label}: ${err}`);
        /* لا نوقف بقية المراحل إلا إذا كانت أساسية */
        if (['analyze', 'execute'].includes(def.id)) break;
      }
    }

    _clearProgressBar();
    return {
      stages,
      stageResults: ctx.stageResults,
      output:       ctx.apiResponse || null
    };
  }

  /* ── بناء خطة خطوات حسب نوع المهمة ── */
  function _buildPlan(task, intentType, decision) {
    const plans = {
      build:     ['فهم المتطلبات', 'تصميم البنية', 'كتابة الكود', 'اختبار الكود', 'مراجعة الجودة'],
      edit:      ['تحديد الملفات المتأثرة', 'تحليل الكود الحالي', 'تطبيق التعديل', 'اختبار التعديل'],
      analyze:   ['قراءة الملفات', 'استخراج الهيكل', 'تحليل المشاكل', 'إنشاء التقرير'],
      search:    ['صياغة استعلام البحث', 'البحث في المصادر', 'تجميع النتائج', 'تصفية وعرض'],
      fix:       ['تحديد الخطأ', 'تحليل السبب', 'تطبيق الإصلاح', 'التحقق من الحل'],
      image:     ['فهم الوصف', 'توليد الصورة', 'عرض النتيجة'],
      explain:   ['قراءة المحتوى', 'تبسيط الشرح', 'إضافة أمثلة'],
      refactor:  ['تحليل الكود', 'تحديد نقاط التحسين', 'إعادة الهيكلة', 'اختبار المخرجات'],
      general:   ['فهم الطلب', 'إعداد الإجابة', 'مراجعة الإجابة']
    };
    return (plans[intentType] || plans.general).map((s, i) => ({ step: i + 1, label: s, done: false }));
  }

  /* ── استخراج أول كود من نص ── */
  function _extractCode(text) {
    const m = text.match(/```(?:js|javascript|html|css)?\n([\s\S]+?)```/);
    return m ? m[1].trim() : null;
  }

  /* ── عرض شريط تقدم المراحل في الواجهة ── */
  function _renderProgressBar(stages, defs) {
    const bar = document.getElementById('workflow-progress');
    if (!bar) return;
    const icons = { pending: '⬜', running: '🔄', done: '✅', skipped: '⏭', failed: '❌' };
    bar.innerHTML = (stages.length ? stages : defs.map(d => ({ id: d.id, status: 'pending', icon: d.icon, label: d.label })))
      .map(s => `<span class="wf-step ${s.status}" title="${s.label}">${s.icon || ''}${icons[s.status] || ''}</span>`)
      .join('');
    bar.style.display = 'flex';
  }

  function _clearProgressBar() {
    const bar = document.getElementById('workflow-progress');
    if (bar) { bar.style.display = 'none'; bar.innerHTML = ''; }
  }

  /* ── كشف لغة النص ── */
  function detectLang(text) {
    return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
  }

  return { run, detectLang };
})();
