/* ══════════════════════════════════════════════════════════════
   model-manager.js — مدير النماذج (Model Manager)
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.ModelManager = (function () {

  const MODELS = {
    /* ─── Mistral ─── */
    'mistral-small-latest': {
      id: 'mistral-small-latest', provider: 'mistral',
      strengths: ['general', 'chat', 'code', 'arabic'], maxTokens: 8192,
      costTier: 'paid', speed: 'fast', label: 'Mistral Small'
    },
    'mistral-medium-latest': {
      id: 'mistral-medium-latest', provider: 'mistral',
      strengths: ['general', 'reasoning', 'code', 'analysis'], maxTokens: 8192,
      costTier: 'paid', speed: 'medium', label: 'Mistral Medium'
    },
    'open-mistral-7b': {
      id: 'open-mistral-7b', provider: 'mistral',
      strengths: ['general', 'chat', 'fast'], maxTokens: 8192,
      costTier: 'paid', speed: 'fast', label: 'Mistral 7B'
    },

    /* ─── Cohere ─── */
    'command-a-03-2025': {
      id: 'command-a-03-2025', provider: 'cohere',
      strengths: ['general', 'arabic', 'analysis', 'chat'], maxTokens: 8192,
      costTier: 'paid', speed: 'fast', label: 'Cohere Command-A'
    },

    /* ─── Cerebras ─── */
    'gemma-4-31b': {
      id: 'gemma-4-31b', provider: 'cerebras',
      strengths: ['general', 'code', 'fast', 'chat'], maxTokens: 8192,
      costTier: 'paid', speed: 'fast', label: 'Cerebras Gemma 31B'
    },

    /* ─── OpenRouter — 6 نماذج مجانية ─── */
    'google/gemma-4-31b-it:free': {
      id: 'google/gemma-4-31b-it:free', provider: 'openrouter',
      strengths: ['general', 'chat', 'analysis', 'code'], maxTokens: 8192,
      costTier: 'free', speed: 'fast', label: 'Gemma 4 31B'
    },
    'google/gemma-4-26b-a4b-it:free': {
      id: 'google/gemma-4-26b-a4b-it:free', provider: 'openrouter',
      strengths: ['code', 'analysis', 'reasoning'], maxTokens: 8192,
      costTier: 'free', speed: 'fast', label: 'Gemma 4 26B'
    },
    'nvidia/nemotron-3-super-120b-a12b:free': {
      id: 'nvidia/nemotron-3-super-120b-a12b:free', provider: 'openrouter',
      strengths: ['reasoning', 'analysis', 'code'], maxTokens: 32768,
      costTier: 'free', speed: 'medium', label: 'Nemotron Super 120B'
    },
    'nvidia/nemotron-3-nano-30b-a3b:free': {
      id: 'nvidia/nemotron-3-nano-30b-a3b:free', provider: 'openrouter',
      strengths: ['general', 'chat', 'fast'], maxTokens: 16384,
      costTier: 'free', speed: 'fast', label: 'Nemotron Nano 30B'
    },
    'poolside/laguna-xs.2:free': {
      id: 'poolside/laguna-xs.2:free', provider: 'openrouter',
      strengths: ['code', 'general'], maxTokens: 16384,
      costTier: 'free', speed: 'fast', label: 'Laguna XS'
    },
    'liquid/lfm-2.5-1.2b-instruct:free': {
      id: 'liquid/lfm-2.5-1.2b-instruct:free', provider: 'openrouter',
      strengths: ['general', 'chat'], maxTokens: 8192,
      costTier: 'free', speed: 'fast', label: 'LFM 2.5 1.2B'
    },

    /* ─── Gemini ─── */
    'gemini-2.5-flash': {
      id: 'gemini-2.5-flash', provider: 'gemini',
      strengths: ['vision', 'fast', 'multimodal', 'analysis'], maxTokens: 8192,
      costTier: 'free', speed: 'fast', label: 'Gemini 2.5 Flash'
    },
    'gemini-2.5-flash-lite': {
      id: 'gemini-2.5-flash-lite', provider: 'gemini',
      strengths: ['fast', 'general', 'chat'], maxTokens: 8192,
      costTier: 'free', speed: 'fast', label: 'Gemini 2.5 Flash Lite'
    },
    'gemini-3.5-flash': {
      id: 'gemini-3.5-flash', provider: 'gemini',
      strengths: ['general', 'reasoning', 'analysis'], maxTokens: 16384,
      costTier: 'free', speed: 'medium', label: 'Gemini 3.5 Flash'
    },
    'gemini-3-flash-preview': {
      id: 'gemini-3-flash-preview', provider: 'gemini',
      strengths: ['general', 'analysis', 'code'], maxTokens: 16384,
      costTier: 'free', speed: 'medium', label: 'Gemini 3 Flash'
    }
  };

  const _usage = {}, _failures = {}, _latency = {};

  function _initStats(modelId) {
    if (!_usage[modelId])    _usage[modelId]    = { calls: 0, tokens: 0, errors: 0 };
    if (!_failures[modelId]) _failures[modelId] = { count: 0, lastFail: null };
    if (!_latency[modelId])  _latency[modelId]  = { total: 0, count: 0 };
  }

  function recordSuccess(modelId, tokensUsed, latencyMs) {
    _initStats(modelId);
    _usage[modelId].calls++;
    _usage[modelId].tokens += (tokensUsed || 0);
    _latency[modelId].total += (latencyMs || 0);
    _latency[modelId].count++;
    _failures[modelId].count = Math.max(0, _failures[modelId].count - 1);
  }

  function recordFailure(modelId, reason) {
    _initStats(modelId);
    _usage[modelId].errors++;
    _failures[modelId].count++;
    _failures[modelId].lastFail = Date.now();
    if (typeof Logger !== 'undefined') Logger.warn('MODEL', `⚠️ فشل نموذج ${modelId}: ${reason}`);
  }

  function selectBest(task, requirements = {}) {
    const taskLower = (task || '').toLowerCase();
    const available = Object.values(MODELS).filter(m => {
      const f = _failures[m.id];
      if (!f) return true;
      if (f.count >= 3) return Date.now() - (f.lastFail || 0) > 5 * 60 * 1000;
      return true;
    });
    const scored = available.map(m => {
      let score = 0;
      if (requirements.provider && m.provider === requirements.provider) score += 5;
      if (/صور?|image|vision/.test(taskLower)   && m.strengths.includes('vision'))     score += 8;
      if (/كود|code|برمجة/.test(taskLower)       && m.strengths.includes('code'))       score += 7;
      if (/تحليل|analyze|شرح/.test(taskLower)   && m.strengths.includes('analysis'))   score += 6;
      if (/استنتاج|reason|logic/.test(taskLower) && m.strengths.includes('reasoning')) score += 5;
      if (/عرب|arabic/.test(taskLower)           && m.strengths.includes('arabic'))     score += 4;
      if (m.costTier === 'free') score += 2;
      if (m.speed === 'fast')    score += 1;
      const u = _usage[m.id];
      if (u && u.calls > 0) score += 1;
      return { model: m, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.model;
  }

  function _similarity(a, b) {
    const sa = new Set(a.split(/\s+/)), sb = new Set(b.split(/\s+/));
    const inter = [...sa].filter(w => sb.has(w)).length;
    return new Set([...sa, ...sb]).size ? inter / new Set([...sa, ...sb]).size : 0;
  }

  async function mergeResponses(responses) {
    if (!responses || responses.length === 0) return '';
    if (responses.length === 1) return responses[0].text;
    const valid = responses.filter(r => r.text && r.text.trim().length > 20);
    if (valid.length === 0) return '';
    if (valid.length === 1) return valid[0].text;
    const sim = _similarity(valid[0].text, valid[1].text);
    if (sim > 0.7) return valid[0].text;
    return `${valid[0].text}\n\n---\n**رأي إضافي:**\n${valid[1].text}`;
  }

  function getStats() {
    return Object.values(MODELS).map(m => {
      const u = _usage[m.id]    || { calls: 0, tokens: 0, errors: 0 };
      const l = _latency[m.id]  || { total: 0, count: 0 };
      const f = _failures[m.id] || { count: 0 };
      return { id: m.id, label: m.label, provider: m.provider, calls: u.calls, tokens: u.tokens, errors: u.errors, fails: f.count, avgMs: l.count ? Math.round(l.total / l.count) : 0 };
    });
  }

  function list() { return Object.values(MODELS); }

  return { selectBest, recordSuccess, recordFailure, mergeResponses, getStats, list, MODELS };
})();
