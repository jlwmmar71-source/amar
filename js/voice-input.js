/* ══════════════════════════════════════════════════════════════
   voice-input.js — الإدخال الصوتي (Speech-to-Text)
   Galaoum AI Engine v5.0 — by عمار جلعوم
   Web Speech API — مجاني تماماً، بدون مفتاح
   ══════════════════════════════════════════════════════════════ */

window.VoiceInput = (function () {

  let _recognition = null;
  let _listening   = false;
  let _targetInput = null;
  let _onResult    = null;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  /* ═══════ هل المتصفح يدعم الصوت؟ ═══════ */
  function isSupported() { return !!SR; }

  /* ═══════ إعداد المحرّك ═══════ */
  function _init(lang = 'ar-SA') {
    if (!SR) return null;
    const r = new SR();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      _listening = true;
      _updateBtn(true);
      _showBadge('🎤 جارٍ الاستماع...');
    };

    r.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript).join('');
      const isFinal = e.results[e.results.length - 1].isFinal;

      if (_targetInput) {
        _targetInput.value = transcript;
        _targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (isFinal && _onResult) _onResult(transcript);
      _showBadge(isFinal ? '✅ ' + transcript.substring(0, 40) : '🎤 ' + transcript.substring(0, 40));
    };

    r.onend = () => {
      _listening = false;
      _updateBtn(false);
      setTimeout(() => _hideBadge(), 3000);
    };

    r.onerror = (e) => {
      _listening = false;
      _updateBtn(false);
      const msgs = {
        'not-allowed':   'الرجاء السماح بالوصول للمايكروفون',
        'no-speech':     'لم يُكتشف أي صوت',
        'network':       'خطأ في الشبكة',
        'aborted':       'تم الإلغاء',
      };
      _showBadge('❌ ' + (msgs[e.error] || e.error));
      setTimeout(() => _hideBadge(), 3000);
    };

    return r;
  }

  /* ═══════ تشغيل / إيقاف ═══════ */
  function toggle(inputEl, lang, onResult) {
    if (!isSupported()) {
      alert('متصفحك لا يدعم الإدخال الصوتي. استخدم Chrome أو Edge.');
      return;
    }
    _targetInput = inputEl;
    _onResult = onResult || null;

    if (_listening) {
      stop();
    } else {
      _recognition = _init(lang || _getLang());
      if (_recognition) _recognition.start();
    }
  }

  function stop() {
    if (_recognition) { try { _recognition.stop(); } catch {} }
    _listening = false;
    _updateBtn(false);
  }

  /* ═══════ اكتشاف لغة الكتابة ═══════ */
  function _getLang() {
    const ui = document.documentElement.lang || 'ar';
    return ui.startsWith('ar') ? 'ar-SA' : 'en-US';
  }

  /* ═══════ تحديث زر المايكروفون ═══════ */
  function _updateBtn(active) {
    document.querySelectorAll('.vi-mic-btn').forEach(btn => {
      btn.classList.toggle('vi-active', active);
      btn.title = active ? 'انقر لإيقاف الاستماع' : 'انقر للتكلّم';
      btn.innerHTML = active ? '🔴' : '🎤';
    });
  }

  function _showBadge(msg) {
    const b = document.getElementById('vi-badge');
    if (b) { b.textContent = msg; b.style.opacity = '1'; b.style.transform = 'translateY(0)'; }
  }
  function _hideBadge() {
    const b = document.getElementById('vi-badge');
    if (b) { b.style.opacity = '0'; b.style.transform = 'translateY(-6px)'; }
  }

  /* ═══════ حقن زر المايكروفون في input الشات ═══════ */
  function injectMicButton() {
    const form = document.getElementById('chat-form');
    if (!form || document.querySelector('.vi-mic-btn')) return;

    const inputEl = form.querySelector('textarea, input[type=text]');
    if (!inputEl) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vi-mic-btn';
    btn.innerHTML = '🎤';
    btn.title = 'انقر للتكلّم';
    btn.onclick = () => toggle(inputEl);

    /* إضافة شارة الاستماع */
    const badge = document.createElement('div');
    badge.id = 'vi-badge';
    badge.className = 'vi-badge';

    /* إدراج الزر بجانب زر الإرسال */
    const sendBtn = form.querySelector('button[type=submit], .send-btn, #send-btn');
    if (sendBtn) {
      sendBtn.parentNode.insertBefore(btn, sendBtn);
    } else {
      form.appendChild(btn);
    }
    document.body.appendChild(badge);
  }

  /* تشغيل تلقائي بعد تحميل الصفحة */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(injectMicButton, 800));
  } else {
    setTimeout(injectMicButton, 800);
  }

  return { toggle, stop, isSupported, injectMicButton };
})();
