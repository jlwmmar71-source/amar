/* ══════════════════════════════════════════════
   api.js — جميع استدعاءات API الخارجية
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const WANDBOX = 'https://wandbox.org/api/compile.json';

const LANG_MAP = {
  python: 'cpython-3.12.7', python3: 'cpython-3.12.7',
  javascript: 'nodejs-20.17.0', js: 'nodejs-20.17.0', node: 'nodejs-20.17.0',
  c: 'gcc-head-c', cpp: 'gcc-head', 'c++': 'gcc-head',
  rust: 'rust-1.82.0', go: 'go-1.23.2',
  ruby: 'ruby-4.0.2', php: 'php-8.3.12',
  lua: 'lua-5.4.6', perl: 'perl-5.38.0', swift: 'swift-5.10'
};

/* نماذج OpenRouter (مجانية ومُختبَرة) */
const AI_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
  'qwen/qwen3-coder:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'openai/gpt-oss-120b:free'
];

/* نماذج BazaarLink (200+ نموذج) */
const BAZAARLINK_MODELS = [
  'gpt-4o-mini',
  'claude-3-5-sonnet',
  'gpt-4o',
  'gemini-2.0-flash',
  'claude-3-haiku'
];

const VISION_MODELS = [
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'google/gemma-4-26b-a4b-it:free'
];

/* ══════════════════════════════════════════════
   0. callBazaarLinkAPI — 200+ نموذج (GPT-4o, Claude, Gemini...)
   ══════════════════════════════════════════════ */
async function callBazaarLinkAPI(prompt, systemPrompt, history = [], preferredModel) {
  const key = CONFIG.BAZAARLINK_API_KEY;
  if (!key) throw new Error('BAZAARLINK_API_KEY غير مضبوط');
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt }
  ];
  const models = preferredModel
    ? [preferredModel, ...BAZAARLINK_MODELS.filter(m => m !== preferredModel)]
    : BAZAARLINK_MODELS;
  for (const model of models) {
    const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(CONFIG.BAZAARLINK_BASE_URL || 'https://bazaarlink.ai/api/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: 8192, messages })
      });
      clearTimeout(tid);
      if (!res.ok) { continue; }
      const reply = (await res.json()).choices?.[0]?.message?.content;
      if (reply) return reply;
    } catch (e) { clearTimeout(tid); }
  }
  throw new Error('BazaarLink: فشلت جميع النماذج');
}

/* ══════════════════════════════════════════════
   1. callMistralAPI
   ══════════════════════════════════════════════ */
async function callMistralAPI(prompt, systemPrompt, history = []) {
  const key = CONFIG.MISTRAL_API_KEY;
  if (!key) throw new Error('MISTRAL_API_KEY غير مضبوط');
  const models = ['mistral-small-latest', 'mistral-medium-latest', 'open-mistral-7b'];
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt }
  ];
  for (const model of models) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model, max_tokens: 8192, messages })
      });
      clearTimeout(tid);
      if (!res.ok) continue;
      const d = await res.json();
      const reply = d.choices?.[0]?.message?.content;
      if (reply) return reply;
    } catch (e) { clearTimeout(tid); }
  }
  throw new Error('Mistral: فشلت جميع النماذج');
}

/* ══════════════════════════════════════════════
   2. callCohereAPI
   ══════════════════════════════════════════════ */
async function callCohereAPI(prompt, systemPrompt, history = []) {
  /* دعم الاستدعاء القديم بمعاملين فقط: callCohereAPI(prompt, history) */
  if (Array.isArray(systemPrompt)) { history = systemPrompt; systemPrompt = null; }
  const key = CONFIG.COHERE_API_KEY;
  if (!key) throw new Error('COHERE_API_KEY غير مضبوط');
  const msgs = [];
  if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
  history.forEach(h => msgs.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content }));
  msgs.push({ role: 'user', content: prompt });
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch('https://api.cohere.com/v2/chat', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'command-a-03-2025', messages: msgs })
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    const reply = d.message?.content?.[0]?.text;
    if (reply) return reply;
    throw new Error('رد فارغ من Cohere');
  } catch (e) { clearTimeout(tid); throw e; }
}

