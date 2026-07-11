/* ══════════════════════════════════════════════
   config.js — إعدادات API والثوابت العامة
   Galaoum AI Engine v5.0

   🔑 مفاتيح API:
     - OPENROUTER_API_KEY  → النصوص، البرمجة، المحادثة
     - POLLINATIONS_API_KEY → توليد الصور (Pollinations.ai)
     - GEMINI_API_KEYS     → ثلاثة مفاتيح Gemini مع تدوير تلقائي

   🔐 الأمان:
     - جميع المفاتيح تُحفظ تلقائياً في Security store
     - لا تشارك هذا الملف علناً
     - على Netlify: اضبط OPENROUTER_API_KEY في Environment Variables
   ══════════════════════════════════════════════ */

/* 🔐 v6.0: لا مفاتيح API مكتوبة مباشرة في الكود.
   ضع مفاتيحك من واجهة "مفاتيح Gemini" و"مفاتيح المزودين" (تُحفظ في Security store محلياً)،
   أو اضبطها كـ Environment Variables على Netlify لدالة netlify/functions/chat.js. */
const CONFIG = {
  /* مفتاح BazaarLink — +200 نموذج (OpenAI, Claude, Gemini, Grok...) */
  BAZAARLINK_API_KEY: '',
  BAZAARLINK_BASE_URL: 'https://bazaarlink.ai/api/v1/chat/completions',

  /* مفتاح OpenRouter — للنصوص والمحادثة والبرمجة */
  /* ⚠️ على Netlify: استخدم Environment Variable بدلاً من هذا */
  OPENROUTER_API_KEY: '',

  /* مفاتيح المزودين الجدد — v5.0 */
  MISTRAL_API_KEY:  '',
  COHERE_API_KEY:   '',
  CEREBRAS_API_KEY: '',
  FAL_KEY:          '',

  /* مفتاح Replicate — مجاني عند التسجيل من replicate.com */
  REPLICATE_API_TOKEN: '',

  /* مفتاح Pollinations — لتوليد الصور فقط */
  POLLINATIONS_API_KEY: '',

  /* مفتاح JSON2Video — لتوليد فيديوهات احترافية من قوالب */
  JSON2VIDEO_API_KEY: '',

  /* مفاتيح JSONClip — لتوليد فيديوهات من JSON (مزود بديل) */
  JSONCLIP_API_KEY_1: '',
  JSONCLIP_API_KEY_2: '',

  /* مفتاح HuggingFace — لتوليد الفيديو الحقيقي (اختياري — مجاني من https://huggingface.co/settings/tokens) */
  HF_TOKEN: '',

  /* بيانات Netlify للنشر التلقائي (وضع التعديل الذاتي) */
  NETLIFY_ACCESS_TOKEN: '',
  NETLIFY_SITE_ID:      '',

  /* ══════════════════════════════════════════════
     🔑 مفاتيح Gemini API — ثلاثة مفاتيح للتدوير التلقائي
     ضع مفاتيحك هنا (الحصول عليها من: https://aistudio.google.com/app/apikey)
     ══════════════════════════════════════════════ */
  GEMINI_API_KEYS: [
    '',
    '',
    ''
  ],

  /* نماذج Gemini — ✅ مُختبَرة فعلياً يوليو 2026 */
  GEMINI_MODELS: [
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash'
  ],

  /* رابط Gemini API الأساسي (بدون اسم النموذج — يُضاف برمجياً) */
  GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models/',

  /* روابط API الثابتة */
  OPENROUTER_BASE_URL:    'https://openrouter.ai/api/v1/chat/completions',
  POLLINATIONS_IMAGE_URL: 'https://image.pollinations.ai/prompt/',
  HTTP_REFERER:           'https://galaoum-ai.netlify.app',
  SITE_TITLE:             'Galaoum AI Engine v5.0'
};

/* ══════════════════════════════════════════════
   نظام تدوير مفاتيح Gemini — يتنقل تلقائياً بين المفاتيح
   ══════════════════════════════════════════════ */
const GeminiKeyManager = {
  _currentIndex: 0,

  /* الحصول على المفتاح الحالي */
  getKey() {
    /* أولاً: ابحث في مخزن الأمان (المفاتيح المضافة عبر واجهة المستخدم) */
    if (typeof Security !== 'undefined') {
      for (let i = 0; i < 3; i++) {
        const k = Security.getKey(`gemini_${i}`);
        if (k) {
          const keys = [];
          for (let j = 0; j < 3; j++) {
            const kj = Security.getKey(`gemini_${j}`);
            if (kj) keys.push(kj);
          }
          return keys[this._currentIndex % keys.length] || null;
        }
      }
    }

    /* ثانياً: استخدم CONFIG مباشرة */
    const keys = CONFIG.GEMINI_API_KEYS.filter(k => k && !k.includes('_HERE'));
    if (keys.length === 0) return null;
    return keys[this._currentIndex % keys.length];
  },

  /* الانتقال للمفتاح التالي عند الفشل */
  nextKey() {
    const keys = CONFIG.GEMINI_API_KEYS.filter(k => k && !k.includes('_HERE'));
    this._currentIndex = (this._currentIndex + 1) % Math.max(keys.length, 1);
    return this.getKey();
  },

  /* بناء رابط الطلب */
  buildUrl(model, apiKey) {
    return CONFIG.GEMINI_BASE_URL + model + ':generateContent?key=' + apiKey;
  },

  /* فحص إذا كان المفتاح يعمل */
  async testKey(apiKey) {
    try {
      const res = await fetch(this.buildUrl('gemini-2.0-flash', apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });
      if (res.status === 429) return '⚠️ صالح — تجاوز الحد المؤقت';
      return res.ok ? '✅ يعمل' : '❌ غير صالح';
    } catch {
      return '❌ خطأ في الاتصال';
    }
  },

  /* فحص جميع المفاتيح وإرجاع حالة كل واحد */
  async testAllKeys() {
    const results = [];
    for (let i = 0; i < CONFIG.GEMINI_API_KEYS.length; i++) {
      const key = CONFIG.GEMINI_API_KEYS[i];
      if (!key || key.includes('_HERE')) {
        results.push({ index: i + 1, status: 'غير مضبوط' });
        continue;
      }
      const ok = await this.testKey(key);
      results.push({ index: i + 1, status: ok ? '✅ يعمل' : '❌ لا يعمل' });
    }
    return results;
  }
};
