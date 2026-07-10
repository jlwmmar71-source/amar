/* ══════════════════════════════════════════════
   providers-keys-manager.js — إدارة مفاتيح المزودين
   Galaoum AI Engine v5.0
   يدعم: OpenRouter, Cerebras, FAL
   ══════════════════════════════════════════════ */

const PROVIDERS_STORE_KEY = 'galaoum_providers_keys_v1';

const PROVIDERS_DEF = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    icon: '🌐',
    color: '#7c3aed',
    configKey: 'OPENROUTER_API_KEY',
    placeholder: 'sk-or-v1-...',
    testUrl: 'https://openrouter.ai/api/v1/auth/key',
    testMethod: 'GET',
    testHeader: 'Authorization',
    testHeaderPrefix: 'Bearer ',
    hint: 'احصل على مفتاح من openrouter.ai',
    hintUrl: 'https://openrouter.ai/keys'
  },
  {
    id: 'cerebras',
    label: 'Cerebras',
    icon: '🧠',
    color: '#0891b2',
    configKey: 'CEREBRAS_API_KEY',
    placeholder: 'csk-...',
    testUrl: 'https://api.cerebras.ai/v1/models',
    testMethod: 'GET',
    testHeader: 'Authorization',
    testHeaderPrefix: 'Bearer ',
    hint: 'احصل على مفتاح من cloud.cerebras.ai',
    hintUrl: 'https://cloud.cerebras.ai'
  },
  {
      id: 'replicate',
      label: 'Replicate',
      icon: '🔁',
      color: '#0ea5e9',
      configKey: 'REPLICATE_API_TOKEN',
      placeholder: 'r8_...',
      hint: 'مجاني عند التسجيل — replicate.com',
      hintUrl: 'https://replicate.com/account/api-tokens'
    },
    {
      id: 'fal',
    label: 'Fal.ai',
    icon: '🎨',
    color: '#dc2626',
    configKey: 'FAL_KEY',
    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx:...',
    testUrl: 'https://fal.run/fal-ai/fast-sdxl',
    testMethod: 'GET',
    testHeader: 'Authorization',
    testHeaderPrefix: 'Key ',
    hint: 'احصل على مفتاح من fal.ai/dashboard',
    hintUrl: 'https://fal.ai/dashboard/keys'
  },
  {
    id: 'json2video',
    label: 'JSON2Video',
    icon: '🎬',
    color: '#16a34a',
    configKey: 'JSON2VIDEO_API_KEY',
    placeholder: 'U0F8ed...',
    testUrl: 'https://api.json2video.com/v2/movies',
    testMethod: 'GET',
    testHeader: 'x-api-key',
    testHeaderPrefix: '',
    hint: 'احصل على مفتاح من json2video.com',
    hintUrl: 'https://json2video.com/account/api'
  },
  {
    id: 'jsonclip1',
    label: 'JSONClip (مفتاح 1)',
    icon: '🎞️',
    color: '#0284c7',
    configKey: 'JSONCLIP_API_KEY_1',
    placeholder: '2083b54d...',
    testUrl: 'https://api.jsonclip.com/render',
    testMethod: 'POST',
    testHeader: 'x-api-key',
    testHeaderPrefix: '',
    hint: 'jsonclip.com/docs — Render endpoint',
    hintUrl: 'https://jsonclip.com/docs'
  },
  {
    id: 'jsonclip2',
    label: 'JSONClip (مفتاح 2)',
    icon: '🎞️',
    color: '#0369a1',
    configKey: 'JSONCLIP_API_KEY_2',
    placeholder: '25f1764d...',
    testUrl: 'https://api.jsonclip.com/render',
    testMethod: 'POST',
    testHeader: 'x-api-key',
    testHeaderPrefix: '',
    hint: 'jsonclip.com/docs — مفتاح احتياطي',
    hintUrl: 'https://jsonclip.com/docs'
  }
];

