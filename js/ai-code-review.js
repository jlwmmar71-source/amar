/* ══════════════════════════════════════════════════════════════
   ai-code-review.js — مراجعة الكود بالذكاء الاصطناعي (AI Code Review)
   أمان + جودة + أداء + أنماط Async + منطق + اقتراحات تحديث
   Galaoum AI Engine v5.0 — نسخة محسّنة (42 قاعدة)
   ══════════════════════════════════════════════════════════════ */

window.AICodeReview = (function () {

  /* ══ 42 قاعدة مراجعة ══ */
  const RULES = [
    /* ── أمان: حرج ── */
    { id: 'hardcoded_secret',  cat:'security', re: /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/i,
      label: 'مفتاح/سر مكتوب مباشرة في الكود', severity: 'critical' },
    { id: 'eval_usage',        cat:'security', re: /\beval\s*\(/,
      label: 'استخدام eval() — خطر أمني بالغ', severity: 'critical' },
    { id: 'inner_html_concat', cat:'security', re: /innerHTML\s*[+]?=\s*[^;]*\+/,
      label: 'دمج innerHTML مع نص ديناميكي — ثغرة XSS محتملة', severity: 'high' },
    { id: 'document_write',    cat:'security', re: /document\.write\s*\(/,
      label: 'document.write() يُعطّل المحلل ويشكّل خطراً أمنياً', severity: 'high' },
    { id: 'prototype_pollution', cat:'security', re: /__proto__\s*\[|constructor\s*\[|prototype\s*\[/,
      label: 'تلوّث النموذج الأولي المحتمل (Prototype Pollution)', severity: 'critical' },
    { id: 'sql_injection',     cat:'security', re: /["'`]\s*\+\s*\w+\s*\+\s*["'`].*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/i,
      label: 'دمج نص مع SQL — خطر حقن SQL', severity: 'critical' },
    { id: 'open_redirect',     cat:'security', re: /window\.location\s*=\s*(?!['"]\/)/,
      label: 'إعادة توجيه مفتوحة — قد يُستغل في هجمات Phishing', severity: 'high' },

    /* ── أمان: متوسط ── */
    { id: 'http_not_https',    cat:'security', re: /["']http:\/\/(?!localhost)/,
      label: 'استخدام HTTP بدل HTTPS — بيانات غير مشفّرة', severity: 'medium' },
    { id: 'local_storage_secret', cat:'security', re: /localStorage\.setItem\s*\(\s*['"][^'"]*(?:token|key|secret|pass)[^'"]*['"]/i,
      label: 'حفظ بيانات حساسة في localStorage', severity: 'medium' },
    { id: 'cors_wildcard',     cat:'security', re: /Access-Control-Allow-Origin['":\s]+\*/,
      label: 'CORS مفتوح للجميع (*) — قيّد النطاقات المسموحة', severity: 'medium' },

    /* ── جودة الكود: متوسط ── */
    { id: 'empty_catch',       cat:'quality', re: /catch\s*\([^)]*\)\s*\{\s*\}/,
      label: 'كتلة catch فارغة تُخفي الأخطاء — أضف معالجة', severity: 'medium' },
    { id: 'console_log',       cat:'quality', re: /console\.log\s*\(/,
      label: 'console.log في الكود — احذفه من الإنتاج', severity: 'low' },
    { id: 'loose_equality',    cat:'quality', re: /[^=!<>]==[^=]/,
      label: 'استخدام == بدل === قد يسبب أخطاء منطقية', severity: 'low' },
    { id: 'var_usage',         cat:'quality', re: /\bvar\s+\w+/,
      label: 'استخدام var — يُفضَّل let/const', severity: 'low' },
    { id: 'todo',              cat:'quality', re: /\b(TODO|FIXME|HACK|XXX)\b/i,
      label: 'ملاحظة عمل غير منجزة', severity: 'info' },
    { id: 'commented_code',    cat:'quality', re: /\/\/\s*(const|let|var|function|return|if)\s+/,
      label: 'كود مُعلَّق — احذفه أو استعده', severity: 'info' },
    { id: 'magic_number',      cat:'quality', re: /(?<!['"*])\b(?!0\b|1\b|2\b|10\b|100\b)\d{3,}\b(?!['"*])/,
      label: 'رقم سحري بدون تعريف — استخدم ثابتاً مُسمّىً', severity: 'info' },
    { id: 'negated_condition', cat:'quality', re: /if\s*\(\s*![\w.]+\s*\)\s*\{[\s\S]{1,200}\}\s*else/,
      label: 'شرط منفي قبل else — اعكس الشرط لتحسين القراءة', severity: 'info' },
    { id: 'deep_callback',     cat:'quality', re: /function[^{]*\{[^}]*function[^{]*\{[^}]*function[^{]*\{/,
      label: 'Callback Hell — استبدل بـ async/await أو Promise chain', severity: 'medium' },
    { id: 'switch_no_default', cat:'quality', re: /switch\s*\([^)]+\)\s*\{(?![\s\S]*\bdefault\b)/,
      label: 'switch بدون default — أضف حالة افتراضية', severity: 'low' },
    { id: 'return_in_finally', cat:'quality', re: /finally\s*\{[^}]*\breturn\b/,
      label: 'return داخل finally يُلغي النتيجة الأصلية', severity: 'medium' },
    { id: 'typeof_nan',        cat:'quality', re: /typeof\s+NaN|NaN\s*==|==\s*NaN/,
      label: 'مقارنة NaN مباشرة — استخدم isNaN()', severity: 'low' },

    /* ── أداء ── */
    { id: 'sync_xhr',          cat:'perf', re: /new\s+XMLHttpRequest[\s\S]{0,100}\.open\s*\([^,]+,[^,]+,\s*false/,
      label: 'طلب XHR متزامن — يجمّد المتصفح', severity: 'high' },
    { id: 'settimeout_0',      cat:'perf', re: /setTimeout\s*\([^,]+,\s*0\s*\)/,
      label: 'setTimeout(fn, 0) — استخدم queueMicrotask() أو Promise.resolve()', severity: 'info' },
    { id: 'forced_reflow',     cat:'perf', re: /\b(offsetWidth|offsetHeight|scrollTop|clientWidth|getBoundingClientRect)\b/,
      label: 'قراءة layout properties قد تُسبّب reflow — جمّعها معاً', severity: 'info' },
    { id: 'no_memoize',        cat:'perf', re: /function\s+\w+[^{]*\{[\s\S]{500,}/,
      label: 'دالة طويلة — فكّر في حفظ النتائج (Memoization)', severity: 'info' },
    { id: 'array_in_loop',     cat:'perf', re: /for\s*\([^)]+\)\s*\{[^}]*\.push\(/,
      label: 'push داخل حلقة — فكّر في map/filter/reduce', severity: 'info' },
    { id: 'dom_in_loop',       cat:'perf', re: /for\s*[\s\S]{0,200}document\.(get|query)/,
      label: 'استعلام DOM داخل حلقة — خزّن النتيجة خارجاً', severity: 'medium' },
    { id: 'string_concat_loop',cat:'perf', re: /for[\s\S]{0,100}\w+\s*\+=\s*['"]/,
      label: 'دمج نصوص داخل حلقة — استخدم Array.join()', severity: 'low' },

    /* ── أنماط async ── */
    { id: 'promise_then_then', cat:'async', re: /\.then\([^)]*\)\s*\.then\([^)]*\)\s*\.then/,
      label: 'سلسلة then طويلة — استبدل بـ async/await', severity: 'low' },
    { id: 'async_in_foreach',  cat:'async', re: /\.forEach\s*\(\s*async/,
      label: 'async في forEach — استخدم for..of أو Promise.all()', severity: 'medium' },
    { id: 'await_in_loop',     cat:'async', re: /for\s*(?:await\s*)?\([^)]+\)\s*\{[^}]*\bawait\b/,
      label: 'await متسلسل داخل حلقة — استخدم Promise.all() للتوازي', severity: 'medium' },
    { id: 'unhandled_promise', cat:'async', re: /(?:^|[^=.!])\bfetch\s*\((?![\s\S]*?\.catch)/m,
      label: 'fetch بدون .catch() — أضف معالجة للأخطاء', severity: 'medium' },
    { id: 'promise_all_reject', cat:'async', re: /Promise\.all\s*\(/,
      label: 'Promise.all تُفشل كلها عند فشل واحدة — فكّر في Promise.allSettled()', severity: 'info' },

    /* ── أنماط حديثة ── */
    { id: 'old_object_assign', cat:'modern', re: /Object\.assign\s*\(\s*\{\}/,
      label: 'Object.assign({}) — استبدل بـ Spread Operator {...obj}', severity: 'info' },
    { id: 'arguments_object',  cat:'modern', re: /\barguments\b(?!\s*\.length\s*===\s*0)/,
      label: 'استخدام arguments — استبدل بـ Rest Parameters (...args)', severity: 'low' },
    { id: 'iife_pattern',      cat:'modern', re: /\(\s*function\s*\([^)]*\)\s*\{[\s\S]{50,}\}\s*\)\s*\(/,
      label: 'IIFE قديم — فكّر في ES Modules أو Scoped Blocks', severity: 'info' },
    { id: 'string_concat_plus',cat:'modern', re: /['"][^'"]*['"]\s*\+\s*\w+\s*\+\s*['"][^'"]*['"]/,
      label: 'دمج نصوص بـ + — استبدل بـ Template Literals (`${}`)', severity: 'info' },
    { id: 'manual_typeof_check', cat:'modern', re: /typeof\s+\w+\s*===\s*['"]undefined['"]/,
      label: 'يمكن الاستعاضة بـ Optional Chaining (?.) في معظم الحالات', severity: 'info' },

    /* ── إمكانية الوصول / الشبكة ── */
    { id: 'img_no_alt',        cat:'a11y', re: /<img(?![^>]*alt\s*=)[^>]*>/i,
      label: 'صورة بدون نص بديل alt — مشكلة إمكانية وصول', severity: 'medium' },
    { id: 'button_no_type',    cat:'a11y', re: /<button(?![^>]*type\s*=)[^>]*>/i,
      label: 'زر بدون type — قد يُسبّب submit غير مقصود', severity: 'low' }
  ];

  /* ══════════════════════════════════════════════
     1. مراجعة ملف منفرد
     ══════════════════════════════════════════════ */
  function reviewFile(path, content) {
    if (!content) return [];
    const findings = [];
    const lines    = content.split('\n');

    for (const rule of RULES) {
      for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        /* تخطّي الأسطر التعليقية (تقريباً) */
        if (/^\s*\/\//.test(line) && !['todo','commented_code'].includes(rule.id)) continue;
        if (rule.re.test(line)) {
          findings.push({
            rule: rule.id, category: rule.cat,
            label: rule.label, severity: rule.severity,
            line: idx + 1, path,
            snippet: line.trim().substring(0, 80)
          });
        }
      }
      /* فحص متعدد الأسطر لبعض القواعد */
      if (['deep_callback','switch_no_default','return_in_finally','async_in_foreach','await_in_loop','unhandled_promise'].includes(rule.id)) {
        if (rule.re.test(content)) {
          const exists = findings.some(f => f.rule === rule.id && f.path === path);
          if (!exists) {
            findings.push({ rule: rule.id, category: rule.cat, label: rule.label, severity: rule.severity, line: 0, path, snippet: '(متعدد الأسطر)' });
          }
        }
      }
    }
    return findings;
  }

  /* ══════════════════════════════════════════════
     2. مراجعة مشروع كامل
     ══════════════════════════════════════════════ */
  function reviewProject(files) {
    const all     = files.flatMap(f => reviewFile(f.path, f.content || ''));
    const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const byCategory = {};

    for (const f of all) {
      summary[f.severity] = (summary[f.severity] || 0) + 1;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    }

    const score  = Math.max(0, 100 - summary.critical * 20 - summary.high * 10 - summary.medium * 3 - summary.low);
    const passed = summary.critical === 0 && summary.high === 0;
    const grade  = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

    return { findings: all, summary, byCategory, score, grade, passed, totalRules: RULES.length };
  }

  /* ══════════════════════════════════════════════
     3. تقرير HTML قابل للعرض
     ══════════════════════════════════════════════ */
  function buildReport(reviewResult) {
    const { findings, summary, score, grade } = reviewResult;
    const sevColor = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#60a5fa', info: '#94a3b8' };
    const top = findings.filter(f => ['critical','high'].includes(f.severity)).slice(0, 20);

    return `
      <div style="font-family:inherit">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <div style="font-size:36px;font-weight:900;color:${score>=75?'#4ade80':score>=50?'#eab308':'#ef4444'}">${grade}</div>
          <div>
            <div style="font-size:16px;font-weight:700;color:#e2e8f0">نتيجة المراجعة: ${score}/100</div>
            <div style="font-size:12px;color:#64748b">${findings.length} ملاحظة في ${RULES.length} قاعدة</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          ${Object.entries(summary).map(([sev, cnt]) => cnt > 0 ? `
            <div style="padding:4px 10px;border-radius:999px;background:${sevColor[sev]}22;border:1px solid ${sevColor[sev]}44;font-size:11px;color:${sevColor[sev]};font-weight:600">
              ${_sevLabel(sev)}: ${cnt}
            </div>` : '').join('')}
        </div>
        ${top.length === 0 ? `<div style="color:#4ade80;font-size:13px">✅ لا توجد مشاكل حرجة أو عالية!</div>` : `
          <div style="font-size:11px;color:#475569;margin-bottom:8px">أهم المشاكل:</div>
          ${top.map(f => `
            <div style="padding:8px 10px;border-radius:8px;background:rgba(0,0,0,0.25);border-right:3px solid ${sevColor[f.severity]};margin-bottom:6px">
              <div style="font-size:12px;color:#e2e8f0;font-weight:600">${f.label}</div>
              <div style="font-size:10px;color:#475569;margin-top:2px">${f.path}${f.line ? ':' + f.line : ''} ${f.snippet ? '— <code style="color:#94a3b8">' + f.snippet + '</code>' : ''}</div>
            </div>`).join('')}
        `}
      </div>`;
  }

  /* ══════════════════════════════════════════════
     4. لوحة UI
     ══════════════════════════════════════════════ */
  let _lastResult = null;

  function openPanel(files) {
    let panel = document.getElementById('ai-review-panel');
    if (!panel) { panel = _createPanel(); document.body.appendChild(panel); }
    panel.style.display = 'flex';
    if (files) runReview(files);
  }

  function closePanel() {
    const el = document.getElementById('ai-review-panel');
    if (el) el.style.display = 'none';
  }

  function runReview(files) {
    const result = reviewProject(files);
    _lastResult  = result;
    const body   = document.getElementById('ai-review-body');
    if (body) body.innerHTML = buildReport(result);
    return result;
  }

  function _createPanel() {
    const el = document.createElement('div');
    el.id = 'ai-review-panel';
    el.className = 'g-panel';
    el.onclick = e => { if (e.target === el) closePanel(); };
    el.innerHTML = `
      <div class="g-panel-box" style="max-width:720px">
        <div class="g-panel-header">
          <div class="g-panel-title">🔍 مراجعة الكود الذكية</div>
          <button class="g-panel-close" onclick="AICodeReview.closePanel()">✕</button>
        </div>
        <div class="g-panel-body">
          <div id="ai-review-body" style="min-height:80px;color:#475569">
            ارفع مشروع ZIP لتبدأ المراجعة التلقائية
          </div>
          <div style="margin-top:12px;font-size:10px;color:#334155">
            ${RULES.length} قاعدة مراجعة: أمان · جودة · أداء · async · أنماط حديثة · إمكانية وصول
          </div>
        </div>
      </div>`;
    return el;
  }

  /* ── مساعدات ── */
  function _sevLabel(s) {
    return { critical:'حرج', high:'عالٍ', medium:'متوسط', low:'منخفض', info:'معلومة' }[s] || s;
  }

  /* ══ ربط تلقائي مع رفع ZIP ══ */
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const fi = document.getElementById('file-input');
      if (fi) fi.addEventListener('change', async (e) => {
        const zipFile = Array.from(e.target.files || []).find(f => f.name.endsWith('.zip'));
        if (!zipFile || typeof JSZip === 'undefined') return;
        try {
          const zip   = await new JSZip().loadAsync(zipFile);
          const files = [];
          for (const [name, entry] of Object.entries(zip.files)) {
            if (entry.dir || !/\.(js|ts|html|css|jsx|tsx)$/.test(name)) continue;
            const content = await entry.async('string').catch(() => '');
            if (content) files.push({ path: name, content });
          }
          if (files.length > 0) {
            const result = reviewProject(files);
            _lastResult  = result;
            if (typeof Toast !== 'undefined') {
              const msg = result.passed
                ? `✅ مراجعة الكود: ${result.grade} (${result.score}/100) — لا مشاكل حرجة`
                : `⚠️ مراجعة الكود: ${result.grade} — ${result.summary.critical} حرج، ${result.summary.high} عالٍ`;
              Toast.warn(msg, 7000);
            }
            if (typeof Logger !== 'undefined') Logger.info('REVIEW', `🔍 مراجعة: ${result.findings.length} ملاحظة، درجة ${result.score}/100`);
          }
        } catch {}
      }, true);
    });
  }

  return { reviewFile, reviewProject, buildReport, openPanel, closePanel, runReview, getLastResult: () => _lastResult, getRules: () => RULES };

})();
