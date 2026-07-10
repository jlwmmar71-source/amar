/**
 * Song Creator — Galaoum AI Engine v5.0
 * إنشاء أغاني من المحادثة مباشرة
 */
class SongCreator {
  constructor() {
    this.isOpen = false;
    this.generating = false;
    this.currentAudio = null;
    this.replicateToken = '';
    this.hfToken = '';
    this.chatKeywords = [
      'اصنع أغنية','اعمل أغنية','أنشئ أغنية','انشئ اغنيه','انشئ أغنية',
      'اصنع اغنيه','اعمل اغنيه','اغنية عن','أغنية عن','موسيقى عن',
      'لحن عن','اصنع لحن','اعمل لحن','song about','make a song','create a song',
      'generate music','make music','موسيقى','اغنيه','أغنيه','generate song'
    ];
    this.genres = [
      { id: 'arabic',   label: '🎶 شرقي عربي',   prompt: 'arabic oriental music, oud, darbuka, maqam' },
      { id: 'pop',      label: '🎤 بوب',           prompt: 'upbeat pop music, catchy melody, modern production' },
      { id: 'rap',      label: '🎧 راب / هيب هوب', prompt: 'hip hop beat, rap, trap, 808 bass' },
      { id: 'rock',     label: '🎸 روك',           prompt: 'rock music, electric guitar, drums, powerful' },
      { id: 'jazz',     label: '🎷 جاز',           prompt: 'smooth jazz, saxophone, piano, relaxing' },
      { id: 'ambient',  label: '🌙 هادئ / أمبيانت',prompt: 'ambient, calm, relaxing, peaceful, meditation' },
      { id: 'cinematic',label: '🎬 سينمائي',       prompt: 'epic cinematic music, orchestra, emotional, film score' },
      { id: 'lofi',     label: '☕ لو-فاي',        prompt: 'lofi hip hop, chill beats, study music, warm vinyl' },
    ];
    this.moods = [
      { id: 'happy',   label: '😊 سعيد',    word: 'happy, uplifting, joyful' },
      { id: 'sad',     label: '😢 حزين',    word: 'sad, melancholic, emotional, bittersweet' },
      { id: 'energetic',label:'⚡ نشيط',    word: 'energetic, powerful, driving, intense' },
      { id: 'romantic',label: '❤️ رومانسي', word: 'romantic, tender, loving, warm' },
      { id: 'dark',    label: '🌑 غامق',    word: 'dark, mysterious, dramatic, tense' },
    ];
    this.selectedGenre = 'arabic';
    this.selectedMood  = 'happy';
    this.init();
  }

  init() {
    this.loadKeys();
    this.injectStyles();
    this.injectHTML();
    this.bindEvents();
    this.hookChat();
  }

  loadKeys() {
    try {
      const cfg = window.CONFIG || {};
      this.replicateToken = cfg.REPLICATE_API_TOKEN || localStorage.getItem('replicate_token') || '';
      this.hfToken        = cfg.HF_TOKEN           || localStorage.getItem('hf_token')        || '';
    } catch {}
  }

