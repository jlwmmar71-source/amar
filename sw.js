/* ══════════════════════════════════════════════
   sw.js — Service Worker | PWA Galaoum AI v6.0
   by عمار جلعوم
   ══════════════════════════════════════════════ */

const CACHE_NAME    = 'galaoum-v6-cache';
const CACHE_TIMEOUT = 3000; /* ms */

/* الأصول الأساسية — محدودة ومضمونة الوجود فقط */
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

/* ─── تثبيت: تخزين الأصول الأساسية فقط — كل واحدة مستقلة ─── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      /* تخزين كل أصل بشكل مستقل لتجنب فشل عملية addAll كاملاً */
      const results = await Promise.allSettled(
        CORE_ASSETS.map(url =>
          Promise.race([
            cache.add(new Request(url, { cache: 'reload' })),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), CACHE_TIMEOUT))
          ]).catch(() => null /* تجاهل فشل أصول بعينها */)
        )
      );
      const cached = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
      console.log('[PWA] تم تخزين', cached, 'من', CORE_ASSETS.length, 'أصل');
    }).then(() => self.skipWaiting())
  );
});

/* ─── تفعيل: حذف الكاش القديم ─── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ─── الاعتراض: Network First مع fallback للكاش ─── */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  /* لا تتدخل في: API calls, netlify functions, CDN, non-GET */
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/.netlify/')) return;
  if (url.hostname !== self.location.hostname) return; /* CDNs وغيرها */

  event.respondWith(
    /* Network first */
    fetch(event.request.clone())
      .then(response => {
        if (response.ok && response.status < 400) {
          /* خزّن نسخة ناجحة */
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, response.clone()))
            .catch(() => {});
        }
        return response;
      })
      .catch(() =>
        /* Offline fallback */
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          /* صفحة offline افتراضية */
          if (event.request.mode === 'navigate') {
            return new Response(
              `<!DOCTYPE html><html lang="ar" dir="rtl"><head>
              <meta charset="UTF-8"><title>Galaoum AI — غير متصل</title>
              <style>body{background:#030008;color:#e2e8f0;font-family:system-ui;
                display:flex;flex-direction:column;align-items:center;justify-content:center;
                min-height:100vh;gap:16px;text-align:center;padding:20px}
                h2{color:#a78bfa}p{color:#64748b;max-width:400px;line-height:1.7}
                button{background:#7c3aed;color:#fff;border:none;padding:10px 24px;
                border-radius:10px;cursor:pointer;font-size:15px;margin-top:8px}</style>
              </head><body>
              <div style="font-size:48px">🤖</div>
              <h2>Galaoum AI Engine v6.0</h2>
              <p>أنت غير متصل بالإنترنت حالياً.<br>يرجى التحقق من الاتصال وإعادة المحاولة.</p>
              <button onclick="location.reload()">🔄 إعادة المحاولة</button>
              </body></html>`,
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          }
          return new Response('', { status: 503 });
        })
      )
  );
});

/* ─── رسائل من الصفحة ─── */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() =>
      event.source?.postMessage({ type: 'CACHE_CLEARED' })
    );
  }
});
