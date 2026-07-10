/* ══════════════════════════════════════════════
   key-selector.js — شاشة اختيار المفتاح النشط
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const KEY_SELECTOR_STORE = 'galaoum_selected_provider_v1';

/* ── تعريف جميع المنصات مع بياناتها ── */
const ALL_PROVIDERS = [
  {
    id: 'gemini',
    label: 'Gemini',
    company: 'Google',
    icon: '♊',
    color: '#4285f4',
    desc: 'أقوى نماذج Google — مجاني',
    getKey: () => (CONFIG.GEMINI_API_KEYS || []).find(k => k && !k.includes('_HERE')) || '',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.5-flash'],
    badge: 'مجاني',
    badgeColor: '#16a34a'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    company: 'OpenRouter',
    icon: '🌐',
    color: '#7c3aed',
    desc: '338+ نموذج — 25 مجاني',
    getKey: () => CONFIG.OPENROUTER_API_KEY || '',
    models: ['GPT-4o', 'Claude', 'Llama', 'Gemini'],
    badge: '+338 نموذج',
    badgeColor: '#7c3aed'
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    company: 'Mistral',
    icon: '🌊',
    color: '#ff7000',
    desc: 'نماذج أوروبية سريعة — 74 نموذج',
    getKey: () => CONFIG.MISTRAL_API_KEY || '',
    models: ['mistral-large', 'mistral-medium', 'codestral', 'devstral'],
    badge: '74 نموذج',
    badgeColor: '#ff7000'
  },
  {
    id: 'cohere',
    label: 'Cohere',
    company: 'Cohere',
    icon: '⚡',
    color: '#39d353',
    desc: 'Command-A — متخصص في العربية',
    getKey: () => CONFIG.COHERE_API_KEY || '',
    models: ['command-a-plus', 'command-a-reasoning', 'aya-expanse-32b'],
    badge: '20 نموذج',
    badgeColor: '#39d353'
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    company: 'Cerebras',
    icon: '🧠',
    color: '#0891b2',
    desc: 'أسرع inference في العالم',
    getKey: () => CONFIG.CEREBRAS_API_KEY || '',
    models: ['llama-3.3-70b', 'llama3.1-8b'],
    badge: 'سريع جداً',
    badgeColor: '#0891b2'
  },
  {
    id: 'bazaarlink',
    label: 'BazaarLink',
    company: 'BazaarLink',
    icon: '🛒',
    color: '#f59e0b',
    desc: '+200 نموذج — OpenAI, Claude, Grok',
    getKey: () => CONFIG.BAZAARLINK_API_KEY || '',
    models: ['GPT-4o', 'Claude-3.5', 'Gemini', 'Grok'],
    badge: '+200 نموذج',
    badgeColor: '#f59e0b'
  },
  {
    id: 'pollinations',
    label: 'Pollinations',
    company: 'Pollinations.ai',
    icon: '🌸',
    color: '#ec4899',
    desc: 'مجاني بدون مفتاح — نص وصور',
    getKey: () => CONFIG.POLLINATIONS_API_KEY || '',
    models: ['openai-large', 'mistral', 'llama'],
    badge: 'مجاني',
    badgeColor: '#16a34a'
  },
  {
    id: 'fal',
    label: 'Fal.ai',
    company: 'Fal',
    icon: '🎨',
    color: '#dc2626',
    desc: 'توليد صور وفيديو متقدم',
    getKey: () => CONFIG.FAL_KEY || '',
    models: ['flux-dev', 'flux-pro', 'kling-video'],
    badge: 'صور/فيديو',
    badgeColor: '#dc2626'
  },
  {
    id: 'replicate',
    label: 'Replicate',
    company: 'Replicate',
    icon: '🔁',
    color: '#0ea5e9',
    desc: 'آلاف النماذج المفتوحة',
    getKey: () => CONFIG.REPLICATE_API_TOKEN || '',
    models: ['llama', 'stable-diffusion', 'whisper'],
    badge: 'آلاف النماذج',
    badgeColor: '#0ea5e9'
  },
  {
    id: 'huggingface',
    label: 'HuggingFace',
    company: 'HuggingFace',
    icon: '🤗',
    color: '#f97316',
    desc: 'أكبر منصة نماذج مفتوحة',
    getKey: () => CONFIG.HF_TOKEN || '',
    models: ['Llama', 'Mistral', 'Falcon', 'BLOOM'],
    badge: 'مفتوح المصدر',
    badgeColor: '#f97316'
  }
];

