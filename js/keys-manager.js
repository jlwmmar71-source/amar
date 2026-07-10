/* ══════════════════════════════════════════════
   keys-manager.js — إدارة مفاتيح Gemini API
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const STORAGE_KEY = 'galaoum_gemini_keys';

/* ── تحميل المفاتيح من localStorage ── */
function loadGeminiKeys() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const keys = JSON.parse(saved);
      if (Array.isArray(keys) && keys.length === 3) {
        CONFIG.GEMINI_API_KEYS = keys;
      }
    }
  } catch (e) {}
}

/* ── حفظ المفاتيح في localStorage ── */
function saveGeminiKeys(keys) {
  CONFIG.GEMINI_API_KEYS = keys;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

/* ── فتح شاشة التحكم ── */
function openKeysManager() {
  loadGeminiKeys();
  renderKeysManager();
  document.getElementById('keys-modal').style.display = 'flex';
}

/* ── إغلاق الشاشة ── */
function closeKeysManager() {
  document.getElementById('keys-modal').style.display = 'none';
}

/* ── رسم الواجهة ── */
function renderKeysManager() {
  const keys = CONFIG.GEMINI_API_KEYS;
  const container = document.getElementById('keys-list');
  container.innerHTML = '';

  keys.forEach((key, i) => {
    const isEmpty = !key || key.includes('_HERE');
    const displayKey = isEmpty ? '' : key;

    const card = document.createElement('div');
    card.id = 'key-card-' + i;
    card.style.cssText = `
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(220,38,38,0.2);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="
            width:28px;height:28px;border-radius:8px;
            background:linear-gradient(135deg,#dc2626,#991b1b);
            display:flex;align-items:center;justify-content:center;
            font-size:13px;font-weight:700;color:#fff;flex-shrink:0
          ">${i + 1}</div>
          <span style="font-size:13px;color:#fca5a5;font-weight:600">المفتاح ${i + 1}</span>
        </div>
        <div id="status-${i}" style="font-size:12px;color:#475569">
          ${isEmpty ? '— غير مضبوط' : '🔵 مضبوط'}
        </div>
      </div>

      <div style="display:flex;gap:8px;align-items:center">
        <input
          id="key-input-${i}"
          type="password"
          placeholder="الصق مفتاح Gemini هنا..."
          value="${displayKey}"
          style="
            flex:1;padding:10px 12px;border-radius:10px;
            background:rgba(0,0,0,0.4);
            border:1px solid rgba(255,255,255,0.1);
            color:#f1f5f9;font-size:12px;font-family:monospace;
            outline:none;transition:border-color 0.2s;
          "
          oninput="updateKeyCard(${i})"
          onfocus="this.style.borderColor='rgba(220,38,38,0.5)'"
          onblur="this.style.borderColor='rgba(255,255,255,0.1)'"
        />
        <button onclick="toggleKeyVisibility(${i})" title="إظهار/إخفاء" style="
          width:36px;height:36px;border-radius:9px;flex-shrink:0;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.1);
          color:#94a3b8;cursor:pointer;font-size:15px;
          display:flex;align-items:center;justify-content:center;
        ">👁</button>
      </div>

      <div style="display:flex;gap:8px">
        <button onclick="testSingleKey(${i})" style="
          flex:1;padding:8px;border-radius:10px;
          background:rgba(220,38,38,0.15);
          border:1px solid rgba(220,38,38,0.3);
          color:#fca5a5;font-size:12px;cursor:pointer;
          font-family:inherit;transition:all 0.2s;
        " onmouseover="this.style.background='rgba(220,38,38,0.25)'"
           onmouseout="this.style.background='rgba(220,38,38,0.15)'">
          🔍 فحص المفتاح
        </button>
        <button onclick="clearKey(${i})" style="
          padding:8px 14px;border-radius:10px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.08);
          color:#64748b;font-size:12px;cursor:pointer;
          font-family:inherit;transition:all 0.2s;
        " onmouseover="this.style.color='#94a3b8'"
           onmouseout="this.style.color='#64748b'">
          🗑️ حذف
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  updateSummary();
}

/* ── تحديث مؤشر الحالة عند الكتابة ── */
function updateKeyCard(index) {
  const input = document.getElementById('key-input-' + index);
  const status = document.getElementById('status-' + index);
  const val = input.value.trim();
  if (!val) {
    status.innerHTML = '— غير مضبوط';
    status.style.color = '#475569';
  } else {
    status.innerHTML = '🔵 مضبوط (لم يُفحص)';
    status.style.color = '#60a5fa';
  }
}

/* ── إظهار/إخفاء المفتاح ── */
function toggleKeyVisibility(index) {
  const input = document.getElementById('key-input-' + index);
  input.type = input.type === 'password' ? 'text' : 'password';
}

/* ── فحص مفتاح واحد ── */
async function testSingleKey(index) {
  const input = document.getElementById('key-input-' + index);
  const status = document.getElementById('status-' + index);
  const key = input.value.trim();

  if (!key) {
    status.innerHTML = '⚠️ أدخل مفتاحاً أولاً';
    status.style.color = '#f59e0b';
    return;
  }

  status.innerHTML = '<span style="animation:spin 1s linear infinite;display:inline-block">⏳</span> جاري الفحص...';
  status.style.color = '#60a5fa';

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      }
    );

    if (res.ok) {
      status.innerHTML = '✅ يعمل';
      status.style.color = '#4ade80';
    } else if (res.status === 429) {
      status.innerHTML = '⚠️ صالح — تجاوز الحد المؤقت';
      status.style.color = '#f59e0b';
    } else if (res.status === 400 || res.status === 403) {
      status.innerHTML = '❌ مفتاح غير صالح';
      status.style.color = '#f87171';
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
async function testAllKeysUI() {
  const btn = document.getElementById('test-all-btn');
  btn.disabled = true;
  btn.textContent = '⏳ جاري فحص الجميع...';

  for (let i = 0; i < 3; i++) {
    await testSingleKey(i);
  }

  btn.disabled = false;
  btn.textContent = '🔍 فحص الجميع';
}

/* ── حذف مفتاح ── */
function clearKey(index) {
  const input = document.getElementById('key-input-' + index);
  input.value = '';
  updateKeyCard(index);
}

/* ── حفظ جميع المفاتيح ── */
function saveAllKeys() {
  const keys = [0, 1, 2].map(i => {
    const val = document.getElementById('key-input-' + i)?.value.trim() || '';
    return val || 'GEMINI_KEY_' + (i+1) + '_HERE';
  });

  saveGeminiKeys(keys);
  GeminiKeyManager._currentIndex = 0;

  const btn = document.getElementById('save-keys-btn');
  const orig = btn.textContent;
  btn.textContent = '✅ تم الحفظ!';
  btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = 'linear-gradient(135deg,#dc2626,#991b1b)';
  }, 2000);

  updateSummary();
}

/* ── تحديث ملخص عدد المفاتيح ── */
function updateSummary() {
  const keys = [0, 1, 2].map(i => document.getElementById('key-input-' + i)?.value.trim() || '');
  const active = keys.filter(k => k && !k.includes('_HERE')).length;
  const el = document.getElementById('keys-summary');
  if (el) {
    el.textContent = active + ' / 3 مفاتيح مضبوطة';
    el.style.color = active === 3 ? '#4ade80' : active > 0 ? '#f59e0b' : '#f87171';
  }
}

/* ── تهيئة عند تحميل الصفحة ── */
document.addEventListener('DOMContentLoaded', () => {
  loadGeminiKeys();
});
