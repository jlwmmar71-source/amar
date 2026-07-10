/**
 * Web Search System — Galaoum AI Engine v5.0
 * بحث حقيقي في الإنترنت مع تلخيص ذكي
 */
class WebSearchSystem {
  constructor() {
    this.isOpen = false;
    this.searching = false;
    this.lastResults = [];
    this.lastSummary = '';
    this.summarizeActive = true;
    this.searchType = 'web';
    this.init();
  }

  init() {
    this.injectStyles();
    this.injectHTML();
    this.bindEvents();
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #ws-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 9990;
        backdrop-filter: blur(6px);
      }
      #ws-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(95vw, 860px);
        max-height: 90vh;
        background: #0f1117;
        border: 1px solid #2a2d3a;
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        z-index: 9991;
        overflow: hidden;
        font-family: 'Segoe UI', sans-serif;
      }
      #ws-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px;
        border-bottom: 1px solid #2a2d3a;
        background: #13161f;
      }
      #ws-header h2 { margin: 0; font-size: 1.15rem; color: #e2e8f0; font-weight: 600; }
      #ws-header h2 span { color: #3b82f6; }
      #ws-close {
        background: none; border: none; color: #8892a4;
        font-size: 1.4rem; cursor: pointer; padding: 4px 8px;
        border-radius: 6px; transition: all 0.2s;
      }
      #ws-close:hover { background: #1e2130; color: #e2e8f0; }
      #ws-search-bar {
        padding: 16px 22px;
        border-bottom: 1px solid #2a2d3a;
        background: #13161f;
        display: flex;
        gap: 10px;
      }
      #ws-query {
        flex: 1;
        background: #1a1d2e;
        border: 1px solid #2a2d3a;
        border-radius: 10px;
        color: #e2e8f0;
        padding: 11px 16px;
        font-size: 0.95rem;
        font-family: inherit;
        direction: auto;
        outline: none;
        transition: border-color 0.2s;
      }
      #ws-query:focus { border-color: #3b82f6; }
      #ws-search-btn {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white; border: none; border-radius: 10px;
        padding: 0 22px; font-size: 0.95rem; font-weight: 600;
        cursor: pointer; transition: all 0.2s; white-space: nowrap;
      }
      #ws-search-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      #ws-search-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      #ws-options {
        display: flex; gap: 8px; padding: 10px 22px;
        border-bottom: 1px solid #2a2d3a;
        flex-wrap: wrap; background: #0f1117; align-items: center;
      }
      .ws-opt-chip {
        padding: 5px 12px; border-radius: 20px; font-size: 0.78rem;
        cursor: pointer; border: 1px solid #2a2d3a;
        color: #8892a4; background: #13161f; transition: all 0.2s;
      }
      .ws-opt-chip.active { border-color: #3b82f6; color: #60a5fa; background: #1e2f4a; }
      #ws-body {
        flex: 1; overflow-y: auto;
        padding: 20px 22px;
        display: flex; flex-direction: column; gap: 16px;
      }
      #ws-body::-webkit-scrollbar { width: 5px; }
      #ws-body::-webkit-scrollbar-thumb { background: #2a2d3a; border-radius: 4px; }
      #ws-summary-box {
        background: linear-gradient(135deg, #0a1628, #0d1e38);
        border: 1px solid #1d3557; border-radius: 12px;
        padding: 18px; display: none;
      }
      #ws-summary-box h3 { margin: 0 0 12px; font-size: 0.9rem; color: #60a5fa; }
      #ws-summary-text {
        color: #c8d0e0; font-size: 0.9rem;
        line-height: 1.7; direction: auto; white-space: pre-wrap;
      }
      .ws-result-card {
        background: #13161f; border: 1px solid #2a2d3a;
        border-radius: 12px; padding: 16px 18px;
        transition: border-color 0.2s;
      }
      .ws-result-card:hover { border-color: #3b82f6; }
      .ws-result-title {
        font-size: 0.95rem; color: #60a5fa; font-weight: 600;
        margin-bottom: 6px; cursor: pointer; text-decoration: none; display: block;
      }
      .ws-result-title:hover { text-decoration: underline; }
      .ws-result-url { font-size: 0.75rem; color: #10b981; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ws-result-snippet { font-size: 0.85rem; color: #8892a4; line-height: 1.6; direction: auto; }
      #ws-empty {
        flex: 1; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #5a6478; gap: 12px; padding: 40px; text-align: center;
      }
      #ws-loading {
        display: none; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 16px; padding: 40px; color: #8892a4;
      }
      .ws-loading-bar { width: 200px; height: 4px; background: #1a1d2e; border-radius: 2px; overflow: hidden; }
      .ws-loading-bar-inner {
        height: 100%; background: linear-gradient(90deg, #3b82f6, #7c5cbf);
        border-radius: 2px; animation: ws-progress 1.5s ease-in-out infinite;
      }
      @keyframes ws-progress { 0%{width:0%} 50%{width:80%} 100%{width:100%} }
      #ws-footer {
        padding: 10px 22px; border-top: 1px solid #2a2d3a;
        background: #13161f; display: flex;
        align-items: center; justify-content: space-between;
        font-size: 0.8rem; color: #5a6478;
      }
      #ws-use-in-chat {
        display: none;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white; border: none; border-radius: 8px;
        padding: 6px 14px; font-size: 0.82rem;
        font-weight: 600; cursor: pointer; transition: opacity 0.2s;
      }
      #ws-use-in-chat:hover { opacity: 0.85; }
    `;
    document.head.appendChild(style);
  }

  injectHTML() {
    const overlay = document.createElement('div');
    overlay.id = 'ws-overlay';
    overlay.innerHTML = `
      <div id="ws-panel">
        <div id="ws-header">
          <h2>🌐 <span>بحث الإنترنت</span> — نتائج حقيقية + تلخيص ذكي</h2>
          <button id="ws-close">✕</button>
        </div>
        <div id="ws-search-bar">
          <input id="ws-query" type="text" placeholder="ابحث في الإنترنت... مثال: أخبار الذكاء الاصطناعي 2025">
          <button id="ws-search-btn">🔍 بحث</button>
        </div>
        <div id="ws-options">
          <span style="font-size:0.8rem;color:#5a6478">بحث في:</span>
          <div class="ws-opt-chip active" data-type="web">🌐 الويب</div>
          <div class="ws-opt-chip" data-type="news">📰 الأخبار</div>
          <div class="ws-opt-chip" data-type="tech">💻 التقنية</div>
          <div class="ws-opt-chip" data-type="science">🔬 العلوم</div>
          <span style="font-size:0.8rem;color:#5a6478;margin-right:auto">تلخيص AI:</span>
          <div class="ws-opt-chip active" id="ws-summarize-toggle">🧠 مفعّل</div>
        </div>
        <div id="ws-body">
          <div id="ws-empty">
            <div style="font-size:3rem">🌐</div>
            <div>ابحث عن أي موضوع وسيُلخَّص بالذكاء الاصطناعي</div>
            <div style="font-size:0.82rem;opacity:0.6">نتائج حقيقية من الإنترنت • تلخيص فوري • استخدام في المحادثة</div>
          </div>
          <div id="ws-loading">
            <div>🔍 جاري البحث...</div>
            <div class="ws-loading-bar"><div class="ws-loading-bar-inner"></div></div>
            <div id="ws-loading-status" style="font-size:0.8rem">الاتصال بمحرك البحث...</div>
          </div>
          <div id="ws-summary-box">
            <h3>🧠 ملخص الذكاء الاصطناعي</h3>
            <div id="ws-summary-text"></div>
          </div>
          <div id="ws-results-list"></div>
        </div>
        <div id="ws-footer">
          <span id="ws-status">جاهز للبحث</span>
          <button id="ws-use-in-chat">💬 استخدم في المحادثة</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.queryEl = overlay.querySelector('#ws-query');
    this.searchBtn = overlay.querySelector('#ws-search-btn');
    this.emptyEl = overlay.querySelector('#ws-empty');
    this.loadingEl = overlay.querySelector('#ws-loading');
    this.loadingStatus = overlay.querySelector('#ws-loading-status');
    this.summaryBox = overlay.querySelector('#ws-summary-box');
    this.summaryText = overlay.querySelector('#ws-summary-text');
    this.resultsList = overlay.querySelector('#ws-results-list');
    this.statusEl = overlay.querySelector('#ws-status');
    this.useInChatBtn = overlay.querySelector('#ws-use-in-chat');
  }

  bindEvents() {
    document.querySelector('#ws-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    this.searchBtn.addEventListener('click', () => this.doSearch());
    this.queryEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.doSearch(); });

    document.querySelectorAll('.ws-opt-chip[data-type]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.ws-opt-chip[data-type]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.searchType = chip.dataset.type;
      });
    });

    document.querySelector('#ws-summarize-toggle').addEventListener('click', () => {
      this.summarizeActive = !this.summarizeActive;
      const btn = document.querySelector('#ws-summarize-toggle');
      btn.textContent = this.summarizeActive ? '🧠 مفعّل' : '🧠 معطّل';
      btn.classList.toggle('active', this.summarizeActive);
    });

    this.useInChatBtn.addEventListener('click', () => this.sendToChat());
  }

  async doSearch() {
    const query = this.queryEl.value.trim();
    if (!query || this.searching) return;

    this.searching = true;
    this.searchBtn.disabled = true;
    this.searchBtn.textContent = '⏳';
    this.emptyEl.style.display = 'none';
    this.loadingEl.style.display = 'flex';
    this.summaryBox.style.display = 'none';
    this.resultsList.innerHTML = '';
    this.useInChatBtn.style.display = 'none';
    this.lastResults = [];
    this.lastSummary = '';

    try {
      this.loadingStatus.textContent = 'جلب النتائج...';
      const results = await this.fetchSearchResults(query);
      this.lastResults = results;
      this.loadingEl.style.display = 'none';
      this.renderResults(results);

      if (this.summarizeActive && results.length > 0) {
        this.summaryBox.style.display = 'block';
        this.summaryText.textContent = '⏳ جاري التلخيص بالذكاء الاصطناعي...';
        const summary = await this.summarizeResults(query, results);
        this.lastSummary = summary;
        this.summaryText.textContent = summary;
        this.useInChatBtn.style.display = 'inline-block';
      }

      this.statusEl.textContent = `${results.length} نتيجة لـ "${query}"`;
    } catch (err) {
      this.loadingEl.style.display = 'none';
      this.resultsList.innerHTML = `<div style="text-align:center;padding:30px;color:#e74c3c">
        <div style="font-size:2rem">⚠️</div>
        <div style="margin-top:8px">فشل البحث — تحقق من الاتصال</div>
      </div>`;
      this.statusEl.textContent = 'فشل البحث';
    } finally {
      this.searching = false;
      this.searchBtn.disabled = false;
      this.searchBtn.textContent = '🔍 بحث';
    }
  }

  async fetchSearchResults(query) {
    const typeMap = { news: 'latest news', tech: 'technology', science: 'science research', web: '' };
    const suffix = typeMap[this.searchType] ? ` ${typeMap[this.searchType]}` : '';
    const fullQuery = query + suffix;

    try {
      const response = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'searchgpt',
          messages: [
            {
              role: 'system',
              content: 'You are a web search assistant. Return exactly 6 search results as a JSON array. Each item must have: title (string), url (string), snippet (string). Return ONLY the JSON array, no markdown, no explanation.'
            },
            { role: 'user', content: `Search: "${fullQuery}"` }
          ]
        })
      });
      const text = await response.text();
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        const valid = arr.filter(r => r.title && r.url && r.snippet);
        if (valid.length > 0) return valid.slice(0, 6);
      }
    } catch {}

    try {
      const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(fullQuery)}&format=json&no_redirect=1&no_html=1&skip_disambig=1`);
      const data = await res.json();
      const out = [];
      if (data.AbstractText && data.AbstractURL) {
        out.push({ title: data.Heading || query, url: data.AbstractURL, snippet: data.AbstractText });
      }
      (data.RelatedTopics || []).slice(0, 5).forEach(t => {
        if (t.Text && t.FirstURL) out.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text });
      });
      if (out.length > 0) return out;
    } catch {}

    return [
      { title: `بحث Google: ${query}`, url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, snippet: `انقر للبحث في Google عن "${query}"` },
      { title: `ويكيبيديا: ${query}`, url: `https://ar.wikipedia.org/wiki/${encodeURIComponent(query)}`, snippet: `ابحث في ويكيبيديا عن "${query}"` }
    ];
  }

  async summarizeResults(query, results) {
    const key = window.CONFIG?.OPENROUTER_API_KEY ||
                window.galaoumConfig?.providers?.openrouter?.key || '';
    const context = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}`).join('\n\n');

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [
            { role: 'system', content: 'لخّص نتائج البحث بشكل مفيد وموجز. استخدم نفس لغة السؤال.' },
            { role: 'user', content: `السؤال: ${query}\n\nالنتائج:\n${context}\n\nلخّص في 3-5 جمل.` }
          ],
          max_tokens: 500
        })
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || results.slice(0, 2).map(r => r.snippet).join(' ');
    } catch {
      return results.slice(0, 2).map(r => r.snippet).join(' ');
    }
  }

  renderResults(results) {
    if (!results.length) {
      this.resultsList.innerHTML = '<div style="text-align:center;padding:30px;color:#5a6478">لا توجد نتائج</div>';
      return;
    }
    this.resultsList.innerHTML = results.map(r => `
      <div class="ws-result-card">
        <a class="ws-result-title" href="${r.url}" target="_blank" rel="noopener">${r.title}</a>
        <div class="ws-result-url">${r.url}</div>
        <div class="ws-result-snippet">${r.snippet}</div>
      </div>
    `).join('');
  }

  sendToChat() {
    const query = this.queryEl.value.trim();
    const content = [
      `🌐 **نتائج البحث عن:** "${query}"`,
      '',
      `📋 **الملخص:**\n${this.lastSummary}`,
      '',
      `🔗 **المصادر:**`,
      ...this.lastResults.slice(0, 4).map((r, i) => `${i + 1}. ${r.title} — ${r.url}`)
    ].join('\n');

    const chatInput = document.getElementById('user-input') ||
                      document.querySelector('textarea[placeholder]') ||
                      document.querySelector('.chat-input');
    if (chatInput) {
      chatInput.value = content;
      chatInput.focus();
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    this.close();
  }

  open(prefillQuery = '') {
    this.overlay.style.display = 'block';
    this.isOpen = true;
    if (prefillQuery) { this.queryEl.value = prefillQuery; this.doSearch(); }
    else this.queryEl.focus();
  }

  close() {
    this.overlay.style.display = 'none';
    this.isOpen = false;
  }
}

const webSearch = new WebSearchSystem();
window.webSearch = webSearch;
window.openWebSearch = function(query) { webSearch.open(query || ''); };
