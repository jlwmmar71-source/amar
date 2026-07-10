/* ══════════════════════════════════════════════
   sandbox-engine.js — بيئة معزولة لتشغيل المشاريع
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const SandboxEngine = (() => {

  let _currentSandbox = null;

  /* ══════════════════════════════
     1. تشغيل HTML/CSS/JS معزول
  ══════════════════════════════ */
  function runHTML(html, css = '', js = '') {
    const full = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;padding:12px;font-family:system-ui,sans-serif;background:#fff;color:#111}
*{box-sizing:border-box}
${css}
</style>
</head>
<body>
${html}
<script>
// حماية من الإيجاد اللانهائي
const _safeTimeout = setTimeout;
const _origFetch = window.fetch;
window.onerror = (msg,src,line) => {
  const err = document.getElementById('_sandbox_error');
  if(err) err.textContent = '❌ ' + msg + ' (سطر ' + line + ')';
};
try {
${js}
} catch(e) {
  const err = document.createElement('div');
  err.id='_sandbox_error';
  err.style.cssText='position:fixed;bottom:0;left:0;right:0;background:#dc2626;color:#fff;padding:8px;font-size:12px;z-index:9999';
  err.textContent='❌ ' + e.message;
  document.body.appendChild(err);
}
<\/script>
</body>
</html>`;
    return _openSandboxWindow(full, 'html');
  }

  /* تشغيل ملفات متعددة (مشروع كامل) */
  function runProject(files) {
    // files = { 'index.html': '...', 'style.css': '...', 'app.js': '...' }
    let html = files['index.html'] || '';
    const css  = files['style.css']  || files['styles.css'] || '';
    const js   = files['script.js']  || files['app.js'] || files['main.js'] || '';

    if (!html && (css || js)) {
      html = `<div id="app"></div>`;
    }
    return runHTML(html, css, js);
  }

  /* ── فتح نافذة sandbox (iframe معزول) ── */
  function _openSandboxWindow(content, type) {
    _ensurePanel();
    const panel = document.getElementById('sandbox-panel');
    const frame = document.getElementById('sandbox-frame');
    const info  = document.getElementById('sandbox-info');

    // إلغاء الـ sandbox القديم
    if (_currentSandbox) { try { frame.src = 'about:blank'; } catch {} }

    panel.style.display = 'flex';

    if (type === 'html') {
      const blob = new Blob([content], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      _currentSandbox = url;
      frame.src = url;
      if (info) info.textContent = 'HTML/CSS/JS — معزول';
    }

    return { panel, frame };
  }

  /* ══════════════════════════════
     2. تشغيل كود (Wandbox + Worker)
  ══════════════════════════════ */

  const LANG_MAP = {
    python:'cpython-3.12.7', python3:'cpython-3.12.7',
    javascript:'nodejs-20.17.0', js:'nodejs-20.17.0', node:'nodejs-20.17.0',
    cpp:'gcc-head', c:'gcc-head-c', rust:'rust-1.82.0',
    go:'go-1.23.2', ruby:'ruby-4.0.2', php:'php-8.3.12'
  };

  async function runCode(lang, code) {
    const compiler = LANG_MAP[lang.toLowerCase()];

    /* JS: تشغيل في Web Worker معزول */
    if (!compiler && (lang === 'js' || lang === 'javascript' || !LANG_MAP[lang.toLowerCase()])) {
      return await _runJSInWorker(code);
    }

    /* غير ذلك: Wandbox API */
    return await _runOnWandbox(compiler || 'cpython-3.12.7', code);
  }

  async function _runJSInWorker(code) {
    return new Promise((resolve) => {
      const logs = [];
      const workerCode = `
        const _logs = [];
        const console = {
          log: (...a) => _logs.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')),
          error: (...a) => _logs.push('❌ ' + a.join(' ')),
          warn: (...a) => _logs.push('⚠️ ' + a.join(' '))
        };
        try {
          ${code}
          self.postMessage({ ok: true, output: _logs.join('\\n') || '(لا مخرجات)' });
        } catch(e) {
          self.postMessage({ ok: false, output: '❌ ' + e.message });
        }
      `;
      const blob = new Blob([workerCode], { type: 'text/javascript' });
      const url  = URL.createObjectURL(blob);
      const w    = new Worker(url);
      const timer = setTimeout(() => { w.terminate(); resolve({ ok: false, output: '❌ انتهت المهلة (5 ثوانٍ)' }); }, 5000);
      w.onmessage = e => { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); resolve(e.data); };
      w.onerror   = e => { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); resolve({ ok: false, output: '❌ ' + e.message }); };
    });
  }

  async function _runOnWandbox(compiler, code) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch('https://wandbox.org/api/compile.json', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compiler, code, 'compiler-option-raw': '-O2' })
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const output = [d.program_output, d.compiler_output, d.compiler_error].filter(Boolean).join('\n').trim();
      return { ok: !d.compiler_error, output: output || '(لا مخرجات)' };
    } catch (e) {
      clearTimeout(tid);
      return { ok: false, output: '❌ ' + (e.name === 'AbortError' ? 'انتهت المهلة' : e.message) };
    }
  }

  /* ══════════════════════════════
     3. معاينة ZIP مشروع كامل
  ══════════════════════════════ */
  async function runZip(zipFile) {
    if (typeof JSZip === 'undefined') {
      return { ok: false, error: 'مكتبة JSZip غير متاحة' };
    }
    try {
      const zip = await JSZip.loadAsync(zipFile);
      const files = {};
      for (const [path, entry] of Object.entries(zip.files)) {
        if (!entry.dir) {
          const name = path.replace(/^[^/]+\//, ''); // إزالة المجلد الجذر
          if (/\.(html|css|js|json|txt|md)$/i.test(name)) {
            files[name] = await entry.async('text');
          }
        }
      }
      runProject(files);
      return { ok: true, files: Object.keys(files) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* ══════════════════════════════
     الواجهة المرئية
  ══════════════════════════════ */
  function openPanel() {
    _ensurePanel();
    document.getElementById('sandbox-panel').style.display = 'flex';
  }

  function closePanel() {
    const p = document.getElementById('sandbox-panel');
    if (p) p.style.display = 'none';
    if (_currentSandbox) { URL.revokeObjectURL(_currentSandbox); _currentSandbox = null; }
  }

  function _ensurePanel() {
    if (document.getElementById('sandbox-panel')) return;
    const el = document.createElement('div');
    el.id = 'sandbox-panel';
    el.style.cssText = `
      display:none;position:fixed;inset:0;z-index:9300;
      background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);
      flex-direction:column;font-family:inherit;
    `;
    el.innerHTML = `
      <!-- شريط علوي -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(10,15,30,0.98);border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:14px;font-weight:700;color:#f1f5f9">🧪 Sandbox — بيئة تشغيل معزولة</span>
          <span id="sandbox-info" style="font-size:10px;color:#64748b;background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:999px"></span>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="SandboxEngine._openCodeEditor()" style="padding:6px 12px;border-radius:8px;font-size:11px;cursor:pointer;font-family:inherit;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa">✏️ محرر الكود</button>
          <button onclick="SandboxEngine.closePanel()" style="padding:6px 12px;border-radius:8px;font-size:11px;cursor:pointer;font-family:inherit;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444">✕ إغلاق</button>
        </div>
      </div>
      <!-- الـ iframe المعزول -->
      <iframe id="sandbox-frame"
        sandbox="allow-scripts allow-forms allow-modals"
        style="flex:1;width:100%;border:none;background:#fff"
        src="about:blank">
      </iframe>
    `;
    document.body.appendChild(el);
  }

  /* محرر كود مدمج مبسط */
  function _openCodeEditor() {
    const editor = document.getElementById('sandbox-code-editor');
    if (editor) { editor.style.display = editor.style.display === 'none' ? 'flex' : 'none'; return; }
    const el = document.createElement('div');
    el.id = 'sandbox-code-editor';
    el.style.cssText = `
      position:absolute;top:44px;right:0;width:400px;bottom:0;
      background:rgba(10,15,30,0.98);border-left:1px solid rgba(255,255,255,0.1);
      z-index:10;display:flex;flex-direction:column;
    `;
    el.innerHTML = `
      <div style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.07);display:flex;gap:6px">
        <select id="sb-lang" style="flex:1;padding:6px;border-radius:6px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);color:#f1f5f9;font-size:11px">
          <option>html</option><option>javascript</option><option>python</option><option>css</option>
        </select>
        <button onclick="SandboxEngine._runEditorCode()" style="padding:6px 12px;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;background:rgba(74,222,128,0.2);border:1px solid rgba(74,222,128,0.3);color:#4ade80">▶ تشغيل</button>
      </div>
      <textarea id="sb-code" placeholder="اكتب الكود هنا..." style="flex:1;padding:12px;background:transparent;border:none;color:#e2e8f0;font-family:monospace;font-size:12px;resize:none;outline:none;line-height:1.6"></textarea>
      <div id="sb-output" style="max-height:140px;overflow-y:auto;padding:10px 12px;border-top:1px solid rgba(255,255,255,0.07);font-family:monospace;font-size:11px;color:#94a3b8;background:rgba(0,0,0,0.3)">// المخرجات تظهر هنا</div>
    `;
    document.getElementById('sandbox-panel').appendChild(el);
  }

  async function _runEditorCode() {
    const lang = document.getElementById('sb-lang')?.value || 'javascript';
    const code = document.getElementById('sb-code')?.value || '';
    const out  = document.getElementById('sb-output');
    if (out) out.textContent = '⏳ جاري التشغيل...';
    if (lang === 'html' || lang === 'css') {
      runHTML(code, lang === 'css' ? code : '', '');
      if (out) out.textContent = '✅ تم عرض HTML/CSS';
    } else {
      const result = await runCode(lang, code);
      if (out) {
        out.textContent = result.output;
        out.style.color = result.ok ? '#4ade80' : '#ef4444';
      }
    }
  }

  return { runHTML, runProject, runCode, runZip, openPanel, closePanel, _openCodeEditor, _runEditorCode };
})();
window.SandboxEngine = SandboxEngine;
