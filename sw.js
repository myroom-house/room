// 오프라인에서도 열리게 해주는 서비스 워커 (웹 버전 전용)
const VERSION = 'myroom-v32';
const CORE = ["./", "index.html", "styles.css", "i18n.js", "manifest.webmanifest", "fonts/fonts.css", "fonts/fonts-manifest.js", "vendor/html-to-image.js", "icons/icon-192.png", "icons/apple-touch-icon.png", "icons/favicon.png", "js/assets.js", "js/bookmark.js", "js/calendar.js", "js/core.js", "js/custom.js", "js/dday.js", "js/diary.js", "js/excerpt.js", "js/export.js", "js/focus.js", "js/home.js", "js/homedeco.js", "js/stickers.js", "js/memo.js", "js/music.js", "js/settings.js", "js/store.js", "js/tasks.js", "js/social.js", "js/account.js", "vendor/supabase.js", "config.js", "vendor/591.supabase.js"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.filter((f) => f).map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // 서버(Supabase) 요청은 건드리지 않음
  // 화면·스크립트·스타일은 항상 새 버전 먼저 확인 (바뀐 게 없으면 서버가 짧게 대답해서 빨라요). 인터넷이 없으면 저장본
  const fresh = req.mode === 'navigate' || /\.(html|js|css|json|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (fresh) {
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
    return;
  }
  // 글꼴·이미지는 저장본 먼저
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return r;
  })));
});
