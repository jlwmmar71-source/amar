/* ══════════════════════════════════════════════════════════════
   project-intelligence.js — محرك ذكاء المشروع (Project Intelligence)
   تحليل عميق: استخراج الدوال/الكلاسات، اكتشاف الاستيرادات،
   تقدير التعقيد، اكتشاف الكود الميت، الروائح البرمجية، تأثير التعديل
   Galaoum AI Engine v5.0 — نسخة محسّنة
   ══════════════════════════════════════════════════════════════ */

window.ProjectIntelligence = (function () {

  const ENTRY_HINTS = ['index.html','app.js','main.js','index.js','config.js','server.js','package.json'];

  /* ══════════════════════════════════════════════
     1. التحليل الرئيسي
     ══════════════════════════════════════════════ */
  function analyze(files) {
    if (!Array.isArray(files) || files.length === 0) return _empty();

    const parsed   = files.map(f => ({ ...f, meta: _parseFile(f) }));
    const graph    = _buildGraph(parsed);
    const important = _rankImportance(parsed, graph);
    const smells   = parsed.flatMap(f => _detectSmells(f).map(s => ({ ...s, file: f.path })));
    const dead     = _findDeadCode(parsed, graph);
    const summary  = _buildSummary(parsed, graph, smells);

    return { fileCount: files.length, graph, important, smells, dead, summary };
  }

  /* ══════════════════════════════════════════════
     2. تحليل ملف منفرد (شبيه AST خفيف)
     ══════════════════════════════════════════════ */
  function _parseFile(f) {
    const code = f.content || '';
    const ext  = (f.path || '').split('.').pop()?.toLowerCase();
    const isJS = ['js','ts','jsx','tsx'].includes(ext);
    const isCSS = ['css','scss','less'].includes(ext);

    const result = {
      ext, isJS, isCSS, lines: code.split('\n').length, chars: code.length,
      functions: [], classes: [], imports: [], exports: [],
      complexity: 0, todos: 0, debugCalls: 0, longLines: 0, unusedVars: []
    };
    if (!isJS) return result;

    /* ── استخراج الدوال ── */
    const fnPatterns = [
      /function\s+(\w+)\s*\(/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*function/g,
      /(\w+)\s*:\s*(?:async\s*)?function/g,
      /async\s+function\s+(\w+)/g,
      /(\w+)\s*\([^)]*\)\s*{/g
    ];
    for (const re of fnPatterns) {
      let m;
      while ((m = re.exec(code)) !== null) {
        const name = m[1];
        if (name && !result.functions.includes(name) && name.length < 50 && !/^(if|for|while|switch|catch|do)$/.test(name)) {
          result.functions.push(name);
        }
      }
    }

    /* ── استخراج الكلاسات ── */
    const classRe = /class\s+(\w+)/g;
    let mc;
    while ((mc = classRe.exec(code)) !== null) result.classes.push(mc[1]);

    /* ── استخراج الاستيرادات ── */
    const importRe = /(?:import|require)\s*(?:\(['"](.*?)['"]\)|.*?from\s+['"](.*?)['"])/g;
    let mi;
    while ((mi = importRe.exec(code)) !== null) {
      const mod = mi[1] || mi[2];
      if (mod) result.imports.push(mod);
    }
    /* script src */
    const srcRe = /src=['"](.*?)['"]/g;
    let ms;
    while ((ms = srcRe.exec(code)) !== null) {
      const s = ms[1];
      if (s && !s.startsWith('http')) result.imports.push(s);
    }

    /* ── استخراج الصادرات ── */
    const exportRe = /(?:export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)|return\s*\{([^}]{1,300})\})/g;
    let me;
    while ((me = exportRe.exec(code)) !== null) {
      if (me[1]) result.exports.push(me[1]);
      if (me[2]) {
        me[2].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean).forEach(n => {
          if (n.length < 50 && /^\w+$/.test(n)) result.exports.push(n);
        });
      }
    }
    result.exports = [...new Set(result.exports)];

    /* ── تعقيد دوّرية مُبسَّطة (Cyclomatic Complexity تقريباً) ── */
    const branchWords = /\b(if|else|for|while|switch|case|catch|\?\?|&&|\|\||\?\.)/g;
    result.complexity = (code.match(branchWords) || []).length;

    /* ── ملاحظات TODO/FIXME ── */
    result.todos = (code.match(/\b(TODO|FIXME|HACK|XXX)\b/gi) || []).length;

    /* ── استدعاءات التصحيح ── */
    result.debugCalls = (code.match(/console\.(log|warn|error|debug)\s*\(/g) || []).length;

    /* ── أسطر طويلة (> 120 حرف) ── */
    result.longLines = code.split('\n').filter(l => l.length > 120).length;

    /* ── اكتشاف متغيرات معرَّفة وغير مستخدمة ── */
    const declared = [];
    const declRe = /(?:const|let|var)\s+(\w+)\s*=/g;
    let md;
    while ((md = declRe.exec(code)) !== null) declared.push(md[1]);
    result.unusedVars = declared.filter(v => {
      const uses = (code.match(new RegExp(`\\b${v}\\b`, 'g')) || []).length;
      return uses <= 1; /* مرة واحدة = التعريف فقط */
    }).slice(0, 10); // أقصى 10

    return result;
  }

  /* ══════════════════════════════════════════════
     3. رسم العلاقات بين الملفات
     ══════════════════════════════════════════════ */
  function _buildGraph(files) {
    const graph = {};
    for (const f of files) {
      graph[f.path] = { references: [], referencedBy: [], functions: f.meta.functions, classes: f.meta.classes };
    }

    for (const f of files) {
      /* استيرادات صريحة */
      for (const imp of (f.meta.imports || [])) {
        const target = files.find(o => o.path.endsWith(imp) || o.path.includes(imp.replace(/^\.\//, '')));
        if (target && target.path !== f.path) {
          if (!graph[f.path].references.includes(target.path)) {
            graph[f.path].references.push(target.path);
            graph[target.path].referencedBy.push(f.path);
          }
        }
      }
      /* مراجع ضمنية (ذكر اسم الملف) */
      for (const other of files) {
        if (other.path === f.path) continue;
        const base = other.path.split('/').pop().replace(/\.\w+$/, '');
        if (base.length < 3) continue;
        if (f.content && f.content.includes(base) && !graph[f.path].references.includes(other.path)) {
          graph[f.path].references.push(other.path);
          if (!graph[other.path].referencedBy.includes(f.path)) {
            graph[other.path].referencedBy.push(f.path);
          }
        }
      }
    }
    return graph;
  }

  /* ══════════════════════════════════════════════
     4. ترتيب الأهمية
     ══════════════════════════════════════════════ */
  function _rankImportance(files, graph) {
    return files.map(f => {
      const node      = graph[f.path] || {};
      const refCount  = (node.referencedBy || []).length;
      const refTo     = (node.references || []).length;
      const isEntry   = ENTRY_HINTS.some(h => f.path.endsWith(h));
      const fnScore   = Math.min((f.meta.functions || []).length * 2, 30);
      const sizeScore = Math.min((f.meta.chars || 0) / 1000, 20);
      const score     = refCount * 10 + refTo * 2 + (isEntry ? 50 : 0) + fnScore + sizeScore;
      return {
        path: f.path, score: Math.round(score), isEntry, refCount, refTo,
        functions: (f.meta.functions || []).slice(0, 5),
        complexity: f.meta.complexity || 0
      };
    }).sort((a, b) => b.score - a.score);
  }

  /* ══════════════════════════════════════════════
     5. اكتشاف الروائح البرمجية (Code Smells)
     ══════════════════════════════════════════════ */
  function _detectSmells(f) {
    const smells = [];
    if (!f.meta.isJS) return smells;
    const meta = f.meta;
    const code = f.content || '';

    if (meta.complexity > 50)
      smells.push({ type: 'high_complexity', severity: 'high', detail: `تعقيد مرتفع (${meta.complexity} نقطة تفرّع)` });
    if (meta.lines > 800)
      smells.push({ type: 'large_file', severity: 'medium', detail: `ملف ضخم (${meta.lines} سطر) — فكّر في التقسيم` });
    if (meta.debugCalls > 5)
      smells.push({ type: 'debug_code', severity: 'low', detail: `${meta.debugCalls} استدعاء console — احذفها من الإنتاج` });
    if (meta.todos > 3)
      smells.push({ type: 'todo_overload', severity: 'low', detail: `${meta.todos} TODO/FIXME غير منجزة` });
    if (meta.longLines > 10)
      smells.push({ type: 'long_lines', severity: 'info', detail: `${meta.longLines} سطر يتجاوز 120 حرفاً` });
    if (meta.unusedVars.length > 3)
      smells.push({ type: 'unused_vars', severity: 'low', detail: `متغيرات غير مستخدمة محتملة: ${meta.unusedVars.join(', ')}` });
    if (/function\s+\w+[^{]{200,}/s.test(code))
      smells.push({ type: 'long_function', severity: 'medium', detail: 'دالة طويلة جداً — فكّر في تقسيمها' });
    if ((code.match(/if\s*\(/g) || []).length > 20)
      smells.push({ type: 'deep_nesting', severity: 'medium', detail: 'عدد if كبير — فكّر في تبسيط المنطق' });
    if (/var\s+\w+/g.test(code) && meta.lines > 50)
      smells.push({ type: 'var_usage', severity: 'low', detail: 'استخدام var — يُفضَّل let/const' });
    if (/new\s+Promise\s*\(\s*\(resolve.*reject.*\)\s*=>\s*{[\s\S]{1,50}resolve\s*\([\s\S]{1,200}reject/g.test(code))
      smells.push({ type: 'promise_anti_pattern', severity: 'low', detail: 'قد يكون async/await أوضح من new Promise' });

    return smells;
  }

  /* ══════════════════════════════════════════════
     6. اكتشاف الكود الميت
     ══════════════════════════════════════════════ */
  function _findDeadCode(files, graph) {
    const dead = [];
    for (const f of files) {
      const node = graph[f.path] || {};
      /* ملف لا يُشير إليه أحد وليس نقطة دخول */
      if (!node.referencedBy?.length && !ENTRY_HINTS.some(h => f.path.endsWith(h))) {
        dead.push({ path: f.path, reason: 'لا يُستورد من أي ملف آخر' });
      }
      /* دوال معرَّفة ولا تُذكر إلا مرة */
      for (const fn of (f.meta?.functions || [])) {
        const totalUses = files.reduce((acc, other) => {
          if (other.path === f.path) return acc;
          return acc + (other.content?.includes(fn) ? 1 : 0);
        }, 0);
        if (totalUses === 0 && fn.length > 3 && !['init','main','run','start','setup'].includes(fn)) {
          dead.push({ path: f.path, reason: `الدالة '${fn}' لا تُستخدم خارج الملف` });
        }
      }
    }
    return dead.slice(0, 20); // أقصى 20 نتيجة
  }

  /* ══════════════════════════════════════════════
     7. ملخص المشروع
     ══════════════════════════════════════════════ */
  function _buildSummary(files, graph, smells) {
    const totalLines   = files.reduce((s, f) => s + (f.meta?.lines || 0), 0);
    const totalFns     = files.reduce((s, f) => s + (f.meta?.functions?.length || 0), 0);
    const totalClasses = files.reduce((s, f) => s + (f.meta?.classes?.length || 0), 0);
    const avgComplex   = Math.round(files.filter(f => f.meta?.isJS).reduce((s, f) => s + (f.meta?.complexity || 0), 0) / Math.max(files.filter(f => f.meta?.isJS).length, 1));
    const languages    = {};
    files.forEach(f => { const e = f.meta?.ext || 'other'; languages[e] = (languages[e] || 0) + 1; });

    return {
      totalFiles: files.length, totalLines, totalFns, totalClasses, avgComplex,
      languages, smellCount: smells.length,
      health: smells.filter(s => s.severity === 'high').length > 3 ? 'سيئ' :
              smells.filter(s => ['high','medium'].includes(s.severity)).length > 5 ? 'متوسط' : 'جيد'
    };
  }

  /* ══════════════════════════════════════════════
     8. واجهة عامة إضافية
     ══════════════════════════════════════════════ */

  /* توقّع أثر تعديل ملف */
  function predictImpact(filePath, analysis) {
    const node = analysis?.graph?.[filePath];
    if (!node) return { affected: [], risk: 'unknown', ripple: [] };
    const direct  = node.referencedBy || [];
    /* أثر غير مباشر: من يستورد الملفات المتأثرة */
    const ripple  = direct.flatMap(p => (analysis.graph[p]?.referencedBy || [])).filter(p => !direct.includes(p));
    const total   = direct.length + ripple.length;
    const risk    = total > 8 ? 'high' : total > 3 ? 'medium' : 'low';
    return { affected: direct, ripple: [...new Set(ripple)], risk };
  }

  /* تحليل ملف واحد بشكل مستقل */
  function analyzeFile(path, content) {
    const f = { path, content };
    f.meta  = _parseFile(f);
    const smells = _detectSmells(f);
    return { path, meta: f.meta, smells };
  }

  /* اقتراح تقسيم المشروع إلى وحدات */
  function suggestModules(analysis) {
    if (!analysis?.important) return [];
    const top = analysis.important.slice(0, 10);
    const suggestions = [];
    const entries = top.filter(f => f.isEntry);
    const utils   = top.filter(f => f.path.includes('util') || f.path.includes('helper'));
    const heavy   = top.filter(f => f.complexity > 30);
    if (entries.length > 1) suggestions.push('فكّر في توحيد نقاط الدخول المتعددة');
    if (utils.length === 0)  suggestions.push('يُنصح بإنشاء ملف utils.js لتجميع الدوال المشتركة');
    if (heavy.length > 0)    suggestions.push(`الملفات ذات التعقيد العالي تستحق التقسيم: ${heavy.map(f=>f.path.split('/').pop()).join(', ')}`);
    return suggestions;
  }

  function _empty() {
    return { fileCount: 0, graph: {}, important: [], smells: [], dead: [], summary: { totalFiles: 0, health: 'غير معروف' } };
  }

  return { analyze, analyzeFile, predictImpact, suggestModules };

})();
