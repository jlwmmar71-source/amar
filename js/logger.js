/* ══════════════════════════════════════════════
   logger.js — نظام السجلات الكامل
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const Logger = (() => {
  const MAX_LOGS = 1000;
  const STORAGE_KEY = 'galaoum_logs';

  const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
  const LEVEL_COLORS = ['#64748b', '#4ade80', '#fbbf24', '#f87171'];
  const LEVEL_ICONS  = ['🔍', 'ℹ️', '⚠️', '❌'];

  let _logs = [];
  let _currentLevel = LEVELS.DEBUG;
  let _listeners = [];

  /* ── تحميل السجلات المحفوظة ── */
  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) _logs = JSON.parse(raw).slice(-MAX_LOGS);
    } catch { _logs = []; }
  }

  /* ── حفظ السجلات ── */
  function _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_logs.slice(-MAX_LOGS)));
    } catch {}
  }

  /* ── إضافة سجل ── */
  function _add(level, category, message, data = null) {
    if (level < _currentLevel) return;

    const entry = {
      id: Date.now() + Math.random().toString(36).slice(2, 6),
      ts: new Date().toISOString(),
      level,
      levelName: LEVEL_NAMES[level],
      category,
      message,
      data: data ? _sanitize(data) : null
    };

    _logs.push(entry);
    if (_logs.length > MAX_LOGS) _logs.shift();
    _save();

    const prefix = `[${LEVEL_ICONS[level]} ${LEVEL_NAMES[level]}][${category}]`;
    const style  = `color:${LEVEL_COLORS[level]};font-weight:bold`;

    if (level >= LEVELS.ERROR) {
      console.error(`%c${prefix}`, style, message, data || '');
    } else if (level >= LEVELS.WARN) {
      console.warn(`%c${prefix}`, style, message, data || '');
    } else {
      console.log(`%c${prefix}`, style, message, data || '');
    }

    _listeners.forEach(fn => { try { fn(entry); } catch {} });
    return entry;
  }

  /* ── تنظيف البيانات من الأسرار ── */
  function _sanitize(data) {
    if (typeof data !== 'object' || data === null) return data;
    const safe = Array.isArray(data) ? [...data] : { ...data };
    const secrets = ['key', 'token', 'password', 'secret', 'authorization'];
    for (const k of Object.keys(safe)) {
      if (secrets.some(s => k.toLowerCase().includes(s))) {
        safe[k] = '***REDACTED***';
      } else if (typeof safe[k] === 'object') {
        safe[k] = _sanitize(safe[k]);
      }
    }
    return safe;
  }

  _load();

  return {
    LEVELS,

    setLevel(level) { _currentLevel = level; },

    debug(cat, msg, data)  { return _add(LEVELS.DEBUG, cat, msg, data); },
    info (cat, msg, data)  { return _add(LEVELS.INFO,  cat, msg, data); },
    warn (cat, msg, data)  { return _add(LEVELS.WARN,  cat, msg, data); },
    error(cat, msg, data)  { return _add(LEVELS.ERROR, cat, msg, data); },

    /* ── مجموعات السجلات ── */
    group(label) {
      _add(LEVELS.INFO, 'GROUP', `▶ بدء: ${label}`);
      return {
        end: () => _add(LEVELS.INFO, 'GROUP', `◀ نهاية: ${label}`)
      };
    },

    /* ── قياس الوقت ── */
    time(label) {
      const start = performance.now();
      _add(LEVELS.DEBUG, 'TIMER', `⏱ بدء: ${label}`);
      return {
        end: () => {
          const ms = (performance.now() - start).toFixed(2);
          _add(LEVELS.DEBUG, 'TIMER', `⏱ انتهى: ${label} — ${ms}ms`);
          return parseFloat(ms);
        }
      };
    },

    /* ── الحصول على السجلات ── */
    getLogs(filter = {}) {
      let logs = [..._logs];
      if (filter.level != null) logs = logs.filter(l => l.level >= filter.level);
      if (filter.category)      logs = logs.filter(l => l.category === filter.category);
      if (filter.since)         logs = logs.filter(l => l.ts >= filter.since);
      if (filter.search)        logs = logs.filter(l =>
        l.message.includes(filter.search) || l.category.includes(filter.search));
      if (filter.limit)         logs = logs.slice(-filter.limit);
      return logs;
    },

    /* ── تقرير مفصل ── */
    getReport() {
      const counts = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
      _logs.forEach(l => counts[l.levelName]++);
      const errors   = _logs.filter(l => l.level >= LEVELS.ERROR);
      const warnings = _logs.filter(l => l.level === LEVELS.WARN);
      return {
        total: _logs.length,
        counts,
        errors:   errors.slice(-10),
        warnings: warnings.slice(-10),
        since:    _logs[0]?.ts || null,
        latest:   _logs[_logs.length - 1]?.ts || null
      };
    },

    /* ── مراقبة السجلات ── */
    onLog(fn)    { _listeners.push(fn); },
    offLog(fn)   { _listeners = _listeners.filter(l => l !== fn); },

    /* ── مسح السجلات ── */
    clear() {
      _logs = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      _add(LEVELS.INFO, 'LOGGER', 'تم مسح السجلات');
    },

    /* ── تصدير السجلات ── */
    export(format = 'json') {
      if (format === 'json') {
        return JSON.stringify(_logs, null, 2);
      }
      return _logs.map(l =>
        `[${l.ts}][${l.levelName}][${l.category}] ${l.message}`
      ).join('\n');
    },

    /* ── فتح لوحة السجلات ── */
    openPanel() {
      LoggerUI.open();
    }
  };
})();