/* ══════════════════════════════════════════════
   3. callCerebrasAPI
   ══════════════════════════════════════════════ */
async function callCerebrasAPI(prompt, systemPrompt, history = []) {
  const key = CONFIG.CEREBRAS_API_KEY;
  if (!key) throw new Error('CEREBRAS_API_KEY غير مضبوط');
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: prompt }
  ];
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'gemma-4-31b', max_tokens: 8192, messages })
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    const reply = d.choices?.[0]?.message?.content;
    if (reply) return reply;
    throw new Error('رد فارغ من Cerebras');
  } catch (e) { clearTimeout(tid); throw e; }
}

/* ══════════════════════════════════════════════
   4. callGeminiAPI
   ══════════════════════════════════════════════ */
async function callGeminiAPI(prompt, systemPrompt, history = []) {
  let lastErr = 'فشل الاتصال';
  const geminiHistory = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const validKeys = CONFIG.GEMINI_API_KEYS.filter(k => k && !k.includes('_HERE'));
  if (validKeys.length === 0) throw new Error('لا توجد مفاتيح Gemini مضبوطة');

  for (const model of CONFIG.GEMINI_MODELS) {
    let modelFailed = false;
    for (let ki = 0; ki < validKeys.length; ki++) {
      const apiKey = validKeys[(GeminiKeyManager._currentIndex + ki) % validKeys.length];
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 30000);
        const res = await fetch(GeminiKeyManager.buildUrl(model, apiKey), {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [...geminiHistory, { role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192 }
          })
        });
        clearTimeout(tid);
        if (res.status === 429) { lastErr = 'تجاوز الحد المؤقت'; continue; }
        if (!res.ok) { const e = await res.json().catch(() => ({})); lastErr = e.error?.message || 'HTTP ' + res.status; modelFailed = true; break; }
        const d = await res.json();
        const parts = d.candidates?.[0]?.content?.parts || [];
        const reply = parts.find(p => p.text && !p.thought)?.text || parts[0]?.text;
        if (reply) { GeminiKeyManager._currentIndex = (GeminiKeyManager._currentIndex + ki) % validKeys.length; return reply; }
        lastErr = 'رد فارغ';
      } catch (e) { lastErr = e.name === 'AbortError' ? 'انتهت مهلة الاتصال' : e.message; }
    }
    if (modelFailed) continue;
  }
  throw new Error(lastErr);
}

/* ══════════════════════════════════════════════
   callViaServerless — [FIX] يستدعي netlify/functions/chat.js
   بدل الاتصال المباشر من المتصفح بالمزودين.
   لماذا؟
   1) المفاتيح في config.js مكشوفة في الكود المصدري — عند نشرها للعلن
      تقوم أنظمة الفحص الآلي لدى Mistral/Cohere/Cerebras/Google/OpenRouter
      بإبطالها تلقائياً خلال دقائق، فتتوقف كل الردود عن العمل بلا سبب واضح.
   2) بعض هذه المزودين (Mistral، Cohere، Cerebras) لا يسمحون أصلاً
      بطلبات مباشرة من المتصفح (CORS) — الطلب يفشل صامتاً وينتقل الكود
      للمزود التالي حتى ينتهي إلى خطأ عام.
   الحل: الخادم (Netlify Function) يستخدم مفاتيح من Environment Variables
   (آمنة وقابلة للتجديد) ولا تخضع لقيود CORS.
   ══════════════════════════════════════════════ */
async function callViaServerless(prompt, history, modelHint) {
  const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 40000);
  try {
    const res = await fetch((CONFIG.CHAT_FUNCTION_URL || '/.netlify/functions/chat'), {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, history: (history || []).map(h => ({ role: h.role, content: h.content })), model: modelHint || undefined })
    });
    clearTimeout(tid);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    if (!data.reply) throw new Error('رد فارغ من الخادم');
    return data.reply;
  } catch (e) {
    clearTimeout(tid);
    throw new Error(e.name === 'AbortError' ? 'انتهت مهلة الاتصال بالخادم' : e.message);
  }
}

