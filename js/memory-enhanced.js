/* ══════════════════════════════════════════════
   memory-enhanced.js — الذاكرة الموسّعة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const Memory = (() => {
  const KEYS = {
    PROJECT:  'galaoum_project_memory',
    EDITS:    'galaoum_edit_history',
    FACTS:    'galaoum_facts',
    PREFS:    'galaoum_user_prefs',
    SESSION:  'galaoum_session'
  };

  const MAX_EDITS   = 50;
  const MAX_FACTS   = 200;

  /* ── قراءة من localStorage بأمان ── */
  function _read(key, def = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    } catch { return def; }
  }

  /* ── كتابة إلى localStorage ── */
  function _write(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      Logger.error('MEMORY', `فشل الحفظ: ${key} — ${e.message}`);
      return false;
    }
  }

  /* ── حالة الجلسة الحالية ── */
  const _session = {
    id:        `sess_${Date.now()}`,
    startedAt: new Date().toISOString(),
    messages:  0,
    currentProject: null,
    lastEdits: []
  };

  return {

    /* ═══════════════════════════════════════
       1. ذاكرة المشروع
       ═══════════════════════════════════════ */
    setProject(projectData) {
      const data = {
        ...projectData,
        savedAt: new Date().toISOString()
      };
      _write(KEYS.PROJECT, data);
      _session.currentProject = data;
      Logger.info('MEMORY', `مشروع محفوظ: ${data.name || 'بلا اسم'}`);
    },

    getProject() {
      return _read(KEYS.PROJECT, null);
    },

    updateProject(updates) {
      const current = this.getProject() || {};
      this.setProject({ ...current, ...updates, updatedAt: new Date().toISOString() });
    },

    clearProject() {
      localStorage.removeItem(KEYS.PROJECT);
      _session.currentProject = null;
      Logger.info('MEMORY', 'ذاكرة المشروع ممسوحة');
    },

    /* ═══════════════════════════════════════
       2. سجل التعديلات
       ═══════════════════════════════════════ */
    addEdit(editRecord) {
      const edits = _read(KEYS.EDITS, []);
      const entry = {
        id:        `edit_${Date.now()}`,
        ts:        new Date().toISOString(),
        sessionId: _session.id,
        ...editRecord
      };
      edits.push(entry);
      if (edits.length > MAX_EDITS) edits.splice(0, edits.length - MAX_EDITS);
      _write(KEYS.EDITS, edits);
      _session.lastEdits.push(entry.id);
      Logger.info('MEMORY', `تعديل مسجّل: ${entry.file || entry.type || '?'}`);
      return entry;
    },

    getEdits(filter = {}) {
      let edits = _read(KEYS.EDITS, []);
      if (filter.file)      edits = edits.filter(e => e.file === filter.file);
      if (filter.sessionId) edits = edits.filter(e => e.sessionId === filter.sessionId);
      if (filter.since)     edits = edits.filter(e => e.ts >= filter.since);
      return edits;
    },

    getLastEdits(n = 5) {
      const edits = _read(KEYS.EDITS, []);
      return edits.slice(-n);
    },

    /* ═══════════════════════════════════════
       3. الحقائق المستخلصة (Facts)
       ═══════════════════════════════════════ */
    addFact(fact, category = 'general') {
      const facts = _read(KEYS.FACTS, []);
      const existing = facts.find(f => f.fact === fact && f.category === category);
      if (existing) {
        existing.count = (existing.count || 1) + 1;
        existing.lastSeen = new Date().toISOString();
      } else {
        facts.push({
          id:       `fact_${Date.now()}`,
          fact,
          category,
          count:    1,
          addedAt:  new Date().toISOString(),
          lastSeen: new Date().toISOString()
        });
      }
      if (facts.length > MAX_FACTS) facts.splice(0, facts.length - MAX_FACTS);
      _write(KEYS.FACTS, facts);
    },

    searchFacts(query) {
      const facts = _read(KEYS.FACTS, []);
      const q = query.toLowerCase();
      return facts.filter(f =>
        f.fact.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    },

    getFacts(category = null) {
      const facts = _read(KEYS.FACTS, []);
      return category ? facts.filter(f => f.category === category) : facts;
    },

    /* ═══════════════════════════════════════
       4. تفضيلات المستخدم
       ═══════════════════════════════════════ */
    setPref(key, value) {
      const prefs = _read(KEYS.PREFS, {});
      prefs[key] = value;
      _write(KEYS.PREFS, prefs);
    },

    getPref(key, def = null) {
      const prefs = _read(KEYS.PREFS, {});
      return prefs[key] !== undefined ? prefs[key] : def;
    },

    getAllPrefs() {
      return _read(KEYS.PREFS, {});
    },

    /* ═══════════════════════════════════════
       5. ملخص الجلسة
       ═══════════════════════════════════════ */
    getSession() {
      return { ..._session };
    },

    incrementMessages() {
      _session.messages++;
    },

    /* ═══════════════════════════════════════
       6. بناء سياق للذكاء الاصطناعي
       ═══════════════════════════════════════ */
    buildContext() {
      const project = this.getProject();
      const lastEdits = this.getLastEdits(3);
      const facts = this.getFacts().slice(-10);

      let ctx = '';

      if (project) {
        ctx += `\n## المشروع الحالي\n`;
        ctx += `الاسم: ${project.name || 'غير محدد'}\n`;
        if (project.description) ctx += `الوصف: ${project.description}\n`;
        if (project.files?.length) ctx += `الملفات: ${project.files.slice(0, 10).join(', ')}\n`;
        if (project.stack) ctx += `التقنيات: ${project.stack}\n`;
      }

      if (lastEdits.length > 0) {
        ctx += `\n## آخر التعديلات\n`;
        lastEdits.forEach(e => {
          ctx += `- ${e.file || e.type}: ${e.description || e.action || '?'}\n`;
        });
      }

      if (facts.length > 0) {
        ctx += `\n## معلومات مهمة\n`;
        facts.forEach(f => { ctx += `- ${f.fact}\n`; });
      }

      return ctx.trim();
    },

    /* ═══════════════════════════════════════
       7. مسح كامل
       ═══════════════════════════════════════ */
    clearAll() {
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
      Logger.info('MEMORY', 'تم مسح جميع الذاكرة');
    },

    /* ═══════════════════════════════════════
       8. تصدير الذاكرة
       ═══════════════════════════════════════ */
    export() {
      return {
        project:  this.getProject(),
        edits:    this.getEdits(),
        facts:    this.getFacts(),
        prefs:    this.getAllPrefs(),
        session:  this.getSession(),
        exportedAt: new Date().toISOString()
      };
    },

    /* ═══════════════════════════════════════
       9. استيراد الذاكرة
       ═══════════════════════════════════════ */
    import(data) {
      if (data.project) _write(KEYS.PROJECT, data.project);
      if (data.edits)   _write(KEYS.EDITS, data.edits);
      if (data.facts)   _write(KEYS.FACTS, data.facts);
      if (data.prefs)   _write(KEYS.PREFS, data.prefs);
      Logger.info('MEMORY', 'تم استيراد الذاكرة');
    }
  };
})();

Logger.info('SYSTEM', '✅ نظام الذاكرة الموسّع جاهز');