  /* ─── STYLES ─── */
  injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      #sc-overlay {
        display:none; position:fixed; inset:0;
        background:rgba(0,0,0,0.88); z-index:9995;
        backdrop-filter:blur(8px);
      }
      #sc-panel {
        position:fixed; top:50%; left:50%;
        transform:translate(-50%,-50%);
        width:min(96vw,780px); max-height:92vh;
        background:#0a0d14;
        border:1px solid rgba(168,85,247,0.25);
        border-radius:20px; display:flex;
        flex-direction:column; z-index:9996;
        overflow:hidden; font-family:'Segoe UI',sans-serif;
        box-shadow:0 0 60px rgba(168,85,247,0.15);
      }
      #sc-header {
        padding:18px 24px;
        background:linear-gradient(135deg,#0f0a1e,#160a2a);
        border-bottom:1px solid rgba(168,85,247,0.2);
        display:flex; align-items:center; justify-content:space-between;
      }
      #sc-header h2 { margin:0; font-size:1.15rem; color:#e2d9f3; font-weight:700; }
      #sc-header h2 span { color:#a855f7; }
      #sc-close {
        background:none; border:none; color:#6b7280;
        font-size:1.4rem; cursor:pointer; padding:4px 8px;
        border-radius:6px; transition:all 0.2s;
      }
      #sc-close:hover { background:#1a1330; color:#e2e8f0; }

      #sc-body { flex:1; overflow-y:auto; padding:22px 24px; display:flex; flex-direction:column; gap:18px; }
      #sc-body::-webkit-scrollbar { width:5px; }
      #sc-body::-webkit-scrollbar-thumb { background:#2a1f45; border-radius:4px; }

      .sc-label {
        font-size:0.78rem; color:#9ca3af; font-weight:600;
        letter-spacing:0.06em; text-transform:uppercase; margin-bottom:8px;
      }
      #sc-prompt-box {
        background:#12101e; border:1px solid rgba(168,85,247,0.25);
        border-radius:12px; padding:14px 16px;
        color:#e2d9f3; font-size:0.95rem; font-family:inherit;
        direction:auto; resize:vertical; min-height:80px;
        outline:none; width:100%; box-sizing:border-box;
        transition:border-color 0.2s; line-height:1.6;
      }
      #sc-prompt-box:focus { border-color:#a855f7; }

      .sc-chips { display:flex; flex-wrap:wrap; gap:8px; }
      .sc-chip {
        padding:6px 14px; border-radius:20px; font-size:0.82rem;
        cursor:pointer; border:1px solid rgba(255,255,255,0.1);
        color:#9ca3af; background:#12101e; transition:all 0.2s;
        white-space:nowrap;
      }
      .sc-chip:hover { border-color:rgba(168,85,247,0.4); color:#c4b5fd; }
      .sc-chip.active {
        border-color:#a855f7; color:#a855f7;
        background:rgba(168,85,247,0.1);
        box-shadow:0 0 8px rgba(168,85,247,0.2);
      }

      #sc-duration-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .sc-dur-btn {
        padding:5px 16px; border-radius:20px; font-size:0.82rem;
        cursor:pointer; border:1px solid rgba(255,255,255,0.1);
        color:#9ca3af; background:#12101e; transition:all 0.2s;
      }
      .sc-dur-btn.active { border-color:#a855f7; color:#a855f7; background:rgba(168,85,247,0.1); }

      #sc-generate-btn {
        background:linear-gradient(135deg,#7c3aed,#a855f7);
        color:white; border:none; border-radius:12px;
        padding:14px; font-size:1rem; font-weight:700;
        cursor:pointer; transition:all 0.25s; width:100%;
        display:flex; align-items:center; justify-content:center; gap:10px;
        letter-spacing:0.02em;
      }
      #sc-generate-btn:hover:not(:disabled) { opacity:0.88; transform:translateY(-2px); box-shadow:0 8px 24px rgba(168,85,247,0.35); }
      #sc-generate-btn:disabled { opacity:0.45; cursor:not-allowed; transform:none; box-shadow:none; }

      #sc-result-box {
        display:none;
        background:linear-gradient(135deg,#0e0a1e,#130d24);
        border:1px solid rgba(168,85,247,0.3);
        border-radius:16px; padding:20px;
      }
      #sc-result-title { font-size:0.85rem; color:#a855f7; font-weight:600; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
      #sc-audio-player { width:100%; border-radius:10px; margin-bottom:14px; }
      #sc-lyrics-box {
        background:#12101e; border-radius:10px; padding:14px;
        color:#c4b5fd; font-size:0.88rem; line-height:1.8;
        direction:auto; white-space:pre-wrap; max-height:200px;
        overflow-y:auto; border:1px solid rgba(168,85,247,0.15);
      }
      #sc-action-row { display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; }
      .sc-action-btn {
        padding:8px 18px; border-radius:8px; font-size:0.82rem;
        font-weight:600; cursor:pointer; border:none; transition:all 0.2s;
      }
      .sc-action-btn:hover { opacity:0.85; transform:translateY(-1px); }
      #sc-download-btn { background:linear-gradient(135deg,#059669,#10b981); color:white; }
      #sc-share-btn    { background:linear-gradient(135deg,#1d4ed8,#3b82f6); color:white; }
      #sc-new-btn      { background:linear-gradient(135deg,#7c3aed,#a855f7); color:white; }

      #sc-progress {
        display:none; flex-direction:column;
        align-items:center; gap:14px; padding:30px;
      }
      .sc-wave {
        display:flex; align-items:flex-end; gap:4px; height:40px;
      }
      .sc-wave span {
        display:inline-block; width:6px; background:#a855f7;
        border-radius:3px; animation:sc-wave 1.2s ease-in-out infinite;
      }
      .sc-wave span:nth-child(2){animation-delay:.1s}
      .sc-wave span:nth-child(3){animation-delay:.2s}
      .sc-wave span:nth-child(4){animation-delay:.3s}
      .sc-wave span:nth-child(5){animation-delay:.4s}
      .sc-wave span:nth-child(6){animation-delay:.3s}
      .sc-wave span:nth-child(7){animation-delay:.2s}
      @keyframes sc-wave {
        0%,100%{height:8px;opacity:.5}
        50%{height:36px;opacity:1}
      }
      #sc-progress-text { color:#c4b5fd; font-size:0.9rem; text-align:center; }
      #sc-progress-sub  { color:#6b7280; font-size:0.78rem; text-align:center; }

      #sc-chat-hint {
        background:linear-gradient(135deg,rgba(168,85,247,0.08),rgba(124,58,237,0.05));
        border:1px solid rgba(168,85,247,0.2);
        border-radius:12px; padding:12px 16px;
        display:flex; align-items:center; gap:10px;
        font-size:0.82rem; color:#9ca3af;
      }
      #sc-chat-hint strong { color:#c4b5fd; }

      .sc-model-row { display:flex; gap:8px; flex-wrap:wrap; }
      .sc-model-chip {
        padding:5px 12px; border-radius:8px; font-size:0.78rem;
        cursor:pointer; border:1px solid rgba(255,255,255,0.08);
        color:#6b7280; background:#12101e; transition:all 0.2s;
      }
      .sc-model-chip.active { border-color:#a855f7; color:#c4b5fd; background:rgba(168,85,247,0.1); }
    `;
    document.head.appendChild(s);
  }

  /* ─── HTML ─── */
  injectHTML() {
    const overlay = document.createElement('div');
    overlay.id = 'sc-overlay';
    overlay.innerHTML = `
      <div id="sc-panel">
        <div id="sc-header">
          <h2>🎵 <span>منشئ الأغاني</span> — بالذكاء الاصطناعي</h2>
          <button id="sc-close">✕</button>
        </div>
        <div id="sc-body">

          <div id="sc-chat-hint">
            <span style="font-size:1.3rem">💬</span>
            <div>
              يمكنك الطلب من <strong>المحادثة مباشرة</strong> — اكتب مثلاً:
              <strong>"اصنع أغنية عن الحب بأسلوب شرقي"</strong>
            </div>
          </div>

          <div>
            <div class="sc-label">📝 وصف الأغنية أو الكلمات</div>
            <textarea id="sc-prompt-box" placeholder="اكتب موضوع الأغنية أو كلماتها...
مثال: أغنية حنين للوطن بأسلوب شرقي
مثال: أغنية عن الأصدقاء بأسلوب بوب مبهج"></textarea>
          </div>

          <div>
            <div class="sc-label">🎼 النوع الموسيقي</div>
            <div class="sc-chips" id="sc-genre-chips">
              ${this.genres.map(g => `
                <div class="sc-chip${g.id === this.selectedGenre ? ' active' : ''}" data-genre="${g.id}">
                  ${g.label}
                </div>`).join('')}
            </div>
          </div>

          <div>
            <div class="sc-label">🌈 المزاج</div>
            <div class="sc-chips" id="sc-mood-chips">
              ${this.moods.map(m => `
                <div class="sc-chip${m.id === this.selectedMood ? ' active' : ''}" data-mood="${m.id}">
                  ${m.label}
                </div>`).join('')}
            </div>
          </div>

          <div>
            <div class="sc-label">⏱ المدة</div>
            <div id="sc-duration-row">
              <div class="sc-dur-btn active" data-sec="15">15 ثانية</div>
              <div class="sc-dur-btn" data-sec="30">30 ثانية</div>
              <div class="sc-dur-btn" data-sec="60">دقيقة</div>
              <div class="sc-dur-btn" data-sec="120">دقيقتان</div>
            </div>
          </div>

          <div>
            <div class="sc-label">🤖 المحرك</div>
            <div class="sc-model-row" id="sc-model-chips">
              <div class="sc-model-chip active" data-engine="replicate">🎤 ACE-Step (غناء حقيقي — Replicate)</div>
              <div class="sc-model-chip" data-engine="elevenlabs">🎙️ ElevenLabs Music (غناء حقيقي)</div>
              <div class="sc-model-chip" data-engine="pollinations">🌸 Pollinations (مجاني، غير مضمون)</div>
              <div class="sc-model-chip" data-engine="huggingface">🤗 HuggingFace (موسيقى فقط)</div>
            </div>
          </div>

          <div id="sc-progress">
            <div class="sc-wave">
              <span></span><span></span><span></span><span></span>
              <span></span><span></span><span></span>
            </div>
            <div id="sc-progress-text">🎵 جاري التوليد...</div>
            <div id="sc-progress-sub">قد تستغرق العملية 30-90 ثانية</div>
          </div>

          <div id="sc-result-box">
            <div id="sc-result-title">✅ الأغنية جاهزة!</div>
            <audio id="sc-audio-player" controls></audio>
            <div class="sc-label" style="margin-top:10px">📜 الكلمات / الوصف المُولَّد</div>
            <div id="sc-lyrics-box"></div>
            <div id="sc-action-row">
              <button id="sc-download-btn" class="sc-action-btn">⬇️ تحميل</button>
              <button id="sc-new-btn"      class="sc-action-btn">🔄 أغنية جديدة</button>
              <button id="sc-to-chat-btn"  class="sc-action-btn" style="background:linear-gradient(135deg,#374151,#4b5563);color:white;">💬 أرسل للمحادثة</button>
            </div>
          </div>

          <button id="sc-generate-btn">🎵 اصنع الأغنية</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    this.overlay   = overlay;
    this.promptEl  = overlay.querySelector('#sc-prompt-box');
    this.genBtn    = overlay.querySelector('#sc-generate-btn');
    this.progressEl= overlay.querySelector('#sc-progress');
    this.resultEl  = overlay.querySelector('#sc-result-box');
    this.audioEl   = overlay.querySelector('#sc-audio-player');
    this.lyricsEl  = overlay.querySelector('#sc-lyrics-box');
    this.progText  = overlay.querySelector('#sc-progress-text');
    this.progSub   = overlay.querySelector('#sc-progress-sub');
    this.duration  = 15;
    this.engine    = 'replicate';
  }

  /* ─── EVENTS ─── */
  bindEvents() {
    document.querySelector('#sc-close').addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', e => { if (e.target === this.overlay) this.close(); });
    this.genBtn.addEventListener('click', () => this.generate());

    document.querySelectorAll('#sc-genre-chips .sc-chip').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('#sc-genre-chips .sc-chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        this.selectedGenre = c.dataset.genre;
      });
    });

    document.querySelectorAll('#sc-mood-chips .sc-chip').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('#sc-mood-chips .sc-chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        this.selectedMood = c.dataset.mood;
      });
    });

    document.querySelectorAll('.sc-dur-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.sc-dur-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.duration = parseInt(b.dataset.sec);
      });
    });

    document.querySelectorAll('#sc-model-chips .sc-model-chip').forEach(c => {
      c.addEventListener('click', () => {
        document.querySelectorAll('#sc-model-chips .sc-model-chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        this.engine = c.dataset.engine;
      });
    });

    document.querySelector('#sc-new-btn')?.addEventListener('click', () => {
      this.resultEl.style.display = 'none';
      this.promptEl.value = '';
      this.promptEl.focus();
    });

    document.querySelector('#sc-download-btn')?.addEventListener('click', () => {
      const src = this.audioEl.src;
      if (!src) return;
      const a = document.createElement('a');
      a.href = src; a.download = 'galaoum-song.mp3'; a.click();
    });

    document.querySelector('#sc-to-chat-btn')?.addEventListener('click', () => {
      const inp = document.getElementById('user-input') || document.querySelector('textarea[placeholder]');
      if (inp) {
        inp.value = `🎵 تم إنشاء أغنية: "${this.promptEl.value.slice(0,60)}"\nالرابط: ${this.audioEl.src}`;
        inp.focus();
      }
      this.close();
    });
  }

  /* ─── CHAT HOOK ─── */
  hookChat() {
    const tryHook = () => {
      const sendBtn = document.getElementById('send-btn') ||
                      document.querySelector('button[onclick*="send"]') ||
                      document.querySelector('.send-btn');
      const inputEl = document.getElementById('user-input') ||
                      document.querySelector('textarea[placeholder]');

      if (!inputEl) { setTimeout(tryHook, 1000); return; }

      const checkMsg = (text) => {
        if (!text) return false;
        const lower = text.toLowerCase();
        return this.chatKeywords.some(kw => lower.includes(kw.toLowerCase()));
      };

      const handleSend = (e) => {
        const text = inputEl.value.trim();
        if (checkMsg(text)) {
          e.preventDefault?.();
          e.stopPropagation?.();
          this.openFromChat(text);
          return false;
        }
      };

      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) handleSend(e);
      });

      if (sendBtn) sendBtn.addEventListener('click', handleSend);

      inputEl.addEventListener('input', () => {
        const text = inputEl.value.trim();
        let hint = document.getElementById('sc-chat-floating-hint');
        if (checkMsg(text)) {
          if (!hint) {
            hint = document.createElement('div');
            hint.id = 'sc-chat-floating-hint';
            hint.style.cssText = `
              position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
              background:linear-gradient(135deg,#7c3aed,#a855f7);
              color:white; padding:8px 18px; border-radius:20px;
              font-size:0.82rem; font-weight:600; z-index:9000;
              box-shadow:0 4px 20px rgba(168,85,247,0.4);
              cursor:pointer; white-space:nowrap;
              animation:sc-fadeIn 0.3s ease;
            `;
            hint.textContent = '🎵 اضغط Enter لإنشاء الأغنية';
            hint.addEventListener('click', () => this.openFromChat(text));
            document.body.appendChild(hint);
          }
        } else if (hint) {
          hint.remove();
        }
      });
    };

    setTimeout(tryHook, 800);
  }

  openFromChat(text) {
    const hint = document.getElementById('sc-chat-floating-hint');
    if (hint) hint.remove();

    const cleaned = text
      .replace(/اصنع|اعمل|أنشئ|انشئ|اصنع|create|make|generate/gi, '')
      .replace(/أغنية|اغنية|اغنيه|أغنيه|song|music|موسيقى|لحن/gi, '')
      .trim();

    this.open(cleaned || text);

    const genre = this.genres.find(g =>
      text.includes(g.label.replace(/[🎶🎤🎧🎸🎷🌙☕🎬]/g, '').trim())
    );
    if (genre) {
      this.selectedGenre = genre.id;
      document.querySelectorAll('#sc-genre-chips .sc-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.genre === genre.id);
      });
    }
  }

  /* ─── GENERATE ─── */
  async generate() {
    const prompt = this.promptEl.value.trim();
    if (!prompt || this.generating) return;

    this.generating = true;
    this.genBtn.disabled = true;
    this.resultEl.style.display = 'none';
    this.progressEl.style.display = 'flex';

    const genre = this.genres.find(g => g.id === this.selectedGenre);
    const mood  = this.moods.find(m => m.id === this.selectedMood);
    const musicPrompt = [genre?.prompt || '', mood?.word || '', prompt].filter(Boolean).join(', ');

    this.progText.textContent = '🎵 جاري بناء الأغنية...';
    this.progSub.textContent  = 'توليد الكلمات وتركيب اللحن...';

    try {
      const lyrics = await this.generateLyrics(prompt, genre?.label || '', mood?.label || '');
      this.progText.textContent = '🎼 جاري توليد الصوت...';
      this.progSub.textContent  = 'قد تستغرق 30-90 ثانية...';

      let audioUrl = null;

      if (this.engine === 'replicate') {
        audioUrl = await this.generateWithReplicate(musicPrompt, lyrics);
      } else if (this.engine === 'elevenlabs') {
        audioUrl = await this.generateWithElevenLabs(musicPrompt, lyrics);
      } else if (this.engine === 'huggingface') {
        audioUrl = await this.generateWithHuggingFace(musicPrompt);
      } else {
        audioUrl = await this.generateWithPollinations(musicPrompt);
      }

      if (!audioUrl && this.engine !== 'replicate') {
        this.progText.textContent = '🔄 تجربة ACE-Step...';
        audioUrl = await this.generateWithReplicate(musicPrompt, lyrics);
      }
      if (!audioUrl && this.engine !== 'elevenlabs') {
        this.progText.textContent = '🔄 تجربة ElevenLabs Music...';
        audioUrl = await this.generateWithElevenLabs(musicPrompt, lyrics);
      }
      if (!audioUrl && this.engine !== 'pollinations') {
        this.progText.textContent = '🔄 تجربة Pollinations...';
        audioUrl = await this.generateWithPollinations(musicPrompt);
      }

      this.progressEl.style.display = 'none';

      if (audioUrl) {
        this.audioEl.src = audioUrl;
        this.lyricsEl.textContent = lyrics;
        this.resultEl.style.display = 'block';
      } else {
        this.showLyricsOnly(lyrics, musicPrompt);
      }

    } catch (err) {
      this.progressEl.style.display = 'none';
      this.showError(err.message);
    } finally {
      this.generating = false;
      this.genBtn.disabled = false;
    }
  }

  async generateLyrics(topic, genre, mood) {
    const key = window.CONFIG?.OPENROUTER_API_KEY || '';
    if (!key) return `🎵 ${topic}\n\n(كلمات توليدية - جاري إنشاء اللحن...)`;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [{
            role: 'system',
            content: 'أنت كاتب كلمات أغاني محترف. اكتب كلمات أغنية قصيرة (مقطعان + لازمة) مناسبة للموضوع والأسلوب.'
          }, {
            role: 'user',
            content: `اكتب كلمات أغنية عن: "${topic}"\nالنوع: ${genre}\nالمزاج: ${mood}\nاكتب باللغة المناسبة للموضوع.`
          }],
          max_tokens: 400
        })
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || `🎵 ${topic}`;
    } catch {
      return `🎵 ${topic}`;
    }
  }

  async generateWithPollinations(prompt) {
    try {
      const enc = encodeURIComponent(prompt.slice(0, 200));
      const url = `https://audio.pollinations.ai/${enc}`;
      const res = await fetch(url, { method: 'GET' });
      if (res.ok && res.headers.get('content-type')?.includes('audio')) {
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
      if (res.ok) {
        const text = await res.text();
        const match = text.match(/https?:\/\/[^\s"']+\.(mp3|wav|ogg|m4a)/i);
        if (match) return match[0];
      }
    } catch {}
    return null;
  }

  async generateWithElevenLabs(prompt, lyrics) {
    try {
      const fullPrompt = lyrics && lyrics.trim() && !lyrics.includes('كلمات توليدية')
        ? `${prompt}. Song lyrics to sing: ${lyrics.slice(0, 600)}`
        : prompt;

      const res = await fetch('/.netlify/functions/song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          durationSeconds: this.duration,
          instrumental: false
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `فشل الخادم (${res.status})`);
      if (!data.audioBase64) return null;

      const byteChars = atob(data.audioBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: data.mime || 'audio/mpeg' });
      return URL.createObjectURL(blob);
    } catch (err) {
      this.showError(`ElevenLabs: ${err.message}`);
      return null;
    }
  }

  /* ACE-Step (lucataco/ace-step على Replicate) — أغنية حقيقية بصوت غناء + لحن كامل من الكلمات */
  async generateWithReplicate(prompt, lyrics) {
    try {
      this.progText.textContent = '🎤 جاري تسجيل الغناء واللحن (ACE-Step)...';
      const sungLyrics = (lyrics && lyrics.trim() && !lyrics.includes('كلمات توليدية'))
        ? lyrics.slice(0, 1200)
        : '[instrumental]';

      const res = await fetch('/.netlify/functions/song-replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: sungLyrics,
          tags: prompt,
          durationSeconds: this.duration
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `فشل الخادم (${res.status})`);
      return data.audioUrl || null;
    } catch (err) {
      this.showError(`ACE-Step: ${err.message}`);
      return null;
    }
  }

  async generateWithHuggingFace(prompt) {
    const token = this.hfToken;
    if (!token) return null;
    try {
      const res = await fetch('https://api-inference.huggingface.co/models/facebook/musicgen-small', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt.slice(0, 200) })
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.type.includes('audio')) return URL.createObjectURL(blob);
      }
    } catch {}
    return null;
  }

  showLyricsOnly(lyrics, prompt) {
    this.lyricsEl.textContent = lyrics;
    this.audioEl.src = '';
    this.audioEl.style.display = 'none';
    const title = document.getElementById('sc-result-title');
    if (title) title.textContent = '✍️ كلمات الأغنية — (الصوت غير متاح لهذا المحرك)';
    this.resultEl.style.display = 'block';
    const links = document.createElement('div');
    links.style.cssText = 'margin-top:12px;font-size:0.8rem;color:#9ca3af;line-height:2';
    links.innerHTML = `
      <div>🔗 للحصول على صوت الأغنية يمكنك استخدام:</div>
      <a href="https://suno.ai" target="_blank" style="color:#a855f7">🎵 Suno.ai</a> &nbsp;|&nbsp;
      <a href="https://udio.com" target="_blank" style="color:#a855f7">🎶 Udio.com</a> &nbsp;|&nbsp;
      <a href="https://mubert.com" target="_blank" style="color:#a855f7">🎼 Mubert</a>
    `;
    this.resultEl.appendChild(links);
  }

  showError(msg) {
    const err = document.createElement('div');
    err.style.cssText = 'background:#1a0a0a;border:1px solid #7f1d1d;border-radius:12px;padding:16px;color:#fca5a5;font-size:0.88rem;';
    err.innerHTML = `<strong>⚠️ تعذّر التوليد:</strong><br>${msg}`;
    document.querySelector('#sc-body').appendChild(err);
    setTimeout(() => err.remove(), 5000);
  }

  open(prefill = '') {
    this.overlay.style.display = 'block';
    this.isOpen = true;
    if (prefill) this.promptEl.value = prefill;
    this.promptEl.focus();
  }

  close() {
    this.overlay.style.display = 'none';
    this.isOpen = false;
  }
}

const songCreator = new SongCreator();
window.songCreator = songCreator;
window.openSongCreator = (prefill) => songCreator.open(prefill || '');
