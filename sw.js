/**
 * OrdiveX â€” Service Worker
 * Cache-first PWA strategy pour fonctionnement 100% offline
 */

const CACHE_NAME = 'pharma-cache-v9.10.18';
// Lot 5 hardening (F13) : dérivé de CACHE_NAME plutôt qu'une constante
// séparée, pour ne pas ajouter un 3e endroit à synchroniser manuellement à
// chaque version (déjà CACHE_NAME + index.html ?v= + version.json).
const SW_ASSET_VERSION = CACHE_NAME.slice('pharma-cache-v'.length);
// Seuls les .js/.css sont réellement requêtés avec ?v=... à l'exécution
// (voir les <script>/<link> d'index.html) — les autres types (html, json,
// png...) sont requêtés sans query string, on les laisse tels quels.
function _versionedAssetUrl(path) {
  return /\.(js|css)$/.test(path) ? (path + '?v=' + SW_ASSET_VERSION) : path;
}
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/mobile.css',
  './js/db.js',
  './js/auth.js',
  './js/ui.js',
  './js/sms.js',
  './js/mobile-money.js',
  './js/pages/dashboard.js',
  './js/pages/onboarding.js',
  './js/pages/metrics.js',
  './js/pages/pos.js',
  './js/pages/stock.js',
  './js/pages/products.js',
  './js/pages/sales.js',
  './js/pages/returns.js',
  './js/pages/settings.js',
  './js/pages/prescriptions.js',
  './js/pages/suppliers.js',
  './js/pages/patients.js',
  './js/pages/claims.js',
  './js/pages/invoices.js',
  './js/pages/insurances.js',
  './js/pages/hr.js',
  './js/pages/stock-exits.js',
  './js/pages/inventory.js',
  './js/pages/diagnostic.js',
  './js/pages/caisse.js',
  './js/pages/traceability.js',
  './js/pages/alerts-engine.js',
  './js/pages/alerts.js',
  './js/pages/print.js',
  './js/ui/command-palette.js',
  './js/ui/feedback.js',
  './js/utils/animations.js',
  './js/utils/devtools-guard.js',
  './js/utils/action-guard.js',
  './js/utils/security-lock.js',
  './js/utils/queue.js',
  './js/components/supportWidget.js',
  './js/pages/shifts.js',
  './js/vendor/lucide.min.js',
  './js/vendor/supabase.min.js',
  './js/vendor/jspdf.umd.min.js',
  './js/vendor/jspdf.plugin.autotable.min.js',
  './js/utils/pdf-export.js',
];



// Install: cache all assets individually to avoid global failure
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      console.log('[SW] Caching app shell individually...');
      for (const url of ASSETS) {
        try {
          // Lot 5 hardening (F13) : pré-cacher sous la MÊME URL (avec ?v=...
          // pour les .js/.css) que celle que le navigateur demandera
          // réellement à l'exécution — voir _versionedAssetUrl ci-dessus.
          // Avant, le pré-cache utilisait l'URL nue tandis que le runtime
          // demandait l'URL versionnée : deux clés différentes pour le même
          // fichier, et la clé nue traînait sans jamais être servie ni
          // invalidée par un simple bump de ?v=.
          const request = new Request(_versionedAssetUrl(url), { cache: 'reload' });
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response);
          } else {
            console.warn(`[SW] Failed to cache ${url}: ${response.status} ${response.statusText}`);
          }
        } catch (err) {
          console.warn(`[SW] Skip caching ${url} due to error:`, err);
        }
      }
    }).then(() => {
      console.log('[SW] App shell cached. Skipping waiting.');
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => {
      console.log('[SW] Activated â€” Old caches cleared');
      return self.clients.claim();
    })
  );
});

// Shared offline state between SW and page
// Page posts a message { type: 'OFFLINE_STATE', offline: true/false } to SW
let _swConfirmedOffline = false;

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'OFFLINE_STATE') {
    _swConfirmedOffline = event.data.offline;
  }
  // Fiabilisation post-hardening (Lot 9) : permet à la page de connaître la
  // version RÉELLEMENT active du Service Worker (celle qui sert vraiment les
  // requêtes en ce moment) plutôt que de supposer qu'elle correspond à
  // window.APP_VERSION — les deux peuvent diverger transitoirement pendant
  // une mise à jour. Répond via le MessagePort fourni par la page
  // (event.ports[0]) — pas de broadcast, une seule réponse ciblée.
  if (event.data && event.data.type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ type: 'VERSION_INFO', cacheName: CACHE_NAME, swAssetVersion: SW_ASSET_VERSION });
  }
});

