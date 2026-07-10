/* ══════════════════════════════════════════════════════════════
   docs-generator.js — مولّد التوثيق التلقائي (Documentation Generator)
   يُحدِّث التوثيق، Changelog، وتقرير التعديلات بعد كل عملية
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════════════════════ */

window.DocsGenerator = (function () {

  const LS_KEY    = 'galaoum_docs_v5';
  const CL_KEY    = 'galaoum_changelog_v5';
  const MAX_ITEMS = 200;

  /* ══ بنية التوثيق ══ */
  function _defaultDocs() {
    return {
      version:     'v5.0',
      updatedAt:   new Date().toISOString(),
      files:       {},    // filename → { description, functions[], classes[], exports[] }
      systems:     {},    // systemName → { purpose, methods[], events[] }
      api:         [],    // [{ endpoint, method, params, returns }]
      changelog:   []     // [{ts, type, summary, details}]
    };
  }

  function _load() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') || _defaultDocs(); }
    catch { return _defaultDocs(); }
  }
  function _save(docs) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(docs)); } catch {}
  }

  /* ═══════════════════════════════════════════════════════
     توثيق ملف JS تلقائياً
     ═══════════════════════════════════════════════════════ */
  function documentFile(filename, content) {
    const docs   = _load();
    const funcs  = _extractFunctions(content);
    const classes= _extractClasses(content);
    const exports= _extractExports(content);
    const desc   = _inferDescription(filename, content);

    docs.files[filename] = {
      filename,
      description: desc,
      functions:   funcs,
      classes,
      exports,
      linesOfCode: content.split('\n').length,
      updatedAt:   new Date().toISOString()
    };
    _save(docs);
    Logger.info('DOCS', `📄 وُثِّق: ${filename} (${funcs.length} دالة)`);
    return docs.files[filename];
  }

  /* ── استخراج أسماء الدوال ── */
  function _extractFunctions(code) {
    const funcs = [];
    const re    = /(?:^|\n)\s*(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    const re2   = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g;
    const re3   = /(\w+)\s*:\s*(?:async\s+)?function\s*\(([^)]*)\)/g;

    let m;
    while ((m = re.exec(code)) !== null)  funcs.push({ name: m[1], params: m[2].trim() });
    while ((m = re2.exec(code)) !== null) funcs.push({ name: m[1], params: m[2].trim(), type: 'arrow' });
    while ((m = re3.exec(code)) !== null) funcs.push({ name: m[1], params: m[2].trim(), type: 'method' });

    return [...new Map(funcs.map(f => [f.name, f])).values()];
  }

  /* ── استخراج الكلاسات ── */
  function _extractClasses(code) {
    return [...(code.matchAll(/class\s+(\w+)(?:\s+extends\s+(\w+))?/g))]
      .map(m => ({ name: m[1], extends: m[2] || null }));
  }

  /* ── استخراج الصادرات (window.X) ── */
  function _extractExports(code) {
    return [...(code.matchAll(/window\.(\w+)\s*=/g))].map(m => m[1]);
  }

  /* ── استنتاج وصف الملف ── */
  function _inferDescription(filename, code) {
    const firstComment = code.match(/\/\*+\s*([\s\S]*?)\*+\//);
    if (firstComment) {
      const lines = firstComment[1].split('\n').map(l => l.replace(/\*+/g, '').trim()).filter(Boolean);
      return lines[0] || filename;
    }
    const singleLine = code.match(/\/\/\s*(.+)/);
    return singleLine ? singleLine[1].trim() : `ملف ${filename}`;
  }

  /* ═══════════════════════════════════════════════════════
     توثيق نظام (مكتبة)
     ═══════════════════════════════════════════════════════ */
  function documentSystem(name, info) {
    const docs = _load();
    docs.systems[name] = {
      name,
      purpose:   info.purpose   || '',
      methods:   info.methods   || [],
      events:    info.events    || [],
      updatedAt: new Date().toISOString()
    };
    _save(docs);
    Logger.info('DOCS', `📚 نظام مُوثَّق: ${name}`);
  }

  /* ═══════════════════════════════════════════════════════
     تسجيل تغيير في Changelog
     ═══════════════════════════════════════════════════════ */
  function recordChange(info) {
    const docs = _load();
    const entry = {
      ts:      Date.now(),
      date:    new Date().toLocaleString('ar-SA'),
      type:    info.type    || 'feature',   // feature | fix | refactor | docs
      task:    info.task    || '',
      opId:    info.opId    || '',
      stages:  info.stages  || [],
      success: info.success !== false,
      summary: _buildSummary(info)
    };

    docs.changelog.unshift(entry);
    if (docs.changelog.length > MAX_ITEMS) docs.changelog.pop();
    docs.updatedAt = new Date().toISOString();
    _save(docs);

    Logger.info('DOCS', `📝 Changelog: ${entry.summary}`);
    return entry;
  }

  function _buildSummary(info) {
    const base = (info.task || '').substring(0, 80);
    const stageCount = (info.stages || []).filter(s => s.status === 'done').length;
    return base + (stageCount ? ` (${stageCount} مراحل مكتملة)` : '');
  }

  /* ═══════════════════════════════════════════════════════
     توليد تقرير مكتمل (Markdown)
     ═══════════════════════════════════════════════════════ */
  function generateReport() {
    const docs = _load();
    const now  = new Date().toLocaleString('ar-SA');
    const fileCount   = Object.keys(docs.files).length;
    const systemCount = Object.keys(docs.systems).length;
    const changes     = docs.changelog.slice(0, 20);

    let md = `# تقرير Galaoum AI Engine v5.0\n`;
    md += `**تاريخ التوليد:** ${now}\n\n`;

    /* ملخص */
    md += `## ملخص\n`;
    md += `- **الملفات الموثّقة:** ${fileCount}\n`;
    md += `- **الأنظمة:** ${systemCount}\n`;
    md += `- **آخر تحديث:** ${docs.updatedAt}\n\n`;

    /* الأنظمة */
    if (systemCount > 0) {
      md += `## الأنظمة المُسجَّلة\n\n`;
      Object.values(docs.systems).forEach(s => {
        md += `### ${s.name}\n${s.purpose}\n`;
        if (s.methods.length) md += `**الوظائف:** ${s.methods.join(', ')}\n`;
        md += '\n';
      });
    }

    /* الملفات */
    if (fileCount > 0) {
      md += `## الملفات الموثّقة\n\n`;
      Object.values(docs.files).forEach(f => {
        md += `### \`${f.filename}\`\n`;
        md += `${f.description}\n`;
        md += `- أسطر: ${f.linesOfCode}\n`;
        if (f.functions.length) md += `- دوال: ${f.functions.map(fn => fn.name).join(', ')}\n`;
        if (f.exports.length)   md += `- صادرات: ${f.exports.join(', ')}\n`;
        md += '\n';
      });
    }

    /* Changelog */
    if (changes.length > 0) {
      md += `## سجل التغييرات (آخر 20)\n\n`;
      changes.forEach(c => {
        const icon = c.success ? '✅' : '❌';
        md += `- ${icon} **${c.date}** — ${c.summary}\n`;
      });
    }

    return md;
  }

  /* ═══════════════════════════════════════════════════════
     تصدير التوثيق كملف Markdown
     ═══════════════════════════════════════════════════════ */
  function exportMarkdown() {
    const md   = generateReport();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `galaoum-docs-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    Logger.info('DOCS', '📥 تم تصدير التوثيق كـ Markdown');
  }

  /* ═══════════════════════════════════════════════════════
     الحصول على Changelog للعرض
     ═══════════════════════════════════════════════════════ */
  function getChangelog(n = 30) {
    const docs = _load();
    return (docs.changelog || []).slice(0, n);
  }

  /* ══ توثيق الأنظمة الـ 21 عند التهيئة ══ */
  function _initSystemDocs() {
    const systems = [
      { name: 'Logger',               purpose: 'نظام السجلات — 4 مستويات + واجهة مرئية' },
      { name: 'Security',             purpose: 'مخزن المفاتيح، Rate Limiting، فحص المدخلات' },
      { name: 'SecurityCenter',       purpose: 'مركز الأمان الموسّع — تشفير، Audit Log، صلاحيات' },
      { name: 'Memory',               purpose: 'الذاكرة الموسّعة — مشروع، تعديلات، حقائق' },
      { name: 'PluginSystem',         purpose: 'نظام البلاجنز — 3 بلاجنز مدمجة + hooks' },
      { name: 'Agent',                purpose: 'الوكيل الذكي — 11 نوع نية + خطة تنفيذ' },
      { name: 'ProjectAnalyzer',      purpose: 'محرك تحليل المشاريع وملفات ZIP' },
      { name: 'Sandbox',              purpose: 'بيئة تشغيل الكود الآمنة — iframe معزول' },
      { name: 'AutoTest',             purpose: 'الاختبار التلقائي + الإصلاح التلقائي' },
      { name: 'Executive',            purpose: 'المدير الرئيسي — يوجّه جميع الطلبات' },
      { name: 'WorkflowEngine',       purpose: 'محرك سير العمل — 7 مراحل مرتّبة' },
      { name: 'DecisionEngine',       purpose: 'محرك القرار — اختيار النموذج والأدوات' },
      { name: 'ModelManager',         purpose: 'مدير النماذج — اختيار، تبديل، دمج' },
      { name: 'ToolManager',          purpose: 'مدير الأدوات — تسجيل، تشغيل بالتوازي' },
      { name: 'KnowledgeGraph',       purpose: 'خريطة معرفة المشروع — تحليل، علاقات، تأثير' },
      { name: 'SemanticSearch',       purpose: 'البحث الدلالي — TF-IDF + Cosine Similarity' },
      { name: 'SelfHealingEngine',    purpose: 'الإصلاح الذاتي — تحليل، إصلاح، إعادة اختبار' },
      { name: 'QualityGate',          purpose: 'بوابة الجودة — 8 معايير + تقرير' },
      { name: 'PerformanceOptimizer', purpose: 'محسّن الأداء — كاش، ذاكرة، Lazy Load' },
      { name: 'DocsGenerator',        purpose: 'مولّد التوثيق — Markdown + Changelog تلقائي' }
    ];
    systems.forEach(s => documentSystem(s.name, s));
  }

  _initSystemDocs();

  return { documentFile, documentSystem, recordChange, generateReport, exportMarkdown, getChangelog };
})();
