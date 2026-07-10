/* ══════════════════════════════════════════════
   agent-loop.js — نظام التفكير والتنفيذ المتكرر
   Galaoum AI Engine v6.0 — by عمار جلعوم

   يربط ThinkingEngine + ToolSystem في حلقة ReAct:
   ① استقبال رسالة  ② تفكير + استدعاء أدوات
   ③ تنفيذ الأدوات  ④ تكرار حتى الرد النهائي
   ══════════════════════════════════════════════ */

window.AgentLoop = (function () {

  let _enabled = false;
  const MAX_ITER = 6;   /* أقصى عدد لدورات ReAct */

  /* ══ تفعيل / تعطيل ══ */
  function isEnabled() { return _enabled; }

  function setEnabled(v) {
    _enabled = !!v;
    _syncBtn();
    if (typeof Toast !== 'undefined') {
      Toast.info(_enabled ? '🛠️ وضع الأدوات مُفعَّل' : '🛠️ وضع الأدوات مُعطَّل', 2000);
    }
  }

  function toggle() { setEnabled(!_enabled); }

  function _syncBtn() {
    const btn = document.getElementById('agent-loop-btn');
    if (!btn) return;
    if (_enabled) {
      btn.innerHTML       = '🛠️ أدوات <span style="font-size:9px;background:rgba(74,222,128,.25);color:#4ade80;padding:1px 5px;border-radius:4px;margin-right:3px">ON</span>';
      btn.style.background      = 'linear-gradient(135deg,rgba(5,150,105,.2),rgba(4,120,87,.12))';
      btn.style.borderColor     = 'rgba(5,150,105,.4)';
      btn.style.color           = '#6ee7b7';
    } else {
      btn.innerHTML       = '🛠️ أدوات';
      btn.style.background      = 'rgba(255,255,255,.05)';
      btn.style.borderColor     = 'rgba(255,255,255,.1)';
      btn.style.color           = '#64748b';
    }
  }

  /* ══════════════════════════════════════════════
     الحلقة الرئيسية — ReAct Loop
     تُستدعى بعد إنشاء رسالة bot جديدة
     ══════════════════════════════════════════════ */
  async function run(userMsg, botId) {
    if (typeof ToolSystem     === 'undefined') throw new Error('ToolSystem غير محمّل');
    if (typeof ThinkingEngine === 'undefined') throw new Error('ThinkingEngine غير محمّل');

    const sysPrompt    = ToolSystem.getSystemPrompt();
    const startTime    = Date.now();
    const allSteps     = [];
    let   ctx          = sysPrompt + '\n\n══ طلب المستخدم ══\n' + userMsg;

    /* ── عرض مؤشر البداية ── */
    _setHtml(botId, _htmlLoading(1));

    for (let iter = 0; iter < MAX_ITER; iter++) {

      /* ── استدعاء AI ── */
      let rawResp;
      try {
        rawResp = await callAPI(ctx, true);
      } catch (e) {
        _setHtml(botId, _htmlError('فشل الاتصال بالذكاء الاصطناعي: ' + e.message, allSteps));
        return;
      }

      /* ── تحليل التفكير والأدوات ── */
      const { thinking, reply: noThink }     = ThinkingEngine.parseThinking(rawResp);
      const { text: replyText, calls: tcArr } = ToolSystem.parseToolCalls(noThink || rawResp);

      /* ── بناء خطوة الدورة ── */
      const step = {
        iter:      iter + 1,
        thinking,
        text:      replyText,
        toolCalls: tcArr.map(c => ({
          name: c.name, args: c.args,
          unknown: c.unknown || false,
          status: 'run', result: null, error: null
        }))
      };
      allSteps.push(step);

      /* ── إذا لا أدوات → رد نهائي ── */
      if (tcArr.length === 0) {
        const elapsed = Date.now() - startTime;
        _setHtml(botId, _htmlFinal(allSteps, replyText || noThink || rawResp, elapsed));
        if (typeof saveChat === 'function') saveChat();
        return;
      }

      /* ── عرض الأدوات "جارٍ تشغيلها" ── */
      _setHtml(botId, _htmlSteps(allSteps, true));

      /* ── تنفيذ الأدوات واحدة تلو الأخرى ── */
      const resultsForCtx = [];

      for (const tc of step.toolCalls) {
        if (tc.unknown) {
          tc.status = 'error';
          tc.error  = `أداة غير معروفة: "${tc.name}"`;
          _setHtml(botId, _htmlSteps(allSteps, true));
          resultsForCtx.push(`"${tc.name}": خطأ — أداة غير معروفة`);
          continue;
        }

        try {
          tc.result = await ToolSystem.execute(tc.name, tc.args);
          tc.status = 'done';
        } catch (e) {
          tc.error  = e.message;
          tc.status = 'error';
        }

        _setHtml(botId, _htmlSteps(allSteps, true));

        /* صياغة النتيجة للـ Context التالي */
        const resStr = tc.status === 'done'
          ? (typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2))
          : ('خطأ: ' + tc.error);
        resultsForCtx.push(`نتيجة "${tc.name}":\n${resStr.substring(0, 1200)}`);
      }

      /* ── بناء Context الدورة التالية ── */
      ctx = _buildNextCtx(userMsg, allSteps, resultsForCtx, sysPrompt);
    }

    /* ── وصل الحد الأقصى ── */
    const last = allSteps[allSteps.length - 1];
    _setHtml(botId, _htmlFinal(allSteps,
      (last && last.text) || 'وصلت لأقصى حد من الدورات (' + MAX_ITER + ').',
      Date.now() - startTime));
    if (typeof saveChat === 'function') saveChat();
  }

  /* ══ بناء Context الدورة التالية ══ */
  function _buildNextCtx(userMsg, steps, results, sysPrompt) {
    let ctx = sysPrompt + '\n\n══ طلب المستخدم ══\n' + userMsg
            + '\n\n══ سياق الدورات السابقة ══\n';

    steps.forEach(s => {
      if (s.thinking) ctx += `[دورة ${s.iter} — تفكير]\n${s.thinking}\n\n`;
      if (s.text)     ctx += `[دورة ${s.iter} — ردّ]\n${s.text}\n\n`;
    });

    if (results.length) {
      ctx += '══ نتائج الأدوات ══\n' + results.join('\n\n---\n') + '\n\n';
    }

    ctx += '══ التعليمات ══\n'
         + 'بناءً على نتائج الأدوات أعلاه، أكمل إجابتك.\n'
         + 'استخدم أدوات إضافية إن لزم، أو اكتب ردّك النهائي الكامل بدون <tool_call>.';
    return ctx;
  }

  /* ══════════════════════════════════════════════
     دوال بناء HTML
     ══════════════════════════════════════════════ */

  /* ── Loading ── */
  function _htmlLoading(iter) {
    return `<div class="al-loading">
      <span class="al-dot" style="animation-delay:0s"></span>
      <span class="al-dot" style="animation-delay:.2s"></span>
      <span class="al-dot" style="animation-delay:.4s"></span>
      <span class="al-loading-txt">دورة ${iter} — جارٍ التفكير...</span>
    </div>`;
  }

  /* ── خطوات جارية ── */
  function _htmlSteps(steps, ongoing) {
    let h = '<div class="al-wrap">';
    if (ongoing) {
      h += `<div class="al-running-bar">
        <span class="spin" style="display:inline-block">⟳</span>
        <span>جارٍ تشغيل الأدوات...</span>
      </div>`;
    }
    steps.forEach(s => { h += _htmlStep(s); });
    h += '</div>';
    return h;
  }

  /* ── رد نهائي ── */
  function _htmlFinal(steps, text, elapsedMs) {
    const { thinking, reply } = ThinkingEngine.parseThinking(text);
    const secs      = (elapsedMs / 1000).toFixed(1);
    const toolCount = steps.reduce((n, s) => n + s.toolCalls.length, 0);
    const iterCount = steps.length;

    let h = '<div class="al-wrap">';

    /* شارة الإنجاز */
    if (iterCount > 0 || elapsedMs > 500) {
      const badges = [];
      if (secs > 0)        badges.push(`⏱ ${secs}ث`);
      if (iterCount > 1)   badges.push(`🔄 ${iterCount} دورة`);
      if (toolCount > 0)   badges.push(`🛠️ ${toolCount} أداة`);
      h += `<div class="al-done-badge">${badges.join(' · ')}</div>`;
    }

    /* الخطوات السابقة */
    steps.forEach(s => { h += _htmlStep(s); });

    /* كتلة تفكير الرد الأخير (إن وُجدت) */
    if (thinking) {
      const id = 'alf' + Date.now();
      h += `<div class="te-block al-final-think">
        <div class="te-header" onclick="ThinkingEngine.toggle('${id}','${id}a')">
          <span class="te-icon">💭</span>
          <span class="te-label">تفكير الرد النهائي</span>
          <span class="te-time">${secs}ث</span>
          <span class="te-arrow" id="${id}a">▼</span>
        </div>
        <div class="te-body" id="${id}">${_esc(thinking)}</div>
      </div>`;
    }

    /* الرد النهائي */
    const finalText = reply || text || '';
    h += `<div class="al-final-answer">${_md(finalText)}</div>`;
    h += '</div>';
    return h;
  }

  /* ── خطوة واحدة ── */
  function _htmlStep(s) {
    const hasContent = s.thinking || s.text || s.toolCalls.length > 0;
    if (!hasContent) return '';

    let h = `<div class="al-step">`;

    /* كتلة التفكير */
    if (s.thinking) {
      const id = `alst${s.iter}_${Date.now()}`;
      h += `<div class="te-block al-mini-think">
        <div class="te-header" onclick="ThinkingEngine.toggle('${id}','${id}a')">
          <span class="te-icon" style="font-size:11px">💭</span>
          <span class="te-label" style="font-size:11px">تفكير الدورة ${s.iter}</span>
          <span class="te-arrow" id="${id}a">▼</span>
        </div>
        <div class="te-body" id="${id}">${_esc(s.thinking)}</div>
      </div>`;
    }

    /* نص الخطوة (قبل أوامر الأدوات) */
    if (s.text && s.text.trim()) {
      h += `<div class="al-step-note">${_md(s.text)}</div>`;
    }

    /* بطاقات الأدوات */
    s.toolCalls.forEach(tc => { h += _htmlToolCard(tc); });

    h += '</div>';
    return h;
  }

  /* ── بطاقة أداة ── */
  function _htmlToolCard(tc) {
    const info     = ToolSystem.getToolInfo(tc.name);
    const emoji    = info ? info.emoji : '🔧';
    const label    = info ? info.label : tc.name;
    const stClass  = { run:'al-st-run', done:'al-st-done', error:'al-st-err' }[tc.status] || '';
    const stText   = {
      run:   '<span class="spin" style="display:inline-block">⟳</span> جارٍ',
      done:  '✅ تمّ',
      error: '❌ خطأ'
    }[tc.status] || tc.status;

    const argsStr = JSON.stringify(tc.args, null, 2);
    let resultHtml = '';

    if (tc.status !== 'run') {
      if (tc.status === 'done' && tc.result !== null && tc.result !== undefined) {
        resultHtml = _renderToolResult(tc);
      } else if (tc.error) {
        resultHtml = `<div class="al-tool-err">${_esc(tc.error)}</div>`;
      }
    }

    return `<div class="al-tool-card">
  <div class="al-tool-hdr">
    <span class="al-tool-ico">${emoji}</span>
    <span class="al-tool-nm">${_esc(label)}</span>
    <span class="al-tool-st ${stClass}">${stText}</span>
  </div>
  <div class="al-tool-args">${_esc(argsStr)}</div>
  ${resultHtml}
</div>`;
  }

  /* ── عرض نتيجة أداة بحسب نوعها ── */
  function _renderToolResult(tc) {
    const r = tc.result;

    /* صورة مولّدة */
    if (tc.name === 'generate_image' && r && r.url) {
      return `<div class="al-tool-img-wrap">
        <img src="${_esc(r.url)}" class="al-tool-img"
          onerror="this.parentElement.innerHTML='<p class=al-tool-err>⚠️ فشل تحميل الصورة</p>'">
        <a href="${_esc(r.url)}" download="galaoum_${Date.now()}.jpg" target="_blank" class="al-tool-dl">⬇️ تحميل</a>
      </div>`;
    }

    /* تشغيل كود */
    if (tc.name === 'run_code' && r) {
      const ok  = r.ok;
      const out = (r.output || r.stderr || 'لا مخرجات').substring(0, 800);
      return `<div class="al-code-res ${ok ? 'ok' : 'fail'}">
        <div class="al-code-badge">${ok ? '✅' : '❌'} ${_esc(r.language || '')} ${_esc(r.version || '')}</div>
        <pre class="al-code-pre">${_esc(out)}</pre>
      </div>`;
    }

    /* حساب */
    if (tc.name === 'calculate' && r && r.result !== undefined) {
      return `<div class="al-calc-res">
        <span class="al-calc-eq">${_esc(r.expr)}</span>
        <span class="al-calc-eq" style="margin:0 6px;color:#64748b">=</span>
        <strong class="al-calc-val">${_esc(String(r.result))}</strong>
      </div>`;
    }

    /* تاريخ ووقت */
    if (tc.name === 'datetime' && r) {
      return `<div class="al-tool-out al-datetime">
        📅 <strong>${_esc(r.dayAr || '')}</strong>، 
        ${_esc(r.locale_ar || r.dateISO || '')}
      </div>`;
    }

    /* استعلام قاعدة بيانات */
    if (tc.name === 'db_query' && r && r.rows) {
      if (!r.rows.length) return `<div class="al-tool-out">لا توجد صفوف (${r.ms}ms)</div>`;
      const cols = Object.keys(r.rows[0]);
      const rows = r.rows.slice(0, 10);
      return `<div class="al-db-wrap">
        <div class="al-db-meta">${r.rowCount} صف · ${r.ms}ms</div>
        <div style="overflow-x:auto">
          <table class="al-db-tbl">
            <thead><tr>${cols.map(c => `<th>${_esc(c)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row =>
              '<tr>' + cols.map(c => `<td>${_esc(String(row[c] ?? ''))}</td>`).join('') + '</tr>'
            ).join('')}</tbody>
          </table>
        </div>
      </div>`;
    }

    /* نتيجة عامة */
    let resStr = typeof r === 'string' ? r : JSON.stringify(r, null, 2);
    if (resStr.length > 1000) resStr = resStr.substring(0, 1000) + '\n... [مختصر]';
    return `<div class="al-tool-out">${_esc(resStr)}</div>`;
  }

  /* ── خطأ عام ── */
  function _htmlError(msg, steps) {
    let h = '<div class="al-wrap">';
    if (steps && steps.length) steps.forEach(s => { h += _htmlStep(s); });
    h += `<div class="al-error-box">❌ ${_esc(msg)}</div>`;
    h += '</div>';
    return h;
  }

  /* ══════════════════════════════════════════════
     تحديث HTML الرسالة مباشرةً (بدون typewriter)
     ══════════════════════════════════════════════ */
  function _setHtml(id, html) {
    const el = document.getElementById(id);
    if (!el) return;
    const c = el.querySelector('.msg-bot');
    if (c) c.innerHTML = html;
    const cb = document.getElementById('chat-box');
    if (cb) cb.scrollTop = cb.scrollHeight;
  }

  /* ══ مساعدات ══ */
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function _md(s) {
    return typeof renderMarkdown === 'function'
      ? renderMarkdown(String(s || ''))
      : _esc(s).replace(/\n/g,'<br>');
  }

  /* ══════════════════════════════════════════════
     Hook نموذج الإرسال — Capture قبل app.js
     يعترض الرسائل العادية عند تفعيل وضع الأدوات
     ══════════════════════════════════════════════ */
  function _hookSubmit() {
    const form = document.getElementById('chat-form');
    if (!form || form._agentHooked) return;
    form._agentHooked = true;

    form.addEventListener('submit', async (e) => {
      /* تجاهل إذا: وضع الأدوات معطّل، slash command، ملفات مرفوعة، تحميل جارٍ */
      if (!_enabled)                                              return;
      if (window.isLoading)                                       return;
      if (typeof selectedFiles !== 'undefined' && selectedFiles.length > 0) return;

      const inp  = document.getElementById('user-input');
      const text = (inp ? inp.value : '').trim();
      if (!text || text.startsWith('/'))                          return;

      /* اعترض الحدث */
      e.preventDefault();
      e.stopImmediatePropagation();

      window.isLoading = true;
      const sendBtn = document.getElementById('send-btn');
      if (sendBtn) sendBtn.innerHTML = '<span class="spin" style="display:inline-block">⟳</span>';

      if (inp) { inp.value = ''; inp.style.height = 'auto'; }
      if (typeof autoNameConversation === 'function') autoNameConversation(text);

      /* إضافة رسائل المستخدم والـ bot */
      if (typeof addMessage === 'function') addMessage('user', text.replace(/\n/g, '<br>'));
      const botId = typeof addMessage === 'function'
        ? addMessage('bot', '<span class="spin">⟳</span>')
        : null;

      try {
        await run(text, botId);
      } catch (err) {
        if (botId) _setHtml(botId,
          `<div class="al-error-box">❌ خطأ في نظام الأدوات: ${_esc(err.message)}</div>`);
      } finally {
        window.isLoading = false;
        if (sendBtn) sendBtn.innerHTML = '↑';
        if (typeof saveChat === 'function') saveChat();
      }

    }, true /* capture: يُنفَّذ قبل معالج app.js */);
  }

  /* ══ لوحة الأدوات — Panel ══ */
  function openPanel() {
    /* بناء لوحة ديناميكية إن لم تكن موجودة */
    let panel = document.getElementById('al-tools-panel');
    if (!panel) { _buildPanel(); panel = document.getElementById('al-tools-panel'); }
    if (panel) panel.style.display = 'flex';
  }

  function closePanel() {
    const p = document.getElementById('al-tools-panel');
    if (p) p.style.display = 'none';
  }

  function _buildPanel() {
    const tools = typeof ToolSystem !== 'undefined' ? ToolSystem.getAll() : {};
    const toolRows = Object.entries(tools).map(([name, t]) =>
      `<div class="al-panel-tool">
        <span class="al-panel-emoji">${t.emoji}</span>
        <div>
          <div class="al-panel-name">${_esc(t.label)}</div>
          <div class="al-panel-desc">${_esc(t.desc)}</div>
        </div>
        <code class="al-panel-code">${_esc(name)}</code>
      </div>`
    ).join('');

    const el = document.createElement('div');
    el.id = 'al-tools-panel';
    el.className = 'al-panel-overlay';
    el.innerHTML = `
      <div class="al-panel-box" onclick="event.stopPropagation()">
        <div class="al-panel-hdr">
          <div>
            <div class="al-panel-title">🛠️ نظام الأدوات المتكاملة</div>
            <div class="al-panel-subtitle">Galaoum AI Engine v6.0 — ${Object.keys(tools).length} أداة متاحة</div>
          </div>
          <button class="al-panel-close" onclick="AgentLoop.closePanel()">✕</button>
        </div>

        <div class="al-panel-section">
          <div class="al-panel-sec-title">⚙️ الإعدادات</div>
          <div class="al-panel-row">
            <span>وضع الأدوات</span>
            <div class="al-toggle" id="al-toggle-row" onclick="AgentLoop.toggle()">
              <div class="al-toggle-dot" id="al-toggle-dot"></div>
            </div>
          </div>
          <div class="al-panel-row">
            <span>عرض التفكير تلقائياً</span>
            <div class="al-toggle" id="al-think-toggle"
              onclick="ThinkingEngine.setAutoExpand(!ThinkingEngine._autoExpand);this.classList.toggle('on')">
              <div class="al-toggle-dot"></div>
            </div>
          </div>
          <div class="al-panel-row">
            <span>أقصى عدد دورات</span>
            <span style="color:#a78bfa;font-weight:700">${MAX_ITER}</span>
          </div>
        </div>

        <div class="al-panel-section">
          <div class="al-panel-sec-title">🔧 الأدوات المتاحة</div>
          <div class="al-tools-list">${toolRows}</div>
        </div>

        <div class="al-panel-section">
          <div class="al-panel-sec-title">💡 كيفية الاستخدام</div>
          <div class="al-panel-hint">
            فعّل وضع الأدوات ثم اكتب طلبك بشكل طبيعي.<br>
            سيقرر الذكاء الاصطناعي متى يستخدم الأدوات ومتى يجيب مباشرةً.<br><br>
            أمثلة:<br>
            <code>احسب مساحة دائرة نصف قطرها 7</code><br>
            <code>ابحث عن أحدث إصدار Python</code><br>
            <code>اكتب كود Python واختبره فوراً</code><br>
            <code>ما هو الوقت الحالي في طوكيو؟</code>
          </div>
        </div>
      </div>`;

    el.addEventListener('click', () => closePanel());
    document.body.appendChild(el);

    /* مزامنة حالة الـ toggle */
    _syncPanelToggle();
  }

  function _syncPanelToggle() {
    const row = document.getElementById('al-toggle-row');
    const dot = document.getElementById('al-toggle-dot');
    if (row) row.classList.toggle('on', _enabled);
    if (dot && _enabled) dot.style.transform = 'translateX(20px)';
  }

  /* ══ تهيئة ══ */
  function init() {
    _hookSubmit();
    _syncBtn();
    if (typeof Logger !== 'undefined') {
      Logger.info('AgentLoop', `🤖 نظام الأدوات جاهز — ${typeof ToolSystem !== 'undefined' ? ToolSystem.listNames().length : 0} أداة، ${MAX_ITER} دورة`);
    }
  }

  return { init, isEnabled, setEnabled, toggle, run, openPanel, closePanel };
})();
