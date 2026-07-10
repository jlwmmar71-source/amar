/* ══════════════════════════════════════════════
   app.js — التهيئة الرئيسية ومعالجة الأحداث
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

/* ══ مراجع DOM (الـ script يُحمَّل في نهاية body، DOM جاهز) ══ */
const chatBox       = document.getElementById('chat-box');
const chatForm      = document.getElementById('chat-form');
const userInput     = document.getElementById('user-input');
const fileInput     = document.getElementById('file-input');
const uploadBtn     = document.getElementById('upload-btn');
const fileChipsBar  = document.getElementById('file-chips-bar');
const dragOverlay   = document.getElementById('drag-overlay');
const selfEditBadge = document.getElementById('self-edit-badge');
const chatSection   = document.getElementById('chat-section');

/* ══ حالة التطبيق ══ */
let selectedFiles = [];
let isLoading     = false;
let msgId         = 0;
let selfEditMode  = false;

/* ══════════════════════════════════════════════
   معالجة إرسال النموذج
   ══════════════════════════════════════════════ */
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isLoading) return;

  const text = userInput.value.trim();
  if (!text && selectedFiles.length === 0) return;

  isLoading = true;
  const reqText  = text;
  const curFiles = [...selectedFiles];

  autoNameConversation(text);
  userInput.value = '';
  userInput.style.height = 'auto';
  selectedFiles   = [];
  renderChips();
  document.getElementById('send-btn').innerHTML = '<span class="spin" style="display:inline-block">⟳</span>';

  /* ════════════════════════════════════════════
     وضع التعديل الذاتي — المنصة تعدّل نفسها وترفع
     ════════════════════════════════════════════ */
  if (selfEditMode && curFiles.length === 0) {
    addMessage('user', '🔄 <strong>تعديل ذاتي:</strong> ' + reqText.replace(/\n/g, '<br>'));
    const botId = addMessage('bot', '🔄 <span class="spin">⟳</span> جارٍ تعديل المنصة من الداخل...');

    try {
      const currentHTML  = getCurrentPageHTML();
      const MAX_HTML     = 2500;
      const htmlSnippet  = currentHTML.length > MAX_HTML
        ? currentHTML.substring(0, MAX_HTML) + '\n\n... [باقي الكود محذوف للاختصار، حافظ على جميع الوظائف] ...'
        : currentHTML;

      const fullPrompt = SELF_EDIT_PROMPT + '\n\n=== index.html الحالي ===\n' + htmlSnippet + '\n\n=== طلب التعديل ===\n' + reqText;
      const reply      = await callAPI(fullPrompt);

      const styleMatch  = reply.match(/\[PATCH:\s*style\]([\s\S]*?)\[\/PATCH\]/i);
      const scriptMatch = reply.match(/\[PATCH:\s*script\]([\s\S]*?)\[\/PATCH\]/i);
      const expl        = reply.replace(/\[PATCH:[\s\S]*?\/PATCH\]/gi, '').trim();

      if (!styleMatch && !scriptMatch) {
        updateMessage(botId, renderMarkdown(reply || 'لم يتمكن الذكاء الاصطناعي من تطبيق التعديل، حاول مرة أخرى.'));
      } else {
        function cleanPatch(s) { return s.trim().replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim(); }
        let fullHTML = getCurrentPageHTML();
        if (styleMatch)  fullHTML = fullHTML.replace('</head>', '<style>' + cleanPatch(styleMatch[1])  + '</style>\n</head>');
        if (scriptMatch) fullHTML = fullHTML.replace('</body>', '<script>' + cleanPatch(scriptMatch[1]) + '<\/script>\n</body>');

        updateMessage(botId, '🔄 <span class="spin">⟳</span> جارٍ رفع التعديل مباشرة على الموقع...');
        if (typeof PreviewPanel !== 'undefined') { PreviewPanel.showDeploy('loading'); lpActivate(); }

        try {
          await deployToNetlify(fullHTML);
          if (typeof PreviewPanel !== 'undefined') PreviewPanel.showDeploy('success');
          updateMessage(botId,
            '🚀 <strong>تم رفع التعديل مباشرة على الموقع!</strong><br><br>'
            + (expl ? renderMarkdown(expl) + '<br><br>' : '')
            + '✅ الموقع الآن يعمل بالنسخة الجديدة — أعِد تحميل الصفحة لرؤية التغيير.'
          );
        } catch (deployErr) {
          const blob  = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
          const url   = URL.createObjectURL(blob);
          const isLocalMode = deployErr.message === 'localMode';
          updateMessage(botId,
            '✅ <strong>تم التعديل!</strong><br><br>'
            + (expl ? renderMarkdown(expl) + '<br><br>' : '')
            + (isLocalMode
              ? '⚠️ النشر التلقائي يحتاج إعداد <code>NETLIFY_ACCESS_TOKEN</code> و<code>NETLIFY_SITE_ID</code> في config.js — حمّل الملف وارفعه يدوياً:'
              : '⚠️ فشل الرفع التلقائي — حمّل الملف وارفعه على Netlify يدوياً:'),
            { downloads: [{ url, name: 'index.html', isSelf: true }] }
          );
        }
      }
    } catch (err) { updateMessage(botId, '❌ خطأ في التعديل الذاتي: ' + err.message); }

  /* ════════════════════════════════════════════
     وضع الملفات المرفوعة
     ════════════════════════════════════════════ */
  } else if (curFiles.length > 0) {
    const names = curFiles.map(f => f.name).join('، ');
    addMessage('user', '📎 <strong>' + names + '</strong>' + (reqText ? '<br>' + reqText : ''));

    try {
      let allFiles = [];
      for (const f of curFiles) { const ex = await extractFiles(f); allFiles = [...allFiles, ...ex]; }

      const imageFiles = allFiles.filter(f => f.isImage);
      const textFiles  = allFiles.filter(f => !f.binary && !f.isImage);
      const binFiles   = allFiles.filter(f => f.binary);

      /* ── مسار الصور ── */
      if (imageFiles.length > 0) {
        const img      = imageFiles[0];
        const wantEdit = isImageEditRequest(reqText);
        const botId    = addMessage('bot', wantEdit
          ? '🎨 <span class="spin">⟳</span> جارٍ تحليل الصورة وتطبيق التعديل...'
          : '🔍 <span class="spin">⟳</span> جارٍ تحليل الصورة...');

        try {
          const visionPrompt = wantEdit
            ? `المستخدم يريد تعديل هذه الصورة. طلبه: "${reqText}"

أولاً: صِف محتوى الصورة الحالية بدقة.
ثانياً: اشرح ما الذي ستعدّله بالضبط بناءً على الطلب.
ثالثاً: في السطر الأخير فقط، اكتب: PROMPT_EN: [وصف إنجليزي كامل ودقيق للصورة المعدّلة]`
            : (reqText || 'صف هذه الصورة بالتفصيل: محتواها، الألوان، الأشخاص، النصوص، أي شيء تراه.');

          const visionReply = await callVisionAPI(visionPrompt, img.dataUrl, img.mimeType);

          if (wantEdit) {
            const promptMatch = visionReply.match(/PROMPT_EN:\s*(.+)/i);
            const enPrompt    = promptMatch ? promptMatch[1].trim() : 'Photo edited as requested by the user: ' + reqText;

            updateMessage(botId, '🎨 <span class="spin">⟳</span> جارٍ توليد الصورة المعدّلة...');

            try {
              const imgUrl      = await generateImage(enPrompt);
              const visibleText = visionReply.replace(/PROMPT_EN:.*$/im, '').trim();
              updateMessage(botId,
                renderMarkdown(visibleText)
                + '<br><br>🖼️ <strong>الصورة المعدّلة:</strong><br>'
                + '<img src="' + imgUrl + '" style="max-width:100%;border-radius:12px;margin-top:8px" '
                + 'onerror="this.outerHTML=\'<p>⚠️ فشل تحميل الصورة — حاول مرة أخرى</p>\'">'
                + '<br><a href="' + imgUrl + '" download="galaoum_edited.jpg" target="_blank" '
                + 'style="display:inline-block;margin-top:8px;padding:6px 14px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-size:13px">⬇️ تحميل الصورة</a>'
              );
              saveMemory(reqText || '[صورة]', 'تم تعديل الصورة: ' + visibleText.substring(0, 200));
            } catch (genErr) {
              updateMessage(botId, renderMarkdown(visionReply)
                + '<br><br>⚠️ <strong>ملاحظة:</strong> تم تحليل الصورة لكن فشل توليد النسخة المعدّلة (' + genErr.message + '). '
                + 'يمكنك استخدام Canva أو Photoshop لتطبيق التعديل يدوياً.');
              saveMemory(reqText || '[صورة]', visionReply.substring(0, 300));
            }
          } else {
            updateMessage(botId, renderMarkdown(visionReply));
            saveMemory(reqText || '[وصف صورة]', visionReply.substring(0, 300));
          }
        } catch (vErr) { updateMessage(botId, '❌ خطأ في تحليل الصورة: ' + vErr.message); }

      /* ── مسار ملفات الكود / النصوص ── */
      } else {
        const editMode   = reqText && isEditRequest(reqText);
        const isZipUpload = curFiles.some(f => f.name.toLowerCase().endsWith('.zip'));
        const botId      = addMessage('bot', editMode
          ? '⚙️ <span class="spin">⟳</span> جارٍ تطبيق التعديلات...'
          : '🔍 <span class="spin">⟳</span> جارٍ فك الضغط والتحليل...');

        try {
          /* حدود أكبر للـ ZIP — يحتاج الذكاء الاصطناعي رؤية الكود كاملاً */
          const MAX_PER_FILE = isZipUpload ? 5000 : 2500;
          const MAX_TOTAL    = isZipUpload ? 40000 : 10000;
          let total = 0;
          const filesData = textFiles.map(f => {
            let c = f.content.substring(0, MAX_PER_FILE);
            if (f.content.length > MAX_PER_FILE) c += '\n...[مختصر، ' + f.content.length + ' حرف أصلاً]';
            total += c.length;
            return '[FILE: ' + f.name + ']\n' + c;
          }).filter((_, i) => total <= MAX_TOTAL || i === 0).join('\n\n---\n\n');

          const binNote = binFiles.length
            ? '\n\n[ملاحظة: ' + binFiles.length + ' ملف ثنائي محفوظ: ' + binFiles.map(f => f.name).join(', ') + ']'
            : '';

          if (editMode) {
            /* اختر البرومبت المناسب: ZIP أو ملف عادي */
            const prompt = isZipUpload ? ZIP_EDIT_PROMPT : EDIT_PROMPT;
            const reply  = await callAPI(prompt + '\n\n=== الملفات ===\n' + filesData + binNote + '\n\n=== الطلب ===\n' + reqText);
            const parsed = parseFilesFromReply(reply);
            const expl   = (reply.match(/^([\s\S]*?)\[FILE:/)||[])[1]?.trim() || '';

            if (parsed.length === 0) {
              updateMessage(botId, renderMarkdown(reply));
            } else {
              if (typeof JSZip === 'undefined') throw new Error('مكتبة JSZip لم تُحمَّل، أعد تحميل الصفحة');
              const z = new JSZip();

              /* ══ ① إذا رُفع ZIP أصلي: أضف جميع ملفاته أولاً (صور + ثنائيات + نصوص) ══ */
              const originalZipFile = curFiles.find(f => f.name.toLowerCase().endsWith('.zip'));
              let origFileCount = 0;
              if (originalZipFile) {
                updateMessage(botId, '📦 <span class="spin">⟳</span> جارٍ حفظ الملفات الأصلية...');
                const origZip = await new JSZip().loadAsync(originalZipFile);
                for (const [name, entry] of Object.entries(origZip.files)) {
                  if (!entry.dir) {
                    const data = await entry.async('uint8array');
                    z.file(name, data);
                    origFileCount++;
                  }
                }
              }

              /* ══ ② تطبيق الملفات المعدّلة فوق الأصلية (تستبدل ما تغيّر فقط) ══ */
              if (typeof PreviewPanel !== 'undefined') { PreviewPanel.showFiles(parsed, 'ملفات معدّلة'); lpActivate(); }
              parsed.forEach(f => z.file(f.name, f.content));

              const blob = await z.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
              });
              const url  = URL.createObjectURL(blob);
              const base = curFiles[0].name.replace(/\.(zip|html|js|ts|py|css|json)$/i, '');
              const savedCount = Math.max(0, origFileCount - parsed.length);

              updateMessage(botId,
                '✅ ' + (expl || 'تم التعديل بنجاح!') + '<br><br>'
                + '📝 <strong>' + parsed.length + '</strong> ملف معدّل'
                + (savedCount > 0 ? ' · <strong>' + savedCount + '</strong> ملف أصلي محفوظ' : '')
                + '<br>🚀 <strong>المشروع كامل وجاهز للنشر مباشرة</strong>',
                { downloads: [{ url, name: 'updated_' + base + '.zip' }] }
              );
            }
          } else {
            const reply = await callAPI(ANALYSIS_PROMPT + '\n\n=== الملفات ===\nعدد: ' + textFiles.length + binNote + '\n\n' + filesData + (reqText ? '\n\n=== طلب إضافي ===\n' + reqText : ''));
            updateMessage(botId, renderMarkdown(reply));
          }
        } catch (err) { updateMessage(botId, '❌ خطأ: ' + err.message); }
      }
    } catch (err) {
      addMessage('bot', '❌ خطأ في معالجة الملف: ' + err.message);
    }

  /* ════════════════════════════════════════════
     وضع المحادثة العادية
     ════════════════════════════════════════════ */
  } else {
    addMessage('user', reqText.replace(/\n/g, '<br>'));
    const botId = addMessage('bot', '<span class="spin">⟳</span>');

    try {
      /* ── توليد موسيقى وأغاني من المحادثة ── */
      if (isMusicRequest(reqText)) {
        updateMessage(botId, '🎵 <span class="spin">⟳</span> جارٍ تأليف الموسيقى...');
        if (typeof MusicGenerator === 'undefined') {
          updateMessage(botId, '❌ نظام الموسيقى غير محمّل — حاول تحديث الصفحة.');
        } else {
          let lastPct = 0;
          await MusicGenerator.generateFromChat(
            reqText,
            /* onProgress */ (msg, pct) => {
              lastPct = pct || lastPct;
              const bar = lastPct > 0
                ? `<div style="height:4px;background:#3f3f46;border-radius:4px;margin:6px 0">
                     <div style="height:4px;background:linear-gradient(90deg,#f59e0b,#ec4899);border-radius:4px;width:${lastPct}%;transition:width .4s"></div>
                   </div>`
                : '';
              updateMessage(botId,
                `🎵 <span class="spin">⟳</span> <strong>${msg}</strong>${lastPct ? ` <span style="opacity:.6;font-size:12px">${lastPct}%</span>` : ''}${bar}`);
            },
            /* onResult */ (html) => {
              const wrap = `<div style="background:#18181b;border:1px solid #3f3f46;border-radius:14px;overflow:hidden;padding:16px;margin-top:4px">${html}</div>`;
              updateMessage(botId, '🎵 <strong>الموسيقى جاهزة!</strong><br>' + wrap);
              saveMemory(reqText, '[موسيقى مولّدة من المحادثة] ' + reqText.substring(0, 150));
            }
          );
        }

      /* ── توليد فيديو من المحادثة ── */
      } else if (isVideoRequest(reqText)) {
        const isMulti = isMultiSceneRequest(reqText);
        const mode    = isMulti ? 'multi' : 't2v';
        const botId2  = botId; // alias للوضوح
        updateMessage(botId2,
          `🎬 <span class="spin">⟳</span> جارٍ تحليل الطلب وتوليد الفيديو${isMulti ? ' متعدد المشاهد' : ''}...`);

        if (typeof VideoGenerator === 'undefined') {
          updateMessage(botId2, '❌ نظام الفيديو غير محمّل — حاول تحديث الصفحة.');
        } else {
          let lastPct = 0;
          await VideoGenerator.generateFromChat(
            reqText,
            /* onProgress */ (msg, pct) => {
              lastPct = pct || lastPct;
              const bar = lastPct > 0
                ? `<div style="height:4px;background:#3f3f46;border-radius:4px;margin:6px 0">
                     <div style="height:4px;background:linear-gradient(90deg,#7c3aed,#bf5af2);border-radius:4px;width:${lastPct}%;transition:width .4s"></div>
                   </div>`
                : '';
              updateMessage(botId2,
                `🎬 <span class="spin">⟳</span> <strong>${msg}</strong>${lastPct ? ` <span style="opacity:.6;font-size:12px">${lastPct}%</span>` : ''}${bar}`);
            },
            /* onResult  */ (html) => {
              const wrap = `<div style="background:#18181b;border:1px solid #3f3f46;border-radius:14px;overflow:hidden;margin-top:4px">${html}</div>`;
              updateMessage(botId2, '🎬 <strong>الفيديو جاهز!</strong><br>' + wrap);
              saveMemory(reqText, '[فيديو مولّد من المحادثة] ' + reqText.substring(0, 150));
            },
            { mode }
          );
        }

      /* ── توليد صورة ── */
      } else if (isImageRequest(reqText)) {
        updateMessage(botId, '🎨 <span class="spin">⟳</span> جارٍ تحسين الطلب وتوليد الصورة...');
        try {
          const engPrompt = await enhanceImagePrompt(reqText);
          updateMessage(botId, '🎨 <span class="spin">⟳</span> جارٍ رسم الصورة بالذكاء الاصطناعي...');
          const imgUrl = await generateImage(engPrompt);
          if (typeof PreviewPanel !== 'undefined') { PreviewPanel.showImage(imgUrl, reqText); lpActivate(); }
          const card   = buildImageCard(imgUrl, reqText);
          updateMessage(botId, '✨ <strong>تم توليد الصورة!</strong>' + card);
          saveMemory(reqText, '[صورة مولّدة] ' + engPrompt.substring(0, 200));
        } catch (imgErr) {
          updateMessage(botId, '❌ فشل توليد الصورة: ' + imgErr.message + ' — جرّب وصفاً مختلفاً.');
        }

      /* ── بحث على الإنترنت ── */
      } else if (isSearchRequest(reqText)) {
        updateMessage(botId, '🌐 <span class="spin">⟳</span> جارٍ البحث على الإنترنت...');
        const query    = reqText.replace(/^(ابحث عن|ابحث|search for|search|اجلب معلومات عن|اجلب معلومات)\s*/i, '').trim();
        const urlMatch = reqText.match(/https?:\/\/[^\s]+/);
        let webData    = '';

        if (urlMatch) {
          updateMessage(botId, '📄 <span class="spin">⟳</span> جارٍ قراءة الموقع...');
          webData = await readURL(urlMatch[0]);
        } else {
          webData = await searchWeb(query || reqText);
        }

        if (typeof PreviewPanel !== 'undefined') { PreviewPanel.showSearch(query||reqText, webData); lpActivate(); }
        const enrichedPrompt = reqText + '\n\n══ نتائج البحث من الإنترنت ══\n' + webData + '\n══ نهاية نتائج البحث ══\n\nبناءً على المعلومات أعلاه، أجب على السؤال بالعربية.';
        updateMessage(botId, '🤖 <span class="spin">⟳</span> جارٍ تحليل النتائج...');
        const reply = await callAPI(enrichedPrompt, true);
        updateMessage(botId, '🌐 <strong>نتائج البحث:</strong><br><br>' + renderMarkdown(reply));
        saveMemory(reqText, reply);

      /* ── تشغيل الكود ── */
      } else if (isRunRequest(reqText)) {
        const extracted = extractCodeFromText(reqText);
        if (extracted) {
          updateMessage(botId, '▶ <span class="spin">⟳</span> جارٍ تشغيل الكود...');
          const result = await executeCode(extracted.lang, extracted.code);
          const exitOk = result.exitCode === 0;
          updateMessage(botId,
            '▶ <strong>نتيجة التشغيل</strong> — ' + result.language + ' ' + result.version + '<br>'
            + '<div style="margin:8px 0;border-radius:8px;overflow:hidden;border:1px solid #3730a3">'
            + '<pre style="margin:0;padding:12px;background:' + (exitOk ? '#0a1628' : '#1a0a0a')
            + ';font-size:12px;color:' + (exitOk ? '#d1fae5' : '#fca5a5') + ';white-space:pre-wrap;word-break:break-all">'
            + ((result.output || result.stderr || 'لا يوجد مخرجات').replace(/</g, '&lt;').replace(/>/g, '&gt;')) + '</pre></div>'
            + (exitOk ? '✅ نجح التنفيذ' : '❌ انتهى بخطأ (exit: ' + result.exitCode + ')')
          );
          saveMemory(reqText, 'نتيجة التشغيل: ' + (result.output || result.stderr).substring(0, 200));
        } else {
          updateMessage(botId, '🤖 <span class="spin">⟳</span>');
          const reply = await callAPI(reqText + '\n\nاكتب الكود الكامل داخل ```python أو ```javascript', true);
          updateMessage(botId, renderMarkdown(reply));
          saveMemory(reqText, reply);
        }

      /* ── بناء تطبيق من صفر ── */
      } else if (isBuildRequest(reqText)) {
        updateMessage(botId, '🏗️ <span class="spin">⟳</span> جارٍ بناء التطبيق كاملاً...');
        const reply  = await callAPI(BUILD_PROMPT + '\n\n=== طلب المستخدم ===\n' + reqText, true);
        const parsed = parseFilesFromReply(reply);
        const expl   = (reply.match(/^([\s\S]*?)\[FILE:/)||[])[1]?.trim() || '';

        if (parsed.length === 0) {
          updateMessage(botId, renderMarkdown(reply));
        } else {
          const htmlFile = parsed.find(f => f.name.endsWith('.html'));
          const langMap  = { py:'python', js:'javascript', ts:'typescript', go:'go', rs:'rust', rb:'ruby', java:'java', cpp:'c++', c:'c', php:'php', swift:'swift' };
          const codeFile = !htmlFile && parsed.find(f => /\.(py|js|ts|go|rs|rb|java|cpp|c|php|swift)$/i.test(f.name));

          let zipUrl = '', projName = reqText.replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim().substring(0, 30).replace(/\s+/g, '_') || 'project';

          if (typeof JSZip !== 'undefined') {
            const z    = new JSZip();
            parsed.forEach(f => z.file(f.name, f.content));
            const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
            zipUrl = URL.createObjectURL(blob);
          }

          const dl  = zipUrl ? { downloads: [{ url: zipUrl, name: projName + '.zip' }] } : {};
          let   msg = '🚀 <strong>تم بناء التطبيق!</strong><br><br>' + (expl ? renderMarkdown(expl) + '<br><br>' : '') + '📦 <strong>' + parsed.length + '</strong> ملف';

          if (htmlFile) {
            if (typeof PreviewPanel !== 'undefined') { PreviewPanel.showHTML(htmlFile.content, projName); lpActivate(); }
            updateMessage(botId, msg + '<br><br>🖥️ <span class="spin">⟳</span> جارٍ تشغيل التطبيق...', dl);
            updateMessage(botId, msg + buildHTMLPreview(htmlFile.content, projName), dl);
          } else if (codeFile) {
            const ext  = codeFile.name.split('.').pop().toLowerCase();
            const lang = langMap[ext] || ext;
            updateMessage(botId, msg + '<br><br>▶ <span class="spin">⟳</span> جارٍ تشغيل الكود...', dl);
            const runHTML = await autoRunCode(lang, codeFile.content);
            updateMessage(botId, msg + runHTML, dl);
          } else {
            updateMessage(botId, msg, dl);
          }
        }
        saveMemory(reqText, reply.substring(0, 300));


      /* ── Terminal / Shell ── */
      } else if (isTerminalRequest(reqText)) {
        const cmd = extractTerminalCommand(reqText) || reqText;
        updateMessage(botId, '💻 <span class="spin">⟳</span> جارٍ تنفيذ الأمر...');
        try {
          if (typeof TerminalEngine === 'undefined') throw new Error('Terminal Engine غير محمّل');
          const out = await TerminalEngine.execute(cmd);
          const clean = (out || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          updateMessage(botId,
            '💻 <strong>Terminal</strong><br>'
            + '<div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:12px;margin-top:6px">'
            + '<div style="color:#7d8590;font-size:11px;margin-bottom:6px">$ ' + cmd.replace(/</g,'&lt;') + '</div>'
            + '<pre style="margin:0;color:#e6edf3;font-size:12px;white-space:pre-wrap;word-break:break-all">' + (clean || '(لا يوجد مخرجات)') + '</pre>'
            + '</div>'
          );
          saveMemory(reqText, 'terminal: ' + cmd + ' → ' + (out||'').substring(0,150));
        } catch(e) {
          updateMessage(botId, '❌ خطأ Terminal: ' + e.message
            + '<br><br><span style="font-size:12px;color:#94a3b8">💡 تلميح: افتح لوحة Terminal من الشريط الجانبي لتجربة أوامر أكثر</span>');
        }

      /* ── Git ── */
      } else if (isGitRequest(reqText)) {
        updateMessage(botId, '🔀 <span class="spin">⟳</span> جارٍ تنفيذ أمر Git...');
        try {
          if (typeof GitManager === 'undefined') throw new Error('Git Manager غير محمّل');
          // استخراج أمر git من النص أو بناؤه من الطلب
          const rawCmd = extractTerminalCommand(reqText);
          let result = '';
          if (rawCmd && rawCmd.toLowerCase().startsWith('git')) {
            result = await GitManager.runCommand(rawCmd);
          } else if (/commit/i.test(reqText)) {
            const msgMatch = reqText.match(/[""](.+)[""]/) || reqText.match(/(?:رسالة|message)[:\s]+(.+)/i);
            const commitMsg = msgMatch ? msgMatch[1] : reqText.replace(/commit|سجّل|سجل/gi,'').trim() || 'Auto commit';
            result = await GitManager.commit(commitMsg);
          } else if (/push/i.test(reqText)) {
            result = await GitManager.push();
          } else if (/pull/i.test(reqText)) {
            result = await GitManager.pull();
          } else if (/log|سجل/i.test(reqText)) {
            result = await GitManager.log();
          } else if (/diff|فروق/i.test(reqText)) {
            result = await GitManager.diff();
          } else if (/branch|فرع/i.test(reqText)) {
            const brMatch = reqText.match(/(?:branch|فرع)[:\s]+(\S+)/i);
            result = brMatch ? await GitManager.createBranch(brMatch[1]) : await GitManager.log();
          } else if (/init/i.test(reqText)) {
            result = await GitManager.init_repo('project');
          } else {
            // أرسل الأمر الكامل كما هو
            result = await GitManager.runCommand(reqText);
          }
          const clean = (typeof result === 'string' ? result : JSON.stringify(result,null,2)).replace(/</g,'&lt;').replace(/>/g,'&gt;');
          updateMessage(botId,
            '🔀 <strong>Git</strong><br>'
            + '<div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:12px;margin-top:6px">'
            + '<pre style="margin:0;color:#e6edf3;font-size:12px;white-space:pre-wrap;word-break:break-all">' + (clean || '✅ تم') + '</pre>'
            + '</div>'
          );
          saveMemory(reqText, 'git: ' + (clean||'').substring(0,150));
        } catch(e) {
          updateMessage(botId, '❌ خطأ Git: ' + e.message
            + '<br><br><span style="font-size:12px;color:#94a3b8">💡 افتح لوحة Git Manager من الشريط الجانبي لخيارات أكثر</span>');
        }

      /* ── قاعدة البيانات / SQL ── */
      } else if (isDBRequest(reqText)) {
        updateMessage(botId, '🗄️ <span class="spin">⟳</span> جارٍ تنفيذ الاستعلام...');
        try {
          if (typeof DatabaseManager === 'undefined') throw new Error('Database Manager غير محمّل');
          let sql = extractSQL(reqText);
          if (!sql) {
            // اطلب من الذكاء الاصطناعي توليد SQL
            updateMessage(botId, '🗄️ <span class="spin">⟳</span> جارٍ بناء استعلام SQL...');
            const aiSql = await callAPI('حوّل هذا الطلب إلى استعلام SQL صحيح فقط بدون شرح: ' + reqText, false);
            sql = extractSQL(aiSql) || aiSql.trim();
          }
          const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql);
          const result  = isWrite ? await DatabaseManager.exec(sql) : await DatabaseManager.query(sql);
          let html = '🗄️ <strong>قاعدة البيانات</strong><br>'
            + '<div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:10px;margin-top:6px">'
            + '<div style="color:#7d8590;font-size:11px;margin-bottom:8px;font-family:monospace">' + sql.replace(/</g,'&lt;').substring(0,120) + '</div>';
          if (result && result.rows && result.rows.length > 0) {
            const cols = Object.keys(result.rows[0]);
            html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
              + '<tr>' + cols.map(c=>'<th style="padding:6px 10px;background:#161b22;color:#7d8590;text-align:right;border-bottom:1px solid #30363d">' + c + '</th>').join('') + '</tr>'
              + result.rows.slice(0,20).map(r=>'<tr>' + cols.map(c=>'<td style="padding:6px 10px;color:#e6edf3;border-bottom:1px solid #21262d">' + String(r[c]??'').replace(/</g,'&lt;').substring(0,50) + '</td>').join('') + '</tr>').join('')
              + '</table></div>'
              + '<div style="color:#7d8590;font-size:11px;margin-top:6px">' + result.rowCount + ' نتيجة</div>';
          } else if (result && result.ok) {
            html += '<div style="color:#4ade80;font-size:13px">✅ تم التنفيذ بنجاح</div>';
          } else {
            html += '<div style="color:#94a3b8;font-size:12px">لا توجد نتائج</div>';
          }
          html += '</div>';
          updateMessage(botId, html);
          saveMemory(reqText, 'sql: ' + sql.substring(0,150));
        } catch(e) {
          updateMessage(botId, '❌ خطأ قاعدة البيانات: ' + e.message
            + '<br><br><span style="font-size:12px;color:#94a3b8">💡 افتح لوحة قاعدة البيانات من الشريط الجانبي</span>');
        }

      /* ── نشر المشروع / Deploy ── */
      } else if (isDeployRequest(reqText)) {
        updateMessage(botId, '🚀 <span class="spin">⟳</span> جارٍ تحضير المشروع للنشر...');
        try {
          if (typeof DeploymentEngine === 'undefined') throw new Error('Deployment Engine غير محمّل');
          // تحليل المشروع الحالي
          const _fsFiles = {}; // VirtualFS.ls() async — deployment engine يعمل بـ {}
          const analysis = await DeploymentEngine.analyzeBeforeDeploy(_fsFiles || {});
          const typeIcon = { html:'🌐', react:'⚛️', vue:'💚', node:'🟢', python:'🐍', unknown:'📦' };
          const icon = typeIcon[analysis.type] || '📦';
          updateMessage(botId,
            '🚀 <strong>تحليل المشروع للنشر</strong><br><br>'
            + '<div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:14px;margin-top:6px">'
            + '<div style="margin-bottom:10px">' + icon + ' <strong>نوع المشروع:</strong> ' + analysis.type + '</div>'
            + '<div style="margin-bottom:6px">📁 <strong>الملفات:</strong> ' + analysis.fileCount + '</div>'
            + (analysis.issues?.length ? '<div style="color:#fca5a5;margin-bottom:8px">⚠️ تحذيرات:<br>' + analysis.issues.slice(0,3).map(i=>'• '+i).join('<br>') + '</div>' : '<div style="color:#4ade80;margin-bottom:8px">✅ المشروع جاهز للنشر</div>')
            + '<button onclick="DeploymentEngine&&DeploymentEngine.openPanel()" style="padding:8px 16px;background:linear-gradient(135deg,#f97316,#ea580c);border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600">🚀 انشر الآن عبر Netlify</button>'
            + '</div>'
          );
          saveMemory(reqText, 'deploy analysis: ' + analysis.type + ', files: ' + analysis.fileCount);
        } catch(e) {
          updateMessage(botId, '❌ خطأ النشر: ' + e.message
            + '<br><br><span style="font-size:12px;color:#94a3b8">💡 افتح لوحة النشر من الشريط الجانبي</span>');
        }

      /* ── معاينة / Sandbox ── */
      } else if (isSandboxRequest(reqText)) {
        updateMessage(botId, '🧪 <span class="spin">⟳</span> جارٍ تحضير المعاينة...');
        try {
          // بحث عن HTML في النص أو في المشروع الحالي
          const htmlMatch = reqText.match(/```html[\s\S]*?```/i);
          if (htmlMatch) {
            const htmlCode = htmlMatch[1];
            if (typeof PreviewPanel !== 'undefined') {
              PreviewPanel.showHTML(htmlCode, 'معاينة');
              if (typeof lpActivate === 'function') lpActivate();
            }
            updateMessage(botId, '🧪 <strong>معاينة</strong>' + buildHTMLPreview(htmlCode, 'معاينة'));
          } else if (typeof SandboxEngine !== 'undefined') {
            SandboxEngine.openPanel();
            updateMessage(botId, '🧪 <strong>تم فتح لوحة Sandbox</strong><br><span style="color:#94a3b8;font-size:12px">الصق كودك في المحرر وشغّله مباشرة</span>');
          } else {
            updateMessage(botId, '💡 أرسل كودك HTML داخل ``` ``` وسأعرضه مباشرة في المحادثة');
          }
        } catch(e) {
          updateMessage(botId, '❌ ' + e.message);
        }

      /* ── تحويل نص لصوت (TTS) ── */
      } else if (isVoiceSynthRequest(reqText)) {
        const textToSpeak = reqText.replace(/اقرأ بصوت|اقرأ لي|تحويل نص لصوت|text to speech|tts|اسمعني|نطق|صوّت هذا|read aloud|speak this/gi,'').trim() || reqText;
        updateMessage(botId, '🔊 <span class="spin">⟳</span> جارٍ تحويل النص لصوت...');
        try {
          if (!('speechSynthesis' in window)) throw new Error('المتصفح لا يدعم TTS');
          window.speechSynthesis.cancel();
          const utt = new SpeechSynthesisUtterance(textToSpeak);
          utt.lang = /[؀-ۿ]/.test(textToSpeak) ? 'ar-SA' : 'en-US';
          utt.rate = 0.9; utt.pitch = 1;
          const uid_tts = 'tts_' + Date.now();
          updateMessage(botId,
            '🔊 <strong>تشغيل الصوت</strong><br>'
            + '<div style="background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:14px;margin-top:6px">'
            + '<div style="color:#e6edf3;font-size:13px;margin-bottom:12px;line-height:1.6">' + textToSpeak.replace(/</g,'&lt;').substring(0,200) + '</div>'
            + '<div style="display:flex;gap:8px">'
            + '<button id="' + uid_tts + '_stop" onclick="window.speechSynthesis&&window.speechSynthesis.cancel();this.textContent=\u2019\u23F9 \u0645\u062A\u0648\u0642\u0641\u2018" style="padding:8px 14px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;color:#f87171;cursor:pointer;font-size:12px">⏹ إيقاف</button>'
            + '<button onclick="window.speechSynthesis&&window.speechSynthesis.resume()" style="padding:8px 14px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.2);border-radius:8px;color:#38bdf8;cursor:pointer;font-size:12px">▶ استئناف</button>'
            + '</div></div>'
          );
          window.speechSynthesis.speak(utt);
          saveMemory(reqText, 'tts: ' + textToSpeak.substring(0,100));
        } catch(e) {
          updateMessage(botId, '❌ ' + e.message);
        }

      /* ── ترجمة ── */
      } else if (isTranslateRequest(reqText)) {
        updateMessage(botId, '🌐 <span class="spin">⟳</span> جارٍ الترجمة...');
        const reply = await callAPI('أنت مترجم محترف. ترجم النص التالي ترجمة دقيقة وطبيعية مع الحفاظ على الأسلوب. إذا لم يُحدّد اللغة المستهدفة، ترجم من العربية للإنجليزية أو العكس. أعطِ الترجمة مباشرة بدون مقدمات:\n\n' + reqText, true);
        updateMessage(botId, '🌐 <strong>الترجمة:</strong><br><br>' + renderMarkdown(reply));
        saveMemory(reqText, reply);

      /* ── تلخيص ── */
      } else if (isSummarizeRequest(reqText)) {
        updateMessage(botId, '📋 <span class="spin">⟳</span> جارٍ التلخيص...');
        const reply = await callAPI('أنت خبير في التلخيص. لخّص المحتوى التالي بشكل منظّم: أبرز الأفكار الرئيسية في نقاط واضحة، ثم اكتب خلاصة موجزة في آخر فقرة. ابدأ مباشرة:\n\n' + reqText, true);
        updateMessage(botId, '📋 <strong>الملخص:</strong><br><br>' + renderMarkdown(reply));
        saveMemory(reqText, reply);

      /* ── كتابة إبداعية ── */
      } else if (isCreativeRequest(reqText)) {
        updateMessage(botId, '✍️ <span class="spin">⟳</span> جارٍ الكتابة...');
        const reply = await callAPI('أنت كاتب محترف. نفّذ الطلب التالي بأسلوب راقٍ ومتقن، واكتب المحتوى كاملاً دون اختصار أو تقطيع:\n\n' + reqText, true);
        const parsed = parseFilesFromReply(reply);
        if (parsed.length > 0) {
          updateMessage(botId, renderMarkdown(reply));
        } else {
          updateMessage(botId, '✍️ <br>' + renderMarkdown(reply));
        }
        saveMemory(reqText, reply.substring(0, 400));

      /* ── تحليل وشرح ── */
      } else if (isAnalysisRequest(reqText)) {
        updateMessage(botId, '🔍 <span class="spin">⟳</span> جارٍ التحليل...');
        const reply = await callAPI('أنت محلل خبير. أجب على الطلب التالي بتحليل عميق ومنظّم: استخدم عناوين وفقرات واضحة، وقدّم أمثلة عند الحاجة. ابدأ مباشرة:\n\n' + reqText, true);
        updateMessage(botId, '🔍 <br>' + renderMarkdown(reply));
        saveMemory(reqText, reply.substring(0, 400));

      /* ── نصيحة ومساعدة شخصية ── */
      } else if (isAdviceRequest(reqText)) {
        updateMessage(botId, '💡 <span class="spin">⟳</span> جارٍ التفكير في أفضل نصيحة...');
        const reply = await callAPI('أنت مستشار خبير وصديق يمكن الوثوق به. أجب على الطلب التالي بنصيحة عملية ومحددة: اذكر خطوات واضحة وقابلة للتطبيق، وابدأ بأهم نقطة مباشرة:\n\n' + reqText, true);
        updateMessage(botId, '💡 <br>' + renderMarkdown(reply));
        saveMemory(reqText, reply.substring(0, 400));

      /* ── أسئلة معلوماتية ── */
      } else if (isQuestionRequest(reqText)) {
        updateMessage(botId, '🤔 <span class="spin">⟳</span> جارٍ البحث عن إجابة...');
        const reply = await callAPI('أجب على السؤال التالي بدقة واختصار: لا تبدأ بتكرار السؤال، بل بالإجابة مباشرة. إذا كان الموضوع معقداً، نظّم الإجابة بعناوين:\n\n' + reqText, true);
        updateMessage(botId, renderMarkdown(reply));
        saveMemory(reqText, reply.substring(0, 400));

      /* ── محادثة عادية ── */
      } else {
        updateMessage(botId, '<span class="spin">⟳</span>');
        const reply  = await callAPI(reqText, true);
        const parsed = parseFilesFromReply(reply);

        if (parsed.length > 0 && typeof JSZip !== 'undefined') {
          const expl     = (reply.match(/^([\s\S]*?)\[FILE:/)||[])[1]?.trim() || '';
          const htmlFile = parsed.find(f => f.name.endsWith('.html'));
          const langMap2 = { py:'python', js:'javascript', ts:'typescript', go:'go', rs:'rust', rb:'ruby' };
          const codeFile = !htmlFile && parsed.find(f => /\.(py|js|ts|go|rs|rb)$/i.test(f.name));
          const z        = new JSZip();
          parsed.forEach(f => z.file(f.name, f.content));
          const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE' });
          const url  = URL.createObjectURL(blob);
          let   msg  = (expl ? renderMarkdown(expl) + '<br><br>' : '') + '📦 <strong>' + parsed.length + '</strong> ملف جاهز';
          const dl   = { downloads: [{ url, name: 'output.zip' }] };

          if (htmlFile) {
            if (typeof PreviewPanel !== 'undefined') { PreviewPanel.showHTML(htmlFile.content, 'معاينة التطبيق'); lpActivate(); }
            updateMessage(botId, msg + '<br><br>🖥️ <span class="spin">⟳</span> جارٍ التشغيل...', dl);
            updateMessage(botId, msg + buildHTMLPreview(htmlFile.content), dl);
          } else if (codeFile) {
            const ext = codeFile.name.split('.').pop().toLowerCase();
            updateMessage(botId, msg + '<br><br>▶ <span class="spin">⟳</span> جارٍ التشغيل...', dl);
            const runHTML = await autoRunCode(langMap2[ext] || ext, codeFile.content);
            updateMessage(botId, msg + runHTML, dl);
          } else {
            updateMessage(botId, msg, dl);
          }
        } else {
          updateMessage(botId, renderMarkdown(reply));
        }
        saveMemory(reqText, reply);
      }
    } catch (err) { updateMessage(botId, '❌ خطأ: ' + err.message); }
  }

  isLoading = false;
  document.getElementById('send-btn').innerHTML = '➤';
  userInput.focus();
});

