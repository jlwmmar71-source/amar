/* ══════════════════════════════════════════════
   ui.js — بناء وتحديث عناصر الواجهة
   Galaoum AI Engine v6.0
   ══════════════════════════════════════════════ */

/* ── إضافة رسالة جديدة إلى الشات ── */
function addMessage(sender, html, extras = {}) {
  const id     = 'm' + (++msgId);
  const isUser = sender === 'user';
  const time   = formatTime(new Date());

  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = 'display:flex;align-items:flex-end;gap:10px' + (isUser ? ';flex-direction:row-reverse' : '');

  const avatar = document.createElement('div');
  avatar.style.cssText = 'width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;color:#fff;background:'
    + (isUser ? 'linear-gradient(135deg,#991b1b,#dc2626)' : 'linear-gradient(135deg,#1e40af,#6d28d9)');
  avatar.textContent = isUser ? 'أ' : '🤖';

  const bubble = document.createElement('div');
  bubble.style.cssText = 'max-width:82%;display:flex;flex-direction:column;gap:6px;align-items:'
    + (isUser ? 'flex-end' : 'flex-start');

  const content = document.createElement('div');
  content.className = isUser ? '' : 'msg-bot';
  content.style.cssText = 'padding:10px 14px;border-radius:16px;font-size:13px;line-height:1.65;'
    + (isUser
      ? 'background:linear-gradient(135deg,#991b1b,#dc2626);color:#fff;border-radius:16px 16px 4px 16px'
      : 'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);color:#e2e8f0;border-radius:16px 16px 16px 4px');
  content.innerHTML = html;

  const ts = document.createElement('div');
  ts.style.cssText = 'font-size:10px;color:#475569;padding:0 4px';
  ts.textContent = time;

  bubble.appendChild(content);

  if (extras.downloads) {
    extras.downloads.forEach(d => {
      const a = document.createElement('a');
      a.className = d.isSelf ? 'self-edit-btn' : 'download-btn';
      a.href = d.url;
      a.download = d.name;
      a.innerHTML = (d.isSelf ? '🔄 ' : '⬇️ ') + d.name;
      bubble.appendChild(a);
    });
  }

  bubble.appendChild(ts);
  div.appendChild(avatar);
  div.appendChild(bubble);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  saveChat();
  return id;
}

/* ── تحديث رسالة موجودة ── */
function updateMessage(id, html, extras = {}) {
  const el = document.getElementById(id);
  if (!el) return;

  const content = el.querySelector('.msg-bot') || el.querySelectorAll('div')[1]?.querySelector('div');
  if (content) content.innerHTML = html;

  if (extras.downloads) {
    const bubble = el.querySelectorAll('div')[1];
    extras.downloads.forEach(d => {
      const a = document.createElement('a');
      a.className = d.isSelf ? 'self-edit-btn' : 'download-btn';
      a.href = d.url;
      a.download = d.name;
      a.innerHTML = (d.isSelf ? '🔄 ' : '⬇️ ') + d.name;
      const ts = bubble.lastElementChild;
      bubble.insertBefore(a, ts);
    });
  }

  chatBox.scrollTop = chatBox.scrollHeight;
  saveChat();
}

/* ── عرض chips الملفات المرفقة ── */
function renderChips() {
  fileChipsBar.innerHTML = '';
  if (selectedFiles.length === 0) { fileChipsBar.style.display = 'none'; return; }
  fileChipsBar.style.display = 'flex';
  selectedFiles.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = fileIcon(f.name) + ' ' + f.name
      + ' <span style="color:#64748b">(' + formatSize(f.size) + ')</span>'
      + ' <button onclick="removeFile(' + i + ')">×</button>';
    fileChipsBar.appendChild(chip);
  });
}

/* ── عرض معاينة HTML داخل iframe ── */
function buildHTMLPreview(htmlContent, label) {
  label = label || 'معاينة مباشرة';
  const blobUrl = URL.createObjectURL(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }));
  const wid = 'pv' + Date.now();
  return '<div class="preview-frame-wrap">'
    + '<div class="preview-frame-bar">'
    + '<span>🖥️ ' + label + '</span>'
    + '<div style="display:flex;gap:6px">'
    + '<button onclick="document.getElementById(\'' + wid + '\').style.height='
    + '(parseInt(document.getElementById(\'' + wid + '\').style.height||\'400\')<600?\'600px\':\'400px\')">↕ تكبير</button>'
    + '<a href="' + blobUrl + '" target="_blank" '
    + 'style="background:rgba(220,38,38,.3);color:#c7d2fe;border:none;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;text-decoration:none">🔗 فتح كامل</a>'
    + '</div></div>'
    + '<iframe id="' + wid + '" class="preview-iframe" src="' + blobUrl + '" '
    + 'sandbox="allow-scripts allow-same-origin allow-forms" style="min-height:400px;height:400px"></iframe>'
    + '</div>';
}

