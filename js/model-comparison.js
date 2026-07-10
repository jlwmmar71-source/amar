/**
 * Model Comparison System — Galaoum AI Engine v5.0
 * مقارنة النماذج — إرسال نفس الطلب لـ 3 نماذج بالتوازي
 */
class ModelComparison {
  constructor() {
    this.isOpen = false;
    this.comparing = false;
    this.results = {};
    this.defaultModels = [
      { provider: 'openrouter', model: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', color: '#10a37f' },
      { provider: 'openrouter', model: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku', color: '#c9784f' },
      { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B', color: '#7c5cbf' }
    ];
    this.selectedModels = [...this.defaultModels];
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
      #mc-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 9990;
        backdrop-filter: blur(6px);
      }
      #mc-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(96vw, 1100px);
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
      #mc-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px;
        border-bottom: 1px solid #2a2d3a;
        background: #13161f;
      }
      #mc-header h2 {
        margin: 0;
        font-size: 1.15rem;
        color: #e2e8f0;
        font-weight: 600;
      }
      #mc-header h2 span { color: #7c5cbf; }
      #mc-close {
        background: none;
        border: none;
        color: #8892a4;
        font-size: 1.4rem;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.2s;
      }
      #mc-close:hover { background: #1e2130; color: #e2e8f0; }
      #mc-input-area {
        padding: 16px 22px;
        border-bottom: 1px solid #2a2d3a;
        background: #13161f;
        display: flex;
        gap: 10px;
      }
      #mc-prompt {
        flex: 1;
        background: #1a1d2e;
        border: 1px solid #2a2d3a;
        border-radius: 10px;
        color: #e2e8f0;
        padding: 12px 16px;
        font-size: 0.95rem;
        resize: vertical;
        min-height: 50px;
        max-height: 150px;
        font-family: inherit;
        direction: auto;
        outline: none;
        transition: border-color 0.2s;
      }
      #mc-prompt:focus { border-color: #7c5cbf; }
      #mc-compare-btn {
        background: linear-gradient(135deg, #7c5cbf, #5a3f8a);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 0 22px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #mc-compare-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      #mc-compare-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      #mc-models-row {
        display: flex;
        gap: 0;
        flex: 1;
        overflow: hidden;
      }
      .mc-model-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        border-right: 1px solid #2a2d3a;
        overflow: hidden;
      }
      .mc-model-col:last-child { border-right: none; }
      .mc-col-header {
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid #2a2d3a;
        background: #13161f;
        position: relative;
      }
      .mc-col-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .mc-col-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #c8d0e0;
        flex: 1;
      }
      .mc-col-time {
        font-size: 0.75rem;
        color: #5a6478;
      }
      .mc-col-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        color: #c8d0e0;
        font-size: 0.88rem;
        line-height: 1.7;
        white-space: pre-wrap;
        direction: auto;
      }
      .mc-col-body::-webkit-scrollbar { width: 5px; }
      .mc-col-body::-webkit-scrollbar-thumb { background: #2a2d3a; border-radius: 4px; }
      .mc-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid #2a2d3a;
        border-top-color: #7c5cbf;
        border-radius: 50%;
        animation: mc-spin 0.7s linear infinite;
        margin-left: 8px;
      }
      @keyframes mc-spin { to { transform: rotate(360deg); } }
      .mc-winner-badge {
        display: inline-block;
        background: linear-gradient(135deg, #f5a623, #e07b00);
        color: white;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 20px;
        margin-right: 6px;
      }
      #mc-footer {
        padding: 10px 22px;
        border-top: 1px solid #2a2d3a;
        background: #13161f;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.8rem;
        color: #5a6478;
      }
      #mc-model-selector {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px 22px;
        border-bottom: 1px solid #2a2d3a;
        background: #0f1117;
      }
      .mc-model-chip {
        padding: 5px 12px;
        border-radius: 20px;
        font-size: 0.78rem;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.2s;
        color: #c8d0e0;
        background: #1a1d2e;
      }
      .mc-model-chip.selected { border-color: #7c5cbf; color: #a78bfa; background: #2d2245; }
      #mc-empty {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #5a6478;
        gap: 12px;
      }
      #mc-empty .mc-empty-icon { font-size: 3rem; opacity: 0.5; }
    `;
    document.head.appendChild(style);
  }

  injectHTML() {
    const availableModels = [
      { provider: 'openrouter', model: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', color: '#10a37f' },
      { provider: 'openrouter', model: 'openai/gpt-4o', label: 'GPT-4o', color: '#10a37f' },
      { provider: 'openrouter', model: 'anthropic/claude-3-haiku', label: 'Claude Haiku', color: '#c9784f' },
      { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', label: 'Claude Sonnet', color: '#c9784f' },
      { provider: 'openrouter', model: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B', color: '#7c5cbf' },
      { provider: 'openrouter', model: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B', color: '#7c5cbf' },
      { provider: 'openrouter', model: 'google/gemini-flash-1.5', label: 'Gemini Flash', color: '#4285f4' },
      { provider: 'openrouter', model: 'mistralai/mistral-7b-instruct:free', label: 'Mistral 7B', color: '#ff6600' },
    ];

    const overlay = document.createElement('div');
    overlay.id = 'mc-overlay';
    overlay.innerHTML = `
      <div id="mc-panel">
        <div id="mc-header">
          <h2>⚖️ <span>مقارنة النماذج</span> — نفس السؤال على 3 نماذج بالتوازي</h2>
          <button id="mc-close">✕</button>
        </div>

        <div id="mc-model-selector">
          ${availableModels.map((m, i) => `
            <div class="mc-model-chip${i < 3 ? ' selected' : ''}" 
                 data-model='${JSON.stringify(m)}'
                 style="${i < 3 ? `border-color:${m.color};color:${m.color};background:#1a1d2e` : ''}">
              ${m.label}
            </div>
          `).join('')}
          <span style="font-size:0.75rem;color:#5a6478;align-self:center;margin-right:auto">
            اختر حتى 3 نماذج
          </span>
        </div>

        <div id="mc-input-area">
          <textarea id="mc-prompt" placeholder="اكتب سؤالك هنا... وسيُرسل لـ 3 نماذج بالتوازي" rows="2"></textarea>
          <button id="mc-compare-btn">⚡ قارن</button>
        </div>

        <div id="mc-models-row">
          <div id="mc-empty">
            <div class="mc-empty-icon">🔬</div>
            <div>اكتب سؤالاً واضغط "قارن" لترى الفرق بين النماذج</div>
          </div>
        </div>

        <div id="mc-footer">
          <span>الأسرع استجابةً يحصل على 🏆</span>
          <span id="mc-status">جاهز</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.panel = overlay.querySelector('#mc-panel');
    this.promptEl = overlay.querySelector('#mc-prompt');
    this.compareBtn = overlay.querySelector('#mc-compare-btn');
    this.modelsRow = overlay.querySelector('#mc-models-row');
    this.emptyEl = overlay.querySelector('#mc-empty');
    this.statusEl = overlay.querySelector('#mc-status');
  }

  bindEvents() {
    document.querySelector('#mc-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    this.compareBtn.addEventListener('click', () => this.runComparison());
    this.promptEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) this.runComparison();
    });

    document.querySelectorAll('.mc-model-chip').forEach(chip => {
      chip.addEventListener('click', () => this.toggleModel(chip));
    });
  }

  toggleModel(chip) {
    const model = JSON.parse(chip.dataset.model);
    const idx = this.selectedModels.findIndex(m => m.model === model.model);
    if (idx >= 0) {
      if (this.selectedModels.length <= 1) return;
      this.selectedModels.splice(idx, 1);
      chip.classList.remove('selected');
      chip.style.borderColor = '';
      chip.style.color = '';
      chip.style.background = '';
    } else {
      if (this.selectedModels.length >= 3) {
        const removed = this.selectedModels.shift();
        document.querySelectorAll('.mc-model-chip').forEach(c => {
          if (JSON.parse(c.dataset.model).model === removed.model) {
            c.classList.remove('selected');
            c.style.borderColor = '';
            c.style.color = '';
            c.style.background = '';
          }
        });
      }
      this.selectedModels.push(model);
      chip.classList.add('selected');
      chip.style.borderColor = model.color;
      chip.style.color = model.color;
      chip.style.background = '#1a1d2e';
    }
  }

  open() {
    this.overlay.style.display = 'block';
    this.isOpen = true;
    this.promptEl.focus();
  }

  close() {
    this.overlay.style.display = 'none';
    this.isOpen = false;
  }

  async runComparison() {
    const prompt = this.promptEl.value.trim();
    if (!prompt) { this.promptEl.focus(); return; }
    if (this.comparing) return;
    if (this.selectedModels.length === 0) return;

    this.comparing = true;
    this.compareBtn.disabled = true;
    this.compareBtn.innerHTML = '<span class="mc-spinner"></span> جاري المقارنة...';
    this.results = {};

    this.modelsRow.innerHTML = this.selectedModels.map(m => `
      <div class="mc-model-col" id="mc-col-${m.model.replace(/[^a-z0-9]/gi, '_')}">
        <div class="mc-col-header">
          <div class="mc-col-dot" style="background:${m.color}"></div>
          <div class="mc-col-label">${m.label}</div>
          <div class="mc-col-time">
            <span class="mc-spinner"></span>
          </div>
        </div>
        <div class="mc-col-body" id="mc-body-${m.model.replace(/[^a-z0-9]/gi, '_')}">
          <span style="color:#5a6478">⏳ جاري التوليد...</span>
        </div>
      </div>
    `).join('');

    this.statusEl.textContent = `يتم الاستعلام من ${this.selectedModels.length} نماذج بالتوازي...`;
    const startTime = Date.now();

    const tasks = this.selectedModels.map(async (m) => {
      const colId = m.model.replace(/[^a-z0-9]/gi, '_');
      const bodyEl = document.getElementById(`mc-body-${colId}`);
      const timeEl = document.querySelector(`#mc-col-${colId} .mc-col-time`);
      const t0 = Date.now();

      try {
        const key = window.CONFIG?.OPENROUTER_API_KEY ||
                    (window.galaoumConfig?.providers?.openrouter?.key) || '';

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: m.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1200
          })
        });

        const data = await response.json();
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

        if (data.choices?.[0]?.message?.content) {
          const text = data.choices[0].message.content;
          this.results[m.model] = { text, elapsed: parseFloat(elapsed) };
          bodyEl.textContent = text;
          timeEl.innerHTML = `⏱ ${elapsed}s`;
        } else if (data.error) {
          bodyEl.innerHTML = `<span style="color:#e74c3c">❌ ${data.error.message || 'خطأ'}</span>`;
          timeEl.innerHTML = `❌`;
        }
      } catch (err) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        bodyEl.innerHTML = `<span style="color:#e74c3c">❌ فشل الاتصال</span>`;
        timeEl.innerHTML = `❌`;
      }
    });

    await Promise.all(tasks);

    const times = Object.entries(this.results)
      .filter(([, v]) => v.elapsed)
      .sort(([, a], [, b]) => a.elapsed - b.elapsed);

    if (times.length > 0) {
      const [winnerId] = times[0];
      const winnerModel = this.selectedModels.find(m => m.model === winnerId);
      const colId = winnerId.replace(/[^a-z0-9]/gi, '_');
      const labelEl = document.querySelector(`#mc-col-${colId} .mc-col-label`);
      if (labelEl) {
        labelEl.innerHTML = `<span class="mc-winner-badge">🏆 الأسرع</span>${winnerModel?.label || winnerId}`;
      }
    }

    const total = ((Date.now() - startTime) / 1000).toFixed(1);
    this.statusEl.textContent = `اكتملت المقارنة في ${total}s`;
    this.comparing = false;
    this.compareBtn.disabled = false;
    this.compareBtn.innerHTML = '⚡ قارن';
  }
}

const modelComparison = new ModelComparison();
window.modelComparison = modelComparison;

window.openModelComparison = function() {
  modelComparison.open();
};
