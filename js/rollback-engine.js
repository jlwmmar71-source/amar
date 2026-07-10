/* ══════════════════════════════════════════════════════════════
   rollback-engine.js — محرك الاستعادة والتراجع (Recovery & Rollback)
   يبني فوق RecoveryManager: مقارنة إصدارات، تراجع بضغطة واحدة
   Galaoum AI Engine v5.0 — إضافة جديدة
   ══════════════════════════════════════════════════════════════ */

window.RollbackEngine = (function () {

  /* ── نقطة استعادة قبل أي تعديل (تفويض إلى RecoveryManager إن وُجد) ── */
  function checkpoint(label) {
    if (typeof RecoveryManager !== 'undefined' && RecoveryManager.snapshot) {
      return RecoveryManager.snapshot(label || 'قبل التعديل');
    }
    return null;
  }

  /* ── تراجع فوري بضغطة واحدة لآخر نقطة استعادة ── */
  function rollbackToLatest() {
    if (typeof RecoveryManager === 'undefined' || !RecoveryManager.restore) return false;
    const list = typeof RecoveryManager.list === 'function' ? RecoveryManager.list() : [];
    if (!list.length) return false;
    return RecoveryManager.restore(list[0].id);
  }

  /* ── التراجع إلى نسخة محددة بالمعرّف ── */
  function rollbackTo(snapshotId) {
    if (typeof RecoveryManager === 'undefined' || !RecoveryManager.restore) return false;
    return RecoveryManager.restore(snapshotId);
  }

  /* ── مقارنة نسختين (نصياً) لمعرفة الفروقات السطحية ── */
  function compareVersions(textA, textB) {
    const linesA = (textA || '').split('\n');
    const linesB = (textB || '').split('\n');
    const maxLen = Math.max(linesA.length, linesB.length);
    const diff = [];
    for (let i = 0; i < maxLen; i++) {
      if (linesA[i] !== linesB[i]) {
        diff.push({ line: i + 1, before: linesA[i] || '', after: linesB[i] || '' });
      }
    }
    return { changedLines: diff.length, diff };
  }

  return { checkpoint, rollbackToLatest, rollbackTo, compareVersions };
})();
