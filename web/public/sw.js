/**
 * Xizmat ishchisi (service worker).
 *
 * Maqsad — ilovani o'rnatsa bo'ladigan qilish va internet uzilganda
 * oq ekran chiqmasligi. Ortiqcha narsa qilmaydi:
 *
 *   /api/   — hech qachon keshlanmaydi. Ballar va ro'yxatlar doim yangi.
 *   assets/ — nomida hash bor, demak o'zgarmaydi: keshdan olinaveradi.
 *   qolgani — avval tarmoq, ulanmasa kesh.
 */

const VERSION = 'eco-v1';
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(['/', '/index.html'])).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API va fayllar — faqat tarmoqdan
  if (url.pathname.startsWith('/api/')) return;

  // Hashli fayllar — keshdan
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Sahifalar — avval tarmoq, ulanmasa oxirgi nusxa
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && request.mode === 'navigate') {
          const copy = res.clone();
          caches.open(SHELL).then((cache) => cache.put('/index.html', copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then((hit) => hit || caches.match('/index.html')),
      ),
  );
});