/* ── مخفي / إظهار المفتاح ── */
function _maskKey(k) {
  if (!k || k.length < 8) return k || '— غير مضبوط';
  return k.substring(0, 10) + '••••••••••••' + k.slice(-4);
}

/* ── فتح الشاشة ── */
function openKeySelector() {
  _renderKeySelector();
  document.getElementById('key-selector-modal').style.display = 'flex';
  setTimeout(() => {
    document.getElementById('key-selector-panel').style.transform = 'translateY(0)';
    document.getElementById('key-selector-panel').style.opacity = '1';
  }, 10);
}

/* ── إغلاق الشاشة ── */
function closeKeySelector() {
  const panel = document.getElementById('key-selector-panel');
  if (panel) {
    panel.style.transform = 'translateY(30px)';
    panel.style.opacity = '0';
  }
  setTimeout(() => {
    const modal = document.getElementById('key-selector-modal');
    if (modal) modal.style.display = 'none';
  }, 250);
}

/* ── اختيار مزود ── */
function selectProvider(id) {
  if (typeof setSelectedPlatform === 'function') {
    setSelectedPlatform(id);
  }
  localStorage.setItem(KEY_SELECTOR_STORE, id);
  _renderKeySelector();

  /* أظهر تأكيد */
  const prov = ALL_PROVIDERS.find(p => p.id === id);
  if (prov && typeof showToast === 'function') {
    showToast(`${prov.icon} تم اختيار ${prov.label}`, 'success');
  }
  setTimeout(() => closeKeySelector(), 600);
}

/* ── رسم الشاشة ── */
function _renderKeySelector() {
  const current = (typeof getSelectedPlatform === 'function')
    ? getSelectedPlatform()
    : localStorage.getItem(KEY_SELECTOR_STORE) || 'auto';

  const grid = document.getElementById('key-selector-grid');
  if (!grid) return;
  grid.innerHTML = '';

  ALL_PROVIDERS.forEach(p => {
    const key = p.getKey();
    const hasKey = key && key.length > 8;
    const isActive = current === p.id;

    const card = document.createElement('div');
    card.style.cssText = `
      position:relative;
      background:${isActive ? p.color + '18' : 'rgba(255,255,255,0.03)'};
      border:2px solid ${isActive ? p.color : 'rgba(255,255,255,0.08)'};
      border-radius:16px;
      padding:16px;
      cursor:${hasKey ? 'pointer' : 'default'};
      transition:all 0.2s;
      display:flex;flex-direction:column;gap:10px;
      ${isActive ? `box-shadow:0 0 20px ${p.color}30;` : ''}
    `;

    if (hasKey) {
      card.onmouseenter = () => {
        if (!isActive) {
          card.style.background = p.color + '10';
          card.style.borderColor = p.color + '55';
          card.style.transform = 'translateY(-2px)';
        }
      };
      card.onmouseleave = () => {
        if (!isActive) {
          card.style.background = 'rgba(255,255,255,0.03)';
          card.style.borderColor = 'rgba(255,255,255,0.08)';
          card.style.transform = 'translateY(0)';
        }
      };
    }

    card.innerHTML = `
      ${isActive ? `<div style="position:absolute;top:10px;left:10px;background:${p.color};color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px">✓ محدد</div>` : ''}

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:${isActive ? '8px' : '0'}">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="
            width:42px;height:42px;border-radius:12px;flex-shrink:0;
            background:${p.color}22;border:1px solid ${p.color}44;
            display:flex;align-items:center;justify-content:center;
            font-size:20px;
          ">${p.icon}</div>
          <div>
            <div style="font-size:14px;font-weight:700;color:#f1f5f9">${p.label}</div>
            <div style="font-size:10px;color:#64748b">${p.company}</div>
          </div>
        </div>
        <span style="
          font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;
          background:${p.badgeColor}22;color:${p.badgeColor};
          border:1px solid ${p.badgeColor}44;white-space:nowrap;
        ">${p.badge}</span>
      </div>

      <div style="font-size:11px;color:#94a3b8">${p.desc}</div>

      <div style="
        background:rgba(0,0,0,0.3);border-radius:8px;
        padding:8px 10px;font-family:monospace;font-size:10px;
        color:${hasKey ? '#4ade80' : '#ef4444'};
        border:1px solid ${hasKey ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'};
        direction:ltr;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
      ">
        ${hasKey ? '🔑 ' + _maskKey(key) : '❌ لا يوجد مفتاح'}
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${p.models.slice(0,3).map(m => `
          <span style="
            font-size:9px;padding:2px 7px;border-radius:10px;
            background:rgba(255,255,255,0.05);color:#64748b;
            border:1px solid rgba(255,255,255,0.08);
          ">${m}</span>
        `).join('')}
      </div>

      ${hasKey && !isActive ? `
        <button onclick="selectProvider('${p.id}')" style="
          width:100%;padding:9px;border-radius:10px;
          background:linear-gradient(135deg,${p.color},${p.color}cc);
          border:none;color:#fff;font-size:12px;font-weight:700;
          cursor:pointer;font-family:inherit;transition:all 0.2s;
          box-shadow:0 4px 12px ${p.color}33;
        " onmouseover="this.style.opacity='0.85'"
           onmouseout="this.style.opacity='1'">
          اختر هذا المزود
        </button>
      ` : isActive ? `
        <div style="
          width:100%;padding:9px;border-radius:10px;text-align:center;
          background:${p.color}22;border:1px solid ${p.color}44;
          color:${p.color};font-size:12px;font-weight:700;
        ">✓ المزود النشط الآن</div>
      ` : `
        <div style="
          width:100%;padding:9px;border-radius:10px;text-align:center;
          background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);
          color:#ef4444;font-size:11px;
        ">أضف المفتاح أولاً</div>
      `}
    `;

    grid.appendChild(card);
  });
}

