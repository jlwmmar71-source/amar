/* ══════════════════════════════════════════════════════════════
   systems-bootstrap.js — تفعيل الأنظمة العشرين الجديدة داخل
   تدفق المحادثة الحقيقي (وليس أنظمة معزولة/خاملة)
   Galaoum AI Engine v5.0 — إضافة جديدة
   لا يحذف ولا يعدّل أي كود أصلي — يغلّف callAPI الأصلي فقط،
   ويستخدمه كخط رجوع آمن (safe fallback) إذا فشل التنسيق الجديد
   ══════════════════════════════════════════════════════════════ */

(function () {

  if (typeof window.callAPI !== 'function') return; /* أمان: لا شيء لتغليفه */

  const _originalCallAPI = window.callAPI;

  /* ── بناء system prompt مشابه للأصلي مع السياق (history) ── */
  function _orchSystemPrompt(history) {
    let contextNote = '';
    if (history && history.length > 0) {
      const pairs = [];
      for (let i = 0; i < history.length; i += 2) {
        const u = history[i], a = history[i + 1];
        if (u && a) pairs.push('U: ' + String(u.content).substring(0, 300) + '\nAI: ' + String(a.content).substring(0, 400));
      }
      if (pairs.length > 0) contextNote = '\n\n[سياق]\n' + pairs.join('\n---\n') + '\n[/سياق]';
    }
    return 'أنت Galaoum AI Engine v5.0 — مساعد ذكاء اصطناعي طوّره عمار جلعوم. '
      + 'أسلوبك: خبير، واثق، دقيق، تبدأ بالتنفيذ فوراً. أجب بالعربية دائماً.' + contextNote;
  }

  /* ── بناء قائمة المزودين الحقيقيين لتُستخدَم من GlobalOrchestrator ── */
  function _buildOrchestratorProviders(history) {
    const sys = _orchSystemPrompt(history);
    const providers = {};
    if (typeof callMistralAPI === 'function') {
      providers.mistral = (p) => callMistralAPI(p, sys, history);
    }
    if (typeof callCohereAPI === 'function') {
      providers.cohere = (p) => callCohereAPI(p, sys, history);
    }
    if (typeof callCerebrasAPI === 'function') {
      providers.cerebras = (p) => callCerebrasAPI(p, sys, history);
    }
    if (typeof callGeminiAPI === 'function'
        && typeof CONFIG !== 'undefined'
        && Array.isArray(CONFIG.GEMINI_API_KEYS)
        && CONFIG.GEMINI_API_KEYS.some(k => k && !k.includes('_HERE'))) {
      providers.gemini = (p) => callGeminiAPI(p, sys, history);
    }
    return providers;
  }

  /* ── تغليف callAPI: يمر أولاً عبر GlobalOrchestrator، ثم يرجع للأصلي عند أي فشل ── */
  window.callAPI = async function (prompt, useMemory = true) {
    const taskPlannerActive = typeof TaskPlanner !== 'undefined' && typeof TaskPlanner.isEnabled === 'function' && TaskPlanner.isEnabled();
    const parallelActive    = typeof ParallelEngine !== 'undefined' && typeof ParallelEngine.isActive === 'function' && ParallelEngine.isActive();

    /* إذا كانت أنظمة متقدمة أخرى مفعّلة يدوياً من قبل المستخدم، اترك الأصلي يتولى الأمر كما صُمِّم */
    if (!taskPlannerActive && !parallelActive && typeof GlobalOrchestrator !== 'undefined') {
      try {
        const history = (useMemory && typeof loadMemory === 'function') ? loadMemory() : [];
        /* [FIX v5.1] لا نستبدل رسالة المستخدم — PromptOptimizer كان يخزّن أول سؤال ويعيده لكل الأسئلة */
        const optimizedPrompt = prompt;

        const providers = _buildOrchestratorProviders(history);

        if (Object.keys(providers).length > 0) {
          const result = await GlobalOrchestrator.orchestrate({ type: 'chat', prompt: optimizedPrompt }, providers);

          if (result && result.ok && result.output) {
            /* [FIX v5.1] لا نسجّل في PromptOptimizer لمنع استبدال الأسئلة المستقبلية */
            if (typeof ContextManager !== 'undefined') ContextManager.add(String(result.output).slice(0, 400));
            return result.output;
          }
          console.warn('[GlobalOrchestrator] لم ينجح، رجوع للنظام الأصلي:', result && result.error);
        }
      } catch (e) {
        console.warn('[GlobalOrchestrator] استثناء، رجوع للنظام الأصلي:', e.message);
      }
    }

    /* ── خط الرجوع الآمن: نفس منطق callAPI الأصلي بدون أي تغيير ── */
    return _originalCallAPI(prompt, useMemory);
  };

  /* ── تفعيل الأنظمة المساندة عند تحميل الصفحة ── */
  window.addEventListener('load', () => {
    try {
      if (typeof ToolRegistry !== 'undefined' && typeof ToolRegistry.autoDiscover === 'function') {
        ToolRegistry.autoDiscover();
      }
      if (typeof ResourceOptimizer !== 'undefined' && typeof ResourceOptimizer.startMonitoring === 'function') {
        ResourceOptimizer.startMonitoring(60000);
      }
      if (typeof RollbackEngine !== 'undefined' && typeof RollbackEngine.checkpoint === 'function') {
        RollbackEngine.checkpoint('بدء الجلسة');
      }
    } catch (e) { console.warn('[systems-bootstrap] تحذير عند التفعيل:', e.message); }
  });

})();