/* ── بطاقة عرض الصورة المولّدة ── */
function buildImageCard(imgUrl, prompt) {
  const dlName = 'galaoum_' + Date.now() + '.jpg';
  return '<div style="margin-top:10px;border-radius:14px;overflow:hidden;border:1px solid rgba(220,38,38,.3)">'
    + '<img src="' + imgUrl + '" style="width:100%;max-width:520px;display:block;border-radius:14px 14px 0 0" '
    + 'onerror="this.parentElement.innerHTML=\'<p style=color:#fca5a5;padding:12px>⚠️ فشل تحميل الصورة</p>\'">'
    + '<div style="padding:8px 12px;background:rgba(0,0,0,.4);display:flex;justify-content:space-between;align-items:center">'
    + '<span style="font-size:11px;color:#94a3b8">🎨 Flux AI</span>'
    + '<a href="' + imgUrl + '" download="' + dlName + '" target="_blank" '
    + 'style="background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;border:none;border-radius:8px;'
    + 'padding:4px 12px;font-size:11px;text-decoration:none;font-weight:600">⬇️ تحميل</a>'
    + '</div></div>';
}

/* ── تشغيل الكود وإرجاع HTML النتيجة ── */
async function autoRunCode(lang, code) {
  try {
    const result = await executeCode(lang, code);
    const exitOk = result.exitCode === 0;
    const out = (result.output || result.stderr || 'لا يوجد مخرجات')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div style="margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid '
      + (exitOk ? '#065f46' : '#7f1d1d') + '">'
      + '<div style="background:' + (exitOk ? '#064e3b' : '#450a0a')
      + ';padding:6px 12px;font-size:11px;color:' + (exitOk ? '#6ee7b7' : '#fca5a5')
      + '">▶ نتيجة التشغيل — ' + result.language + ' ' + result.version + ' ' + (exitOk ? '✅' : '❌ خطأ') + '</div>'
      + '<pre style="margin:0;padding:12px;background:' + (exitOk ? '#022c22' : '#1a0a0a')
      + ';font-size:12px;color:' + (exitOk ? '#d1fae5' : '#fca5a5')
      + ';white-space:pre-wrap;word-break:break-all">' + out + '</pre>'
      + '</div>';
  } catch (e) {
    return '<div style="margin-top:10px;padding:10px;border-radius:10px;background:#1a0a0a;color:#fca5a5;font-size:12px">❌ فشل التشغيل: ' + e.message + '</div>';
  }
}

/* ── زر التشغيل في كتل الكود ── */
window.runCodeBlock = async function (btn, eid) {
  const pre    = document.getElementById(eid);
  const outDiv = document.getElementById('out' + eid);
  if (!pre || !outDiv) return;

  const code   = pre.textContent || pre.innerText;
  const langEl = pre.closest('div')?.querySelector('span');
  const lang   = langEl ? langEl.textContent.trim() : 'python';

  btn.disabled = true;
  btn.textContent = '⟳ جارٍ التشغيل...';

  try {
    const result = await executeCode(lang, code);
    const hasOut = result.output || result.stderr;
    const exitOk = result.exitCode === 0;
    outDiv.style.display = 'block';
    outDiv.innerHTML =
      '<div style="padding:10px 12px;background:' + (exitOk ? '#0a1628' : '#1a0a0a')
      + ';border-top:1px solid #2d2d5e">'
      + '<div style="font-size:11px;color:#f87171;margin-bottom:6px">'
      + (exitOk ? '✅' : '❌') + ' ' + result.language + ' ' + result.version + ' (exit: ' + result.exitCode + ')</div>'
      + (result.output ? '<pre style="margin:0;color:#d1fae5;font-size:12px;white-space:pre-wrap;word-break:break-all">'
        + result.output.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>' : '')
      + (result.stderr ? '<pre style="margin:4px 0 0;color:#fca5a5;font-size:12px;white-space:pre-wrap;word-break:break-all">'
        + result.stderr.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>' : '')
      + (!hasOut ? '<span style="color:#6b7280;font-size:12px">لا يوجد مخرجات</span>' : '')
      + '</div>';
    btn.textContent = '▶ إعادة التشغيل';
  } catch (e) {
    outDiv.style.display = 'block';
    outDiv.innerHTML = '<div style="padding:8px 12px;background:#1a0a0a;color:#fca5a5;font-size:12px;border-top:1px solid #3d1515">❌ ' + e.message + '</div>';
    btn.textContent = '▶ تشغيل';
  }

  btn.disabled = false;
};

/* ── حذف ملف من قائمة المرفقات ── */
window.removeFile = function (i) {
  selectedFiles.splice(i, 1);
  renderChips();
};
