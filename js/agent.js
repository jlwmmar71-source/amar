/* ══════════════════════════════════════════════
   agent.js — نظام الوكيل الذكي (AI Agent)
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const Agent = (() => {

  /* ── أنواع النوايا ── */
  const INTENT = {
    BUILD:       'build',        /* بناء تطبيق/صفحة */
    EDIT:        'edit',         /* تعديل كود */
    ANALYZE:     'analyze',      /* تحليل مشروع/ملف */
    SEARCH:      'search',       /* بحث في الإنترنت */
    RUN:         'run',          /* تشغيل كود */
    IMAGE:       'image',        /* توليد صورة */
    EXPLAIN:     'explain',      /* شرح/سؤال */
    FIX:         'fix',          /* إصلاح خطأ */
    REFACTOR:    'refactor',     /* إعادة هيكلة */
    DEPLOY:      'deploy',       /* نشر */
    GENERAL:     'general'       /* عام */
  };

  /* ── خطوة تنفيذ ── */
  class Step {
    constructor(id, name, tool, args, dependsOn = []) {
      this.id        = id;
      this.name      = name;
      this.tool      = tool;
      this.args      = args;
      this.dependsOn = dependsOn;
      this.status    = 'pending';   /* pending | running | done | failed | skipped */
      this.result    = null;
      this.error     = null;
      this.attempts  = 0;
    }
  }

  /* ── خطة التنفيذ ── */
  class Plan {
    constructor(intent, steps, userRequest) {
      this.id          = `plan_${Date.now()}`;
      this.intent      = intent;
      this.steps       = steps;
      this.userRequest = userRequest;
      this.createdAt   = new Date().toISOString();
      this.status      = 'pending';
    }

    getStep(id) { return this.steps.find(s => s.id === id); }
    getDone()   { return this.steps.filter(s => s.status === 'done'); }
    getFailed() { return this.steps.filter(s => s.status === 'failed'); }
    isComplete() {
      return this.steps.every(s => ['done','failed','skipped'].includes(s.status));
    }
  }

  /* ── تحليل النية ── */
  function _detectIntent(text) {
    const t = text.toLowerCase();

    if (/ابنِ|اصنع|أنشئ|أنشئ|اعمل|ولّد|ولد|build|create|make/i.test(t)) return INTENT.BUILD;
    if (/عدّل|غيّر|أصلح الخطأ|حسّن|refactor|update|modify/i.test(t) && /كود|ملف|file|code/i.test(t)) return INTENT.EDIT;
    if (/أصلح|إصلاح|خطأ|مشكلة|bug|fix|error/i.test(t)) return INTENT.FIX;
    if (/حلّل|افهم|analyze|inspect|review/i.test(t)) return INTENT.ANALYZE;
    if (/ابحث|بحث|search|find online/i.test(t)) return INTENT.SEARCH;
    if (/شغّل|نفّذ|اختبر|run|execute|test/i.test(t)) return INTENT.RUN;
    if (/صورة|رسم|image|picture|generate.*image/i.test(t)) return INTENT.IMAGE;
    if (/انشر|deploy|publish|netlify/i.test(t)) return INTENT.DEPLOY;
    if (/أعِد هيكلة|refactor|reorganize/i.test(t)) return INTENT.REFACTOR;
    if (/اشرح|ما هو|كيف|explain|what is|how/i.test(t)) return INTENT.EXPLAIN;

    return INTENT.GENERAL;
  }

  /* ── بناء خطة التنفيذ ── */
  function _buildPlan(intent, userRequest, projectCtx) {
    const steps = [];

    switch (intent) {
      case INTENT.BUILD:
        steps.push(
          new Step('s1', 'تحليل الطلب', 'analyze_request', { text: userRequest }),
          new Step('s2', 'توليد الكود', 'generate_code', { request: userRequest, ctx: projectCtx }, ['s1']),
          new Step('s3', 'فحص الكود',   'validate_code', {}, ['s2']),
          new Step('s4', 'معاينة النتيجة', 'preview', {}, ['s3'])
        );
        break;

      case INTENT.EDIT:
      case INTENT.FIX:
      case INTENT.REFACTOR:
        steps.push(
          new Step('s1', 'تحديد الملفات المتأثرة', 'identify_files', { text: userRequest, ctx: projectCtx }),
          new Step('s2', 'توليد التعديلات', 'generate_edits', { request: userRequest }, ['s1']),
          new Step('s3', 'تطبيق التعديلات', 'apply_edits', {}, ['s2']),
          new Step('s4', 'فحص النتيجة', 'validate_code', {}, ['s3'])
        );
        break;

      case INTENT.ANALYZE:
        steps.push(
          new Step('s1', 'تحليل المشروع', 'analyze_project', { ctx: projectCtx }),
          new Step('s2', 'استخراج المعلومات', 'extract_info', {}, ['s1']),
          new Step('s3', 'بناء التقرير', 'build_report', {}, ['s2'])
        );
        break;

      case INTENT.SEARCH:
        steps.push(
          new Step('s1', 'صياغة الاستعلام', 'format_query', { text: userRequest }),
          new Step('s2', 'البحث في الويب', 'web_search', {}, ['s1']),
          new Step('s3', 'تلخيص النتائج', 'summarize_results', {}, ['s2'])
        );
        break;

      case INTENT.IMAGE:
        steps.push(
          new Step('s1', 'تحسين الوصف', 'enhance_prompt', { text: userRequest }),
          new Step('s2', 'توليد الصورة', 'generate_image', {}, ['s1'])
        );
        break;

      default:
        steps.push(
          new Step('s1', 'معالجة الطلب', 'general_chat', { text: userRequest, ctx: projectCtx })
        );
    }

    return new Plan(intent, steps, userRequest);
  }

  /* ── حالة الوكيل ── */
  let _currentPlan  = null;
  let _isRunning    = false;
  let _onProgress   = null;

  /* ── إخطار المراقب ── */
  function _notify(event, data) {
    if (typeof _onProgress === 'function') {
      try { _onProgress({ event, data, plan: _currentPlan }); } catch {}
    }
    Logger.debug('AGENT', `[${event}] ${JSON.stringify(data).slice(0, 100)}`);
  }

  return {
    INTENT,

    /* ═══════════════════════════════════════
       تحليل الطلب
       ═══════════════════════════════════════ */
    analyzeRequest(text) {
      const intent = _detectIntent(text);
      const projectCtx = Memory.buildContext();

      Logger.info('AGENT', `نية مكتشفة: ${intent} — "${text.slice(0, 60)}"`);
      return { intent, projectCtx };
    },

    /* ═══════════════════════════════════════
       بناء الخطة
       ═══════════════════════════════════════ */
    buildPlan(text) {
      const { intent, projectCtx } = this.analyzeRequest(text);
      const plan = _buildPlan(intent, text, projectCtx);
      _currentPlan = plan;
      Logger.info('AGENT', `خطة بُنيت: ${plan.id} — ${plan.steps.length} خطوة`);
      return plan;
    },

    /* ═══════════════════════════════════════
       تنفيذ الخطوة
       ═══════════════════════════════════════ */
    async executeStep(step, plan, tools) {
      if (step.status === 'done') return step;
      step.status  = 'running';
      step.attempts++;

      _notify('step_start', { id: step.id, name: step.name });

      const t = Logger.time(`step:${step.id}:${step.tool}`);

      try {
        /* جمع نتائج الخطوات السابقة */
        const prevResults = {};
        step.dependsOn.forEach(depId => {
          const dep = plan.getStep(depId);
          if (dep?.result) prevResults[depId] = dep.result;
        });

        const args = { ...step.args, _prevResults: prevResults, _plan: plan };
        let result;

        /* تنفيذ الأداة */
        if (tools[step.tool]) {
          result = await tools[step.tool](args);
        } else if (PluginSystem) {
          const pluginResult = await PluginSystem.executeTool(step.tool, args);
          result = pluginResult.ok ? pluginResult.result : { error: pluginResult.error };
        } else {
          result = { skipped: true, reason: `أداة غير متاحة: ${step.tool}` };
        }

        step.result = result;
        step.status = result?.error ? 'failed' : 'done';
        t.end();

        _notify(step.status === 'done' ? 'step_done' : 'step_failed', {
          id: step.id, name: step.name, result
        });

      } catch (err) {
        step.error  = err.message;
        step.status = 'failed';
        t.end();

        Logger.error('AGENT', `فشلت الخطوة ${step.id}: ${err.message}`);
        _notify('step_failed', { id: step.id, name: step.name, error: err.message });
      }

      return step;
    },

    /* ═══════════════════════════════════════
       تنفيذ الخطة كاملة
       ═══════════════════════════════════════ */
    async runPlan(plan, tools = {}, onProgress = null) {
      if (_isRunning) {
        Logger.warn('AGENT', 'الوكيل يعمل بالفعل');
        return null;
      }

      _isRunning  = true;
      _onProgress = onProgress;
      plan.status = 'running';

      const t = Logger.time(`plan:${plan.id}`);
      _notify('plan_start', { id: plan.id, steps: plan.steps.length });

      const MAX_RETRIES = 2;

      for (const step of plan.steps) {
        /* تحقق من الشروط */
        const deps = step.dependsOn.map(id => plan.getStep(id));
        const depsOk = deps.every(d => d?.status === 'done');

        if (!depsOk) {
          step.status = 'skipped';
          _notify('step_skipped', { id: step.id, reason: 'شرط مسبق فشل' });
          continue;
        }

        await this.executeStep(step, plan, tools);

        /* إعادة المحاولة عند الفشل */
        if (step.status === 'failed' && step.attempts < MAX_RETRIES) {
          Logger.warn('AGENT', `إعادة محاولة: ${step.id} (${step.attempts}/${MAX_RETRIES})`);
          _notify('step_retry', { id: step.id, attempt: step.attempts });
          await new Promise(r => setTimeout(r, 1000));
          await this.executeStep(step, plan, tools);
        }
      }

      const elapsed = t.end();
      plan.status = plan.getFailed().length === 0 ? 'done' : 'partial';
      _isRunning = false;

      const summary = {
        planId:  plan.id,
        status:  plan.status,
        done:    plan.getDone().length,
        failed:  plan.getFailed().length,
        total:   plan.steps.length,
        elapsed
      };

      _notify('plan_done', summary);
      Logger.info('AGENT', `خطة منتهية: ${JSON.stringify(summary)}`);

      /* حفظ في الذاكرة */
      Memory.addFact(`تم تنفيذ خطة: ${plan.intent} — ${plan.getDone().length}/${plan.steps.length} خطوة ناجحة`, 'agent');

      return summary;
    },

    /* ═══════════════════════════════════════
       طريقة مختصرة: تحليل + بناء + تنفيذ
       ═══════════════════════════════════════ */
    async process(userText, tools = {}, onProgress = null) {
      Logger.info('AGENT', `معالجة: "${userText.slice(0, 80)}"`);
      const g = Logger.group('agent:process');

      Memory.incrementMessages();
      const plan = this.buildPlan(userText);
      const result = await this.runPlan(plan, tools, onProgress);

      g.end();
      return { plan, result };
    },

    /* ═══════════════════════════════════════
       مراجعة النتيجة قبل الإرجاع
       ═══════════════════════════════════════ */
    async reviewResult(plan, aiText) {
      const issues = [];

      /* فحص أمني */
      const scan = Security.scanCode(aiText);
      if (!scan.safe) {
        issues.push({ type: 'security', severity: scan.riskLevel, details: scan.findings });
      }

      /* فحص الاكتمال */
      if (aiText.includes('...') && aiText.includes('// باقي الكود')) {
        issues.push({ type: 'incomplete', severity: 'HIGH', details: 'الكود غير مكتمل' });
      }

      if (issues.length > 0) {
        Logger.warn('AGENT', `مراجعة: ${issues.length} مشكلة`, issues);
      }

      return { passed: issues.length === 0, issues };
    },

    /* ═══════════════════════════════════════
       معلومات الوكيل
       ═══════════════════════════════════════ */
    getStatus() {
      return {
        isRunning:   _isRunning,
        currentPlan: _currentPlan ? {
          id:     _currentPlan.id,
          intent: _currentPlan.intent,
          status: _currentPlan.status,
          steps:  _currentPlan.steps.map(s => ({ id: s.id, name: s.name, status: s.status }))
        } : null
      };
    },

    /* ═══════════════════════════════════════
       لوحة حالة الوكيل
       ═══════════════════════════════════════ */
    showPlanUI(plan, container) {
      if (!container) return;
      const icons = { pending: '⏳', running: '🔄', done: '✅', failed: '❌', skipped: '⏭️' };
      const colors = { pending: '#475569', running: '#60a5fa', done: '#4ade80', failed: '#f87171', skipped: '#94a3b8' };

      container.innerHTML = `
        <div style="
          background:rgba(0,0,0,0.3);border:1px solid rgba(220,38,38,0.2);
          border-radius:12px;padding:12px;margin:8px 0;font-size:12px;
        ">
          <div style="font-size:11px;font-weight:700;color:#fca5a5;margin-bottom:8px">
            🤖 خطة الوكيل — ${plan.intent}
          </div>
          ${plan.steps.map(s => `
            <div style="
              display:flex;align-items:center;gap:8px;padding:4px 0;
              border-bottom:1px solid rgba(255,255,255,0.04);
            ">
              <span style="font-size:14px">${icons[s.status]}</span>
              <span style="color:${colors[s.status]};flex:1">${s.name}</span>
              ${s.error ? `<span style="color:#f87171;font-size:10px">${s.error.slice(0,40)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }
  };
})();

Logger.info('SYSTEM', '✅ نظام الوكيل الذكي جاهز');
