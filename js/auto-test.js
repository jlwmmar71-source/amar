/* ══════════════════════════════════════════════
   auto-test.js — البناء والاختبار التلقائي
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const AutoTest = (() => {

  /* ── نتائج آخر دورة اختبار ── */
  let _lastResults = null;
  let _isRunning   = false;
  let _listeners   = [];

  function _notify(event, data) {
    _listeners.forEach(fn => { try { fn({ event, data }); } catch {} });
  }

  /* ── فحص JS/TS (صياغي) ── */
  function _checkJS(filename, content) {
    const errors = [];

    try {
      new Function(content);
    } catch (err) {
      const lineMatch = err.message.match(/line (\d+)/i);
      errors.push({
        type: 'syntax',
        message: err.message,
        line: lineMatch ? parseInt(lineMatch[1]) : null
      });
    }

    /* فحص المتغيرات غير المعرّفة شائعة */
    const undeclared = content.match(/\b(?<!var |let |const |function |class )\b([A-Z][A-Za-z]+)\s*(?=\()/g) || [];

    return {
      file:   filename,
      passed: errors.length === 0,
      errors,
      warnings: []
    };
  }

  /* ── فحص HTML ── */
  function _checkHTML(filename, content) {
    const errors   = [];
    const warnings = [];

    if (!/<html/i.test(content))    warnings.push('علامة <html> مفقودة');
    if (!/<head/i.test(content))    warnings.push('علامة <head> مفقودة');
    if (!/<body/i.test(content))    warnings.push('علامة <body> مفقودة');
    if (!/<title/i.test(content))   warnings.push('<title> مفقود');
    if (!/<meta charset/i.test(content)) warnings.push('meta charset مفقود');
    if (!/<meta name="viewport/i.test(content)) warnings.push('meta viewport مفقود');

    /* روابط الصور المكسورة */
    const imgSrcs = content.match(/src="([^"]+)"/g) || [];
    imgSrcs.forEach(src => {
      const url = src.slice(5, -1);
      if (url.startsWith('./') || url.startsWith('../')) {
        warnings.push(`مسار نسبي يجب التحقق منه: ${url}`);
      }
    });

    return { file: filename, passed: errors.length === 0, errors, warnings };
  }

  /* ── فحص CSS ── */
  function _checkCSS(filename, content) {
    const errors   = [];
    const warnings = [];

    /* فحص القواعد غير المغلقة */
    const opens  = (content.match(/{/g) || []).length;
    const closes = (content.match(/}/g) || []).length;
    if (opens !== closes) {
      errors.push({ type: 'syntax', message: `أقواس غير متوازنة: ${opens} { و ${closes} }` });
    }

    return { file: filename, passed: errors.length === 0, errors, warnings };
  }

  /* ── فحص JSON ── */
  function _checkJSON(filename, content) {
    try {
      JSON.parse(content);
      return { file: filename, passed: true, errors: [], warnings: [] };
    } catch (err) {
      return { file: filename, passed: false, errors: [{ type: 'syntax', message: err.message }], warnings: [] };
    }
  }

  /* ── اختبار الروابط في HTML ── */
  async function _testLinks(htmlContent) {
    const results = [];
    const scripts = htmlContent.match(/src="([^"]+)"/g) || [];
    const links   = htmlContent.match(/href="([^"]+)"/g) || [];

    const allLinks = [...scripts, ...links]
      .map(l => l.replace(/^(?:src|href)="/, '').replace(/"$/, ''))
      .filter(l => l.startsWith('http') || l.startsWith('//'));

    for (const url of allLinks.slice(0, 5)) {
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, mode: 'no-cors' });
        results.push({ url, ok: true });
      } catch {
        results.push({ url, ok: false, error: 'فشل الاتصال' });
      }
    }

    return results;
  }

  return {

    onResult(fn) { _listeners.push(fn); },

    /* ═══════════════════════════════════════
       تشغيل الاختبارات على ملفات المشروع
       ═══════════════════════════════════════ */
    async run(filesMap, opts = {}) {
      if (_isRunning) {
        Logger.warn('AUTO-TEST', 'الاختبار يعمل بالفعل');
        return null;
      }

      _isRunning = true;
      const t = Logger.time('auto-test');
      const g = Logger.group('auto-test');

      Logger.info('AUTO-TEST', `بدء الاختبار — ${Object.keys(filesMap).length} ملف`);
      _notify('start', { files: Object.keys(filesMap).length });

      const results = [];

      for (const [filename, content] of Object.entries(filesMap)) {
        const ext = filename.split('.').pop().toLowerCase();
        let check;

        switch (ext) {
          case 'js':
          case 'ts':
          case 'jsx':
          case 'tsx':  check = _checkJS(filename, content);   break;
          case 'html': check = _checkHTML(filename, content); break;
          case 'css':  check = _checkCSS(filename, content);  break;
          case 'json': check = _checkJSON(filename, content); break;
          default:     check = { file: filename, passed: true, errors: [], warnings: [] };
        }

        results.push(check);
        _notify('file_checked', check);

        /* تسجيل الأخطاء */
        check.errors.forEach(err => {
          Logger.error('AUTO-TEST', `${filename}: ${err.message}`);
        });
        check.warnings.forEach(w => {
          Logger.warn('AUTO-TEST', `${filename}: ${w}`);
        });
      }

      /* اختبار الروابط إذا وُجد HTML */
      let linkResults = [];
      if (opts.testLinks) {
        const htmlFile = Object.entries(filesMap).find(([n]) => n.endsWith('.html'));
        if (htmlFile) {
          linkResults = await _testLinks(htmlFile[1]);
        }
      }

      /* تشغيل sandbox اختبار */
      let sandboxResult = null;
      if (opts.runSandbox && Sandbox) {
        sandboxResult = await Sandbox.autoTest(filesMap);
      }

      const elapsed = t.end();
      g.end();

      const passed = results.filter(r => r.passed).length;
      const failed = results.filter(r => !r.passed).length;
      const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
      const totalWarns  = results.reduce((s, r) => s + r.warnings.length, 0);

      const summary = {
        id:           `test_${Date.now()}`,
        ts:           new Date().toISOString(),
        passed,
        failed,
        total:        results.length,
        totalErrors,
        totalWarnings: totalWarns,
        elapsed,
        results,
        linkResults,
        sandboxResult,
        success:      failed === 0
      };

      _lastResults = summary;
      _isRunning = false;

      /* حفظ في الذاكرة */
      Memory.addEdit({
        type:        'auto-test',
        description: `${passed}/${results.length} ملف اجتاز، ${totalErrors} خطأ`,
        passed,
        failed
      });

      _notify('done', summary);
      Logger.info('AUTO-TEST', `✅ مكتمل: ${passed} نجح، ${failed} فشل، ${totalErrors} خطأ`);
      return summary;
    },

    /* ═══════════════════════════════════════
       إصلاح تلقائي للأخطاء البسيطة
       ═══════════════════════════════════════ */
    async autoFix(filesMap) {
      Logger.info('AUTO-TEST', 'محاولة الإصلاح التلقائي');
      const fixed = { ...filesMap };
      const fixes = [];

      for (const [filename, content] of Object.entries(filesMap)) {
        let newContent = content;
        const ext = filename.split('.').pop().toLowerCase();

        if (ext === 'js' || ext === 'ts') {
          /* إزالة الفاصلة المنقوطة الزائدة في الكائنات */
          newContent = newContent.replace(/,(\s*[}\]])/g, '$1');
        }

        if (ext === 'json') {
          /* إصلاح الفاصلة الأخيرة في JSON */
          newContent = newContent
            .replace(/,\s*}/g, '}')
            .replace(/,\s*\]/g, ']');
        }

        if (ext === 'html') {
          /* إضافة DOCTYPE إذا كان مفقوداً */
          if (!/<DOCTYPE/i.test(newContent) && !/<doctype/i.test(newContent)) {
            if (!newContent.trim().startsWith('<!')) {
              newContent = '<!DOCTYPE html>\n' + newContent;
              fixes.push({ file: filename, fix: 'إضافة DOCTYPE' });
            }
          }
        }

        if (newContent !== content) {
          fixed[filename] = newContent;
          fixes.push({ file: filename, fix: 'تصحيح تلقائي' });
        }
      }

      Logger.info('AUTO-TEST', `إصلاح تلقائي: ${fixes.length} تصحيح`);
      return { fixed, fixes };
    },

    /* ═══════════════════════════════════════
       عرض نتائج الاختبار في واجهة
       ═══════════════════════════════════════ */
    renderResults(container) {
      if (!container || !_lastResults) return;
      const r = _lastResults;

      container.innerHTML = `
        <div style="
          background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);
          border-radius:12px;padding:14px;font-size:12px;
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <span style="font-weight:700;color:#fca5a5">🧪 نتائج الاختبار التلقائي</span>
            <span style="font-size:10px;color:#475569">${new Date(r.ts).toLocaleTimeString('ar')}</span>
          </div>

          <div style="display:flex;gap:16px;margin-bottom:12px">
            <div style="text-align:center">
              <div style="font-size:20px;font-weight:800;color:#4ade80">${r.passed}</div>
              <div style="font-size:10px;color:#475569">نجح</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:20px;font-weight:800;color:#f87171">${r.failed}</div>
              <div style="font-size:10px;color:#475569">فشل</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:20px;font-weight:800;color:#fbbf24">${r.totalWarnings}</div>
              <div style="font-size:10px;color:#475569">تحذير</div>
            </div>
          </div>

          ${r.results.map(f => `
            <div style="
              display:flex;align-items:flex-start;gap:6px;padding:4px 0;
              border-bottom:1px solid rgba(255,255,255,0.04);
            ">
              <span>${f.passed ? '✅' : '❌'}</span>
              <div style="flex:1">
                <div style="color:#94a3b8">${f.file}</div>
                ${f.errors.map(e =>
                  `<div style="color:#f87171;font-size:10px;margin-top:2px">↳ ${e.message.slice(0,60)}</div>`
                ).join('')}
                ${f.warnings.map(w =>
                  `<div style="color:#fbbf24;font-size:10px;margin-top:2px">↳ ${w.slice(0,60)}</div>`
                ).join('')}
              </div>
            </div>
          `).join('')}

          <div style="margin-top:8px;font-size:11px;color:#475569">
            ⏱ ${r.elapsed}ms
          </div>
        </div>
      `;
    },

    getLastResults() { return _lastResults; },
    isRunning()      { return _isRunning; }
  };
})();

Logger.info('SYSTEM', '✅ نظام الاختبار التلقائي جاهز');