/* ── إنشاء الـ Modal في DOM ── */
function _initKeySelectorModal() {
  if (document.getElementById('key-selector-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'key-selector-modal';
  modal.style.cssText = `
    display:none;position:fixed;inset:0;z-index:9999;
    background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
    align-items:center;justify-content:center;padding:20px;
    font-family:inherit;
  `;
  modal.onclick = (e) => { if (e.target === modal) closeKeySelector(); };

  modal.innerHTML = `
    <div id="key-selector-panel" style="
      width:100%;max-width:900px;max-height:88vh;
      background:linear-gradient(160deg,#0d1425,#0a0f1e);
      border:1px solid rgba(220,38,38,0.2);
      border-radius:20px;overflow:hidden;
      display:flex;flex-direction:column;
      box-shadow:0 30px 80px rgba(0,0,0,0.8);
      transform:translateY(30px);opacity:0;
      transition:transform 0.25s ease,opacity 0.25s ease;
    ">
      <!-- هيدر -->
      <div style="
        padding:20px 24px;
        border-bottom:1px solid rgba(255,255,255,0.07);
        display:flex;align-items:center;justify-content:space-between;
        background:rgba(255,255,255,0.02);flex-shrink:0;
      ">
        <div>
          <div style="font-size:17px;font-weight:700;color:#f1f5f9">🔑 اختر مزود الذكاء الاصطناعي</div>
          <div style="font-size:12px;color:#64748b;margin-top:3px">
            اختر المنصة التي ستستخدمها للرد على رسائلك
          </div>
        </div>
        <button onclick="closeKeySelector()" style="
          width:34px;height:34px;border-radius:10px;
          background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
          color:#94a3b8;font-size:18px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          transition:all 0.2s;
        " onmouseover="this.style.background='rgba(220,38,38,0.2)';this.style.color='#fca5a5'"
           onmouseout="this.style.background='rgba(255,255,255,0.06)';this.style.color='#94a3b8'">×</button>
      </div>

      <!-- زر تلقائي -->
      <div style="padding:16px 24px 0;flex-shrink:0">
        <button onclick="selectProvider('auto')" id="auto-provider-btn" style="
          width:100%;padding:12px 20px;border-radius:12px;
          background:rgba(100,116,139,0.15);
          border:2px solid rgba(100,116,139,0.3);
          color:#94a3b8;font-size:13px;font-weight:600;
          cursor:pointer;font-family:inherit;transition:all 0.2s;
          display:flex;align-items:center;justify-content:center;gap:8px;
        " onmouseover="this.style.background='rgba(100,116,139,0.25)'"
           onmouseout="this.style.background='rgba(100,116,139,0.15)'">
          🔀 <span>وضع تلقائي — يختار أفضل مزود لكل طلب</span>
          <span style="
            margin-right:auto;font-size:10px;padding:2px 8px;border-radius:10px;
            background:rgba(100,116,139,0.3);color:#94a3b8;
          ">موصى به</span>
        </button>
      </div>

      <!-- الشبكة -->
      <div id="key-selector-grid" style="
        padding:16px 24px 24px;
        overflow-y:auto;
        display:grid;
        grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
        gap:12px;
      "></div>
    </div>
  `;

  document.body.appendChild(modal);
}

/* ── تهيئة ── */
document.addEventListener('DOMContentLoaded', () => {
  _initKeySelectorModal();
});
