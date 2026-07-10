/* ══════════════════════════════════════════════
   streaming.js — محرك الاستجابة المتدفقة
   Galaoum AI Engine v6.0 — by عمار جلعوم

   ⚡ يعرض الرد كلمة بكلمة بدل الانتظار الكامل
   — Real streaming: OpenRouter + Gemini مباشرة من المتصفح
   — Typewriter fallback: للمزودين الآخرين
   ══════════════════════════════════════════════ */

window.StreamingEngine = (function () {

  let _active = true; // مفعّل افتراضياً

  /* ─── OpenRouter SSE Streaming ─── */
  async function streamOpenRouter(prompt, systemPrompt, history, onChunk, signal) {
    const key = (typeof CONFIG !== 'undefined') ? CONFIG.OPENROUTER_API_KEY : '';
    if (!key) throw new Error('OPENROUTER_API_KEY غير متوفر');

    const models = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-4-31b-it:free',
      'qwen/qwen3-coder:free'
    ];

    for (const model of models) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key,
            'HTTP-Referer': (typeof CONFIG !== 'undefined') ? CONFIG.HTTP_REFERER : '',
            'X-Title': 'Galaoum AI Engine v6.0'
          },
          body: JSON.stringify({
            model,
            max_tokens: 8192,
            stream: true,
            messages: [
              { role: 'system', content: systemPrompt },
              ...history,
              { role: 'user', content: prompt }
            ]
          })
        });

        if (!res.ok || !res.body) continue;

        const reader  = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let   full    = '';
        let   done    = false;

        while (!done) {
          const { value, done: d } = await reader.read();
          done = d;
          if (!value) continue;

          const lines = decoder.decode(value).split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') { done = true; break; }
            try {
              const json  = JSON.parse(data);
              const delta = json.choices?.[0]?.delta?.content || '';
              if (delta) { full += delta; onChunk(delta, full); }
            } catch {}
          }
        }

        if (full.length > 5) return full;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
      }
    }
    throw new Error('OpenRouter streaming: فشلت جميع النماذج');
  }

  /* ─── Gemini SSE Streaming ─── */
  async function streamGemini(prompt, systemPrompt, history, onChunk, signal) {
    const keys = (typeof CONFIG !== 'undefined')
      ? CONFIG.GEMINI_API_KEYS.filter(k => k && !k.includes('_HERE') && k.startsWith('AIza'))
      : [];
    if (!keys.length) throw new Error('لا مفاتيح Gemini');

    const geminiHistory = history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
      for (const key of keys) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}&alt=sse`;
          const res = await fetch(url, {
            method: 'POST',
            signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [...geminiHistory, { role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 8192 }
            })
          });

          if (!res.ok || !res.body) continue;

          const reader  = res.body.getReader();
          const decoder = new TextDecoder();
          let   full    = '';
          let   done    = false;

          while (!done) {
            const { value, done: d } = await reader.read();
            done = d;
            if (!value) continue;
            const lines = decoder.decode(value).split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;
              try {
                const json  = JSON.parse(data);
                const parts = json.candidates?.[0]?.content?.parts || [];
                const text  = parts.find(p => p.text && !p.thought)?.text || '';
                if (text) { full += text; onChunk(text, full); }
              } catch {}
            }
          }

          if (full.length > 5) return full;
        } catch (e) {
          if (e.name === 'AbortError') throw e;
        }
      }
    }
    throw new Error('Gemini streaming: فشل');
  }

  /* ─── Typewriter Effect Fallback ─── */
  async function typewriter(fullText, onChunk, charsPerTick = 4, tickMs = 18) {
    for (let i = 0; i < fullText.length; i += charsPerTick) {
      const chunk = fullText.slice(i, i + charsPerTick);
      onChunk(chunk, fullText.slice(0, i + charsPerTick));
      await new Promise(r => setTimeout(r, tickMs));
    }
    return fullText;
  }

  /* ─── الدالة الرئيسية ─── */
  async function streamResponse(prompt, systemPrompt, history, onChunk, onDone, onError) {
    if (!_active) return null;

    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 45000);

    try {
      let result = null;

      /* 1. جرّب OpenRouter streaming أولاً */
      try {
        result = await streamOpenRouter(prompt, systemPrompt, history, onChunk, ctrl.signal);
      } catch (e1) {
        if (e1.name === 'AbortError') throw e1;
        /* 2. جرّب Gemini streaming */
        try {
          result = await streamGemini(prompt, systemPrompt, history, onChunk, ctrl.signal);
        } catch (e2) {
          if (e2.name === 'AbortError') throw e2;
          /* 3. Typewriter fallback — نستدعي callAPI العادي ثم نعرضه بتأثير الكتابة */
          const fullReply = await (typeof callAPI === 'function'
            ? callAPI(prompt, true)
            : Promise.reject(new Error('callAPI غير متاح')));
          result = await typewriter(fullReply, onChunk);
        }
      }

      clearTimeout(tid);
      if (onDone) onDone(result);
      return result;

    } catch (err) {
      clearTimeout(tid);
      if (onError) onError(err);
      throw err;
    }
  }

  /* ─── Toggle ─── */
  function setEnabled(v) {
    _active = v;
    try { localStorage.setItem('galaoum_streaming', v ? '1' : '0'); } catch {}
  }

  function isEnabled() { return _active; }

  /* ─── استعادة الإعداد ─── */
  try {
    const saved = localStorage.getItem('galaoum_streaming');
    if (saved === '0') _active = false;
  } catch {}

  /* ─── بناء System Prompt ─── */
  function buildSystemPrompt() {
    return `أنت Galaoum AI Engine v6.0 — مساعد ذكاء اصطناعي متكامل طوّره عمار جلعوم.
لغة الرد: عربية دائماً ما لم يطلب المستخدم غيرها.
• الكود دائماً كامل 100% داخل \`\`\` بدون اختصار.
• لا تبدأ بـ"مرحباً" أو "بالطبع!" — انتقل للمحتوى فوراً.`;
  }

  return { streamResponse, setEnabled, isEnabled, typewriter, buildSystemPrompt };

})();
