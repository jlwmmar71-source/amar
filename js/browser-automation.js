/* ══════════════════════════════════════════════
   browser-automation.js — المتصفح الذكي
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

window.BrowserAutomation = (function () {

  let _iframe   = null;
  let _reports  = [];
  let _errors   = [];
  let _running  = false;

  /* ── تحميل الموقع في iframe داخلي ── */
  function load(url) {
    _iframe = document.getElementById('ba-iframe');
    if (!_iframe) {
      _iframe = document.createElement('iframe');
      _iframe.id = 'ba-iframe';
      _iframe.style.display = 'none';
      _iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
      document.body.appendChild(_iframe);
    }
    _errors = [];
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout: تعذّر تحميل الصفحة')), 15000);
      _iframe.onload = () => { clearTimeout(timeout); resolve(true); };
      _iframe.onerror = () => { clearTimeout(timeout); reject(new Error('فشل تحميل الـ iframe')); };
      _iframe.src = url;
    });
  }

  /* ── تشغيل اختبار كامل ── */
  async function runTest(url, opts) {
    if (_running) throw new Error('اختبار جارٍ بالفعل');
    _running = true;
    _errors  = [];
    const report = {
      url,
      started:   new Date().toISOString(),
      steps:     [],
      errors:    [],
      screenshots: [],
      score:     0
    };

    _log('بدء الاختبار التلقائي', 'info');

    try {
      /* 1. تحميل الصفحة */
      report.steps.push(await _step('تحميل الصفحة', async () => {
        try {
          await load(url);
          await _wait(1000);
          return { ok: true, msg: 'تم التحميل' };
        } catch (e) {
          /* HTML مباشر */
          if (url.startsWith('<!DOCTYPE') || url.startsWith('<html')) {
            await loadHTML(url);
            return { ok: true, msg: 'HTML مباشر' };
          }
          throw e;
        }
      }));

      /* 2. فحص العناصر */
      report.steps.push(await _step('فحص العناصر الرئيسية', async () => {
        const counts = _getElementCounts();
        return { ok: true, msg: `أزرار: ${counts.buttons}، روابط: ${counts.links}، نماذج: ${counts.forms}`, data: counts };
      }));

      /* 3. فحص الروابط */
      if (opts?.checkLinks !== false) {
        report.steps.push(await _step('فحص الروابط', async () => {
          const result = await _checkLinks();
          return { ok: result.broken === 0, msg: `${result.total} رابط، ${result.broken} معطوب`, data: result };
        }));
      }

      /* 4. ضغط الأزرار */
      report.steps.push(await _step('اختبار الأزرار', async () => {
        const result = _testButtons();
        return { ok: true, msg: `اختُبر ${result.tested} زر`, data: result };
      }));

      /* 5. اختبار النماذج */
      report.steps.push(await _step('اختبار النماذج', async () => {
        const result = _testForms();
        return { ok: true, msg: `فحص ${result.forms} نموذج`, data: result };
      }));

      /* 6. اختبار القوائم ── */
      report.steps.push(await _step('اختبار القوائم والتنقل', async () => {
        const result = _testNavigation();
        return { ok: true, msg: `${result.navItems} عنصر تنقل`, data: result };
      }));

      /* 7. التقاط لقطة شاشة ── */
      report.steps.push(await _step('التقاط لقطة شاشة', async () => {
        const shot = await _screenshot();
        if (shot) {
          report.screenshots.push(shot);
          if (typeof ArtifactManager !== 'undefined') ArtifactManager.saveScreenshot(shot, `screenshot-${Date.now()}.png`);
          return { ok: true, msg: 'تم التقاط لقطة الشاشة' };
        }
        return { ok: false, msg: 'html2canvas غير متاح' };
      }));

      /* 8. فحص أخطاء JavaScript ── */
      report.steps.push(await _step('فحص أخطاء JavaScript', async () => {
        return { ok: _errors.length === 0, msg: `${_errors.length} خطأ`, data: { errors: _errors } };
      }));

    } finally {
      _running = false;
    }

    /* احتساب الدرجة */
    const passed = report.steps.filter(s => s.ok).length;
    report.score = Math.round((passed / report.steps.length) * 100);
    report.finished = new Date().toISOString();
    report.errors   = _errors;
    report.summary  = _buildSummary(report);

    _reports.unshift(report);
    if (_reports.length > 10) _reports.pop();

    /* حفظ التقرير */
    if (typeof ArtifactManager !== 'undefined') {
      ArtifactManager.saveReport(_buildMarkdown(report), `automation-report-${Date.now()}.md`);
    }

    if (typeof Logger !== 'undefined') Logger.info('BROWSER', `✅ اختبار مكتمل — درجة: ${report.score}%`);
    if (typeof Toast  !== 'undefined') Toast.success(`اختبار مكتمل: ${report.score}%`);

    _renderReport(report);
    return report;
  }

  /* ── تحميل HTML مباشرة ── */
  function loadHTML(html) {
    _iframe = document.getElementById('ba-iframe');
    if (!_iframe) return;
    _iframe.srcdoc = html;
    return _wait(1000);
  }

  /* ── مساعدات الفحص ── */
  function _getElementCounts() {
    try {
      const doc = _iframe?.contentDocument;
      if (!doc) return { buttons: 0, links: 0, forms: 0, images: 0, inputs: 0 };
      return {
        buttons: doc.querySelectorAll('button,[role=button]').length,
        links:   doc.querySelectorAll('a[href]').length,
        forms:   doc.querySelectorAll('form').length,
        images:  doc.querySelectorAll('img').length,
        inputs:  doc.querySelectorAll('input,textarea,select').length
      };
    } catch { return { buttons: 0, links: 0, forms: 0, images: 0, inputs: 0 }; }
  }

  async function _checkLinks() {
    const doc = _iframe?.contentDocument;
    if (!doc) return { total: 0, broken: 0 };
    const links = [...doc.querySelectorAll('a[href]')].slice(0, 10);
    let broken = 0;
    for (const link of links) {
      const href = link.href;
      if (!href || href.startsWith('javascript:') || href.startsWith('#')) continue;
      try {
        const r = await fetch(href, { method: 'HEAD', mode: 'no-cors' });
        if (r.type !== 'opaque' && !r.ok) broken++;
      } catch { /* no-cors expected */ }
    }
    return { total: links.length, broken };
  }

  function _testButtons() {
    try {
      const doc = _iframe?.contentDocument;
      if (!doc) return { tested: 0 };
      const btns = [...doc.querySelectorAll('button')].slice(0, 5);
      let tested = 0;
      btns.forEach(btn => {
        try { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); tested++; } catch {}
      });
      return { tested };
    } catch { return { tested: 0 }; }
  }

  function _testForms() {
    try {
      const doc = _iframe?.contentDocument;
      if (!doc) return { forms: 0 };
      const forms = doc.querySelectorAll('form');
      let valid = 0;
      forms.forEach(f => {
        const inputs = f.querySelectorAll('input:not([type=submit])');
        inputs.forEach(inp => {
          if (inp.type === 'email') inp.value = 'test@example.com';
          else if (inp.type === 'text') inp.value = 'اختبار';
          else if (inp.type === 'number') inp.value = '42';
        });
        valid++;
      });
      return { forms: forms.length, filledForms: valid };
    } catch { return { forms: 0 }; }
  }

  function _testNavigation() {
    try {
      const doc = _iframe?.contentDocument;
      if (!doc) return { navItems: 0 };
      const navs = doc.querySelectorAll('nav a, [role=navigation] a, .nav a, .menu a, .navbar a');
      navs.forEach(n => { try { n.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); } catch {} });
      return { navItems: navs.length };
    } catch { return { navItems: 0 }; }
  }

  /* ── لقطة شاشة ── */
  async function _screenshot() {
    if (typeof html2canvas === 'undefined') {
      /* تحميل html2canvas */
      await new Promise(resolve => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = resolve; s.onerror = resolve;
        document.head.appendChild(s);
      });
    }
    try {
      const canvas = await html2canvas(_iframe?.contentDocument?.body || document.body, { scale: 0.5, useCORS: true });
      return canvas.toDataURL('image/png');
    } catch { return null; }
  }

  /* ── خطوة مع معالجة الأخطاء ── */
  async function _step(name, fn) {
    _log(`▶ ${name}`, 'info');
    const start = Date.now();
    try {
      const result = await fn();
      const ms = Date.now() - start;
      _log(`✅ ${name} — ${result.msg} (${ms}ms)`, 'success');
      return { name, ok: result.ok !== false, msg: result.msg, ms, data: result.data };
    } catch (e) {
      _log(`❌ ${name}: ${e.message}`, 'error');
      return { name, ok: false, msg: e.message, ms: Date.now() - start };
    }
  }

  function _buildSummary(report) {
    const passed = report.steps.filter(s => s.ok).length;
    return `الدرجة: ${report.score}% | النجاح: ${passed}/${report.steps.length} | الأخطاء: ${report.errors.length}`;
  }

  function _buildMarkdown(report) {
    const steps = report.steps.map(s => `- ${s.ok ? '✅' : '❌'} **${s.name}** — ${s.msg} (${s.ms}ms)`).join('\n');
    return `# تقرير الاختبار التلقائي\n**URL:** ${report.url}\n**الدرجة:** ${report.score}%\n**التاريخ:** ${report.started}\n\n## الخطوات\n${steps}\n\n## الأخطاء\n${report.errors.join('\n') || 'لا توجد'}`;
  }

  function _log(msg, type) {
    const el = document.getElementById('ba-log');
    if (el) {
      const div = document.createElement('div');
      div.className = `ba-log-line ba-log-${type}`;
      div.textContent = msg;
      el.appendChild(div);
      el.scrollTop = el.scrollHeight;
    }
    if (typeof Logger !== 'undefined') Logger.info('BROWSER', msg);
  }

  function _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  function getReports() { return [..._reports]; }

  /* ── واجهة اللوحة ── */
  function openPanel() {
    const p = document.getElementById('browser-panel');
    if (p) p.style.display = 'flex';
  }

  function closePanel() {
    const p = document.getElementById('browser-panel');
    if (p) p.style.display = 'none';
  }

  async function startTestFromUI() {
    const urlEl = document.getElementById('ba-url-input');
    const url   = urlEl?.value?.trim() || window.location.href;
    const logEl = document.getElementById('ba-log');
    if (logEl) logEl.innerHTML = '';
    try { await runTest(url); }
    catch (e) { if (typeof Toast !== 'undefined') Toast.error(e.message); }
  }

  function _renderReport(report) {
    const el = document.getElementById('ba-report');
    if (!el) return;
    const icons = { true:'✅', false:'❌' };
    el.innerHTML = `
      <div style="font-size:22px;font-weight:900;color:${report.score>=70?'#4ade80':'#f87171'}">${report.score}%</div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:8px">${report.summary}</div>
      ${report.steps.map(s=>`<div class="ba-step-row ${s.ok?'ba-ok':'ba-fail'}">${icons[s.ok+'']||'?'} ${s.name}<span style="color:#475569;font-size:9px"> ${s.ms}ms</span></div>`).join('')}
      ${report.screenshots[0] ? `<img src="${report.screenshots[0]}" style="width:100%;border-radius:8px;margin-top:8px;border:1px solid rgba(255,255,255,.1)">` : ''}
    `;
  }

  function init() {
    /* مراقبة أخطاء JavaScript العامة */
    window.addEventListener('error', e => { _errors.push(`JS Error: ${e.message} @ ${e.filename}:${e.lineno}`); });
    if (typeof Logger !== 'undefined') Logger.info('BROWSER', '🌐 Browser Automation جاهز');
  }

  return { init, load, loadHTML, runTest, getReports, openPanel, closePanel, startTestFromUI };

})();
