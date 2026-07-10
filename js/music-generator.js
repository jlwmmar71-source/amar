/* ══════════════════════════════════════════════════════════════
   music-generator.js — مولّد الموسيقى والأغاني بالذكاء الاصطناعي
   Galaoum AI Engine v5.0 — by عمار جلعوم
   ══════════════════════════════════════════════════════════════ */

window.MusicGenerator = (function () {

  const GENRES = [
    { id: 'arabic',    label: '🎵 عربي',        en: 'Arabic music, oriental instruments, oud, qanun' },
    { id: 'pop',       label: '🎤 بوب',           en: 'pop music, catchy melody, modern production' },
    { id: 'hiphop',    label: '🎧 هيب هوب',      en: 'hip hop, trap beats, 808 bass, rhythm' },
    { id: 'classical', label: '🎻 كلاسيكي',       en: 'classical orchestra, strings, piano, symphonic' },
    { id: 'electronic',label: '⚡ إلكتروني',      en: 'electronic music, synthesizers, EDM, techno' },
    { id: 'jazz',      label: '🎷 جاز',           en: 'jazz, saxophone, piano, smooth rhythm, blues' },
    { id: 'cinematic', label: '🎬 سينمائي',       en: 'cinematic score, epic orchestra, emotional, Hans Zimmer style' },
    { id: 'lofi',      label: '☕ لو-فاي',       en: 'lofi hip hop, chill beats, relaxing, study music' },
  ];

  const MOODS = [
    { id: 'happy',   label: '😊 مبهج',    en: 'happy, uplifting, energetic' },
    { id: 'sad',     label: '😢 حزين',    en: 'sad, melancholic, emotional, minor key' },
    { id: 'epic',    label: '⚔️ ملحمي',   en: 'epic, powerful, heroic, triumphant' },
    { id: 'calm',    label: '🌊 هادئ',    en: 'calm, peaceful, ambient, soothing' },
    { id: 'romantic',label: '❤️ رومانسي', en: 'romantic, love, tender, beautiful' },
    { id: 'dark',    label: '🌑 غامق',    en: 'dark, mysterious, tense, ominous' },
  ];

  const TEMPOS = [
    { id: 'slow',   label: '🐢 بطيء',   bpm: 60  },
    { id: 'medium', label: '🚶 معتدل',  bpm: 90  },
    { id: 'fast',   label: '🏃 سريع',   bpm: 130 },
    { id: 'vfast',  label: '⚡ متسارع', bpm: 170 },
  ];

  let _state = {
    genre:  GENRES[0].id,
    mood:   MOODS[0].id,
    tempo:  TEMPOS[1].id,
    generating: false,
    audioCtx: null,
    playing: false,
    nodes: [],
  };

  /* ── كول-باك وضع المحادثة ── */
  let _chatCb = null; // { onProgress, onResult }

  /* ─── مقياسات موسيقية ─── */
  const SCALES = {
    arabic:     [0, 2, 3, 6, 7, 8, 11],   // مقام بياتي
    major:      [0, 2, 4, 5, 7, 9, 11],   // ماجور
    minor:      [0, 2, 3, 5, 7, 8, 10],   // مينور
    pentatonic: [0, 2, 4, 7, 9],           // بنتاتونيك
    blues:      [0, 3, 5, 6, 7, 10],       // بلوز
  };

  /* ─── فتح اللوحة ─── */
  function openPanel() {
    const p = document.getElementById('music-gen-panel');
    if (p) p.style.display = 'flex';
    _renderSelectors();
  }

  function closePanel() {
    const p = document.getElementById('music-gen-panel');
    if (p) p.style.display = 'none';
    _stopAll();
  }

  function _renderSelectors() {
    _renderGroup('mg-genre-list', GENRES, 'genre');
    _renderGroup('mg-mood-list',  MOODS,  'mood');
    _renderGroup('mg-tempo-list', TEMPOS, 'tempo');
  }

  function _renderGroup(id, items, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map(item => {
      const val    = item.id;
      const active = _state[key] === val;
      return `<button onclick="MusicGenerator._pick('${key}','${val}')" class="vg-chip ${active ? 'vg-chip-on' : ''}">${item.label}</button>`;
    }).join('');
  }

  function _pick(key, val) {
    _state[key] = val;
    _renderSelectors();
  }

  /* ─── التوليد الرئيسي ─── */
  async function generate() {
    if (_state.generating) return;
    const prompt = document.getElementById('mg-prompt')?.value?.trim();
    if (!prompt) { _showResult('<div class="vg-error">⚠️ أدخل وصف الموسيقى أولاً</div>'); return; }

    _state.generating = true;
    _stopAll();

    const genre  = GENRES.find(g => g.id === _state.genre) || GENRES[0];
    const mood   = MOODS.find(m => m.id === _state.mood)   || MOODS[0];
    const tempo  = TEMPOS.find(t => t.id === _state.tempo) || TEMPOS[1];

    _setStatus('🎵 جارٍ تحليل الطلب وإنشاء التكوين الموسيقي...', 10);
    _showResult('<div class="vg-loading-msg">🎵 جارٍ تأليف الموسيقى...</div>');

    try {
      /* الخطوة ١: توليد التكوين الموسيقي */
      const musicPrompt = `أنت ملحّن موسيقي محترف متخصص في الموسيقى العربية والعالمية.

أنشئ تكويناً موسيقياً كاملاً بناءً على:
- الوصف: ${prompt}
- النوع: ${genre.en}
- المزاج: ${mood.en}
- الإيقاع: ${tempo.bpm} BPM

أجب بالشكل التالي:
**العنوان**: [عنوان الأغنية/الموسيقى]
**التوصيف**: [وصف الأجواء الموسيقية بـ 2-3 جملة]
**الآلات**: [قائمة الآلات المستخدمة]
**التقدمة الهارمونية**: [مثال: Am - F - C - G]
**الهيكل**: [مقدمة - كوبليه - لازمة - خاتمة]
**كلمات الأغنية** (اختياري): [4-8 أسطر من الكلمات باللغة المناسبة]
**نصائح للعازف**: [ملاحظات تقنية مختصرة]`;

      let musicData = {};
      try {
        const reply = await callAPI(musicPrompt);
        musicData = _parseMusicReply(reply);
        musicData._rawReply = reply;
      } catch(e) {
        musicData = {
          title: prompt.substring(0, 30),
          description: `موسيقى ${genre.label} بمزاج ${mood.label}`,
          instruments: 'أوركسترا متكاملة',
          chord_prog: ['Am', 'F', 'C', 'G'],
          structure: 'مقدمة → كوبليه → لازمة → خاتمة',
          _rawReply: ''
        };
      }

      _setStatus('🎼 جارٍ تركيب الصوت...', 60);

      /* الخطوة ٢: تركيب الموسيقى بـ Web Audio API */
      const scaleKey = genre.id === 'arabic' ? 'arabic' :
                       mood.id === 'sad'    ? 'minor'   :
                       mood.id === 'blues'  ? 'blues'   : 'major';

      const audioResult = await _synthesizeMusic(
        musicData.chord_prog || ['Am', 'F', 'C', 'G'],
        tempo.bpm,
        scaleKey,
        genre.id
      );

      _setStatus('✅ اكتملت الموسيقى!', 100);
      _showMusicResult(musicData, audioResult, genre, mood, tempo, prompt);

    } catch (err) {
      _showResult(`<div class="vg-error">❌ خطأ: ${err.message}</div>`);
      _setStatus('', 0);
    }

    _state.generating = false;
  }

  /* ─── تركيب الموسيقى ─── */
  async function _synthesizeMusic(chords, bpm, scaleKey, genreId) {
    return new Promise(resolve => {
      try {
        const ctx    = new (window.AudioContext || window.webkitAudioContext)();
        _state.audioCtx = ctx;
        const scale  = SCALES[scaleKey] || SCALES.major;
        const baseHz = genreId === 'arabic' ? 220 : 261.63; // A3 أو C4
        const beatSec= 60 / bpm;
        const totalSec = 16 * beatSec;

        const masterGain = ctx.createGain();
        masterGain.gain.value = 0.6;
        masterGain.connect(ctx.destination);

        const reverb = _createReverb(ctx);
        reverb.connect(masterGain);

        /* ── لحن رئيسي ── */
        _playMelody(ctx, scale, baseHz, bpm, totalSec, reverb);

        /* ── إيقاع ── */
        _playRhythm(ctx, bpm, totalSec, masterGain);

        /* ── باس ── */
        _playBass(ctx, baseHz, bpm, totalSec, masterGain);

        resolve({ duration: totalSec, audioCtx: ctx });
      } catch(e) {
        resolve({ duration: 0, error: e.message });
      }
    });
  }

  function _playMelody(ctx, scale, baseHz, bpm, totalSec, dest) {
    const beatSec = 60 / bpm;
    const noteLen = beatSec * 0.5;
    const steps   = Math.floor(totalSec / noteLen);

    for (let i = 0; i < steps; i++) {
      if (Math.random() > 0.35) {
        const degree = scale[Math.floor(Math.random() * scale.length)];
        const octave = Math.random() > 0.7 ? 2 : 1;
        const freq   = baseHz * Math.pow(2, (degree + octave * 12) / 12);
        const start  = i * noteLen + ctx.currentTime + 0.1;

        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + noteLen * 0.9);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(start);
        osc.stop(start + noteLen);
        _state.nodes.push(osc);
      }
    }
  }

  function _playRhythm(ctx, bpm, totalSec, dest) {
    const beatSec = 60 / bpm;
    const beats   = Math.floor(totalSec / beatSec);

    for (let i = 0; i < beats; i++) {
      const start = i * beatSec + ctx.currentTime + 0.1;

      /* كيك (كل نبضة أولى وثالثة) */
      if (i % 4 === 0 || i % 4 === 2) {
        _playKick(ctx, start, dest);
      }
      /* سنير (النبضة الثانية والرابعة) */
      if (i % 4 === 1 || i % 4 === 3) {
        _playSnare(ctx, start, dest);
      }
      /* هاي-هات */
      if (i % 2 === 0) {
        _playHiHat(ctx, start, dest);
      }
    }
  }

  function _playKick(ctx, start, dest) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, start);
    osc.frequency.exponentialRampToValueAtTime(0.001, start + 0.5);
    gain.gain.setValueAtTime(0.8, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
    osc.connect(gain); gain.connect(dest);
    osc.start(start); osc.stop(start + 0.5);
    _state.nodes.push(osc);
  }

  function _playSnare(ctx, start, dest) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 1000;
    src.buffer = buf;
    gain.gain.setValueAtTime(0.3, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
    src.connect(filter); filter.connect(gain); gain.connect(dest);
    src.start(start); src.stop(start + 0.1);
    _state.nodes.push(src);
  }

  function _playHiHat(ctx, start, dest) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src  = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 8000;
    src.buffer = buf;
    gain.gain.setValueAtTime(0.08, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.04);
    src.connect(filter); filter.connect(gain); gain.connect(dest);
    src.start(start); src.stop(start + 0.05);
    _state.nodes.push(src);
  }

  function _playBass(ctx, baseHz, bpm, totalSec, dest) {
    const beatSec = 60 / bpm;
    const steps   = Math.floor(totalSec / (beatSec * 2));
    for (let i = 0; i < steps; i++) {
      const start = i * beatSec * 2 + ctx.currentTime + 0.1;
      const freq  = baseHz * (Math.random() > 0.5 ? 0.5 : 0.75);
      const osc   = ctx.createOscillator();
      const gain  = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + beatSec * 1.8);
      osc.connect(gain); gain.connect(dest);
      osc.start(start); osc.stop(start + beatSec * 2);
      _state.nodes.push(osc);
    }
  }

  function _createReverb(ctx) {
    const len  = ctx.sampleRate * 2;
    const buf  = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const node = ctx.createConvolver();
    node.buffer = buf;
    return node;
  }

  function _stopAll() {
    if (_state.audioCtx) {
      try { _state.audioCtx.close(); } catch(e) {}
      _state.audioCtx = null;
    }
    _state.nodes = [];
    _state.playing = false;
  }

  /* ─── تحليل رد الـ AI ─── */
  function _parseMusicReply(reply) {
    const get = (key) => {
      const m = reply.match(new RegExp(key + '[:\\*]+\\s*(.+)', 'i'));
      return m ? m[1].trim().replace(/\*\*/g, '') : '';
    };
    const chordStr = get('التقدمة الهارمونية') || 'Am - F - C - G';
    const chords   = chordStr.split(/[\s\-–]+/).filter(c => /^[A-Ga-g]/.test(c));
    return {
      title: get('العنوان') || 'موسيقى مولّدة',
      description: get('التوصيف') || '',
      instruments: get('الآلات') || '',
      structure: get('الهيكل') || 'مقدمة → كوبليه → لازمة',
      lyrics: (() => {
        const m = reply.match(/كلمات الأغنية[:\*]+\s*([\s\S]*?)(?=\*\*نصائح|\*\*الهيكل|$)/i);
        return m ? m[1].trim().replace(/\*\*/g, '') : '';
      })(),
      tips: get('نصائح للعازف') || '',
      chord_prog: chords.length > 0 ? chords : ['Am', 'F', 'C', 'G'],
    };
  }

  /* ─── عرض نتيجة الموسيقى ─── */
  function _showMusicResult(data, audio, genre, mood, tempo, prompt) {
    const html = `
<div class="vg-result-wrap">
  <!-- شريط التحكم الموسيقي -->
  <div class="mg-player">
    <div class="mg-player-info">
      <div class="mg-title">🎵 ${data.title || prompt.substring(0,40)}</div>
      <div class="mg-subtitle">${genre.label} · ${mood.label} · ${tempo.bpm} BPM</div>
    </div>
    <div class="mg-controls">
      <button onclick="MusicGenerator._replayMusic()" class="mg-btn-play" title="إعادة التشغيل">
        ▶ تشغيل مجدداً
      </button>
      <button onclick="MusicGenerator._stopMusic()" class="mg-btn-stop">⏹</button>
    </div>
    <div class="mg-wave" id="mg-wave">
      ${Array.from({length:40}, (_,i) => `<div class="mg-wave-bar" style="animation-delay:${i*0.05}s;height:${8+Math.random()*30}px"></div>`).join('')}
    </div>
  </div>

  <!-- المعلومات الموسيقية -->
  ${data.description ? `<div class="mg-info-block">🎼 ${data.description}</div>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
    ${data.instruments ? `
    <div class="mg-card">
      <div class="mg-card-title">🎸 الآلات</div>
      <div class="mg-card-body">${data.instruments}</div>
    </div>` : ''}
    <div class="mg-card">
      <div class="mg-card-title">🎹 التقدمة الهارمونية</div>
      <div class="mg-card-body">
        ${(data.chord_prog||[]).map(c=>`<span class="mg-chord">${c}</span>`).join(' → ')}
      </div>
    </div>
    ${data.structure ? `
    <div class="mg-card">
      <div class="mg-card-title">📋 الهيكل</div>
      <div class="mg-card-body">${data.structure}</div>
    </div>` : ''}
    ${data.tips ? `
    <div class="mg-card">
      <div class="mg-card-title">💡 نصائح للعازف</div>
      <div class="mg-card-body">${data.tips}</div>
    </div>` : ''}
  </div>

  ${data.lyrics ? `
  <div class="mg-lyrics">
    <div class="mg-card-title">🎤 كلمات الأغنية</div>
    <pre class="mg-lyrics-text">${data.lyrics}</pre>
  </div>` : ''}

  ${data._rawReply ? `
  <details style="margin-top:12px">
    <summary style="cursor:pointer;font-size:12px;color:#94a3b8;padding:6px 0">📜 التكوين الكامل</summary>
    <pre class="mg-raw">${data._rawReply.substring(0,1500)}</pre>
  </details>` : ''}

  <div style="display:flex;gap:8px;margin-top:12px">
    <button onclick="MusicGenerator.generate()" class="vg-action-btn">🔄 توليد جديد</button>
    <button onclick="MusicGenerator._exportMidi()" class="vg-action-btn vg-action-btn-2">📤 تصدير نوتة</button>
  </div>
</div>`;

    _showResult(html);
    _state.playing = true;

    /* تشغيل الأنيميشن */
    setTimeout(() => {
      document.querySelectorAll('.mg-wave-bar').forEach(b => b.classList.add('playing'));
    }, 100);
  }

  /* ─── إعادة التشغيل والإيقاف ─── */
  async function _replayMusic() {
    _stopAll();
    const genre  = GENRES.find(g => g.id === _state.genre) || GENRES[0];
    const mood   = MOODS.find(m => m.id === _state.mood)   || MOODS[0];
    const tempo  = TEMPOS.find(t => t.id === _state.tempo) || TEMPOS[1];
    const scaleKey = genre.id === 'arabic' ? 'arabic' :
                     mood.id === 'sad'    ? 'minor'  : 'major';
    await _synthesizeMusic(['Am','F','C','G'], tempo.bpm, scaleKey, genre.id);
    document.querySelectorAll('.mg-wave-bar').forEach(b => b.classList.add('playing'));
  }

  function _stopMusic() {
    _stopAll();
    document.querySelectorAll('.mg-wave-bar').forEach(b => b.classList.remove('playing'));
  }

  function _exportMidi() {
    if (typeof Toast !== 'undefined') Toast.info('📤 ميزة تصدير MIDI قريباً!');
  }

  function _setStatus(msg, pct) {
    const el = document.getElementById('mg-status');
    const pb = document.getElementById('mg-progress-bar');
    if (el) el.textContent = msg;
    if (pb) { pb.style.width = pct + '%'; pb.style.opacity = pct > 0 ? '1' : '0'; }
    if (_chatCb && _chatCb.onProgress) _chatCb.onProgress(msg, pct || 0);
  }

  function _showResult(html) {
    const el = document.getElementById('mg-result-area');
    if (el) el.innerHTML = html;
    if (_chatCb && _chatCb.onResult) _chatCb.onResult(html);
  }

  /* ══════════════════════════════════════════════
     توليد من داخل المحادثة مباشرة (Chat API)
     ══════════════════════════════════════════════ */
  async function generateFromChat(prompt, onProgress, onResult, opts) {
    if (_state.generating) {
      if (onProgress) onProgress('⚠️ هناك توليد جارٍ، انتظر لحظة...', 0);
      return;
    }
    opts = opts || {};
    _chatCb = { onProgress, onResult };

    // ضبط النوع والمزاج والإيقاع تلقائياً من الطلب
    const t = prompt.toLowerCase();
    if (t.includes('عربي') || t.includes('شرقي') || t.includes('arabic'))   _state.genre = 'arabic';
    else if (t.includes('جاز') || t.includes('jazz'))                         _state.genre = 'jazz';
    else if (t.includes('كلاسيك') || t.includes('classical'))                 _state.genre = 'classical';
    else if (t.includes('إلكتروني') || t.includes('electronic'))              _state.genre = 'electronic';
    else if (t.includes('لوفاي') || t.includes('lofi'))                       _state.genre = 'lofi';
    else if (t.includes('سينما') || t.includes('cinematic'))                  _state.genre = 'cinematic';
    else if (t.includes('هيب') || t.includes('hip'))                          _state.genre = 'hiphop';
    else                                                                       _state.genre = 'arabic';

    if (t.includes('حزين') || t.includes('sad'))                              _state.mood = 'sad';
    else if (t.includes('رومانسي') || t.includes('romantic'))                 _state.mood = 'romantic';
    else if (t.includes('ملحمي') || t.includes('epic'))                       _state.mood = 'epic';
    else if (t.includes('هادئ') || t.includes('calm'))                        _state.mood = 'calm';
    else if (t.includes('غامق') || t.includes('dark'))                        _state.mood = 'dark';
    else                                                                       _state.mood = 'happy';

    if (t.includes('بطيء') || t.includes('slow'))                             _state.tempo = 'slow';
    else if (t.includes('سريع') || t.includes('fast'))                        _state.tempo = 'fast';
    else                                                                       _state.tempo = 'medium';

    // حقن الـ prompt في حقل الإدخال
    const promptEl = document.getElementById('mg-prompt');
    if (promptEl) promptEl.value = prompt;

    try {
      await generate();
    } catch(e) {
      if (onResult) onResult(`<div style="color:#f87171;padding:12px">❌ فشل توليد الموسيقى: ${e.message}</div>`);
    } finally {
      _chatCb = null;
    }
  }

  return { openPanel, closePanel, generate, generateFromChat, _pick, _replayMusic, _stopMusic, _exportMidi };
})();
