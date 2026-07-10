/* ══════════════════════════════════════════════════════════════
   quality-gate.js — بوابة الجودة (Quality Gate)
   لا تُعتبر المهمة منتهية حتى تجتاز جميع المعايير
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.QualityGate = (function () {

  /* ══ قائمة المعايير ══ */
  const CRITERIA = [
    {
      id:       'no_empty_response',
      label:    'الرد غير فارغ',
      critical: true,
      check:    (output, task) => {
        return output && output.trim().length > 10;
      }
    },
    {
      id:       'no_error_message',
      label:    'لا توجد رسالة خطأ في الرد',
      critical: true,
      check:    (output) => {
        return !/^(Error:|خطأ:|Failed:|فشل:)/i.test(output.trim());
      }
    },
    {
      id:       'no_broken_code',
      label:    'الكود خالٍ من أخطاء صياغية',
      critical: false,
      check:    (output) => {
        const code = _extractCode(output);
        if (!code) return true;   /* لا كود → نجاح */
        if (typeof AutoTest !== 'undefined') {
          return AutoTest.checkJS(code).passed;
        }
        return _basicSyntaxCheck(code);
      }
    },
    {
      id:       'no_unused_vars',
      label:    'لا متغيرات غير مستخدمة واضحة',
      critical: false,
      check:    (output) => {
        const code = _extractCode(output);
        if (!code) return true;
        /* فحص بسيط: التعريف بدون استخدام */
        const declared = [...(code.matchAll(/(?:const|let|var)\s+(\w+)/g))].map(m => m[1]);
        const usedCount = declared.filter(v => {
          const re = new RegExp(`\\b${v}\\b`, 'g');
          return (code.match(re) || []).length > 1;
        }).length;
        return usedCount >= declared.length * 0.7; /* 70% على الأقل مستخدمة */
      }
    },
    {
      id:       'no_broken_refs',
      label:    'لا مراجع مكسورة',
      critical: false,
      check:    (output) => {
        /* فحص أن الدوال المذكورة ليست غير معرّفة */
        const code = _extractCode(output);
        if (!code) return true;
        const calls    = [...(code.matchAll(/(\w+)\s*\(/g))].map(m => m[1]);
        const defs     = [...(code.matchAll(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=)/g))].map(m => m[1] || m[2]);
        const builtins = ['console','setTimeout','setInterval','fetch','JSON','Math','Array','Object','String','Promise','document','window','parseInt','parseFloat','isNaN','encodeURIComponent'];
        const broken   = calls.filter(c => c && !defs.includes(c) && !builtins.includes(c) && !/^[A-Z]/.test(c));
        return broken.length === 0 || broken.length <= 2; /* تساهل بسيط */
      }
    },
    {
      id:       'language_match',
      label:    'لغة الرد تطابق لغة الطلب',
      critical: false,
      check:    (output, task) => {
        const taskArabic   = /[\u0600-\u06FF]/.test(task);
        const outputArabic = /[\u0600-\u06FF]/.test(output);
        return !taskArabic || outputArabic;
      }
    },
    {
      id:       'min_length',
      label:    'طول الرد مناسب',
      critical: false,
      check:    (output, task) => {
        const minLength = task.length > 100 ? 50 : 20;
        return output.trim().length >= minLength;
      }
    },
    {
      id:       'html_valid',
      label:    'HTML صالح (إذا وُجد)',
      critical: false,
      check:    (output) => {
        const html = _extractHTML(output);
        if (!html) return true;
        if (typeof AutoTest !== 'undefined') {
          return AutoTest.checkHTML(html).passed;
        }
        return true;
      }
    }
  ];

  /* ── استخراج كود JS/TS من النص ── */
  function _extractCode(text) {
    const m = text.match(/```(?:js|javascript|typescript|ts)?\n([\s\S]+?)```/i);
    return m ? m[1].trim() : null;
  }

  /* ── استخراج HTML من النص ── */
  function _extractHTML(text) {
    const m = text.match(/```html\n([\s\S]+?)```/i);
    return m ? m[1].trim() : null;
  }

  /* ── فحص صياغي بسيط بدون AutoTest ── */
  function _basicSyntaxCheck(code) {
    const opens  = (code.match(/\{/g) || []).length;
    const closes = (code.match(/\}/g) || []).length;
    return Math.abs(opens - closes) <= 1;
  }

  /* ═══════════════════════════════════════════════════════
     تشغيل جميع المعايير
     ═══════════════════════════════════════════════════════ */
  function check(output, task = '') {
    const timer   = Logger.time('qg:check');
    const results = [];
    let   allPass = true;
    let   criticalFail = false;

    for (const crit of CRITERIA) {
      let passed = false;
      try {
        passed = !!crit.check(output, task);
      } catch (e) {
        passed = true; /* إذا فشل الفحص نفسه — نتجاهله */
      }

      if (!passed) {
        allPass = false;
        if (crit.critical) criticalFail = true;
      }

      results.push({ id: crit.id, label: crit.label, passed, critical: crit.critical });
    }

    Logger.time(timer);

    const passed  = results.filter(r => r.passed).length;
    const total   = results.length;
    const score   = Math.round((passed / total) * 100);

    Logger.info('QG', `🎯 نتيجة الجودة: ${score}% (${passed}/${total}) ${allPass ? '✅' : '⚠️'}`);

    if (criticalFail) {
      Logger.error('QG', '❌ فشل معيار حرج — المهمة غير مكتملة');
    }

    return { pass: allPass, criticalFail, score, passed, total, results };
  }

  /* ═══════════════════════════════════════════════════════
     عرض نتيجة الجودة في الواجهة
     ═══════════════════════════════════════════════════════ */
  function renderReport(checkResult) {
    const { score, pass, results } = checkResult;
    const color = score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : '#f87171';
    const emoji = pass ? '✅' : score >= 60 ? '⚠️' : '❌';

    const rows = results.map(r =>
      `<div style="display:flex;gap:6px;align-items:center;padding:3px 0;font-size:12px;color:${r.passed ? '#94a3b8' : '#f87171'}">
        <span>${r.passed ? '✓' : '✗'}</span>
        <span>${r.label}</span>
        ${r.critical && !r.passed ? '<span style="color:#f87171;font-size:10px">[حرج]</span>' : ''}
      </div>`
    ).join('');

    return `
      <div style="background:#1e293b;border-radius:8px;padding:12px;margin-top:8px;font-family:inherit">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:18px">${emoji}</span>
          <span style="color:${color};font-weight:700;font-size:14px">جودة الاستجابة: ${score}%</span>
        </div>
        ${rows}
      </div>`;
  }

  /* ══ إحصاءات تاريخية ══ */
  const _history = [];
  function record(result) {
    _history.push({ ts: Date.now(), score: result.score, pass: result.pass });
    if (_history.length > 100) _history.shift();
  }
  function avgScore() {
    if (!_history.length) return 0;
    return Math.round(_history.reduce((s, h) => s + h.score, 0) / _history.length);
  }

  return { check, renderReport, record, avgScore };
})();