// Fetch: cache-first strategy
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // ── REQUÊTES DE PROBE RÉSEAU ──
  // Intercepter les probes et capturer l'erreur réseau physique
  // pour éviter tout message d'erreur rouge dans la console de la page principale.
  if (url.includes('_probe=')) {
    event.respondWith(
      fetch(event.request)
        .then(response => response)
        .catch(err => {
          // Capturer l'échec réseau physique de façon silencieuse pour la page
          return new Response('offline', { status: 503 });
        })
    );
    return;
  }

  // ── REQUÊTES SUPABASE (API + Realtime + Auth) ──
  // Intercepter et capturer toutes les erreurs réseau physiques de Supabase
  // pour renvoyer une réponse propre de statut 503, masquant le rouge en console.
  if (url.includes('supabase.co') || url.includes('supabase.io')) {
    event.respondWith(
      fetch(event.request)
        .then(response => response)
        .catch(err => {
          return new Response(
            JSON.stringify({ error: 'network_offline', message: 'Réseau hors ligne' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // ── version.json : TOUJOURS réseau, JAMAIS de cache ──
  // Sert de vérité de référence au vérificateur de mise à jour (stability.js).
  // Le cache-first des assets locaux ci-dessous ignorerait le cache-buster
  // (?_=timestamp) et figerait ce fichier indéfiniment dans le cache du SW,
  // rendant la détection de nouvelle version obsolète.
  if (url.includes('version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => new Response('{}', {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Requêtes non-GET et extensions navigateur : ne pas toucher
  if (event.request.method !== 'GET') return;
  if (url.startsWith('chrome-extension')) return;

  // Requêtes externes non-Supabase (fonts, CDN) : laisser passer
  if (!url.startsWith(self.location.origin)) return;

  // ── ASSETS LOCAUX : cache-first ──
  // Lot 5 hardening (F13) : la clé de cache est désormais la requête telle
  // quelle, query string incluse. Avant, elle était retirée pour éviter un
  // double-cache entre "./js/db.js" (pré-cache install, sans version) et
  // "./js/db.js?v=X" (requête réelle, avec version) — mais ça figeait alors
  // indéfiniment le contenu SERVI à chaque nouvelle version : le
  // cache-buster applicatif (?v=) était neutralisé par ce retrait. Fixé à la
  // racine plutôt qu'en surface : le pré-cache d'installation utilise
  // désormais LA MÊME URL versionnée que celle réellement requêtée (voir
  // _versionedAssetUrl au-dessus de ASSETS) — plus besoin de normaliser, la
  // clé coïncide déjà, et change automatiquement à chaque version (qui
  // provoque de toute façon un nouveau CACHE_NAME et donc un cache
  // entièrement neuf, donc pas de doublon résiduel au-delà d'un seul cycle
  // de version).
  const cacheKey = event.request;

  event.respondWith(
    caches.match(cacheKey).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(cacheKey, clone));
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match(new Request(self.location.origin + '/index.html'))
            .then(r => r || new Response('Offline', { status: 503 }));
        }
        return new Response('', { status: 200 });
      });
    })
  );
});

// Background sync for pending operations
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(syncPendingOperations());
  }
});

async function syncPendingOperations() {
  console.log('[SW] Background sync triggered');
  // In production: send pending queue to server
}

// Push notifications for alerts
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'OrdiveX', {
      body: data.body || 'Nouvelle alerte',
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%231B4F72'/%3E%3Ctext y='68' font-size='60' text-anchor='middle' x='50'%3EðŸ’Š%3C/text%3E%3C/svg%3E",
      data: { url: data.url || '/' },
      tag: data.tag || 'pharma-alert',
      requireInteraction: data.critical || false,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});

// (message listener moved to fetch section above)

