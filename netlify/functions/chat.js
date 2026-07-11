/* ══════════════════════════════════════════════
   netlify/functions/chat.js
   Galaoum AI Engine v6.0 — Server-side API Proxy
   يعمل على Netlify Functions كوسيط آمن بين المتصفح والمزودين
   ══════════════════════════════════════════════ */

const SYSTEM_PROMPT = `أنت Galaoum AI Engine v6.0 — مساعد ذكاء اصطناعي متكامل طوّره عمار جلعوم.

══ هويتك ══
• اسمك: Galaoum AI Engine v6.0 — لا تنسب نفسك لأي شركة أخرى
• مطوّرك: عمار جلعوم
• لغة الرد الافتراضية: عربية دائماً ما لم يطلب غيرها المستخدم

══ كيف تفهم كل طلب ══
اقرأ الرسالة كاملاً وحدّد نيّة المستخدم قبل الرد:
• سؤال (من؟ ما؟ كيف؟ لماذا؟ متى؟ أين؟) → أجب مباشرة بمعلومة دقيقة
• طلب كتابة (مقال، قصة، رسالة، شعر، خطاب، نص) → اكتب المحتوى كاملاً فوراً
• طلب شرح أو تحليل → اشرح بوضوح بأمثلة عند الحاجة
• طلب نصيحة أو رأي → قدّم رأياً واضحاً ومبرراً
• طلب ترجمة → ترجم النص كاملاً بدقة
• طلب تلخيص → لخّص أبرز النقاط بدون حذف المهم
• طلب برمجة أو كود → اكتب الكود كاملاً 100% داخل \`\`\` بدون اختصار
• طلب اجتماعي أو عاطفي (تعزية، اعتذار، تهنئة) → اكتب بأسلوب مناسب ومؤثر
• محادثة عامة → تحدّث بشكل طبيعي واستند للسياق السابق

══ قواعد الرد المطلقة ══
✦ لا تبدأ أبداً بـ"مرحباً" أو "أهلاً" عند الإجابة على سؤال محدد — ابدأ بالإجابة مباشرة
✦ لا تقل "بالطبع!" أو "بكل سرور!" أو "يسعدني مساعدتك" — انتقل للمحتوى فوراً
✦ لا تقل "...باقي الكود..." أو "... إلخ" — الكود والمحتوى دائماً كامل
✦ إذا لم تفهم الطلب، اسأل سؤالاً واحداً محدداً للتوضيح
✦ الردود منظّمة: عناوين + نقاط + فقرات حسب الحاجة`;

/* ── مفاتيح API من Environment Variables (آمنة على Netlify) ── */
const KEYS = {
  bazaarlink:  process.env.BAZAARLINK_API_KEY  || '',
  openrouter:  process.env.OPENROUTER_API_KEY  || '',
  mistral:     process.env.MISTRAL_API_KEY     || '',
  cohere:      process.env.COHERE_API_KEY      || '',
  cerebras:    process.env.CEREBRAS_API_KEY    || '',
  gemini:      process.env.GEMINI_API_KEY      || '',
};

/* ── BazaarLink (200+ نموذج) ── */
async function tryBazaarLink(messages, model) {
  const models = model ? [model] : ['gpt-4o-mini', 'claude-3-5-sonnet', 'gpt-4o', 'gemini-2.0-flash'];
  for (const m of models) {
    try {
      const res = await fetch('https://bazaarlink.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEYS.bazaarlink },
        body: JSON.stringify({ model: m, max_tokens: 8192, messages })
      });
      if (!res.ok) continue;
      const d = await res.json();
      const reply = d.choices?.[0]?.message?.content;
      if (reply) return reply;
    } catch {}
  }
  throw new Error('BazaarLink: فشلت جميع النماذج');
}

/* ── Mistral ── */
async function tryMistral(messages) {
  const models = ['mistral-small-latest', 'mistral-medium-latest', 'open-mistral-7b'];
  for (const m of models) {
    try {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEYS.mistral },
        body: JSON.stringify({ model: m, max_tokens: 8192, messages })
      });
      if (!res.ok) continue;
      const d = await res.json();
      const reply = d.choices?.[0]?.message?.content;
      if (reply) return reply;
    } catch {}
  }
  throw new Error('Mistral: فشلت جميع النماذج');
}

/* ── Cohere ── */
async function tryCohere(messages) {
  try {
    const res = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEYS.cohere },
      body: JSON.stringify({ model: 'command-a-03-2025', messages })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    const reply = d.message?.content?.[0]?.text;
    if (reply) return reply;
    throw new Error('رد فارغ');
  } catch (e) { throw new Error('Cohere: ' + e.message); }
}

