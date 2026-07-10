/* ══════════════════════════════════════════════
   utils.js — دوال مساعدة عامة
   Galaoum AI Engine v5.0
   ══════════════════════════════════════════════ */

/* ── تنسيق حجم الملف ── */
function formatSize(b) {
  return b < 1024 ? b + ' B'
    : b < 1048576 ? (b / 1024).toFixed(1) + ' KB'
    : (b / 1048576).toFixed(1) + ' MB';
}

/* ── تنسيق الوقت ── */
function formatTime(d) {
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

/* ── أيقونة نوع الملف ── */
function fileIcon(n) {
  const e = (n.split('.').pop() || '').toLowerCase();
  if (e === 'zip') return '🗜️';
  if (['js', 'ts', 'jsx', 'tsx'].includes(e)) return '📜';
  if (['html', 'htm'].includes(e)) return '🌐';
  if (e === 'css') return '🎨';
  if (['py', 'go', 'rs', 'rb'].includes(e)) return '🐍';
  if (['json', 'yaml', 'yml', 'toml'].includes(e)) return '⚙️';
  if (['md', 'txt'].includes(e)) return '📝';
  return '📄';
}

/* ── تحويل Markdown إلى HTML مع عرض كتل الكود ── */
function renderMarkdown(t) {
  let codeBlocks = [];

  /* استخراج كتل الكود قبل معالجة النص */
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const runnable = ['python', 'python3', 'javascript', 'js', 'node', 'typescript', 'ts',
      'java', 'c', 'cpp', 'c++', 'bash', 'sh', 'rust', 'go', 'ruby', 'php'].includes(lang.toLowerCase());
    codeBlocks.push({ lang: lang || 'text', code: code.trim(), runnable });
    return '\x00CODE' + idx + '\x00';
  });

  /* كود مضمّن */
  t = t.replace(/`([^`]+)`/g,
    '<code style="background:#1e1b4b;color:#fca5a5;padding:2px 6px;border-radius:4px;font-size:12px">$1</code>');

  /* تنسيق النص */
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/^## (.+)$/gm, '<span style="color:#fca5a5;font-weight:700;font-size:14px">$1</span>');
  t = t.replace(/^### (.+)$/gm, '<span style="color:#fca5a5;font-weight:600">$1</span>');
  t = t.replace(/^• /gm, '&nbsp;&nbsp;• ');
  t = t.replace(/\n/g, '<br>');

  /* إعادة كتل الكود مع واجهة التشغيل */
  t = t.replace(/\x00CODE(\d+)\x00/g, (_, i) => {
    const { lang, code, runnable } = codeBlocks[parseInt(i)];
    const eid = 'ce' + Date.now() + i;
    const btn = runnable
      ? '<button onclick="runCodeBlock(this,\'' + eid + '\')" style="float:right;background:#7c3aed;color:#fff;border:none;padding:3px 10px;border-radius:6px;font-size:11px;cursor:pointer;margin-left:6px">▶ تشغيل</button>'
      : '';
    return '<div style="margin:8px 0;border-radius:8px;overflow:hidden;border:1px solid #3730a3">'
      + '<div style="background:#1e1b4b;padding:6px 10px;font-size:11px;color:#f87171;display:flex;justify-content:space-between;align-items:center">'
      + '<span>' + lang + '</span>' + btn + '</div>'
      + '<pre id="' + eid + '" style="margin:0;padding:12px;background:#0f0a2e;overflow-x:auto;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-all"><code>'
      + code.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>'
      + '<div id="out' + eid + '" style="display:none"></div>'
      + '</div>';
  });

  return t;
}

/* ── كشف نوع الطلب ── */
function isBuildRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  const buildWords = ['ابنِ', 'ابني', 'ابن لي', 'اصنع لي', 'اصنعلي', 'انشئ لي', 'أنشئ لي',
    'انشالي', 'انشا لي', 'اعمل لي', 'اعمللي', 'سوّي لي', 'سوي لي', 'سويلي',
    'صمّم', 'صمم', 'برمج لي', 'من صفر', 'من الصفر', 'full project', 'full app',
    'from scratch', 'build a', 'build me', 'create app', 'make app', 'make me',
    'create a website', 'اكتب لي برنامج', 'اكتب كود كامل', 'طور لي', 'طوّر لي', 'صمم لي'];
  const appWords = ['تطبيق', 'برنامج', 'موقع', 'لعبة', 'api', 'dashboard', 'نظام',
    'portfolio', 'calculator', 'store', 'shop', 'landing', 'quiz', 'todo', 'chat app'];
  const hasBuild = buildWords.some(k => t.includes(k));
  const hasApp   = appWords.some(k => t.includes(k));
  const isEdit   = text.includes('عدّل') || text.includes('عدل') || text.includes('غيّر') || text.includes('صلح');
  return (hasBuild && hasApp) && !isEdit;
}

function isSearchRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return ['ابحث', 'دور على', 'دوّر على', 'بحث عن', 'search', 'اجلب معلومات', 'اجلب أخبار',
    'ايش أحدث', 'وش أحدث', 'ما أحدث', 'اقرأ موقع', 'افتح موقع', 'اقرأ رابط',
    'read url', 'fetch', 'ابحثلي', 'فتش عن', 'فتش'].some(w => t.includes(w));
}

function isRunRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  // لا تطابق إذا كان الطلب عن HTML أو terminal
  const isHtmlCtx = /html|css|معاينة|عاين/i.test(t);
  const isTermCtx = /\bls\b|\bpwd\b|\bgit\b|npm |pnpm |pip |bash/i.test(t);
  if (isHtmlCtx || isTermCtx) return false;
  return ['شغّل', 'شغل', 'شغله', 'نفّذ', 'نفذ', 'نفذه', 'run', 'execute',
    'اختبر هذا الكود', 'جرّب', 'جرب', 'جربه', 'طشّه', 'طشه'].some(w => t.includes(w));
}

function isImageRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();

  const imageWords = [
    'صورة', 'صوره', 'صور', 'صورتي', 'صورته',
    'image', 'photo', 'picture', 'img', 'pic'
  ];
  const actionWords = [
    'ولّد', 'ولد', 'يولد', 'توليد',
    'ارسم', 'رسم', 'ارسملي', 'ارسم لي',
    'اصنع', 'صنع', 'اعمل',
    'أنشئ', 'انشئ', 'أنشيء',
    'صمّم', 'صمم',
    'جيب', 'اجلب', 'اعطني', 'اعطيني', 'عطني',
    'generate', 'create', 'draw', 'make', 'produce', 'design'
  ];

  const hasAction = actionWords.some(a => t.includes(a));
  const hasImage  = imageWords.some(i => t.includes(i));
  if (hasAction && hasImage) return true;

  return [
    'ارسم', 'رسمة', 'لوحة', 'بورتريه',
    'generate image', 'create image', 'draw me', 'make image',
    'image of', 'photo of', 'picture of',
    'شعار ai', 'خلفية جديدة', 'خلفية احترافية'
  ].some(w => t.includes(w));
}

/* ── كشف طلبات الموسيقى والأغاني ── */
function isMusicRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  const musicWords = [
    'أغنية', 'اغنية', 'اغنيه', 'أغاني', 'اغاني', 'موسيقى', 'موسيقا', 'موسيقه',
    'لحن', 'ألحان', 'نشيد', 'نشيده', 'كلمات أغنية', 'كلمات اغنية', 'مقطوعة', 'سيمفونية',
    'song', 'music', 'melody', 'tune', 'beat', 'track', 'lyrics', 'anthem'
  ];
  const actionWords = [
    'ولّد', 'ولد', 'اصنع', 'اصنعلي', 'أنشئ', 'انشئ', 'انشا', 'اعمل', 'اعمللي',
    'اكتب', 'لحّن', 'لحن', 'سوّي', 'سوي',
    'compose', 'create', 'generate', 'make', 'write', 'produce'
  ];
  const hasMusicWord  = musicWords.some(w => t.includes(w));
  const hasActionWord = actionWords.some(w => t.includes(w));
  // كلمات تكشف الموسيقى مباشرة بدون action
  const directPhrases = [
    'اغنيه', 'اغنية', 'أغنية عربية', 'أغنية حزينة', 'أغنية رومانسية',
    'موسيقى هادئة', 'موسيقى عربية', 'ألف لي أغنية', 'بيت موسيقي', 'بيت موسيقى',
    'compose a song', 'write a song', 'create music', 'make a beat'
  ];
  // يكفي: كلمة action + "بيت موسيقي"، أو الكلمتين معاً
  const hasMusical = hasMusicWord || t.includes('بيت موسيقي') || t.includes('بيت موسيقى') || t.includes('موسيقي') || t.includes('موسيقى');
  return (hasMusical && hasActionWord) || directPhrases.some(w => t.includes(w));
}

/* ── كشف طلبات الفيديو ── */
function isVideoRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  // إذا كان الطلب صورة صريحة وليس فيديو — تجنّب التصنيف الخاطئ
  const explicitImage = ['صورة', 'صوره', 'image', 'photo', 'picture'].some(w => t.includes(w));
  const explicitVideo = ['فيديو', 'فيديوه', 'فديو', 'مقطع', 'كليب', 'انيميشن', 'video', 'clip', 'animation', 'movie'].some(w => t.includes(w));
  if (explicitImage && !explicitVideo) return false;

  const videoWords = [
    'فيديو', 'فيديوه', 'فيديوات', 'فديو', 'فيدوه', 'مقطع', 'كليب',
    'انيميشن', 'أنيميشن', 'video', 'clip', 'animation', 'movie', 'short film'
  ];
  const actionWords = [
    'ولّد', 'ولد', 'توليد', 'اصنع', 'اصنعلي', 'اصنع لي',
    'أنشئ', 'انشئ', 'انشا', 'انشاء', 'انشيء',
    'اعمل', 'اعمللي', 'صمم', 'اكتب', 'سوّي', 'سوي',
    'generate', 'create', 'make', 'produce', 'record', 'shoot', 'build'
  ];
  const hasVideo  = videoWords.some(w => t.includes(w));
  const hasAction = actionWords.some(w => t.includes(w));
  return (hasVideo && hasAction) ||
    ['generate video', 'create video', 'make video', 'video of', 'صوّر', 'صور لي فيديو',
     'حوّل الصورة لفيديو', 'حرّك الصورة', 'اصنع لي فيديو', 'اصنعلي فيديو',
     'أنشئ فيديو', 'ولّد فيديو', 'سوّي فيديو', 'سوي فيديو',
     'بي فيديو', 'في فيديو', 'فيديو مدة', 'فيديو مده', 'فيديو ثانية', 'فيديو ثواني'].some(w => t.includes(w));
}

/* ── كشف طلبات فيديو متعدد المشاهد ── */
function isMultiSceneRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return ['متعدد المشاهد', 'عدة مشاهد', 'مشاهد متتالية', 'multi scene', 'multi-scene',
    'قصة فيديو', 'فيديو قصير بمشاهد', 'مشهد 1', 'scene 1', 'مشاهد'].some(w => t.includes(w));
}

function isImageEditRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return ['عدل', 'عدّل', 'غير', 'غيّر', 'ضيف', 'أضف', 'احذف', 'اجعل', 'خلّي', 'خلي',
    'edit', 'modify', 'change', 'add', 'remove', 'make', 'convert',
    'ولّد', 'ولد', 'اصنع', 'انشئ', 'أنشئ', 'generate', 'create'].some(w => t.includes(w));
}

function isEditRequest(t) {
  return ['عدّل', 'عدل', 'غيّر', 'غير', 'أضف', 'احذف', 'حذف', 'أصلح', 'صلح',
    'حوّل', 'ترجم', 'أعد', 'edit', 'fix', 'modify', 'update', 'change',
    'add', 'remove', 'convert'].some(k => t.toLowerCase().includes(k));
}

function wantsZip(t) {
  return ['zip', 'مضغوط', 'ضغط', 'حزمة'].some(k => t.toLowerCase().includes(k));
}

/* ── استخراج الكود من نص المستخدم ── */
function extractCodeFromText(text) {
  const m = text.match(/```(\w*)\n?([\s\S]*?)```/);
  if (m) return { lang: m[1] || 'python', code: m[2].trim() };
  const lines = text.split('\n');
  const codeLines = lines.filter(l =>
    /^[\s]*(def |import |print|function|const |let |var |for |if |return|#|\/\/)/.test(l));
  if (codeLines.length >= 2) return { lang: 'python', code: codeLines.join('\n') };
  return null;
}

/* ══════════════════════════════════════════════
   دوال كشف الطلبات الجديدة — v6 Chat-First
   ══════════════════════════════════════════════ */

/* ── Terminal / Shell ── */
function isTerminalRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  // لا تطابق أوامر git المعروفة — تُعالَج بـ isGitRequest
  if (isGitRequest(text)) return false;
  const termWords = [
    'terminal','شغّل أمر','شغل أمر','نفّذ أمر','نفذ أمر','run command',
    'npm ','pnpm ','yarn ','node ','python ','pip ','ls ','pwd',
    'mkdir ','cat ','echo ','chmod ','curl ','wget ','install package',
    'ثبّت حزمة','ثبت حزمة','تثبيت حزمة','bash','shell'
  ];
  return termWords.some(w => t.includes(w));
}

/* ── Git ── */
function isGitRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [
    'commit','push','pull','clone','branch','merge','checkout','stash',
    'git log','git diff','git status','git init','git remote',
    'انشئ فرع','أنشئ فرع','ارفع الكود','رفع الكود','سجّل تغيير',
    'سجل تغيير','نزّل المستودع','مستودع git','repository'
  ].some(w => t.includes(w));
}

/* ── قاعدة البيانات / SQL ── */
function isDBRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [
    'select ','insert ','update ','delete ','create table','drop table',
    'alter table','inner join','left join','where ','group by','order by',
    'sql','قاعدة بيانات','قاعده بيانات','جدول','جداول','استعلام',
    'database','sqlite','mysql','postgres'
  ].some(w => t.includes(w));
}

/* ── نشر / Deploy ── */
function isDeployRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [
    'انشر','نشر المشروع','ارفع المشروع','نشر على','deploy','publish',
    'netlify','vercel','github pages','ارفع الموقع','رفع الموقع',
    'اجعله على الإنترنت','اجعله على الانترنت','online','go live'
  ].some(w => t.includes(w));
}

/* ── معاينة / Sandbox ── */
function isSandboxRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [
    'عاين','عاينه','معاينة','preview','شغّل html','شغل html','اعرض html','اعرضه',
    'sandbox','افتح في المتصفح','جرّب الكود','جرب الكود','جربه','جرّبه',
    'run html','show result','اعرض النتيجة','عرض النتيجة',
    'شوفه','شوف النتيجة','شغّله','شغله','اختبره'
  ].some(w => t.includes(w));
}

/* ══════════════════════════════════════════════
   دوال كشف متقدمة — v5.1 Smart Understanding
   ══════════════════════════════════════════════ */

/* ── كتابة إبداعية (مقال، قصة، شعر، رسالة…) ── */
function isCreativeRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  const creativeTargets = [
    'مقال','مقاله','موضوع','قصة','قصه','رواية','قصيدة','قصيده','أبيات','بيت شعر',
    'رسالة','رساله','خطاب','خطبة','خطبه','تقرير','تقريراً','وصف','كلمة','كلمه',
    'نص','نصاً','فقرة','مقدمة','خاتمة','حوار','سيناريو','سكريبت','script',
    'essay','story','poem','letter','article','paragraph','speech','caption',
    'تغريدة','منشور','بوست','post','tweet','بروفايل','bio','سيرة ذاتية',
    'تقديم','introduction','نصيحة مكتوبة','دعاء','أدعية','عبارات'
  ];
  const actionTargets = [
    'اكتب','اكتبلي','اكتب لي','كتابة','أنشئ','انشئ','انشا','انشاء',
    'اعمل','اعمللي','اعمل لي','صيغة','صياغة','ألّف','ألف','اصنع',
    'write','create','draft','compose','generate','produce','give me'
  ];
  const hasTarget = creativeTargets.some(w => t.includes(w));
  const hasAction = actionTargets.some(w => t.includes(w));
  // تأكد أنه ليس طلب برمجة
  const isCode = /كود|برمج|html|css|javascript|python|function|class/i.test(t);
  if (isCode) return false;
  return hasTarget && hasAction;
}

/* ── أسئلة معلوماتية (ما هو، كيف، لماذا…) ── */
function isQuestionRequest(text) {
  if (!text) return false;
  const t = text.trim();
  const questionStarters = [
    'ما هو','ما هي','ما هم','ما معنى','ما تعريف','ما الفرق','ما أفضل','ما سبب',
    'ماذا يعني','ماذا يفعل','ماذا تعني','متى كان','متى يكون','أين يوجد','أين تقع',
    'كيف يعمل','كيف تعمل','كيف يمكن','كيف أستطيع','كيف أتعلم','كيف أصبح',
    'لماذا','لم ','علام','هل يمكن','هل صحيح','هل تستطيع','هل تعرف',
    'من هو','من هي','من اخترع','من أسس','من يستخدم',
    'عرّف لي','عرف لي','فسّر','فسر','وضّح','وضح','اشرح لي',
    'what is','what are','how does','how can','why is','who is','when was','where is',
    'explain','define','tell me','describe'
  ];
  // سؤال صريح بعلامة استفهام
  if (t.endsWith('؟') || t.endsWith('?')) return true;
  return questionStarters.some(s => t.toLowerCase().startsWith(s) || t.toLowerCase().includes(s));
}

/* ── طلبات شرح وتحليل ── */
function isAnalysisRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [
    'اشرح','شرح','شرّح','حلّل','حلل','تحليل','ناقش','قارن','مقارنة','قيّم','تقييم',
    'افحص','فحص','راجع','مراجعة','ادرس','دراسة','استخرج','لخّص من','استنتج',
    'analyze','explain','compare','evaluate','review','assess','examine','breakdown',
    'ما إيجابيات','ما سلبيات','مزايا','عيوب','장단점'
  ].some(w => t.includes(w));
}

/* ── طلبات نصيحة ومساعدة شخصية ── */
function isAdviceRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [
    'نصيحة','نصيحه','انصحني','انصح','أنصحني','أنصح','نصائح',
    'ساعدني في','ساعدني على','مساعدة في','ساعد في','كيف أتعامل',
    'ماذا أفعل','ماذا تنصحني','رأيك في','رأيك بـ','ما رأيك',
    'advice','suggest','recommend','help me with','what should i','how should i',
    'أريد خطة','أريد خطوات','ارشدني','إرشاد','دلّني على'
  ].some(w => t.includes(w));
}

/* ── طلبات ترجمة ── */
function isTranslateRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [
    'ترجم','ترجمة','ترجمه','ترجم لي','ترجملي','انقل إلى','انقل الى',
    'بالعربي','بالانجليزي','بالإنجليزي','بالفرنسي','باللغة',
    'translate','translation','to arabic','to english','to french',
    'من العربية إلى','من الإنجليزية إلى','ترجمة احترافية'
  ].some(w => t.includes(w));
}

/* ── طلبات تلخيص ── */
function isSummarizeRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [
    'لخّص','لخص','ملخص','ملخّص','تلخيص','اختصر','اختصار',
    'أبرز النقاط','أهم النقاط','الأفكار الرئيسية','موجز',
    'summarize','summary','brief','tl;dr','tldr','key points','main points',
    'اجعله مختصراً','اجعله موجزاً'
  ].some(w => t.includes(w));
}

/* ── مولّد الصوت / Voice ── */
function isVoiceSynthRequest(text) {
  if (!text) return false;
  const t = text.toLowerCase();
  return [
    'اقرأ بصوت','اقرأ لي','اقراه','اقره بصوت','تحويل نص لصوت','text to speech','tts',
    'اسمعني','اسمعه','نطق','صوّت هذا','صوت هذا','read aloud','speak this',
    'قراءة بصوت','حوّل لصوت','حول لصوت'
  ].some(w => t.includes(w));
}

/* ── استخراج أمر terminal من النص ── */
function extractTerminalCommand(text) {
  // كود داخل backticks
  const m = text.match(/`([^`]+)`/);
  if (m) return m[1].trim();
  // بعد كلمات مثل "شغّل" أو "نفّذ"
  const m2 = text.match(/(?:شغّل|شغل|نفّذ|نفذ|run|execute|أمر|command)[:\s]+(.+)/i);
  if (m2) return m2[1].trim();
  // السطر الكامل إذا يبدأ بأمر معروف
  const firstLine = text.split('\n')[0].trim();
  if (/^(npm|pnpm|yarn|node|python|pip|git|ls|pwd|mkdir|cat|echo|curl)\b/i.test(firstLine)) return firstLine;
  return null;
}

/* ── استخراج SQL من النص ── */
function extractSQL(text) {
  const m = text.match(/```sql\n?([\s\S]*?)```/i);
  if (m) return m[1].trim();
  const m2 = text.match(/(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)[\s\S]+?(?:;|$)/i);
  if (m2) return m2[0].trim();
  return null;
}
