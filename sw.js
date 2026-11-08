// 오프라인에서도 열리게 해주는 서비스 워커 (웹 버전 전용)
const VERSION = 'myroom-v11';
const CORE = ["./", "index.html", "styles.css", "i18n.js", "manifest.webmanifest", "fonts/fonts.css", "fonts/fonts-manifest.js", "vendor/html-to-image.js", "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon.png", "js/assets.js", "js/bookmark.js", "js/calendar.js", "js/core.js", "js/custom.js", "js/dday.js", "js/diary.js", "js/excerpt.js", "js/export.js", "js/focus.js", "js/home.js", "js/memo.js", "js/music.js", "js/settings.js", "js/store.js", "js/tasks.js", "js/social.js", "js/account.js", "vendor/supabase.js", "config.js", "vendor/591.supabase.js"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.filter((f) => f))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // 서버(Supabase) 요청은 건드리지 않음
  // 화면(html)은 새 버전 먼저, 안 되면 저장본
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))));
    return;
  }
  // 나머지(글꼴·스크립트·이미지)는 저장본 먼저
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return r;
  })));
});
