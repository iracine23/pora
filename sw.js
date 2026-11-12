// Pora — ouverture sans réseau. La page vient du réseau quand il y en a, du cache sinon.
const C = 'pora-v1';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', 'site.webmanifest', 'icon-192.png', 'favicon.svg'])).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url), same = u.origin === location.origin;
  if (u.pathname.includes('/api/')) return;
  if (r.mode === 'navigate' || (same && /(\/|index\.html)$/.test(u.pathname))) {
    e.respondWith((async () => {
      const c = await caches.open(C);
      try {
        const net = await Promise.race([fetch(r), new Promise((_, no) => setTimeout(no, 4500))]);
        if (net && net.ok) c.put('./', net.clone());
        return net;
      } catch (err) { return (await c.match('./')) || fetch(r); }
    })());
    return;
  }
  if (same || /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)$/.test(u.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(C), hit = await c.match(r);
      const net = fetch(r).then(x => { if (x && (x.ok || x.type === 'opaque')) c.put(r, x.clone()); return x; }).catch(() => hit);
      return hit || net;
    })());
  }
});
