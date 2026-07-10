/* ══════════════════════════════════════════════════════════════
   security-center.js — مركز الأمان الموسّع (Security Center)
   تشفير، صلاحيات، Audit Logs، Rate Limiting، منع الأوامر الخطرة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.SecurityCenter = (function () {

  /* ══ مفتاح التشفير البسيط (XOR) ══ */
  /* ملاحظة: هذا تشفير خفيف لبيانات localStorage — ليس AES */
  const _ENC_KEY = 'galaoum_sc_v5';

  function _xorEncrypt(text) {
    return btoa(text.split('').map((c, i) =>
      String.fromCharCode(c.charCodeAt(0) ^ _ENC_KEY.charCodeAt(i % _ENC_KEY.length))
    ).join(''));
  }
  function _xorDecrypt(encoded) {
    try {
      const raw = atob(encoded);
      return raw.split('').map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ _ENC_KEY.charCodeAt(i % _ENC_KEY.length))
      ).join('');
    } catch { return null; }
  }

  /* ══ Audit Log — سجل العمليات الأمنية ══ */
  const _auditLog = [];
  const MAX_AUDIT = 500;

  function audit(action, detail = '', level = 'info') {
    const entry = {
      ts:     Date.now(),
      action,
      detail: String(detail).substring(0, 200),
      level   // 'info' | 'warn' | 'critical'
    };
    _auditLog.push(entry);
    if (_auditLog.length > MAX_AUDIT) _auditLog.shift();
    Logger[level === 'critical' ? 'error' : level === 'warn' ? 'warn' : 'info']
      ('SEC', `${level.toUpperCase()} | ${action}: ${detail.substring(0, 60)}`);

    /* حفظ الأحداث الحرجة فقط في localStorage */
    if (level === 'critical') {
      try {
        const stored = JSON.parse(localStorage.getItem('sc_critical') || '[]');
        stored.push(entry);
        if (stored.length > 50) stored.shift();
        localStorage.setItem('sc_critical', JSON.stringify(stored));
      } catch {}
    }
  }

  /* ══ نظام الصلاحيات ══ */
  const _roles = {
    guest:  { level: 0, can: ['chat', 'search', 'image_gen'] },
    user:   { level: 1, can: ['chat', 'search', 'image_gen', 'code_run', 'file_read'] },
    dev:    { level: 2, can: ['chat', 'search', 'image_gen', 'code_run', 'file_read', 'deploy', 'settings'] },
    admin:  { level: 3, can: ['*'] }
  };

  let _currentRole = 'user';

  function setRole(role) {
    if (!_roles[role]) { audit('SET_ROLE', `دور غير معروف: ${role}`, 'warn'); return; }
    _currentRole = role;
    audit('SET_ROLE', `تم تعيين الدور: ${role}`);
  }

  function can(action) {
    const role = _roles[_currentRole] || _roles.guest;
    return role.can.includes('*') || role.can.includes(action);
  }

  function requirePermission(action) {
    if (!can(action)) {
      audit('PERMISSION_DENIED', `محظور: ${action} (دور: ${_currentRole})`, 'warn');
      throw new Error(`ليس لديك صلاحية لتنفيذ: ${action}`);
    }
    return true;
  }

  /* ══ Rate Limiting موسّع ══ */
  const _rlWindows = {};   // key → [timestamps]
  const RL_LIMITS = {
    api_call:   { max: 30,  window: 60000  },   // 30 طلب/دقيقة
    deploy:     { max: 3,   window: 300000 },   // 3 نشرات/5 دقائق
    code_run:   { max: 20,  window: 60000  },   // 20 تشغيل/دقيقة
    search:     { max: 15,  window: 60000  },   // 15 بحث/دقيقة
    image_gen:  { max: 10,  window: 60000  }    // 10 صور/دقيقة
  };

  function checkRateLimit(action) {
    const limit = RL_LIMITS[action] || RL_LIMITS.api_call;
    const now   = Date.now();
    const key   = action;

    if (!_rlWindows[key]) _rlWindows[key] = [];
    /* إزالة الطلبات القديمة */
    _rlWindows[key] = _rlWindows[key].filter(t => now - t < limit.window);

    if (_rlWindows[key].length >= limit.max) {
      const resetIn = Math.ceil((limit.window - (now - _rlWindows[key][0])) / 1000);
      audit('RATE_LIMIT', `تجاوز الحد: ${action} (${_rlWindows[key].length}/${limit.max})`, 'warn');
      return { allowed: false, resetIn, current: _rlWindows[key].length, max: limit.max };
    }

    _rlWindows[key].push(now);
    return { allowed: true, current: _rlWindows[key].length, max: limit.max };
  }

  /* ══ فحص الأوامر الخطرة ══ */
  const DANGEROUS_PATTERNS = [
    { re: /rm\s+-rf|del\s+\/[sqf]/i,         label: 'حذف ملفات خطير',    severity: 'critical' },
    { re: /exec\s*\(|eval\s*\(/,              label: 'تنفيذ كود ديناميكي', severity: 'high'     },
    { re: /document\.cookie/,                 label: 'الوصول للكوكيز',    severity: 'medium'   },
    { re: /localStorage\.clear\(\)/,          label: 'مسح localStorage',  severity: 'high'     },
    { re: /process\.env|os\.environ/,         label: 'وصول لمتغيرات البيئة', severity: 'high'  },
    { re: /\bfork\b|\bspawn\b|\bexecSync\b/, label: 'تشغيل عملية خارجية', severity: 'critical' },
    { re: /atob\s*\(|btoa\s*\(/,              label: 'ترميز/فك Base64',   severity: 'low'      },
    { re: /new\s+Function\s*\(/,              label: 'إنشاء دالة ديناميكية', severity: 'high'  },
    { re: /innerHTML\s*=/,                    label: 'حقن HTML (XSS)',    severity: 'medium'   },
    { re: /DROP\s+TABLE|DELETE\s+FROM/i,      label: 'أمر SQL خطير',      severity: 'critical' }
  ];

  function scanForDanger(code, requireApproval = true) {
    const found = DANGEROUS_PATTERNS.filter(p => p.re.test(code));
    if (!found.length) return { safe: true, issues: [] };

    const critical = found.filter(f => f.severity === 'critical');
    const issues   = found.map(f => ({ label: f.label, severity: f.severity }));

    found.forEach(f => {
      audit('DANGEROUS_CODE', f.label, f.severity === 'critical' ? 'critical' : 'warn');
    });

    if (critical.length > 0 && requireApproval) {
      const msg = critical.map(f => f.label).join('، ');
      const confirmed = window.confirm(
        `⚠️ تحذير أمني\n\nالكود يحتوي على أوامر خطيرة:\n${msg}\n\nهل تريد المتابعة؟`
      );
      if (!confirmed) {
        audit('BLOCKED', `حُظر كود خطير: ${msg}`, 'critical');
        return { safe: false, blocked: true, issues };
      }
    }

    return { safe: critical.length === 0, issues, requiresConfirmation: critical.length > 0 };
  }

  /* ══ تشفير البيانات الحساسة في localStorage ══ */
  function secureStore(key, value) {
    try {
      const encrypted = _xorEncrypt(typeof value === 'string' ? value : JSON.stringify(value));
      localStorage.setItem(`sc_enc_${key}`, encrypted);
      audit('SECURE_STORE', `حُفظت: ${key}`);
      return true;
    } catch (e) {
      audit('SECURE_STORE_ERR', String(e), 'warn');
      return false;
    }
  }

  function secureLoad(key) {
    try {
      const raw  = localStorage.getItem(`sc_enc_${key}`);
      if (!raw) return null;
      const dec = _xorDecrypt(raw);
      try { return JSON.parse(dec); } catch { return dec; }
    } catch { return null; }
  }

  function secureDelete(key) {
    localStorage.removeItem(`sc_enc_${key}`);
    audit('SECURE_DELETE', `حُذفت: ${key}`);
  }

  /* ══ التحقق من المدخلات (XSS + Injection) ══ */
  function validateInput(input, maxLength = 10000) {
    if (typeof input !== 'string') return { valid: false, reason: 'نوع غير صالح' };
    if (input.length > maxLength) return { valid: false, reason: `يتجاوز الحد: ${maxLength}` };

    const xssPatterns = [/<script/i, /javascript:/i, /on\w+\s*=/i, /data:text\/html/i];
    for (const p of xssPatterns) {
      if (p.test(input)) {
        audit('XSS_ATTEMPT', input.substring(0, 80), 'critical');
        return { valid: false, reason: 'محتوى XSS محتمل' };
      }
    }
    return { valid: true };
  }

  /* ══ سجل Audit ══ */
  function getAuditLog(n = 50, level = null) {
    const log = level ? _auditLog.filter(e => e.level === level) : _auditLog;
    return log.slice(-n).reverse();
  }

  function exportAuditLog() {
    const lines = _auditLog.map(e =>
      `[${new Date(e.ts).toISOString()}] [${e.level.toUpperCase()}] ${e.action}: ${e.detail}`
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `audit-log-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    audit('EXPORT_LOG', `صُدِّر ${_auditLog.length} سجل`);
  }

  /* ══ تهيئة ══ */
  audit('INIT', 'تم تفعيل مركز الأمان v5.0');

  return {
    audit, getAuditLog, exportAuditLog,
    can, setRole, requirePermission,
    checkRateLimit,
    scanForDanger,
    secureStore, secureLoad, secureDelete,
    validateInput
  };
})();
