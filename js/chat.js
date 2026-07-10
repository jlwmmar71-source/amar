/* ══════════════════════════════════════════════
   chat.js — إدارة المحادثات المتعددة
   Galaoum AI Engine v6.0
   ══════════════════════════════════════════════ */

/* ── حفظ المحادثة الحالية في localStorage ── */
function saveChat() {
  try {
    const msgs = [];
    chatBox.querySelectorAll(':scope>div[id]').forEach(div => {
      const isUser  = div.style.cssText.includes('row-reverse');
      const content = div.querySelector('.msg-bot') || div.querySelectorAll('div>div')[0];
      const ts      = div.querySelector('[style*="font-size:10px"]');
      if (content) msgs.push({ id: div.id, sender: isUser ? 'user' : 'bot', html: content.innerHTML, time: ts ? ts.textContent : '' });
    });
    const convs = getConvs();
    const id    = getActiveId();
    const idx   = convs.findIndex(c => c.id === id);
    if (idx >= 0) {
      convs[idx].messages   = msgs.slice(-80);
      convs[idx].updatedAt  = Date.now();
      saveConvs(convs);
    }
    renderConvList();
  } catch (e) {}
}

/* ── تسمية المحادثة تلقائياً من أول رسالة ── */
function autoNameConversation(text) {
  const id    = getActiveId();
  const convs = getConvs();
  const idx   = convs.findIndex(c => c.id === id);
  if (idx >= 0 && (convs[idx].name === 'محادثة جديدة' || convs[idx].name === '')) {
    convs[idx].name = text.substring(0, 35) + (text.length > 35 ? '...' : '');
    saveConvs(convs);
    renderConvList();
  }
}

/* ── عرض قائمة المحادثات في الشريط الجانبي ── */
function renderConvList() {
  const list    = document.getElementById('conv-list');
  const counter = document.getElementById('conv-count');
  if (!list) return;

  const convs    = getConvs();
  const activeId = getActiveId();

  if (counter) counter.textContent = convs.length + ' محادثة';

  if (convs.length === 0) {
    list.innerHTML = '<div class="conv-empty">لا توجد محادثات بعد</div>';
    return;
  }

  list.innerHTML = convs.map(c => `
    <div class="conv-item ${c.id === activeId ? 'active' : ''}" onclick="switchConversation('${c.id}')">
      <span class="conv-icon">💬</span>
      <span class="conv-name" title="${c.name}">${c.name}</span>
      <button class="conv-del" onclick="event.stopPropagation();deleteConversation('${c.id}')" title="حذف">✕</button>
    </div>`).join('');
}

/* ── تحميل رسائل محادثة محفوظة ── */
function loadMessages(messages) {
  chatBox.innerHTML = '';
  msgId = 0;

  if (!messages || messages.length === 0) {
    addMessage('bot', renderMarkdown(WELCOME_MSG));
    return;
  }

  messages.forEach(m => {
    msgId++;
    const id     = 'm' + msgId;
    const isUser = m.sender === 'user';
    const div    = document.createElement('div');
    div.id = id;
    div.style.cssText = 'display:flex;align-items:flex-end;gap:10px' + (isUser ? ';flex-direction:row-reverse' : '');

    const avatar = document.createElement('div');
    avatar.style.cssText = 'width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;color:#fff;background:'
      + (isUser ? 'linear-gradient(135deg,#991b1b,#dc2626)' : 'linear-gradient(135deg,#1e40af,#6d28d9)');
    avatar.textContent = isUser ? 'أ' : '🤖';

    const bubble = document.createElement('div');
    bubble.style.cssText = 'max-width:82%;display:flex;flex-direction:column;gap:6px;align-items:'
      + (isUser ? 'flex-end' : 'flex-start');

    const content = document.createElement('div');
    content.className = isUser ? '' : 'msg-bot';
    content.style.cssText = 'padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.65;'
      + (isUser
        ? 'background:linear-gradient(135deg,#991b1b,#dc2626);color:#fff;border-radius:16px 16px 4px 16px'
        : 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#e2e8f0;border-radius:16px 16px 16px 4px');
    content.innerHTML = m.html;

    const ts = document.createElement('div');
    ts.style.cssText = 'font-size:10px;color:#475569;padding:0 4px';
    ts.textContent = m.time || '';

    bubble.appendChild(content);
    bubble.appendChild(ts);
    div.appendChild(avatar);
    div.appendChild(bubble);
    chatBox.appendChild(div);
  });

  chatBox.scrollTop = chatBox.scrollHeight;
}

/* ── إنشاء محادثة جديدة ── */
function newConversation() {
  const id    = genId();
  const convs = getConvs();
  convs.unshift({ id, name: 'محادثة جديدة', messages: [], createdAt: Date.now(), updatedAt: Date.now() });
  saveConvs(convs);
  setActiveId(id);
  clearMemory();
  chatBox.innerHTML = '';
  msgId = 0;
  addMessage('bot', renderMarkdown(WELCOME_MSG));
  renderConvList();
}

/* ── التبديل بين المحادثات ── */
function switchConversation(id) {
  setActiveId(id);
  clearMemory();
  const convs = getConvs();
  const conv  = convs.find(c => c.id === id);
  loadMessages(conv ? conv.messages : []);
  renderConvList();
}

/* ── حذف محادثة ── */
function deleteConversation(id) {
  if (!confirm('حذف هذه المحادثة؟')) return;
  let convs = getConvs().filter(c => c.id !== id);
  saveConvs(convs);
  if (getActiveId() === id) {
    if (convs.length > 0) { setActiveId(convs[0].id); switchConversation(convs[0].id); }
    else { newConversation(); }
  } else {
    renderConvList();
  }
}

/* تصدير الدوال للـ onclick في HTML */
window.newConversation    = newConversation;
window.switchConversation = switchConversation;
window.deleteConversation = deleteConversation;
