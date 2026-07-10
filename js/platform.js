/* ══════════════════════════════════════════════
   platform.js — اختيار منصة AI والتبديل بينها
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const PLATFORM_STORE_KEY = 'galaoum_selected_platform';

/* ── تعريف المنصات ── */
const PLATFORMS = [
  { id: 'auto',        label: 'تلقائي',      icon: '🔀', color: '#64748b', desc: 'ذكي — يختار أفضل منصة تلقائياً' },
  { id: 'gemini',      label: 'Gemini',       icon: '♊', color: '#4285f4', desc: 'Google Gemini — مجاني' },
  { id: 'openrouter',  label: 'OpenRouter',   icon: '🌐', color: '#7c3aed', desc: 'OpenRouter — 50+ نموذج مجاني' },
  { id: 'cerebras',    label: 'Cerebras',     icon: '🧠', color: '#0891b2', desc: 'Cerebras — سريع ومجاني' },
  { id: 'mistral',     label: 'Mistral',      icon: '🌊', color: '#ff7000', desc: 'Mistral AI' },
  { id: 'cohere',      label: 'Cohere',       icon: '⚡', color: '#39d353', desc: 'Cohere Command' },
  { id: 'pollinations',label: 'Pollinations', icon: '🌸', color: '#ec4899', desc: 'Pollinations — مجاني بلا مفتاح' },
  { id: 'bazaarlink',  label: 'BazaarLink',   icon: '🛒', color: '#f59e0b', desc: 'BazaarLink — +200 نموذج' },
  { id: 'replicate',   label: 'Replicate',    icon: '🔁', color: '#0ea5e9', desc: 'Replicate — آلاف النماذج' },
  { id: 'fal',         label: 'Fal.ai',       icon: '🎨', color: '#dc2626', desc: 'Fal.ai — صور وفيديو' },
  { id: 'huggingface', label: 'HuggingFace',  icon: '🤗', color: '#f97316', desc: 'HuggingFace — مفتوح المصدر' },
];

let _selected   = localStorage.getItem(PLATFORM_STORE_KEY) || 'auto';
let _lastManual = localStorage.getItem('galaoum_last_manual_platform') || 'openrouter';

/* ── هل الوضع تلقائي؟ ── */
function isAutoMode() { return _selected === 'auto'; }

/* ── تبديل تلقائي ↔ يدوي ── */
function toggleAutoManual() {
  if (isAutoMode()) {
    /* التبديل إلى يدوي — استعادة آخر مزود مختار */
    setSelectedPlatform(_lastManual);
  } else {
    /* التبديل إلى تلقائي */
    setSelectedPlatform('auto');
  }
}

/* ── الحصول على المنصة الحالية ── */
function getSelectedPlatform() {
  return _selected;
}

/* ── تعيين منصة ── */
function setSelectedPlatform(id) {
  _selected = id;
  localStorage.setItem(PLATFORM_STORE_KEY, id);
  /* احفظ آخر اختيار يدوي */
  if (id !== 'auto') {
    _lastManual = id;
    localStorage.setItem('galaoum_last_manual_platform', id);
  }
  _renderBadge();
  _renderSelector();
  _renderToggle();
  if (typeof Logger !== 'undefined') {
    const p = PLATFORMS.find(x => x.id === id);
    Logger.info('PLATFORM', `🔀 تم اختيار: ${p ? p.icon + ' ' + p.label : id}`);
  }
}

/* ── رسم الشارة في الهيدر ── */
function _renderBadge() {
  const badge = document.getElementById('active-platform-badge');
  if (!badge) return;
  const p = PLATFORMS.find(x => x.id === _selected) || PLATFORMS[0];
  badge.textContent = p.icon + ' ' + p.label;
  badge.title = p.desc;
  badge.style.borderColor = p.color + '55';
  badge.style.color = p.color;
  badge.style.background = p.color + '18';
}

/* ── رسم أزرار الاختيار في الشريط الجانبي ── */
function _renderSelector() {
  const container = document.getElementById('platform-selector');
  if (!container) return;

  container.innerHTML = '';

  PLATFORMS.forEach(p => {
    const isActive = _selected === p.id;
    const btn = document.createElement('button');
    btn.title = p.desc;
    btn.style.cssText = `
      flex:1;padding:5px 2px;border-radius:8px;font-size:10px;cursor:pointer;
      font-family:inherit;transition:all 0.2s;
      display:flex;flex-direction:column;align-items:center;gap:2px;
      border:1px solid ${isActive ? p.color : 'rgba(255,255,255,0.08)'};
      background:${isActive ? p.color + '22' : 'rgba(255,255,255,0.03)'};
      color:${isActive ? p.color : '#475569'};
      font-weight:${isActive ? '700' : '400'};
    `;
    btn.innerHTML = `<span style="font-size:13px">${p.icon}</span><span style="font-size:9px">${p.label}</span>`;
    btn.onclick = () => setSelectedPlatform(p.id);
    container.appendChild(btn);
  });
}

/* ── رسم زر التبديل تلقائي/يدوي ── */
function _renderToggle() {
  const btn = document.getElementById('auto-manual-toggle');
  if (!btn) return;
  const auto = isAutoMode();
  const manualProv = PLATFORMS.find(x => x.id === _lastManual);

  btn.innerHTML = `
    <span style="
      display:inline-flex;align-items:center;
      background:${auto ? 'rgba(100,116,139,0.25)' : 'transparent'};
      color:${auto ? '#94a3b8' : 'rgba(100,116,139,0.4)'};
      padding:3px 9px;border-radius:999px;
      font-weight:${auto ? '700' : '400'};
      transition:all 0.2s;font-size:11px;gap:4px;
    ">🔀 تلقائي</span>
    <span style="
      display:inline-flex;align-items:center;
      background:${!auto ? (manualProv ? manualProv.color + '28' : 'rgba(251,191,36,0.15)') : 'transparent'};
      color:${!auto ? (manualProv ? manualProv.color : '#fbbf24') : 'rgba(100,116,139,0.4)'};
      padding:3px 9px;border-radius:999px;
      font-weight:${!auto ? '700' : '400'};
      transition:all 0.2s;font-size:11px;gap:4px;
    ">${!auto && manualProv ? manualProv.icon + ' ' + manualProv.label : '⚙️ يدوي'}</span>
  `;
  btn.title = auto
    ? 'الوضع التلقائي — اضغط للتبديل إلى يدوي'
    : `يدوي: ${manualProv?.label || _lastManual} — اضغط للتبديل إلى تلقائي`;
}

/* ── تهيئة عند تحميل الصفحة ── */
document.addEventListener('DOMContentLoaded', () => {
  _renderSelector();
  _renderBadge();
  _renderToggle();
});