/* ══════════════════════════════════════════════
   callAPI — Cascade الرئيسي
   يمر أولاً عبر الخادم الآمن (Netlify Function)، وإن تعذّر الوصول إليه
   فقط يرجع للاتصال المباشر من المتصفح كخطة بديلة أخيرة.
   Mistral → Cohere → Cerebras → Gemini → Pollinations → OpenRouter
   ══════════════════════════════════════════════ */
async function callAPI(prompt, useMemory = true) {
  /* ── Task Planner: تقسيم المهمة إذا كان مفعّلاً ── */
  if (typeof TaskPlanner !== 'undefined' && TaskPlanner.isEnabled()) {
    try {
      const history = useMemory ? loadMemory() : [];
      const result = await TaskPlanner.process(prompt, history);
      if (result) {
        if (useMemory) saveMemory(prompt, result);
        return result;
      }
    } catch (e) { console.warn('[TaskPlanner] fallback:', e.message); }
  }

  /* ── Parallel Engine: تشغيل متوازي إذا كان مفعّلاً ── */
  if (typeof ParallelEngine !== 'undefined' && ParallelEngine.isActive()) {
    try {
      const history = useMemory ? loadMemory() : [];
      const result = await ParallelEngine.processParallel(prompt, history);
      if (result) {
        if (useMemory) saveMemory(prompt, result);
        return result;
      }
    } catch (e) { console.warn('[ParallelEngine] fallback:', e.message); }
  }

  /* ── بحث ويب تلقائي إذا احتاج الطلب ── */
  if (typeof WebSearch !== 'undefined' && WebSearch.needsSearch(prompt)) {
    try { prompt = await WebSearch.enrichPrompt(prompt); } catch {}
  }

  const history = useMemory ? loadMemory() : [];

  let contextNote = '';
  if (useMemory && history.length > 0) {
    const pairs = [];
    for (let i = 0; i < history.length; i += 2) {
      const u = history[i], a = history[i + 1];
      if (u && a) pairs.push('U: ' + u.content.substring(0, 300) + '\nAI: ' + a.content.substring(0, 400));
    }
    if (pairs.length > 0) contextNote = '\n\n[سياق]\n' + pairs.join('\n---\n') + '\n[/سياق]';
  }

  const systemPrompt = `أنت Galaoum AI Engine v5.0 — مساعد ذكاء اصطناعي متكامل طوّره عمار جلعوم.

══ هويتك ══
• اسمك: Galaoum AI Engine v5.0 — لا تنسب نفسك لأي شركة أخرى
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
✦ الردود منظّمة: عناوين + نقاط + فقرات حسب الحاجة` + contextNote;

  const platform = (typeof getSelectedPlatform === 'function') ? getSelectedPlatform() : 'auto';

  /* ── منصة محددة يدوياً ──
     [FIX] نحاول أولاً عبر الخادم الآمن (يدعم mistral/cohere/cerebras/gemini/openrouter)
     وإن فشل (مثلاً الدالة غير منشورة على Netlify) نرجع للاتصال المباشر القديم كخطة بديلة. */
  if (platform === 'mistral') {
    try { return await callViaServerless(prompt, history, 'mistral-small-latest'); }
    catch { return await callMistralAPI(prompt, systemPrompt, history); }
  }
  if (platform === 'cohere') {
    try { return await callViaServerless(prompt, history, 'command-a-03-2025'); }
    catch { return await callCohereAPI(prompt, systemPrompt, history); }
  }
  if (platform === 'cerebras') {
    try { return await callViaServerless(prompt, history, 'gemma-4-31b'); }
    catch { return await callCerebrasAPI(prompt, systemPrompt, history); }
  }
  if (platform === 'gemini') {
    try { return await callViaServerless(prompt, history, 'gemini-2.5-flash'); }
    catch { return await callGeminiAPI(prompt, systemPrompt, history); }
  }
  if (platform === 'openrouter') {
    try { return await callViaServerless(prompt, history, 'meta-llama/llama-3.3-70b-instruct:free'); }
    catch {}
    let lastErr = 'فشل الاتصال';
    for (const model of AI_MODELS) {
      try {
        const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 28000);
        const res = await fetch(CONFIG.OPENROUTER_BASE_URL, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.OPENROUTER_API_KEY, 'HTTP-Referer': CONFIG.HTTP_REFERER, 'X-Title': CONFIG.SITE_TITLE },
          body: JSON.stringify({ model, max_tokens: 8192, messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: prompt }] })
        });
        clearTimeout(tid);
        if (!res.ok) { lastErr = 'HTTP ' + res.status; continue; }
        const reply = (await res.json()).choices?.[0]?.message?.content;
        if (reply) return reply;
      } catch (e) { lastErr = e.message; }
    }
    throw new Error(lastErr);
  }
  if (platform === 'pollinations') {
    const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${encodeURIComponent(systemPrompt)}&model=openai&private=true`, { signal: ctrl.signal });
      clearTimeout(tid);
      const text = await res.text();
      if (res.ok && text) return text.trim();
      throw new Error('HTTP ' + res.status);
    } catch (e) { clearTimeout(tid); throw new Error(e.name === 'AbortError' ? 'انتهت مهلة الاتصال' : e.message); }
  }

  if (platform === 'bazaarlink') {
    try { return await callViaServerless(prompt, history, 'gpt-4o-mini'); } catch {}
    return await callBazaarLinkAPI(prompt, systemPrompt, history);
  }

  if (platform === 'huggingface') {
    const key = CONFIG.HF_TOKEN;
    if (!key) throw new Error('HF_TOKEN غير مضبوط');
    const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: 'meta-llama/Llama-3.2-3B-Instruct', messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: prompt }], max_tokens: 4096 })
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const reply = (await res.json()).choices?.[0]?.message?.content;
      if (reply) return reply;
      throw new Error('رد فارغ');
    } catch (e) { clearTimeout(tid); throw new Error(e.message); }
  }

  if (platform === 'replicate') {
    const key = CONFIG.REPLICATE_API_TOKEN;
    if (!key) throw new Error('REPLICATE_API_TOKEN غير مضبوط');
    const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch('https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key, 'Prefer': 'wait' },
        body: JSON.stringify({ input: { prompt: prompt, system_prompt: systemPrompt, max_tokens: 4096 } })
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const output = Array.isArray(d.output) ? d.output.join('') : (d.output || '');
      if (output) return output;
      throw new Error('رد فارغ من Replicate');
    } catch (e) { clearTimeout(tid); throw new Error(e.message); }
  }

  if (platform === 'fal') {
    const key = CONFIG.FAL_KEY;
    if (!key) throw new Error('FAL_KEY غير مضبوط');
    const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch('https://fal.run/fal-ai/any-llm', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Key ' + key },
        body: JSON.stringify({ model: 'google/gemini-flash-1-5', prompt: prompt, system_prompt: systemPrompt })
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const reply = d.output || d.response || '';
      if (reply) return reply;
      throw new Error('رد فارغ من Fal');
    } catch (e) { clearTimeout(tid); throw new Error(e.message); }
  }

  /* ══════════════════════════════════════════════
     الكاسكيد التلقائي الشامل
     المنطق: الخادم (Netlify) يدعم كل المزودين دون CORS
     الخطة الاحتياطية: استدعاء مباشر من المتصفح لمن يدعم CORS
     ══════════════════════════════════════════════ */
  let _lastErr = 'فشل الاتصال';

  /* 1️⃣ Netlify Function — يمر بالكاسكيد الكامل (BazaarLink→Mistral→Cohere→Cerebras→OpenRouter→Gemini) */
  try {
    return await callViaServerless(prompt, history, null);
  } catch (_se) { _lastErr = 'الخادم: ' + _se.message; }

  /* 2️⃣ BazaarLink مباشر من المتصفح — 200+ نموذج، قد يدعم CORS */
  try {
    return await callBazaarLinkAPI(prompt, systemPrompt, history);
  } catch (_be) { _lastErr = 'BazaarLink: ' + _be.message; }

  /* 3️⃣ OpenRouter — يدعم CORS، نماذج مجانية */
  for (const model of AI_MODELS) {
    try {
      const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 28000);
      const res = await fetch(CONFIG.OPENROUTER_BASE_URL, {
        method: 'POST', signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + CONFIG.OPENROUTER_API_KEY,
          'HTTP-Referer': CONFIG.HTTP_REFERER,
          'X-Title': CONFIG.SITE_TITLE
        },
        body: JSON.stringify({
          model,
          max_tokens: 8192,
          messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: prompt }]
        })
      });
      clearTimeout(tid);
      if (!res.ok) { _lastErr = 'OpenRouter HTTP ' + res.status; continue; }
      const reply = (await res.json()).choices?.[0]?.message?.content;
      if (reply) return reply;
    } catch (e) { _lastErr = e.message; }
  }

  /* 4️⃣ Gemini — يدعم CORS (المفتاح يجب أن يبدأ بـ AIza) */
  const _validGeminiKeys = CONFIG.GEMINI_API_KEYS.filter(k => k && k.startsWith('AIza') && !k.includes('_HERE') && k.length > 20);
  if (_validGeminiKeys.length > 0) {
    try {
      const _r = await callGeminiAPI(prompt, systemPrompt, history);
      if (_r) return _r;
    } catch (_ge) { _lastErr = 'Gemini: ' + _ge.message; }
  }

  /* 5️⃣ Pollinations — مجاني ويدعم CORS، خط الدفاع الأخير */
  /* ملاحظة: model=openai فقط يعمل (openai-large مُهمَل ويُعيد نص النظام) */
  try {
    const _pCtrl = new AbortController(), _pTid = setTimeout(() => _pCtrl.abort(), 30000);
    const _pRes = await fetch(
      `https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${encodeURIComponent(systemPrompt.substring(0, 600))}&model=openai&private=true`,
      { signal: _pCtrl.signal }
    );
    clearTimeout(_pTid);
    const _pTxt = await _pRes.text();
    /* تحقق أن الرد ليس نص النظام نفسه */
    if (_pRes.ok && _pTxt && _pTxt.trim().length > 5 && !_pTxt.includes('Galaoum AI Engine') && !_pTxt.startsWith('أنت ')) return _pTxt.trim();
  } catch (_pe) { _lastErr = 'Pollinations: ' + _pe.message; }

  throw new Error('⚠️ فشلت جميع المزودين. تأكد من نشر الموقع على Netlify أو تحقق من مفاتيح API في config.js. آخر خطأ: ' + _lastErr);
}

/* ══════════════════════════════════════════════
   callVisionAPI — تحليل الصور
   ══════════════════════════════════════════════ */
async function callVisionAPI(prompt, dataUrl, mimeType = 'image/jpeg') {
  const visionSystemPrompt = `أنت Galaoum AI Engine — محلّل صور متقدم طوّره عمار جلعوم.
حلّل الصورة بدقة وأجب على طلب المستخدم بالعربية. إذا طُلب وصف الصورة: صِفها بالتفصيل.
إذا طُلب تعديل: اشرح بالضبط ما سيتم تعديله وأنشئ prompt إنجليزي للتوليد.`;

  const geminiKeys = CONFIG.GEMINI_API_KEYS.filter(k => k && !k.includes('_HERE'));
  if (geminiKeys.length > 0) {
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    for (const model of ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']) {
      const keys = CONFIG.GEMINI_API_KEYS.filter(k => k && !k.includes('_HERE'));
      for (let ki = 0; ki < keys.length; ki++) {
        const apiKey = GeminiKeyManager.getKey();
        if (!apiKey) break;
        try {
          const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 35000);
          const res = await fetch(GeminiKeyManager.buildUrl(model, apiKey), {
            method: 'POST', signal: ctrl.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemInstruction: { parts: [{ text: visionSystemPrompt }] }, contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] }], generationConfig: { maxOutputTokens: 4096 } })
          });
          clearTimeout(tid);
          if (res.status === 429) { GeminiKeyManager.nextKey(); continue; }
          if (!res.ok) break;
          const reply = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) return reply;
        } catch {}
      }
    }
  }

  let lastErr = 'فشل التحليل';
  for (const model of VISION_MODELS) {
    try {
      const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(CONFIG.OPENROUTER_BASE_URL, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.OPENROUTER_API_KEY, 'HTTP-Referer': CONFIG.HTTP_REFERER, 'X-Title': CONFIG.SITE_TITLE },
        body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role: 'system', content: visionSystemPrompt }, { role: 'user', content: [{ type: 'image_url', image_url: { url: dataUrl } }, { type: 'text', text: prompt }] }] })
      });
      clearTimeout(tid);
      if (!res.ok) { lastErr = 'HTTP ' + res.status; continue; }
      const reply = (await res.json()).choices?.[0]?.message?.content;
      if (reply) return reply;
    } catch (e) { lastErr = e.name === 'AbortError' ? 'انتهت مهلة تحليل الصورة' : e.message; }
  }
  throw new Error(lastErr);
}

/* ══════════════════════════════════════════════
   generateImage — Pollinations.ai
   ══════════════════════════════════════════════ */
async function generateImage(prompt, style = '') {
  const quality = 'ultra detailed, professional, 8k, masterpiece, sharp focus';
  const styleTag = style ? style + ', ' : '';
  const hasArabic = /[\u0600-\u06FF]/.test(prompt);
  const clean = hasArabic
    ? (styleTag + prompt + ', ' + quality).trim().substring(0, 700)
    : (styleTag + prompt + ', ' + quality).replace(/[^a-zA-Z0-9 ,.!?\-]/g, ' ').trim().substring(0, 700);
  const seed = Math.floor(Math.random() * 999999);
  const url  = CONFIG.POLLINATIONS_IMAGE_URL + encodeURIComponent(clean) + '?width=1024&height=1024&nologo=true&model=flux&enhance=true&seed=' + seed;
  const apiKey = CONFIG.POLLINATIONS_API_KEY;
  if (apiKey) {
    const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 40000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Authorization': 'Bearer ' + apiKey } });
    clearTimeout(tid);
    if (!res.ok) throw new Error('فشل توليد الصورة (HTTP ' + res.status + ')');
    return URL.createObjectURL(await res.blob());
  }
  await new Promise((res, rej) => { const img = new Image(); img.onload = res; img.onerror = rej; setTimeout(rej, 35000); img.src = url; });
  return url;
}

async function enhanceImagePrompt(arabicRequest) {
  try { return (await callAPI('You are an expert AI image prompt engineer. Convert this Arabic request to a professional English image generation prompt. Output ONLY the English prompt, no explanation.\n\nRequest: ' + arabicRequest, false)) || arabicRequest; }
  catch { return arabicRequest; }
}

/* ══════════════════════════════════════════════
   executeCode — Wandbox
   ══════════════════════════════════════════════ */
async function executeCode(lang, code) {
  const compiler = LANG_MAP[lang.toLowerCase()];
  if (!compiler) throw new Error('اللغة ' + lang + ' غير مدعومة حالياً');
  const res = await fetch(WANDBOX, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ compiler, code }) });
  if (!res.ok) throw new Error('فشل الاتصال بمحرك التشغيل (HTTP ' + res.status + ')');
  const d = await res.json();
  if (d.status === 'CE' || d.compiler_error) throw new Error('خطأ في الكود: ' + (d.compiler_error || '').trim());
  return { output: (d.program_output || '').trim(), stderr: (d.program_error || '').trim(), exitCode: (d.status === '0' || d.status === 0) ? 0 : 1, language: lang, version: compiler };
}

/* ══════════════════════════════════════════════
   searchWeb — DuckDuckGo + Jina AI
   ══════════════════════════════════════════════ */
async function searchWeb(query) {
  let out = '';
  try {
    const res = await fetch('https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1', { headers: { 'Accept': 'application/json' } });
    const d = await res.json();
    if (d.AbstractText) out += '📌 **' + d.AbstractTitle + '**\n' + d.AbstractText + '\n\n';
    if (d.Answer)       out += '💡 ' + d.Answer + '\n\n';
    if (d.Definition)   out += '📖 ' + d.Definition + '\n\n';
    const topics = (d.RelatedTopics || []).filter(t => t.Text).slice(0, 6);
    if (topics.length)  out += topics.map(t => '• ' + t.Text.substring(0, 150)).join('\n') + '\n\n';
    if (d.AbstractURL)  out += '🔗 ' + d.AbstractURL + '\n\n';
    if (d.Answer || d.AbstractText) out += '---\n';
  } catch {}
  if (!out.trim()) {
    try {
      const r = await fetch('https://s.jina.ai/' + encodeURIComponent(query), { headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' } });
      const text = await r.text();
      out = text.substring(0, 3000) + (text.length > 3000 ? '\n...[مقتطع]' : '');
    } catch { out = 'فشل البحث في المصدرين.'; }
  }
  return out.trim() || 'لم أجد معلومات فورية — سأجيب من معرفتي.';
}

async function readURL(url) {
  try {
    const res  = await fetch('https://r.jina.ai/' + url, { headers: { 'Accept': 'text/plain', 'X-Return-Format': 'text' } });
    const text = await res.text();
    return text.substring(0, 3000) + (text.length > 3000 ? '\n...[مقتطع]' : '');
  } catch (e) { return 'فشل قراءة الصفحة: ' + e.message; }
}

/* deployToNetlify — نشر الموقع مباشرة على Netlify */
const NETLIFY_CHAT_FUNCTION = `exports.handler = async (event) => {
  const headers = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS"};
  if (event.httpMethod === "OPTIONS") return {statusCode:200,headers,body:""};
  if (event.httpMethod !== "POST") return {statusCode:405,headers,body:JSON.stringify({error:"Method Not Allowed"})};
  try {
    const {prompt,history} = JSON.parse(event.body||"{}");
    if (!prompt?.trim()) return {statusCode:400,headers,body:JSON.stringify({error:"Prompt مطلوب"})};
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return {statusCode:500,headers,body:JSON.stringify({error:"OPENROUTER_API_KEY غير مضبوط"})};
    const models=["nvidia/nemotron-3-ultra-550b-a55b:free","meta-llama/llama-3.3-70b-instruct:free","google/gemma-4-31b-it:free"];
    for(const model of models){
      try{
        const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+apiKey},body:JSON.stringify({model,max_tokens:8192,messages:[{role:"user",content:prompt}]})});
        const d=await r.json();const reply=d.choices?.[0]?.message?.content;if(reply)return{statusCode:200,headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({reply,model})};
      }catch{}
    }
    return{statusCode:503,headers,body:JSON.stringify({error:"فشل جميع النماذج"})};
  }catch(e){return{statusCode:500,headers,body:JSON.stringify({error:e.message})};}
};`;

async function deployToNetlify(files) {
  const token  = CONFIG.NETLIFY_ACCESS_TOKEN;
  const siteId = CONFIG.NETLIFY_SITE_ID;
  if (!token || !siteId) throw new Error('بيانات Netlify غير مضبوطة في CONFIG');
  const allFiles = { ...files, 'netlify/functions/chat.js': NETLIFY_CHAT_FUNCTION };
  const hashes = {};
  const encoded = {};
  for (const [path, content] of Object.entries(allFiles)) {
    const bytes = new TextEncoder().encode(content);
    const hashBuf = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    hashes['/'+path] = hash;
    encoded[hash] = content;
  }
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ files: hashes, async: false })
  });
  if (!deployRes.ok) { const e = await deployRes.json().catch(() => ({})); throw new Error(e.message || 'فشل إنشاء النشر (HTTP ' + deployRes.status + ')'); }
  const deploy = await deployRes.json();
  const needed = deploy.required || [];
  for (const hash of needed) {
    const content = encoded[hash];
    if (!content) continue;
    const uploadRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${hash}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/octet-stream', 'Authorization': 'Bearer ' + token },
      body: new TextEncoder().encode(content)
    });
    if (!uploadRes.ok) throw new Error('فشل رفع ملف (HTTP ' + uploadRes.status + ')');
  }
  return deploy;
}
