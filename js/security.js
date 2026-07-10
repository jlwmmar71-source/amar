/* ══════════════════════════════════════════════
   security.js — نظام الأمان الكامل
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const Security = (() => {
  /* ── أنماط الكود الخطير ── */
  const DANGEROUS_PATTERNS = [
    /eval\s*\(/i,
    /Function\s*\(/i,
    /document\.write\s*\(/i,
    /innerHTML\s*=/i,
    /outerHTML\s*=/i,
    /execScript\s*\(/i,
    /<script[\s>]/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /on\w+\s*=/i,
    /fetch\s*\(\s*['"]file:/i,
    /XMLHttpRequest/i,
    /require\s*\(\s*['"]child_process/i,
    /require\s*\(\s*['"]fs/i,
    /process\.env/i,
    /window\.location\s*=/i,
    /document\.cookie/i,
    /localStorage\.clear/i,
  ];

  /* ── قائمة النطاقات المسموح بها ── */
  const ALLOWED_DOMAINS = [
    'openrouter.ai',
    'generativelanguage.googleapis.com',
    'image.pollinations.ai',
    'wandbox.org',
    'duckduckgo.com',
    'r.jina.ai',
    'api.duckduckgo.com',
    'netlify.com',
    'netlify.app',
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'cdn.tailwindcss.com'
  ];

  /* ── حد المعدل (Rate Limiting) ── */
  const _rateLimits = new Map();

  /* ── مخزن مؤقت للمفاتيح (لا تُخزن نصيًا) ── */
  const _keyStore = new Map();

  function _hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }

  return {

    /* ═══════════════════════════════════════
       1. تحقق من المدخلات
       ═══════════════════════════════════════ */
    validateInput(text, opts = {}) {
      const { maxLen = 10000, minLen = 0 } = opts;

      if (typeof text !== 'string') {
        Logger.warn('SECURITY', 'مدخل غير نصي');
        return { ok: false, reason: 'المدخل يجب أن يكون نصًا' };
      }
      if (text.length < minLen) {
        return { ok: false, reason: 'النص قصير جدًا' };
      }
      if (text.length > maxLen) {
        Logger.warn('SECURITY', `مدخل طويل: ${text.length} حرف`);
        return { ok: false, reason: `النص أطول من ${maxLen} حرف` };
      }

      return { ok: true, value: this.sanitizeText(text) };
    },

    /* ═══════════════════════════════════════
       2. تعقيم النصوص
       ═══════════════════════════════════════ */
    sanitizeText(text) {
      return text
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    },

    /* ═══════════════════════════════════════
       3. فحص الكود الخطير
       ═══════════════════════════════════════ */
    scanCode(code) {
      const findings = [];
      DANGEROUS_PATTERNS.forEach((pattern, i) => {
        if (pattern.test(code)) {
          findings.push({
            pattern: pattern.source,
            severity: i < 5 ? 'HIGH' : 'MEDIUM'
          });
        }
      });

      if (findings.length > 0) {
        Logger.warn('SECURITY', `كود مشبوه (${findings.length} نمط خطير)`, findings);
      }

      return {
        safe: findings.length === 0,
        findings,
        riskLevel: findings.length === 0 ? 'SAFE'
          : findings.some(f => f.severity === 'HIGH') ? 'HIGH' : 'MEDIUM'
      };
    },

    /* ═══════════════════════════════════════
       4. التحقق من النطاق
       ═══════════════════════════════════════ */
    isDomainAllowed(url) {
      try {
        const domain = new URL(url).hostname;
        const allowed = ALLOWED_DOMAINS.some(d =>
          domain === d || domain.endsWith('.' + d)
        );
        if (!allowed) {
          Logger.warn('SECURITY', `نطاق غير مسموح: ${domain}`);
        }
        return allowed;
      } catch {
        Logger.warn('SECURITY', `رابط غير صالح: ${url}`);
        return false;
      }
    },

    /* ═══════════════════════════════════════
       5. حد المعدل (Rate Limiting)
       ═══════════════════════════════════════ */
    checkRateLimit(action, maxPerMinute = 20) {
      const now = Date.now();
      const key = action;

      if (!_rateLimits.has(key)) {
        _rateLimits.set(key, []);
      }

      const times = _rateLimits.get(key).filter(t => now - t < 60000);
      times.push(now);
      _rateLimits.set(key, times);

      if (times.length > maxPerMinute) {
        Logger.warn('SECURITY', `تجاوز حد المعدل: ${action} (${times.length}/${maxPerMinute})`);
        return {
          allowed: false,
          remaining: 0,
          resetIn: Math.ceil((times[0] + 60000 - now) / 1000)
        };
      }

      return {
        allowed: true,
        remaining: maxPerMinute - times.length,
        resetIn: 0
      };
    },

    /* ═══════════════════════════════════════
       6. إدارة المفاتيح بأمان
       ═══════════════════════════════════════ */
    storeKey(name, value) {
      if (!value || value.includes('_HERE')) return false;
      _keyStore.set(name, value);
      Logger.info('SECURITY', `مفتاح محفوظ: ${name} [${_hashStr(value)}]`);
      return true;
    },

    getKey(name) {
      return _keyStore.get(name) || null;
    },

    hasKey(name) {
      return _keyStore.has(name) && !!_keyStore.get(name);
    },

    /* ═══════════════════════════════════════
       7. تعقيم HTML (منع XSS)
       ═══════════════════════════════════════ */
    sanitizeHTML(html) {
      const div = document.createElement('div');
      div.textContent = html;
      return div.innerHTML;
    },

    /* ═══════════════════════════════════════
       8. التحقق من نوع الملف
       ═══════════════════════════════════════ */
    validateFileType(filename, allowedTypes = []) {
      const ext = filename.split('.').pop().toLowerCase();
      const SAFE_TYPES = [
        'html','css','js','ts','jsx','tsx','json','yaml','yml',
        'md','txt','py','go','rs','c','cpp','java','php','rb',
        'zip','png','jpg','jpeg','gif','webp','svg','bmp','avif',
        'toml','env.example','gitignore'
      ];
      const types = allowedTypes.length > 0 ? allowedTypes : SAFE_TYPES;
      const safe = types.includes(ext);
      if (!safe) {
        Logger.warn('SECURITY', `نوع ملف غير مسموح: ${ext}`);
      }
      return { safe, ext };
    },

    /* ═══════════════════════════════════════
       9. إخفاء المفاتيح من النصوص
       ═══════════════════════════════════════ */
    redactKeys(text) {
      let result = text;
      const patterns = [
        /sk-or-v1-[a-zA-Z0-9]{40,}/g,
        /AIza[a-zA-Z0-9_-]{35}/g,
        /nfp_[a-zA-Z0-9]{30,}/g,
        /sk_[a-zA-Z0-9]{30,}/g,
        /AQ\.[a-zA-Z0-9_-]{30,}/g,
        /Bearer [a-zA-Z0-9._-]{20,}/g,
      ];
      patterns.forEach(p => {
        result = result.replace(p, '***REDACTED***');
      });
      return result;
    },

    /* ═══════════════════════════════════════
       10. فحص شامل للطلب
       ═══════════════════════════════════════ */
    auditRequest(type, payload) {
      const audit = {
        type,
        ts: new Date().toISOString(),
        checks: []
      };

      if (payload.text) {
        const inp = this.validateInput(payload.text);
        audit.checks.push({ name: 'input_validation', passed: inp.ok });
      }

      if (payload.url) {
        const dom = this.isDomainAllowed(payload.url);
        audit.checks.push({ name: 'domain_check', passed: dom });
      }

      if (payload.code) {
        const scan = this.scanCode(payload.code);
        audit.checks.push({ name: 'code_scan', passed: scan.safe, details: scan.findings });
      }

      const rate = this.checkRateLimit(type);
      audit.checks.push({ name: 'rate_limit', passed: rate.allowed });

      audit.passed = audit.checks.every(c => c.passed);

      if (!audit.passed) {
        Logger.warn('SECURITY', `طلب مرفوض: ${type}`, audit.checks.filter(c => !c.passed));
      }

      return audit;
    }
  };
})();

Logger.info('SYSTEM', '✅ نظام الأمان جاهز');
