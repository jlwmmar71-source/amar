/* ══════════════════════════════════════════════
   netlify/functions/song-replicate.js — توليد أغاني حقيقية عبر ACE-Step
   Galaoum AI Engine v5.0

   ACE-Step (lucataco/ace-step على Replicate) ينتج أغنية كاملة
   بصوت غناء حقيقي + لحن وموسيقى من الكلمات ووصف الأسلوب.

   🔐 يتطلب: REPLICATE_API_TOKEN على Netlify
   اضبطه من: Netlify Dashboard → Site settings → Environment variables
   احصل على مفتاح من: https://replicate.com/account/api-tokens */

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN || '';
const MODEL_VERSION = '280fc4f9ee507577f880a167f639c02622421d8fecf492454320311217b688f1'; // lucataco/ace-step

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function pollPrediction(id, maxWaitMs) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Token ${REPLICATE_TOKEN}` }
    });
    const data = await res.json();
    if (data.status === 'succeeded') return data.output;
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(data.error || 'فشل توليد الأغنية على Replicate');
    }
  }
  throw new Error('استغرق التوليد وقتاً طويلاً — جرّب مدة أقصر');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const { lyrics, tags, durationSeconds } = JSON.parse(event.body || '{}');
    if (!lyrics?.trim() && !tags?.trim())
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'الكلمات أو الوصف مطلوب' }) };

    if (!REPLICATE_TOKEN)
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'REPLICATE_API_TOKEN غير مضبوط على Netlify. أضِفه من Site settings → Environment variables'
        })
      };

    const duration = Math.min(Math.max(durationSeconds || 30, 10), 120);

    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
        Prefer: 'wait=1'
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          lyrics: lyrics || '[instrumental]',
          tags: tags || 'pop, upbeat, modern production',
          duration
        }
      })
    });

    let prediction = await startRes.json();
    if (prediction.error) throw new Error(prediction.error);

    let output = prediction.output;
    if (prediction.status !== 'succeeded') {
      output = await pollPrediction(prediction.id, 90000);
    }

    const audioUrl = Array.isArray(output) ? output[0] : output;
    if (!audioUrl) throw new Error('لم يتم إرجاع ملف صوتي من النموذج');

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl })
    };
  } catch (error) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message }) };
  }
};
