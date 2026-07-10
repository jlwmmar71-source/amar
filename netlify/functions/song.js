/* ══════════════════════════════════════════════
   netlify/functions/song.js — توليد أغاني حقيقية (صوت غناء + لحن)
   Galaoum AI Engine v5.0

   يستخدم ElevenLabs Music API لإنتاج أغنية حقيقية (غناء بشري مُصطنع + موسيقى)
   من وصف نصي، بدل التركيب الإلكتروني القديم.

   🔐 يتطلب: ELEVENLABS_API_KEY على Netlify
   اضبطه من: Netlify Dashboard → Site settings → Environment variables
   احصل على مفتاح من: https://elevenlabs.io (يوجد خطة مجانية محدودة + خطط مدفوعة) */

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const { prompt, durationSeconds, instrumental } = JSON.parse(event.body || '{}');
    if (!prompt?.trim())
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'وصف الأغنية مطلوب' }) };

    if (!ELEVEN_KEY)
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'ELEVENLABS_API_KEY غير مضبوط على Netlify. أضِفه من Site settings → Environment variables'
        })
      };

    // مدة الأغنية بالميلي ثانية — بين 10 و120 ثانية لتفادي انتهاء وقت الدالة (10-26 ثانية على Netlify المجاني)
    const musicLengthMs = Math.min(Math.max((durationSeconds || 20) * 1000, 10000), 120000);

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 25000);

    const res = await fetch('https://api.elevenlabs.io/v1/music', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'xi-api-key': ELEVEN_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: instrumental ? `${prompt} (instrumental only, no vocals)` : prompt,
        music_length_ms: musicLengthMs
      })
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`ElevenLabs API error (${res.status}): ${errText.slice(0, 300)}`);
    }

    const contentType = res.headers.get('content-type') || 'audio/mpeg';
    const arrBuf = await res.arrayBuffer();
    const base64 = Buffer.from(arrBuf).toString('base64');

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64: base64, mime: contentType })
    };
  } catch (error) {
    const msg = error.name === 'AbortError'
      ? 'استغرق توليد الأغنية وقتاً طويلاً — جرّب مدة أقصر'
      : error.message;
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: msg }) };
  }
};
