/* ══════════════════════════════════════════════════════════════
   quality-score.js — محرك درجة الجودة (Quality Score Engine)
   تقييم المشروع من 100: أمان، أداء، جودة كود، هيكلة
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.QualityScoreEngine = (function () {

  /* ── files: [{ path, content }] ── */
  function score(files) {
    const security  = _scoreSecurity(files);
    const perf      = _scorePerformance(files);
    const codeQual  = _scoreCodeQuality(files);
    const structure = _scoreStructure(files);

    const total = Math.round(security * 0.3 + perf * 0.2 + codeQual * 0.3 + structure * 0.2);
    return {
      total,
      breakdown: { security, performance: perf, codeQuality: codeQual, structure }
    };
  }

  function _scoreSecurity(files) {
    let s = 100;
    for (const f of files) {
      const c = f.content || '';
      if (/api[_-]?key\s*[:=]\s*['"][A-Za-z0-9\-_]{10,}/i.test(c)) s -= 25;
      if (/eval\s*\(/.test(c)) s -= 15;
      if (/innerHTML\s*=/.test(c)) s -= 5;
    }
    return Math.max(0, s);
  }

  function _scorePerformance(files) {
    let s = 100;
    for (const f of files) {
      const c = f.content || '';
      if (/for\s*\([^)]*\.length[^)]*\)/.test(c)) s -= 2;
      if ((c.match(/console\.log/g) || []).length > 5) s -= 5;
    }
    return Math.max(0, Math.min(100, s));
  }

  function _scoreCodeQuality(files) {
    let s = 100;
    for (const f of files) {
      const c = f.content || '';
      const varCount   = (c.match(/\bvar\s+/g) || []).length;
      const todoCount  = (c.match(/TODO|FIXME/gi) || []).length;
      s -= Math.min(20, varCount);
      s -= Math.min(10, todoCount * 2);
    }
    return Math.max(0, s);
  }

  function _scoreStructure(files) {
    const hasReadme  = files.some(f => /readme/i.test(f.path));
    const hasConfig  = files.some(f => /config/i.test(f.path));
    const folderDepth = Math.max(...files.map(f => f.path.split('/').length), 1);
    let s = 60;
    if (hasReadme) s += 15;
    if (hasConfig) s += 15;
    if (folderDepth > 1) s += 10;
    return Math.min(100, s);
  }

  return { score };
})();
