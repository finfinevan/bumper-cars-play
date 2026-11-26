// 「加到主畫面」用的 Service Worker：讓遊戲沒網路也能開（對戰電腦、教學；連線對戰仍需網路）。
// 遊戲頁：先上網拿最新版（4 秒拿不到就用上次存的），所以改版不用改這支也會更新。
// 外部函式庫與字型（網址帶版本、不會變）：有存就直接用，沒有才下載並存起來。
const CACHE = 'bumper-cars-v1';
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const THREE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
const PAGE = new URL('./', self.location).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']);
    try { await c.put(THREE, await fetch(THREE, { mode: 'no-cors' })); } catch (err) {}
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// 頁面把第一次載入時用到的外部檔案（字型等）告訴這裡，補存起來
self.addEventListener('message', e => {
  const urls = (e.data && e.data.cache) || [];
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(urls.filter(u => CDN.test(u)).map(async u => {
    if (await c.match(u)) return;
    try { await c.put(u, await fetch(u, { mode: 'no-cors' })); } catch (err) {}
  }))));
});

async function pageFirst(req) {
  const c = await caches.open(CACHE);
  const net = fetch(req).then(r => { if (r.ok) c.put(PAGE, r.clone()); return r; });
  net.catch(() => {});
  const late = new Promise(res => setTimeout(res, 4000));
  try {
    const r = await Promise.race([net, late]);
    if (r) return r;
  } catch (err) {}
  return (await c.match(PAGE)) || net; // 沒網路／太慢：用存著的版本（連 ?room= 邀請連結也能開）
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, { ignoreVary: true });
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') c.put(req, r.clone());
  return r;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && url.origin === self.location.origin) return e.respondWith(pageFirst(req));
  if (url.origin === self.location.origin || CDN.test(req.url)) return e.respondWith(cacheFirst(req));
});
