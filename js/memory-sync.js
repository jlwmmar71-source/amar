/* ══════════════════════════════════════════════
   memory-sync.js — ذاكرة طويلة المدى + مزامنة عبر الأجهزة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const MemorySync = (() => {

  const SYNC_KEY   = 'galaoum_sync_config';
  const LONG_MEM   = 'galaoum_long_memory_v1';
  const SNAPSHOTS  = 'galaoum_snapshots_v1';
  const MAX_ITEMS  = 500;

  /* ── تحميل إعدادات المزامنة ── */
  function _config() {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY) || '{}'); }
    catch { return {}; }
  }

  function _saveConfig(cfg) {
    localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
  }

  /* ════════════════════════
     ذاكرة طويلة المدى (Local)
  ════════════════════════ */

  function loadLongMemory() {
    try { return JSON.parse(localStorage.getItem(LONG_MEM) || '[]'); }
    catch { return []; }
  }

  function saveLongMemory(items) {
    const trimmed = items.slice(-MAX_ITEMS);
    localStorage.setItem(LONG_MEM, JSON.stringify(trimmed));
  }

  /* إضافة فقرة للذاكرة الطويلة */
  function remember(content, meta = {}) {
    const mem = loadLongMemory();
    mem.push({
      id: Date.now(),
      ts: new Date().toISOString(),
      content: content.substring(0, 1000),
      tags: meta.tags || [],
      session: meta.session || _getSession(),
      importance: meta.importance || 1
    });
    saveLongMemory(mem);
  }

  /* بحث في الذاكرة الطويلة */
  function search(query, limit = 5) {
    const mem = loadLongMemory();
    const q = query.toLowerCase();
    return mem
      .filter(m => m.content.toLowerCase().includes(q))
      .sort((a, b) => b.importance - a.importance || new Date(b.ts) - new Date(a.ts))
      .slice(0, limit);
  }

  /* تلخيص الذاكرة الطويلة (Compression) */
  async function compress() {
    const mem = loadLongMemory();
    if (mem.length < 50) return 'لا يوجد ما يكفي للضغط بعد';
    const oldest = mem.slice(0, 30);
    const text = oldest.map(m => `- ${m.content.substring(0, 200)}`).join('\n');
    try {
      const summary = await callGeminiAPI(
        `لخّص هذه المعلومات في 3-5 نقاط رئيسية باختصار:\n${text}`,
        'أنت نظام ضغط ذاكرة. أعد ملخصاً مختصراً.',
        []
      );
      const newMem = [
        { id: Date.now(), ts: new Date().toISOString(), content: '📦 ملخص: ' + summary, tags: ['compressed'], importance: 2 },
        ...mem.slice(30)
      ];
      saveLongMemory(newMem);
      return `✅ تم ضغط ${oldest.length} فقرة → ملخص`;
    } catch (e) {
      return '❌ فشل الضغط: ' + e.message;
    }
  }

  /* ════════════════════════
     Snapshots — لقطات الجلسة
  ════════════════════════ */

  function saveSnapshot(name = '') {
    const snaps = _getSnapshots();
    const label = name || new Date().toLocaleString('ar-SA');
    const data = {
      id: Date.now(),
      label,
      ts: new Date().toISOString(),
      memory: typeof loadMemory === 'function' ? loadMemory() : [],
      longMemory: loadLongMemory(),
      config: { platform: typeof getSelectedPlatform === 'function' ? getSelectedPlatform() : 'auto' }
    };
    snaps.unshift(data);
    localStorage.setItem(SNAPSHOTS, JSON.stringify(snaps.slice(0, 20)));
    return data.id;
  }

  function _getSnapshots() {
    try { return JSON.parse(localStorage.getItem(SNAPSHOTS) || '[]'); }
    catch { return []; }
  }

  function restoreSnapshot(id) {
    const snap = _getSnapshots().find(s => s.id === id);
    if (!snap) return false;
    if (snap.longMemory) saveLongMemory(snap.longMemory);
    if (snap.memory && typeof saveMemory === 'function') {
      localStorage.setItem('galaoum_memory_v2', JSON.stringify(snap.memory));
    }
    return true;
  }

  /* ════════════════════════
     مزامنة عبر الأجهزة
  ════════════════════════ */

  /* ── تصدير الذاكرة كنص مشفر ── */
  function exportCode() {
    const data = {
      v: 1,
      ts: new Date().toISOString(),
      shortMem: typeof loadMemory === 'function' ? loadMemory().slice(-20) : [],
      longMem: loadLongMemory().slice(-50),
      platform: typeof getSelectedPlatform === 'function' ? getSelectedPlatform() : 'auto'
    };
    const json = JSON.stringify(data);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return b64;
  }

  /* ── استيراد من نص مشفر ── */
  function importCode(code) {
    try {
      const json = decodeURIComponent(escape(atob(code.trim())));
      const data = JSON.parse(json);
      if (data.longMem) saveLongMemory(data.longMem);
      if (data.shortMem) localStorage.setItem('galaoum_memory_v2', JSON.stringify(data.shortMem));
      if (data.platform && typeof setSelectedPlatform === 'function') setSelectedPlatform(data.platform);
      return { ok: true, items: data.longMem?.length || 0 };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* ── مزامنة عبر JSONBin (خدمة مجانية) ── */
  async function pushToCloud() {
    const cfg = _config();
    const code = exportCode();
    const apiKey = cfg.jsonbinKey;
    const binId  = cfg.jsonbinId;

    if (!apiKey) return { ok: false, error: 'أضف مفتاح JSONBin في إعدادات المزامنة' };

    try {
      const method = binId ? 'PUT' : 'POST';
      const url = binId ? `https://api.jsonbin.io/v3/b/${binId}` : 'https://api.jsonbin.io/v3/b';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': apiKey, 'X-Bin-Private': 'true', 'X-Bin-Name': 'galaoum-memory' },
        body: JSON.stringify({ memory: code, ts: new Date().toISOString() })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      if (!binId) {
        cfg.jsonbinId = d.metadata?.id || d.record?.id;
        _saveConfig(cfg);
      }
      return { ok: true, binId: cfg.jsonbinId };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function pullFromCloud() {
    const cfg = _config();
    if (!cfg.jsonbinKey || !cfg.jsonbinId) return { ok: false, error: 'لم يتم ضبط المزامنة بعد' };
    try {
      const res = await fetch(`https://api.jsonbin.io/v3/b/${cfg.jsonbinId}/latest`, {
        headers: { 'X-Master-Key': cfg.jsonbinKey }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const code = d.record?.memory;
      if (!code) throw new Error('لا توجد بيانات في السحابة');
      return importCode(code);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* ── مزامنة عبر GitHub Gist ── */
  async function pushToGist() {
    const cfg = _config();
    if (!cfg.githubToken) return { ok: false, error: 'أضف GitHub Token في الإعدادات' };
    const code = exportCode();
    try {
      const method = cfg.gistId ? 'PATCH' : 'POST';
      const url = cfg.gistId
        ? `https://api.github.com/gists/${cfg.gistId}`
        : 'https://api.github.com/gists';
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': 'Bearer ' + cfg.githubToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Galaoum AI Memory', public: false, files: { 'galaoum-memory.txt': { content: code } } })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      if (!cfg.gistId) { cfg.gistId = d.id; _saveConfig(cfg); }
      return { ok: true, gistId: cfg.gistId };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async function pullFromGist() {
    const cfg = _config();
    if (!cfg.githubToken || !cfg.gistId) return { ok: false, error: 'لم يتم ضبط GitHub Gist' };
    try {
      const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
        headers: { 'Authorization': 'Bearer ' + cfg.githubToken }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const code = d.files?.['galaoum-memory.txt']?.content;
      if (!code) throw new Error('الملف فارغ');
      return importCode(code);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function _getSession() {
    let s = sessionStorage.getItem('galaoum_session');
    if (!s) { s = Date.now().toString(36); sessionStorage.setItem('galaoum_session', s); }
    return s;
  }

  /* ════════════════════════
     الواجهة المرئية
  ════════════════════════ */

  function openPanel() {
    _ensurePanel();
    document.getElementById('memory-sync-panel').style.display = 'flex';
    _renderStats();
    _renderSnapshots();
  }

  function closePanel() {
    const p = document.getElementById('memory-sync-panel');
    if (p) p.style.display = 'none';
  }

  function _renderStats() {
    const el = document.getElementById('memsync-stats');
    if (!el) return;
    const lm = loadLongMemory();
    const sm = typeof loadMemory === 'function' ? loadMemory() : [];
    const snaps = _getSnapshots();
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
        ${[
          { label: 'ذاكرة قصيرة', value: sm.length + ' رسالة', color: '#4285f4' },
          { label: 'ذاكرة طويلة', value: lm.length + ' فقرة', color: '#39d353' },
          { label: 'لقطات محفوظة', value: snaps.length + ' لقطة', color: '#f59e0b' }
        ].map(s => `
          <div style="background:${s.color}15;border:1px solid ${s.color}33;border-radius:10px;padding:10px;text-align:center">
            <div style="font-size:16px;font-weight:700;color:${s.color}">${s.value}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px">${s.label}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function _renderSnapshots() {
    const el = document.getElementById('memsync-snapshots');
    if (!el) return;
    const snaps = _getSnapshots();
    el.innerHTML = snaps.length ? snaps.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:6px">
        <div>
          <div style="font-size:12px;color:#94a3b8;font-weight:600">${s.label}</div>
          <div style="font-size:10px;color:#475569">${s.memory?.length || 0} رسالة · ${s.longMemory?.length || 0} فقرة</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="MemorySync._doRestore(${s.id})" style="padding:4px 10px;border-radius:7px;font-size:10px;cursor:pointer;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.2);color:#4ade80;font-family:inherit">استعادة</button>
          <button onclick="MemorySync._deleteSnap(${s.id})" style="padding:4px 10px;border-radius:7px;font-size:10px;cursor:pointer;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;font-family:inherit">حذف</button>
        </div>
      </div>
    `).join('') : '<div style="color:#475569;font-size:12px;text-align:center;padding:16px">لا توجد لقطات محفوظة بعد</div>';
  }

  function _doRestore(id) {
    if (restoreSnapshot(id)) { alert('✅ تم استعادة اللقطة'); closePanel(); }
    else alert('❌ فشلت الاستعادة');
  }

  function _deleteSnap(id) {
    const snaps = _getSnapshots().filter(s => s.id !== id);
    localStorage.setItem(SNAPSHOTS, JSON.stringify(snaps));
    _renderSnapshots();
  }

  function _ensurePanel() {
    if (document.getElementById('memory-sync-panel')) return;
    const el = document.createElement('div');
    el.id = 'memory-sync-panel';
    el.style.cssText = `
      display:none;position:fixed;inset:0;z-index:9200;
      background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
      align-items:center;justify-content:center;padding:20px;font-family:inherit;
    `;
    el.onclick = e => { if (e.target === el) closePanel(); };
    el.innerHTML = `
      <div style="width:100%;max-width:580px;max-height:88vh;background:linear-gradient(160deg,#0d1425,#0a0f1e);border:1px solid rgba(74,222,128,0.2);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,0.8)">
        <div style="padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
          <div>
            <div style="font-size:16px;font-weight:700;color:#f1f5f9">🧠 الذاكرة الطويلة والمزامنة</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">احفظ وزامن ذاكرة Galaoum عبر أجهزتك</div>
          </div>
          <button onclick="MemorySync.closePanel()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px">×</button>
        </div>
        <div style="overflow-y:auto;flex:1;padding:18px 22px;display:flex;flex-direction:column;gap:16px">

          <!-- الإحصاء -->
          <div id="memsync-stats"></div>

          <!-- أزرار سريعة -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button onclick="MemorySync._doSaveSnap()" style="padding:10px;border-radius:10px;font-size:12px;cursor:pointer;font-family:inherit;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.2);color:#4ade80;transition:all 0.2s">💾 حفظ لقطة الآن</button>
            <button onclick="MemorySync._doCompress()" style="padding:10px;border-radius:10px;font-size:12px;cursor:pointer;font-family:inherit;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.2);color:#fbbf24;transition:all 0.2s">🗜️ ضغط الذاكرة القديمة</button>
            <button onclick="MemorySync._doCopyCode()" style="padding:10px;border-radius:10px;font-size:12px;cursor:pointer;font-family:inherit;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;transition:all 0.2s">📋 نسخ كود التصدير</button>
            <button onclick="MemorySync._doImportPrompt()" style="padding:10px;border-radius:10px;font-size:12px;cursor:pointer;font-family:inherit;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2);color:#a78bfa;transition:all 0.2s">📥 استيراد من كود</button>
          </div>

          <!-- اللقطات -->
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:8px">📸 اللقطات المحفوظة:</div>
            <div id="memsync-snapshots"></div>
          </div>

          <!-- مزامنة السحابة -->
          <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px">
            <div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:12px">☁️ مزامنة عبر السحابة</div>

            <div style="margin-bottom:10px">
              <div style="font-size:10px;color:#475569;margin-bottom:4px">JSONBin API Key (مجاني من jsonbin.io):</div>
              <div style="display:flex;gap:6px">
                <input id="jsonbin-key-input" type="password" placeholder="$2b$10$..."
                  style="flex:1;padding:8px 10px;border-radius:8px;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;font-size:11px;outline:none"/>
                <button onclick="MemorySync._saveJsonbinKey()" style="padding:8px 12px;border-radius:8px;font-size:11px;cursor:pointer;font-family:inherit;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.2);color:#4ade80">حفظ</button>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <button onclick="MemorySync._doCloudPush()" style="padding:8px;border-radius:8px;font-size:11px;cursor:pointer;font-family:inherit;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa">☁️ رفع للسحابة</button>
              <button onclick="MemorySync._doCloudPull()" style="padding:8px;border-radius:8px;font-size:11px;cursor:pointer;font-family:inherit;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2);color:#a78bfa">⬇️ جلب من السحابة</button>
            </div>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  function _doSaveSnap() { const id = saveSnapshot(); _renderSnapshots(); _renderStats(); alert('✅ تم حفظ اللقطة'); }
  async function _doCompress() { const r = await compress(); alert(r); _renderStats(); }
  function _doCopyCode() { navigator.clipboard.writeText(exportCode()).then(() => alert('✅ تم نسخ كود التصدير')).catch(() => prompt('انسخ الكود:', exportCode())); }
  function _doImportPrompt() { const code = prompt('الصق كود الاستيراد:'); if (code) { const r = importCode(code); alert(r.ok ? `✅ تم استيراد ${r.items} فقرة` : '❌ ' + r.error); } }
  async function _doCloudPush() { const r = await pushToCloud(); alert(r.ok ? '✅ تم الرفع: ' + r.binId : '❌ ' + r.error); }
  async function _doCloudPull() { const r = await pullFromCloud(); alert(r.ok ? `✅ تم الجلب: ${r.items} فقرة` : '❌ ' + r.error); }
  function _saveJsonbinKey() { const k = document.getElementById('jsonbin-key-input')?.value?.trim(); if (k) { const cfg = _config(); cfg.jsonbinKey = k; _saveConfig(cfg); alert('✅ تم حفظ المفتاح'); } }

  return { remember, search, compress, loadLongMemory, saveLongMemory, saveSnapshot, restoreSnapshot, exportCode, importCode, pushToCloud, pullFromCloud, pushToGist, pullFromGist, openPanel, closePanel, _doRestore, _deleteSnap, _doSaveSnap, _doCompress, _doCopyCode, _doImportPrompt, _doCloudPush, _doCloudPull, _saveJsonbinKey };
})();
