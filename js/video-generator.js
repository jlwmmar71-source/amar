/* ══════════════════════════════════════════════════════════════
     video-generator.js — مولّد فيديو احترافي v2.0
     Galaoum AI Engine v5.0 — by عمار جلعوم

     الأوضاع:
       ① نص → فيديو   (T2V)
       ② صورة → فيديو (I2V)
       ③ فيديو → فيديو(V2V)
       ④ متعدد المشاهد (Multi-Scene)

     الترتيب التلقائي للمزودين (حسب نوع الطلب):
       Replicate → Fal.ai → HuggingFace → Pollinations (احتياطي)
   ══════════════════════════════════════════════════════════════ */

window.VideoGenerator = (function () {

  /* ════════════════════════════════════════════
     الثوابت والنماذج
     ════════════════════════════════════════════ */

  const HF_MODELS = [
    { id: 'zeroscope',    name: '⚡ Zeroscope v2',     hfId: 'cerspense/zeroscope_v2_576w',        note: '576×320 | مجاني' },
    { id: 'zeroscope-xl', name: '🎬 Zeroscope XL',     hfId: 'cerspense/zeroscope_v2_XL',          note: '1024×576 | مجاني' },
    { id: 'text2video',   name: '🤖 Text-to-Video MS',  hfId: 'ali-vilab/text-to-video-ms-1.7b',   note: '256×256 | مجاني' },
  ];

  const FAL_T2V_MODELS = [
    { id: 'fal-ai/wan-t2v',                        name: 'Wan T2V',           quality: 'high'    },
    { id: 'fal-ai/fast-animatediff/text-to-video', name: 'AnimateDiff Fast',  quality: 'fast'    },
    { id: 'fal-ai/minimax/video-01',               name: 'MiniMax',           quality: 'pro'     },
    { id: 'fal-ai/cogvideox-5b',                   name: 'CogVideoX-5B',      quality: 'hd'      },
    { id: 'fal-ai/ltx-video',                      name: 'LTX Video',         quality: 'balanced'},
    { id: 'fal-ai/kling-video/v1.5/standard/text-to-video', name: 'Kling 1.5',quality: 'pro'    },
  ];

  const FAL_I2V_MODELS = [
    { id: 'fal-ai/wan-i2v',                        name: 'Wan I2V'            },
    { id: 'fal-ai/stable-video-diffusion',         name: 'Stable Video Diff'  },
    { id: 'fal-ai/minimax/video-01-live',          name: 'MiniMax Live'       },
    { id: 'fal-ai/kling-video/v1.5/standard/image-to-video', name: 'Kling I2V'},
  ];

  const REPLICATE_T2V_MODELS = [
    'wavespeed-ai/wan-2.1/text-to-video-720p',
    'wavespeed-ai/wan-2.1/text-to-video-480p',
    'minimax/video-01',
  ];

  const STYLES = [
    { id: 'none',        label: '🎯 بدون أسلوب'  },
    { id: 'cinematic',   label: '🎬 سينمائي',     en: 'cinematic, film grain, dramatic lighting, 4K, anamorphic lens, shallow depth of field' },
    { id: 'anime',       label: '🌸 أنمي',         en: 'anime style, vibrant colors, cel shaded, fluid animation, detailed backgrounds' },
    { id: 'realistic',   label: '📸 واقعي',        en: 'photorealistic, 8K UHD, ultra detailed, sharp focus, RAW photo, natural lighting' },
    { id: 'cartoon',     label: '🎨 كارتون',       en: 'cartoon, bright colors, fun, illustrated, smooth motion, expressive' },
    { id: 'scifi',       label: '🚀 خيال علمي',   en: 'sci-fi, neon lights, cyberpunk, futuristic, volumetric fog, holographic' },
    { id: 'fantasy',     label: '🧙 فانتازيا',     en: 'fantasy, magical, ethereal glow, mystical atmosphere, epic scale' },
    { id: 'documentary', label: '📹 وثائقي',       en: 'documentary style, natural lighting, handheld camera, raw, authentic, candid' },
    { id: '3d',          label: '🎮 ثلاثي الأبعاد',en: '3D rendered, octane render, volumetric lighting, subsurface scattering, PBR' },
  ];

  const QUALITY_PRESETS = [
    { id: 'fast',     label: '⚡ سريع',         note: '15-60 ث'  },
    { id: 'balanced', label: '⚖️ متوازن',       note: '1-3 د'    },
    { id: 'quality',  label: '💎 جودة عالية',   note: '3-10 د'   },
  ];

  const DURATIONS = [
    { id: '2', label: '2 ث' },
    { id: '4', label: '4 ث' },
    { id: '6', label: '6 ث' },
    { id: '8', label: '8 ث' },
  ];

  /* ════════════════════════════════════════════
     الحالة المركزية
     ════════════════════════════════════════════ */
  let _state = {
    mode:        't2v',
    model:       HF_MODELS[0].id,
    style:       'none',
    quality:     'balanced',
    duration:    '4',
    autoEnhance: true,
    generating:  false,
    cancelled:   false,
    lastVideoUrl:    null,
    lastPrompt:      null,
    lastEnhanced:    null,
    inputImageB64:   null,
    inputVideoBlob:  null,
    sceneCount:      3,
    sceneConsistency: { character: true, background: true, lighting: true, style: true },
    history:         [],
    _fallbackIv:     null,
  };

  /* ════════════════════════════════════════════
     كول-باك وضع المحادثة (Chat Mode)
     ════════════════════════════════════════════ */
  let _chatCb = null;
  // { onProgress: fn(msg,pct,eta), onResult: fn(html) }

  /* ════════════════════════════════════════════
     سجل الفيديوهات (localStorage)
     ════════════════════════════════════════════ */
  const History = {
    KEY: 'galaoum_video_history_v2',

    load() {
      try { _state.history = JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
      catch { _state.history = []; }
    },

    save(entry) {
      _state.history.unshift({
        id:       Date.now(),
        date:     new Date().toLocaleString('ar-SA'),
        mode:     entry.mode || 't2v',
        prompt:   (entry.prompt || '').slice(0, 200),
        url:      entry.url   || null,
        provider: entry.provider || '—',
        style:    entry.style    || 'none',
        duration: entry.duration || '4',
        scenes:   entry.scenes   || null,
      });
      if (_state.history.length > 60) _state.history.length = 60;
      try { localStorage.setItem(this.KEY, JSON.stringify(_state.history)); } catch {}
    },

    remove(id) {
      _state.history = _state.history.filter(h => h.id !== id);
      try { localStorage.setItem(this.KEY, JSON.stringify(_state.history)); } catch {}
    },

    clear() {
      _state.history = [];
      try { localStorage.removeItem(this.KEY); } catch {}
    },
  };

  /* ════════════════════════════════════════════
     محسّن الـ Prompt الذكي
     ════════════════════════════════════════════ */
  const PromptEnhancer = {
    async enhance(userPrompt, mode, styleMeta, consistencyData) {
      const styleEn = styleMeta?.en || '';
      const cons    = consistencyData || {};

      let instruction = '';
      if (mode === 't2v' || mode === 'multi') {
        instruction = `You are an expert at writing prompts for AI video generation models (Wan, CogVideoX, Kling, MiniMax).
Convert the following description into a professional English text-to-video prompt.

Rules:
- Describe camera motion (pan, zoom, dolly, aerial)
- Describe element motion (subject movement, wind, water, etc.)
- Include lighting quality and color grading
- Use technical film terms naturally
- Maximum 100 words, single coherent sentence/paragraph
- Add at the end: ", smooth motion, high quality, detailed"
${styleEn ? '- Visual style to include: ' + styleEn : ''}
${cons.character ? '- Keep character consistent: ' + cons.character : ''}
${cons.background ? '- Setting: ' + cons.background : ''}

Input: "${userPrompt}"

Output the enhanced English prompt ONLY, no quotes or explanation.`;
      } else if (mode === 'i2v') {
        instruction = `You are an expert at writing prompts for image-to-video AI (Wan I2V, Stable Video Diffusion).
Convert this description into a concise English motion prompt for animating an image.

Rules:
- Focus on describing the motion/animation (camera movement, element motion)
- Keep it under 60 words
- Imply natural, smooth movement
${styleEn ? '- Style: ' + styleEn : ''}

Input: "${userPrompt}"

Output the motion prompt ONLY.`;
      } else if (mode === 'v2v') {
        instruction = `Write a concise English style-transfer prompt for video-to-video AI.
Describe the visual transformation to apply to the existing video.
${styleEn ? 'Target style: ' + styleEn : ''}
Input: "${userPrompt}"
Output the prompt ONLY.`;
      }

      try {
        const result = await callAPI(instruction);
        return result.trim().replace(/^["']|["']$/g, '');
      } catch {
        try {
          const t = await callAPI(`Translate to concise English for video AI: "${userPrompt}"`);
          return t.trim() + (styleEn ? ', ' + styleEn : '') + ', smooth motion, high quality';
        } catch {
          return userPrompt + (styleEn ? ', ' + styleEn : '') + ', smooth motion, high quality, 4K';
        }
      }
    },
  };

  /* ════════════════════════════════════════════
     محلّل القصة (Multi-Scene)
     ════════════════════════════════════════════ */
  const SceneParser = {
    async parse(story, count) {
      const n = Math.max(2, Math.min(8, count));
      const prompt = `You are a professional film director and cinematographer.
Read the following story and divide it into exactly ${n} sequential visual scenes for a video.

For each scene, write a cinematic description of what would be visually shown.
Also extract consistency anchors (main character appearance, setting style, lighting).

Story: "${story}"

Respond with ONLY this JSON (no markdown):
{
  "consistency": {
    "character": "detailed character description (appearance, clothing, age)",
    "background_style": "environment and setting style",
    "lighting": "lighting type and quality",
    "visual_style": "overall visual aesthetic"
  },
  "scenes": [
    {"num": 1, "title": "Scene Title", "description": "Arabic description for user", "prompt_en": "English cinematic prompt for this scene"}
  ]
}`;

      try {
        const raw    = await callAPI(prompt);
        const match  = raw.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('no json');
        return JSON.parse(match[0]);
      } catch {
        // fallback: split by sentences
        const sents = story.split(/[.!?،؟]/g).filter(s => s.trim().length > 8);
        const per   = Math.ceil(sents.length / n);
        const scenes = Array.from({ length: n }, (_, i) => {
          const slice = sents.slice(i * per, (i + 1) * per).join('. ').trim();
          return { num: i + 1, title: `مشهد ${i + 1}`, description: slice || `مشهد ${i + 1}`, prompt_en: slice };
        });
        return { consistency: { character: '', background_style: '', lighting: 'natural', visual_style: '' }, scenes };
      }
    },
  };

  /* ════════════════════════════════════════════
     محقّق الفيديو
     ════════════════════════════════════════════ */
  const VideoValidator = {
    validate(url) {
      return new Promise(resolve => {
        if (!url) { resolve({ ok: false, reason: 'لا يوجد URL' }); return; }
        const v  = document.createElement('video');
        v.preload = 'metadata';
        v.muted  = true;
        const to = setTimeout(() => {
          v.src = '';
          resolve({ ok: true, duration: null, width: null, height: null }); // timeout = assume OK for remote URLs
        }, 12000);
        v.onloadedmetadata = () => {
          clearTimeout(to);
          if (!v.duration || v.duration < 0.3) resolve({ ok: false, reason: 'مدة قصيرة جداً' });
          else resolve({ ok: true, duration: v.duration, width: v.videoWidth, height: v.videoHeight });
        };
        v.onerror = () => { clearTimeout(to); resolve({ ok: false, reason: 'خطأ تحميل' }); };
        v.src = url;
      });
    },
  };

  /* ════════════════════════════════════════════
     فحص المزودين المتاحين
     ════════════════════════════════════════════ */
  function _getProviders() {
    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const out = [];
    const j2v  = cfg.JSON2VIDEO_API_KEY  || '';
    const jc1  = cfg.JSONCLIP_API_KEY_1  || '';
    const jc2  = cfg.JSONCLIP_API_KEY_2  || '';
    const rep  = cfg.REPLICATE_API_TOKEN || '';
    const fal  = cfg.FAL_KEY             || '';
    const hf   = cfg.HF_TOKEN            || '';

    if (j2v && j2v.length > 10 && !j2v.includes('_HERE')) out.push({ id: 'json2video', label: '🎬 JSON2Video', key: j2v });
    // JSONClip: مفتاحان — يُجرَّبان بالتناوب
    const jcKeys = [jc1, jc2].filter(k => k && k.length > 10 && !k.includes('_HERE'));
    if (jcKeys.length > 0) out.push({ id: 'jsonclip', label: '🎞️ JSONClip', key: jcKeys[0], key2: jcKeys[1] || null });
    if (rep && rep.length > 5  && !rep.includes('_HERE')) out.push({ id: 'replicate', label: 'Replicate',    key: rep });
    if (fal && fal.length > 10 && !fal.includes('_HERE')) out.push({ id: 'fal',       label: 'Fal.ai',      key: fal });
    if (hf  && hf.length  > 10 && !hf.includes('_HERE'))  out.push({ id: 'hf',        label: 'HuggingFace', key: hf  });
    out.push({ id: 'pollinations', label: '🌸 Pollinations', key: '' });
    return out;
  }

  function _getAvailableProviders() { return _getProviders(); } // alias للتوافق مع الكود القديم

  function _providersFor(mode) {
    const all = _getProviders();
    if (mode === 'i2v') return all.filter(p => ['fal', 'replicate', 'pollinations'].includes(p.id));
    if (mode === 'v2v') return all.filter(p => ['fal', 'pollinations'].includes(p.id));
    return all;
  }

  /* ════════════════════════════════════════════
     توليد عبر Replicate
     ════════════════════════════════════════════ */
  async function _generateWithReplicate(prompt, token, mode, imageB64) {
    if (mode === 'i2v') {
      // Stable Video Diffusion
      const body = { version: 'latest', input: { input_image: 'data:image/jpeg;base64,' + imageB64, motion_bucket_id: 100, fps: 25, decoding_chunk_size: 14 } };
      return await _replicatePredict('stability-ai/stable-video-diffusion', body, token);
    }

    // T2V — try multiple models
    for (const modelId of REPLICATE_T2V_MODELS) {
      if (_state.cancelled) return null;
      try {
        const frames = _state.duration === '2' ? 33 : _state.duration === '6' ? 97 : _state.duration === '8' ? 129 : 65;
        const body = {
          version: 'latest',
          input: { prompt, num_frames: frames, fps: 16, guidance_scale: 7.5, num_inference_steps: _state.quality === 'fast' ? 15 : _state.quality === 'quality' ? 50 : 30 },
        };
        const url = await _replicatePredict(modelId, body, token);
        if (url) return url;
      } catch { continue; }
    }
    return null;
  }

  async function _replicatePredict(modelId, body, token) {
    const create = await fetch(`https://api.replicate.com/v1/models/${modelId}/predictions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait=30' },
      body: JSON.stringify(body),
    });
    if (!create.ok) throw new Error('Replicate ' + create.status);
    const pred  = await create.json();
    const predId = pred.id;
    if (!predId) throw new Error('Replicate: لا يوجد prediction ID');

    for (let i = 0; i < 80 && !_state.cancelled; i++) {
      await new Promise(r => setTimeout(r, 5000));
      _setStatus(`⏳ Replicate — ${modelId.split('/').pop()} (${(i + 1) * 5}ث)...`, Math.min(20 + i * 0.9, 85), _etaStr(i * 5, 180));
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${predId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!poll.ok) continue;
      const data = await poll.json();
      if (data.status === 'succeeded') {
        const url = Array.isArray(data.output) ? data.output[0] : data.output;
        return url || null;
      }
      if (data.status === 'failed' || data.status === 'canceled') throw new Error('Replicate فشل: ' + (data.error || ''));
    }
    throw new Error('Replicate: انتهى الوقت');
  }

  /* ════════════════════════════════════════════
     توليد عبر Fal.ai
     ════════════════════════════════════════════ */
  async function _generateWithFal(prompt, key, mode, imageB64) {
    let modelId;
    if (mode === 'i2v') {
      modelId = 'fal-ai/wan-i2v';
    } else if (mode === 'v2v') {
      // V2V: استخدم نموذج style-transfer أو upscaler
      // نرفع الفيديو أولاً كـ data URL إن أمكن، وإلا نستخدم T2V
      modelId = 'fal-ai/creative-upscaler'; // fallback — V2V حقيقي يحتاج upload endpoint
    } else {
      const q = _state.quality;
      if      (q === 'fast')    modelId = 'fal-ai/fast-animatediff/text-to-video';
      else if (q === 'quality') modelId = 'fal-ai/wan-t2v';
      else                      modelId = 'fal-ai/minimax/video-01';
    }

    const steps  = _state.quality === 'fast' ? 15 : _state.quality === 'quality' ? 50 : 30;
    const frames = +_state.duration === 2 ? 32 : +_state.duration === 6 ? 96 : +_state.duration === 8 ? 128 : 64;

    let reqBody;
    if (mode === 'i2v' && imageB64) {
      reqBody = { image_url: 'data:image/jpeg;base64,' + imageB64, prompt, num_frames: 81, num_inference_steps: 30, guidance_scale: 7.5 };
    } else if (mode === 'v2v' && _state.inputVideoBlob) {
      // رفع الفيديو عبر Fal storage ثم إرسال الـ URL
      let videoUrl = null;
      try {
        _setStatus('📤 جارٍ رفع الفيديو إلى Fal.ai...', 12);
        const formData = new FormData();
        formData.append('file', _state.inputVideoBlob, 'input.mp4');
        const uploadRes = await fetch('https://storage.googleapis.com/isolate-dev-hot-server-runner-uploads', {
          method: 'POST', headers: { Authorization: `Key ${key}` }, body: formData,
        }).catch(() => null);
        if (uploadRes?.ok) { const j = await uploadRes.json(); videoUrl = j.url || j.cdn_url || null; }
      } catch {}
      // إن فشل الرفع — ارجع لـ blob URL كـ data
      if (!videoUrl && _state.inputVideoBlob) {
        const ab     = await _state.inputVideoBlob.arrayBuffer();
        const b64    = btoa(String.fromCharCode(...new Uint8Array(ab)));
        videoUrl     = 'data:video/mp4;base64,' + b64;
      }
      reqBody = { video_url: videoUrl, prompt, num_inference_steps: steps };
    } else {
      reqBody = { prompt, num_frames: frames, num_inference_steps: steps, guidance_scale: 7.5 };
    }

    // Try queue submit first (async), fallback to direct
    try {
      const sub = await fetch(`https://queue.fal.run/${modelId}`, {
        method: 'POST',
        headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      if (!sub.ok) throw new Error('Fal queue ' + sub.status);
      const subData = await sub.json();
      const reqId   = subData.request_id;
      if (!reqId) throw new Error('Fal: no request_id');

      for (let i = 0; i < 80 && !_state.cancelled; i++) {
        await new Promise(r => setTimeout(r, 5000));
        _setStatus(`🎨 Fal.ai — ${modelId.split('/').pop()} (${(i + 1) * 5}ث)...`, Math.min(20 + i * 0.9, 85), _etaStr(i * 5, 200));
        const statusR = await fetch(`https://queue.fal.run/${modelId}/requests/${reqId}/status`, { headers: { Authorization: `Key ${key}` } });
        if (!statusR.ok) continue;
        const st = await statusR.json();
        if (st.status === 'COMPLETED') {
          const resR = await fetch(`https://queue.fal.run/${modelId}/requests/${reqId}`, { headers: { Authorization: `Key ${key}` } });
          const res  = await resR.json();
          const url  = res?.video?.url || res?.output?.video?.url || res?.video_url || res?.url || null;
          return { url, model: modelId };
        }
        if (st.status === 'FAILED') throw new Error('Fal فشل');
      }
      throw new Error('Fal: انتهى الوقت');
    } catch (queueErr) {
      // fallback: direct call
      const direct = await fetch(`https://fal.run/${modelId}`, {
        method: 'POST',
        headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });
      if (!direct.ok) throw new Error('Fal direct ' + direct.status);
      const data = await direct.json();
      const url  = data?.video?.url || data?.url || data?.output?.url || null;
      return { url, model: modelId };
    }
  }

  /* ════════════════════════════════════════════
     توليد عبر JSON2Video
     ════════════════════════════════════════════ */
  async function _generateWithJSON2Video(userPrompt, enhancedPrompt) {
    const key = (typeof CONFIG !== 'undefined' && CONFIG.JSON2VIDEO_API_KEY) ? CONFIG.JSON2VIDEO_API_KEY : '';
    if (!key || key.length < 10) throw new Error('JSON2Video: لا يوجد مفتاح');

    const dur        = parseInt(_state.duration) || 4;
    const styleMeta  = STYLES.find(s => s.id === _state.style);
    const bgImg      = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}&width=1280&height=720&nologo=true&seed=${Date.now()}`;

    const movie = {
      width: 1280,
      height: 720,
      fps: 25,
      scenes: [{
        comment: 'Galaoum AI — Scene 1',
        duration: dur,
        background: bgImg,
        elements: [
          {
            type: 'shape',
            shape: 'rectangle',
            width: 1280, height: 150,
            x: 0, y: 570,
            fill: 'rgba(0,0,0,0.65)',
            z_index: 2
          },
          {
            type: 'text',
            html: `<p style="font-size:26px;color:#ffffff;text-align:center;font-family:Arial,sans-serif;padding:10px 20px;line-height:1.4">${userPrompt.slice(0, 120)}</p>`,
            width: 1240, height: 140,
            x: 20, y: 575,
            z_index: 3,
            animations: [{ type: 'fadeIn', duration: 800 }]
          },
          {
            type: 'shape',
            shape: 'rectangle',
            width: 1280, height: 720,
            x: 0, y: 0,
            fill: 'rgba(0,0,0,0)',
            z_index: 4,
            animations: [{ type: 'scale', start_scale: 1.0, end_scale: 1.06, duration: dur * 1000, easing: 'linear' }]
          }
        ]
      }],
      exports: [{ type: 'video', format: 'mp4' }]
    };

    _setStatus('🎬 JSON2Video — جارٍ إرسال طلب الفيديو...', 20);

    const createRes = await fetch('https://api.json2video.com/v2/movies', {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(movie)
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error('JSON2Video: ' + (err.message || err.error || createRes.status));
    }

    const created = await createRes.json();
    const movieId = created.movie;
    if (!movieId) throw new Error('JSON2Video: لم يُرجع movie ID');

    _setStatus(`🎬 JSON2Video — معالجة الفيديو... (${dur * 5}ث متوقع)`, 30, `${dur * 5}ث`);

    // polling حتى 3 دقائق
    for (let i = 0; i < 60 && !_state.cancelled; i++) {
      await new Promise(r => setTimeout(r, 3000));
      _setStatus(`🎬 JSON2Video — ${(i + 1) * 3}ث... (${movieId})`, Math.min(32 + i * 1, 88), _etaStr((i + 1) * 3, 90));

      const pollRes = await fetch(`https://api.json2video.com/v2/movies?project=${movieId}`, {
        headers: { 'x-api-key': key }
      });
      if (!pollRes.ok) continue;

      const data = await pollRes.json();
      const mv   = (data.movies && data.movies[0]) ? data.movies[0] : data;

      if (mv.status === 'done' || mv.status === 'completed') {
        const url = mv.url || mv.download_url || mv.movie_url || null;
        if (!url) throw new Error('JSON2Video: الفيديو جاهز لكن لا يوجد رابط');
        return url;
      }
      if (mv.status === 'error' || mv.status === 'failed') {
        throw new Error('JSON2Video: فشل الرندر — ' + (mv.error || mv.message || ''));
      }
    }
    throw new Error('JSON2Video: انتهى وقت الانتظار');
  }

  /* ════════════════════════════════════════════
     توليد عبر JSONClip (مفتاحان بالتناوب)
     ════════════════════════════════════════════ */
  async function _generateWithJSONClip(userPrompt, enhancedPrompt, prov) {
    const keys = [prov.key, prov.key2].filter(Boolean);
    if (!keys.length) throw new Error('JSONClip: لا توجد مفاتيح');

    const dur    = parseInt(_state.duration) || 4;
    const bgImg  = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}&width=1280&height=720&nologo=true&seed=${Date.now()}`;

    const schema = {
      width: 1280,
      height: 720,
      fps: 25,
      duration: dur,
      scenes: [{
        background: bgImg,
        elements: [
          {
            type: 'rectangle',
            x: 0, y: 560,
            width: 1280, height: 160,
            color: 'rgba(0,0,0,0.65)',
            zIndex: 2
          },
          {
            type: 'text',
            x: 40, y: 575,
            width: 1200, height: 140,
            text: userPrompt.slice(0, 120),
            fontSize: 26,
            color: '#ffffff',
            fontFamily: 'Arial',
            align: 'center',
            zIndex: 3,
            animation: { type: 'fadeIn', duration: 800 }
          }
        ]
      }]
    };

    let lastErr = null;
    for (const key of keys) {
      if (_state.cancelled) break;
      try {
        _setStatus(`🎞️ JSONClip — جارٍ إرسال طلب الفيديو...`, 20);

        const createRes = await fetch('https://api.jsonclip.com/render', {
          method: 'POST',
          headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify(schema)
        });

        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}));
          throw new Error('JSONClip: ' + (err.error || err.message || createRes.status));
        }

        const created = await createRes.json();
        // استخراج الـ ID — قد يختلف حسب الـ API
        const jobId = created.id || created.job_id || created.render_id || created.renderId || null;

        if (!jobId) {
          // قد يُرجع الرابط مباشرة
          const directUrl = created.url || created.video_url || created.output || null;
          if (directUrl) return directUrl;
          throw new Error('JSONClip: لم يُرجع job ID أو رابط مباشر');
        }

        _setStatus(`🎞️ JSONClip — معالجة... (${jobId})`, 30, `${dur * 5}ث`);

        // polling حتى 3 دقائق
        for (let i = 0; i < 60 && !_state.cancelled; i++) {
          await new Promise(r => setTimeout(r, 3000));
          _setStatus(`🎞️ JSONClip — ${(i + 1) * 3}ث...`, Math.min(32 + i, 88), _etaStr((i + 1) * 3, 90));

          const pollRes = await fetch(`https://api.jsonclip.com/render/${jobId}`, {
            headers: { 'x-api-key': key }
          });
          if (!pollRes.ok) continue;

          const data = await pollRes.json();
          const status = (data.status || '').toLowerCase();

          if (status === 'done' || status === 'completed' || status === 'success') {
            const url = data.url || data.video_url || data.output || data.download_url || null;
            if (!url) throw new Error('JSONClip: الفيديو جاهز لكن لا يوجد رابط');
            return url;
          }
          if (status === 'error' || status === 'failed') {
            throw new Error('JSONClip: فشل الرندر — ' + (data.error || data.message || ''));
          }
        }
        throw new Error('JSONClip: انتهى وقت الانتظار');

      } catch (e) {
        lastErr = e;
        if (keys.indexOf(key) < keys.length - 1) {
          _setStatus(`⚠️ JSONClip مفتاح 1 فشل، جارٍ تجربة مفتاح 2...`, 22);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    throw lastErr || new Error('JSONClip: فشلت جميع المفاتيح');
  }

  /* ════════════════════════════════════════════
     توليد عبر HuggingFace
     ════════════════════════════════════════════ */
  async function _generateWithHF(prompt, model, token) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 180000);
    try {
      const res = await fetch(`https://api-inference.huggingface.co/models/${model.hfId}`, {
        method: 'POST', signal: ctrl.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
      });
      clearTimeout(tid);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.estimated_time) {
          // model loading — wait
          await new Promise(r => setTimeout(r, Math.min((j.estimated_time || 30) * 1000 + 5000, 90000)));
          return await _generateWithHF(prompt, model, token); // retry once
        }
        throw new Error(`HF ${res.status}`);
      }
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('video') && !ct.includes('octet')) throw new Error('HF: لم يُرجع فيديو');
      return await res.blob();
    } finally { clearTimeout(tid); }
  }

  /* ════════════════════════════════════════════
     عرض الفيديو الناجح
     ════════════════════════════════════════════ */
  function _showVideoPlayer(url, userPrompt, providerInfo, enhancedPrompt, extra) {
    const ex       = extra || {};
    const styleLabel = (STYLES.find(s => s.id === _state.style) || {}).label || '';
    const provName = providerInfo?.name || 'فيديو ناجح';
    const dur      = ex.validInfo?.duration ? ex.validInfo.duration.toFixed(1) + 'ث' : (_state.duration + 'ث');
    const dims     = ex.validInfo?.width ? ` · ${ex.validInfo.width}×${ex.validInfo.height}` : '';

    _showResult(`
      <div class="vg-real-result">
        <div class="vg-video-badge">
          ✅ ${provName}${ex.sceneNum ? ` — مشهد ${ex.sceneNum}/${ex.totalScenes}` : ''} · ${dur}${dims}
        </div>
        <video class="vg-real-video" src="${url}" controls autoplay loop muted playsinline></video>
        <div class="vg-video-meta">
          <span>🎨 ${styleLabel || 'بدون أسلوب'}</span>
          <span>⚡ ${_state.quality}</span>
          <span>🔧 ${provName}</span>
        </div>
        <div class="vg-video-prompt" title="Enhanced prompt">💬 ${(enhancedPrompt || userPrompt || '').slice(0, 130)}${(enhancedPrompt || '').length > 130 ? '...' : ''}</div>
        <div class="vg-video-actions">
          <a href="${url}" download="galaoum-video-${Date.now()}.mp4" class="vg-dl-btn">⬇ تحميل MP4</a>
          <button onclick="VideoGenerator.retryLast()" class="vg-regen-btn">🔄 إعادة التوليد</button>
          <button onclick="VideoGenerator.openHistory()" class="vg-history-btn">📚 السجل</button>
        </div>
      </div>`);

    _state.lastVideoUrl  = url;
    _state.lastPrompt    = userPrompt;
    _state.lastEnhanced  = enhancedPrompt;

    History.save({
      mode: _state.mode, prompt: userPrompt, url, provider: provName,
      style: styleLabel, duration: _state.duration,
    });
  }

  async function _fallbackAnimated(userPrompt, engPrompt, styleMeta) {
    const frames = 6;
    const imgs   = Array.from({ length: frames }, (_, i) =>
      `https://image.pollinations.ai/prompt/${encodeURIComponent(engPrompt + ', frame ' + (i + 1))}&width=640&height=360&nologo=true&seed=${Date.now() + i}`);

    let idx = 0;
    if (_state._fallbackIv) clearInterval(_state._fallbackIv);

    _showResult(`
      <div class="vg-fallback-note">
        🌸 معاينة بديلة (لقطات) — لا يوجد مفتاح فيديو صالح حالياً.<br>
        أضف HF_TOKEN أو FAL_KEY من إعدادات المفاتيح للحصول على فيديو MP4 حقيقي.
      </div>
      <div class="vg-slide-wrap">
        ${imgs.map((s, i) => `<img src="${s}" class="vg-fb-frame ${i === 0 ? 'vg-fb-active' : ''}" id="vgf${i}">`).join('')}
        <div class="vg-fb-counter"><span id="vgfc">1</span>/${frames}</div>
      </div>
      <div class="vg-video-actions">
        <button onclick="VideoGenerator.generate()" class="vg-regen-btn">🔄 جرّب مجدداً</button>
        <button onclick="VideoGenerator.openHistory()" class="vg-history-btn">📚 السجل</button>
      </div>`);

    _state._fallbackIv = setInterval(() => {
      document.getElementById(`vgf${idx}`)?.classList.remove('vg-fb-active');
      idx = (idx + 1) % frames;
      document.getElementById(`vgf${idx}`)?.classList.add('vg-fb-active');
      const c = document.getElementById('vgfc');
      if (c) c.textContent = idx + 1;
    }, 1300);

    _setStatus('✅ معاينة جاهزة', 100);
  }

  /* ════════════════════════════════════════════
     مساعدات الحالة
     ════════════════════════════════════════════ */
  function _etaStr(elapsed, totalEst) {
    const rem = Math.max(0, totalEst - elapsed);
    return rem > 60 ? Math.ceil(rem / 60) + 'د' : rem + 'ث';
  }

  function _setStatus(msg, pct, eta) {
    const el = document.getElementById('vg-status');
    const pb = document.getElementById('vg-progress-bar');
    if (el) el.innerHTML = msg + (eta ? ` <span class="vg-eta">~ ${eta}</span>` : '');
    if (pb) { pb.style.width = pct + '%'; pb.style.opacity = pct > 0 ? '1' : '0'; }
    const cancelBtn = document.getElementById('vg-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = _state.generating ? 'inline-flex' : 'none';
    // وضع المحادثة: أرسل التحديث للـ chat bubble
    if (_chatCb && _chatCb.onProgress) _chatCb.onProgress(msg, pct || 0, eta || '');
  }

  function _showResult(html) {
    const el = document.getElementById('vg-result-area');
    if (el) el.innerHTML = html;
    // وضع المحادثة: أرسل النتيجة النهائية للـ chat bubble
    if (_chatCb && _chatCb.onResult) _chatCb.onResult(html);
  }

  /* ════════════════════════════════════════════
     فتح / إغلاق اللوحة
     ════════════════════════════════════════════ */
  function openPanel() {
    const p = document.getElementById('video-gen-panel');
    if (p) p.style.display = 'flex';
    History.load();
    _renderUI();
  }

  function closePanel() {
    const p = document.getElementById('video-gen-panel');
    if (p) p.style.display = 'none';
  }

  /* ════════════════════════════════════════════
     رسم الواجهة
     ════════════════════════════════════════════ */
  function _renderUI() {
    // تبويبات
    ['t2v', 'i2v', 'v2v', 'multi', 'history'].forEach(m => {
      const el = document.getElementById('vg-tab-' + m);
      if (el) el.classList.toggle('vg-tab-on', _state.mode === m);
    });

    // أقسام
    ['t2v', 'i2v', 'v2v', 'multi', 'history'].forEach(m => {
      const el = document.getElementById('vg-section-' + m);
      if (el) el.style.display = _state.mode === m ? 'block' : 'none';
    });

    // نماذج HF
    const modelEl = document.getElementById('vg-model-list');
    if (modelEl) {
      modelEl.innerHTML = HF_MODELS.map(m => `
        <button onclick="VideoGenerator._pick('model','${m.id}')" class="vg-chip ${_state.model === m.id ? 'vg-chip-on' : ''}">
          ${m.name}<small style="opacity:.6;display:block;font-size:10px">${m.note}</small>
        </button>`).join('');
    }

    // الأساليب — لجميع الأقسام
    ['vg-style-list', 'vg-style-list-i2v', 'vg-style-list-v2v', 'vg-style-list-multi'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = STYLES.map(s => `
        <button onclick="VideoGenerator._pick('style','${s.id}')" class="vg-chip ${_state.style === s.id ? 'vg-chip-on' : ''}">
          ${s.label}
        </button>`).join('');
    });

    // جودة
    const qEl = document.getElementById('vg-quality-list');
    if (qEl) {
      qEl.innerHTML = QUALITY_PRESETS.map(q => `
        <button onclick="VideoGenerator._pick('quality','${q.id}')" class="vg-chip ${_state.quality === q.id ? 'vg-chip-on' : ''}">
          ${q.label}<small style="opacity:.6;display:block;font-size:10px">${q.note}</small>
        </button>`).join('');
    }

    // مدة
    const dEl = document.getElementById('vg-duration-list');
    if (dEl) {
      dEl.innerHTML = DURATIONS.map(d => `
        <button onclick="VideoGenerator._pick('duration','${d.id}')" class="vg-chip ${_state.duration === d.id ? 'vg-chip-on' : ''}">
          ${d.label}
        </button>`).join('');
    }

    // عدد المشاهد
    const scEl = document.getElementById('vg-scene-count-val');
    if (scEl) scEl.textContent = _state.sceneCount;

    // hint المزودين
    const hint = document.getElementById('vg-token-hint');
    if (hint) {
      const ps = _providersFor(_state.mode);
      hint.innerHTML = '<b style="color:#bf5af2">📡 المزودون:</b> ' + ps.map(p => `<span>${p.label}</span>`).join(' <span style="color:#475569">→</span> ');
    }

    // تحديث نص زر التوليد
    const btn = document.getElementById('vg-generate-btn');
    if (btn && _state.mode !== 'history') {
      const lbls = { t2v: '🎬 توليد فيديو', i2v: '🖼️ تحريك الصورة', v2v: '🔄 تحويل الفيديو', multi: '🎭 توليد المشاهد' };
      btn.textContent = lbls[_state.mode] || '🎬 توليد';
      btn.disabled    = _state.generating;
      btn.style.display = _state.mode === 'history' ? 'none' : '';
    }

    // checkbox الـ autoEnhance
    const aeEl = document.getElementById('vg-auto-enhance');
    if (aeEl) aeEl.checked = _state.autoEnhance;

    // سجل الفيديوهات
    if (_state.mode === 'history') _renderHistory();
  }

  function _renderHistory() {
    const el = document.getElementById('vg-history-grid');
    if (!el) return;
    if (!_state.history.length) {
      el.innerHTML = '<div class="vg-hist-empty">📭 لا توجد فيديوهات محفوظة بعد.<br>ابدأ بتوليد فيديو!</div>';
      return;
    }
    const modeLabel = { t2v: 'نص→فيديو', i2v: 'صورة→فيديو', v2v: 'فيديو→فيديو', multi: 'متعدد المشاهد' };
    el.innerHTML = _state.history.map(h => `
      <div class="vg-hist-item">
        <div class="vg-hist-thumb">
          ${h.url && h.url.startsWith('http') ? `<video src="${h.url}" muted preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>` : `<div class="vg-hist-no-thumb">🎬</div>`}
        </div>
        <div class="vg-hist-info">
          <div class="vg-hist-prompt" title="${h.prompt || ''}">${(h.prompt || '').slice(0, 55)}${(h.prompt || '').length > 55 ? '...' : ''}</div>
          <div class="vg-hist-meta">
            ${h.mode ? `<span class="vg-hist-badge">${modeLabel[h.mode] || h.mode}</span>` : ''}
            ${h.provider ? `<span style="color:#475569;font-size:10px">${h.provider}</span>` : ''}
          </div>
          <div style="font-size:10px;color:#334155;margin-top:2px">${h.date || ''}</div>
        </div>
        <div class="vg-hist-actions">
          ${h.url ? `<a href="${h.url}" download="galaoum-${h.id}.mp4" class="vg-hist-btn" title="تحميل">⬇</a>` : ''}
          <button onclick="VideoGenerator._replayHistory(${h.id})" class="vg-hist-btn" title="إعادة التوليد">🔄</button>
          <button onclick="VideoGenerator._deleteHistory(${h.id})" class="vg-hist-btn vg-hist-del" title="حذف">🗑</button>
        </div>
      </div>`).join('');
  }

  function _pick(key, val) {
    if (key === 'autoEnhance') { _state.autoEnhance = !!val; return; }
    if (key === 'sceneCount')  { _state.sceneCount  = +val;  }
    else                         _state[key] = val;
    _renderUI();
  }

  /* ════════════════════════════════════════════
     ① التوليد الرئيسي — نص → فيديو
     ════════════════════════════════════════════ */
  async function generate() {
    if (_state.generating) return;
    if (_state.mode === 'i2v')   return generateImageToVideo();
    if (_state.mode === 'v2v')   return generateVideoToVideo();
    if (_state.mode === 'multi') return generateMultiScene();
    if (_state.mode === 'history') return;

    const promptEl   = document.getElementById('vg-prompt');
    const userPrompt = promptEl?.value?.trim();
    if (!userPrompt) { _setStatus('⚠️ أدخل وصفاً للفيديو أولاً', 0); return; }

    _state.generating = true;
    _state.cancelled  = false;
    if (_state._fallbackIv) clearInterval(_state._fallbackIv);
    _showResult('');
    _renderUI();
    _setStatus('🤖 جارٍ تحسين الـ Prompt بالذكاء الاصطناعي...', 5);

    const styleMeta  = STYLES.find(s => s.id === _state.style);
    let   enhanced   = userPrompt;

    if (_state.autoEnhance) {
      try {
        enhanced = await PromptEnhancer.enhance(userPrompt, 't2v', styleMeta, null);
        _setStatus('✅ Prompt محسَّن — جارٍ اختيار أفضل مزود...', 12);
      } catch {
        enhanced = userPrompt + (styleMeta?.en ? ', ' + styleMeta.en : '') + ', smooth motion, high quality, 4K';
      }
    } else {
      enhanced = userPrompt + (styleMeta?.en ? ', ' + styleMeta.en : '') + ', smooth motion, high quality, 4K';
    }

    const providers = _providersFor('t2v');
    _setStatus(`🔀 جارٍ التوليد عبر: ${providers.map(p => p.label).join(' → ')}`, 15);

    let success = false;

    for (const prov of providers) {
      if (_state.cancelled || success) break;
      try {
        if (prov.id === 'json2video') {
          _setStatus('🎬 JSON2Video — جارٍ إنشاء الفيديو...', 18, '30-90 ثانية');
          const url = await _generateWithJSON2Video(userPrompt, enhanced);
          if (url) {
            _setStatus('🔍 جارٍ التحقق من الفيديو...', 92);
            const valid = await VideoValidator.validate(url);
            _showVideoPlayer(url, userPrompt, { name: '🎬 JSON2Video' }, enhanced, { validInfo: valid });
            _setStatus('✅ الفيديو جاهز! (JSON2Video)', 100);
            success = true;
          }
        }
        else if (prov.id === 'jsonclip') {
          _setStatus('🎞️ JSONClip — جارٍ إنشاء الفيديو...', 18, '30-90 ثانية');
          const url = await _generateWithJSONClip(userPrompt, enhanced, prov);
          if (url) {
            _setStatus('🔍 جارٍ التحقق من الفيديو...', 92);
            const valid = await VideoValidator.validate(url);
            _showVideoPlayer(url, userPrompt, { name: '🎞️ JSONClip' }, enhanced, { validInfo: valid });
            _setStatus('✅ الفيديو جاهز! (JSONClip)', 100);
            success = true;
          }
        }
        else if (prov.id === 'replicate') {
          _setStatus('🔁 Replicate — Wan 2.1...', 18, '2-4 دقائق');
          const url = await _generateWithReplicate(enhanced, prov.key, 't2v');
          if (url) {
            _setStatus('🔍 جارٍ التحقق من الفيديو...', 92);
            const valid = await VideoValidator.validate(url);
            if (valid.ok || url.startsWith('http')) {
              _showVideoPlayer(url, userPrompt, { name: '🔁 Replicate (Wan 2.1)' }, enhanced, { validInfo: valid });
              _setStatus('✅ الفيديو جاهز!', 100);
              success = true;
            }
          }
        }
        else if (prov.id === 'fal') {
          _setStatus('🎨 Fal.ai — جارٍ التوليد...', 18, '1-3 دقائق');
          const result = await _generateWithFal(enhanced, prov.key, 't2v');
          if (result?.url) {
            _setStatus('🔍 جارٍ التحقق من الفيديو...', 92);
            const valid = await VideoValidator.validate(result.url);
            if (valid.ok || result.url.startsWith('http')) {
              _showVideoPlayer(result.url, userPrompt, { name: '🎨 Fal.ai — ' + result.model.split('/').pop() }, enhanced, { validInfo: valid });
              _setStatus('✅ الفيديو جاهز!', 100);
              success = true;
            }
          }
        }
        else if (prov.id === 'hf') {
          const targetModel = HF_MODELS.find(m => m.id === _state.model) || HF_MODELS[0];
          const tryModels   = [targetModel, ...HF_MODELS.filter(m => m.id !== targetModel.id)];
          for (const m of tryModels) {
            if (_state.cancelled) break;
            _setStatus(`⏳ HuggingFace — ${m.name}...`, 22, '2-5 دقائق');
            try {
              const blob = await _generateWithHF(enhanced, m, prov.key);
              if (blob) {
                const url   = URL.createObjectURL(blob);
                const valid = await VideoValidator.validate(url);
                _showVideoPlayer(url, userPrompt, { name: `⚡ HF — ${m.name}` }, enhanced, { validInfo: valid });
                _setStatus('✅ الفيديو جاهز!', 100);
                success = true;
                break;
              }
            } catch (e) {
              _setStatus(`⚠️ HF ${m.name}: ${e.message}`, 30);
              await new Promise(r => setTimeout(r, 1500));
            }
          }
          if (success) break;
        }
        else if (prov.id === 'pollinations') {
          _setStatus('🌸 إنشاء معاينة بديلة...', 50);
          await _fallbackAnimated(userPrompt, enhanced, styleMeta);
          success = true;
        }
      } catch (e) {
        _setStatus(`⚠️ ${prov.label}: ${e.message} — التالي...`, 30);
        await new Promise(r => setTimeout(r, 800));
      }
    }

    if (!success && !_state.cancelled) {
      _setStatus('❌ فشلت جميع المزودين', 0);
      _showResult('<div class="vg-error">❌ تعذّر توليد الفيديو. تحقق من مفاتيح API أو حاول لاحقاً.</div>');
    }
    if (_state.cancelled) _setStatus('🛑 تم إلغاء التوليد', 0);

    _state.generating = false;
    _renderUI();
  }

  /* ════════════════════════════════════════════
     ② صورة → فيديو (Image-to-Video)
     ════════════════════════════════════════════ */
  async function generateImageToVideo() {
    if (_state.generating) return;
    if (!_state.inputImageB64) {
      _setStatus('⚠️ ارفع صورة أولاً من تبويب "صورة→فيديو"', 0);
      _showResult('<div class="vg-error">📷 يرجى رفع صورة من منطقة الرفع أعلاه.</div>');
      return;
    }

    const promptEl   = document.getElementById('vg-i2v-prompt');
    const userPrompt = promptEl?.value?.trim() || 'animate this image with smooth natural motion and gentle camera movement';

    _state.generating = true;
    _state.cancelled  = false;
    if (_state._fallbackIv) clearInterval(_state._fallbackIv);
    _showResult('');
    _renderUI();
    _setStatus('🤖 جارٍ تحسين prompt التحريك...', 5);

    const styleMeta = STYLES.find(s => s.id === _state.style);
    let   enhanced  = userPrompt;
    try { enhanced = await PromptEnhancer.enhance(userPrompt, 'i2v', styleMeta); } catch {}

    const providers = _providersFor('i2v');
    _setStatus(`🖼️ I2V — المزودون: ${providers.map(p => p.label).join(' → ')}`, 15);

    let success = false;

    for (const prov of providers) {
      if (_state.cancelled || success) break;
      try {
        if (prov.id === 'fal') {
          _setStatus('🎨 Fal.ai — تحريك الصورة (Wan I2V)...', 20, '1-3 دقائق');
          const result = await _generateWithFal(enhanced, prov.key, 'i2v', _state.inputImageB64);
          if (result?.url) {
            const valid = await VideoValidator.validate(result.url);
            _showVideoPlayer(result.url, userPrompt, { name: '🖼️ Fal.ai I2V' }, enhanced, { validInfo: valid });
            _setStatus('✅ الفيديو جاهز!', 100);
            success = true;
          }
        }
        else if (prov.id === 'replicate') {
          _setStatus('🔁 Replicate — Stable Video Diffusion...', 20, '1-2 دقيقة');
          const url = await _generateWithReplicate(enhanced, prov.key, 'i2v', _state.inputImageB64);
          if (url) {
            const valid = await VideoValidator.validate(url);
            _showVideoPlayer(url, userPrompt, { name: '🔁 Replicate SVD' }, enhanced, { validInfo: valid });
            _setStatus('✅ الفيديو جاهز!', 100);
            success = true;
          }
        }
        else if (prov.id === 'pollinations') {
          _setStatus('🌸 معاينة: صورة متحركة (بديل I2V)...', 50);
          const imgSrc = 'data:image/jpeg;base64,' + _state.inputImageB64;
          _showResult(`
            <div class="vg-fallback-note">
              🌸 معاينة I2V بديلة — أضف FAL_KEY للحصول على تحريك حقيقي من <a href="https://fal.ai" target="_blank" style="color:#c4b5fd">fal.ai</a>
            </div>
            <div class="vg-i2v-preview-wrap">
              <img src="${imgSrc}" class="vg-i2v-animated-img">
              <div class="vg-i2v-anim-label">📷 الصورة المرفوعة مع تأثير Ken Burns</div>
            </div>
            <div class="vg-video-actions" style="margin-top:10px">
              <button onclick="VideoGenerator.generateImageToVideo()" class="vg-regen-btn">🔄 جرّب مجدداً</button>
            </div>`);
          _setStatus('✅ معاينة جاهزة', 100);
          success = true;
        }
      } catch (e) {
        _setStatus(`⚠️ ${prov.label}: ${e.message}`, 30);
        await new Promise(r => setTimeout(r, 800));
      }
    }

    if (!success && !_state.cancelled) {
      _setStatus('❌ فشل I2V', 0);
      _showResult('<div class="vg-error">❌ فشل تحريك الصورة. تحقق من FAL_KEY أو REPLICATE_API_TOKEN.</div>');
    }
    if (_state.cancelled) _setStatus('🛑 تم الإلغاء', 0);

    _state.generating = false;
    _renderUI();
  }

  /* ════════════════════════════════════════════
     ③ فيديو → فيديو (Video-to-Video)
     ════════════════════════════════════════════ */
  async function generateVideoToVideo() {
    if (_state.generating) return;

    const promptEl   = document.getElementById('vg-v2v-prompt');
    const userPrompt = promptEl?.value?.trim() || 'enhance video quality and apply cinematic grading';

    _state.generating = true;
    _state.cancelled  = false;
    _showResult('');
    _renderUI();

    const falProviders = _getProviders().filter(p => p.id === 'fal');

    if (!falProviders.length) {
      _setStatus('ℹ️ V2V يتطلب FAL_KEY', 0);
      if (_state.inputVideoBlob) {
        const url = URL.createObjectURL(_state.inputVideoBlob);
        _showResult(`
          <div class="vg-fallback-note">
            ⚠️ V2V متاح عبر Fal.ai فقط — أضف FAL_KEY من <a href="https://fal.ai" target="_blank" style="color:#c4b5fd">fal.ai</a><br>
            يُعرض الفيديو الأصلي في الوقت الحالي.
          </div>
          <video src="${url}" controls style="width:100%;border-radius:12px;background:#000;max-height:280px"></video>
          <div class="vg-video-actions" style="margin-top:8px">
            <a href="${url}" download="original-video.mp4" class="vg-dl-btn">⬇ تحميل الأصلي</a>
          </div>`);
      } else {
        _showResult('<div class="vg-error">📹 ارفع فيديو أولاً ثم أضف FAL_KEY لتفعيل V2V.</div>');
      }
      _state.generating = false;
      _renderUI();
      return;
    }

    if (!_state.inputVideoBlob) {
      _setStatus('⚠️ ارفع فيديو أولاً', 0);
      _showResult('<div class="vg-error">📹 يرجى رفع فيديو من منطقة الرفع أعلاه.</div>');
      _state.generating = false;
      _renderUI();
      return;
    }

    _setStatus('🔄 جارٍ تحضير التحويل عبر Fal.ai...', 10);

    try {
      const styleMeta = STYLES.find(s => s.id === _state.style);
      let   enhanced  = userPrompt;
      try { enhanced = await PromptEnhancer.enhance(userPrompt, 'v2v', styleMeta); } catch {}

      _setStatus('🔄 Fal.ai — Video-to-Video...', 20, '2-5 دقائق');
      const result = await _generateWithFal(enhanced, falProviders[0].key, 'v2v');
      if (result?.url) {
        const valid = await VideoValidator.validate(result.url);
        _showVideoPlayer(result.url, userPrompt, { name: '🔄 Fal.ai V2V' }, enhanced, { validInfo: valid });
        _setStatus('✅ الفيديو جاهز!', 100);
      } else {
        throw new Error('لم يُرجع URL');
      }
    } catch (e) {
      _setStatus('❌ فشل V2V: ' + e.message, 0);
      _showResult('<div class="vg-error">❌ فشل تحويل الفيديو: ' + e.message + '<br><small>V2V في مرحلة تطوير مبكرة لدى معظم مزودي الذكاء الاصطناعي.</small></div>');
    }

    _state.generating = false;
    _renderUI();
  }

  /* ════════════════════════════════════════════
     ④ متعدد المشاهد (Multi-Scene)
     ════════════════════════════════════════════ */
  async function generateMultiScene() {
    if (_state.generating) return;

    const storyEl   = document.getElementById('vg-multi-story');
    const storyText = storyEl?.value?.trim();
    if (!storyText) { _setStatus('⚠️ أدخل نص القصة أولاً', 0); return; }

    // wrap entire body in try/finally to always reset generating state
    try { return await _generateMultiSceneCore(storyText); }
    catch (e) { _setStatus('❌ خطأ غير متوقع: ' + e.message, 0); }
    finally   { _state.generating = false; _renderUI(); }
  }

  async function _generateMultiSceneCore(storyText) {

    _state.generating = true;
    _state.cancelled  = false;
    if (_state._fallbackIv) clearInterval(_state._fallbackIv);
    _showResult('');
    _renderUI();

    const sceneCount = _state.sceneCount;
    const styleMeta  = STYLES.find(s => s.id === _state.style);

    // ① تحليل القصة
    _setStatus('📖 جارٍ تحليل القصة بالذكاء الاصطناعي...', 5);
    let parsed;
    try {
      parsed = await SceneParser.parse(storyText, sceneCount);
    } catch (e) {
      _setStatus('❌ فشل تحليل القصة', 0);
      _showResult('<div class="vg-error">❌ ' + e.message + '</div>');
      return;
    }

    // تحقق صارم من البنية
    if (!parsed || !Array.isArray(parsed.scenes) || !parsed.scenes.length) {
      _setStatus('❌ بنية بيانات المشاهد غير صحيحة', 0);
      _showResult('<div class="vg-error">❌ فشل استخراج المشاهد من القصة — حاول مجدداً.</div>');
      return;
    }

    const consistency = parsed.consistency || {};
    const scenes      = parsed.scenes.filter(s => s && (s.description || s.prompt_en));

    // بناء مُدمج الاتساق
    const consParts = [];
    const cs = _state.sceneConsistency;
    if (cs.character  && consistency.character)       consParts.push('Character: ' + consistency.character);
    if (cs.background && consistency.background_style) consParts.push('Setting: '   + consistency.background_style);
    if (cs.lighting   && consistency.lighting)         consParts.push('Lighting: '  + consistency.lighting);
    if (cs.style      && consistency.visual_style)     consParts.push('Style: '     + consistency.visual_style);
    const consPrefix = consParts.join('. ');

    // ② عرض خريطة المشاهد
    _showResult(`
      <div class="vg-scene-map">
        <div class="vg-scene-map-title">🗺️ خريطة المشاهد (${scenes.length} مشاهد)</div>
        ${scenes.map(s => `
          <div class="vg-scene-row" id="vg-scene-row-${s.num}">
            <span class="vg-scene-num-badge">${s.num}</span>
            <span class="vg-scene-title-text">${s.title}</span>
            <span class="vg-scene-status-badge" id="vg-sc-st-${s.num}">⏳</span>
          </div>`).join('')}
      </div>
      <div id="vg-scenes-results" style="margin-top:12px;display:flex;flex-direction:column;gap:12px"></div>`);

    const sceneVideos = [];

    // ③ توليد كل مشهد
    for (let i = 0; i < scenes.length && !_state.cancelled; i++) {
      const scene = scenes[i];
      const pct   = 10 + (i / scenes.length) * 80;

      _setStatus(`🎬 توليد مشهد ${scene.num}/${scenes.length}: ${scene.title}`, pct, `${scenes.length - i} مشاهد متبقية`);

      const rowEl  = document.getElementById(`vg-scene-row-${scene.num}`);
      const stEl   = document.getElementById(`vg-sc-st-${scene.num}`);
      if (rowEl) rowEl.classList.add('vg-scene-active');
      if (stEl)  stEl.textContent = '🔄';

      // بناء الـ prompt مع الاتساق
      const rawPrompt  = scene.prompt_en || scene.description;
      let   sceneEnh   = rawPrompt;
      try {
        sceneEnh = await PromptEnhancer.enhance(
          scene.description,
          'multi',
          styleMeta,
          cs.character || cs.background ? { character: consistency.character, background: consistency.background_style } : null
        );
      } catch {}
      const finalScenePrompt = consPrefix ? consPrefix + '. ' + sceneEnh : sceneEnh;

      // توليد الفيديو
      const providers = _providersFor('t2v');
      let   sceneUrl  = null;
      let   isImage   = false;
      let   provName  = '';

      for (const prov of providers) {
        if (_state.cancelled) break;
        try {
          if (prov.id === 'replicate') {
            sceneUrl = await _generateWithReplicate(finalScenePrompt, prov.key, 't2v');
            if (sceneUrl) { provName = 'Replicate'; break; }
          } else if (prov.id === 'fal') {
            const r = await _generateWithFal(finalScenePrompt, prov.key, 't2v');
            if (r?.url) { sceneUrl = r.url; provName = 'Fal.ai'; break; }
          } else if (prov.id === 'hf') {
            const blob = await _generateWithHF(finalScenePrompt, HF_MODELS[0], prov.key);
            if (blob) { sceneUrl = URL.createObjectURL(blob); provName = 'HuggingFace'; break; }
          } else if (prov.id === 'pollinations') {
            sceneUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalScenePrompt)}&width=640&height=360&nologo=true&seed=${Date.now() + i}`;
            isImage  = true;
            provName = 'Pollinations (بديل)';
            break;
          }
        } catch { continue; }
      }

      if (rowEl) rowEl.classList.remove('vg-scene-active');
      if (stEl)  stEl.textContent = sceneUrl ? '✅' : '❌';
      if (sceneUrl && rowEl) rowEl.classList.add('vg-scene-done');

      if (sceneUrl) {
        sceneVideos.push({ scene, url: sceneUrl, isImage, provName });

        // أضف المشهد للعرض فور توليده
        const resultsEl = document.getElementById('vg-scenes-results');
        if (resultsEl) {
          const div = document.createElement('div');
          div.className = 'vg-scene-result-item';
          div.innerHTML = `
            <div class="vg-scene-result-header">
              <span class="vg-scene-num-badge">${scene.num}</span>
              <span style="font-size:13px;color:#c084fc;font-weight:600">${scene.title}</span>
              <span style="font-size:11px;color:#475569">${provName}</span>
            </div>
            ${isImage
              ? `<img src="${sceneUrl}" style="width:100%;border-radius:10px;max-height:220px;object-fit:cover">`
              : `<video src="${sceneUrl}" controls muted playsinline style="width:100%;border-radius:10px;max-height:220px;background:#000"></video>`}
            <div class="vg-video-actions" style="margin-top:6px">
              <a href="${sceneUrl}" download="scene-${scene.num}.${isImage ? 'jpg' : 'mp4'}" class="vg-dl-btn" style="font-size:12px;padding:5px 14px">⬇ تحميل</a>
            </div>`;
          resultsEl.appendChild(div);
        }
      }
    }

    const total = scenes.length;
    const done  = sceneVideos.length;
    _setStatus(`✅ اكتمل: ${done}/${total} مشهد`, 100);

    // حفظ في السجل
    if (sceneVideos.length) {
      History.save({
        mode:     'multi',
        prompt:   storyText.slice(0, 150),
        url:      sceneVideos[0]?.url || null,
        provider: 'متعدد المزودين',
        style:    styleMeta?.label || 'none',
        scenes:   total,
      });
    }
    // لا تضع _state.generating = false هنا — يتم التعامل معها في finally block
  }

  /* ════════════════════════════════════════════
     إلغاء / إعادة التوليد
     ════════════════════════════════════════════ */
  function cancelGeneration() {
    if (!_state.generating) return;
    _state.cancelled = true;
    _setStatus('🛑 جارٍ الإلغاء...', 0);
  }

  async function retryLast() {
    if (_state.mode !== 'history') {
      const promptEl = document.getElementById('vg-prompt');
      if (promptEl && _state.lastPrompt) promptEl.value = _state.lastPrompt;
    }
    await generate();
  }

  /* ════════════════════════════════════════════
     إدارة السجل
     ════════════════════════════════════════════ */
  function openHistory() {
    _state.mode = 'history';
    History.load();
    _renderUI();
  }

  function _replayHistory(id) {
    const h = _state.history.find(x => x.id === id);
    if (!h) return;
    _state.mode = h.mode || 't2v';
    const promptEl = document.getElementById('vg-prompt');
    if (promptEl && h.prompt) promptEl.value = h.prompt;
    _renderUI();
    generate();
  }

  function _deleteHistory(id) {
    History.remove(id);
    _renderHistory();
  }

  function _clearHistoryUI() {
    if (!confirm('هل تريد حذف جميع الفيديوهات من السجل؟')) return;
    History.clear();
    _renderHistory();
  }

  /* ════════════════════════════════════════════
     رفع الصور والفيديوهات
     ════════════════════════════════════════════ */
  function _handleImageUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { _setStatus('⚠️ الملف ليس صورة', 0); return; }
    const reader = new FileReader();
    reader.onload = e => {
      _state.inputImageB64 = e.target.result.split(',')[1];
      const preview = document.getElementById('vg-i2v-img-preview');
      if (preview) {
        preview.innerHTML = `
          <div style="position:relative;text-align:center">
            <img src="${e.target.result}" style="max-width:100%;max-height:200px;object-fit:contain;border-radius:10px;border:1px solid rgba(191,90,242,.3)">
            <div style="font-size:11px;color:#4ade80;margin-top:6px">✅ ${file.name} (${(file.size / 1024).toFixed(0)} KB)</div>
            <button onclick="VideoGenerator._clearImage()" style="font-size:11px;color:#f87171;background:none;border:none;cursor:pointer;margin-top:4px">✕ إزالة الصورة</button>
          </div>`;
      }
    };
    reader.readAsDataURL(file);
  }

  function _handleVideoUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) { _setStatus('⚠️ الملف ليس فيديو', 0); return; }
    _state.inputVideoBlob = file;
    const url     = URL.createObjectURL(file);
    const preview = document.getElementById('vg-v2v-vid-preview');
    if (preview) {
      preview.innerHTML = `
        <video src="${url}" controls muted playsinline style="width:100%;max-height:180px;border-radius:10px;background:#000"></video>
        <div style="font-size:11px;color:#4ade80;margin-top:6px">✅ ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)</div>`;
    }
  }

  /* ════════════════════════════════════════════
     اختبار المفاتيح (متوافق مع الكود القديم)
     ════════════════════════════════════════════ */
  async function testToken() {
    const providers = _getProviders();
    const lines = providers.map(p => {
      if (p.id === 'pollinations') return '🌸 Pollinations — مجاني دائماً';
      return `✅ ${p.label} — ${p.key.slice(0, 10)}...`;
    });
    alert('المزودون المتاحون:\n' + lines.join('\n'));
  }

  /* ════════════════════════════════════════════
     تهيئة Drag & Drop
     ════════════════════════════════════════════ */
  function _initDragDrop() {
    [['vg-i2v-drop', _handleImageUpload], ['vg-v2v-drop', _handleVideoUpload]].forEach(([id, fn]) => {
      const zone = document.getElementById(id);
      if (!zone) return;
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('vg-drop-over'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('vg-drop-over'));
      zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('vg-drop-over'); fn(e.dataTransfer.files[0]); });
    });
  }

  // عداد المشاهد
  function _sceneAdj(delta) {
    _state.sceneCount = Math.max(2, Math.min(8, _state.sceneCount + delta));
    const el = document.getElementById('vg-scene-count-val');
    if (el) el.textContent = _state.sceneCount;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initDragDrop);
  } else {
    setTimeout(_initDragDrop, 600);
  }

  /* ════════════════════════════════════════════
     الواجهة العامة
     ════════════════════════════════════════════ */
  function _clearImage() {
    _state.inputImageB64 = null;
    const preview = document.getElementById('vg-i2v-img-preview');
    if (preview) preview.innerHTML = '';
    const fileInput = document.getElementById('vg-i2v-file');
    if (fileInput) fileInput.value = '';
  }

  function _updateConsistency() {
    _state.sceneConsistency = {
      character:  !!(document.getElementById('vc-ch')?.checked),
      background: !!(document.getElementById('vc-bg')?.checked),
      lighting:   !!(document.getElementById('vc-lt')?.checked),
      style:      !!(document.getElementById('vc-st')?.checked),
    };
  }

  /* ════════════════════════════════════════════
     توليد من داخل المحادثة مباشرة (Chat API)
     ════════════════════════════════════════════ */
  async function generateFromChat(prompt, onProgress, onResult, opts) {
    if (_state.generating) {
      if (onProgress) onProgress('⚠️ هناك توليد جارٍ بالفعل، انتظر لحظة...', 0, '');
      return;
    }
    opts = opts || {};
    _chatCb = { onProgress, onResult };
    _state.mode        = opts.mode || 't2v';
    _state.autoEnhance = true;
    _state.cancelled   = false;
    if (opts.sceneCount) _state.sceneCount = opts.sceneCount;

    // حقن الـ prompt في حقل الـ T2V
    const promptEl = document.getElementById('vg-prompt');
    if (promptEl) promptEl.value = prompt;
    // حقن الـ prompt في حقل الـ Multi-Scene أيضاً
    const storyEl = document.getElementById('vg-multi-story');
    if (storyEl) storyEl.value = prompt;

    try {
      if (_state.mode === 'multi') {
        await generateMultiScene();   // تقرأ من #vg-multi-story
      } else {
        await generate();             // تقرأ من #vg-prompt
      }
    } catch (e) {
      if (onResult) onResult(`<div style="color:#f87171;padding:12px">❌ فشل التوليد: ${e.message}</div>`);
    } finally {
      _chatCb = null;
    }
  }

  return {
    openPanel,
    closePanel,
    generate,
    generateFromChat,
    generateImageToVideo,
    generateVideoToVideo,
    generateMultiScene,
    cancelGeneration,
    retryLast,
    openHistory,
    testToken,
    _pick,
    _sceneAdj,
    _clearImage,
    _updateConsistency,
    _switchMode: m => { _state.mode = m; _renderUI(); },
    _handleImageUpload,
    _handleVideoUpload,
    _replayHistory,
    _deleteHistory,
    _clearHistoryUI,
  };

})();
