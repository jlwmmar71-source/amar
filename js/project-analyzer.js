/* ══════════════════════════════════════════════
   project-analyzer.js — محرك فهم المشاريع
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const ProjectAnalyzer = (() => {

  /* ── أنواع الملفات ── */
  const FILE_TYPES = {
    html:  { lang: 'html',       role: 'واجهة المستخدم',      icon: '🌐' },
    css:   { lang: 'css',        role: 'التصميم',              icon: '🎨' },
    js:    { lang: 'javascript', role: 'المنطق',               icon: '📜' },
    ts:    { lang: 'typescript', role: 'المنطق (TypeScript)',  icon: '📘' },
    jsx:   { lang: 'react',      role: 'مكوّن React',          icon: '⚛️' },
    tsx:   { lang: 'react-ts',   role: 'مكوّن React (TS)',     icon: '⚛️' },
    py:    { lang: 'python',     role: 'Python',               icon: '🐍' },
    go:    { lang: 'go',         role: 'Go',                   icon: '🐹' },
    rs:    { lang: 'rust',       role: 'Rust',                 icon: '🦀' },
    json:  { lang: 'json',       role: 'إعدادات/بيانات',       icon: '📋' },
    yaml:  { lang: 'yaml',       role: 'إعدادات',              icon: '⚙️' },
    yml:   { lang: 'yaml',       role: 'إعدادات',              icon: '⚙️' },
    toml:  { lang: 'toml',       role: 'إعدادات',              icon: '⚙️' },
    md:    { lang: 'markdown',   role: 'توثيق',                icon: '📝' },
    env:   { lang: 'env',        role: 'متغيرات البيئة',       icon: '🔐' }
  };

  /* ── تحليل ملف واحد ── */
  function _analyzeFile(filename, content) {
    const ext  = filename.split('.').pop().toLowerCase();
    const type = FILE_TYPES[ext] || { lang: 'text', role: 'نص', icon: '📄' };

    const lines = content.split('\n');
    const info  = {
      name:         filename,
      ext,
      lang:         type.lang,
      role:         type.role,
      icon:         type.icon,
      lines:        lines.length,
      size:         content.length,
      imports:      [],
      exports:      [],
      functions:    [],
      classes:      [],
      variables:    [],
      todos:        [],
      dependencies: []
    };

    /* ── استخراج الاستيرادات ── */
    const importPatterns = [
      /import\s+.*?\s+from\s+['"](.+?)['"]/g,
      /require\s*\(\s*['"](.+?)['"]\s*\)/g,
      /<script\s+src=['"](.+?)['"]/g,
      /<link\s+.*?href=['"](.+?)['"]/g
    ];
    importPatterns.forEach(pattern => {
      let m;
      while ((m = pattern.exec(content)) !== null) {
        if (m[1] && !info.imports.includes(m[1])) {
          info.imports.push(m[1]);
        }
      }
    });

    /* ── استخراج الدوال ── */
    const fnPattern = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*:\s*(?:async\s*)?\()/g;
    let fm;
    while ((fm = fnPattern.exec(content)) !== null) {
      const name = fm[1] || fm[2] || fm[3];
      if (name && !info.functions.includes(name)) {
        info.functions.push(name);
      }
    }

    /* ── استخراج الكلاسات ── */
    const classPattern = /class\s+(\w+)/g;
    let cm;
    while ((cm = classPattern.exec(content)) !== null) {
      if (!info.classes.includes(cm[1])) info.classes.push(cm[1]);
    }

    /* ── TODO/FIXME ── */
    lines.forEach((line, i) => {
      if (/TODO|FIXME|HACK|BUG|XXX/i.test(line)) {
        info.todos.push({ line: i + 1, text: line.trim() });
      }
    });

    /* ── استخراج التبعيات (package.json) ── */
    if (filename === 'package.json') {
      try {
        const pkg = JSON.parse(content);
        info.dependencies = [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {})
        ];
      } catch {}
    }

    return info;
  }

  /* ── بناء خريطة التبعيات ── */
  function _buildDependencyMap(files) {
    const map = {};

    files.forEach(f => {
      map[f.name] = {
        imports: [],
        importedBy: []
      };
    });

    files.forEach(f => {
      f.imports.forEach(imp => {
        /* محاولة ربط الاستيراد بملف في المشروع */
        const candidates = [
          imp,
          imp + '.js', imp + '.ts', imp + '.jsx', imp + '.tsx',
          imp.replace(/^\.\//, ''),
          imp.replace(/^\.\.\//, '')
        ];

        files.forEach(target => {
          if (candidates.some(c => target.name.endsWith(c) || target.name === c)) {
            if (!map[f.name].imports.includes(target.name)) {
              map[f.name].imports.push(target.name);
            }
            if (!map[target.name].importedBy.includes(f.name)) {
              map[target.name].importedBy.push(f.name);
            }
          }
        });
      });
    });

    return map;
  }

  /* ── الكشف عن المشاكل ── */
  function _detectIssues(files, depMap) {
    const issues = [];

    files.forEach(f => {
      /* ملفات كبيرة جداً */
      if (f.lines > 500) {
        issues.push({
          type: 'large_file', severity: 'LOW',
          file: f.name,
          message: `الملف كبير (${f.lines} سطر) — يُنصح بتقسيمه`
        });
      }

      /* TODO متراكمة */
      if (f.todos.length > 5) {
        issues.push({
          type: 'many_todos', severity: 'LOW',
          file: f.name,
          message: `${f.todos.length} TODO غير منجز`
        });
      }

      /* مفاتيح API مكشوفة */
      const apiKeyPattern = /(?:sk-|AQ\.|nfp_|AIza)[A-Za-z0-9_-]{20,}/;
      if (f.lang !== 'env' && apiKeyPattern.test(f.content || '')) {
        issues.push({
          type: 'exposed_key', severity: 'HIGH',
          file: f.name,
          message: 'مفتاح API مكشوف في الكود!'
        });
      }
    });

    return issues;
  }

  /* ── الحالة الداخلية ── */
  let _lastAnalysis = null;

  return {

    /* ═══════════════════════════════════════
       تحليل مشروع من قائمة ملفات
       ═══════════════════════════════════════ */
    async analyze(filesMap) {
      /* filesMap = { 'filename.js': 'content', ... } */
      Logger.info('ANALYZER', `تحليل مشروع — ${Object.keys(filesMap).length} ملف`);
      const t = Logger.time('project:analyze');
      const g = Logger.group('project-analysis');

      const analyzedFiles = [];

      for (const [name, content] of Object.entries(filesMap)) {
        try {
          const info = _analyzeFile(name, content);
          info.content = content;  /* احتفظ بالمحتوى للبحث */
          analyzedFiles.push(info);
        } catch (err) {
          Logger.warn('ANALYZER', `فشل تحليل ${name}: ${err.message}`);
        }
      }

      const depMap = _buildDependencyMap(analyzedFiles);
      const issues = _detectIssues(analyzedFiles, depMap);

      /* إحصاءات */
      const stats = {
        totalFiles:  analyzedFiles.length,
        totalLines:  analyzedFiles.reduce((s, f) => s + f.lines, 0),
        totalSize:   analyzedFiles.reduce((s, f) => s + f.size,  0),
        byLanguage:  {},
        functions:   analyzedFiles.reduce((s, f) => s + f.functions.length, 0),
        todos:       analyzedFiles.reduce((s, f) => s + f.todos.length, 0)
      };

      analyzedFiles.forEach(f => {
        stats.byLanguage[f.lang] = (stats.byLanguage[f.lang] || 0) + 1;
      });

      /* اكتشاف نوع المشروع */
      const stack = _detectStack(analyzedFiles);

      const analysis = {
        id:          `analysis_${Date.now()}`,
        analyzedAt:  new Date().toISOString(),
        files:       analyzedFiles,
        depMap,
        issues,
        stats,
        stack,
        entryPoints: _findEntryPoints(analyzedFiles)
      };

      _lastAnalysis = analysis;
      t.end();
      g.end();

      /* حفظ في الذاكرة */
      Memory.setProject({
        name:        stack.name || 'مشروع غير محدد',
        stack:       stack.techs.join(', '),
        files:       analyzedFiles.map(f => f.name),
        description: `${stack.name} — ${stats.totalFiles} ملف، ${stats.totalLines} سطر`
      });

      Logger.info('ANALYZER', `✅ تحليل مكتمل — ${issues.length} مشكلة مكتشفة`);
      return analysis;
    },

    /* ═══════════════════════════════════════
       تحديد الملفات المتأثرة بتعديل
       ═══════════════════════════════════════ */
    findAffectedFiles(targetFile) {
      if (!_lastAnalysis) return [targetFile];

      const depMap = _lastAnalysis.depMap;
      const affected = new Set([targetFile]);

      /* الملفات التي تستورد الهدف */
      const importedBy = depMap[targetFile]?.importedBy || [];
      importedBy.forEach(f => affected.add(f));

      /* الملفات التي يستوردها الهدف */
      const imports = depMap[targetFile]?.imports || [];
      imports.forEach(f => affected.add(f));

      Logger.info('ANALYZER', `ملفات متأثرة بـ ${targetFile}: ${[...affected].join(', ')}`);
      return [...affected];
    },

    /* ═══════════════════════════════════════
       البحث في كود المشروع
       ═══════════════════════════════════════ */
    searchInProject(query) {
      if (!_lastAnalysis) return [];

      const results = [];
      const q = query.toLowerCase();

      _lastAnalysis.files.forEach(f => {
        if (!f.content) return;
        const lines = f.content.split('\n');
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes(q)) {
            results.push({
              file:   f.name,
              line:   idx + 1,
              text:   line.trim(),
              lang:   f.lang
            });
          }
        });
      });

      Logger.info('ANALYZER', `بحث عن "${query}": ${results.length} نتيجة`);
      return results;
    },

    /* ═══════════════════════════════════════
       الحصول على آخر تحليل
       ═══════════════════════════════════════ */
    getLastAnalysis() { return _lastAnalysis; },

    /* ═══════════════════════════════════════
       بناء ملخص نصي للمشروع
       ═══════════════════════════════════════ */
    buildSummary() {
      if (!_lastAnalysis) return 'لم يتم تحليل أي مشروع بعد';

      const a = _lastAnalysis;
      let s = `## 📁 ملخص المشروع\n\n`;
      s += `**النوع:** ${a.stack.name}\n`;
      s += `**التقنيات:** ${a.stack.techs.join(', ')}\n`;
      s += `**الإجماليات:** ${a.stats.totalFiles} ملف | ${a.stats.totalLines.toLocaleString()} سطر\n\n`;

      s += `### الملفات:\n`;
      a.files.forEach(f => {
        s += `- ${f.icon} \`${f.name}\` (${f.lines} سطر) — ${f.role}\n`;
      });

      if (a.issues.length > 0) {
        s += `\n### ⚠️ مشاكل مكتشفة:\n`;
        a.issues.forEach(i => {
          const icon = i.severity === 'HIGH' ? '🔴' : i.severity === 'MEDIUM' ? '🟡' : '🟢';
          s += `- ${icon} \`${i.file}\`: ${i.message}\n`;
        });
      }

      return s;
    },

    /* ═══════════════════════════════════════
       توليد خريطة المشروع (نصية)
       ═══════════════════════════════════════ */
    buildProjectMap() {
      if (!_lastAnalysis) return '';

      const files = _lastAnalysis.files;
      const folders = {};

      files.forEach(f => {
        const parts = f.name.split('/');
        const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
        if (!folders[folder]) folders[folder] = [];
        folders[folder].push(f);
      });

      let map = '';
      for (const [folder, fls] of Object.entries(folders)) {
        map += `📂 ${folder === '/' ? 'الجذر' : folder}\n`;
        fls.forEach(f => {
          map += `  ${f.icon} ${f.name.split('/').pop()} (${f.lines} سطر)\n`;
        });
      }

      return map;
    }
  };

  /* ── اكتشاف تقنيات المشروع ── */
  function _detectStack(files) {
    const names   = files.map(f => f.name);
    const langs   = files.map(f => f.lang);
    const techs   = [];
    let name = 'مشروع غير معروف';

    if (names.some(n => n === 'package.json')) techs.push('Node.js');
    if (langs.includes('react'))   { techs.push('React'); name = 'تطبيق React'; }
    if (langs.includes('html'))    { techs.push('HTML');  name = name === 'مشروع غير معروف' ? 'موقع ويب' : name; }
    if (langs.includes('python'))  { techs.push('Python'); name = 'تطبيق Python'; }
    if (langs.includes('typescript')) techs.push('TypeScript');
    if (names.some(n => n.includes('netlify')))  techs.push('Netlify');
    if (names.some(n => n.includes('vite')))     techs.push('Vite');
    if (names.some(n => n.includes('next')))     { techs.push('Next.js'); name = 'تطبيق Next.js'; }
    if (names.some(n => n.includes('tailwind'))) techs.push('Tailwind CSS');

    return { name, techs: techs.length > 0 ? techs : ['غير محدد'] };
  }

  function _findEntryPoints(files) {
    const entryNames = ['index.html', 'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.py'];
    return files
      .filter(f => entryNames.some(e => f.name.endsWith(e)))
      .map(f => f.name);
  }
})();

Logger.info('SYSTEM', '✅ محرك فهم المشاريع جاهز');
