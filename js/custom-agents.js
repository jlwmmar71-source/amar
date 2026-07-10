/**
 * Custom Agents Builder — Galaoum AI Engine v5.0
 * بناء وكلاء مخصصين بشخصية وتعليمات مخصصة
 */
class CustomAgentsManager {
  constructor() {
    this.agents = this.loadAgents();
    this.activeAgent = null;
    this.isOpen = false;
    this.init();
  }

  loadAgents() {
    try {
      return JSON.parse(localStorage.getItem('galaoum_custom_agents') || '[]');
    } catch {
      return [];
    }
  }

  saveAgents() {
    localStorage.setItem('galaoum_custom_agents', JSON.stringify(this.agents));
  }

  init() {
    this.injectStyles();
    this.injectHTML();
    this.bindEvents();
    this.renderAgentsList();
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #ca-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.85);
        z-index: 9990;
        backdrop-filter: blur(6px);
      }
      #ca-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(94vw, 860px);
        max-height: 88vh;
        background: #0f1117;
        border: 1px solid #2a2d3a;
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        z-index: 9991;
        overflow: hidden;
        font-family: 'Segoe UI', sans-serif;
      }
      #ca-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 22px;
        border-bottom: 1px solid #2a2d3a;
        background: #13161f;
      }
      #ca-header h2 {
        margin: 0;
        font-size: 1.15rem;
        color: #e2e8f0;
        font-weight: 600;
      }
      #ca-header h2 span { color: #f5a623; }
      #ca-close {
        background: none;
        border: none;
        color: #8892a4;
        font-size: 1.4rem;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.2s;
      }
      #ca-close:hover { background: #1e2130; color: #e2e8f0; }
      #ca-body {
        display: flex;
        flex: 1;
        overflow: hidden;
      }
      #ca-sidebar {
        width: 240px;
        border-left: 1px solid #2a2d3a;
        display: flex;
        flex-direction: column;
        background: #13161f;
        overflow-y: auto;
      }
      #ca-sidebar::-webkit-scrollbar { width: 4px; }
      #ca-sidebar::-webkit-scrollbar-thumb { background: #2a2d3a; }
      #ca-sidebar-header {
        padding: 14px 16px;
        border-bottom: 1px solid #2a2d3a;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      #ca-sidebar-header span { font-size: 0.82rem; color: #8892a4; }
      #ca-new-btn {
        background: linear-gradient(135deg, #f5a623, #e07b00);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 5px 12px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }
      #ca-new-btn:hover { opacity: 0.85; }
      .ca-agent-item {
        padding: 12px 16px;
        border-bottom: 1px solid #1e2130;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ca-agent-item:hover { background: #1a1d2e; }
      .ca-agent-item.active { background: #2d2245; border-right: 3px solid #f5a623; }
      .ca-agent-emoji { font-size: 1.4rem; }
      .ca-agent-info { flex: 1; min-width: 0; }
      .ca-agent-name { font-size: 0.85rem; color: #c8d0e0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ca-agent-desc { font-size: 0.75rem; color: #5a6478; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ca-delete-btn {
        background: none;
        border: none;
        color: #5a6478;
        cursor: pointer;
        font-size: 0.9rem;
        padding: 2px;
        border-radius: 4px;
        transition: all 0.2s;
      }
      .ca-delete-btn:hover { color: #e74c3c; background: #2d1a1a; }
      #ca-main {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding: 22px;
        gap: 16px;
      }
      #ca-main::-webkit-scrollbar { width: 5px; }
      #ca-main::-webkit-scrollbar-thumb { background: #2a2d3a; border-radius: 4px; }
      .ca-field label {
        display: block;
        font-size: 0.82rem;
        color: #8892a4;
        margin-bottom: 6px;
        font-weight: 600;
      }
      .ca-field input,
      .ca-field textarea,
      .ca-field select {
        width: 100%;
        background: #1a1d2e;
        border: 1px solid #2a2d3a;
        border-radius: 10px;
        color: #e2e8f0;
        padding: 10px 14px;
        font-size: 0.9rem;
        font-family: inherit;
        direction: auto;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }
      .ca-field input:focus,
      .ca-field textarea:focus,
      .ca-field select:focus { border-color: #f5a623; }
      .ca-field textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
      .ca-row { display: flex; gap: 12px; }
      .ca-row .ca-field { flex: 1; }
      #ca-emoji-picker {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 10px;
        background: #1a1d2e;
        border: 1px solid #2a2d3a;
        border-radius: 10px;
      }
      .ca-emoji-opt {
        font-size: 1.4rem;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: background 0.2s;
      }
      .ca-emoji-opt:hover { background: #2a2d3a; }
      .ca-emoji-opt.selected { background: #2d2245; outline: 2px solid #f5a623; }
      #ca-save-btn {
        background: linear-gradient(135deg, #f5a623, #e07b00);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 12px 28px;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        align-self: flex-start;
      }
      #ca-save-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      #ca-use-btn {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border: none;
        border-radius: 10px;
        padding: 12px 28px;
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        align-self: flex-start;
      }
      #ca-use-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      #ca-active-badge {
        display: none;
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 600;
      }
      #ca-empty-msg {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #5a6478;
        gap: 12px;
        padding: 40px;
        text-align: center;
      }
      #ca-active-bar {
        display: none;
        padding: 8px 22px;
        background: #0d1a14;
        border-bottom: 1px solid #1a3a2a;
        font-size: 0.82rem;
        color: #10b981;
        align-items: center;
        gap: 10px;
      }
    `;
    document.head.appendChild(style);
  }

  injectHTML() {
    const emojis = ['🤖','🧠','💼','🎨','📊','⚙️','🔬','✍️','🎯','💡','🌍','📚','🔐','🚀','💬','🎭','🧪','📰','🎓','⚡'];

    const overlay = document.createElement('div');
    overlay.id = 'ca-overlay';
    overlay.innerHTML = `
      <div id="ca-panel">
        <div id="ca-header">
          <h2>🤖 <span>الوكلاء المخصصون</span> — ابنِ وكيلك الذكي</h2>
          <button id="ca-close">✕</button>
        </div>
        <div id="ca-active-bar">
          ✅ الوكيل النشط: <strong id="ca-active-name"></strong>
          <button onclick="window.customAgents.deactivate()" style="background:none;border:1px solid #10b981;color:#10b981;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.75rem;">إلغاء</button>
        </div>
        <div id="ca-body">
          <div id="ca-main">
            <div id="ca-empty-msg">
              <div style="font-size:3rem">🤖</div>
              <div>اختر وكيلاً من القائمة أو أنشئ وكيلاً جديداً</div>
              <button id="ca-create-first" style="background:linear-gradient(135deg,#f5a623,#e07b00);color:white;border:none;border-radius:10px;padding:10px 22px;cursor:pointer;font-weight:600;">+ أنشئ وكيلك الأول</button>
            </div>
          </div>
          <div id="ca-sidebar">
            <div id="ca-sidebar-header">
              <span>الوكلاء (${this.agents.length})</span>
              <button id="ca-new-btn">+ جديد</button>
            </div>
            <div id="ca-agents-list"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.panel = overlay.querySelector('#ca-panel');
    this.mainEl = overlay.querySelector('#ca-main');
    this.agentsListEl = overlay.querySelector('#ca-agents-list');
    this.activeBar = overlay.querySelector('#ca-active-bar');
    this.activeNameEl = overlay.querySelector('#ca-active-name');
    this.emojis = emojis;
    this.selectedEmoji = '🤖';
  }

  bindEvents() {
    document.querySelector('#ca-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
    document.querySelector('#ca-new-btn').addEventListener('click', () => this.showForm(null));
    document.querySelector('#ca-create-first')?.addEventListener('click', () => this.showForm(null));
  }

  renderAgentsList() {
    this.agentsListEl.innerHTML = '';
    if (this.agents.length === 0) {
      this.agentsListEl.innerHTML = '<div style="padding:16px;color:#5a6478;font-size:0.8rem;text-align:center">لا يوجد وكلاء بعد</div>';
      return;
    }
    this.agents.forEach((agent, idx) => {
      const item = document.createElement('div');
      item.className = `ca-agent-item${this.activeAgent?.id === agent.id ? ' active' : ''}`;
      item.innerHTML = `
        <div class="ca-agent-emoji">${agent.emoji}</div>
        <div class="ca-agent-info">
          <div class="ca-agent-name">${agent.name}</div>
          <div class="ca-agent-desc">${agent.description || 'وكيل مخصص'}</div>
        </div>
        <button class="ca-delete-btn" data-idx="${idx}" title="حذف">🗑</button>
      `;
      item.querySelector('.ca-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteAgent(idx);
      });
      item.addEventListener('click', () => this.showForm(idx));
      this.agentsListEl.appendChild(item);
    });
    document.querySelector('#ca-sidebar-header span').textContent = `الوكلاء (${this.agents.length})`;
  }

  showForm(idx) {
    const agent = idx !== null ? this.agents[idx] : null;
    this.selectedEmoji = agent?.emoji || '🤖';

    this.mainEl.innerHTML = `
      <div class="ca-field">
        <label>رمز الوكيل (Emoji)</label>
        <div id="ca-emoji-picker">
          ${this.emojis.map(e => `<div class="ca-emoji-opt${e === this.selectedEmoji ? ' selected' : ''}" data-emoji="${e}">${e}</div>`).join('')}
        </div>
      </div>
      <div class="ca-row">
        <div class="ca-field">
          <label>اسم الوكيل *</label>
          <input id="ca-name" value="${agent?.name || ''}" placeholder="مثال: مساعد التسويق" maxlength="50">
        </div>
        <div class="ca-field">
          <label>وصف قصير</label>
          <input id="ca-desc" value="${agent?.description || ''}" placeholder="مثال: متخصص في تسويق التطبيقات" maxlength="80">
        </div>
      </div>
      <div class="ca-field">
        <label>تعليمات الشخصية (System Prompt) *</label>
        <textarea id="ca-system" placeholder="أنت مساعد متخصص في... مهمتك الأساسية هي... أسلوبك يكون...">${agent?.systemPrompt || ''}</textarea>
      </div>
      <div class="ca-row">
        <div class="ca-field">
          <label>النموذج المفضل</label>
          <select id="ca-model">
            <option value="openai/gpt-4o-mini" ${agent?.model === 'openai/gpt-4o-mini' ? 'selected' : ''}>GPT-4o Mini (سريع)</option>
            <option value="openai/gpt-4o" ${agent?.model === 'openai/gpt-4o' ? 'selected' : ''}>GPT-4o (قوي)</option>
            <option value="anthropic/claude-3.5-sonnet" ${agent?.model === 'anthropic/claude-3.5-sonnet' ? 'selected' : ''}>Claude 3.5 Sonnet</option>
            <option value="anthropic/claude-3-haiku" ${agent?.model === 'anthropic/claude-3-haiku' ? 'selected' : ''}>Claude 3 Haiku (سريع)</option>
            <option value="meta-llama/llama-3.1-70b-instruct" ${agent?.model === 'meta-llama/llama-3.1-70b-instruct' ? 'selected' : ''}>Llama 3.1 70B</option>
            <option value="google/gemini-flash-1.5" ${agent?.model === 'google/gemini-flash-1.5' ? 'selected' : ''}>Gemini Flash</option>
          </select>
        </div>
        <div class="ca-field">
          <label>درجة الإبداع (Temperature)</label>
          <input type="range" id="ca-temp" min="0" max="1" step="0.1" value="${agent?.temperature ?? 0.7}"
            oninput="document.getElementById('ca-temp-val').textContent=this.value">
          <div style="font-size:0.8rem;color:#8892a4;margin-top:4px">
            القيمة: <span id="ca-temp-val">${agent?.temperature ?? 0.7}</span>
            <span style="float:left;color:#5a6478">(0=دقيق، 1=إبداعي)</span>
          </div>
        </div>
      </div>
      <div class="ca-field">
        <label>رسالة الترحيب (اختياري)</label>
        <input id="ca-greeting" value="${agent?.greeting || ''}" placeholder="مرحباً! أنا مساعدك في...">
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button id="ca-save-btn">💾 حفظ الوكيل</button>
        ${agent ? `<button id="ca-use-btn">✅ تفعيل الوكيل</button>` : ''}
        <div id="ca-active-badge">${agent?.id === this.activeAgent?.id ? '✅ نشط الآن' : ''}</div>
      </div>
    `;

    document.querySelectorAll('.ca-emoji-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.ca-emoji-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        this.selectedEmoji = opt.dataset.emoji;
      });
    });

    document.getElementById('ca-save-btn').addEventListener('click', () => {
      this.saveAgent(idx);
    });

    if (agent) {
      document.getElementById('ca-use-btn')?.addEventListener('click', () => {
        this.activateAgent(agent.id);
      });
    }
  }

  saveAgent(idx) {
    const name = document.getElementById('ca-name')?.value.trim();
    const systemPrompt = document.getElementById('ca-system')?.value.trim();
    if (!name || !systemPrompt) {
      alert('يرجى ملء اسم الوكيل وتعليمات الشخصية على الأقل');
      return;
    }
    const agent = {
      id: idx !== null ? this.agents[idx].id : Date.now().toString(),
      emoji: this.selectedEmoji,
      name,
      description: document.getElementById('ca-desc')?.value.trim() || '',
      systemPrompt,
      model: document.getElementById('ca-model')?.value || 'openai/gpt-4o-mini',
      temperature: parseFloat(document.getElementById('ca-temp')?.value || '0.7'),
      greeting: document.getElementById('ca-greeting')?.value.trim() || '',
      createdAt: idx !== null ? this.agents[idx].createdAt : new Date().toISOString()
    };
    if (idx !== null) {
      this.agents[idx] = agent;
    } else {
      this.agents.push(agent);
    }
    this.saveAgents();
    this.renderAgentsList();

    const badge = document.getElementById('ca-active-badge');
    if (badge) { badge.style.display = 'inline-flex'; badge.textContent = '✅ تم الحفظ!'; }
    setTimeout(() => { if (badge) badge.style.display = 'none'; }, 2000);
  }

  deleteAgent(idx) {
    const agent = this.agents[idx];
    if (!confirm(`حذف الوكيل "${agent.name}"؟`)) return;
    if (this.activeAgent?.id === agent.id) this.deactivate();
    this.agents.splice(idx, 1);
    this.saveAgents();
    this.renderAgentsList();
    this.mainEl.innerHTML = '<div id="ca-empty-msg" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#5a6478;gap:12px;padding:40px;text-align:center"><div style="font-size:3rem">🤖</div><div>اختر وكيلاً من القائمة أو أنشئ وكيلاً جديداً</div></div>';
  }

  activateAgent(id) {
    const agent = this.agents.find(a => a.id === id);
    if (!agent) return;
    this.activeAgent = agent;
    window.activeCustomAgent = agent;

    this.activeBar.style.display = 'flex';
    this.activeNameEl.textContent = `${agent.emoji} ${agent.name}`;

    const mainActiveBar = document.getElementById('main-active-agent-bar');
    if (mainActiveBar) {
      mainActiveBar.style.display = 'flex';
      mainActiveBar.textContent = `${agent.emoji} الوكيل النشط: ${agent.name}`;
    }

    this.renderAgentsList();

    const badge = document.getElementById('ca-active-badge');
    if (badge) { badge.style.display = 'inline-flex'; badge.textContent = `✅ ${agent.emoji} ${agent.name} نشط!`; }
    setTimeout(() => this.close(), 1000);
  }

  deactivate() {
    this.activeAgent = null;
    window.activeCustomAgent = null;
    this.activeBar.style.display = 'none';
    const mainActiveBar = document.getElementById('main-active-agent-bar');
    if (mainActiveBar) mainActiveBar.style.display = 'none';
    this.renderAgentsList();
  }

  open() {
    this.overlay.style.display = 'block';
    this.isOpen = true;
    if (this.activeAgent) {
      this.activeBar.style.display = 'flex';
      this.activeNameEl.textContent = `${this.activeAgent.emoji} ${this.activeAgent.name}`;
    }
  }

  close() {
    this.overlay.style.display = 'none';
    this.isOpen = false;
  }
}

const customAgents = new CustomAgentsManager();
window.customAgents = customAgents;
window.openCustomAgents = function() { customAgents.open(); };
