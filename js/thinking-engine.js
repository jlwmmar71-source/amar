/* ══════════════════════════════════════════════
   thinking-engine.js — عرض تفكير الذكاء الاصطناعي
   Galaoum AI Engine v6.0 — by عمار جلعوم
   يحلّل كتل <think> ويعرضها بواجهة قابلة للطيّ
   ══════════════════════════════════════════════ */

window.ThinkingEngine = (function () {

  let _enabled    = true;   /* عرض كتل التفكير */
  let _autoExpand = false;  /* فتح الكتلة تلقائياً */

  /* ── تفعيل / تعطيل ── */
  function setEnabled(v)    { _enabled = !!v; }
  function isEnabled()      { return _enabled; }
  function setAutoExpand(v) { _autoExpand = !!v; }

  /* ══════════════════════════════════════════════
     تحليل كتل التفكير من نص الرد
     يدعم: <think>, <thinking>, [THINKING]...[/THINKING]
     ══════════════════════════════════════════════ */
  function parseThinking(text) {
    if (!text) return { thinking: null, reply: text };

    /* نمط 1: <think>...</think> — deepseek-r1, o1 */
    let m = text.match(/^([\s\S]*?)<think>([\s\S]*?)<\/think>([\s\S]*)$/i);
    if (m) return { thinking: m[2].trim(), reply: (m[1] + m[3]).trim() };

    /* نمط 2: <thinking>...</thinking> — claude extended */
    m = text.match(/^([\s\S]*?)<thinking>([\s\S]*?)<\/thinking>([\s\S]*)$/i);
    if (m) return { thinking: m[2].trim(), reply: (m[1] + m[3]).trim() };

    /* نمط 3: [THINKING]...[/THINKING] */
    m = text.match(/^\[THINKING\]([\s\S]*?)\[\/THINKING\]([\s\S]*)$/i);
    if (m) return { thinking: m[1].trim(), reply: m[2].trim() };

    /* نمط 4: **التفكير:**\n...\n**الرد:** */
    m = text.match(/\*\*(?:التفكير|Thinking):\*\*\s*([\s\S]+?)\*\*(?:الرد|Answer|Response):\*\*([\s\S]*)/i);
    if (m) return { thinking: m[1].trim(), reply: m[2].trim() };

    return { thinking: null, reply: text };
  }

  /* ══════════════════════════════════════════════
     بناء HTML لكتلة التفكير (قابلة للطيّ)
     ══════════════════════════════════════════════ */
  function buildBlock(thinkText, elapsedMs) {
    const id   = 'te' + Date.now() + Math.random().toString(36).slice(2, 5);
    const secs = (elapsedMs >= 0) ? (elapsedMs / 1000).toFixed(1) + 'ث' : '';
    const open = _autoExpand ? ' te-open' : '';
    const openStyle = _autoExpand ? ' style="transform:rotate(180deg)"' : '';

    return `<div class="te-block">
  <div class="te-header" onclick="ThinkingEngine.toggle('${id}','${id}a')">
    <span class="te-icon">💭</span>
    <span class="te-label">تفكير الذكاء الاصطناعي</span>
    ${secs ? `<span class="te-time">${secs}</span>` : ''}
    <span class="te-arrow" id="${id}a"${openStyle}>▼</span>
  </div>
  <div class="te-body${open}" id="${id}">${_esc(thinkText)}</div>
</div>`;
  }

  /* ── toggle فتح/إغلاق — يُستدعى من onclick ── */
  function toggle(bodyId, arrowId) {
    const body  = document.getElementById(bodyId);
    const arrow = document.getElementById(arrowId);
    if (!body) return;
    const isOpen = body.classList.toggle('te-open');
    if (arrow) arrow.style.transform = isOpen ? 'rotate(180deg)' : '';
  }

  /* ══════════════════════════════════════════════
     مؤشر "جارٍ التفكير..." أثناء انتظار الرد
     يُضاف فوق محتوى الرسالة ثم يُزال عند الانتهاء
     ══════════════════════════════════════════════ */
  function attachProgress(msgEl) {
    if (!_enabled || !msgEl) return null;
    const content = msgEl.querySelector('.msg-bot');
    if (!content) return null;

    const id  = 'tep' + Date.now();
    const div = document.createElement('div');
    div.className = 'te-block te-progress';
    div.id = id;
    div.innerHTML = `
      <div class="te-header te-progress-hdr">
        <span class="te-spin-dot"></span>
        <span class="te-label">جارٍ التفكير...</span>
        <span class="te-time" id="${id}t">0.0ث</span>
      </div>`;
    content.prepend(div);

    let secs = 0;
    const timerEl = document.getElementById(id + 't');
    const iv = setInterval(() => {
      secs += 0.1;
      if (timerEl) timerEl.textContent = secs.toFixed(1) + 'ث';
    }, 100);
    div._iv = iv;
    return div;
  }

  function removeProgress(div) {
    if (!div) return;
    clearInterval(div._iv);
    try { div.remove(); } catch {}
  }

  /* ══════════════════════════════════════════════
     عرض رد نهائي مع كتلة تفكير مدمجة
     يُستخدم خارج AgentLoop (المحادثة العادية)
     ══════════════════════════════════════════════ */
  function renderResponse(msgEl, rawText, elapsedMs) {
    if (!_enabled) return rawText;
    const { thinking, reply } = parseThinking(rawText);
    if (!thinking) return reply || rawText;

    const content = msgEl && msgEl.querySelector('.msg-bot');
    if (!content) return reply || rawText;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildBlock(thinking, elapsedMs >= 0 ? elapsedMs : -1);
    const blockEl = wrapper.firstElementChild;
    if (blockEl) content.prepend(blockEl);

    return reply;
  }

  /* ── escape HTML ── */
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── تصدير عالمي ── */
  const exported = {
    setEnabled, isEnabled, setAutoExpand,
    parseThinking, buildBlock, toggle,
    attachProgress, removeProgress, renderResponse
  };
  window.ThinkingEngine = exported;
  return exported;
})();
