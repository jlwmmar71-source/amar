/* ══════════════════════════════════════════════
   preview-panel.js — لوحة المعاينة الحية
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

const PreviewPanel = (() => {
  let panel, lpHeader, lpBody;
  let autoCloseTimer = null;

  function init() {
    panel    = document.getElementById('live-preview-panel');
    lpHeader = document.getElementById('lp-header-title');
    lpBody   = document.getElementById('lp-body');
  }

  /* ── إظهار اللوحة مع عنوان وأيقونة ── */
  function show(title, icon) {
    if (!panel) init();
    clearTimeout(autoCloseTimer);
    if (lpHeader) lpHeader.innerHTML = `<span style="font-size:17px">${icon}</span> ${title} <span class="lp-dot">●</span>`;
    panel.classList.add('open');
  }

  /* ── إخفاء اللوحة ── */
  function hide() {
    if (!panel) init();
    panel.classList.remove('open');
  }

  /* ── حالة التحميل ── */
  function setLoading(msg) {
    if (!lpBody) init();
    lpBody.innerHTML = `
      <div class="lp-center">
        <div class="lp-spinner"></div>
        <div class="lp-hint">${msg}</div>
      </div>`;
  }

  /* ══════════════════════════════════════════════
     معاينة HTML مباشرة في iframe
     ══════════════════════════════════════════════ */
  function showHTML(htmlContent, title) {
    show(title || 'معاينة التطبيق', '🖥️');
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    lpBody.innerHTML = `
      <div class="lp-toolbar">
        <span class="lp-tag">معاينة مباشرة</span>
        <a href="${url}" target="_blank" class="lp-link">↗ فتح في تبويب</a>
      </div>
      <iframe src="${url}" class="lp-iframe" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`;
  }

  /* ══════════════════════════════════════════════
     معاينة الصورة المولّدة
     ══════════════════════════════════════════════ */
  function showImage(url, prompt) {
    show('صورة مولّدة', '🎨');
    lpBody.innerHTML = `
      <div class="lp-img-wrap">
        ${prompt ? `<div class="lp-prompt-box">${prompt.substring(0,120)}</div>` : ''}
        <div class="lp-img-area">
          <img src="${url}" class="lp-img"
            onerror="this.outerHTML='<p class=lp-err>⚠️ فشل تحميل الصورة</p>'">
        </div>
        <a href="${url}" download="galaoum_image.jpg" target="_blank" class="lp-dl-btn">⬇️ تحميل الصورة</a>
      </div>`;
    autoCloseTimer = setTimeout(hide, 90000);
  }

  /* ══════════════════════════════════════════════
     معاينة الملفات المعدّلة (مع tabs)
     ══════════════════════════════════════════════ */
  function showFiles(files, title) {
    show(title || 'ملفات معدّلة', '⚙️');
    if (!files || !files.length) { setLoading('جارٍ تطبيق التعديلات...'); return; }

    window._lpFiles = files;
    _renderFileTab(0);
  }

  function _renderFileTab(idx) {
    const files = window._lpFiles || [];
    const f     = files[idx];
    if (!f || !lpBody) return;

    const tabs = files.map((file, i) => `
      <button onclick="lpTab(${i})" id="lp-tab-${i}" class="lp-tab ${i===idx?'active':''}">
        ${_fileIcon(file.name)} ${file.name.split('/').pop()}
      </button>`).join('');

    lpBody.innerHTML = `
      <div class="lp-tabs-bar">${tabs}</div>
      <div class="lp-file-meta">
        <span id="lp-fname">${f.name}</span>
        <span class="lp-chars">${(f.content||'').length} حرف</span>
      </div>
      <pre id="lp-code" class="lp-code">${_esc(f.content||'')}</pre>`;
  }

  /* ══════════════════════════════════════════════
     معاينة نتائج البحث
     ══════════════════════════════════════════════ */
  function showSearch(query, rawText) {
    show('نتائج البحث', '🌐');
    if (!rawText) { setLoading('جارٍ البحث عن: ' + query); return; }

    const lines  = rawText.split('\n').filter(l => l.trim());
    const cards  = lines.slice(0, 20).map(l => `
      <div class="lp-card">
        <div class="lp-card-text">${_esc(l.trim())}</div>
      </div>`).join('');

    lpBody.innerHTML = `
      <div class="lp-search-q">🔍 ${_esc(query)}</div>
      <div class="lp-cards">${cards || '<div class="lp-hint">لا توجد نتائج</div>'}</div>`;
  }

  /* ══════════════════════════════════════════════
     معاينة حالة النشر
     ══════════════════════════════════════════════ */
  function showDeploy(status, url) {
    show('النشر على Netlify', '🚀');
    if (status === 'loading') {
      lpBody.innerHTML = `
        <div class="lp-center">
          <div class="lp-spinner lp-spinner-lg"></div>
          <div class="lp-deploy-title">جارٍ الرفع على Netlify...</div>
          <div class="lp-hint">قد يستغرق 10–30 ثانية</div>
          <div class="lp-progress"><div class="lp-progress-bar"></div></div>
        </div>`;
    } else if (status === 'success') {
      lpBody.innerHTML = `
        <div class="lp-center">
          <div class="lp-emoji">🎉</div>
          <div class="lp-success">تم النشر بنجاح!</div>
          ${url ? `<a href="${url}" target="_blank" class="lp-site-btn">🌐 فتح الموقع المنشور</a>` : ''}
        </div>`;
      autoCloseTimer = setTimeout(hide, 60000);
    } else {
      lpBody.innerHTML = `
        <div class="lp-center">
          <div class="lp-emoji">⚠️</div>
          <div class="lp-err">${_esc(status)}</div>
        </div>`;
    }
  }

  /* ══ مساعدات ══ */
  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function _fileIcon(name) {
    const ext = (name||'').split('.').pop().toLowerCase();
    return {html:'🌐',css:'🎨',js:'⚡',ts:'🔷',py:'🐍',json:'📋',md:'📄'}[ext] || '📄';
  }

  document.addEventListener('DOMContentLoaded', init);
  return { show, hide, setLoading, showHTML, showImage, showFiles, showSearch, showDeploy };
})();
window.PreviewPanel = PreviewPanel;;

/* ── تبديل التبويبات (يُستدعى من onclick) ── */
function lpTab(idx) {
  const files = window._lpFiles || [];
  const f     = files[idx];
  if (!f) return;

  const code = document.getElementById('lp-code');
  const fname = document.getElementById('lp-fname');
  if (code)  code.textContent = f.content || '';
  if (fname) fname.textContent = f.name;

  document.querySelectorAll('.lp-tab').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
}
