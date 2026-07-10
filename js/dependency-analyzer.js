/* ══════════════════════════════════════════════════════════════
   dependency-analyzer.js — محلل التبعيات (Dependency Analyzer)
   تحليل المكتبات، اكتشاف التعارضات والإصدارات القديمة، اقتراح تحديث
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.DependencyAnalyzer = (function () {

  /* ── تحليل ملف package.json (كنص JSON) ── */
  function analyzePackageJson(jsonText) {
    let pkg;
    try { pkg = JSON.parse(jsonText); } catch { return { error: 'JSON غير صالح' }; }

    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const findings = [];

    for (const [name, version] of Object.entries(deps)) {
      if (/^\*|^latest$/.test(version)) {
        findings.push({ name, version, issue: 'إصدار غير محدد بدقة (قد يسبب تعارضات)', severity: 'medium' });
      }
      if (/^\^0\./.test(version) || /^~0\./.test(version)) {
        findings.push({ name, version, issue: 'إصدار ما قبل 1.0 — غير مستقر', severity: 'low' });
      }
    }

    const conflicts = _detectDuplicateFamilies(deps);
    return { totalDeps: Object.keys(deps).length, findings, conflicts };
  }

  /* ── اكتشاف مكتبات متشابهة قد تتعارض (مثال: نفس الوظيفة من مصدرين) ── */
  function _detectDuplicateFamilies(deps) {
    const families = {
      http:   ['axios', 'node-fetch', 'got', 'superagent'],
      state:  ['redux', 'mobx', 'zustand', 'recoil'],
      test:   ['jest', 'mocha', 'vitest', 'ava']
    };
    const conflicts = [];
    for (const [family, libs] of Object.entries(families)) {
      const present = libs.filter(l => deps[l]);
      if (present.length > 1) conflicts.push({ family, libs: present });
    }
    return conflicts;
  }

  /* ── اقتراح تحديثات عامة بناءً على النتائج ── */
  function suggestUpdates(analysis) {
    if (!analysis || !analysis.findings) return [];
    return analysis.findings.map(f => `${f.name}: ${f.issue} — يُنصح بتثبيت إصدار محدد (semver دقيق).`);
  }

  return { analyzePackageJson, suggestUpdates };
})();