/* ── تحميل المفاتيح من localStorage أو CONFIG ── */
function loadProvidersKeys() {
  try {
    const saved = localStorage.getItem(PROVIDERS_STORE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  const defaults = {};
  PROVIDERS_DEF.forEach(p => {
    defaults[p.id] = CONFIG[p.configKey] || '';
  });
  return defaults;
}

/* ── حفظ المفاتيح في localStorage وCONFIG ── */
function saveProvidersKeys(keys) {
  localStorage.setItem(PROVIDERS_STORE_KEY, JSON.stringify(keys));
  PROVIDERS_DEF.forEach(p => {
    if (keys[p.id]) CONFIG[p.configKey] = keys[p.id];
  });
}

/* ── فتح مودال إدارة المزودين ── */
function openProvidersManager() {
  renderProvidersManager();
  document.getElementById('providers-modal').style.display = 'flex';
}

/* ── إغلاق المودال ── */
function closeProvidersManager() {
  document.getElementById('providers-modal').style.display = 'none';
}

/* ── رسم الواجهة ── */
function renderProvidersManager() {
  const keys = loadProvidersKeys();
  const container = document.getElementById('providers-list');
  container.innerHTML = '';

  PROVIDERS_DEF.forEach(p => {
    const val = keys[p.id] || '';
    const isEmpty = !val || val.length < 5;

    const card = document.createElement('div');
    card.style.cssText = `
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.1);
      border-radius:14px;padding:16px;
      display:flex;flex-direction:column;gap:10px;
    `;

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="
            width:34px;height:34px;border-radius:10px;
            background:${p.color}22;border:1px solid ${p.color}55;
            display:flex;align-items:center;justify-content:center;font-size:16px;
          ">${p.icon}</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#e2e8f0">${p.label}</div>
            <a href="${p.hintUrl}" target="_blank"
               style="font-size:10px;color:${p.color};text-decoration:underline">${p.hint}</a>
          </div>
        </div>
        <div id="prov-status-${p.id}" style="font-size:11px;color:#475569">
          ${isEmpty ? '— غير مضبوط' : '🔵 مضبوط'}
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center">
        <input
          id="prov-input-${p.id}"
          type="password"
          placeholder="${p.placeholder}"
          value="${val}"
          style="
            flex:1;padding:10px 12px;border-radius:10px;
            background:rgba(0,0,0,0.4);
            border:1px solid rgba(255,255,255,0.1);
            color:#f1f5f9;font-size:12px;font-family:monospace;
            outline:none;transition:border-color 0.2s;
          "
          oninput="updateProviderCard('${p.id}')"
          onfocus="this.style.borderColor='${p.color}88'"
          onblur="this.style.borderColor='rgba(255,255,255,0.1)'"
        />
        <button onclick="toggleProviderKeyVisibility('${p.id}')" style="
          width:36px;height:36px;border-radius:9px;flex-shrink:0;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.1);
          color:#94a3b8;cursor:pointer;font-size:15px;
          display:flex;align-items:center;justify-content:center;
        ">👁</button>
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="testProviderKey('${p.id}')" style="
          flex:1;padding:8px;border-radius:10px;
          background:${p.color}22;
          border:1px solid ${p.color}44;
          color:#e2e8f0;font-size:12px;cursor:pointer;
          font-family:inherit;transition:all 0.2s;
        ">🔍 فحص المفتاح</button>
        <button onclick="clearProviderKey('${p.id}')" style="
          padding:8px 14px;border-radius:10px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
          color:#64748b;font-size:12px;cursor:pointer;
          font-family:inherit;
        ">🗑️</button>
      </div>
    `;

    container.appendChild(card);
  });

  updateProvidersSummary();
}

/* ── تحديث حالة البطاقة ── */
function updateProviderCard(id) {
  const input = document.getElementById('prov-input-' + id);
  const status = document.getElementById('prov-status-' + id);
  const val = input.value.trim();
  if (!val) {
    status.innerHTML = '— غير مضبوط';
    status.style.color = '#475569';
  } else {
    status.innerHTML = '🔵 مضبوط (لم يُفحص)';
    status.style.color = '#60a5fa';
  }
  updateProvidersSummary();
}

/* ── إظهار/إخفاء المفتاح ── */
function toggleProviderKeyVisibility(id) {
  const input = document.getElementById('prov-input-' + id);
  input.type = input.type === 'password' ? 'text' : 'password';
}

/* ── فحص مفتاح واحد ── */
async function testProviderKey(id) {
  const p = PROVIDERS_DEF.find(x => x.id === id);
  if (!p) return;
  const input = document.getElementById('prov-input-' + id);
  const status = document.getElementById('prov-status-' + id);
  const key = input.value.trim();

  if (!key) {
    status.innerHTML = '⚠️ أدخل مفتاحاً أولاً';
    status.style.color = '#f59e0b';
    return;
  }

  status.innerHTML = '⏳ جاري الفحص...';
  status.style.color = '#60a5fa';

  try {
    const headers = { 'Content-Type': 'application/json' };
    headers[p.testHeader] = p.testHeaderPrefix + key;

    const res = await fetch(p.testUrl, {
      method: p.testMethod,
      headers
    });

    if (res.ok) {
      status.innerHTML = '✅ يعمل';
      status.style.color = '#4ade80';
    } else if (res.status === 403) {
      const body = await res.json().catch(() => ({}));
      const msg = body.detail || body.message || '';
      if (msg.toLowerCase().includes('balance') || msg.toLowerCase().includes('exhausted')) {
        status.innerHTML = '⚠️ صالح — رصيد منتهٍ';
        status.style.color = '#f59e0b';
      } else {
        status.innerHTML = '❌ غير مصرح';
        status.style.color = '#f87171';
      }
    } else if (res.status === 401) {
      status.innerHTML = '❌ مفتاح غير صالح';
      status.style.color = '#f87171';
    } else if (res.status === 200 || res.status < 500) {
      status.innerHTML = '✅ يعمل';
      status.style.color = '#4ade80';
    } else {
      status.innerHTML = '❌ خطأ ' + res.status;
      status.style.color = '#f87171';
    }
  } catch (e) {
    status.innerHTML = '❌ فشل الاتصال';
    status.style.color = '#f87171';
  }
}

/* ── فحص جميع المفاتيح ── */
async function testAllProviderKeys() {
  const btn = document.getElementById('test-all-providers-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري فحص الجميع...'; }
  for (const p of PROVIDERS_DEF) {
    await testProviderKey(p.id);
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔍 فحص الجميع'; }
}

/* ── حذف مفتاح ── */
function clearProviderKey(id) {
  const input = document.getElementById('prov-input-' + id);
  if (input) { input.value = ''; updateProviderCard(id); }
}

/* ── حفظ جميع المفاتيح ── */
function saveAllProviderKeys() {
  const keys = {};
  PROVIDERS_DEF.forEach(p => {
    const val = document.getElementById('prov-input-' + p.id)?.value.trim() || '';
    keys[p.id] = val;
  });

  saveProvidersKeys(keys);

  const btn = document.getElementById('save-providers-btn');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✅ تم الحفظ!';
    btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = 'linear-gradient(135deg,#7c3aed,#5b21b6)';
    }, 2000);
  }

  updateProvidersSummary();
}

/* ── ملخص عدد المفاتيح المضبوطة ── */
function updateProvidersSummary() {
  const inputs = PROVIDERS_DEF.map(p => document.getElementById('prov-input-' + p.id)?.value.trim() || '');
  const active = inputs.filter(k => k && k.length > 5).length;
  const el = document.getElementById('providers-summary');
  if (el) {
    el.textContent = active + ' / ' + PROVIDERS_DEF.length + ' مفاتيح مضبوطة';
    el.style.color = active === PROVIDERS_DEF.length ? '#4ade80' : active > 0 ? '#f59e0b' : '#f87171';
  }
}

/* ── تهيئة عند تحميل الصفحة ── */
document.addEventListener('DOMContentLoaded', () => {
  const keys = loadProvidersKeys();
  PROVIDERS_DEF.forEach(p => {
    if (keys[p.id]) CONFIG[p.configKey] = keys[p.id];
  });
});
