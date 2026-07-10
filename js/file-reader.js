/* ══════════════════════════════════════════════════════════════
   file-reader.js — قارئ الملفات (PDF · Word · Excel · Text)
   Galaoum AI Engine v5.0 — by عمار جلعوم
   ══════════════════════════════════════════════════════════════ */

window.FileReader2 = (function () {

  let _pdfLib   = false;
  let _mammoth  = false;

  /* ═══════ تحميل المكتبات ═══════ */
  async function _loadPDF() {
    if (_pdfLib) return;
    await _loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs', true);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs';
    _pdfLib = true;
  }

  async function _loadMammoth() {
    if (_mammoth) return;
    await _loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');
    _mammoth = true;
  }

  function _loadScript(src, isModule = false) {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src;
      if (isModule) s.type = 'module';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  /* ═══════ قراءة PDF ═══════ */
  async function readPDF(file) {
    await _loadPDF();
    const buffer = await file.arrayBuffer();
    const pdf    = await pdfjsLib.getDocument({ data: buffer }).promise;
    const total  = pdf.numPages;
    let text = '';

    for (let i = 1; i <= Math.min(total, 50); i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(it => it.str).join(' ');
      text += `\n--- صفحة ${i} ---\n${pageText}`;
    }
    if (total > 50) text += `\n\n[... ${total - 50} صفحة إضافية لم تُقرأ]`;
    return { text: text.trim(), pages: total, type: 'pdf', name: file.name };
  }

  /* ═══════ قراءة Word (docx) ═══════ */
  async function readWord(file) {
    await _loadMammoth();
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return { text: result.value.trim(), type: 'word', name: file.name };
  }

  /* ═══════ قراءة Excel (csv بسيط) ═══════ */
  async function readCSV(file) {
    const text = await file.text();
    const rows = text.split('\n').slice(0, 100).map(r => r.split(',').join(' | '));
    return { text: rows.join('\n'), type: 'csv', name: file.name };
  }

  /* ═══════ قراءة نص ═══════ */
  async function readText(file) {
    const text = await file.text();
    return { text: text.substring(0, 50000), type: 'text', name: file.name };
  }

  /* ═══════ اختيار القارئ المناسب ═══════ */
  async function readFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf')                       return await readPDF(file);
    if (ext === 'docx' || ext === 'doc')     return await readWord(file);
    if (ext === 'csv' || ext === 'xlsx')     return await readCSV(file);
    if (['txt','md','js','ts','py','html',
         'css','json','xml','yaml'].includes(ext)) return await readText(file);
    return { text: '[نوع الملف غير مدعوم]', type: 'unknown', name: file.name };
  }

  /* ═══════ فتح اللوحة ═══════ */
  function openPanel() {
    const p = document.getElementById('file-reader-panel');
    if (p) p.style.display = 'flex';
  }
  function closePanel() {
    const p = document.getElementById('file-reader-panel');
    if (p) p.style.display = 'none';
  }

  /* ═══════ معالجة رفع الملف ═══════ */
  async function handleUpload(input) {
    const file = input.files?.[0];
    if (!file) return;
    const statusEl = document.getElementById('fr-status');
    const resultEl = document.getElementById('fr-result');
    const askEl    = document.getElementById('fr-ask-wrap');

    if (statusEl) statusEl.textContent = `⏳ جارٍ قراءة ${file.name}...`;
    if (resultEl) resultEl.innerHTML = '';

    try {
      const data = await readFile(file);
      const preview = data.text.substring(0, 800);
      const ext = { pdf:'📄', word:'📝', csv:'📊', text:'📋', unknown:'📁' };

      if (statusEl) statusEl.textContent =
        `✅ تمّت القراءة — ${data.pages ? data.pages + ' صفحة' : Math.round(data.text.length/1000)+'K حرف'}`;

      if (resultEl) resultEl.innerHTML = `
        <div class="fr-preview">
          <div class="fr-preview-header">${ext[data.type]||'📄'} ${data.name}</div>
          <pre class="fr-preview-text">${preview.replace(/</g,'&lt;')}${data.text.length > 800 ? '\n...' : ''}</pre>
        </div>`;

      /* حفظ المحتوى للسؤال عنه */
      window._frCurrentFile = data;
      if (askEl) askEl.style.display = 'flex';

    } catch (e) {
      if (statusEl) statusEl.textContent = '❌ خطأ: ' + e.message;
    }
    input.value = '';
  }

  /* ═══════ السؤال عن الملف ═══════ */
  async function askAboutFile() {
    const data = window._frCurrentFile;
    const q    = document.getElementById('fr-question')?.value?.trim();
    if (!data || !q) return;

    closePanel();

    /* حقن محتوى الملف في السؤال */
    const enriched = `[محتوى الملف: ${data.name}]
${data.text.substring(0, 8000)}
[/نهاية الملف]

سؤالي عن هذا الملف:
${q}`;

    /* إرسال للـ chatbox */
    const inp = document.getElementById('user-input') || document.querySelector('#chat-form textarea, #chat-form input[type=text]');
    if (inp) {
      inp.value = enriched;
      const ev = new Event('input', { bubbles: true });
      inp.dispatchEvent(ev);
      /* محاولة إرسال تلقائي */
      const form = document.getElementById('chat-form');
      if (form) {
        const submitBtn = form.querySelector('button[type=submit], .send-btn, #send-btn');
        if (submitBtn) submitBtn.click();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    }
  }

  return { readFile, openPanel, closePanel, handleUpload, askAboutFile };
})();
