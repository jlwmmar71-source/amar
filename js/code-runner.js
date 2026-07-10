/* ══════════════════════════════════════════════════════════════
   code-runner.js — محرّك تنفيذ الكود الحقيقي
   Galaoum AI Engine v5.0 — by عمار جلعوم

   يدعم: Python (Pyodide) · JavaScript · HTML · CSS
   ══════════════════════════════════════════════════════════════ */

window.CodeRunner = (function () {

  let _pyodide      = null;
  let _pyodideLoading = false;
  let _pyodideReady   = false;

  /* ═══════ تحميل Pyodide للـ Python ═══════ */
  async function _loadPyodide() {
    if (_pyodideReady)   return _pyodide;
    if (_pyodideLoading) {
      while (_pyodideLoading) await new Promise(r => setTimeout(r, 200));
      return _pyodide;
    }
    _pyodideLoading = true;
    if (!window.loadPyodide) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    _pyodide = await window.loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.0/full/' });
    /* إعادة توجيه stdout/stderr */
    await _pyodide.runPythonAsync(`
import sys, io
class _Capture(io.StringIO):
    def __init__(self): super().__init__(); self._buf = []
    def write(self, s): self._buf.append(s); return len(s)
    def getvalue(self): return ''.join(self._buf)
_stdout = _Capture()
_stderr = _Capture()
sys.stdout = _stdout
sys.stderr = _stderr
`);
    _pyodideReady   = true;
    _pyodideLoading = false;
    return _pyodide;
  }

  /* ═══════ تنفيذ Python ═══════ */
  async function runPython(code, outputEl) {
    _updateOutput(outputEl, '⏳ جارٍ تحميل Python runtime...', 'loading');
    try {
      const py = await _loadPyodide();
      _updateOutput(outputEl, '▶ جارٍ التنفيذ...', 'loading');

      /* إعادة ضبط الـ buffers */
      await py.runPythonAsync(`_stdout._buf = []; _stderr._buf = []`);

      let result;
      try {
        result = await py.runPythonAsync(code);
      } catch (e) {
        const stderr = await py.runPythonAsync(`_stderr.getvalue()`);
        _updateOutput(outputEl, (stderr || e.message), 'error');
        return;
      }

      const stdout = await py.runPythonAsync(`_stdout.getvalue()`);
      const stderr = await py.runPythonAsync(`_stderr.getvalue()`);

      let out = '';
      if (stdout) out += stdout;
      if (stderr) out += '\n⚠️ ' + stderr;
      if (!out && result !== undefined && result !== null) out = String(result);
      if (!out) out = '✅ تمّ التنفيذ (بدون مخرجات)';

      _updateOutput(outputEl, out.trim(), stderr ? 'warning' : 'success');
    } catch (e) {
      _updateOutput(outputEl, '❌ ' + e.message, 'error');
    }
  }

  /* ═══════ تنفيذ JavaScript ═══════ */
  async function runJS(code, outputEl) {
    _updateOutput(outputEl, '▶ جارٍ التنفيذ...', 'loading');
    const logs = [];
    const origLog = console.log, origErr = console.error, origWarn = console.warn;
    console.log  = (...a) => { logs.push('📋 ' + a.map(_str).join(' ')); origLog(...a); };
    console.error= (...a) => { logs.push('❌ ' + a.map(_str).join(' ')); origErr(...a); };
    console.warn = (...a) => { logs.push('⚠️ ' + a.map(_str).join(' ')); origWarn(...a); };

    try {
      const AsyncFn = Object.getPrototypeOf(async function(){}).constructor;
      const result  = await new AsyncFn(code)();
      console.log = origLog; console.error = origErr; console.warn = origWarn;

      if (result !== undefined) logs.push('↩️ ' + _str(result));
      const out = logs.length > 0 ? logs.join('\n') : '✅ تمّ التنفيذ';
      _updateOutput(outputEl, out, 'success');
    } catch (e) {
      console.log = origLog; console.error = origErr; console.warn = origWarn;
      if (logs.length) logs.push('');
      logs.push('❌ ' + e.message);
      _updateOutput(outputEl, logs.join('\n'), 'error');
    }
  }

  /* ═══════ عرض HTML ═══════ */
  function runHTML(code, outputEl) {
    outputEl.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;min-height:300px;border:none;border-radius:10px;background:#fff';
    iframe.sandbox = 'allow-scripts allow-same-origin';
    outputEl.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(code); doc.close();
    /* تعديل الارتفاع تلقائياً */
    setTimeout(() => {
      try { iframe.style.height = doc.body.scrollHeight + 20 + 'px'; } catch {}
    }, 300);
  }

  /* ═══════ الكشف عن لغة الكود ═══════ */
  function detectLang(lang, code) {
    if (!lang) {
      if (/^<!DOCTYPE|^<html/i.test(code.trim())) return 'html';
      if (/import\s+\w|from\s+\w+\s+import|print\s*\(|def\s+\w+\s*\(/.test(code)) return 'python';
      return 'javascript';
    }
    const l = lang.toLowerCase();
    if (l === 'py' || l === 'python') return 'python';
    if (l === 'js' || l === 'javascript' || l === 'ts' || l === 'typescript') return 'javascript';
    if (l === 'html' || l === 'htm') return 'html';
    return 'javascript';
  }

  /* ═══════ إضافة أزرار التشغيل لكل كود في الشات ═══════ */
  function addRunButtons(container) {
    container.querySelectorAll('pre code, pre').forEach((el, idx) => {
      if (el.dataset.crInjected) return;
      el.dataset.crInjected = '1';

      const pre   = el.tagName === 'PRE' ? el : el.parentElement;
      const code  = el.textContent || '';
      const lang  = (el.className.match(/language-(\w+)/) || [])[1] || '';
      const finalLang = detectLang(lang, code);

      if (code.trim().length < 5) return;

      const btnWrap = document.createElement('div');
      btnWrap.className = 'cr-btn-row';

      const langEmoji = { python: '🐍', javascript: '⚡', html: '🌐' };
      const langLabel = { python: 'Python', javascript: 'JavaScript', html: 'HTML' };

      const runBtn = document.createElement('button');
      runBtn.className = 'cr-run-btn';
      runBtn.innerHTML = `${langEmoji[finalLang] || '▶'} تشغيل ${langLabel[finalLang] || ''}`;

      const copyBtn = document.createElement('button');
      copyBtn.className = 'cr-copy-btn';
      copyBtn.textContent = '📋 نسخ';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(code);
        copyBtn.textContent = '✅ تم';
        setTimeout(() => { copyBtn.textContent = '📋 نسخ'; }, 1500);
      };

      const outputEl = document.createElement('div');
      outputEl.className = 'cr-output cr-output-hidden';

      runBtn.onclick = async () => {
        outputEl.classList.remove('cr-output-hidden');
        runBtn.disabled = true;
        runBtn.textContent = '⏳ جارٍ...';
        if (finalLang === 'python')     await runPython(code, outputEl);
        else if (finalLang === 'html')       runHTML(code, outputEl);
        else                            await runJS(code, outputEl);
        runBtn.disabled = false;
        runBtn.innerHTML = `${langEmoji[finalLang]} تشغيل مجدداً`;
      };

      btnWrap.appendChild(runBtn);
      btnWrap.appendChild(copyBtn);
      pre.parentNode.insertBefore(btnWrap, pre.nextSibling);
      pre.parentNode.insertBefore(outputEl, btnWrap.nextSibling);
    });
  }

  /* ═══════ مساعدات ═══════ */
  function _str(v) {
    if (typeof v === 'object') { try { return JSON.stringify(v, null, 2); } catch { return String(v); } }
    return String(v);
  }

  function _updateOutput(el, text, type) {
    if (!el) return;
    const colors = { loading: '#94a3b8', success: '#30d158', error: '#ff2d55', warning: '#ffd60a' };
    el.style.color = colors[type] || '#e2e8f0';
    el.textContent = text;
  }

  /* ═══════ لوحة المحرّر المنفصلة ═══════ */
  function openEditor(lang = 'python') {
    const p = document.getElementById('code-runner-panel');
    if (p) {
      p.style.display = 'flex';
      document.getElementById('cr-lang-select').value = lang;
    }
  }

  function closeEditor() {
    const p = document.getElementById('code-runner-panel');
    if (p) p.style.display = 'none';
  }

  async function runEditor() {
    const code  = document.getElementById('cr-editor-input')?.value || '';
    const lang  = document.getElementById('cr-lang-select')?.value  || 'python';
    const outEl = document.getElementById('cr-editor-output');
    if (!outEl) return;
    outEl.classList.remove('cr-output-hidden');
    if (lang === 'python')     await runPython(code, outEl);
    else if (lang === 'html')       runHTML(code, outEl);
    else                       await runJS(code, outEl);
  }

  /* مراقب تلقائي للرسائل الجديدة */
  function _observe() {
    const chat = document.getElementById('chat-box');
    if (!chat) return;
    const obs = new MutationObserver(() => {
      chat.querySelectorAll('.msg-bot, .msg-content').forEach(el => addRunButtons(el));
    });
    obs.observe(chat, { childList: true, subtree: true });
    addRunButtons(chat);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _observe);
  } else {
    setTimeout(_observe, 500);
  }

  return { runPython, runJS, runHTML, addRunButtons, openEditor, closeEditor, runEditor };
})();
