/* ══════════════════════════════════════════════════════════════
   live-collaboration.js — محرك التعاون الحي (Live Collaboration)
   تشغيل عدة وكلاء AI معاً + مزامنة لحظية بين التبويبات
   يعتمد BroadcastChannel (بدون خادم) + CRDT بسيط لحل التعارضات
   Galaoum AI Engine v5.0 — نسخة محسّنة
   ══════════════════════════════════════════════════════════════ */

window.LiveCollaboration = (function () {

  /* ══ ثوابت ══ */
  const CHANNEL_NAME = 'galaoum_collab_v1';
  const SESSION_KEY  = 'galaoum_collab_session';

  /* ══ الحالة الداخلية ══ */
  let _channel   = null;   // BroadcastChannel
  let _sessionId = null;   // معرّف الجلسة الحالية
  let _peerId    = _randomId();  // معرّف هذا التبويب
  let _peers     = {};     // { peerId: { name, lastSeen, typing } }
  let _docState  = {};     // CRDT بسيط: { key: { value, ts, author } }
  let _listeners = [];     // مستمعو الأحداث الخارجية
  let _panelOpen = false;

  /* ══════════════════════════════════════════════
     1. BroadcastChannel — مزامنة بين التبويبات
     ══════════════════════════════════════════════ */

  function _openChannel() {
    if (_channel) return;
    if (typeof BroadcastChannel === 'undefined') {
      if (typeof Logger !== 'undefined') Logger.warn('COLLAB', '⚠️ BroadcastChannel غير مدعوم في هذا المتصفح');
      return;
    }
    _channel = new BroadcastChannel(CHANNEL_NAME);
    _channel.onmessage = _onMessage;
    if (typeof Logger !== 'undefined') Logger.info('COLLAB', '📡 BroadcastChannel مفتوح');
  }

  function _broadcast(type, payload) {
    if (!_channel) _openChannel();
    if (!_channel) return;
    _channel.postMessage({ type, peerId: _peerId, sessionId: _sessionId, ts: Date.now(), payload });
  }

  function _onMessage(ev) {
    const { type, peerId, sessionId, ts, payload } = ev.data || {};
    if (!type || peerId === _peerId) return;  // تجاهل رسائلنا

    switch (type) {
      case 'HELLO':
        _peers[peerId] = { name: payload.name || peerId.slice(0,6), lastSeen: ts, typing: false };
        _broadcast('HELLO_ACK', { name: _peerName() });
        _renderPanel();
        _emit('peer_joined', { peerId, name: _peers[peerId].name });
        if (typeof Logger !== 'undefined') Logger.info('COLLAB', `👋 انضم: ${_peers[peerId].name}`);
        break;

      case 'HELLO_ACK':
        _peers[peerId] = { name: payload.name || peerId.slice(0,6), lastSeen: ts, typing: false };
        _renderPanel();
        break;

      case 'BYE':
        delete _peers[peerId];
        _renderPanel();
        _emit('peer_left', { peerId });
        break;

      case 'TYPING':
        if (_peers[peerId]) {
          _peers[peerId].typing   = payload.typing;
          _peers[peerId].lastSeen = ts;
          _renderTypingIndicator();
        }
        break;

      case 'DOC_UPDATE':
        /* CRDT: قبول التحديث إذا كان أحدث */
        _applyCRDT(payload.changes, peerId);
        _emit('doc_updated', { peerId, changes: payload.changes });
        break;

      case 'MESSAGE':
        _emit('message', { peerId, name: _peers[peerId]?.name || peerId.slice(0,6), text: payload.text, ts });
        _addChatLine(_peers[peerId]?.name || '؟', payload.text);
        break;

      case 'TASK_SHARE':
        _emit('task_shared', { peerId, task: payload.task });
        if (typeof Toast !== 'undefined') Toast.info(`📨 مهمة مشتركة من ${_peers[peerId]?.name || '؟'}: ${payload.task.substring(0,40)}...`);
        break;

      case 'RESULT_SHARE':
        _emit('result_shared', { peerId, result: payload.result });
        _addChatLine(_peers[peerId]?.name || '؟', `📤 نتيجة: ${payload.result.substring(0,80)}...`);
        break;

      case 'PING':
        if (_peers[peerId]) _peers[peerId].lastSeen = ts;
        _broadcast('PONG', {});
        break;
    }
  }

  /* ══════════════════════════════════════════════
     2. CRDT بسيط — Last-Write-Wins لحل التعارضات
     ══════════════════════════════════════════════ */

  function _applyCRDT(changes, author) {
    let updated = false;
    for (const [key, { value, ts }] of Object.entries(changes || {})) {
      const current = _docState[key];
      if (!current || ts > current.ts) {
        _docState[key] = { value, ts, author };
        updated = true;
      }
    }
    if (updated) _renderPanel();
  }

  function updateDoc(key, value) {
    const ts = Date.now();
    _docState[key] = { value, ts, author: _peerId };
    _broadcast('DOC_UPDATE', { changes: { [key]: { value, ts } } });
  }

  function getDoc(key) {
    return _docState[key]?.value ?? null;
  }

  function getFullDoc() {
    const out = {};
    for (const [k, v] of Object.entries(_docState)) out[k] = v.value;
    return out;
  }

  /* ══════════════════════════════════════════════
     3. إدارة الجلسة والأقران
     ══════════════════════════════════════════════ */

  function joinSession(sessionId, name) {
    _sessionId = sessionId || ('session_' + _randomId(6));
    localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId: _sessionId, name: name || _peerName() }));
    _openChannel();
    _broadcast('HELLO', { name: name || _peerName() });
    _startHeartbeat();
    if (typeof Logger !== 'undefined') Logger.info('COLLAB', `🔗 انضم للجلسة: ${_sessionId}`);
    if (typeof Toast !== 'undefined') Toast.success(`🤝 متصل — الجلسة: ${_sessionId.slice(0,8)}`);
    return _sessionId;
  }

  function leaveSession() {
    _broadcast('BYE', {});
    _peers = {};
    _sessionId = null;
    localStorage.removeItem(SESSION_KEY);
    if (_channel) { _channel.close(); _channel = null; }
    if (typeof Logger !== 'undefined') Logger.info('COLLAB', '👋 غادر الجلسة');
    _renderPanel();
  }

  function sendMessage(text) {
    if (!text) return;
    _broadcast('MESSAGE', { text });
    _addChatLine('أنت', text);
  }

  function shareTask(task) {
    _broadcast('TASK_SHARE', { task });
    if (typeof Toast !== 'undefined') Toast.success('📤 تم مشاركة المهمة مع الأقران');
  }

  function shareResult(result) {
    _broadcast('RESULT_SHARE', { result });
  }

  function setTyping(isTyping) {
    _broadcast('TYPING', { typing: isTyping });
  }

  /* ══════════════════════════════════════════════
     4. Heartbeat — تنظيف الأقران المنقطعين
     ══════════════════════════════════════════════ */
  let _heartbeatTimer = null;

  function _startHeartbeat() {
    if (_heartbeatTimer) clearInterval(_heartbeatTimer);
    _heartbeatTimer = setInterval(() => {
      _broadcast('PING', {});
      const now = Date.now();
      for (const [id, p] of Object.entries(_peers)) {
        if (now - p.lastSeen > 15000) {  // 15 ثانية بدون رد
          delete _peers[id];
          _emit('peer_left', { peerId: id });
        }
      }
      _renderPanel();
    }, 5000);
  }

  /* ══════════════════════════════════════════════
     5. تشغيل وكلاء AI متوازيين
     ══════════════════════════════════════════════ */

  function splitTask(task, parts = 2) {
    if (typeof task !== 'string') return [task];
    const sentences = task.split(/(?<=[.؟?!])\s+/).filter(Boolean);
    if (sentences.length <= 1) {
      /* قسّم بالكلمات إن كانت الجملة واحدة طويلة */
      const words = task.split(' ');
      if (words.length > 10) {
        const half = Math.ceil(words.length / parts);
        return Array.from({ length: parts }, (_, i) =>
          words.slice(i * half, (i + 1) * half).join(' ')
        ).filter(Boolean);
      }
      return [task];
    }
    const chunkSize = Math.ceil(sentences.length / parts);
    return Array.from({ length: Math.ceil(sentences.length / chunkSize) }, (_, i) =>
      sentences.slice(i * chunkSize, (i + 1) * chunkSize).join(' ')
    ).filter(Boolean);
  }

  async function collaborate(task, agents) {
    if (!agents || agents.length === 0) return { results: [], merged: '' };
    const subtasks = splitTask(task, agents.length);
    const jobs = agents.map((agent, i) => {
      const subtask = subtasks[i] || subtasks[subtasks.length - 1];
      return agent.run(subtask)
        .then(output => ({ agent: agent.name, subtask, output, ok: true, ts: Date.now() }))
        .catch(err => ({ agent: agent.name, subtask, error: String(err), ok: false, ts: Date.now() }));
    });
    const results = await Promise.all(jobs);
    const merged  = _mergeResults(results);
    /* شارك النتيجة مع الأقران */
    shareResult(typeof merged === 'string' ? merged : JSON.stringify(merged).slice(0,200));
    return { results, merged };
  }

  function _mergeResults(results) {
    const successful = results.filter(r => r.ok);
    if (!successful.length) return 'فشلت جميع العمليات';
    if (typeof ConsensusEngine !== 'undefined' && successful.length > 1) {
      return ConsensusEngine.merge(successful.map(r => ({ model: r.agent, output: r.output })));
    }
    return successful.map((r, i) => `### نتيجة ${i + 1} — ${r.agent}\n${r.output}`).join('\n\n---\n\n');
  }

  /* ══════════════════════════════════════════════
     6. نظام الأحداث
     ══════════════════════════════════════════════ */

  function on(event, fn) { _listeners.push({ event, fn }); }
  function off(event, fn) { _listeners = _listeners.filter(l => !(l.event === event && l.fn === fn)); }
  function _emit(event, data) { _listeners.filter(l => l.event === event).forEach(l => { try { l.fn(data); } catch {} }); }

  /* ══════════════════════════════════════════════
     7. واجهة اللوحة
     ══════════════════════════════════════════════ */

  function openPanel() {
    let panel = document.getElementById('collab-panel');
    if (!panel) { panel = _createPanel(); document.body.appendChild(panel); }
    panel.style.display = 'flex';
    _panelOpen = true;
    _renderPanel();
    /* إعادة الاتصال إن كانت جلسة محفوظة */
    const saved = _getSavedSession();
    if (saved && !_sessionId) joinSession(saved.sessionId, saved.name);
  }

  function closePanel() {
    const panel = document.getElementById('collab-panel');
    if (panel) panel.style.display = 'none';
    _panelOpen = false;
  }

  function _createPanel() {
    const el = document.createElement('div');
    el.id = 'collab-panel';
    el.className = 'g-panel';
    el.onclick = e => { if (e.target === el) closePanel(); };
    el.innerHTML = `
      <div class="g-panel-box" style="max-width:600px">
        <div class="g-panel-header">
          <div class="g-panel-title">🤝 التعاون الحي</div>
          <button class="g-panel-close" onclick="LiveCollaboration.closePanel()">✕</button>
        </div>
        <div class="g-panel-body">
          <!-- إنشاء جلسة / الانضمام -->
          <div id="collab-session-box" style="margin-bottom:14px;background:rgba(0,0,0,0.3);border-radius:10px;padding:12px">
            <div class="g-label" style="margin-bottom:8px">الجلسة</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <input id="collab-session-input" class="g-input" placeholder="معرّف الجلسة (اتركه فارغاً لإنشاء جديدة)" style="flex:1;min-width:160px" dir="ltr">
              <input id="collab-name-input" class="g-input" placeholder="اسمك" style="width:110px">
              <button class="g-btn g-btn-green" onclick="LiveCollaboration._joinFromUI()">🔗 انضم</button>
              <button class="g-btn" style="border-color:rgba(239,68,68,0.4);color:#f87171" onclick="LiveCollaboration.leaveSession();LiveCollaboration._renderPanel()">🚪 خروج</button>
            </div>
            <div id="collab-session-status" style="font-size:11px;color:#475569;margin-top:6px">غير متصل</div>
          </div>
          <!-- الأقران المتصلون -->
          <div class="g-label" style="margin-bottom:6px">👥 المتصلون</div>
          <div id="collab-peers" style="min-height:40px;margin-bottom:14px;background:rgba(0,0,0,0.2);border-radius:8px;padding:8px;font-size:12px;color:#64748b">لا يوجد أقران متصلون</div>
          <!-- مؤشر الكتابة -->
          <div id="collab-typing" style="font-size:11px;color:#a78bfa;min-height:18px;margin-bottom:8px"></div>
          <!-- الدردشة -->
          <div class="g-label" style="margin-bottom:6px">💬 الدردشة</div>
          <div id="collab-chat" style="height:150px;overflow-y:auto;background:rgba(0,0,0,0.25);border-radius:8px;padding:10px;font-size:12px;color:#94a3b8;margin-bottom:8px;display:flex;flex-direction:column;gap:4px"></div>
          <div style="display:flex;gap:6px">
            <input id="collab-msg-input" class="g-input" placeholder="رسالة للأقران..." style="flex:1"
              onkeydown="if(event.key==='Enter'){LiveCollaboration.sendMessage(this.value);this.value=''}"
              oninput="LiveCollaboration.setTyping(this.value.length>0)">
            <button class="g-btn" onclick="LiveCollaboration._sendFromUI()">إرسال</button>
          </div>
          <!-- مشاركة مهمة -->
          <div style="margin-top:12px;display:flex;gap:6px">
            <button class="g-btn" style="flex:1" onclick="LiveCollaboration._shareCurrentTask()">📤 مشاركة المهمة الحالية</button>
            <button class="g-btn" style="flex:1" onclick="LiveCollaboration._runParallelFromUI()">⚡ تشغيل متوازٍ</button>
          </div>
        </div>
      </div>`;
    return el;
  }

  function _renderPanel() {
    if (!_panelOpen) return;

    /* حالة الجلسة */
    const statusEl = document.getElementById('collab-session-status');
    if (statusEl) {
      statusEl.textContent = _sessionId
        ? `✅ متصل — الجلسة: ${_sessionId.slice(0,12)}... | معرّفك: ${_peerId.slice(0,6)}`
        : '🔴 غير متصل';
      statusEl.style.color = _sessionId ? '#4ade80' : '#f87171';
    }

    /* الأقران */
    const peersEl = document.getElementById('collab-peers');
    if (peersEl) {
      const list = Object.entries(_peers);
      peersEl.innerHTML = list.length === 0
        ? '<span style="color:#334155">لا يوجد أقران — شارك معرّف الجلسة مع شخص آخر</span>'
        : list.map(([id, p]) => `
            <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
              <div style="width:8px;height:8px;border-radius:50%;background:#4ade80;flex-shrink:0"></div>
              <span style="color:#c4b5fd;font-weight:600">${p.name}</span>
              <span style="color:#334155;font-size:10px">${id.slice(0,6)}</span>
              ${p.typing ? '<span style="color:#a78bfa;font-size:10px">⌨️ يكتب...</span>' : ''}
            </div>`).join('');
    }
  }

  function _renderTypingIndicator() {
    const el = document.getElementById('collab-typing');
    if (!el) return;
    const typing = Object.values(_peers).filter(p => p.typing).map(p => p.name);
    el.textContent = typing.length > 0 ? `⌨️ ${typing.join('، ')} ${typing.length === 1 ? 'يكتب' : 'يكتبون'}...` : '';
  }

  function _addChatLine(author, text) {
    const chat = document.getElementById('collab-chat');
    if (!chat) return;
    const div = document.createElement('div');
    div.innerHTML = `<span style="color:#7c3aed;font-weight:600">${author}:</span> <span>${text}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  /* ── helpers للواجهة ── */
  window.LiveCollaboration = window.LiveCollaboration || {};
  function _joinFromUI() {
    const sid  = document.getElementById('collab-session-input')?.value.trim();
    const name = document.getElementById('collab-name-input')?.value.trim();
    joinSession(sid || undefined, name || undefined);
    _renderPanel();
  }

  function _sendFromUI() {
    const inp = document.getElementById('collab-msg-input');
    if (!inp || !inp.value.trim()) return;
    sendMessage(inp.value.trim());
    inp.value = '';
  }

  function _shareCurrentTask() {
    const inp = document.getElementById('user-input');
    const task = inp?.value.trim() || 'مهمة مشتركة';
    shareTask(task);
  }

  function _runParallelFromUI() {
    const inp  = document.getElementById('user-input');
    const task = inp?.value.trim();
    if (!task) { if (typeof Toast !== 'undefined') Toast.warn('اكتب مهمة في صندوق الشات أولاً'); return; }
    if (typeof ParallelEngine !== 'undefined') {
      ParallelEngine.openPanel();
    } else if (typeof Toast !== 'undefined') {
      Toast.info('🔄 استخدم ⚡ المتوازي في الشريط الجانبي');
    }
  }

  /* ══ مساعدات ══ */
  function _randomId(len = 10) {
    return Math.random().toString(36).substring(2, 2 + len);
  }

  function _peerName() {
    const saved = _getSavedSession();
    return saved?.name || `مستخدم-${_peerId.slice(0,4)}`;
  }

  function _getSavedSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }

  /* ══ استعادة جلسة محفوظة عند التحميل ══ */
  const saved = _getSavedSession();
  if (saved?.sessionId) {
    setTimeout(() => {
      joinSession(saved.sessionId, saved.name);
      if (typeof Logger !== 'undefined') Logger.info('COLLAB', `♻️ استعادة جلسة: ${saved.sessionId.slice(0,8)}`);
    }, 2000);
  }

  return {
    /* جلسة */
    joinSession, leaveSession, sendMessage, shareTask, shareResult, setTyping,
    /* وثيقة مشتركة */
    updateDoc, getDoc, getFullDoc,
    /* وكلاء متوازيون */
    splitTask, collaborate,
    /* أحداث */
    on, off,
    /* واجهة */
    openPanel, closePanel,
    /* helpers داخلية للواجهة */
    _joinFromUI, _sendFromUI, _shareCurrentTask, _runParallelFromUI,
    _renderPanel,
    /* قراءة الحالة */
    getPeers: () => ({ ..._peers }),
    getSessionId: () => _sessionId,
    getPeerId: () => _peerId,
    isConnected: () => !!_sessionId && !!_channel
  };

})();
