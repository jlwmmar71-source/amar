/* ══════════════════════════════════════════════════════════════
   semantic-search.js — البحث الدلالي الذكي (Semantic Search)
   يبحث بالمعنى لا بالنص الحرفي فقط — TF-IDF + Cosine Similarity
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.SemanticSearch = (function () {

  /* ══ قاموس الترادفات العربي/الإنجليزي ══ */
  const SYNONYMS = {
    'إصلاح':   ['fix', 'repair', 'debug', 'حل', 'تصحيح'],
    'بناء':    ['build', 'create', 'إنشاء', 'تطوير', 'develop'],
    'تحليل':   ['analyze', 'فحص', 'دراسة', 'inspect', 'examine'],
    'بحث':     ['search', 'find', 'look', 'ابحث', 'ابحث عن'],
    'تعديل':   ['edit', 'modify', 'update', 'تحديث', 'change'],
    'شرح':     ['explain', 'describe', 'وصف', 'توضيح', 'clarify'],
    'صورة':    ['image', 'photo', 'picture', 'رسم', 'generate image'],
    'كود':     ['code', 'برمجة', 'script', 'program', 'function'],
    'نشر':     ['deploy', 'publish', 'hosting', 'رفع'],
    'أداء':    ['performance', 'speed', 'سرعة', 'تحسين', 'optimize']
  };

  /* ══ فهرس الوثائق ══ */
  let _index = [];   // [{ id, title, text, tokens, tfidf }]
  let _idf   = {};   // token → idf weight
  let _built = false;

  /* ── تحويل النص إلى رموز (tokens) ── */
  function _tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\u0600-\u06FFa-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  /* ── توسيع الاستعلام بالترادفات ── */
  function _expand(tokens) {
    const expanded = new Set(tokens);
    tokens.forEach(t => {
      /* ابحث في قاموس الترادفات */
      Object.entries(SYNONYMS).forEach(([key, syns]) => {
        if (key === t || syns.includes(t)) {
          expanded.add(key);
          syns.forEach(s => expanded.add(s));
        }
      });
    });
    return [...expanded];
  }

  /* ── حساب TF لوثيقة ── */
  function _tf(tokens) {
    const freq = {};
    tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
    const max = Math.max(...Object.values(freq), 1);
    const tf  = {};
    Object.entries(freq).forEach(([t, c]) => { tf[t] = c / max; });
    return tf;
  }

  /* ── بناء IDF لجميع الوثائق ── */
  function _buildIDF(docs) {
    const N   = docs.length;
    const df  = {};
    docs.forEach(d => {
      const uniq = new Set(d.tokens);
      uniq.forEach(t => { df[t] = (df[t] || 0) + 1; });
    });
    const idf = {};
    Object.entries(df).forEach(([t, c]) => {
      idf[t] = Math.log((N + 1) / (c + 1)) + 1;
    });
    return idf;
  }

  /* ── حساب TF-IDF vector ── */
  function _tfidfVec(tf, idf) {
    const vec = {};
    Object.entries(tf).forEach(([t, v]) => {
      vec[t] = v * (idf[t] || 1);
    });
    return vec;
  }

  /* ── حساب Cosine Similarity بين متجهين ── */
  function _cosine(vecA, vecB) {
    let dot = 0, normA = 0, normB = 0;
    const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    keys.forEach(k => {
      const a = vecA[k] || 0;
      const b = vecB[k] || 0;
      dot   += a * b;
      normA += a * a;
      normB += b * b;
    });
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom ? dot / denom : 0;
  }

  /* ═══════════════════════════════════════════════════════
     بناء الفهرس من قائمة وثائق
     docs: [{ id, title, text }]
     ═══════════════════════════════════════════════════════ */
  function buildIndex(docs) {
    if (!docs || docs.length === 0) return;
    const timer = Logger.time('ss:index');

    const indexed = docs.map(d => ({
      ...d,
      tokens: _tokenize(`${d.title} ${d.text}`)
    }));

    const idf = _buildIDF(indexed);
    _idf      = idf;

    _index = indexed.map(d => ({
      ...d,
      tfidf: _tfidfVec(_tf(d.tokens), idf)
    }));

    _built = true;
    Logger.time(timer);
    Logger.info('SEARCH', `📚 فهرس بُني: ${_index.length} وثيقة`);
  }

  /* ═══════════════════════════════════════════════════════
     بحث دلالي
     ═══════════════════════════════════════════════════════ */
  function search(query, topK = 5) {
    if (!query || !_built || _index.length === 0) {
      return { results: [], fallback: true };
    }

    const timer = Logger.time('ss:search');
    const rawTokens  = _tokenize(query);
    const expanded   = _expand(rawTokens);
    const qTF        = _tf(expanded);
    const qVec       = _tfidfVec(qTF, _idf);

    const scored = _index.map(doc => ({
      ...doc,
      score: _cosine(qVec, doc.tfidf)
    }));

    scored.sort((a, b) => b.score - a.score);
    const results = scored
      .filter(d => d.score > 0.05)
      .slice(0, topK)
      .map(d => ({
        id:      d.id,
        title:   d.title,
        excerpt: d.text.substring(0, 200),
        score:   Math.round(d.score * 100)
      }));

    Logger.time(timer);
    Logger.info('SEARCH', `🔍 "${query}" → ${results.length} نتيجة (أعلى: ${results[0]?.score || 0}%)`);
    return { results, query, expanded, topK };
  }

  /* ═══════════════════════════════════════════════════════
     فهرسة المحادثات الحالية (للبحث في سجل المحادثات)
     ═══════════════════════════════════════════════════════ */
  function indexConversations() {
    const docs = [];
    try {
      const stored = localStorage.getItem('galaoum_conversations');
      if (!stored) return;
      const convs = JSON.parse(stored);
      Object.entries(convs).forEach(([id, conv]) => {
        if (!conv.messages) return;
        const text = conv.messages
          .filter(m => m.role === 'assistant')
          .map(m => m.content)
          .join('\n')
          .substring(0, 2000);
        if (text.length > 20) {
          docs.push({ id: `conv:${id}`, title: conv.title || `محادثة ${id}`, text });
        }
      });
    } catch {}

    if (docs.length > 0) {
      buildIndex(docs);
    }
  }

  /* ═══════════════════════════════════════════════════════
     فهرسة ملفات المشروع
     ═══════════════════════════════════════════════════════ */
  function indexProjectFiles(files) {
    const docs = files
      .filter(f => f.content && f.content.length > 0)
      .map(f => ({
        id:    `file:${f.name}`,
        title: f.name,
        text:  f.content.substring(0, 5000)
      }));
    buildIndex(docs);
  }

  /* ── بحث نصي بسيط (fallback) ── */
  function textSearch(query, files) {
    const q   = query.toLowerCase();
    const results = [];
    files.forEach(f => {
      const idx = f.content.toLowerCase().indexOf(q);
      if (idx >= 0) {
        const start = Math.max(0, idx - 50);
        results.push({
          file:    f.name,
          excerpt: f.content.substring(start, start + 200),
          pos:     idx
        });
      }
    });
    return results;
  }

  return { buildIndex, search, indexConversations, indexProjectFiles, textSearch };
})();
