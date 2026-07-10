/* ══════════════════════════════════════════════════════════════
   agent-mode.js — وضع الوكيل الذكي (Multi-Step Agent)
   Galaoum AI Engine v5.0 — by عمار جلعوم

   يكسر المهام الكبيرة لخطوات ثم ينفّذها تلقائياً
   ══════════════════════════════════════════════════════════════ */

window.AgentMode = (function () {

  let _running = false;
  let _steps   = [];
  let _log     = [];

  const TOOL_PATTERNS = {
    search:  /ابحث عن|search for|find info about|ابحث في الويب/i,
    code:    /اكتب كود|write code|انشئ سكريبت|create script|برمج/i,
    analyze: /حلّل|analyze|افحص|review|شرح/i,
    create:  /انشئ|create|اعمل|make|build|generate/i,
  };

  /* ═══════ فتح / إغلاق اللوحة ═══════ */
  function openPanel() {
    const p = document.getElementById('agent-mode-panel');
    if (p) p.style.display = 'flex';
  }
  function closePanel() {
    const p = document.getElementById('agent-mode-panel');
    if (p) p.style.display = 'none';
  }

  /* ═══════ التشغيل الرئيسي ═══════ */
  async function run() {
    if (_running) return;
    const goal = document.getElementById('agent-goal')?.value?.trim();
    if (!goal) return;
    _running = true;
    _log = [];
    _steps = [];

    _setStatus('🤖 جارٍ تحليل المهمة وتقسيمها...', 5);
    _appendLog('🎯 الهدف: ' + goal);

    try {
      /* الخطوة ١: تقسيم المهمة لخطوات */
      const planPrompt = `أنت مساعد ذكاء اصطناعي تعمل كوكيل ذكي.
المهمة: ${goal}

قسّم هذه المهمة لـ 3-6 خطوات تنفيذية واضحة.
لكل خطوة حدد:
- رقم الخطوة
- وصف الخطوة بجملة واحدة
- نوعها: [search | code | analyze | create | write]

اكتب فقط القائمة بهذا الشكل:
1. [نوع] وصف الخطوة
2. [نوع] وصف الخطوة
...`;

      const plan = await callAPI(planPrompt, false);
      _steps = _parsePlan(plan);
      _appendLog(`📋 خطة التنفيذ (${_steps.length} خطوات):\n` + _steps.map((s,i) => `${i+1}. ${s.label}`).join('\n'));
      _renderSteps();

      /* الخطوة ٢: تنفيذ كل خطوة */
      const results = [];
      for (let i = 0; i < _steps.length; i++) {
        const step = _steps[i];
        _setStatus(`⚙️ تنفيذ الخطوة ${i+1}/${_steps.length}: ${step.label}`, Math.round(15 + (i / _steps.length) * 75));
        _markStep(i, 'running');
        _appendLog(`\n▶ الخطوة ${i+1}: ${step.label}`);

        try {
          const result = await _executeStep(step, goal, results);
          results.push({ step: step.label, result });
          _markStep(i, 'done');
          _appendLog(`✅ ${result.substring(0, 200)}`);
        } catch (e) {
          _markStep(i, 'error');
          _appendLog(`❌ فشلت: ${e.message}`);
          results.push({ step: step.label, result: 'فشل: ' + e.message });
        }
      }

      /* الخطوة ٣: تجميع النتائج */
      _setStatus('🔄 جارٍ تجميع النتائج...', 92);
      const summary = await _summarize(goal, results);
      _setStatus('✅ اكتملت المهمة!', 100);
      _appendLog('\n═══ النتيجة النهائية ═══\n' + summary);

      const out = document.getElementById('agent-output');
      if (out) out.innerHTML = `<div class="am-final-result">${summary.replace(/\n/g,'<br>')}</div>`;

    } catch (e) {
      _appendLog('❌ خطأ: ' + e.message);
      _setStatus('❌ حدث خطأ', 0);
    }
    _running = false;
  }

  /* ═══════ تنفيذ خطوة واحدة ═══════ */
  async function _executeStep(step, goal, prevResults) {
    const context = prevResults.length
      ? 'النتائج السابقة:\n' + prevResults.map(r => `- ${r.step}: ${r.result.substring(0,200)}`).join('\n') + '\n\n'
      : '';

    if (step.type === 'search' && typeof WebSearch !== 'undefined') {
      const sr = await WebSearch.search(step.label);
      return WebSearch.formatForAI(sr).substring(0, 1000);
    }

    const prompt = `${context}المهمة الكبيرة: ${goal}
الخطوة الحالية: ${step.label}
نفّذ هذه الخطوة فقط وأعط نتيجتها.`;
    return await callAPI(prompt, false);
  }

  /* ═══════ تلخيص النتائج ═══════ */
  async function _summarize(goal, results) {
    const prompt = `لخّص نتائج تنفيذ هذه المهمة:
الهدف: ${goal}

النتائج:
${results.map((r, i) => `${i+1}. ${r.step}:\n${r.result.substring(0, 400)}`).join('\n\n')}

اكتب تقريراً نهائياً منظماً بالعربية يلخّص الإنجاز الكامل.`;
    return await callAPI(prompt, false);
  }

  /* ═══════ تحليل الخطة ═══════ */
  function _parsePlan(text) {
    return text.split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').trim())
      .filter(l => l.length > 5)
      .map(l => {
        const typeMatch = l.match(/\[(search|code|analyze|create|write)\]/i);
        const type = typeMatch ? typeMatch[1].toLowerCase() : 'create';
        const label = l.replace(/\[.*?\]\s*/g, '').trim();
        return { type, label };
      })
      .slice(0, 6);
  }

  /* ═══════ واجهة الخطوات ═══════ */
  function _renderSteps() {
    const el = document.getElementById('agent-steps');
    if (!el) return;
    const icons = { search:'🔍', code:'💻', analyze:'📊', create:'✨', write:'✍️' };
    el.innerHTML = _steps.map((s, i) => `
      <div class="am-step" id="am-step-${i}">
        <div class="am-step-icon">${icons[s.type]||'⚙️'}</div>
        <div class="am-step-label">${s.label}</div>
        <div class="am-step-status" id="am-ss-${i}">⏳</div>
      </div>`).join('');
    el.style.display = 'flex';
  }

  function _markStep(i, state) {
    const el  = document.getElementById(`am-step-${i}`);
    const ss  = document.getElementById(`am-ss-${i}`);
    if (!el || !ss) return;
    el.className = `am-step am-step-${state}`;
    ss.textContent = { running:'▶', done:'✅', error:'❌' }[state] || '⏳';
  }

  function _appendLog(msg) {
    _log.push(msg);
    const el = document.getElementById('agent-log');
    if (el) { el.textContent = _log.join('\n'); el.scrollTop = el.scrollHeight; }
  }

  function _setStatus(msg, pct) {
    const el = document.getElementById('agent-status');
    const pb = document.getElementById('agent-pb');
    if (el) el.textContent = msg;
    if (pb) { pb.style.width = pct + '%'; pb.style.opacity = pct > 0 ? '1' : '0'; }
  }

  function stopRun() {
    _running = false;
    _setStatus('⏹ تم الإيقاف', 0);
  }

  return { openPanel, closePanel, run, stopRun };
})();