/* ══════════════════════════════════════════════
   أحداث الملفات ورفعها
   ══════════════════════════════════════════════ */
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
  selectedFiles = [...selectedFiles, ...Array.from(e.target.files)];
  fileInput.value = '';
  renderChips();
});

document.addEventListener('dragover',  e => { e.preventDefault(); dragOverlay.classList.add('active'); });
document.addEventListener('dragleave', e => { if (!e.relatedTarget) dragOverlay.classList.remove('active'); });
document.addEventListener('drop', e => {
  e.preventDefault();
  dragOverlay.classList.remove('active');
  const files = Array.from(e.dataTransfer.files);
  if (files.length) { selectedFiles = [...selectedFiles, ...files]; renderChips(); }
});

/* ══════════════════════════════════════════════
   وضع التعديل الذاتي — زر التبديل
   ══════════════════════════════════════════════ */
document.getElementById('toggle-self-edit').addEventListener('click', () => {
  selfEditMode = !selfEditMode;
  applySelfEditUI();
});

/* ══════════════════════════════════════════════
   زر مسح المحادثة (= محادثة جديدة)
   ══════════════════════════════════════════════ */
document.getElementById('clear-chat-btn').addEventListener('click', () => {
  newConversation();
});

/* ══════════════════════════════════════════════
   تهيئة نظام المحادثات عند التحميل
   ══════════════════════════════════════════════ */
(function initConversations() {
  let convs    = getConvs();
  let activeId = getActiveId();

  if (convs.length === 0) {
    const id = genId();
    convs    = [{ id, name: 'محادثة جديدة', messages: [], createdAt: Date.now(), updatedAt: Date.now() }];
    saveConvs(convs);
    activeId = id;
    setActiveId(id);
  }

  if (!convs.find(c => c.id === activeId)) {
    activeId = convs[0].id;
    setActiveId(activeId);
  }

  const active = convs.find(c => c.id === activeId);
  loadMessages(active ? active.messages : []);
  renderConvList();
  applySelfEditUI();
})();
