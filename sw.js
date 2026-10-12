/* Service worker : le jeu marche hors ligne une fois ouvert une première fois.
   Page du jeu : réseau d'abord (une nouvelle version publiée s'affiche dès le lancement suivant),
   avec repli sur le cache hors ligne ou si le réseau traîne plus de 3 s.
   Autres fichiers du jeu : servis depuis le cache tout de suite, mis à jour en arrière-plan.
   Polices Google : mises en cache au premier chargement, puis servies depuis le cache. */
const CACHE = 'mbc-v2';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'];
const FONTS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (FONTS.includes(url.origin)) {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
    return;
  }

  if (url.origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(caches.open(CACHE).then(c => {
      const net = fetch(req, { cache: 'no-cache' }).then(res => {
        if (res.ok) c.put('./', res.clone());
        return res;
      });
      const late = new Promise(r => setTimeout(r, 3000)).then(() => c.match('./'));
      return Promise.race([net.catch(() => c.match('./')), late.then(hit => hit || net)])
        .then(res => res || net);
    }));
    return;
  }

  e.respondWith(caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) c.put(req, res.clone());
      return res;
    });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net.catch(() => Response.error());
  })));
});
