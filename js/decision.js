/* ══════════════════════════════════════════════════════════════
   decision.js — محرك القرار (Decision Engine)
   يقرر قبل أي مهمة: أي نموذج، أي أداة، هل نحتاج بحثاً؟
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.DecisionEngine = (function () {

  /* ══ قواعد اختيار النموذج ══ */
  const MODEL_RULES = [
    {
      name: 'gemini-2.5-flash',
      when: (t) => /صور?|image|فيجول|visual|رسم/.test(t),
      label: 'تحليل الصور',
      score: 10
    },
    {
      name: 'openrouter-code',
      when: (t) => /كود|برمجة|code|function|class|bug|error|syntax|html|css|javascript|python|fix/.test(t),
      label: 'البرمجة',
      score: 9
    },
    {
      name: 'openrouter-large',
      when: (t) => /تحليل|analysis|شرح مفصل|detailed|خطة|plan|استراتيجية/.test(t),
      label: 'التحليل المعمق',
      score: 8
    },
    {
      name: 'gemini-2.5-pro',
      when: (t) => /ابحث|search|أحدث|latest|اليوم|news|بحث/.test(t),
      label: 'البحث والأخبار',
      score: 7
    },
    {
      name: 'openrouter-fast',
      when: () => true,    // افتراضي
      label: 'عام',
      score: 1
    }
  ];

  /* ══ قواعد اختيار الأدوات ══ */
  const TOOL_RULES = [
    {
      id: 'web_search',
      when: (t) => /ابحث|بحث|search|أحدث|latest|اليوم|أخبار|news|رابط|url|link/.test(t),
      label: 'البحث على الإنترنت'
    },
    {
      id: 'image_gen',
      when: (t) => /ولّد صورة|generate image|صورة ل|اصنع صورة|رسم/.test(t),
      label: 'توليد صورة'
    },
    {
      id: 'code_runner',
      when: (t) => /شغّل|run|تنفيذ|execute|اختبر الكود|test code/.test(t),
      label: 'تشغيل كود'
    },
    {
      id: 'file_analyzer',
      when: (t) => /حلّل|analyze|ملف|file|zip|project|مشروع/.test(t),
      label: 'تحليل ملف'
    },
    {
      id: 'knowledge_graph',
      when: (t) => /علاقات|relationships|graph|خريطة|map|dependencies|تبعيات/.test(t),
      label: 'خريطة المعرفة'
    }
  ];

  /* ══ قواعد تحديد السياق ══ */
  const CONTEXT_RULES = {
    needsSearch:   (t) => /ابحث|بحث عن|أحدث|اليوم|أخبار|search/.test(t),
    needsFiles:    (t) => /ملف|file|zip|مشروع|project|رفع|upload/.test(t),
    needsRun:      (t) => /شغّل|run|تنفيذ|execute|تشغيل/.test(t),
    needsMultiModel:(t) => /قارن|compare|رأي آخر|second opinion|دمج/.test(t),
    needsProject:  (t) => /تعديل|edit|أصلح|fix|حدّث|update/.test(t)
  };

  /* ── اتخاذ قرار كامل لطلب معين ── */
  function decide(task) {
    const t = (task || '').toLowerCase();
    const timer = Logger.time('decision');

    /* اختيار النموذج */
    const modelScores = MODEL_RULES
      .filter(r => r.when(t))
      .sort((a, b) => b.score - a.score);
    const primaryModel = modelScores[0] || MODEL_RULES[MODEL_RULES.length - 1];

    /* اختيار الأدوات */
    const tools = TOOL_RULES.filter(r => r.when(t)).map(r => r.id);

    /* تحليل السياق */
    const context = {};
    Object.entries(CONTEXT_RULES).forEach(([key, fn]) => { context[key] = fn(t); });

    /* تقدير التعقيد */
    const complexity = _estimateComplexity(task, tools, context);

    /* هل نحتاج أكثر من نموذج؟ */
    const multiModel = context.needsMultiModel || complexity === 'high';

    const decision = {
      model:      primaryModel.name,
      modelLabel: primaryModel.label,
      tools,
      context,
      complexity,
      multiModel,
      timestamp:  Date.now()
    };

    Logger.time(timer);
    Logger.info('DECISION', `✓ ${primaryModel.label} | أدوات: [${tools.join(', ') || 'لا'}] | تعقيد: ${complexity}`);
    return decision;
  }

  /* ── تقدير مستوى تعقيد المهمة ── */
  function _estimateComplexity(task, tools, context) {
    let score = 0;
    if (task.length > 300)             score += 2;
    if (tools.length > 2)              score += 2;
    if (context.needsMultiModel)       score += 3;
    if (context.needsFiles)            score += 1;
    if (context.needsRun)              score += 1;
    if (/منصة|platform|نظام|system|كامل|full/.test(task)) score += 2;

    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  /* ── اقتراح نموذج بديل عند الفشل ── */
  function suggestFallback(failedModel) {
    const fallbacks = {
      'gemini-2.5-flash':  'gemini-2.5-pro',
      'openrouter-code':   'openrouter-large',
      'openrouter-large':  'gemini-2.5-flash',
      'openrouter-fast':   'gemini-2.5-flash',
      'gemini-2.5-pro':    'openrouter-large'
    };
    const fb = fallbacks[failedModel] || 'openrouter-fast';
    Logger.warn('DECISION', `⚠️ النموذج ${failedModel} فشل — التبديل إلى ${fb}`);
    return fb;
  }

  /* ── إحصاءات القرارات ── */
  const _stats = { decisions: 0, byModel: {}, byComplexity: {} };

  function recordDecision(decision) {
    _stats.decisions++;
    _stats.byModel[decision.model]             = (_stats.byModel[decision.model] || 0) + 1;
    _stats.byComplexity[decision.complexity]   = (_stats.byComplexity[decision.complexity] || 0) + 1;
  }

  return { decide, suggestFallback, recordDecision, stats: () => ({ ..._stats }) };
})();
