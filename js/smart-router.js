/* ══════════════════════════════════════════════════════════════
   smart-router.js — الاختيار الذكي التلقائي للنموذج
   Galaoum AI Engine v6.0 — by عمار جلعوم

   يحلّل الطلب ويختار أفضل مزوّد ونموذج تلقائياً.
   ══════════════════════════════════════════════════════════════ */

window.SmartRouter = (function () {

  /* ═══════ أنواع الطلبات والكلمات الدلالية ═══════ */
  const TYPES = {
    code: {
      label: 'برمجة وكود',
      emoji: '💻',
      color: '#30d158',
      patterns: [
        /كود|كتابة كود|اكتب لي|برمجة|برمج|script|function|class|error|bug|debug|fix|html|css|javascript|typescript|python|react|vue|node|api|json|sql|php|java|c\+\+|rust|go|kotlin|swift|flutter|dart|bash|shell/i,
        /إصلاح|صلّح|حل خطأ|خطأ برمجي|تطبيق|موقع|صفحة ويب|frontend|backend|fullstack|component|route|server|database|query/i
      ]
    },
    math: {
      label: 'رياضيات وحسابات',
      emoji: '🔢',
      color: '#ffd60a',
      patterns: [
        /رياضيات|معادلة|حساب|احسب|integral|derivative|matrix|algebra|calculus|statistics|probability|trigonometry|geometry/i,
        /\d+\s*[\+\-\*\/\^]\s*\d+|sqrt|log\(|sin\(|cos\(|tan\(|∫|∑|√|π/
      ]
    },
    arabic_creative: {
      label: 'إبداع عربي',
      emoji: '✍️',
      color: '#ff9f0a',
      patterns: [
        /قصيدة|أبيات|شعر|قصة|رواية|مقال|خطبة|نص إبداعي|كتابة إبداعية|أغنية|كلمات أغنية|حكاية|سيرة|تاريخ/i,
        /اكتب قصة|أنشئ قصة|اكتب قصيدة|أنشئ مقال|صياغة|تأليف|إنشاء نص/i
      ]
    },
    analysis: {
      label: 'تحليل ومقارنة',
      emoji: '📊',
      color: '#32d2ff',
      patterns: [
        /تحليل|حلّل|analyze|مقارنة|قارن|compare|تقييم|قيّم|evaluate|دراسة|ادرس|study|فحص|افحص|inspect|review|نقد|قدّم تقريراً/i,
        /ما الفرق|ما الأفضل|ايش الفرق|وضّح|ايش معنى|ما هو|what is|ما هي الفوائد|إيجابيات|سلبيات/i
      ]
    },
    reasoning: {
      label: 'استنتاج ومنطق',
      emoji: '🧠',
      color: '#bf5af2',
      patterns: [
        /لماذا|لماذا يحدث|how does|كيف تعمل|اشرح|explain|استنتج|deduce|استدلال|منطق|logic|فلسفة|philosophy/i,
        /ما سبب|ما علة|ما الحكمة|هل يمكن|is it possible|هل صحيح|اثبت|prove|برهن/i
      ]
    },
    translation: {
      label: 'ترجمة',
      emoji: '🌐',
      color: '#5e5ce6',
      patterns: [
        /ترجم|translate|ترجمة إلى|انقل إلى الإنجليزية|انقل إلى العربية|english to arabic|arabic to english/i
      ]
    },
    summarize: {
      label: 'تلخيص',
      emoji: '📋',
      color: '#ff6b6b',
      patterns: [
        /لخّص|لخص|summarize|ملخص|summary|موجز|أعطني أهم النقاط|main points|key points|اختصر/i
      ]
    },
    vision: {
      label: 'تحليل صور',
      emoji: '👁️',
      color: '#ff2d55',
      patterns: [
        /صورة|صور|image|photo|picture|انظر إلى|look at|describe image|analyze image|ما في الصورة/i
      ]
    },
    video: {
      label: 'توليد فيديو',
      emoji: '🎬',
      color: '#bf5af2',
      patterns: [
        /فيديو|فديو|مقطع|كليب|انيميشن|video|clip|animation|motion picture|movie|short film/i,
        /ولّد فيديو|أنشئ فيديو|اصنع فيديو|صوّر|حرّك الصورة|generate video|create video|make video/i
      ]
    }
  };

  /* ═══════ ترتيب المزودين لكل نوع ═══════ */
  const ROUTES = {
    code:             ['cerebras', 'mistral', 'openrouter', 'gemini', 'cohere', 'pollinations'],
    math:             ['openrouter', 'gemini', 'mistral', 'cerebras', 'cohere', 'pollinations'],
    arabic_creative:  ['cohere', 'gemini', 'mistral', 'cerebras', 'openrouter', 'pollinations'],
    analysis:         ['openrouter', 'mistral', 'gemini', 'cohere', 'cerebras', 'pollinations'],
    reasoning:        ['openrouter', 'gemini', 'mistral', 'cohere', 'cerebras', 'pollinations'],
    translation:      ['cohere', 'gemini', 'mistral', 'cerebras', 'openrouter', 'pollinations'],
    summarize:        ['cohere', 'mistral', 'gemini', 'cerebras', 'openrouter', 'pollinations'],
    video:            ['gemini', 'openrouter', 'mistral', 'cohere', 'cerebras', 'pollinations'],
    vision:           ['gemini', 'openrouter', 'mistral', 'cohere', 'cerebras', 'pollinations'],
    general:          ['mistral', 'cohere', 'cerebras', 'gemini', 'pollinations', 'openrouter'],
  };

  /* ═══════ أسماء ووصف المزودين ═══════ */
  const PROVIDER_LABELS = {
    mistral:     { name: 'Mistral AI',       emoji: '🌬️', model: 'Mistral Small/Medium' },
    cohere:      { name: 'Cohere',           emoji: '🟢', model: 'Command-A 2025' },
    cerebras:    { name: 'Cerebras',         emoji: '⚡', model: 'Gemma 4-31B' },
    gemini:      { name: 'Google Gemini',    emoji: '✨', model: 'Gemini 2.5 Flash' },
    openrouter:  { name: 'OpenRouter',       emoji: '🔀', model: 'Nemotron 120B' },
    pollinations:{ name: 'Pollinations',     emoji: '🌸', model: 'GPT-4o' },
  };

  let _lastType    = 'general';
  let _lastProvider= 'mistral';

  /* ═══════ كشف نوع الطلب ═══════ */
  function detect(prompt) {
    if (!prompt) return { type: 'general', ...TYPES.general, route: ROUTES.general };
    const p = prompt.trim();

    for (const [type, cfg] of Object.entries(TYPES)) {
      for (const pattern of cfg.patterns) {
        if (pattern.test(p)) {
          _lastType = type;
          return { type, label: cfg.label, emoji: cfg.emoji, color: cfg.color, route: ROUTES[type] };
        }
      }
    }
    _lastType = 'general';
    return { type: 'general', label: 'عام', emoji: '🤖', color: '#94a3b8', route: ROUTES.general };
  }

  /* ═══════ الحصول على ترتيب المزودين للطلب ═══════ */
  function getRoute(prompt) {
    const result = detect(prompt);
    _showRoutingBadge(result);
    return result.route;
  }

  /* ═══════ إشعار المزود المُستخدَم ═══════ */
  function notifyUsed(provider) {
    _lastProvider = provider;
    const badge  = document.getElementById('sr-used-badge');
    const info   = PROVIDER_LABELS[provider];
    if (!badge || !info) return;
    badge.innerHTML = `${info.emoji} <strong>${info.name}</strong> — ${info.model}`;
    badge.style.opacity = '1';
    setTimeout(() => { if (badge) badge.style.opacity = '0.6'; }, 3000);
  }

  /* ═══════ عرض شارة التوجيه الذكي ═══════ */
  function _showRoutingBadge(result) {
    const badge = document.getElementById('sr-routing-badge');
    if (!badge) return;
    badge.textContent = `${result.emoji} ${result.label}`;
    badge.style.background = _hexToRgba(result.color, 0.15);
    badge.style.borderColor = _hexToRgba(result.color, 0.35);
    badge.style.color       = result.color;
    badge.style.opacity     = '1';
    badge.style.transform   = 'translateY(0)';
    setTimeout(() => {
      badge.style.opacity   = '0';
      badge.style.transform = 'translateY(-4px)';
    }, 5000);
  }

  function _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ═══════ توليد ملصق نوع الطلب للرسائل ═══════ */
  function buildResponseTag(provider, type) {
    const p = PROVIDER_LABELS[provider] || PROVIDER_LABELS.mistral;
    const t = TYPES[type] || { emoji: '🤖', label: 'عام', color: '#94a3b8' };
    return `<div class="sr-response-tag" title="المزود: ${p.name} | النوع: ${t.label}">
      ${p.emoji} ${p.name} · ${t.emoji} ${t.label}
    </div>`;
  }

  function getLastType()    { return _lastType; }
  function getLastProvider(){ return _lastProvider; }

  return { detect, getRoute, notifyUsed, buildResponseTag, getLastType, getLastProvider };
})();