/* ── Cerebras ── */
async function tryCerebras(messages) {
  const models = [
    'llama-4-scout-17b-16e-instruct',
    'llama-3.3-70b',
    'qwen-3-32b'
  ];
  for (const m of models) {
    try {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + KEYS.cerebras
        },
        body: JSON.stringify({ model: m, max_tokens: 8192, messages })
      });
      if (!res.ok) continue;
      const d = await res.json();
      const reply = d.choices?.[0]?.message?.content;
      if (reply) return reply;
    } catch {}
  }
  throw new Error('Cerebras: فشلت جميع النماذج');
}

/* ── OpenRouter ── */
async function tryOpenRouter(messages, model) {
  const models = model ? [model] : [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-4-31b-it:free',
    'qwen/qwen3-coder:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'openai/gpt-oss-120b:free'
  ];
  for (const m of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + KEYS.openrouter,
          'HTTP-Referer': 'https://galaoum-ai.netlify.app',
          'X-Title': 'Galaoum AI Engine v6.0'
        },
        body: JSON.stringify({ model: m, max_tokens: 8192, messages })
      });
      if (!res.ok) continue;
      const d = await res.json();
      const reply = d.choices?.[0]?.message?.content;
      if (reply) return reply;
    } catch {}
  }
  throw new Error('OpenRouter: فشلت جميع النماذج');
}

/* ── Gemini ── */
async function tryGemini(prompt, systemPrompt, history) {
  const key = KEYS.gemini;
  if (!key || key.length < 10) throw new Error('مفتاح Gemini غير مضبوط');
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'];
  const geminiHistory = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [...geminiHistory, { role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192 }
        })
      });
      if (res.status === 429) continue;
      if (!res.ok) break;
      const d = await res.json();
      const parts = d.candidates?.[0]?.content?.parts || [];
      const reply = parts.find(p => p.text && !p.thought)?.text || parts[0]?.text;
      if (reply) return reply;
    } catch {}
  }
  throw new Error('Gemini: فشلت جميع النماذج');
}

/* ══════════════════════════════════════════════
   Handler الرئيسي
   ══════════════════════════════════════════════ */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const { prompt, history = [], model: modelHint } = JSON.parse(event.body || '{}');
    if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: 'prompt مطلوب' }) };

    const systemPrompt = SYSTEM_PROMPT;
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
      { role: 'user', content: prompt }
    ];

    const errors = [];

    /* 1. BazaarLink أولاً (200+ نموذج، يعمل من السيرفر) */
    try {
      const reply = await tryBazaarLink(messages, modelHint);
      return { statusCode: 200, headers, body: JSON.stringify({ reply, provider: 'bazaarlink' }) };
    } catch (e) { errors.push('BazaarLink: ' + e.message); }

    /* 2. Mistral */
    try {
      const reply = await tryMistral(messages);
      return { statusCode: 200, headers, body: JSON.stringify({ reply, provider: 'mistral' }) };
    } catch (e) { errors.push('Mistral: ' + e.message); }

    /* 3. Cohere */
    try {
      const reply = await tryCohere(messages);
      return { statusCode: 200, headers, body: JSON.stringify({ reply, provider: 'cohere' }) };
    } catch (e) { errors.push('Cohere: ' + e.message); }

    /* 4. Cerebras */
    try {
      const reply = await tryCerebras(messages);
      return { statusCode: 200, headers, body: JSON.stringify({ reply, provider: 'cerebras' }) };
    } catch (e) { errors.push('Cerebras: ' + e.message); }

    /* 5. OpenRouter */
    try {
      const reply = await tryOpenRouter(messages, modelHint);
      return { statusCode: 200, headers, body: JSON.stringify({ reply, provider: 'openrouter' }) };
    } catch (e) { errors.push('OpenRouter: ' + e.message); }

    /* 6. Gemini */
    try {
      const reply = await tryGemini(prompt, systemPrompt, history);
      return { statusCode: 200, headers, body: JSON.stringify({ reply, provider: 'gemini' }) };
    } catch (e) { errors.push('Gemini: ' + e.message); }

    /* 7. Pollinations — احتياطي أخير (model=openai فقط) */
    try {
      const pRes = await fetch(
        `https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${encodeURIComponent(systemPrompt.substring(0, 600))}&model=openai&private=true`,
        { signal: AbortSignal.timeout ? AbortSignal.timeout(25000) : undefined }
      );
      const pTxt = await pRes.text();
      if (pRes.ok && pTxt && pTxt.trim().length > 5 && !pTxt.includes('Galaoum AI Engine') && !pTxt.startsWith('أنت ')) {
        return { statusCode: 200, headers, body: JSON.stringify({ reply: pTxt.trim(), provider: 'pollinations' }) };
      }
    } catch (e) { errors.push('Pollinations: ' + e.message); }

    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'فشلت جميع المزودين: ' + errors.join(' | ') })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
