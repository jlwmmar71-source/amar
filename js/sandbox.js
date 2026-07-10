/* ══════════════════════════════════════════════
   sandbox.js — بيئة التشغيل الآمنة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const Sandbox = (() => {

  /* ── قالب HTML للـ Sandbox ── */
  const SANDBOX_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { margin:0;padding:8px;font-family:monospace;font-size:13px;background:#0d1117;color:#e6edf3; }
  .output { white-space:pre-wrap;word-break:break-word; }
  .error  { color:#f85149; }
  .log    { color:#79c0ff; }
  .warn   { color:#e3b341; }
</style>
</head>
<body>
<div id="out" class="output"></div>
<script>
(function(){
  const out = document.getElementById('out');
  const _log = (cls, args) => {
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = args.map(a => {
      try { return typeof a === 'object' ? JSON.stringify(a,null,2) : String(a); }
      catch { return String(a); }
    }).join(' ');
    out.appendChild(line);
    window.parent.postMessage({ type:'sandbox_log', cls, text: line.textContent }, '*');
  };
  console.log   = (...a) => _log('log',  a);
  console.warn  = (...a) => _log('warn', a);
  console.error = (...a) => _log('error',a);
  window.onerror = (msg, src, line) => {
    _log('error', [\`خطأ في السطر \${line}: \${msg}\`]);
    window.parent.postMessage({ type:'sandbox_error', msg, line }, '*');
    return true;
  };
  window.parent.postMessage({ type:'sandbox_ready' }, '*');
})();
<\/script>
</body>
</html>`;

  /* ── إنشاء iframe sandbox ── */
  function _createIframe() {
    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts';
    iframe.style.cssText = 'width:100%;height:200px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;background:#0d1117;';
    iframe.srcdoc = SANDBOX_HTML;
    return iframe;
  }

  /* ── تشغيل JavaScript في iframe ── */
  function _runInIframe(iframe, code) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('انتهت مهلة التشغيل (5 ثوانٍ)'));
      }, 5000);

      const logs   = [];
      const errors = [];

      const handler = (event) => {
        if (event.source !== iframe.contentWindow) return;
        const { type, text, cls, msg } = event.data;

        if (type === 'sandbox_ready') {
          try {
            iframe.contentWindow.eval(code);
          } catch (e) {
            errors.push(e.message);
          }
        }

        if (type === 'sandbox_log')   logs.push({ level: cls, text });
        if (type === 'sandbox_error') errors.push(msg);
      };

      window.addEventListener('message', handler);

      setTimeout(() => {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        resolve({ logs, errors, success: errors.length === 0 });
      }, 2000);
    });
  }

  /* ── حالة Sandbox ── */
  let _iframe    = null;
  let _container = null;

  return {

    /* ═══════════════════════════════════════
       تهيئة بيئة التشغيل
       ═══════════════════════════════════════ */
    init(containerId) {
      _container = document.getElementById(containerId);
      if (!_container) {
        Logger.warn('SANDBOX', `الحاوية غير موجودة: ${containerId}`);
        return false;
      }
      Logger.info('SANDBOX', 'بيئة التشغيل الآمنة جاهزة');
      return true;
    },

    /* ═══════════════════════════════════════
       تشغيل JavaScript
       ═══════════════════════════════════════ */
    async runJS(code, opts = {}) {
      Logger.info('SANDBOX', `تشغيل JS (${code.length} حرف)`);
      const t = Logger.time('sandbox:runJS');

      /* فحص أمني */
      const scan = Security.scanCode(code);
      if (!scan.safe && scan.riskLevel === 'HIGH') {
        Logger.warn('SANDBOX', 'كود خطير — مرفوض', scan.findings);
        return {
          success: false,
          blocked: true,
          reason:  'الكود يحتوي على أنماط خطيرة',
          findings: scan.findings
        };
      }

      try {
        /* إنشاء iframe مؤقت */
        const iframe = _createIframe();
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const result = await _runInIframe(iframe, code);
        document.body.removeChild(iframe);

        t.end();
        Logger.info('SANDBOX', `نتيجة JS: ${result.success ? '✅' : '❌'} — ${result.logs.length} رسالة`);
        return result;

      } catch (err) {
        t.end();
        Logger.error('SANDBOX', `خطأ sandbox: ${err.message}`);
        return { success: false, error: err.message, logs: [], errors: [err.message] };
      }
    },

    /* ═══════════════════════════════════════
       تشغيل HTML مع معاينة
       ═══════════════════════════════════════ */
    async previewHTML(html, opts = {}) {
      Logger.info('SANDBOX', `معاينة HTML (${html.length} حرف)`);

      const { width = '100%', height = '400px', container = null } = opts;
      const target = container || _container;

      if (!target) {
        Logger.warn('SANDBOX', 'لا توجد حاوية للمعاينة');
        return { success: false, error: 'حاوية المعاينة غير متوفرة' };
      }

      const iframe = document.createElement('iframe');
      iframe.sandbox = 'allow-scripts allow-same-origin';
      iframe.style.cssText = `width:${width};height:${height};border:none;border-radius:8px;background:#fff;`;
      iframe.srcdoc = html;

      target.innerHTML = '';
      target.appendChild(iframe);

      return { success: true, element: iframe };
    },

    /* ═══════════════════════════════════════
       تشغيل كود عبر Wandbox (للغات الأخرى)
       ═══════════════════════════════════════ */
    async runExternal(code, language) {
      Logger.info('SANDBOX', `تشغيل ${language} عبر Wandbox`);
      const t = Logger.time(`sandbox:${language}`);

      const scan = Security.scanCode(code);
      if (!scan.safe && scan.riskLevel === 'HIGH') {
        return { success: false, blocked: true, reason: 'الكود يحتوي على أنماط خطيرة' };
      }

      /* استخدام executeCode الموجود */
      if (typeof executeCode === 'function') {
        try {
          const result = await executeCode(code, language);
          t.end();
          return { success: true, ...result };
        } catch (err) {
          t.end();
          Logger.error('SANDBOX', `فشل Wandbox: ${err.message}`);
          return { success: false, error: err.message };
        }
      }

      t.end();
      return { success: false, error: 'بيئة التشغيل الخارجية غير متاحة' };
    },

    /* ═══════════════════════════════════════
       الاختبار التلقائي للمشروع
       ═══════════════════════════════════════ */
    async autoTest(projectFiles) {
      Logger.info('SANDBOX', `اختبار تلقائي — ${Object.keys(projectFiles).length} ملف`);
      const g = Logger.group('auto-test');
      const results = [];

      for (const [filename, content] of Object.entries(projectFiles)) {
        const ext = filename.split('.').pop().toLowerCase();

        if (ext === 'js' || ext === 'ts') {
          /* فحص صياغي سريع */
          const check = await this._syntaxCheck(content, ext);
          results.push({ file: filename, type: 'syntax', ...check });
        }

        if (ext === 'html') {
          /* فحص HTML */
          const check = this._htmlCheck(content);
          results.push({ file: filename, type: 'html', ...check });
        }

        if (ext === 'json') {
          /* فحص JSON */
          const check = this._jsonCheck(content);
          results.push({ file: filename, type: 'json', ...check });
        }
      }

      g.end();

      const passed = results.filter(r => r.passed).length;
      const failed = results.filter(r => !r.passed).length;

      Logger.info('SANDBOX', `اختبار مكتمل: ${passed} نجح، ${failed} فشل`);
      return { results, passed, failed, total: results.length };
    },

    async _syntaxCheck(code, ext) {
      try {
        /* محاولة تفسير الكود */
        new Function(code);
        return { passed: true };
      } catch (err) {
        const match = err.message.match(/line (\d+)/i);
        return {
          passed: false,
          error:  err.message,
          line:   match ? parseInt(match[1]) : null
        };
      }
    },

    _htmlCheck(html) {
      const issues = [];

      /* فحص العلامات غير المغلقة */
      const openTags  = (html.match(/<[a-z]+[^/]*?>/gi)  || []).length;
      const closeTags = (html.match(/<\/[a-z]+>/gi) || []).length;
      const selfClose = (html.match(/<[^>]+\/>/gi) || []).length;

      if (Math.abs(openTags - closeTags - selfClose) > 2) {
        issues.push(`علامات غير متوازنة (مفتوحة: ${openTags}, مغلقة: ${closeTags})`);
      }

      /* DOCTYPE */
      if (!html.includes('<!DOCTYPE') && !html.includes('<!doctype')) {
        issues.push('DOCTYPE مفقود');
      }

      return { passed: issues.length === 0, issues };
    },

    _jsonCheck(json) {
      try {
        JSON.parse(json);
        return { passed: true };
      } catch (err) {
        return { passed: false, error: err.message };
      }
    },

    /* ═══════════════════════════════════════
       عرض نتائج الاختبار
       ═══════════════════════════════════════ */
    renderTestResults(results, container) {
      if (!container) return;

      const html = `
        <div style="font-size:12px;font-family:monospace">
          <div style="font-weight:700;color:#fca5a5;margin-bottom:8px">🧪 نتائج الاختبار التلقائي</div>
          ${results.results.map(r => `
            <div style="
              display:flex;align-items:center;gap:8px;padding:3px 0;
              border-bottom:1px solid rgba(255,255,255,0.04);
            ">
              <span>${r.passed ? '✅' : '❌'}</span>
              <span style="color:#94a3b8;flex:1">${r.file}</span>
              <span style="color:#475569;font-size:10px">${r.type}</span>
              ${!r.passed ? `<span style="color:#f87171;font-size:10px">${(r.error || r.issues?.[0] || '').slice(0,40)}</span>` : ''}
            </div>
          `).join('')}
          <div style="margin-top:8px;color:#4ade80">
            ✅ ${results.passed}/${results.total} اجتاز
          </div>
        </div>
      `;

      container.innerHTML = html;
    }
  };
})();

Logger.info('SYSTEM', '✅ بيئة التشغيل الآمنة جاهزة');