/* ══════════════════════════════════════════════
   LoggerUI — واجهة عرض السجلات
   ══════════════════════════════════════════════ */
const LoggerUI = (() => {
  let _panel = null;
  let _unsubscribe = null;

  function _build() {
    const div = document.createElement('div');
    div.id = 'logger-panel';
    div.innerHTML = `
      <div id="logger-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:15px;font-weight:800;color:#fca5a5">📋 سجل العمليات</span>
          <span id="logger-count" style="font-size:11px;color:#475569">0 سجل</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <select id="logger-filter-level" style="
            background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
            color:#94a3b8;border-radius:6px;padding:3px 6px;font-size:11px;font-family:inherit;
          ">
            <option value="-1">الكل</option>
            <option value="0">DEBUG</option>
            <option value="1">INFO</option>
            <option value="2">WARN</option>
            <option value="3">ERROR</option>
          </select>
          <input id="logger-search" type="text" placeholder="بحث..." style="
            background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
            color:#e2e8f0;border-radius:6px;padding:3px 8px;font-size:11px;
            font-family:inherit;width:120px;
          ">
          <button onclick="Logger.clear();LoggerUI.refresh()" style="
            background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);
            color:#fca5a5;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit;
          ">مسح</button>
          <button onclick="LoggerUI.downloadLogs()" style="
            background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
            color:#94a3b8;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit;
          ">تصدير</button>
          <button onclick="LoggerUI.close()" style="
            background:none;border:none;color:#64748b;font-size:16px;cursor:pointer;padding:0 4px;
          ">✕</button>
        </div>
      </div>
      <div id="logger-body"></div>
      <div id="logger-footer">
        <span id="logger-stats"></span>
      </div>
    `;
    document.body.appendChild(div);

    document.getElementById('logger-filter-level').addEventListener('change', () => LoggerUI.refresh());
    document.getElementById('logger-search').addEventListener('input',  () => LoggerUI.refresh());

    return div;
  }

  function _renderLogs(logs) {
    const body = document.getElementById('logger-body');
    if (!body) return;
    const colors = ['#64748b', '#4ade80', '#fbbf24', '#f87171'];
    const icons  = ['🔍', 'ℹ️', '⚠️', '❌'];

    body.innerHTML = logs.slice(-200).reverse().map(l => `
      <div class="logger-entry level-${l.level}">
        <span class="log-icon">${icons[l.level]}</span>
        <span class="log-cat" style="color:${colors[l.level]}">${l.category}</span>
        <span class="log-msg">${l.message}</span>
        <span class="log-ts">${new Date(l.ts).toLocaleTimeString('ar-SA')}</span>
      </div>
    `).join('');

    const count = document.getElementById('logger-count');
    if (count) count.textContent = `${logs.length} سجل`;

    const stats = document.getElementById('logger-stats');
    if (stats) {
      const rpt = Logger.getReport();
      stats.innerHTML = `
        <span style="color:#4ade80">INFO: ${rpt.counts.INFO}</span>
        <span style="color:#fbbf24">WARN: ${rpt.counts.WARN}</span>
        <span style="color:#f87171">ERROR: ${rpt.counts.ERROR}</span>
      `;
    }
  }

  return {
    open() {
      if (!_panel) _panel = _build();
      _panel.classList.add('open');
      this.refresh();

      _unsubscribe = (entry) => {
        if (_panel?.classList.contains('open')) this.refresh();
      };
      Logger.onLog(_unsubscribe);
    },

    close() {
      if (_panel) _panel.classList.remove('open');
      if (_unsubscribe) Logger.offLog(_unsubscribe);
    },

    refresh() {
      const levelEl  = document.getElementById('logger-filter-level');
      const searchEl = document.getElementById('logger-search');
      const filter = {
        level:  levelEl  ? parseInt(levelEl.value)  : -1,
        search: searchEl ? searchEl.value.trim() : ''
      };
      const logs = Logger.getLogs({
        level:  filter.level >= 0 ? filter.level : undefined,
        search: filter.search || undefined
      });
      _renderLogs(logs);
    },

    downloadLogs() {
      const data = Logger.export('text');
      const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `galaoum-logs-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
})();

window.Logger = Logger;
Logger.info('SYSTEM', '✅ نظام السجلات جاهز');
