/* ══════════════════════════════════════════════
   task-planner.js — تقسيم المهام وتوزيعها
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const TaskPlanner = (() => {

  /* ── أنواع المهام الفرعية والمزود الأمثل لكل منها ── */
  const TASK_PROFILES = {
    code:      { provider: 'mistral',    icon: '💻', label: 'برمجة' },
    analysis:  { provider: 'gemini',     icon: '🔍', label: 'تحليل' },
    creative:  { provider: 'openrouter', icon: '✍️', label: 'إبداع' },
    math:      { provider: 'cerebras',   icon: '🔢', label: 'رياضيات' },
    summary:   { provider: 'cohere',     icon: '📋', label: 'تلخيص' },
    search:    { provider: 'gemini',     icon: '🌐', label: 'بحث' },
    translate: { provider: 'mistral',    icon: '🌍', label: 'ترجمة' },
    general:   { provider: 'openrouter', icon: '💬', label: 'عام' }
  };

  /* ── كشف نوع الطلب بقواعد بسيطة ── */
  function _detectType(text) {
    const t = text.toLowerCase();
    if (/كود|برمج|function|class|def |import |react|html|css|js|python|سكريبت/.test(t)) return 'code';
    if (/احسب|ناتج|معادلة|رياضي|ضرب|قسمة|sqrt|log/.test(t)) return 'math';
    if (/ترجم|translate|بالإنجليزية|بالعربية/.test(t)) return 'translate';
    if (/لخص|اختصر|summarize|ملخص/.test(t)) return 'summary';
    if (/ابحث|اعثر|search|ما هو|من هو|متى/.test(t)) return 'search';
    if (/حلل|قيّم|قارن|مقارنة|analyse/.test(t)) return 'analysis';
    if (/اكتب|قصة|شعر|مقال|creative|ابتكر/.test(t)) return 'creative';
    return 'general';
  }

  /* ── تحليل الطلب وتقسيمه إلى مهام فرعية باستخدام AI ── */
  async function planWithAI(userPrompt) {
    const planPrompt = `أنت Task Planner متخصص. حلل الطلب التالي وقسّمه إلى مهام فرعية (2-4 مهام كحد أقصى).
أعد JSON فقط بهذا الشكل بدون أي نص آخر:
{
  "tasks": [
    {"id":1,"type":"code|analysis|creative|math|summary|search|translate|general","title":"عنوان المهمة","prompt":"الطلب المحدد للمهمة"}
  ],
  "strategy":"parallel|sequential",
  "merge":"smart|concat|vote"
}

الطلب: "${userPrompt}"`;

    try {
      // استخدام أسرع مزود متاح للتخطيط
      let planJson = '';
      const providers = ['gemini','mistral','openrouter'];
      for (const p of providers) {
        try {
          const fn = p === 'gemini' ? () => callGeminiAPI(planPrompt, 'أنت مخطط مهام. أعد JSON فقط.', [])
                   : p === 'mistral' ? () => callMistralAPI(planPrompt, 'أنت مخطط مهام. أعد JSON فقط.', [])
                   : () => callCohereAPI(planPrompt, []);
          planJson = await fn();
          if (planJson) break;
        } catch {}
      }
      // استخراج JSON
      const match = planJson.match(/\{[\s\S]*\}/);
      if (match) {
        const plan = JSON.parse(match[0]);
        if (plan.tasks && Array.isArray(plan.tasks)) return plan;
      }
    } catch (e) {
      console.warn('[TaskPlanner] AI plan failed, using rules:', e.message);
    }
    // Fallback: تقسيم بالقواعد
    return _rulePlan(userPrompt);
  }

  /* ── تقسيم بالقواعد (Fallback) ── */
  function _rulePlan(prompt) {
    const type = _detectType(prompt);
    const tasks = [{ id: 1, type, title: TASK_PROFILES[type].label, prompt }];
    // إضافة مهمة تحليل إضافية للطلبات المعقدة
    if (prompt.length > 100 && type !== 'general') {
      tasks.push({ id: 2, type: 'analysis', title: 'تحليل وتقييم', prompt: 'حلل وقيّم: ' + prompt.substring(0, 200) });
    }
    return { tasks, strategy: tasks.length > 1 ? 'parallel' : 'sequential', merge: 'smart' };
  }

  /* ── تنفيذ الخطة ── */
  async function execute(plan, history = []) {
    _showPlanUI(plan);
    const systemPrompt = 'أنت Galaoum AI Engine v5.0 — مساعد ذكاء اصطناعي محترف.';
    let results = [];

    if (plan.strategy === 'parallel') {
      results = await Promise.all(plan.tasks.map(task => _runTask(task, systemPrompt, history)));
    } else {
      for (const task of plan.tasks) {
        const r = await _runTask(task, systemPrompt, history);
        results.push(r);
      }
    }

    _updatePlanUI(results);

    // دمج النتائج
    const merged = _mergeResults(results, plan.merge, plan);
    return merged;
  }

  /* ── تنفيذ مهمة واحدة ── */
  async function _runTask(task, systemPrompt, history) {
    const profile = TASK_PROFILES[task.type] || TASK_PROFILES.general;
    _updateTaskStatus(task.id, 'running');
    try {
      let text = '';
      const p = profile.provider;
      if (p === 'gemini')      text = await callGeminiAPI(task.prompt, systemPrompt, history);
      else if (p === 'mistral') text = await callMistralAPI(task.prompt, systemPrompt, history);
      else if (p === 'cohere')  text = await callCohereAPI(task.prompt, history);
      else if (p === 'cerebras') text = await callCerebrasAPI(task.prompt, systemPrompt, history);
      else text = await callGeminiAPI(task.prompt, systemPrompt, history);
      _updateTaskStatus(task.id, 'done');
      return { task, provider: p, text: text || '', ok: true };
    } catch (e) {
      _updateTaskStatus(task.id, 'error');
      return { task, provider: profile.provider, text: '', ok: false, error: e.message };
    }
  }

  /* ── دمج نتائج المهام ── */
  function _mergeResults(results, mode, plan) {
    const valid = results.filter(r => r.ok && r.text);
    if (!valid.length) return '⚠️ جميع المهام فشلت.';

    if (valid.length === 1 || mode === 'smart') {
      if (plan.tasks.length === 1) return valid[0].text;
      // دمج ذكي: اجمع كل المهام تحت عناوين واضحة
      return valid.map(r => {
        const profile = TASK_PROFILES[r.task.type] || TASK_PROFILES.general;
        return `## ${profile.icon} ${r.task.title}\n\n${r.text}`;
      }).join('\n\n---\n\n');
    }

    if (mode === 'concat') {
      return valid.map(r => {
        const profile = TASK_PROFILES[r.task.type] || TASK_PROFILES.general;
        return `### ${profile.icon} ${r.task.title}\n${r.text}`;
      }).join('\n\n');
    }

    return valid[0].text;
  }

  /* ══ واجهة مرئية للخطة ══ */
  function _showPlanUI(plan) {
    let el = document.getElementById('task-plan-ui');
    if (!el) {
      el = document.createElement('div');
      el.id = 'task-plan-ui';
      el.style.cssText = `
        position:fixed;top:80px;right:20px;width:260px;
        background:rgba(10,15,30,0.97);border:1px solid rgba(220,38,38,0.2);
        border-radius:16px;z-index:8500;padding:14px 16px;
        font-size:12px;box-shadow:0 12px 40px rgba(0,0,0,0.6);
        backdrop-filter:blur(10px);font-family:inherit;
      `;
      document.body.appendChild(el);
    }
    el.style.display = 'block';
    el.innerHTML = `
      <div style="font-weight:700;color:#f1f5f9;margin-bottom:10px;display:flex;justify-content:space-between">
        📋 خطة المهام
        <button onclick="document.getElementById('task-plan-ui').style.display='none'"
          style="background:none;border:none;color:#64748b;cursor:pointer">×</button>
      </div>
      <div style="font-size:10px;color:#64748b;margin-bottom:10px">
        ${plan.strategy === 'parallel' ? '⚡ تنفيذ متوازي' : '🔄 تنفيذ تسلسلي'} — دمج: ${plan.merge}
      </div>
      ${plan.tasks.map(t => {
        const profile = TASK_PROFILES[t.type] || TASK_PROFILES.general;
        return `
          <div id="task-ui-${t.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.03);margin-bottom:6px;border:1px solid rgba(255,255,255,0.06)">
            <span style="font-size:14px">${profile.icon}</span>
            <div style="flex:1">
              <div style="color:#94a3b8;font-weight:600">${t.title}</div>
              <div style="color:#475569;font-size:10px">${profile.provider}</div>
            </div>
            <div id="task-status-${t.id}" style="font-size:14px">⏳</div>
          </div>
        `;
      }).join('')}
    `;
  }

  function _updateTaskStatus(id, status) {
    const el = document.getElementById('task-status-' + id);
    if (!el) return;
    el.textContent = status === 'running' ? '🔄' : status === 'done' ? '✅' : '❌';
    const card = document.getElementById('task-ui-' + id);
    if (card) {
      card.style.borderColor = status === 'running' ? 'rgba(251,191,36,0.3)'
                             : status === 'done'    ? 'rgba(74,222,128,0.2)'
                             : 'rgba(239,68,68,0.2)';
    }
  }

  function _updatePlanUI(results) {
    setTimeout(() => {
      const el = document.getElementById('task-plan-ui');
      if (el) setTimeout(() => { el.style.display = 'none'; }, 4000);
    }, 500);
  }

  /* ── الواجهة العامة ── */
  let _enabled = false;
  function isEnabled() { return _enabled; }
  function setEnabled(v) {
    _enabled = v;
    localStorage.setItem('galaoum_taskplanner', v ? '1' : '0');
    _renderToggle();
  }

  function _renderToggle() {
    const btn = document.getElementById('taskplanner-toggle-btn');
    if (!btn) return;
    btn.style.color = _enabled ? '#fbbf24' : '#64748b';
    btn.style.borderColor = _enabled ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)';
    btn.style.background = _enabled ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)';
    btn.textContent = _enabled ? '📋 مخطط ON' : '📋 مخطط OFF';
  }

  async function process(prompt, history = []) {
    const plan = await planWithAI(prompt);
    return await execute(plan, history);
  }

  document.addEventListener('DOMContentLoaded', () => {
    _enabled = localStorage.getItem('galaoum_taskplanner') === '1';
    _renderToggle();
  });

  return { planWithAI, execute, process, isEnabled, setEnabled };
})();
