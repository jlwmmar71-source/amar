/* ══════════════════════════════════════════════════════════════
   self-healing.js — محرك الإصلاح الذاتي (Self-Healing Engine)
   يحلل الأخطاء، يقترح الإصلاحات، يطبّقها، ويُعيد الاختبار
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.SelfHealingEngine = (function () {

  const MAX_ATTEMPTS = 3;
  const _healLog = [];         // سجل محاولات الإصلاح

  /* ══ قاعدة معرفة الأخطاء والإصلاحات ══ */
  const ERROR_PATTERNS = [
    /* ── JavaScript ── */
    {
      pattern: /Unexpected token/i,
      category: 'syntax',
      label: 'خطأ في الصياغة',
      icon: '🔤',
      fix: (code) => {
        let fixed = code;
        fixed = fixed.replace(/,\s*}/g, '}');          // فاصلة قبل }
        fixed = fixed.replace(/,\s*\]/g, ']');          // فاصلة قبل ]
        fixed = fixed.replace(/([^=!<>])=([^=])/g, '$1==$2').replace(/====/g, '==='); // == بدل =
        return { fixed, applied: 'إزالة فاصلات زائدة' };
      }
    },
    {
      pattern: /is not defined/i,
      category: 'reference',
      label: 'متغير غير معرّف',
      icon: '❓',
      fix: (code, err) => {
        const varName = err.match(/(\w+) is not defined/)?.[1];
        if (!varName) return null;
        return {
          fixed: `var ${varName};\n${code}`,
          applied: `إضافة تعريف: var ${varName}`
        };
      }
    },
    {
      pattern: /Cannot read propert(?:y|ies) of (null|undefined)/i,
      category: 'null',
      label: 'خطأ في قراءة خاصية Null',
      icon: '⚠️',
      fix: (code) => {
        /* إضافة Optional Chaining */
        const fixed = code.replace(/(\w+)\.(\w+)/g, '$1?.$2');
        return { fixed, applied: 'إضافة Optional Chaining (?.)' };
      }
    },
    {
      pattern: /SyntaxError.*JSON/i,
      category: 'json',
      label: 'خطأ في JSON',
      icon: '📋',
      fix: (code) => {
        try {
          JSON.parse(code);
          return { fixed: code, applied: 'JSON صحيح' };
        } catch {
          /* محاولة إصلاح JSON */
          const fixed = code
            .replace(/,\s*}/g, '}')
            .replace(/,\s*\]/g, ']')
            .replace(/(\w+)\s*:/g, '"$1":')
            .replace(/'([^']*)'/g, '"$1"');
          return { fixed, applied: 'إصلاح JSON: فاصلات زائدة وأقواس' };
        }
      }
    },
    {
      pattern: /DOCTYPE|<!doctype/i,
      category: 'html',
      label: 'HTML ناقص DOCTYPE',
      icon: '📄',
      fix: (code) => {
        if (!/<!DOCTYPE/i.test(code)) {
          return { fixed: '<!DOCTYPE html>\n' + code, applied: 'إضافة DOCTYPE' };
        }
        return null;
      }
    },
    {
      pattern: /Failed to fetch|NetworkError|net::ERR/i,
      category: 'network',
      label: 'خطأ في الشبكة',
      icon: '🌐',
      fix: () => {
        return { fixed: null, applied: 'تجديد محاولة الاتصال', retry: true };
      }
    },
    {
      pattern: /rate.?limit|429|Too Many Requests/i,
      category: 'ratelimit',
      label: 'تجاوز حد الطلبات',
      icon: '⏳',
      fix: () => {
        return { fixed: null, applied: 'انتظار 3 ثوانٍ ثم إعادة المحاولة', delay: 3000 };
      }
    },
    {
      pattern: /quota|limit exceeded|Resource has been exhausted/i,
      category: 'quota',
      label: 'نفاد الحصة',
      icon: '🔄',
      fix: () => {
        /* التبديل للنموذج البديل */
        if (typeof ModelManager !== 'undefined') {
          const fallback = typeof DecisionEngine !== 'undefined'
            ? DecisionEngine.suggestFallback('current')
            : null;
          return { fixed: null, applied: `التبديل للنموذج: ${fallback || 'البديل'}`, switchModel: fallback };
        }
        return { fixed: null, applied: 'يجب تغيير النموذج يدوياً' };
      }
    }
  ];

  /* ═══════════════════════════════════════════════════════
     تحليل الخطأ
     ═══════════════════════════════════════════════════════ */
  function analyze(errorMsg, context = '') {
    const matched = ERROR_PATTERNS.filter(p => p.pattern.test(errorMsg));

    if (matched.length === 0) {
      Logger.warn('HEAL', `⚠️ خطأ غير معروف: "${errorMsg.substring(0, 80)}"`);
      _healLog.push({ ts: Date.now(), error: errorMsg, category: 'unknown', fixed: false });
      return { known: false, error: errorMsg };
    }

    const best = matched[0];
    Logger.info('HEAL', `🔍 ${best.icon} تشخيص: ${best.label}`);

    const entry = {
      ts:       Date.now(),
      error:    errorMsg.substring(0, 200),
      category: best.category,
      label:    best.label,
      context:  context.substring(0, 100),
      fixed:    false
    };
    _healLog.push(entry);
    if (_healLog.length > 50) _healLog.shift();

    return { known: true, category: best.category, label: best.label, icon: best.icon, patterns: matched };
  }

  /* ═══════════════════════════════════════════════════════
     تطبيق الإصلاح على كود
     ═══════════════════════════════════════════════════════ */
  function fixCode(code, errorMsg) {
    const matched = ERROR_PATTERNS.filter(p => p.pattern.test(errorMsg));
    if (!matched.length) return { fixed: code, applied: [], success: false };

    let current = code;
    const applied = [];

    for (const pat of matched) {
      try {
        const result = pat.fix(current, errorMsg);
        if (!result) continue;
        if (result.fixed !== null) {
          current = result.fixed;
        }
        applied.push(result.applied);
        if (result.delay) {
          setTimeout(() => Logger.info('HEAL', '⏳ استئناف بعد تأخير...'), result.delay);
        }
      } catch (e) {
        Logger.warn('HEAL', `⚠️ فشل تطبيق إصلاح ${pat.category}: ${e}`);
      }
    }

    const success = current !== code || applied.length > 0;
    Logger.info('HEAL', `🔧 ${success ? '✓ تم الإصلاح' : '— لم يتغير'}: ${applied.join(', ')}`);
    return { fixed: current, applied, success, original: code };
  }

  /* ═══════════════════════════════════════════════════════
     دورة كاملة: تحليل → إصلاح → اختبار (حتى MAX_ATTEMPTS)
     ═══════════════════════════════════════════════════════ */
  async function heal(code, errorMsg, attempt = 1) {
    Logger.info('HEAL', `🩺 محاولة إصلاح ${attempt}/${MAX_ATTEMPTS}: "${errorMsg.substring(0, 50)}"`);

    if (attempt > MAX_ATTEMPTS) {
      Logger.error('HEAL', `❌ فشل الإصلاح بعد ${MAX_ATTEMPTS} محاولات`);
      if (typeof Toast !== 'undefined') Toast.show('تعذّر الإصلاح التلقائي — يرجى المراجعة اليدوية', 'warn', 6000);
      return { success: false, code, attempts: attempt - 1 };
    }

    const { fixed, applied, success } = fixCode(code, errorMsg);

    if (!success) {
      return { success: false, code, reason: 'لا يوجد إصلاح معروف', attempts: attempt };
    }

    /* اختبار الكود المُصلَح */
    let testPassed = true;
    let newError   = null;

    if (typeof AutoTest !== 'undefined') {
      const testResult = AutoTest.checkJS(fixed);
      testPassed = testResult.passed;
      newError   = testResult.errors?.[0] || null;
    } else if (typeof Sandbox !== 'undefined') {
      try {
        const result = await Sandbox.run(fixed);
        testPassed = !result.error;
        newError   = result.error || null;
      } catch (e) {
        testPassed = false;
        newError   = String(e);
      }
    }

    if (testPassed) {
      Logger.info('HEAL', `✅ إصلاح ناجح بعد ${attempt} محاولة! (${applied.join(', ')})`);
      if (typeof Toast !== 'undefined') Toast.show(`✅ تم الإصلاح التلقائي: ${applied.join(', ')}`, 'success');
      return { success: true, code: fixed, applied, attempts: attempt };
    }

    /* إذا لا يزال يوجد خطأ — أعد المحاولة */
    Logger.warn('HEAL', `⟳ الإصلاح أنتج خطأً جديداً: "${(newError || '').substring(0, 60)}" — محاولة أخرى`);
    return heal(fixed, newError || errorMsg, attempt + 1);
  }

  /* ══ سجل محاولات الإصلاح ══ */
  function getLog(n = 20) {
    return _healLog.slice(-n);
  }

  /* ══ إحصاءات ══ */
  function stats() {
    const total  = _healLog.length;
    const fixed  = _healLog.filter(e => e.fixed).length;
    const byCategory = {};
    _healLog.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + 1; });
    return { total, fixed, byCategory };
  }

  return { analyze, fixCode, heal, getLog, stats };
})();
