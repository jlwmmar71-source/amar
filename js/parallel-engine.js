/* ══════════════════════════════════════════════
   parallel-engine.js — تشغيل نماذج متعددة بالتوازي
   + Consensus Engine لدمج النتائج
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const ParallelEngine = (() => {

  /* ── الأوزان الافتراضية لكل مزود ── */
  const PROVIDER_WEIGHTS = {
    gemini: 1.3, openrouter: 1.2, mistral: 1.1,
    cohere: 1.0, cerebras: 1.0, bazaarlink: 1.1,
    pollinations: 0.8, huggingface: 0.7
  };

  /* ── استدعاء مزود واحد مباشرة ── */
  async function _callDirect(providerId, prompt, systemPrompt, history) {
    const t0 = Date.now();
    try {
      let text = '';
      switch (providerId) {
        case 'gemini':
          text = await callGeminiAPI(prompt, systemPrompt, history);
          break;
        case 'mistral':
          text = await callMistralAPI(prompt, systemPrompt, history);
          break;
        case 'cohere':
          text = await callCohereAPI(prompt, history);
          break;
        case 'cerebras':
          text = await callCerebrasAPI(prompt, systemPrompt, history);
          break;
        case 'openrouter': {
          const models = ['nvidia/nemotron-3-ultra-550b-a55b:free','meta-llama/llama-3.3-70b-instruct:free','google/gemma-4-31b-it:free'];
          for (const model of models) {
            const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 25000);
            try {
              const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST', signal: ctrl.signal,
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.OPENROUTER_API_KEY },
                body: JSON.stringify({ model, max_tokens: 4096, messages: [{ role:'system', content: systemPrompt }, ...history, { role:'user', content: prompt }] })
              });
              clearTimeout(tid);
              if (!res.ok) continue;
              const r = (await res.json()).choices?.[0]?.message?.content;
              if (r) { text = r; break; }
            } catch { clearTimeout(tid); }
          }
          break;
        }
        case 'bazaarlink': {
          const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 25000);
          try {
            const res = await fetch(CONFIG.BAZAARLINK_BASE_URL, {
              method: 'POST', signal: ctrl.signal,
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.BAZAARLINK_API_KEY },
              body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 4096, messages: [{ role:'system', content: systemPrompt }, ...history, { role:'user', content: prompt }] })
            });
            clearTimeout(tid);
            text = (res.ok ? (await res.json()).choices?.[0]?.message?.content : '') || '';
          } catch { clearTimeout(tid); }
          break;
        }
        case 'pollinations': {
          const ctrl = new AbortController(), tid = setTimeout(() => ctrl.abort(), 25000);
          try {
            const res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${encodeURIComponent(systemPrompt)}&model=openai&private=true`, { signal: ctrl.signal });
            clearTimeout(tid);
            text = res.ok ? await res.text() : '';
          } catch { clearTimeout(tid); }
          break;
        }
        default:
          throw new Error('مزود غير معروف: ' + providerId);
      }
      if (!text || !text.trim()) throw new Error('رد فارغ');
      return { provider: providerId, text: text.trim(), ms: Date.now() - t0, ok: true };
    } catch (e) {
      return { provider: providerId, text: '', ms: Date.now() - t0, ok: false, error: e.message };
    }
  }

  /* ── تشغيل عدة مزودين بالتوازي ── */
  async function runParallel(prompt, providerIds, systemPrompt = '', history = []) {
    _log('بدء التشغيل المتوازي: ' + providerIds.join(', '));
    const sp = systemPrompt || _defaultSystem();
    const results = await Promise.allSettled(
      providerIds.map(id => _callDirect(id, prompt, sp, history))
    );
    return results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { provider: providerIds[i], ok: false, text: '', error: r.reason?.message }
    );
  }

  /* ══ Consensus Engine ══ */
  const ConsensusEngine = {

    /* ── تقييم جودة رد واحد ── */
    score(result) {
      if (!result.ok || !result.text) return 0;
      const t = result.text;
      let s = 0;
      s += Math.min(t.length / 100, 20);          // الطول (حد أقصى 20)
      s += (t.match(/[\u0600-\u06ff]/g)||[]).length / 50;  // محتوى عربي
      s += (t.match(/```/g)||[]).length * 2;       // كود منظم
      s += (t.match(/\n#{1,3} /g)||[]).length;     // عناوين
      s += (t.match(/\n[-*•] /g)||[]).length * 0.5;// نقاط
      s -= Math.max(0, result.ms - 10000) / 1000;  // عقوبة البطء
      s *= (PROVIDER_WEIGHTS[result.provider] || 1);
      return Math.max(0, s);
    },

    /* ── اختيار أفضل نتيجة ── */
    selectBest(results) {
      const valid = results.filter(r => r.ok && r.text);
      if (!valid.length) return null;
      return valid.sort((a, b) => this.score(b) - this.score(a))[0];
    },

    /* ── دمج النتائج (Merge) ── */
    merge(results, mode = 'smart') {
      const valid = results.filter(r => r.ok && r.text);
      if (!valid.length) return null;
      if (valid.length === 1) return valid[0];

      if (mode === 'vote') {
        /* أقصر جملة أو أكثر جواباً موافقة ← نظام تصويت بسيط */
        return this.selectBest(valid);
      }

      if (mode === 'concat') {
        /* دمج جميع الردود تحت عناوين */
        const merged = valid.map(r =>
          `### ${_providerIcon(r.provider)} ${r.provider.toUpperCase()}\n${r.text}`
        ).join('\n\n---\n\n');
        return { provider: 'merged', text: merged, ok: true, merged: true };
      }

      /* smart: احتفظ بأفضل رد وأضف إضافات مفيدة من الباقين */
      const scored = valid.map(r => ({ ...r, _score: this.score(r) }))
                          .sort((a, b) => b._score - a._score);
      const best = scored[0];
      /* أضف ملاحظات الإجماع إذا كانت النتائج متفقة */
      const agreement = _calcAgreement(valid.map(r => r.text));
      let note = '';
      if (valid.length > 1) {
        note = `\n\n---\n*🔀 تم التحقق من ${valid.length} نماذج — توافق ${agreement}%*`;
      }
      return { ...best, text: best.text + note, ok: true };
    }
  };

  /* ── نسبة التوافق بين النصوص ── */
  function _calcAgreement(texts) {
    if (texts.length < 2) return 100;
    const words = texts.map(t => new Set(t.toLowerCase().split(/\s+/).slice(0, 50)));
    let total = 0, count = 0;
    for (let i = 0; i < words.length; i++)
      for (let j = i + 1; j < words.length; j++) {
        const inter = [...words[i]].filter(w => words[j].has(w)).length;
        const uni = new Set([...words[i], ...words[j]]).size;
        total += uni > 0 ? inter / uni : 0;
        count++;
      }
    return Math.round((count > 0 ? total / count : 0) * 100);
  }

  function _providerIcon(id) {
    const icons = { gemini:'♊', openrouter:'🌐', mistral:'🌊', cohere:'⚡', cerebras:'🧠', bazaarlink:'🛒', pollinations:'🌸' };
    return icons[id] || '🤖';
  }

  function _defaultSystem() {
    return 'أنت Galaoum AI Engine v5.0 — مساعد ذكاء اصطناعي محترف. أجب بدقة واحترافية.';
  }

  function _log(msg) {
    if (typeof Logger !== 'undefined') Logger.info('PARALLEL', msg);
    else console.log('[PARALLEL]', msg);
  }

  /* ══ الواجهة العامة ══ */
  let _panelOpen = false;
  let _selectedProviders = ['gemini', 'openrouter', 'mistral'];
  let _mergeMode = 'smart';
  let _active = false;  // وضع التوازي مفعّل؟

  function isActive() { return _active; }
  function setActive(v) {
    _active = v;
    _renderToggle();
    localStorage.setItem('galaoum_parallel_active', v ? '1' : '0');
  }

  /* ── تشغيل الوضع المتوازي على طلب المستخدم ── */
  async function processParallel(prompt, history = []) {
    const sp = (typeof getSystemPrompt === 'function') ? getSystemPrompt(prompt) : _defaultSystem();
    _showProgress(_selectedProviders);
    const results = await runParallel(prompt, _selectedProviders, sp, history);
    _hideProgress();
    const merged = ConsensusEngine.merge(results, _mergeMode);
    _showResults(results, merged);
    return merged ? merged.text : null;
  }

  /* ── عرض تقدم التشغيل ── */
  function _showProgress(providers) {
    let bar = document.getElementById('parallel-progress-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'parallel-progress-bar';
      bar.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:rgba(10,15,30,0.95);border:1px solid rgba(220,38,38,0.3);
        border-radius:16px;padding:14px 20px;z-index:8888;
        display:flex;align-items:center;gap:12px;
        font-size:12px;color:#94a3b8;box-shadow:0 8px 30px rgba(0,0,0,0.5);
        backdrop-filter:blur(10px);
      `;
      document.body.appendChild(bar);
    }
    bar.innerHTML = `
      <div style="width:16px;height:16px;border:2px solid #dc2626;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>
      <span>⚡ تشغيل متوازي: <strong style="color:#f1f5f9">${providers.join(' · ')}</strong></span>
    `;
    bar.style.display = 'flex';
  }

  function _hideProgress() {
    const bar = document.getElementById('parallel-progress-bar');
    if (bar) bar.style.display = 'none';
  }

  /* ── عرض نتائج المقارنة ── */
  function _showResults(results, merged) {
    let panel = document.getElementById('parallel-results-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'parallel-results-panel';
      panel.style.cssText = `
        position:fixed;left:20px;bottom:80px;width:340px;max-height:70vh;
        background:rgba(10,15,30,0.97);border:1px solid rgba(220,38,38,0.2);
        border-radius:16px;z-index:8887;overflow:hidden;
        box-shadow:0 12px 40px rgba(0,0,0,0.6);backdrop-filter:blur(10px);
        font-size:12px;display:flex;flex-direction:column;
      `;
      document.body.appendChild(panel);
    }
    const ok = results.filter(r => r.ok);
    const fail = results.filter(r => !r.ok);
    panel.innerHTML = `
      <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span style="font-weight:700;color:#f1f5f9">⚡ نتائج التشغيل المتوازي</span>
        <button onclick="document.getElementById('parallel-results-panel').style.display='none'"
          style="background:none;border:none;color:#64748b;cursor:pointer;font-size:16px">×</button>
      </div>
      <div style="padding:12px 16px;overflow-y:auto;flex:1">
        ${ok.map(r => `
          <div style="margin-bottom:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07)">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-weight:700;color:#4ade80">${_providerIcon(r.provider)} ${r.provider}</span>
              <span style="color:#64748b">${r.ms}ms · ${ConsensusEngine.score(r).toFixed(1)}pts</span>
            </div>
            <div style="color:#94a3b8;font-size:11px;max-height:60px;overflow:hidden;text-overflow:ellipsis">${r.text.substring(0,200)}…</div>
          </div>
        `).join('')}
        ${fail.map(r => `
          <div style="margin-bottom:8px;padding:8px 10px;border-radius:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:#ef4444;font-size:11px">
            ${_providerIcon(r.provider)} ${r.provider}: ${r.error || 'فشل'}
          </div>
        `).join('')}
        ${merged ? `<div style="padding:8px 10px;border-radius:8px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.2);color:#4ade80;font-size:11px;margin-top:4px">✅ تم الدمج بنمط: <strong>${_mergeMode}</strong></div>` : ''}
      </div>
    `;
    panel.style.display = 'flex';
    setTimeout(() => { if (panel) panel.style.display = 'none'; }, 12000);
  }

  /* ══ لوحة الإعدادات ══ */
  function openPanel() {
    _ensurePanel();
    document.getElementById('parallel-panel').style.display = 'flex';
    _renderPanel();
  }

  function closePanel() {
    const p = document.getElementById('parallel-panel');
    if (p) p.style.display = 'none';
  }

  function _renderToggle() {
    const btn = document.getElementById('parallel-toggle-btn');
    if (!btn) return;
    btn.style.background = _active ? 'rgba(220,38,38,0.2)' : 'rgba(255,255,255,0.04)';
    btn.style.borderColor = _active ? 'rgba(220,38,38,0.5)' : 'rgba(255,255,255,0.08)';
    btn.style.color = _active ? '#fca5a5' : '#64748b';
    btn.textContent = _active ? '⚡ متوازي ON' : '⚡ متوازي OFF';
  }

  const ALL_PARALLEL_PROVIDERS = ['gemini','openrouter','mistral','cohere','cerebras','bazaarlink','pollinations'];

  function _renderPanel() {
    const grid = document.getElementById('parallel-providers-grid');
    if (!grid) return;
    grid.innerHTML = ALL_PARALLEL_PROVIDERS.map(id => {
      const on = _selectedProviders.includes(id);
      const icons = { gemini:'♊', openrouter:'🌐', mistral:'🌊', cohere:'⚡', cerebras:'🧠', bazaarlink:'🛒', pollinations:'🌸' };
      const colors = { gemini:'#4285f4', openrouter:'#7c3aed', mistral:'#ff7000', cohere:'#39d353', cerebras:'#0891b2', bazaarlink:'#f59e0b', pollinations:'#ec4899' };
      return `
        <button onclick="ParallelEngine._toggleProvider('${id}')" style="
          padding:8px 12px;border-radius:10px;font-size:11px;cursor:pointer;
          border:1px solid ${on ? colors[id] : 'rgba(255,255,255,0.1)'};
          background:${on ? colors[id]+'22' : 'rgba(255,255,255,0.03)'};
          color:${on ? colors[id] : '#475569'};font-weight:${on?'700':'400'};
          transition:all 0.2s;font-family:inherit;
        ">${icons[id]} ${id}</button>
      `;
    }).join('');
  }

  function _toggleProvider(id) {
    const i = _selectedProviders.indexOf(id);
    if (i >= 0) {
      if (_selectedProviders.length > 1) _selectedProviders.splice(i, 1);
    } else {
      _selectedProviders.push(id);
    }
    _renderPanel();
  }

  function _ensurePanel() {
    if (document.getElementById('parallel-panel')) return;
    const el = document.createElement('div');
    el.id = 'parallel-panel';
    el.style.cssText = `
      display:none;position:fixed;inset:0;z-index:9000;
      background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
      align-items:center;justify-content:center;padding:20px;font-family:inherit;
    `;
    el.onclick = e => { if (e.target === el) closePanel(); };
    el.innerHTML = `
      <div style="width:100%;max-width:500px;background:linear-gradient(160deg,#0d1425,#0a0f1e);
        border:1px solid rgba(220,38,38,0.2);border-radius:20px;overflow:hidden;
        box-shadow:0 30px 80px rgba(0,0,0,0.8);">
        <div style="padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:16px;font-weight:700;color:#f1f5f9">⚡ إعدادات التشغيل المتوازي</div>
          <button onclick="ParallelEngine.closePanel()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px">×</button>
        </div>
        <div style="padding:20px 22px;display:flex;flex-direction:column;gap:16px">

          <!-- تفعيل -->
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="color:#94a3b8;font-size:13px">تفعيل الوضع المتوازي</span>
            <button id="parallel-active-toggle" onclick="ParallelEngine._toggleActive()" style="
              padding:6px 16px;border-radius:999px;font-size:12px;cursor:pointer;
              background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.3);
              color:#fca5a5;font-family:inherit;transition:all 0.2s;
            ">تفعيل</button>
          </div>

          <!-- المزودون -->
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:8px">اختر النماذج التي تعمل بالتوازي:</div>
            <div id="parallel-providers-grid" style="display:flex;flex-wrap:wrap;gap:6px"></div>
          </div>

          <!-- طريقة الدمج -->
          <div>
            <div style="font-size:12px;color:#64748b;margin-bottom:8px">طريقة دمج النتائج:</div>
            <div style="display:flex;gap:6px">
              ${['smart','vote','concat'].map(m => `
                <button onclick="ParallelEngine._setMerge('${m}')" id="merge-btn-${m}" style="
                  flex:1;padding:8px;border-radius:10px;font-size:11px;cursor:pointer;
                  font-family:inherit;transition:all 0.2s;
                  border:1px solid ${_mergeMode===m?'#dc2626':'rgba(255,255,255,0.1)'};
                  background:${_mergeMode===m?'rgba(220,38,38,0.15)':'rgba(255,255,255,0.03)'};
                  color:${_mergeMode===m?'#fca5a5':'#475569'};
                ">${m==='smart'?'🧠 ذكي':m==='vote'?'🗳️ تصويت':'📋 دمج كامل'}</button>
              `).join('')}
            </div>
          </div>

        </div>
      </div>
    `;
    document.body.appendChild(el);
  }

  function _toggleActive() {
    setActive(!_active);
    const btn = document.getElementById('parallel-active-toggle');
    if (btn) {
      btn.textContent = _active ? 'إيقاف' : 'تفعيل';
      btn.style.background = _active ? 'rgba(74,222,128,0.15)' : 'rgba(220,38,38,0.15)';
      btn.style.borderColor = _active ? 'rgba(74,222,128,0.3)' : 'rgba(220,38,38,0.3)';
      btn.style.color = _active ? '#4ade80' : '#fca5a5';
    }
  }

  function _setMerge(mode) {
    _mergeMode = mode;
    document.querySelectorAll('[id^=merge-btn-]').forEach(b => {
      const m = b.id.replace('merge-btn-', '');
      b.style.borderColor = m === mode ? '#dc2626' : 'rgba(255,255,255,0.1)';
      b.style.background = m === mode ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.03)';
      b.style.color = m === mode ? '#fca5a5' : '#475569';
    });
  }

  /* تهيئة */
  document.addEventListener('DOMContentLoaded', () => {
    _active = localStorage.getItem('galaoum_parallel_active') === '1';
    _renderToggle();
  });

  return { runParallel, processParallel, ConsensusEngine, isActive, setActive, openPanel, closePanel, _toggleProvider, _toggleActive, _setMerge };
})();
