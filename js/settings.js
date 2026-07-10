/* ══════════════════════════════════════════════
   settings.js — وضع التعديل الذاتي وإعدادات الواجهة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

/* ── الحصول على HTML الكامل للصفحة الحالية ── */
function getCurrentPageHTML() {
  return '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
}

/* ── تحديث الواجهة بناءً على حالة وضع التعديل الذاتي ── */
function applySelfEditUI() {
  const btn = document.getElementById('toggle-self-edit');
  if (selfEditMode) {
    selfEditBadge.style.display = 'flex';
    chatSection.classList.add('self-mode-active');
    userInput.style.borderColor = 'rgba(220,38,38,.5)';
    userInput.placeholder = 'اكتب أي طلب ← سيُعدّل المنصة ويرفعها مباشرة...';
    if (btn) btn.classList.remove('off');
  } else {
    selfEditBadge.style.display = 'none';
    chatSection.classList.remove('self-mode-active');
    userInput.style.borderColor = 'rgba(255,255,255,.1)';
    userInput.placeholder = 'اطلب تعديل أو تحليل ملف، أو اكتب سؤالاً...';
    if (btn) btn.classList.add('off');
  }
}
