/**
 * OrdiveX — Database Engine
 * IndexedDB offline-first storage layer
 * Handles all local data persistence with sync queue
 */

// ═══════════════════════════════════════════════════════════════════
// PRODUCTION ERROR SILENCER — DOIT ÊTRE TOUT EN HAUT pour intercepter
// les erreurs dès le chargement des scripts (avant supabase.min.js)
// ═══════════════════════════════════════════════════════════════════
(function () {
  var _origError = console.error;
  var _origWarn = console.warn;
  var _patterns = [
    'ERR_INTERNET', 'Failed to fetch', 'NetworkError', 'net::ERR_',
    'refresh_token', 'WebSocket connection', 'AuthRetryable',
    'was not released within', 'Lock "lock:sb-', 'Forcefully acquiring',
    'Failed to load resource', 'FetchEvent', 'Failed to convert',
    'Failed to decode downloaded font', 'AuthSessionMissing',
    'Auth session missing', 'signInAnonymously', 'Unauthorized',
    '401 (Unauthorized)', '400 (Bad Request)', 'Bad Request',
    'CORS', 'AbortError', 'TypeError: Load failed',
    'The user aborted a request', 'CHANNEL_ERROR',
    'AudioContext', 'Realtime send()', 'InvalidStateError',
    'beforeinstallpromptevent', 'IDBRequest'
  ];
  function _isNoise(args) {
    var s = Array.prototype.join.call(args, ' ');
    for (var i = 0; i < _patterns.length; i++) {
      if (s.indexOf(_patterns[i]) !== -1) return true;
    }
    return false;
  }
  console.error = function () { if (!_isNoise(arguments)) _origError.apply(console, arguments); };
  console.warn = function () { if (!_isNoise(arguments)) _origWarn.apply(console, arguments); };

  // ── FILET DE SÉCURITÉ GLOBAL — empêche les Uncaught de crasher l'app ──
  window.addEventListener('error', function (e) {
    var msg = (e.message || '') + ' ' + (e.filename || '');
    if (_isNoise([msg])) { e.preventDefault(); return; }
  });
  window.addEventListener('unhandledrejection', function (e) {
    var msg = String(e.reason?.message || e.reason || '');
    if (_isNoise([msg])) { e.preventDefault(); return; }
  });
})();

// ═══════════════════════════════════════════════════════════════════
// FETCH INTERCEPTOR — Bloque les requêtes Supabase quand offline
// Empêche les "Failed to load resource: net::ERR_INTERNET_DISCONNECTED"
// qui sont des logs Chrome impossibles à supprimer autrement
// ═══════════════════════════════════════════════════════════════════
(function () {
  var _origFetch = window.fetch;
  window.fetch = function (url, opts) {
    // Vérifier l'état OFFLINE via NM (source de vérité unique)
    var nmOffline = window.NM && typeof window.NM.isOnline === 'function' ? !window.NM.isOnline() : false;
    var osOffline = !navigator.onLine;
    var isOffline = osOffline || nmOffline;
    var urlStr = (typeof url === 'string') ? url : (url && url.url ? url.url : '');
    var isSupabase = urlStr.indexOf('supabase') !== -1 || urlStr.indexOf('gohfpvvmxsoujpnbmtcl') !== -1;

    // Bloquer immédiatement si offline et requête Supabase non-critique
    // Double vérification : NM.isOnline() OU navigator.onLine === false
    // Cela attrape aussi le cas où le réseau tombe PENDANT un état SYNCING
    // (ex: Supabase auth refresh_token qui échoue avec ERR_NETWORK_IO_SUSPENDED)
    var hardOffline = !navigator.onLine;
    if ((isOffline || hardOffline) && isSupabase && !(opts && opts._bypassOfflineGuard)) {
      window._lastSupabaseFetchFailedTime = Date.now();
      // Si le NM ne sait pas encore qu'on est offline, le notifier
      if (hardOffline && !isOffline && window.NM && typeof window.NM.handleFetchFailure === 'function') {
        window.NM.handleFetchFailure(new Error('navigator.onLine is false'));
      }
      return Promise.resolve(new Response(JSON.stringify({ data: null, error: { message: 'offline' } }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }

    return _origFetch.apply(this, arguments).then(function (res) {
      if (isSupabase && window.NM) {
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          if (typeof window.NM.handleFetchSuccess === 'function') {
            window.NM.handleFetchSuccess();
          }
        } else {
          window._lastSupabaseFetchFailedTime = Date.now();
          // Si res.ok est false et que ce n'est pas une erreur client (donc 5xx ou autre),
          // c'est une déconnexion serveur/réseau logique. On le signale au NetworkManager.
          if (typeof window.NM.handleFetchFailure === 'function') {
            window.NM.handleFetchFailure(new Error('Erreur HTTP ' + res.status), res.status);
          }
        }
      }
      return res;
    }).catch(function (err) {
      if (isSupabase) {
        window._lastSupabaseFetchFailedTime = Date.now();
      }
      if (isSupabase && window.NM && typeof window.NM.handleFetchFailure === 'function') {
        // Laisser le NM classifier l'erreur (réseau vs. serveur vs. auth)
        window.NM.handleFetchFailure(err, null);
      }
      throw err;
    });
  };
})();

// ═══════════════════════════════════════════════════════════════════
// WEBSOCKET INTERCEPTOR — Bloque les tentatives de reconnexion realtime
// de Supabase en cas de hors-ligne pour éviter les erreurs rouges dans la console.
// ═══════════════════════════════════════════════════════════════════
(function () {
  var _origWebSocket = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    var nmOffline = window.NM && typeof window.NM.isOnline === 'function' ? !window.NM.isOnline() : false;
    var osOffline = !navigator.onLine;
    var fetchFailedRecently = (Date.now() - (window._lastSupabaseFetchFailedTime || 0)) < 10000;
    var isOffline = osOffline || nmOffline || fetchFailedRecently;
    var urlStr = typeof url === 'string' ? url : '';
    
    if (isOffline && (urlStr.indexOf('supabase') !== -1 || urlStr.indexOf('gohfpvvmxsoujpnbmtcl') !== -1)) {
      throw new Error('WebSocket blocked: network offline');
    }
    
    // Si protocols est passé, l'appliquer correctement (le constructeur natif est strict)
    if (protocols) {
      return new _origWebSocket(url, protocols);
    }
    return new _origWebSocket(url);
  };
  window.WebSocket.prototype = _origWebSocket.prototype;
})();


const DB_NAME = 'OrdiveXDB';
const DB_VERSION = 8;

const STORES = {
  products: 'products',
  lots: 'lots',
  stock: 'stock',
  movements: 'movements',
  suppliers: 'suppliers',
  purchaseOrders: 'purchaseOrders',
  sales: 'sales',
  saleItems: 'saleItems',
  prescriptions: 'prescriptions',
  patients: 'patients',
  users: 'users',
  sessions: 'sessions',
  alerts: 'alerts',
  syncQueue: 'syncQueue',
  auditLog: 'auditLog',
  settings: 'settings',
  cashRegister: 'cashRegister',
  returns: 'returns',
  invoices: 'invoices',
  shifts: 'shifts',
  inventories: 'inventories',
  inventoryAdjustments: 'inventoryAdjustments',
  insurances: 'insurances',
  insurancePayments: 'insurancePayments',
  prep_transfers: 'prep_transfers',
};

let db = null;
let _supabaseInstance = null;

// App state manager
// Device Identity — ID unique déterministe basé sur l'empreinte du navigateur
// L'ID reste le MÊME pour le même appareil/navigateur, même si localStorage est vidé
function _generateStableDeviceId() {
  var fingerprint = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
    navigator.hardwareConcurrency || 0
  ].join('|');
  // Simple hash FNV-1a
  var hash = 0x811c9dc5;
  for (var i = 0; i < fingerprint.length; i++) {
    hash ^= fingerprint.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return 'DEV_' + hash.toString(36).toUpperCase();
}

// ── Générateur d'ID résistant aux collisions inter-appareils ET inter-onglets ──
// (Lot 1, étendu Lot 4 hardening — F10, F11)
//
// Les stores IndexedDB utilisent un compteur autoIncrement LOCAL à chaque
// appareil (voir createObjectStore plus bas). Deux appareils différents
// peuvent donc générer le même id pour deux enregistrements différents ;
// comme la synchro pousse via upsert(onConflict:'id'), l'un écrase
// silencieusement l'autre côté serveur (cause racine confirmée sur les
// factures — audit "AUDIT PRIORITAIRE" v9.9.x, ids dupliqués/manquants
// constatés en production). id = timestamp_ms * 1000 + empreinte_appareil
// (0-999). Reste un BIGINT compatible avec les colonnes existantes (pas de
// migration de schéma), et ne collisionne jamais avec les anciens id
// séquentiels (bien plus petits) — les enregistrements historiques restent
// intacts. Vérifié : 1.79e12(2026)*1000 ≈ 1.79e15, bien sous
// Number.MAX_SAFE_INTEGER (9.007e15) et sous la limite BIGINT Postgres
// (9.2e18) — marge valable jusqu'à l'an ~2255.
//
// Horloge système incorrecte (F11) : une horloge remise à l'epoch Unix
// (pile CMOS morte — panne réelle et documentée sur du matériel de bureau
// vieillissant) ferait remonter Date.now() près de 1970, produisant un id
// proche des anciens id séquentiels historiques — collision réintroduite.
// ID_EPOCH_FLOOR ancre le calcul à une date fixe post-déploiement : même
// une horloge à zéro ne peut plus produire un id dans la zone historique.
// Une horloge dans le FUTUR reste inoffensive (id juste "en avance", jamais
// de collision) — limitation documentée, pas un risque de collision.
const ID_EPOCH_FLOOR = 1735689600000; // 2025-01-01T00:00:00Z

// Multi-onglets (F10) : le compteur anti-collision était une variable de
// module — donc propre à CHAQUE ONGLET. Deux onglets du même appareil
// partagent pourtant la même empreinte (même navigator.userAgent, même
// écran, etc.) : deux ventes créées dans la même milliseconde sur 2 onglets
// du même poste pouvaient collisionner sans qu'aucun des deux ne le sache.
// Le compteur est donc désormais partagé via localStorage (synchrone,
// commun à tous les onglets de la même origine), protégé par la Web Locks
// API quand disponible pour une exclusion mutuelle réelle entre onglets.
//
// "Ne stocke jamais une information critique uniquement dans localStorage
// si sa perte peut compromettre l'unicité" : localStorage n'est ici QUE
// pour la coordination MULTI-ONGLETS — la protection contre l'auto-
// collision reste portée par _memLastSyncSafeId (variable de module,
// jamais perdue en cours de session) et par ID_EPOCH_FLOOR. Si localStorage
// est vidé, corrompu ou totalement indisponible (mode privé strict, quota),
// _safeLocalStorageGet/_safeLocalStorageSet échouent silencieusement sans
// jamais lever d'exception : le générateur continue de fonctionner et de
// garantir l'unicité PAR ONGLET (le seul mécanisme qui redevient
// indisponible est la coordination ENTRE onglets — dégradation gracieuse,
// jamais un crash, documenté explicitement ici plutôt que supposé).
const _ID_STORAGE_KEY = 'pharma_last_sync_id';
const _ID_LOCK_NAME = 'ordivex_id_gen';
var _memLastSyncSafeId = 0;
var _sessionFallbackDeviceId = null; // si ni AppState.deviceId ni localStorage ne sont disponibles

function _safeLocalStorageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function _safeLocalStorageSet(key, val) {
  try { localStorage.setItem(key, val); } catch (e) { /* best effort — quota plein, mode prive, etc. */ }
}
function _deviceIdSuffixForId() {
  var devId = (typeof AppState !== 'undefined' && AppState.deviceId) || _safeLocalStorageGet('pharma_device_id');
  if (!devId) {
    // Dernier repli : identifiant aléatoire figé pour la durée de l'onglet.
    // Ne dégrade QUE la disambiguïsation entre appareils dans ce cas extrême
    // (ni AppState ni localStorage disponibles) — l'unicité par onglet reste
    // garantie par _memLastSyncSafeId quel que soit ce repli.
    if (!_sessionFallbackDeviceId) _sessionFallbackDeviceId = 'NOLS_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    devId = _sessionFallbackDeviceId;
  }
  var h = 0;
  for (var i = 0; i < devId.length; i++) { h = (h * 31 + devId.charCodeAt(i)) >>> 0; }
  return h % 1000;
}

function _computeNextSyncSafeId() {
  var ts = Math.max(Date.now(), ID_EPOCH_FLOOR);
  var base = ts * 1000 + _deviceIdSuffixForId();
  var lastRaw = _safeLocalStorageGet(_ID_STORAGE_KEY);
  var lastLS = lastRaw ? parseInt(lastRaw, 10) : 0;
  if (!Number.isFinite(lastLS) || lastLS < 0) lastLS = 0; // valeur corrompue -> ignorée, jamais une exception
  var last = Math.max(lastLS, _memLastSyncSafeId);
  var id = base <= last ? last + 1 : base;
  _memLastSyncSafeId = id; // toujours à jour, même si localStorage échoue juste après
  _safeLocalStorageSet(_ID_STORAGE_KEY, String(id));
  return id;
}

// Asynchrone : Web Locks (navigator.locks.request) n'a pas d'équivalent
// synchrone — c'est une contrainte de la plateforme, pas un choix. Chaque
// site d'appel se trouve déjà dans une fonction async (immédiatement suivi
// d'un `await DB.dbAdd/dbPut/dbTransactionBulk`), donc `await
// DB._generateSyncSafeId()` s'intègre sans changement d'architecture.
async function _generateSyncSafeId() {
  if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
    try {
      return await navigator.locks.request(_ID_LOCK_NAME, function () { return _computeNextSyncSafeId(); });
    } catch (e) {
      // Verrou refusé/indisponible (rare) : repli direct. L'unicité par
      // onglet reste garantie (_memLastSyncSafeId) ; seule l'exclusion
      // mutuelle STRICTE entre onglets pour la même milliseconde exacte
      // redevient "best effort" via le partage localStorage seul.
      return _computeNextSyncSafeId();
    }
  }
  // Navigateur sans Web Locks API (ancien / non-Chromium) : le partage par
  // localStorage reste actif, seule l'atomicité stricte n'est plus garantie
  // — fenêtre de course résiduelle documentée ci-dessus, pas un crash.
  return _computeNextSyncSafeId();
}

// ── Classification centralisée des erreurs IndexedDB (Lot 2 hardening — F28) ──
// dbAdd/dbPut/dbDelete résolvent silencieusement en `null` sur toute erreur
// IndexedDB (voir req.onerror/tx.onerror plus bas) : un DOMException
// QuotaExceededError n'était jusqu'ici pas distingué d'un autre échec, donc
// jamais signalé à l'utilisateur malgré un mécanisme de toast déjà écrit
// (js/utils/stability.js) mais qui ne peut jamais se déclencher puisqu'il
// attend un rejet de promesse qui ne survient jamais sur ce chemin.
const _KNOWN_IDB_ERRORS = ['QuotaExceededError', 'InvalidStateError', 'NotFoundError', 'ConstraintError', 'VersionError', 'AbortError'];
function _classifyIDBError(err) {
  const name = err && err.name;
  return _KNOWN_IDB_ERRORS.includes(name) ? name : 'UnknownError';
}
// Dernière erreur IndexedDB classifiée, tenue à jour pour le futur module
// Diagnostic (Lot 6) — pas de dépendance inverse, juste un point de lecture.
let _lastIDBError = null;
function _reportIDBError(storeName, operation, err) {
  const type = _classifyIDBError(err);
  _lastIDBError = { type, store: storeName, operation, message: err && err.message, timestamp: Date.now() };
  console.error(`[DB] ${operation} ${storeName} — ${type}${err && err.message ? ': ' + err.message : ''}`);
  if (type === 'QuotaExceededError' && typeof window !== 'undefined' && window.UI && typeof window.UI.toast === 'function') {
    // Un seul toast à la fois : évite le spam si plusieurs écritures échouent en rafale (ex. import CSV).
    if (!_reportIDBError._quotaToastAt || (Date.now() - _reportIDBError._quotaToastAt) > 15000) {
      _reportIDBError._quotaToastAt = Date.now();
      window.UI.toast(
        'Stockage local presque plein — cette opération n\'a pas pu être enregistrée. Libérez de l\'espace ou contactez votre administrateur.',
        'error', 10000
      );
    }
  }
  return type;
}

// ── Bannière de blocage IndexedDB (Lot 2 hardening — F29) ──
// Autonome vis-à-vis de UI.js : initDB() s'exécute avant que ui.js soit
// chargé/exécuté (voir ordre des <script> dans index.html), on ne peut donc
// pas dépendre de UI.toast() à ce stade du démarrage.
function _showIDBBlockedBanner(timedOut) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('idb-blocked-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'idb-blocked-banner';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#B3261E;color:#fff;padding:14px 20px;font:14px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    document.body?.appendChild(el);
  }
  el.innerHTML = timedOut
    ? '⚠ OrdiveX attend toujours la fermeture d\'un autre onglet. Fermez tous les autres onglets/fenêtres OrdiveX ouverts sur cet appareil. '
      + '<button onclick="location.reload()" style="margin-left:10px;background:#fff;color:#B3261E;border:none;padding:4px 12px;border-radius:6px;cursor:pointer;font-weight:600">Recharger</button>'
    : '⚠ OrdiveX attend la fermeture d\'un autre onglet pour terminer une mise à jour. Fermez les autres onglets OrdiveX ouverts sur cet appareil.';
}
function _hideIDBBlockedBanner() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('idb-blocked-banner');
  if (el) el.remove();
}

var _stableId = _generateStableDeviceId();
// Forcer la migration vers l'ID stable — supprimer l'ancien aléatoire
var _oldDeviceId = localStorage.getItem('pharma_device_id');
if (_oldDeviceId && _oldDeviceId !== _stableId) {
  // Ancien ID aléatoire détecté — on le remplace et on nettoie
  localStorage.setItem('pharma_device_id', _stableId);
  // Supprimer l'ancienne entrée de Supabase au prochain sync
  localStorage.setItem('pharma_old_device_key', 'device_status_' + _oldDeviceId);
} else if (!_oldDeviceId) {
  localStorage.setItem('pharma_device_id', _stableId);
}
if (!localStorage.getItem('pharma_device_name')) {
  var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
  localStorage.setItem('pharma_device_name', isMobile ? 'Mobile Pharmacien' : 'PC Principal');
}

const AppState = {
  currentUser: null,
  currentPage: 'dashboard',
  theme: 'light',
  pendingSyncCount: 0,
  deviceId: localStorage.getItem('pharma_device_id'),
  deviceName: localStorage.getItem('pharma_device_name'),
};
Object.defineProperty(AppState, 'isOnline', {
  get() { return window.NM && typeof window.NM.isOnline === 'function' ? window.NM.isOnline() : navigator.onLine; },
  set(val) {}
});
Object.defineProperty(AppState, '_confirmedOffline', {
  get() { return window.NM && window.NM.state ? (window.NM.state === 'OFFLINE' || window.NM.state === 'RETRYING') : false; },
  set(val) {}
});

let _realtimeSubscription = null;
let _realtimeTimeout = null;
let _broadcastChannel = null;
let _broadcastPullTimer = null;

// ── Connexion Resilience Engine ──
let _connectivityDebounceTimer = null;
let _lastConnState = navigator.onLine;
let _reconnectAttempts = 0;
const _MAX_RECONNECT_DELAY = 60000; // 60s max
let _realtimeCooldown = false;
let _lastLogMessages = {};

// Empêche les logs répétitifs (même message dans les 30 dernières secondes)
function _logOnce(level, msg) {
  const now = Date.now();
  if (_lastLogMessages[msg] && (now - _lastLogMessages[msg]) < 30000) return;
  _lastLogMessages[msg] = now;
  if (level === 'warn') console.warn(msg);
  else console.log(msg);
}

// Calcul du délai de backoff exponentiel
function _getBackoffDelay() {
  const base = 5000; // 5 secondes
  const delay = Math.min(base * Math.pow(2, _reconnectAttempts), _MAX_RECONNECT_DELAY);
  return delay;
}

// ═══════════════════════════════════════════════════════════════════
// LIVE UI REFRESH ENGINE — Synchronisation visuelle temps réel
// Rafraîchit automatiquement la page affichée quand un changement
// arrive d'un autre appareil via Supabase Realtime ou Pull.
// ═══════════════════════════════════════════════════════════════════
let _uiRefreshTimer = null;
let _pendingUIStores = new Set();
const _recentlySyncedIds = new Map();

function _markAsSynced(storeName, id) {
  if (id == null) return;
  _recentlySyncedIds.set(`${storeName}:${id}`, Date.now());
}

function _wasRecentlySynced(storeName, id) {
  if (id == null) return false;
  const key = `${storeName}:${id}`;
  const ts = _recentlySyncedIds.get(key);
  if (!ts) return false;
  if (Date.now() - ts > 10000) { _recentlySyncedIds.delete(key); return false; }
  return true;
}

// Nettoyage périodique du cache anti-écho
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of _recentlySyncedIds) {
    if (now - ts > 15000) _recentlySyncedIds.delete(key);
  }
}, 30000);

// Nettoyage périodique des tombstones de suppression déjà confirmées côté
// Supabase (> 24h) — évite que syncQueue grossisse indéfiniment.
setInterval(async () => {
  try {
    const queue = await dbGetAll('syncQueue');
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const t of queue) {
      if (t && t.type === 'delete' && t.status === 'synced' && (t.syncedAt || 0) < cutoff) {
        await dbDelete('syncQueue', t.id);
      }
    }
  } catch (e) { /* silencieux */ }
}, 60 * 60 * 1000);

const _pageStoreMap = {
  dashboard: ['sales', 'saleItems', 'stock', 'products', 'alerts', 'movements', 'returns'],
  pos: ['products', 'stock', 'lots'],  // Soft refresh POS (sans toucher le panier)
  products: ['products'],
  stock: ['stock', 'products', 'lots'],
  sales: ['sales', 'saleItems'],
  patients: ['patients'],
  prescriptions: ['prescriptions'],
  suppliers: ['suppliers'],
  alerts: ['alerts'],
  caisse: ['cashRegister', 'sales'],
  traceability: ['movements', 'lots', 'products'],
  returns: ['returns', 'sales'],
  settings: ['users'],
  metrics: ['sales', 'saleItems', 'products', 'stock'],
};

function _notifyUIChange(storeName) {
  _pendingUIStores.add(storeName);
  if (_uiRefreshTimer) clearTimeout(_uiRefreshTimer);
  const currentPage = window.Router?.currentPage;
  const delay = (currentPage === 'pos' || currentPage === 'stock') ? 50 : 300;
  _uiRefreshTimer = setTimeout(() => {
    _uiRefreshTimer = null;
    const stores = new Set(_pendingUIStores);
    _pendingUIStores.clear();
    try {
      if (window._invalidateDashCache) window._invalidateDashCache();
      const page = window.Router?.currentPage;
      if (!page || page === 'login' || page === 'onboarding') return;

      // Invalider le cache POS dès qu'un store pertinent change,
      // même si on n'est PAS sur la page POS actuellement.
      // Cela force un rechargement complet quand l'utilisateur y retourne.
      const stockRelated = stores.has('stock') || stores.has('products') || stores.has('lots');
      if (stockRelated && typeof window._posDataTime !== 'undefined') {
        window._posDataTime = 0;
      }

      // Soft refresh spécial pour le POS : ne pas toucher au panier/session
      if (page === 'pos') {
        const posStores = _pageStoreMap['pos'] || ['stock', 'products', 'lots'];
        if (posStores.some(s => stores.has(s)) || stockRelated) {
          _softRefreshPOS();
        }
        return;
      }
      const relevantStores = _pageStoreMap[page] || [];
      const hasRelevantChange = relevantStores.some(s => stores.has(s));
      if (hasRelevantChange) {
        _silentRefreshPage(page, [...stores]);
      }
    } catch (e) { /* silencieux */ }
  }, delay);
}

// Rafraîchissement silencieux : aucun flash visible pour l'utilisateur
function _silentRefreshPage(page, storeNames) {
  try {
    const container = document.getElementById('app-content');
    if (!container || !window.Router?.routes?.[page]) return;
    
    // Si c'est la page stock, on ne rafraîchit que les données et le tableau pour éviter de perdre le focus/scroll
    if (page === 'stock' && typeof window._softRefreshStock === 'function') {
      window._softRefreshStock();
      return;
    }
    
    // Empêcher le scroll reset et le flash pour les autres pages
    const scrollY = container.scrollTop || 0;
    const scrollX = container.scrollLeft || 0;
    // Verrouiller la hauteur du container pendant le render
    container.style.minHeight = container.offsetHeight + 'px';
    // Render dans le DOM existant (Router.render écrase innerHTML)
    window.Router.render(page);
    // Restaurer le scroll
    requestAnimationFrame(() => {
      container.scrollTop = scrollY;
      container.scrollLeft = scrollX;
      container.style.minHeight = '';
    });
  } catch (e) { /* silencieux */ }
}

// Rafraîchissement doux du POS : recharge le stock et les produits en fond
// sans jamais toucher au panier, aux sessions ou à l'état de la vente en cours.
async function _softRefreshPOS() {
  try {
    // Ne rien faire si le POS n'est pas visible
    if (window.Router?.currentPage !== 'pos') return;

    // refreshPOSData() dans pos.js re-fetche stock/lots/products
    // depuis IndexedDB, met à jour posStock/posProducts (variables locales
    // à pos.js), puis appelle refreshGrid() + refreshCartUI()
    if (typeof window.refreshPOSData === 'function') {
      await window.refreshPOSData();
    }
    if (typeof window.refreshCartUI === 'function') {
      window.refreshCartUI();
    }
    if (typeof window.refreshTotals === 'function') {
      window.refreshTotals();
    }
  } catch (e) { /* silencieux — ne pas crasher le POS */ }
}

let _lastSessionCheck = 0;
async function getSupabaseClient() {
  // Guard strict : si hors-ligne, retourner l'instance existante sans détruire ni recréer
  // (détruire = forcer une recréation = Multiple GoTrueClient warnings)
  if (!navigator.onLine || AppState._confirmedOffline) {
    if (_supabaseInstance) {
      // Suspendre le refresh token silencieusement sans détruire l'instance
      try { _supabaseInstance.auth?.stopAutoRefresh?.(); } catch (e) { }
    }
    return null;
  }

  if (_supabaseInstance) {
    // Vérifier la session auth max 1x toutes les 5 min (throttle)
    const now = Date.now();
    if (!_lastSessionCheck || (now - _lastSessionCheck > 300000)) {
      _lastSessionCheck = now;
      try {
        const { data: { session } } = await _supabaseInstance.auth.getSession();
        if (!session && _supabaseInstance.auth.signInAnonymously) {
          await _supabaseInstance.auth.signInAnonymously();
        }
      } catch (e) { /* silencieux */ }
    }
    return _supabaseInstance;
  }

  try {
    const settings = await dbGetAll('settings');
    const url = settings.find(s => s.key === 'supabase_url')?.value;
    const key = settings.find(s => s.key === 'supabase_key')?.value;

    if (url && key && window.supabase) {
      _supabaseInstance = window.supabase.createClient(url.trim(), key.trim(), {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
        },
        realtime: {
          params: { eventsPerSecond: 1 },
          heartbeatIntervalMs: 60000,
          reconnectAfterMs: (tries) => Math.min(tries * 5000, 120000),
          timeout: 20000,
        }
      });

      // Auto-Login Anonyme pour satisfaire RLS
      try {
        const { data: { session } } = await _supabaseInstance.auth.getSession();
        if (!session && _supabaseInstance.auth.signInAnonymously) {
          await _supabaseInstance.auth.signInAnonymously();
        }
      } catch (e) { /* silencieux */ }

      // Lancer le broadcast APRÈS 3s — uniquement si connexion active
      setTimeout(() => {
        if (!navigator.onLine || AppState._confirmedOffline) return;
        try { _setupBroadcast(_supabaseInstance); } catch (e) { /* Broadcast optionnel */ }
      }, 3000);
      return _supabaseInstance;
    }
  } catch (e) { /* silencieux */ }
  return null;
}

function _setupRealtime(sbClient) {
  // Gardes strictes : ne pas reconnecter si déjà connecté, hors-ligne, ou en cooldown
  if (_realtimeSubscription || !navigator.onLine || _realtimeCooldown || (window.NM && !window.NM.isOnline())) return;

  // Cooldown de 30s pour éviter les boucles de reconnexion WebSocket sur réseau instable
  _realtimeCooldown = true;
  setTimeout(() => { _realtimeCooldown = false; }, 30000);

  // Mapping table Supabase → store IndexedDB
  const _tableToStore = { app_users: 'users' };
  const _validStores = new Set([
    'users', 'settings', 'products', 'lots', 'stock', 'movements',
    'suppliers', 'purchaseOrders', 'sales', 'saleItems', 'patients',
    'prescriptions', 'alerts', 'cashRegister', 'auditLog', 'returns', 'invoices', 'shifts',
    'prep_transfers'
  ]);

  _realtimeSubscription = sbClient.channel('flash-sync-channel')
    .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
      const tableName = payload.table;
      const storeName = _tableToStore[tableName] || tableName;
      const eventType = payload.eventType;

      if (!_validStores.has(storeName)) return;

      try {
        // Anti-écho : ignorer les changements qu'on a nous-même envoyés
        const _itemId = (payload.new?.id || payload.old?.id || payload.new?.key);
        if (_wasRecentlySynced(storeName, _itemId)) return;

        if (eventType === 'DELETE' && payload.old?.id) {
          // Suppression confirmée côté serveur : appliquer localement en tant
          // qu'opération système (pas de nouvelle tombstone) et lever le
          // verrou anti-résurrection puisque la suppression distante est actée.
          const _prevSysOp = _isSystemOp;
          _isSystemOp = true;
          try { await dbDelete(storeName, payload.old.id); }
          finally { _isSystemOp = _prevSysOp; }
          _clearPendingDelete(storeName, payload.old.id);
          _notifyUIChange(storeName);
        } else if ((eventType === 'INSERT' || eventType === 'UPDATE') && payload.new) {
          const item = { ...payload.new, _synced: true, _updatedAt: Date.now() };

          // Ne jamais ressusciter un enregistrement supprimé localement dont
          // la suppression distante n'est pas encore confirmée.
          const _itemKeyField = storeName === 'settings' ? 'key' : 'id';
          if (_isPendingDelete(storeName, item[_itemKeyField])) return;

          const mustBeString = ['username', 'password', 'code', 'lotNumber', 'phone', 'dnpm',
            'pharmacy_phone', 'pharmacy_dnpm', 'pharmacy_name', 'key', 'value'];
          for (const key of Object.keys(item)) {
            if (mustBeString.includes(key) || (storeName === 'settings' && key === 'value')) {
              if (item[key] !== undefined && item[key] !== null) {
                item[key] = String(item[key]);
              }
            }
          }

          if (storeName === 'settings' && item.status === 'DELETED') {
            await dbDelete(storeName, item.id);
          } else {
            await _dbPutRaw(storeName, item);
            _updateCacheInPlace(storeName, [item]);
          }
          _notifyUIChange(storeName);
        }
      } catch (err) {
        // Silencieux — le pull rattrapera
      }
    })
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        _logOnce('log', '[Flash] Connecté au temps réel Supabase');
        _reconnectAttempts = 0; // Reset le backoff sur succès
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        try { sbClient.removeChannel(_realtimeSubscription).catch(() => { }); } catch (e) { }
        _realtimeSubscription = null;
        // Ne PAS retenter immédiatement — le backoff gère ça
      }
    });
}

// ═══════════════════════════════════════════════════════════════════
// BROADCAST CHANNEL — Notification instantanée entre appareils
// Contrairement à postgres_changes (qui requiert la publication Realtime),
// le Broadcast fonctionne SANS configuration Supabase.
// Flux : Appareil A push → broadcast "j'ai pushé" → Appareil B pull immédiat
// ═══════════════════════════════════════════════════════════════════
function _setupBroadcast(sbClient) {
  if (_broadcastChannel || !navigator.onLine || (window.NM && !window.NM.isOnline())) return;

  try {
    _broadcastChannel = sbClient.channel('ordivex-live-sync', {
      config: { broadcast: { self: false } }
    })
      .on('broadcast', { event: 'sync_push' }, (msg) => {
        var payload = msg.payload || {};

        // Guard : ignorer notre propre appareil (double sécurité)
        if (payload.deviceId === AppState.deviceId) return;

        _logOnce('log', '[LiveSync] \u{1F4E1} Signal de ' + (payload.deviceName || 'appareil') + ' (' + (payload.count || '?') + ' éléments) — pull immédiat...');

        // Debounce : si plusieurs broadcasts arrivent en rafale, un seul pull
        if (_broadcastPullTimer) clearTimeout(_broadcastPullTimer);
        _broadcastPullTimer = setTimeout(async () => {
          _broadcastPullTimer = null;
          if (!navigator.onLine) return;
          try {
            await pullFromSupabase(false);
          } catch (e) { /* silencieux */ }
        }, 300);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          _logOnce('log', '[LiveSync] \u2705 Canal broadcast connecté — sync instantanée active');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          try { sbClient.removeChannel(_broadcastChannel).catch(() => { }); } catch (e) { }
          _broadcastChannel = null;
        }
      });
  } catch (e) {
    _broadcastChannel = null;
  }
}

async function initDB() {
  // --- Magic Link Auto-Config ---
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('reset') === 'true') {
    return new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => {
        localStorage.clear();
        window.location.href = window.location.pathname;
      };
      req.onerror = () => {
        console.error("Failed to delete local DB");
        resolve(); // proceed anyway
      };
    });
  }

  const sbUrl = urlParams.get('sb_url');
  const sbKey = urlParams.get('sb_key');

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // ── Blocage multi-onglets (Lot 2 hardening — F29) ──
    // Se déclenche quand un AUTRE onglet a encore une connexion ouverte sur
    // une version antérieure du schéma pendant qu'on tente une migration
    // (onupgradeneeded) ici. Sans ce gestionnaire, la promesse ne se résout
    // ni ne rejette jamais tant que l'autre onglet n'est pas fermé — écran
    // de chargement figé, sans aucune explication. On ne recharge JAMAIS
    // automatiquement (donnée en cours d'écriture possible dans l'autre
    // onglet) : on informe et on laisse l'utilisateur agir.
    let _blockedTimeoutId = null;
    request.onblocked = () => {
      console.warn('[DB] Ouverture IndexedDB bloquée — un autre onglet OrdiveX a une connexion ouverte sur une version antérieure.');
      _showIDBBlockedBanner(false);
      if (!_blockedTimeoutId) {
        _blockedTimeoutId = setTimeout(() => {
          console.warn('[DB] Blocage IndexedDB toujours actif après 10s.');
          _showIDBBlockedBanner(true);
        }, 10000);
      }
    };

    request.onsuccess = async () => {
      if (_blockedTimeoutId) { clearTimeout(_blockedTimeoutId); _blockedTimeoutId = null; }
      _hideIDBBlockedBanner();
      db = request.result;

      // If URL params are present, update settings automatically
      if (sbUrl && sbKey) {

        try {
          const settings = await dbGetAll('settings');
          const existingUrl = settings.find(s => s.key === 'supabase_url')?.value;

          // Si l'URL Supabase change = nouvelle pharmacie → vider les données locales
          if (existingUrl && existingUrl.trim() !== sbUrl.trim()) {
            console.log('[Flash] Nouvelle pharmacie détectée — nettoyage des données locales...');
            db.close();
            db = null;
            await new Promise((res, rej) => {
              const delReq = indexedDB.deleteDatabase(DB_NAME);
              delReq.onsuccess = () => res();
              delReq.onerror = () => res();
              delReq.onblocked = () => res();
            });
            // Recharger la page pour recréer la DB fraîche avec le nouveau Magic Link
            window.location.reload();
            return;
          }

          const update = async (k, v) => {
            const ex = settings.find(s => s.key === k);
            if (ex) await dbPut('settings', { ...ex, value: v, updatedAt: Date.now() });
            else await dbAdd('settings', { key: k, value: v, updatedAt: Date.now() });
          };
          await update('supabase_url', sbUrl);
          await update('supabase_key', sbKey);

          // Clean URL to hide keys and avoid re-triggering
          window.history.replaceState({}, document.title, window.location.pathname);

          // Forcer un pull complet en supprimant le timestamp du dernier pull
          localStorage.removeItem('pharma_last_pull_ts');

          _supabaseInstance = null; // Force recreation
          await getSupabaseClient();
        } catch (e) {
          console.error('[DB] Magic Link failed:', e);
        }
      }
      try {
        await migrateInsurances();
      } catch (err) {
        console.error('[DB] Migration assurances échouée:', err);
      }
      try {
        await _loadPendingDeletes();
      } catch (err) {
        console.error('[DB] Chargement des tombstones de suppression échoué:', err);
      }
      // Hook onclose : si le SW force la fermeture (cache update), réinitialiser db
      db.onclose = () => {
        console.log('[DB] Connexion IDB fermée (mise à jour SW) — réinitialisation au prochain accès.');
        db = null;
      };
      db.onversionchange = () => {
        db.close();
        db = null;
        console.log('[DB] Nouvelle version IDB détectée — connexion fermée proprement.');
      };
      resolve(db);
    };

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // Products store
      if (!database.objectStoreNames.contains('products')) {
        const ps = database.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('code', 'code', { unique: true });
        ps.createIndex('name', 'name');
        ps.createIndex('dci', 'dci');
        ps.createIndex('category', 'category');
        ps.createIndex('requiresPrescription', 'requiresPrescription');
        ps.createIndex('status', 'status');
      }

      // Lots store
      if (!database.objectStoreNames.contains('lots')) {
        const ls = database.createObjectStore('lots', { keyPath: 'id', autoIncrement: true });
        ls.createIndex('productId', 'productId');
        ls.createIndex('lotNumber', 'lotNumber');
        ls.createIndex('expiryDate', 'expiryDate');
        ls.createIndex('status', 'status');
      }

      // Stock store
      if (!database.objectStoreNames.contains('stock')) {
        const ss = database.createObjectStore('stock', { keyPath: 'id', autoIncrement: true });
        ss.createIndex('productId', 'productId', { unique: true });
        ss.createIndex('quantity', 'quantity');
      }

      // Movements store
      if (!database.objectStoreNames.contains('movements')) {
        const ms = database.createObjectStore('movements', { keyPath: 'id', autoIncrement: true });
        ms.createIndex('productId', 'productId');
        ms.createIndex('type', 'type');
        ms.createIndex('date', 'date');
        ms.createIndex('userId', 'userId');
      }

      // Suppliers store
      if (!database.objectStoreNames.contains('suppliers')) {
        const sus = database.createObjectStore('suppliers', { keyPath: 'id', autoIncrement: true });
        sus.createIndex('name', 'name');
        sus.createIndex('status', 'status');
      }

      // Purchase orders
      if (!database.objectStoreNames.contains('purchaseOrders')) {
        const pos = database.createObjectStore('purchaseOrders', { keyPath: 'id', autoIncrement: true });
        pos.createIndex('supplierId', 'supplierId');
        pos.createIndex('status', 'status');
        pos.createIndex('date', 'date');
      }

      // Sales store
      if (!database.objectStoreNames.contains('sales')) {
        const sal = database.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
        sal.createIndex('date', 'date');
        sal.createIndex('patientId', 'patientId');
        sal.createIndex('userId', 'userId');
        sal.createIndex('paymentMethod', 'paymentMethod');
      }

      // Sale items
      if (!database.objectStoreNames.contains('saleItems')) {
        const si = database.createObjectStore('saleItems', { keyPath: 'id', autoIncrement: true });
        si.createIndex('saleId', 'saleId');
        si.createIndex('productId', 'productId');
        si.createIndex('lotId', 'lotId');
      }

      // Prescriptions
      if (!database.objectStoreNames.contains('prescriptions')) {
        const prx = database.createObjectStore('prescriptions', { keyPath: 'id', autoIncrement: true });
        prx.createIndex('patientId', 'patientId');
        prx.createIndex('date', 'date');
        prx.createIndex('status', 'status');
      }

      // Patients
      if (!database.objectStoreNames.contains('patients')) {
        const pat = database.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
        pat.createIndex('name', 'name');
        pat.createIndex('phone', 'phone');
      }

      // Users
      if (!database.objectStoreNames.contains('users')) {
        const us = database.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        us.createIndex('username', 'username', { unique: true });
        us.createIndex('role', 'role');
      }

      // Sessions
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'id' });
      }

      // Alerts
      if (!database.objectStoreNames.contains('alerts')) {
        const als = database.createObjectStore('alerts', { keyPath: 'id', autoIncrement: true });
        als.createIndex('type', 'type');
        als.createIndex('status', 'status');
        als.createIndex('date', 'date');
      }

      // File de préparation → caisse (transferts de vente entre préparateur et caissier)
      if (!database.objectStoreNames.contains('prep_transfers')) {
        const pt = database.createObjectStore('prep_transfers', { keyPath: 'id', autoIncrement: true });
        pt.createIndex('status', 'status');
        pt.createIndex('createdAt', 'createdAt');
      }

      // Sync queue — cle string generee par OperationQueue
      if (!database.objectStoreNames.contains('syncQueue')) {
        const sq = database.createObjectStore('syncQueue', { keyPath: 'id' });
        sq.createIndex('status', 'status');
        sq.createIndex('createdAt', 'createdAt');
      }

      // Audit log
      if (!database.objectStoreNames.contains('auditLog')) {
        const al = database.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
        al.createIndex('userId', 'userId');
        al.createIndex('action', 'action');
        al.createIndex('timestamp', 'timestamp');
      }

      // Settings
      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }

      // Cash register
      if (!database.objectStoreNames.contains('cashRegister')) {
        const cr = database.createObjectStore('cashRegister', { keyPath: 'id', autoIncrement: true });
        cr.createIndex('date', 'date');
        cr.createIndex('type', 'type');
      }

      // Returns (retours médicaments) — v2
      if (!database.objectStoreNames.contains('returns')) {
        const ret = database.createObjectStore('returns', { keyPath: 'id', autoIncrement: true });
        ret.createIndex('saleId', 'saleId');
        ret.createIndex('date', 'date');
        ret.createIndex('status', 'status');
        ret.createIndex('userId', 'userId');
        ret.createIndex('patientId', 'patientId');
      }

      // Invoices
      if (!database.objectStoreNames.contains('invoices')) {
        const inv = database.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
        inv.createIndex('invoiceNumber', 'invoiceNumber');
        inv.createIndex('supplierId', 'supplierId');
        inv.createIndex('date', 'date');
        inv.createIndex('status', 'status');
      }

      // Shifts — Gestion des équipes Matin/Soir (v9.5.0)
      if (!database.objectStoreNames.contains('shifts')) {
        const sh = database.createObjectStore('shifts', { keyPath: 'id' });
        sh.createIndex('status', 'status');
        sh.createIndex('date', 'date');
        sh.createIndex('managerId', 'managerId');
        sh.createIndex('type', 'type');
      }

      // Inventories — Redesign
      if (!database.objectStoreNames.contains('inventories')) {
        const invStore = database.createObjectStore('inventories', { keyPath: 'id', autoIncrement: true });
        invStore.createIndex('date', 'date');
        invStore.createIndex('userId', 'userId');
      }

      // Inventory Adjustments — Redesign
      if (!database.objectStoreNames.contains('inventoryAdjustments')) {
        const adjStore = database.createObjectStore('inventoryAdjustments', { keyPath: 'id', autoIncrement: true });
        adjStore.createIndex('date', 'date');
        adjStore.createIndex('userId', 'userId');
        adjStore.createIndex('productId', 'productId');
        adjStore.createIndex('inventoryId', 'inventoryId');
      }

      // ── RH v6 ─────────────────────────────────────────────────────
      if (!database.objectStoreNames.contains('employees')) {
        const emp = database.createObjectStore('employees', { keyPath: 'id', autoIncrement: true });
        emp.createIndex('status', 'status');
        emp.createIndex('department', 'department');
      }
      if (!database.objectStoreNames.contains('hr_payroll')) {
        const pay = database.createObjectStore('hr_payroll', { keyPath: 'id', autoIncrement: true });
        pay.createIndex('employeeId', 'employeeId');
        pay.createIndex('period', 'period'); // 'YYYY-MM'
        pay.createIndex('status', 'status');
      }
      if (!database.objectStoreNames.contains('hr_advances')) {
        const adv = database.createObjectStore('hr_advances', { keyPath: 'id', autoIncrement: true });
        adv.createIndex('employeeId', 'employeeId');
        adv.createIndex('status', 'status');
      }
      if (!database.objectStoreNames.contains('hr_leaves')) {
        const lv = database.createObjectStore('hr_leaves', { keyPath: 'id', autoIncrement: true });
        lv.createIndex('employeeId', 'employeeId');
        lv.createIndex('status', 'status');
        lv.createIndex('type', 'type');
      }
      if (!database.objectStoreNames.contains('hr_attendance')) {
        const att = database.createObjectStore('hr_attendance', { keyPath: 'id', autoIncrement: true });
        att.createIndex('employeeId', 'employeeId');
        att.createIndex('date', 'date');
      }
      if (!database.objectStoreNames.contains('insurances')) {
        const ins = database.createObjectStore('insurances', { keyPath: 'id', autoIncrement: true });
        ins.createIndex('name', 'name');
        ins.createIndex('code', 'code', { unique: true });
        ins.createIndex('status', 'status');
      }
      if (!database.objectStoreNames.contains('insurancePayments')) {
        const ip = database.createObjectStore('insurancePayments', { keyPath: 'id', autoIncrement: true });
        ip.createIndex('insuranceId', 'insuranceId');
        ip.createIndex('date', 'date');
      }
    };
  });
}

async function migrateInsurances() {
  if (localStorage.getItem('pharma_insurance_migrated') === 'true') {
    return; // Déjà fait
  }

  const prevSystemOp = _isSystemOp;
  _isSystemOp = true;

  try {
    const insurances = await dbGetAll('insurances');
    if (insurances && insurances.length > 0) {
      localStorage.setItem('pharma_insurance_migrated', 'true');
      return; // Déjà initialisé
    }

    console.log('[DB-Migration] Initialisation de la table des assurances...');
    
    // Extraire les noms uniques des assurances
    const patients = await dbGetAll('patients') || [];
    const sales = await dbGetAll('sales') || [];

    const namesSet = new Set();
    patients.forEach(p => {
      if (p.assurances && Array.isArray(p.assurances)) {
        p.assurances.forEach(a => {
          if (a.name && a.name.trim()) namesSet.add(a.name.trim());
        });
      }
    });

    sales.forEach(s => {
      if (s.assuranceName && s.assuranceName.trim()) {
        namesSet.add(s.assuranceName.trim());
      }
      if (s.insuranceDetails && Array.isArray(s.insuranceDetails)) {
        s.insuranceDetails.forEach(d => {
          if (d.name && d.name.trim()) namesSet.add(d.name.trim());
        });
      }
    });

    const uniqueNames = Array.from(namesSet);
    if (uniqueNames.length === 0) {
      console.log('[DB-Migration] Aucune assurance historique à migrer.');
      localStorage.setItem('pharma_insurance_migrated', 'true');
      return;
    }

    console.log(`[DB-Migration] ${uniqueNames.length} assurances uniques identifiées pour migration.`);

    // Créer les entités d'assurance
    const createdInsurances = [];
    for (const name of uniqueNames) {
      const insuranceId = Date.now() + Math.floor(Math.random() * 100000);
      const newInsurance = {
        id: insuranceId,
        name: name,
        code: name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 100),
        status: 'active',
        coveragePercent: 70, // Par défaut
        paymentMode: 'invoice',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await dbAdd('insurances', newInsurance);
      createdInsurances.push(newInsurance);
      await new Promise(resolve => setTimeout(resolve, 2)); // Éviter les collisions d'ID
    }

    // Mettre à jour les patients pour lier leurs assurances
    for (const p of patients) {
      if (p.assurances && Array.isArray(p.assurances)) {
        let changed = false;
        p.assurances.forEach(a => {
          const matched = createdInsurances.find(ins => ins.name.toLowerCase() === a.name.trim().toLowerCase());
          if (matched) {
            a.insuranceId = matched.id;
            changed = true;
          }
        });
        if (changed) {
          await dbPut('patients', p);
        }
      }
    }

    // Mettre à jour les ventes pour lier les assurances
    for (const s of sales) {
      let changed = false;
      if (s.assuranceName) {
        const matched = createdInsurances.find(ins => ins.name.toLowerCase() === s.assuranceName.trim().toLowerCase());
        if (matched) {
          s.insuranceId = matched.id;
          changed = true;
        }
      }
      if (s.insuranceDetails && Array.isArray(s.insuranceDetails)) {
        s.insuranceDetails.forEach(d => {
          const matched = createdInsurances.find(ins => ins.name.toLowerCase() === d.name.trim().toLowerCase());
          if (matched) {
            d.insuranceId = matched.id;
            changed = true;
          }
        });
      }
      // Initialiser insurancePaidAmount
      if (s.paymentMethod === 'assurance') {
        if (s.insurancePaidAmount === undefined) {
          s.insurancePaidAmount = (s.status === 'paid' || s.status === 'completed') ? (s.assuranceAmount || s.total) : 0;
          changed = true;
        }
      }
      if (changed) {
        await dbPut('sales', s);
      }
    }

    console.log('[DB-Migration] Migration des assurances terminée avec succès. Nombre d\'assurances créées :', createdInsurances.length);
    localStorage.setItem('pharma_insurance_migrated', 'true');
  } catch (err) {
    console.error('[DB-Migration] Erreur fatale durant la migration des assurances:', err);
  } finally {
    _isSystemOp = prevSystemOp;
  }
}


// Sync debounce & guard
let _syncTimer = null;
let _syncInProgress = false;
let _syncNeededAfter = false;
let _restoreInProgress = false;

function _scheduleSyncToSupabase() {
  if (!navigator.onLine || _restoreInProgress || AppState._confirmedOffline) return;
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    _syncTimer = null;
    if (!navigator.onLine || AppState._confirmedOffline) return;
    if (_syncInProgress) {
      _syncNeededAfter = true;
      return;
    }
    syncToSupabase().catch(() => { });
  }, 2000);
}

// Flush de secours en arrière-plan (surtout pour mobile lors de la fermeture/veille de l'écran)
function _flushSyncOnBackground() {
  if (navigator.onLine && !AppState._confirmedOffline) {
    if (_syncTimer) {
      clearTimeout(_syncTimer);
      _syncTimer = null;
      syncToSupabase().catch(() => {});
    }
  }
}
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    _flushSyncOnBackground();
  }
});
window.addEventListener('pagehide', _flushSyncOnBackground);

// Internal put that does NOT reset _synced and does NOT trigger sync
// Used exclusively by syncToSupabase to mark items as synced
function _dbPutRaw(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Generic CRUD operations
// ── Cache mémoire pour accélérer dbGetAll sur les gros stores ──
const _dbCache = new Map();
const _dbCacheTime = new Map(); // Timestamp du dernier cache
// Sur mobile : ne PAS cacher les gros stores (products, movements, lots) pour éviter l'OOM
const _mobileNoCacheStores = new Set(['products', 'movements', 'lots', 'auditLog', 'saleItems']);
function _invalidateCache(storeName) { _dbCache.delete(storeName); _dbCacheTime.delete(storeName); if (window._invalidateDashCache) window._invalidateDashCache(); }

// ── Mise à jour chirurgicale du cache mémoire (sans le vider) ──
// Utilisé par le pull incrémental pour fusionner les nouvelles données
// Le dashboard/POS reste instantané car le cache n'est JAMAIS vidé
function _updateCacheInPlace(storeName, newItems) {
  if (!_dbCache.has(storeName) || !newItems || newItems.length === 0) return;
  const cached = _dbCache.get(storeName);
  const keyField = storeName === 'settings' ? 'key' : 'id';
  // Index pour lookup rapide O(1)
  const idxMap = new Map();
  cached.forEach((item, i) => { if (item[keyField] != null) idxMap.set(item[keyField], i); });
  for (const item of newItems) {
    const k = item[keyField];
    if (k != null && idxMap.has(k)) {
      cached[idxMap.get(k)] = item; // Mise à jour en place
    } else {
      cached.push(item); // Nouvel élément
    }
  }
  _dbCacheTime.set(storeName, Date.now()); // Rafraîchir le TTL
  if (window._invalidateDashCache) window._invalidateDashCache();
}

const _isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const _cacheMaxItems = _isMobile ? 50000 : 500000; // Mobile: 50k (petits stores), PC: 500k
const _cacheTTL = _isMobile ? 120000 : 600000; // Mobile: 2 min, PC: 10 min

// Synchronisation automatique et bidirectionnelle des dates de péremption
async function _syncProductExpiryToLots(productId, expiryDate) {
  if (!productId || !expiryDate) return;
  try {
    if (window._isSyncingExpiry) return;
    window._isSyncingExpiry = true;
    const tx = db.transaction('lots', 'readwrite');
    const store = tx.objectStore('lots');
    const req = store.openCursor();
    req.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const lot = cursor.value;
        if (lot.productId === productId && lot.status === 'active' && lot.expiryDate !== expiryDate) {
          lot.expiryDate = expiryDate;
          lot._updatedAt = Date.now();
          lot._synced = false;
          cursor.update(lot);
        }
        cursor.continue();
      } else {
        window._isSyncingExpiry = false;
      }
    };
    req.onerror = () => { window._isSyncingExpiry = false; };
  } catch (e) {
    window._isSyncingExpiry = false;
    console.warn('[DB] _syncProductExpiryToLots error:', e);
  }
}

// Recalcule products.expiryDate = date du lot actif le plus proche avec quantity > 0
// Appelée apres tout changement de lot (ajout, vente, retour)
function _syncLotExpiryToProduct(productId) {
  if (!productId) return;
  // Eviter les appels recursifs
  if (!window._syncExpiryQueue) window._syncExpiryQueue = new Set();
  if (window._syncExpiryQueue.has(productId)) return;
  window._syncExpiryQueue.add(productId);
  setTimeout(() => {
    window._syncExpiryQueue.delete(productId);
    try {
      // Lire tous les lots actifs avec stock > 0 pour ce produit
      const txL = db.transaction('lots', 'readonly');
      const storeL = txL.objectStore('lots');
      const allDates = [];
      const cursor = storeL.openCursor();
      cursor.onsuccess = (event) => {
        const cur = event.target.result;
        if (cur) {
          const lot = cur.value;
          if (lot.productId === productId && lot.status === 'active' && (lot.quantity || 0) > 0 && lot.expiryDate) {
            allDates.push(lot.expiryDate);
          }
          cur.continue();
        } else {
          // Calculer la date la plus proche parmi les lots actifs
          const closestDate = allDates.length > 0
            ? allDates.sort((a, b) => new Date(a) - new Date(b))[0]
            : null;
          // Mettre a jour products.expiryDate avec cette valeur
          const txP = db.transaction('products', 'readwrite');
          const storeP = txP.objectStore('products');
          const reqP = storeP.get(productId);
          reqP.onsuccess = () => {
            const prod = reqP.result;
            if (prod && prod.expiryDate !== closestDate) {
              prod.expiryDate = closestDate;
              prod._updatedAt = Date.now();
              prod._synced = false;
              storeP.put(prod);
              console.log('[DB] expiryDate produit', productId, '->', closestDate || 'null (aucun stock actif)');
            }
          };
        }
      };
    } catch (e) {
      console.warn('[DB] _syncLotExpiryToProduct error:', e);
    }
  }, 200); // Delai court pour regrouper les appels lors d'une vente multi-articles
}

// ═══════════════════════════════════════════════════════════════════════════════
//  GARDES DE PERMISSIONS — Bloque les écritures non autorisées en IndexedDB
// ═══════════════════════════════════════════════════════════════════════════════
let _isSystemOp = false; // Drapeau pour les opérations système (sync, seed, dedup)

const _DB_WRITE_GUARDS = {
  // store → { add: perm, put: perm, delete: perm }
  // IMPORTANT: les clés DOIVENT correspondre exactement aux clés de Auth.ALL_PERMISSIONS (auth.js)
  // Si la valeur est un tableau, l'utilisateur doit avoir AU MOINS UNE des permissions listées
  products:        { add: 'products_create',      put: 'products_edit',         delete: 'products_delete' },
  lots:            { add: 'stock_adjust',          put: ['stock_adjust', 'pos_sales_create'], delete: 'stock_adjust' },
  stock:           { add: 'stock_adjust',          put: ['stock_adjust', 'pos_sales_create'], delete: 'stock_adjust' },
  sales:           { add: 'pos_sales_create',      put: 'pos_sales_create',      delete: 'pos_sales_create' },
  saleItems:       { add: 'pos_sales_create',      put: 'pos_sales_create',      delete: 'pos_sales_create' },
  purchaseOrders:  { add: 'po_create',             put: 'po_create',             delete: 'po_delete' },
  suppliers:       { add: 'suppliers_create',      put: 'suppliers_edit',        delete: 'suppliers_delete' },
  patients:        { add: 'patients_create',       put: ['patients_edit', 'pos_sales_create'], delete: 'patients_delete' },
  insurances:      { add: 'claims_view',           put: 'claims_view',           delete: 'claims_view' },
  users:           { add: 'settings_users',        put: 'settings_users',        delete: 'settings_users' },
  inventories:     { add: 'inventory_create',      put: 'inventory_edit',        delete: 'inventory_delete' },
};

function _checkWritePermission(storeName, op) {
  if (_isSystemOp) return; // Opérations système autorisées (sync, seed, etc.)
  const guard = _DB_WRITE_GUARDS[storeName];
  if (!guard) return; // Pas de garde sur ce store
  const requiredPerm = guard[op];
  if (!requiredPerm) return;
  // Vérifier si Auth est disponible et si l'utilisateur a la permission
  if (typeof Auth !== 'undefined' && typeof Auth.can === 'function') {
    // Support des permissions alternatives (tableau = OR logic)
    const perms = Array.isArray(requiredPerm) ? requiredPerm : [requiredPerm];
    const hasAny = perms.some(p => Auth.can(p));
    if (!hasAny) {
      const msg = `Cette action nécessite une autorisation que votre profil ne possède pas actuellement.`;
      console.warn(`[DB Guard] Écriture bloquée sur ${storeName} (${op}) — permission requise : ${perms.join(' ou ')}`);
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(msg, 'warning', 3000);
      }
      throw new Error(msg);
    }
  }
}

async function dbAdd(storeName, data) {
  if (!db) await initDB();
  _checkWritePermission(storeName, 'add');
  _invalidateCache(storeName);
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.add({ ...data, _createdAt: Date.now(), _updatedAt: Date.now(), _synced: false });
      req.onsuccess = () => {
        const resultId = req.result;
        resolve(resultId);
        
        // Auto-sync des dates de peremption
        if (storeName === 'products' && data.expiryDate) {
          _syncProductExpiryToLots(resultId || data.id, data.expiryDate);
        } else if (storeName === 'lots' && data.productId) {
          // Recalculer le minimum sur tous les lots actifs de ce produit
          _syncLotExpiryToProduct(data.productId);
        }

        if (window.NM && typeof window.NM.notifyMutation === 'function') {
          window.NM.notifyMutation(storeName);
        } else if (navigator.onLine) {
          _scheduleSyncToSupabase();
        }
        _notifyUIChange(storeName);
      };
      req.onerror = () => { _reportIDBError(storeName, 'add', req.error); resolve(null); };
      tx.onerror = () => { _reportIDBError(storeName, 'add(tx)', tx.error); resolve(null); };
    } catch (e) {
      _reportIDBError(storeName, 'add(exception)', e);
      resolve(null);
    }
  });
}

async function dbPut(storeName, data) {
  if (!db) await initDB();
  _checkWritePermission(storeName, 'put');
  _invalidateCache(storeName);
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put({ ...data, _updatedAt: Date.now(), _synced: false });
      req.onsuccess = () => {
        resolve(req.result);
        
        // Auto-sync des dates de peremption
        if (storeName === 'products' && data.expiryDate) {
          _syncProductExpiryToLots(data.id, data.expiryDate);
        } else if (storeName === 'lots' && data.productId) {
          // Declencher le recalcul du minimum meme si seule la quantite a change (vente FEFO)
          _syncLotExpiryToProduct(data.productId);
        }

        if (window.NM && typeof window.NM.notifyMutation === 'function') {
          window.NM.notifyMutation(storeName);
        } else if (navigator.onLine) {
          _scheduleSyncToSupabase();
        }
        _notifyUIChange(storeName);
      };
      req.onerror = () => { _reportIDBError(storeName, 'put', req.error); resolve(null); };
      tx.onerror = () => { _reportIDBError(storeName, 'put(tx)', tx.error); resolve(null); };
    } catch (e) {
      _reportIDBError(storeName, 'put(exception)', e);
      resolve(null);
    }
  });
}

async function dbGet(storeName, id) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { console.error(`[DB] Erreur get ${storeName}/${id}:`, req.error); resolve(null); };
    } catch (e) {
      console.error(`[DB] Exception dans dbGet(${storeName}, ${id}):`, e);
      resolve(null);
    }
  });
}

async function dbGetAll(storeName, indexName, query) {
  if (!db) { console.warn('[DB] Base non initialisée, tentative de reconnexion...'); await initDB(); }
  // Cache mémoire : retourner immédiatement si dispo et pas expiré
  if (!indexName && query === undefined && _dbCache.has(storeName)) {
    const cacheAge = Date.now() - (_dbCacheTime.get(storeName) || 0);
    if (cacheAge < _cacheTTL) {
      return _dbCache.get(storeName);
    }
    _dbCache.delete(storeName); // Expiré, libérer la RAM
    _dbCacheTime.delete(storeName);
  }
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      let req;
      if (indexName && query !== undefined) {
        const index = store.index(indexName);
        req = index.getAll(query);
      } else {
        req = store.getAll();
      }
      req.onsuccess = () => {
        const result = req.result || [];
        // Cache adaptatif : pas les gros stores sur mobile
        const canCache = !indexName && query === undefined
          && result.length < _cacheMaxItems
          && !(_isMobile && _mobileNoCacheStores.has(storeName));
        if (canCache) {
          _dbCache.set(storeName, result);
          _dbCacheTime.set(storeName, Date.now());
        }
        resolve(result);
      };
      req.onerror = () => { console.error(`[DB] Erreur lecture ${storeName}:`, req.error); resolve([]); };
      tx.onerror = () => { console.error(`[DB] Transaction erreur ${storeName}`); resolve([]); };
    } catch (e) {
      console.error(`[DB] Exception dans dbGetAll(${storeName}):`, e);
      resolve([]); // Ne jamais rejeter pour éviter les cascades d'erreurs
    }
  });
}

async function dbGetByKey(storeName, key) {
  const all = await dbGetAll(storeName);
  return all.find(r => r.key === key) || null;
}

/**
 * Chargement paginé par curseur pour les stores très volumineux (audit, mouvements)
 * Retourne les N derniers éléments triés par index décroissant
 */
async function dbGetRecent(storeName, indexName, limit = 200) {
  if (!db) await initDB();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const results = [];
      const cursorReq = source.openCursor(null, 'prev'); // Du plus récent au plus ancien
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      cursorReq.onerror = () => resolve([]);
    } catch (e) {
      console.error(`[DB] Erreur curseur ${storeName}:`, e);
      resolve([]);
    }
  });
}

/**
 * Recherche produits par curseur — ne charge JAMAIS tout en RAM.
 * Parcourt les produits un par un et retourne les max premiers résultats matchant query.
 * Pour mobile POS avec 100k+ produits.
 */
async function dbSearchProducts(query, max = 50) {
  if (!db) await initDB();
  const q = (query || '').toLowerCase().trim();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const results = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor || results.length >= max) { resolve(results); return; }
        const p = cursor.value;
        if (p.status === 'inactive') { cursor.continue(); return; }
        if (!q) {
          results.push(p);
        } else {
          const match = (p.name || '').toLowerCase().includes(q)
            || (p.dci || '').toLowerCase().includes(q)
            || (p.code || '').toLowerCase().includes(q)
            || (p.ean || '').toLowerCase().includes(q)
            || (p.cip || '').toLowerCase().includes(q);
          if (match) results.push(p);
        }
        cursor.continue();
      };
      cursorReq.onerror = () => resolve([]);
    } catch (e) {
      resolve([]);
    }
  });
}

/**
 * Compte les produits actifs sans les charger en RAM
 */
async function dbCountProducts() {
  if (!db) await initDB();
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    } catch (e) { resolve(0); }
  });
}

// ═══════════════════════════════════════════════════════════════════
// TOMBSTONES DE SUPPRESSION — empêche la résurrection d'un enregistrement
// supprimé localement lorsque le prochain pull (ou un événement realtime)
// re-télécharge la version encore présente côté Supabase.
// ═══════════════════════════════════════════════════════════════════
const _SYNCED_STORES = new Set([
  'users', 'settings', 'products', 'lots', 'stock', 'movements', 'suppliers',
  'purchaseOrders', 'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
  'cashRegister', 'returns', 'invoices', 'shifts', 'prep_transfers',
  'insurances', 'insurancePayments'
]);
// storeName -> Set(id) des enregistrements supprimés localement dont la
// suppression distante n'est pas encore confirmée. Reconstruite au démarrage
// depuis les tombstones 'pending' persistés dans le store syncQueue.
const _pendingDeletes = new Map();
function _addPendingDelete(storeName, id) {
  if (id == null) return;
  if (!_pendingDeletes.has(storeName)) _pendingDeletes.set(storeName, new Set());
  _pendingDeletes.get(storeName).add(id);
}
function _clearPendingDelete(storeName, id) {
  const s = _pendingDeletes.get(storeName);
  if (s) s.delete(id);
}
function _isPendingDelete(storeName, id) {
  const s = _pendingDeletes.get(storeName);
  return !!s && s.has(id);
}

async function _loadPendingDeletes() {
  try {
    const queue = await dbGetAll('syncQueue');
    for (const t of queue) {
      if (t && t.type === 'delete' && t.status === 'pending') {
        _addPendingDelete(t.storeName, t.recordId);
      }
    }
  } catch (e) { /* silencieux */ }
}

async function dbDelete(storeName, id) {
  if (!db) await initDB();
  _checkWritePermission(storeName, 'delete');
  _invalidateCache(storeName);
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => {
        // Enregistrer une tombstone pour propager la suppression vers Supabase
        // et bloquer toute résurrection par pull/realtime tant qu'elle n'est
        // pas confirmée distante. On saute cette étape pour les suppressions
        // système (ex: écho d'un DELETE realtime déjà confirmé côté serveur).
        if (_SYNCED_STORES.has(storeName) && !_isSystemOp) {
          const keyField = storeName === 'settings' ? 'key' : 'id';
          _addPendingDelete(storeName, id);
          dbPut('syncQueue', {
            id: 'del_' + storeName + '_' + id,
            type: 'delete',
            storeName,
            recordId: id,
            keyField,
            status: 'pending',
            createdAt: Date.now()
          }).catch(() => {});
          if (window.NM && typeof window.NM.notifyMutation === 'function') {
            window.NM.notifyMutation('syncQueue');
          } else if (navigator.onLine) {
            _scheduleSyncToSupabase();
          }
        }
        _notifyUIChange(storeName);
        resolve(true);
      };
      req.onerror = () => { _reportIDBError(storeName, 'delete', req.error); resolve(false); };
      tx.onerror = () => { _reportIDBError(storeName, 'delete(tx)', tx.error); resolve(false); };
    } catch (e) {
      _reportIDBError(storeName, 'delete(exception)', e);
      resolve(false);
    }
  });
}

async function dbCount(storeName) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => { console.error(`[DB] Erreur count ${storeName}:`, req.error); resolve(0); };
      tx.onerror = () => { console.error(`[DB] Transaction count erreur ${storeName}`); resolve(0); };
    } catch (e) {
      console.error(`[DB] Exception dans dbCount(${storeName}):`, e);
      resolve(0);
    }
  });
}

/**
 * Calcul de la valeur du stock via curseur — ne charge PAS tous les produits en RAM.
 * Parcourt les produits un par un et cumule la valeur.
 * @param {Object} stockMap - Map { productId: { quantity } } du stock
 * @returns {Promise<{purchaseValue: number, saleValue: number}>}
 */
async function dbStockValue(stockMap) {
  return new Promise((resolve) => {
    let purchaseValue = 0;
    let saleValue = 0;
    try {
      const tx = db.transaction('products', 'readonly');
      const store = tx.objectStore('products');
      const cursor = store.openCursor();
      cursor.onsuccess = (e) => {
        const c = e.target.result;
        if (c) {
          const p = c.value;
          const s = stockMap[p.id];
          if (s && s.quantity > 0) {
            purchaseValue += s.quantity * (p.purchasePrice || 0);
            saleValue += s.quantity * (p.salePrice || 0);
          }
          c.continue();
        } else {
          resolve({ purchaseValue, saleValue });
        }
      };
      cursor.onerror = () => resolve({ purchaseValue: 0, saleValue: 0 });
    } catch (e) {
      resolve({ purchaseValue: 0, saleValue: 0 });
    }
  });
}

/**
 * Bulk Put — Insertion/mise à jour de masse via UNE SEULE transaction IndexedDB.
 * Conçu pour supporter des centaines de milliers d'enregistrements sans geler le navigateur.
 * Isole les échecs par enregistrement (Lot 2 hardening — F30) : un seul
 * enregistrement rejeté (ex: contrainte d'unicité) n'annule plus le lot entier.
 * @param {string} storeName - Nom du store IndexedDB
 * @param {Array} dataArray - Tableau d'objets à insérer/mettre à jour
 * @returns {Promise<{count:number, rejected:Array}>} - Nombre traité avec succès + détail des rejets individuels
 */
async function dbBulkPut(storeName, dataArray) {
  if (!db) await initDB();
  if (!dataArray || dataArray.length === 0) return { count: 0, rejected: [] };
  _invalidateCache(storeName);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    let count = 0;
    const rejected = []; // {item, error} — enregistrements individuellement rejetés (ex: ConstraintError sur un code dupliqué)

    for (const item of dataArray) {
      try {
        const req = store.put({ ...item, _updatedAt: item._updatedAt || Date.now(), _synced: item._synced !== undefined ? item._synced : true });
        req.onsuccess = () => { count++; };
        // Isolation par enregistrement (Lot 2 hardening — F30) : sans
        // preventDefault()/stopPropagation() ici, l'échec d'UN SEUL
        // enregistrement (ex: contrainte d'unicité sur 'code' lors d'un
        // import CSV de 1000 lignes) annule la transaction ENTIÈRE — les
        // 999 autres lignes valides du même lot seraient perdues avec elle.
        // dbBulkPut est utilisé pour des imports de catalogue où la
        // tolérance ligne-par-ligne est souhaitable — voir dbTransactionBulk
        // pour les opérations métier où l'atomicité stricte reste requise.
        req.onerror = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          rejected.push({ item, error: _classifyIDBError(req.error) });
          console.warn(`[DB] BulkPut : enregistrement rejeté dans ${storeName} (${_classifyIDBError(req.error)}) :`, req.error?.message);
        };
      } catch (e) {
        rejected.push({ item, error: _classifyIDBError(e) });
        console.warn(`[DB] BulkPut erreur item:`, e);
      }
    }

    tx.oncomplete = () => {
      _notifyUIChange(storeName);
      if (rejected.length > 0) {
        _lastIDBError = { type: 'BulkPartialFailure', store: storeName, operation: 'bulkPut', rejectedCount: rejected.length, timestamp: Date.now() };
      }
      resolve({ count, rejected });
    };
    tx.onerror = () => {
      _reportIDBError(storeName, 'bulkPut(tx)', tx.error);
      reject(tx.error);
    };
    tx.onabort = () => {
      _reportIDBError(storeName, 'bulkPut(abort)', tx.error);
      reject(tx.error);
    };
  });
}

/**
 * Exécute plusieurs écritures (add/put) sur un ou plusieurs stores dans
 * UNE SEULE transaction IndexedDB partagée : soit toutes les écritures
 * s'appliquent, soit aucune (IndexedDB annule automatiquement toute la
 * transaction si une seule requête échoue sans que son erreur soit
 * interceptée) — contrairement à des appels dbAdd/dbPut séparés dans une
 * boucle, qui laissent un état partiellement appliqué en cas d'échec/crash
 * au milieu du traitement.
 * @param {Array<{store:string, type:'add'|'put', data:object}>} operations
 * @returns {Promise<Array>} - clé générée pour chaque opération, dans l'ordre
 */
async function dbTransactionBulk(operations) {
  if (!db) await initDB();
  if (!operations || operations.length === 0) return [];
  const storeNames = [...new Set(operations.map(o => o.store))];
  for (const s of storeNames) {
    const op = operations.find(o => o.store === s);
    _checkWritePermission(s, op.type === 'add' ? 'add' : 'put');
  }
  storeNames.forEach(s => _invalidateCache(s));

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    const results = new Array(operations.length);
    const now = Date.now();

    operations.forEach((op, i) => {
      const store = tx.objectStore(op.store);
      const payload = { ...op.data, _updatedAt: now, _synced: false };
      if (op.type === 'add' && payload._createdAt === undefined) payload._createdAt = now;
      const req = op.type === 'add' ? store.add(payload) : store.put(payload);
      req.onsuccess = () => { results[i] = req.result; };
      // Ne pas intercepter req.onerror ici : on VEUT que l'erreur remonte et
      // fasse annuler toute la transaction (garantie tout-ou-rien).
    });

    tx.oncomplete = () => {
      storeNames.forEach(s => {
        if (window.NM && typeof window.NM.notifyMutation === 'function') window.NM.notifyMutation(s);
        else if (navigator.onLine) _scheduleSyncToSupabase();
        _notifyUIChange(s);
      });
      resolve(results);
    };
    tx.onerror = () => {
      _reportIDBError(storeNames.join('+'), 'transactionBulk(tx)', tx.error);
      reject(tx.error || new Error('dbTransactionBulk: transaction error'));
    };
    tx.onabort = () => {
      _reportIDBError(storeNames.join('+'), 'transactionBulk(abort)', tx.error);
      reject(tx.error || new Error('dbTransactionBulk: transaction aborted'));
    };
  });
}

// Audit log writer
async function writeAudit(action, entity, entityId, details, userId) {
  try {
    await dbAdd('auditLog', {
      action,
      entity,
      entityId,
      details,
      userId: userId || AppState.currentUser?.id,
      username: AppState.currentUser?.username,
      timestamp: Date.now(),
      ip: 'local'
    });
  } catch (e) {
    console.warn('Audit write failed:', e);
  }
}

// ── Détection de « ventes fantômes » (Lot 1 hardening) ──
// La finalisation d'une vente écrit 'sales' dans une transaction, puis
// saleItems/stock/movements/lots dans une SECONDE transaction distincte
// (js/pages/pos.js, _validerVenteLogic). Une coupure entre les deux laisse
// une vente encaissée sans aucun article lié ni impact stock. Détection
// pure lecture seule — AUCUNE réparation ni suppression automatique : une
// vente ambiguë doit être signalée et traitée par une procédure guidée,
// jamais « nettoyée » silencieusement (règle absolue du hardening).
const _orphanSaleAlertedIds = new Set(); // évite de re-signaler la même vente à chaque appel dans une session
async function detectOrphanSales(minAgeMs) {
  minAgeMs = minAgeMs || 5 * 60 * 1000; // 5 min : laisse le temps à la transaction bulk de s'exécuter normalement
  try {
    const [sales, saleItems] = await Promise.all([dbGetAll('sales'), dbGetAll('saleItems')]);
    const saleIdsWithItems = new Set(saleItems.map(si => si.saleId));
    const now = Date.now();
    const orphans = sales.filter(s => {
      if (saleIdsWithItems.has(s.id)) return false;
      if (!s.itemCount || s.itemCount <= 0) return false; // panier vide n'est normalement pas synonyme d'anomalie
      const createdAt = s._createdAt || Date.parse(s.date) || 0;
      return (now - createdAt) > minAgeMs;
    });

    // Journaliser (une seule fois par vente et par session applicative) pour
    // que l'anomalie soit tracée même avant l'existence du module Diagnostic (Lot 6).
    for (const s of orphans) {
      if (_orphanSaleAlertedIds.has(s.id)) continue;
      _orphanSaleAlertedIds.add(s.id);
      try {
        await writeAudit('ORPHAN_SALE_DETECTED', 'sales', s.id, {
          saleTotal: s.total, saleDate: s.date, itemCountExpected: s.itemCount,
          reason: 'Vente sans saleItems associées au-delà du délai normal — transaction stock probablement interrompue.'
        }, s.userId);
      } catch (e) { /* non bloquant */ }
      console.warn('[Hardening] Vente fantôme détectée : id=' + s.id + ', total=' + s.total + ', date=' + s.date);
    }
    return orphans;
  } catch (e) {
    console.warn('[Hardening] detectOrphanSales a échoué:', e?.message || e);
    return [];
  }
}

// Initialisation des paramètres de base (aucune donnée de test)
async function seedDemoData() {
  _isSystemOp = true;
  try {
  // Vérifier si déjà initialisé
  const settings = await dbGetAll('settings');
  const alreadySeeded = settings.find(s => s.key === 'seeded');
  if (alreadySeeded) return;



  // Settings essentiels uniquement
  await dbPut('settings', { key: 'currency', value: 'GNF' });
  await dbPut('settings', { key: 'seeded', value: true });

  } finally { _isSystemOp = false; }
}

async function trackInstallation() {
  // Enregistrement facultatif dans une table pharmacies_registry.
  // Si la table n'existe pas dans le Supabase du client, on ignore silencieusement.
  try {
    const sb = await getSupabaseClient();
    if (!sb) return;
    const settings = await dbGetAll('settings');
    const name = settings.find(s => s.key === 'pharmacy_name')?.value || 'Inconnue';
    const address = settings.find(s => s.key === 'pharmacy_address')?.value || 'Inconnue';

    await sb.from('pharmacies_registry').insert([
      { name, address, installed_at: new Date().toISOString() }
    ]);

  } catch (e) {
    // Table might not exist — this is expected and safe to ignore
    console.warn('[DB] Tracking skipped (table may not exist):', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// TIMEOUT GUARD — AbortController sur toutes les requetes Supabase
// Empeche un appel reseau suspendu de bloquer l app indefiniment.
// ═══════════════════════════════════════════════════════════════════
const _SUPABASE_TIMEOUT_MS = 15000; // 15s (genereux pour 3G lente)

function _withTimeout(supabaseQuery, ms) {
  ms = ms || _SUPABASE_TIMEOUT_MS;
  return new Promise(function(resolve) {
    var ctrl = new AbortController();
    var timer = setTimeout(function() {
      ctrl.abort();
      resolve({ data: null, error: { message: 'timeout', code: 'TIMEOUT' } });
    }, ms);
    supabaseQuery
      .abortSignal(ctrl.signal)
      .then(function(result) { clearTimeout(timer); resolve(result); })
      .catch(function(err) {
        clearTimeout(timer);
        if (err && err.name === 'AbortError') {
          resolve({ data: null, error: { message: 'timeout', code: 'TIMEOUT' } });
        } else {
          resolve({ data: null, error: err });
        }
      });
  });
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 9 — SYNC FURTIVE INDICATOR
// Petit indicateur visuel discret dans la topbar pendant la sync
// ═══════════════════════════════════════════════════════════════════
function _showSyncIndicator(active) {
  let el = document.getElementById('furtive-sync-indicator');
  if (active) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'furtive-sync-indicator';
      el.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>';
      el.style.cssText = 'position:fixed;top:12px;right:80px;z-index:9998;color:var(--primary,#2E86C1);opacity:0.7;animation:furtiveSync 1.2s ease-in-out infinite;pointer-events:none;';
      if (!document.getElementById('furtive-sync-style')) {
        const s = document.createElement('style');
        s.id = 'furtive-sync-style';
        s.textContent = '@keyframes furtiveSync{0%,100%{opacity:0.4;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}';
        document.head.appendChild(s);
      }
      document.body.appendChild(el);
    }
    el.style.display = '';
  } else {
    if (el) el.style.display = 'none';
  }
}

/**
 * Propage vers Supabase les suppressions locales en attente (tombstones du
 * store syncQueue créées par dbDelete). Contrepartie du push par upsert :
 * sans ceci, un enregistrement supprimé localement n'est jamais supprimé
 * côté serveur et réapparaît au prochain pull.
 */
async function _processDeleteQueue(sb) {
  let queue;
  try {
    queue = await dbGetAll('syncQueue');
  } catch (e) { return; }
  const pending = queue.filter(t => t && t.type === 'delete' && t.status === 'pending');
  if (pending.length === 0) return;

  for (const tomb of pending) {
    if ((window.NM && !window.NM.isOnline()) || !navigator.onLine) {
      throw new Error('network_offline');
    }
    const tableName = tomb.storeName === 'users' ? 'app_users' : tomb.storeName;
    const keyField = tomb.keyField || (tomb.storeName === 'settings' ? 'key' : 'id');
    try {
      const { error } = await _withTimeout(sb.from(tableName).delete().eq(keyField, tomb.recordId));
      if (!error) {
        await _dbPutRaw('syncQueue', { ...tomb, status: 'synced', syncedAt: Date.now() });
        _clearPendingDelete(tomb.storeName, tomb.recordId);
      } else if (!navigator.onLine) {
        throw new Error('network_offline');
      } else {
        console.warn(`[Flash] Suppression distante différée [${tomb.storeName}/${tomb.recordId}]:`, error.message || error);
      }
    } catch (e) {
      if (e && e.message === 'network_offline') throw e;
      // Erreur isolée sur cette tombstone — elle reste 'pending', on continue avec les suivantes
    }
  }
}

async function syncToSupabase(isManual = false) {
  if (window.NM && typeof window.NM.requestSync === 'function') {
    window.NM.requestSync(isManual);
    return;
  }
  return _internalSyncToSupabase();
}

async function _internalSyncToSupabase() {
  if (_syncInProgress) return;
  _syncInProgress = true;
  _showSyncIndicator(true);

  let totalPendingCount = 0;
  let _hasMorePending = false;

  try {
    const sb = await getSupabaseClient();
    if (!sb) return;

    // Propager les suppressions en attente AVANT les upserts, pour minimiser
    // la fenêtre pendant laquelle un pull pourrait encore résurrecter un
    // enregistrement supprimé localement (le filtre pull-time protège déjà
    // contre ce cas, ceci accélère juste la confirmation distante).
    try {
      await _processDeleteQueue(sb);
    } catch (delErr) {
      if (delErr && delErr.message === 'network_offline') throw delErr;
      console.warn('[Flash] _processDeleteQueue erreur:', delErr?.message || delErr);
    }

    // Cache des TABLES absentes sur ce projet Supabase (schéma pas à jour sur cette pharmacie).
    // Partagé avec le pull (même clé localStorage) : évite de retenter en boucle
    // l'envoi vers une table qui n'existe tout simplement pas côté serveur.
    var _missingTablesPush = {};
    try { _missingTablesPush = JSON.parse(localStorage.getItem('pharma_missing_tables') || '{}'); } catch (e) { }
    function _isMissingTableErrorPush(msg) {
      msg = msg || '';
      // ATTENTION : ne pas ajouter un test générique sur "schema cache" seul —
      // PostgREST utilise EXACTEMENT la même formule ("... in the schema
      // cache") pour une COLONNE introuvable ("Could not find the 'x' column
      // of 'y' in the schema cache") que pour une TABLE introuvable. Un test
      // trop large classe alors à tort un simple mismatch de colonne (que le
      // cache de colonnes invalides sait déjà gérer proprement) comme une
      // table entière absente, désactivant toute la synchro de cette table
      // au lieu de simplement ignorer la colonne fautive.
      return /Could not find the table/i.test(msg) || /relation "[^"]+" does not exist/i.test(msg);
    }
    function _markTableMissingPush(sn) {
      if (!_missingTablesPush[sn]) {
        _missingTablesPush[sn] = true;
        localStorage.setItem('pharma_missing_tables', JSON.stringify(_missingTablesPush));
        console.warn('[Flash] ⚠️ Table absente sur ce projet Supabase — envoi ignoré désormais : ' + sn);
      }
    }

    // Envoi SÉQUENTIEL et par ordre de priorité absolue (ventes d'abord, catalogues ensuite)
    const storesToSync = [
      'sales', 'saleItems', 'cashRegister', 'movements', 'auditLog', 'returns', 'invoices',
      'patients', 'prescriptions', 'alerts', 'shifts', 'prep_transfers',
      'stock', 'lots', 'purchaseOrders', 'suppliers',
      'insurances', 'insurancePayments', // <-- Assurances synchronisées au cloud
      'users', 'settings',
      'products' // Très lourd (33k+), toujours en dernier !
    ].filter(function (sn) { return !_missingTablesPush[sn]; });

    // Cache des colonnes invalides : éviter les 400 inutiles
    // Colonnes CONNUES comme inexistantes dans Supabase (fallback hardcodé)
    var _knownBadCols = {
      saleItems: ['lotNumber'],
      sales: ['paymentDetails'],
      cashRegister: ['category', 'subCategory', 'description', 'employeeId', 'createdAt', 'updatedAt'],
      // Colonnes locales des assurances non présentes dans Supabase :
      // 'coverage' (local) → 'coveragePercent' (Supabase), 'refPerson' (local) → 'referent' (Supabase)
      insurances: ['coverage', 'refPerson', '_updatedAt', '_localOnly'],
      insurancePayments: ['_updatedAt', '_localOnly']
    };
    var _colCache = {};
    try { 
      _colCache = JSON.parse(localStorage.getItem('pharma_bad_columns') || '{}'); 
    } catch (e) { }
    // Fusionner le hardcodé avec le cache dynamique
    for (var tbl in _knownBadCols) {
      if (!_colCache[tbl]) _colCache[tbl] = [];
      for (var ci = 0; ci < _knownBadCols[tbl].length; ci++) {
        if (_colCache[tbl].indexOf(_knownBadCols[tbl][ci]) === -1) _colCache[tbl].push(_knownBadCols[tbl][ci]);
      }
    }

    // ⚡ FLASH SEND — Envoi séquentiel pour ne pas étouffer le réseau (surtout avec 30k produits)
    for (const storeName of storesToSync) {
      // S'arrêter immédiatement si on a perdu la connexion
      if ((window.NM && !window.NM.isOnline()) || !navigator.onLine) {
        throw new Error('network_offline');
      }

      try {
        const all = await dbGetAll(storeName);
        let pending = all.filter(item => item._synced === false);

        if (pending.length === 0) continue;
        
        // Chunking (Anti-Head-of-Line Blocking) : 
        // Traiter max 500 items par table par passe pour laisser la place aux ventes urgentes
        if (pending.length > 500) {
          pending = pending.slice(0, 500);
          _hasMorePending = true;
        }
        
        totalPendingCount += pending.length;

        const payloads = pending.map(item => {
          const payload = {};
          for (const [key, value] of Object.entries(item)) {
            if (!key.startsWith('_')) {
              const mustBeString = [
                'username', 'password', 'code', 'lotNumber', 'phone', 'dnpm',
                'pharmacy_phone', 'pharmacy_dnpm', 'pharmacy_name', 'key', 'value'
              ];

              if (mustBeString.includes(key)) {
                payload[key] = (value !== null && value !== undefined) ? String(value) : value;
                continue;
              }

              if (key === 'createdAt' || key === 'updatedAt' || key === 'lastUpdated') {
                if (typeof value === 'string' && value.includes('T')) {
                  payload[key] = new Date(value).getTime() || Date.now();
                  continue;
                }
              }

              if (typeof value === 'string') {
                if (value.startsWith('session_')) {
                  payload[key] = parseInt(value.replace('session_', '')) || 1;
                } else if (/^\d+$/.test(value) && !value.startsWith('0')) {
                  payload[key] = parseInt(value);
                } else {
                  payload[key] = value;
                }
              } else {
                payload[key] = value;
              }
            }
          }
          if (item._updatedAt) payload.updatedAt = item._updatedAt;

          const tablesWithUserId = ['sales', 'movements', 'cashRegister', 'auditLog'];
          if (tablesWithUserId.includes(storeName)) {
            if (payload.userId === undefined || payload.userId === null) {
              payload.userId = AppState.currentUser?.id || 1;
            }
          }

          // auditLog : sécuriser entityId (colonne BIGINT côté Supabase) et details.
          // Certains appels historiques de writeAudit() passent par erreur un objet
          // en guise d'entityId (bug d'ordre d'arguments) — un objet envoyé vers une
          // colonne BIGINT provoque un 400 qui, avant, faisait planter tout le sync
          // de la table (c'est pour ça qu'auditLog avait été retiré de la synchro).
          if (storeName === 'auditLog') {
            var eid = payload.entityId;
            if (eid !== null && eid !== undefined && typeof eid === 'object') {
              // L'objet est en réalité le detail de l'action : le récupérer si 'details' est vide
              if (!payload.details || (typeof payload.details === 'object' && Object.keys(payload.details).length === 0)) {
                payload.details = eid;
              }
              payload.entityId = null;
            } else if (typeof eid === 'string' && !/^\d+$/.test(eid)) {
              payload.entityId = null;
            }
            if (payload.details && typeof payload.details === 'object') {
              try { payload.details = JSON.stringify(payload.details); } catch (e) { payload.details = null; }
            }
          }

          // Exclure les clés settings qui contiennent du JSON complexe non-compatible Supabase
          if (storeName === 'settings' && payload.key === 'held_carts') {
            return null;
          }

          // Filtrer les colonnes invalides DANS le payload (via auto-apprentissage du cache)
          var storeBadCols = _colCache[storeName] || [];
          if (storeBadCols.length > 0) {
            for (var bi = 0; bi < storeBadCols.length; bi++) {
              delete payload[storeBadCols[bi]];
            }
          }

          return payload;
        });

        var currentPayloads = payloads.filter(p => {
          if (!p) return false;
          // Purger les vieux IDs 'virtual_' qui font planter Supabase (invalid type bigint)
          if ((typeof p.id === 'string' && p.id.startsWith('virtual_')) || 
              (typeof p.lotId === 'string' && p.lotId.startsWith('virtual_'))) {
            _dbPutRaw(storeName, { ...p, _synced: true }).catch(()=>{});
            return false;
          }
          return true;
        });

        let retries = 0;
        const maxRetries = 10;
        let lastError = null;
        let skipBackoff = false;
        // Délais backoff exponentiel : 0, 500ms, 1s, 2s, 5s...
        const _backoffDelays = [0, 500, 1000, 2000, 5000, 10000, 15000, 20000, 30000, 60000];

        // Découper en lots de 500 pour éviter les timeouts Supabase
        const PUSH_BATCH = 500;
        let allSuccess = true;

        while (retries <= maxRetries) {
          // Vérifier l'état réseau AVANT chaque tentative
          if ((window.NM && !window.NM.isOnline()) || !navigator.onLine) {
            throw new Error('network_offline');
          }

          // Backoff : attendre avant de réessayer (sauf premier essai et apprentissage de colonne)
          if (retries > 0 && !skipBackoff) {
            const delay = _backoffDelays[Math.min(retries, _backoffDelays.length - 1)];
            await new Promise(r => setTimeout(r, delay));
            // Re-vérifier après le délai d'attente
            if ((window.NM && !window.NM.isOnline()) || !navigator.onLine) {
              throw new Error('network_offline');
            }
          }
          skipBackoff = false;

          lastError = null;
          allSuccess = true;

          for (let bi = 0; bi < currentPayloads.length; bi += PUSH_BATCH) {
            // Vérifier l'état réseau avant chaque batch
            if ((window.NM && !window.NM.isOnline()) || !navigator.onLine) {
              throw new Error('network_offline');
            }

            const batch = currentPayloads.slice(bi, bi + PUSH_BATCH);
            const { error } = await _withTimeout(
              sb
                .from(storeName === 'users' ? 'app_users' : storeName)
                .upsert(batch, {
                  onConflict: storeName === 'settings' ? 'key' : 'id',
                  ignoreDuplicates: false
                })
            );

            if (error) {
              lastError = error;
              allSuccess = false;
              break;
            }

            // Marquer les items de ce batch comme synchronisés
            const batchPending = pending.slice(bi, bi + PUSH_BATCH);
            for (const item of batchPending) {
              item._synced = true;
              await _dbPutRaw(storeName, item);
              // Anti-écho : marquer pour ignorer l'événement Realtime retour
              _markAsSynced(storeName, item.id || item.key);
            }
          }

          if (allSuccess) {
            lastError = null;
            break;
          }

          const errorMsg = lastError?.message || '';

          if (_isMissingTableErrorPush(errorMsg)) {
            _markTableMissingPush(storeName);
            lastError = null;
            allSuccess = true; // Table absente : rien à réessayer, ne pas bloquer les autres stores
            break;
          }

          const colMatch = errorMsg.match(/Could not find the '([^']+)' column/) ||
                           errorMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/) ||
                           errorMsg.match(/column "([^"]+)" does not exist/) ||
                           errorMsg.match(/column [^.]+\.([^ ]+) does not exist/);

          if (colMatch && retries < maxRetries) {
            const badCol = colMatch[1];
            // On ne log que si c'est une nouvelle découverte
            if (!_colCache[storeName] || !_colCache[storeName].includes(badCol)) {
              console.log('[Flash] ⚡ ' + storeName + ': apprentissage nouvelle colonne local-only \'' + badCol + '\'');
            }
            currentPayloads = currentPayloads.map(p => {
              const { [badCol]: _, ...rest } = p;
              return rest;
            });
            // Sauvegarder dans le cache
            if (!_colCache[storeName]) _colCache[storeName] = [];
            if (!_colCache[storeName].includes(badCol)) _colCache[storeName].push(badCol);
            localStorage.setItem('pharma_bad_columns', JSON.stringify(_colCache));
            retries++;
            skipBackoff = true; // Skip delay since we learned a column schema difference
          } else {
            // Si c'est une erreur réseau, lever l'exception immédiatement
            if (window.NM && !window.NM.isOnline()) {
              throw new Error('network_offline');
            }
            break;
          }
        }

        if (lastError && navigator.onLine) {
          // Ignorer les erreurs RLS connues (settings upsert en anon mode)
          if (!lastError.message?.includes('row-level security')) {
            console.error(`[Flash] ❌ ${storeName}:`, lastError.message || lastError);
          }
        }
      } catch (storeError) {
        // Garde null-safe : storeError peut être null si une promesse rejette avec null
        if (storeError?.message === 'network_offline') {
          throw storeError; // Propager pour arrêter le sync global
        }
        // Silencieux si hors-ligne
        if (navigator.onLine) console.error(`[Flash] Exception ${storeName}:`, storeError?.message || storeError);
      }
    }

    // 📡 Push Device Heartbeat — permet aux autres appareils de voir notre état
    try {
      var currentDeviceName = localStorage.getItem('pharma_device_name') || AppState.deviceName;
      var currentDeviceId = localStorage.getItem('pharma_device_id') || AppState.deviceId;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
      const deviceStatus = {
        name: currentDeviceName,
        last_sync: Date.now(),
        pending: 0,
        online: !AppState._confirmedOffline,
        type: isMobileDevice ? 'mobile' : 'desktop'
      };
      var hbPayload = {
        key: 'device_status_' + currentDeviceId,
        value: JSON.stringify(deviceStatus)
      };
      // Pré-filtrer les colonnes invalides connues pour settings
      var settingsBadCols = _colCache['settings'] || [];
      settingsBadCols.forEach(function (c) { delete hbPayload[c]; });
      // Retry avec suppression de colonnes inconnues (comme le sync principal)
      for (var hbRetry = 0; hbRetry < 3; hbRetry++) {
        var hbRes = await sb.from('settings').upsert(hbPayload, { onConflict: 'key' });
        if (!hbRes.error) break;
        const hbErrMsg = hbRes.error.message || '';
        var hbCol = hbErrMsg.match(/Could not find the '([^']+)' column/) ||
                    hbErrMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/) ||
                    hbErrMsg.match(/column "([^"]+)" does not exist/) ||
                    hbErrMsg.match(/column [^.]+\.([^ ]+) does not exist/);
        if (hbCol) {
          delete hbPayload[hbCol[1]];
        } else {
          break;
        }
      }
    } catch (heartbeatErr) {
      // Silently ignore heartbeat errors
    }

    // 🧹 Nettoyer l'ancien device_id migré (si applicable)
    try {
      var oldKey = localStorage.getItem('pharma_old_device_key');
      if (oldKey) {
        await sb.from('settings').delete().eq('key', oldKey);
        localStorage.removeItem('pharma_old_device_key');
        console.log('[Flash] 🧹 Ancien appareil nettoyé : ' + oldKey);
      }
    } catch (e) { }

    if (totalPendingCount > 0) console.log(`[Flash] ⚡ Sync terminée — ${totalPendingCount} éléments envoyés`);

    // ── BROADCAST : Notifier les autres appareils instantanément ──
    if (totalPendingCount > 0 && _broadcastChannel) {
      try {
        _broadcastChannel.send({
          type: 'broadcast',
          event: 'sync_push',
          payload: {
            deviceId: AppState.deviceId,
            deviceName: AppState.deviceName,
            count: totalPendingCount,
            ts: Date.now()
          }
        });
      } catch (e) { /* silencieux */ }
    }

    // Tracking désactivé — table push_tracking non présente dans Supabase client
    // (supprimé pour éviter les erreurs silencieuses en prod)

  } catch (globalError) {
    const errStr = String(globalError?.message || globalError || '');
    const isNetErr = errStr.includes('fetch') || errStr.includes('network') || errStr.includes('ERR_') || errStr.includes('timeout') || errStr.includes('Failed');
    if (isNetErr) {
      if (window.NM && typeof window.NM.handleFetchFailure === 'function') {
        window.NM.handleFetchFailure(globalError);
      } else {
        AppState._confirmedOffline = true;
        AppState.isOnline = false;
      }
    }
    throw globalError;
  } finally {
    _syncInProgress = false;
    _showSyncIndicator(false);
    if (_hasMorePending) {
      if (window.NM && typeof window.NM.requestSync === 'function') {
        window.NM.requestSync();
      } else if (navigator.onLine && !AppState._confirmedOffline) {
        setTimeout(function() { syncToSupabase().catch(function(){}); }, 5000);
      }
    } else if (_syncNeededAfter) {
      _syncNeededAfter = false;
      _scheduleSyncToSupabase();
    }
  }
}

/**
 * PULL DEPUIS SUPABASE (Cloud → Local)
 * @param {boolean} isManual - Pull complet si true, incrémental si false
 */
let _isPulling = false;
let _pullBatch = null;
async function pullFromSupabase(isManual = false, onProgress = null) {
  if (window.NM && typeof window.NM.requestPull === 'function') {
    if (onProgress) {
      // Si on a besoin de suivre la progression en temps réel (ex: onboarding),
      // on court-circuite le délai et le coalescing du NetworkManager.
      return _internalPullFromSupabase(isManual, onProgress);
    }
    window.NM.requestPull(isManual);
    return;
  }
  return _internalPullFromSupabase(isManual, onProgress);
}

async function _internalPullFromSupabase(isManual = false, onProgress = null) {
  if (_isPulling) return;
  _isPulling = true;
  _isSystemOp = true;
  const _pullLockTimeout = setTimeout(() => { _isPulling = false; _isSystemOp = false; }, 45000);
  let hasChanges = false;
  let totalItemsPulled = 0;
  try {
    const sb = await getSupabaseClient();
    if (!sb) return;

    // ── Cache des TABLES absentes sur CE projet Supabase (schéma pas à jour) ──
    // Certaines pharmacies tournent sur un projet Supabase dont le schéma n'a pas
    // reçu les dernières migrations (ex: tables 'insurances'/'insurancePayments'
    // ajoutées en v9.7.84). Sans ce filtre, ces tables absentes échouent (404)
    // à CHAQUE pull, ce qui empêche 'pharma_last_pull_ts' d'avancer (voir plus bas)
    // et force un pull COMPLET en boucle sur TOUTES les tables — très lourd sur
    // réseau lent — au lieu d'un pull incrémental léger. On les ignore une fois
    // détectées, sans jamais bloquer l'avancement du curseur de synchro.
    var _missingTables = {};
    try { _missingTables = JSON.parse(localStorage.getItem('pharma_missing_tables') || '{}'); } catch (e) { }
    function _isMissingTableError(msg) {
      msg = msg || '';
      // Voir _isMissingTableErrorPush (push) : ne pas tester "schema cache"
      // seul, formule partagée par PostgREST avec les erreurs de COLONNE
      // manquante — trop large, classerait un simple mismatch de colonne
      // comme une table entière absente.
      return /Could not find the table/i.test(msg) || /relation "[^"]+" does not exist/i.test(msg);
    }
    function _markTableMissing(sn) {
      if (!_missingTables[sn]) {
        _missingTables[sn] = true;
        localStorage.setItem('pharma_missing_tables', JSON.stringify(_missingTables));
        console.warn('[Flash] ⚠️ Table absente sur ce projet Supabase — ignorée désormais : ' + sn);
      }
    }

    const storesToPull = [
      'users', 'settings',
      'products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders',
      'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
      'cashRegister', 'auditLog', 'returns', 'invoices', 'shifts', 'prep_transfers',
      'insurances', 'insurancePayments'
    ].filter(function (sn) { return !_missingTables[sn]; });

    // ── PULL INCRÉMENTAL (Delta Sync) ──
    // Auto-pull : ne récupérer que les données modifiées depuis le dernier pull
    // Pull manuel : récupérer TOUT (pour setup initial ou récupération)
    const lastPullKey = 'pharma_last_pull_ts';
    const lastPullTs = isManual ? null : localStorage.getItem(lastPullKey);
    // updatedAt dans Supabase est un BIGINT (millisecondes), PAS une date ISO
    const pullSince = lastPullTs ? parseInt(lastPullTs) : null;

    if (pullSince) {
      _logOnce('log', '[Flash] Pull incrémental (delta depuis ' + new Date(parseInt(lastPullTs)).toLocaleTimeString('fr-FR') + ')...');
    } else {
      _logOnce('log', '[Flash] Pull démarré...');
    }

    const mustBeString = [
      'username', 'password', 'code', 'lotNumber', 'phone', 'dnpm',
      'pharmacy_phone', 'pharmacy_dnpm', 'pharmacy_name', 'key', 'value'
    ];

    // Fonction d'écriture IDB — MERGE avec les données locales existantes
    // pour préserver les champs qui n'existent pas dans Supabase
    // ── HELPER : céder le thread principal pendant les opérations lourdes ──
    const _yieldToUI = () => new Promise(r => setTimeout(r, 0));

    const writeBatchToIDB = async (storeName, items) => {
      const prepared = items.map(item => {
        let localItem = { ...item, _synced: true, _updatedAt: item.updatedAt || item.updatedat || item._updatedAt || Date.now() };
        for (const key of Object.keys(localItem)) {
          if (mustBeString.includes(key) || (storeName === 'settings' && key === 'value')) {
            if (localItem[key] !== undefined && localItem[key] !== null) {
              localItem[key] = String(localItem[key]);
            }
          }
        }
        return localItem;
      }).filter(item => {
        if (storeName === 'settings' && item.status === 'DELETED') return false;
        // Ne jamais réécrire un enregistrement supprimé localement tant que
        // sa suppression distante n'est pas confirmée (évite la résurrection).
        var kProp = (storeName === 'settings') ? 'key' : 'id';
        if (_isPendingDelete(storeName, item[kProp])) return false;
        return true;
      });
      if (prepared.length === 0) return 0;

      var keyProp = (storeName === 'settings') ? 'key' : 'id';

      // ── STRATÉGIE ADAPTATIVE ──
      // Petit lot (incrémental) : get ciblés — rapide, aucun lag
      // Gros lot (full pull) : getAll — plus efficace en masse
      if (prepared.length < 100) {
        // ── FAST PATH : get ciblés uniquement les IDs nécessaires ──
        var existingMap = {};
        var keysToFetch = [];
        for (var i = 0; i < prepared.length; i++) {
          var k = prepared[i][keyProp];
          if (k !== undefined && k !== null) keysToFetch.push(k);
        }
        if (keysToFetch.length > 0) {
          try {
            await new Promise(function (resolve) {
              var tx = db.transaction(storeName, 'readonly');
              var store = tx.objectStore(storeName);
              var done = 0;
              for (var j = 0; j < keysToFetch.length; j++) {
                (function (key) {
                  var req = store.get(key);
                  req.onsuccess = function () {
                    if (req.result) existingMap[key] = req.result;
                    if (++done >= keysToFetch.length) resolve();
                  };
                  req.onerror = function () {
                    if (++done >= keysToFetch.length) resolve();
                  };
                })(keysToFetch[j]);
              }
              tx.oncomplete = function () { resolve(); };
              tx.onerror = function () { resolve(); };
            });
          } catch (e) { /* continue sans merge */ }
        }
        // Écriture
        await new Promise(function (resolve, reject) {
          var tx2 = db.transaction(storeName, 'readwrite');
          var store2 = tx2.objectStore(storeName);
          for (var i = 0; i < prepared.length; i++) {
            (function (item, kv) {
              var ex = (kv !== undefined && kv !== null) ? existingMap[kv] : null;
              // PROTECTION : ne pas écraser les données locales non-poussées
              if (ex && ex._synced === false) return;
              var putReq = store2.put(ex ? Object.assign({}, ex, item) : item);
              putReq.onerror = function (ev) {
                ev.preventDefault(); // Empêche l'annulation de la transaction
                ev.stopPropagation();
                var err = ev.target.error;
                console.warn('[Flash] IDB fast-put ignoré [' + storeName + '] clé=' + kv + ':', err ? (err.message || err.name) : 'erreur inconnue');
              };
            })(prepared[i], prepared[i][keyProp]);
          }
          tx2.oncomplete = function () { resolve(); };
          tx2.onerror = function () { reject(new Error('IDB fast-tx error [' + storeName + ']: ' + (tx2.error?.message || tx2.error?.name || 'null'))); };
          tx2.onabort = function () { reject(new Error('IDB fast-tx abort [' + storeName + ']: ' + (tx2.error?.message || tx2.error?.name || 'null'))); };
        });
      } else {
        // ── BULK PATH : getAll + écriture par chunks de 200 ──
        var existingMap = {};
        try {
          await new Promise(function (resolve) {
            var tx1 = db.transaction(storeName, 'readonly');
            var store1 = tx1.objectStore(storeName);
            var req = store1.getAll();
            req.onsuccess = function () {
              var all = req.result || [];
              for (var i = 0; i < all.length; i++) {
                var k = all[i][keyProp];
                if (k !== undefined && k !== null) existingMap[k] = all[i];
              }
              resolve();
            };
            req.onerror = function () { resolve(); };
            tx1.onerror = function () { resolve(); };
          });
        } catch (e) { /* continue */ }

        // Écriture par chunks — évite de bloquer le thread principal
        var CHUNK = 200;
        for (var start = 0; start < prepared.length; start += CHUNK) {
          var chunk = prepared.slice(start, start + CHUNK);
          await new Promise(function (resolve, reject) {
            var tx2 = db.transaction(storeName, 'readwrite');
            var store2 = tx2.objectStore(storeName);
            for (var i = 0; i < chunk.length; i++) {
              (function (item, kv) {
                var ex = (kv !== undefined && kv !== null) ? existingMap[kv] : null;
                // PROTECTION : ne pas écraser les données locales non-poussées
                if (ex && ex._synced === false) return;
                // CORRECTIF : intercepter les erreurs individuelles (violation contrainte unique)
                // pour ne pas annuler toute la transaction à cause d'un seul enregistrement
                var putReq = store2.put(ex ? Object.assign({}, ex, item) : item);
                putReq.onerror = function (ev) {
                  ev.preventDefault(); // Empêche l'annulation de la transaction
                  ev.stopPropagation();
                  var err = ev.target.error;
                  console.warn('[Flash] IDB put ignoré [' + storeName + '] clé=' + kv + ':', err ? (err.message || err.name) : 'erreur inconnue');
                };
              })(chunk[i], chunk[i][keyProp]);
            }
            tx2.oncomplete = function () { resolve(); };
            tx2.onerror = function () { reject(new Error('IDB tx error [' + storeName + ']: ' + (tx2.error?.message || tx2.error?.name || 'null'))); };
            tx2.onabort = function () { reject(new Error('IDB tx abort [' + storeName + ']: ' + (tx2.error?.message || tx2.error?.name || 'null'))); };
          });
          // Yield au navigateur entre chaque chunk
          if (start + CHUNK < prepared.length) await _yieldToUI();
        }
      }
      return prepared.length;
    };

    // ── Tracking des stores échoués pour forcer un re-pull complet si nécessaire ──
    const _failedPullStores = new Set();
    // Tables Supabase dont la colonne updatedAt est en minuscules (créée sans guillemets)
    // Ajouter ici toute table dont le CREATE TABLE utilise updatedAt sans guillemets
    const _insTablesNoCamel = ['insurances', 'insurancepayments'];

    let currentIndex = 0;
    for (const storeName of storesToPull) {
      currentIndex++;
      if ((window.NM && !window.NM.isOnline()) || !navigator.onLine) {
        throw new Error('network_offline');
      }
      if (onProgress) {
        onProgress({
          storeName,
          index: currentIndex,
          total: storesToPull.length,
          status: 'fetching',
          itemCount: 0
        });
      }
      let storeItemCount = 0;
      try {
        const tableName = storeName === 'users' ? 'app_users' : storeName;

        if (pullSince) {
          // ── INCRÉMENTAL PARALLÈLE : groupes de 4 stores ──
          // Accumule 4 requêtes puis les lance en parallèle
          if (!_pullBatch) _pullBatch = [];
          _pullBatch.push({ storeName, tableName });

          if (_pullBatch.length >= 4 || storeName === storesToPull[storesToPull.length - 1]) {
            const batch = _pullBatch;
            _pullBatch = [];

            const results = await Promise.all(batch.map(async ({ storeName: sn, tableName: tn }) => {
              try {
                // PostgreSQL convertit les noms non-quotés en minuscules.
                // Pour insurances et insurancePayments, la colonne s'appelle "updatedat".
                let updatedAtCol = _insTablesNoCamel.includes(tn.toLowerCase()) ? 'updatedat' : 'updatedAt';
                let queryResult = await _withTimeout(
                  sb.from(tn)
                    .select('*')
                    .gte(updatedAtCol, pullSince)
                    .order(updatedAtCol, { ascending: true })
                    .limit(5000)
                );

                // Si la colonne n'existe pas, on bascule dynamiquement sur l'autre casse
                if (queryResult.error && (
                  queryResult.error.code === '42703' || 
                  queryResult.error.message?.includes('column') || 
                  queryResult.error.message?.includes('does not exist')
                )) {
                  const fallbackCol = updatedAtCol === 'updatedAt' ? 'updatedat' : 'updatedAt';
                  console.log(`[Flash] Basculement de colonne pour ${tn} : ${updatedAtCol} ➔ ${fallbackCol}`);
                  queryResult = await _withTimeout(
                    sb.from(tn)
                      .select('*')
                      .gte(fallbackCol, pullSince)
                      .order(fallbackCol, { ascending: true })
                      .limit(5000)
                  );
                }

                const { data, error } = queryResult;
                if (error) return { sn, data: null, error };
                return { sn, data, error: null };
              } catch (e) { return { sn, data: null, error: e }; }
            }));

            for (const r of results) {
              if (r.error) {
                // ── CORRECTIF CRITIQUE : Ne pas bloquer les autres stores du batch ──
                // Un seul store en erreur ne doit pas faire perdre les données des 3 autres.
                if (window.NM && !window.NM.isOnline()) {
                  throw new Error('network_offline');
                }
                const rErrMsg = r.error?.message || String(r.error || '');
                const rIsNet = rErrMsg.includes('Failed to fetch') || rErrMsg.includes('NetworkError') || rErrMsg.includes('ERR_') || rErrMsg.includes('timeout');
                if (rIsNet) throw new Error('network_offline');
                if (_isMissingTableError(rErrMsg)) {
                  _markTableMissing(r.sn);
                  continue; // Table jamais créée sur ce projet : pas un échec réseau, ne bloque pas le curseur
                }
                // Marquer ce store comme échoué pour forcer un re-pull complet
                _failedPullStores.add(r.sn);
                if (rErrMsg && !rErrMsg.includes('null') && !rErrMsg.includes('offline')) {
                  console.warn(`[Flash] Pull ${r.sn} temporairement échoué:`, rErrMsg);
                }
                continue; // Continuer avec les autres stores du batch !
              }
              if (r.data && r.data.length > 0) {
                const count = await writeBatchToIDB(r.sn, r.data);
                if (count > 0) {
                  hasChanges = true;
                  totalItemsPulled += count;
                  _updateCacheInPlace(r.sn, r.data);
                }
              }
            }
            // Micro-yield entre batches — POS 100% réactif
            await new Promise(r => setTimeout(r, 5));
          }

        } else {
          // ── PULL COMPLET (manuel ou premier pull) ──
          const countRes = await _withTimeout(sb.from(tableName).select('*', { count: 'exact', head: true }));
          if (countRes.error) {
            if (window.NM && !window.NM.isOnline()) {
              throw new Error('network_offline');
            }
            // ── CORRECTIF CRITIQUE : Ne pas interrompre le pull complet pour un seul store ──
            const ceMsg = countRes.error?.message || '';
            const ceIsNet = ceMsg.includes('Failed to fetch') || ceMsg.includes('NetworkError') || ceMsg.includes('ERR_') || ceMsg.includes('timeout');
            if (ceIsNet) throw new Error('network_offline');
            if (_isMissingTableError(ceMsg)) {
              _markTableMissing(storeName);
              continue; // Table jamais créée sur ce projet : pas un échec, ne bloque pas le curseur
            }
            _failedPullStores.add(storeName);
            if (ceMsg && !ceMsg.includes('null')) console.warn(`[Flash] Count échoué ${storeName}:`, ceMsg);
            continue; // Passer au store suivant
          }
          const totalCount = countRes.count || 0;

          if (totalCount > 0) {
            const fetchLimit = 1000;
            let storeItemCount = 0;
            let storePullOk = true;
            let storeTableMissing = false;

            for (let offset = 0; offset < totalCount; offset += fetchLimit * 5) {
              if ((window.NM && !window.NM.isOnline()) || !navigator.onLine) {
                throw new Error('network_offline');
              }
              const batch = [];
              for (let j = 0; j < 5 && (offset + j * fetchLimit) < totalCount; j++) {
                const o = offset + j * fetchLimit;
                batch.push(_withTimeout(sb.from(tableName).select('*').range(o, o + fetchLimit - 1)));
              }
              const results = await Promise.all(batch);
              for (const res of results) {
                if (res.error) {
                  if (window.NM && !window.NM.isOnline()) {
                    throw new Error('network_offline');
                  }
                  // ── CORRECTIF CRITIQUE : Marquer le store comme échoué, ne pas planter ──
                  const reMsg = res.error?.message || '';
                  const reIsNet = reMsg.includes('Failed to fetch') || reMsg.includes('NetworkError') || reMsg.includes('ERR_') || reMsg.includes('timeout');
                  if (reIsNet) throw new Error('network_offline');
                  if (_isMissingTableError(reMsg)) {
                    _markTableMissing(storeName);
                    storeTableMissing = true;
                    break; // Table jamais créée sur ce projet : pas un échec, ne bloque pas le curseur
                  }
                  _failedPullStores.add(storeName);
                  storePullOk = false;
                  if (reMsg && !reMsg.includes('null')) console.warn(`[Flash] Page pull échouée ${storeName}:`, reMsg);
                  break; // Sortir de la boucle de pagination pour ce store
                }
                if (res.data && res.data.length > 0) {
                  storeItemCount += await writeBatchToIDB(storeName, res.data);
                }
              }
              if (!storePullOk || storeTableMissing) break; // Passer au store suivant
              await new Promise(r => setTimeout(r, 0));
            }

            if (storeItemCount > 0) {
              hasChanges = true;
              totalItemsPulled += storeItemCount;
              _invalidateCache(storeName); // Full pull : vider le cache pour re-read complet
            }
          }
        }
        if (onProgress) {
          onProgress({
            storeName,
            index: currentIndex,
            total: storesToPull.length,
            status: _failedPullStores.has(storeName) ? 'failed' : 'completed',
            itemCount: storeItemCount
          });
        }
      } catch (storeErr) {
        // Garde null-safe : storeErr peut être null si une promesse rejette avec null
        if (storeErr?.message === 'network_offline') {
          throw storeErr; // Propager pour arrêter le pull global
        }
        const errMsg = storeErr?.message || String(storeErr || '');
        const isNetworkError = errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('ERR_INTERNET_DISCONNECTED') || errMsg.includes('ERR_QUIC_PROTOCOL_ERROR') || errMsg.includes('ERR_NAME_NOT_RESOLVED') || errMsg.includes('CORS') || errMsg.includes('Access-Control') || errMsg.includes('ERR_CONNECTION_RESET') || errMsg.includes('ERR_CONNECTION_CLOSED') || errMsg.includes('ERR_NETWORK_IO_SUSPENDED') || errMsg.includes('preflight') || errMsg.includes('timeout');
        if (isNetworkError) {
          console.log('[Flash] ⚠️ Pull interrompu: erreur réseau détectée');
          throw storeErr;
        }
        // ── Guard IDB closing (Service Worker update) ──
        // Quand le SW active une nouvelle version, il force la fermeture de la connexion IDB.
        // On réinitialise db=null pour forcer un initDB() au prochain appel, et on abandonne
        // le pull en cours proprement (pas de log de warning pour chaque store).
        if (errMsg.includes('connection is closing') || errMsg.includes('InvalidStateError')) {
          db = null; // Forcer la réouverture au prochain accès
          console.log('[Flash] 🔄 IDB fermé par SW — pull annulé, réouverture au prochain cycle');
          if (onProgress) {
            onProgress({
              storeName,
              index: currentIndex,
              total: storesToPull.length,
              status: 'aborted',
              itemCount: 0
            });
          }
          return; // Stopper le pull sans marquer les stores comme échoués
        }
        // Marquer le store comme échoué pour forcer un prochain pull complet
        _failedPullStores.add(storeName);
        if (errMsg && !errMsg.includes('null')) {
          console.warn(`[Flash] Store error ${storeName}:`, errMsg);
        }
        if (onProgress) {
          onProgress({
            storeName,
            index: currentIndex,
            total: storesToPull.length,
            status: 'failed',
            itemCount: 0,
            error: errMsg
          });
        }
      }
    }

    // ── CORRECTIF CRITIQUE : Sauvegarder le timestamp SEULEMENT si tous les stores ont réussi ──
    // Si certains stores ont échoué, ne pas avancer le curseur : le prochain pull doit
    // re-tenter depuis le dernier timestamp valide pour récupérer les données manquantes.
    if (_failedPullStores.size === 0) {
      localStorage.setItem(lastPullKey, String(Date.now()));
    } else {
      console.warn(`[Flash] Pull partiel — ${_failedPullStores.size} store(s) échoués, timestamp non avancé:`, [..._failedPullStores].join(', '));
      // Forcer un pull complet au prochain démarrage pour récupérer les données manquantes
      localStorage.removeItem(lastPullKey);
    }

    if (hasChanges) console.log(`[Flash] ⚡ Pull terminé — ${totalItemsPulled} éléments mis à jour`);

    // ── LIVE UI REFRESH après pull (silencieux, sans flash) ──
    if (hasChanges) {
      try {
        const page = window.Router?.currentPage;
        if (page && page !== 'login' && page !== 'onboarding' && page !== 'pos' && page !== 'settings') {
          if (window._invalidateDashCache) window._invalidateDashCache();
          _silentRefreshPage(page, []);
        }
      } catch (e) { /* silencieux */ }
    }

    // Tracking désactivé — table pull_tracking non présente dans Supabase client
    // (supprimé pour éviter les erreurs silencieuses en prod)

    // Final refresh of display if settings were updated
    if (window.updatePharmacyDisplay) {
      await window.updatePharmacyDisplay();
    }

    // Si le POS est ouvert ET pull MANUEL uniquement → rafraîchir les données produits
    // JAMAIS en auto-pull : le rechargement perturbe le travail du caissier
    if (isManual && window.location.hash === '#pos' && typeof refreshPOSData === 'function') {
      await refreshPOSData();
    }


  } catch (e) {
    const msg = e?.message || '';
    const isNetErr = msg.includes('probe_offline') || msg.includes('network_offline') ||
      msg.includes('network offline') || msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') || msg.includes('network error') ||
      msg.includes('ERR_') || msg.includes('timeout');
    // Erreurs réseau : silencieuses — comportement normal en mode offline
    if (!isNetErr) {
      console.warn('[Flash] Pull inattendu:', msg || e);
    }
    throw e; // Re-throw pour que runPull.catch() capte et planifie le retry
  } finally {
    clearTimeout(_pullLockTimeout);
    _isPulling = false;
    _isSystemOp = false;
  }
}

/**
 * FORCE SYNC: Re-mark everything as pending and push to cloud
 */
async function forceSyncAll() {
  const stores = [
    'products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders',
    'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
    'cashRegister', 'auditLog', 'users', 'settings', 'returns', 'prep_transfers'
  ];

  // Un forceSync manuel signifie souvent qu'un admin vient de corriger le schéma
  // Supabase (table créée, colonne ajoutée) : on redonne sa chance aux tables/colonnes
  // précédemment mises en cache comme "absentes" plutôt que de les ignorer à vie.
  localStorage.removeItem('pharma_missing_tables');
  localStorage.removeItem('pharma_bad_columns');

  let totalMarked = 0;
  console.log('[Flash] 🔄 Force sync: marquage de tous les items...');

  for (const s of stores) {
    const all = await dbGetAll(s);
    if (all.length === 0) continue;

    // Marquer _synced: false par chunks de 10k
    const marked = all.map(item => ({ ...item, _synced: false, _updatedAt: item._updatedAt || Date.now() }));
    const chunkSize = 10000;
    for (let i = 0; i < marked.length; i += chunkSize) {
      await dbBulkPut(s, marked.slice(i, i + chunkSize));
    }
    totalMarked += all.length;
    console.log(`[Flash] ✅ ${s}: ${all.length} items marqués pour sync`);
  }

  console.log(`[Flash] 🚀 ${totalMarked} items au total, lancement du push...`);
  return syncToSupabase();
}

/**
 * AUTO-BACKUP : Sauvegarde automatique locale (localStorage) et périodique
 * - Backup silencieux dans localStorage toutes les 30 minutes
 * - Structure : pharma_backup_<date> = JSON de toutes les données
 */
async function autoBackupToStorage() {
  try {
    const stores = [
      'products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders',
      'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
      'cashRegister', 'auditLog', 'users', 'settings', 'returns', 'prep_transfers',
      'inventories', 'inventoryAdjustments'
    ];

    const backup = {
      version: window.APP_VERSION || '9.4.1',
      exportedAt: new Date().toISOString(),
      exportedBy: AppState.currentUser?.name || 'Système',
      pharmacy: null,
      data: {}
    };

    for (const s of stores) {
      backup.data[s] = await dbGetAll(s);
    }

    // Récupérer le nom de la pharmacie pour le backup
    const settings = backup.data.settings || [];
    backup.pharmacy = settings.find(s => s.key === 'pharmacy_name')?.value || 'OrdiveX';

    // Stocker dans localStorage (backup silencieux)
    const key = `pharma_auto_backup_${new Date().toISOString().split('T')[0]}`;
    const json = JSON.stringify(backup);
    // Vérifier que la taille ne dépasse pas 4 MB (limite localStorage ~5-10 MB)
    if (json.length > 4 * 1024 * 1024) {
      // Base volumineuse : stockage cloud uniquement si on est en ligne
      localStorage.setItem('pharma_last_backup', new Date().toISOString());
      return backup;
    }
    localStorage.setItem(key, json);
    localStorage.setItem('pharma_last_backup', new Date().toISOString());

    // Nettoyer les vieux backups (garder seulement les 7 derniers jours)
    const keysToDelete = Object.keys(localStorage)
      .filter(k => k.startsWith('pharma_auto_backup_'))
      .sort()
      .reverse()
      .slice(7);
    keysToDelete.forEach(k => localStorage.removeItem(k));

    console.log('[Backup] ✅ Sauvegarde automatique effectuée:', key);
    return backup;
  } catch (e) {
    console.warn('[Backup] Échec backup automatique:', e);
    return null;
  }
}

/**
 * BACKUP MANUEL : Télécharge un fichier JSON complet (déclenché par bouton)
 */
async function doBackup() {
  try {
    const backup = await autoBackupToStorage();
    if (!backup) throw new Error('Échec de la génération du backup');

    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `OrdiveX_backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (window.UI) UI.toast('Sauvegarde téléchargée avec succès', 'success');
    writeAudit('BACKUP_DOWNLOADED', 'system', null, { filename: a.download, size: json.length });
    return true;
  } catch (e) {
    console.error('[Backup] Erreur export manuel:', e);
    if (window.UI) UI.toast('Erreur lors de la sauvegarde : ' + e.message, 'error');
    return false;
  }
}

/**
 * DÉMARRAGE AUTO-BACKUP : Lance le backup automatique périodique
 * Appelé une fois au démarrage de l'app
 */
function startAutoBackup() {
  // Helper : exécuter en arrière-plan quand le navigateur est libre
  var _idle = typeof requestIdleCallback === 'function'
    ? function (fn) { requestIdleCallback(fn, { timeout: 5000 }); }
    : function (fn) { setTimeout(fn, 100); };

  // Backup initial au démarrage (après 60s pour laisser le pull finir d'abord)
  setTimeout(function () {
    _idle(function () { autoBackupToStorage(); });
  }, 60000);

  // Backup toutes les 30 minutes — toujours en idle
  setInterval(function () {
    _idle(function () {
      autoBackupToStorage();
      if (AppState.isOnline) {
        syncToSupabase().catch(function () { });
      }
    });
  }, 30 * 60 * 1000);

  // Demarrer la file d attente persistante (OperationQueue)
  if (window.OperationQueue && typeof window.OperationQueue.start === 'function') {
    window.OperationQueue.start();
  } else {
    // Retry apres chargement complet si queue.js pas encore charge
    window.addEventListener('load', function() {
      if (window.OperationQueue) window.OperationQueue.start();
    });
  }

  console.log('[Backup] Auto-backup demarre (toutes les 30 min)');
}

let _autoPullTimer = null;
let _pullFailCount = 0;
/**
 * AUTO-PULL : Synchronisation cloud → local automatique
 * - Utilise des callbacks purs (pas d'async/await) pour éviter
 *   l'accumulation de traces asynchrones dans Chrome DevTools
 * - Après 2 échecs consécutifs → silence total pendant 5 min
 * - Reset instantané dès qu'un pull réussit ou que 'online' se déclenche
 */
function startAutoPull() {
  console.log('[NM] Auto-pull géré par le central NetworkManager');
  
  // Exposer les fonctions attendues par les autres composants
  window._triggerAutoPull = function() {
    if (window.NM && typeof window.NM.requestPull === 'function') {
      window.NM.requestPull();
    }
  };
}

/**
 * RESTAURATION SÉCURISÉE "ZERO LOSS"
 * Procédure : Backup de secours auto -> Backup localStorage -> Wipe -> Restore -> Audit
 */
async function restoreFromBackup(backupData) {
  try {
    _restoreInProgress = true;
    // 1. PHASE DE PRÉSERVATION (Auto-download de l'état actuel)
    console.log('[Restore] 🛡️ Phase 1 : Sauvegarde de secours automatique...');
    await doBackup();

    // 2. PHASE D'URGENCE (Copie en localStorage)
    console.log('[Restore] 🛡️ Phase 2 : Copie d\'urgence en localStorage...');
    const emergencyBackup = await autoBackupToStorage();
    if (emergencyBackup) {
      localStorage.setItem('pharma_emergency_restore', JSON.stringify(emergencyBackup));
    }

    // 3. PHASE DE VALIDATION DU FICHIER
    console.log('[Restore] 🛡️ Phase 3 : Validation du fichier...');
    if (!backupData || typeof backupData !== 'object') throw new Error('Données de sauvegarde invalides');

    // Support des deux formats (ancien _exportDate et nouveau exportedAt)
    const isPharmaBackup = backupData.data || backupData.products;
    if (!isPharmaBackup) throw new Error('Ce fichier ne semble pas être une sauvegarde OrdiveX valide.');

    // 4. PHASE DE NETTOYAGE (Wipe)
    console.log('[Restore] 🛡️ Phase 4 : Nettoyage de la base de données locale...');
    const storesToClear = [
      'products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders',
      'sales', 'saleItems', 'patients', 'prescriptions', 'alerts',
      'cashRegister', 'auditLog', 'settings', 'returns', 'prep_transfers',
      'inventories', 'inventoryAdjustments'
    ];

    const db = await initDB();
    for (const storeName of storesToClear) {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    // 5. PHASE D'INJECTION
    console.log('[Restore] 🛡️ Phase 5 : Injection des nouvelles données...');
    const dataToImport = backupData.data || backupData; // Gère les deux structures de backup possible

    for (const storeName of storesToClear) {
      const items = dataToImport[storeName];
      if (items && Array.isArray(items) && items.length > 0) {
        // Marquer chaque item comme non-synchronisé pour le push Supabase
        const markedItems = items.map(item => ({
          ...item,
          _synced: false,
          _updatedAt: item._updatedAt || Date.now()
        }));
        // Découpage en lots (chunks) de 10 000 pour éviter de bloquer l'interface
        const chunkSize = 10000;
        for (let i = 0; i < markedItems.length; i += chunkSize) {
          const chunk = markedItems.slice(i, i + chunkSize);
          await dbBulkPut(storeName, chunk);
        }
      }
    }

    // 6. PHASE D'AUDIT ET FINALISATION
    console.log('[Restore] ✅ Restauration terminée avec succès.');
    await writeAudit('RESTORE_ZERO_LOSS', 'system', null, {
      timestamp: Date.now(),
      version: backupData.version || 'unknown'
    });

    _restoreInProgress = false;
    return { success: true };
  } catch (e) {
    _restoreInProgress = false;
    console.error('[Restore] ❌ Erreur critique lors de la restauration:', e);
    throw e;
  }
}

function resetSupabaseClient() {
  if (_supabaseInstance) {
    try { _supabaseInstance.auth?.stopAutoRefresh?.(); } catch (e) { }
    try { _supabaseInstance.realtime?.disconnect?.(); } catch (e) { }
    try { if (_realtimeSubscription) { _supabaseInstance.removeChannel(_realtimeSubscription).catch(() => { }); _realtimeSubscription = null; } } catch (e) { }
    try { if (_broadcastChannel) { _supabaseInstance.removeChannel(_broadcastChannel).catch(() => { }); _broadcastChannel = null; } } catch (e) { }
  }
  // NE PAS mettre _supabaseInstance = null — cela provoque des recréations multiples
  // (Multiple GoTrueClient) à chaque tentative de reconnexion.
}

// (Error silencer déplacé en haut du fichier pour intercepter dès le chargement)

window.addEventListener('error', function (event) {
  var msg = event.message || '';
  if (msg.indexOf('ERR_INTERNET') !== -1 || msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1 || msg.indexOf('net::ERR_') !== -1) return;
  // Ne pas afficher de toast pour les erreurs de scripts externes (CDN/Supabase)
  if (event.filename && (event.filename.indexOf('supabase') !== -1 || (!event.filename.includes(location.hostname) && !event.filename.includes('localhost')))) return;
  if (window.UI && UI.toast) {
    UI.toast('Erreur système détectée — L\'application continue de fonctionner', 'warning', 3000);
  }
});

window.addEventListener('unhandledrejection', function (event) {
  var msg = String(event.reason?.message || event.reason || '');
  // Silencer TOUTES les erreurs réseau, auth, et ServiceWorker — comportement normal en PWA offline
  var noisePatterns = [
    'ERR_INTERNET', 'Failed to fetch', 'NetworkError', 'net::ERR_',
    'refresh_token', 'ServiceWorker', 'service worker', 'An unknown error',
    'AuthRetryable', 'Lock', 'AuthSessionMissing', 'Auth session missing',
    'Unauthorized', '401', '400', 'Bad Request', 'CORS', 'AbortError',
    'Load failed', 'The user aborted', 'CHANNEL_ERROR', 'WebSocket',
    'signInAnonymously', 'Failed to decode'
  ];
  for (var i = 0; i < noisePatterns.length; i++) {
    if (msg.indexOf(noisePatterns[i]) !== -1) { event.preventDefault(); return; }
  }
  event.preventDefault();
});

// Protection IndexedDB — reconnexion automatique si la connexion est perdue
if (typeof indexedDB !== 'undefined') {
  const _origTransaction = IDBDatabase.prototype.transaction;
  // On ne surcharge pas pour garder la stabilité, mais on surveille
  window.addEventListener('beforeunload', () => {
    if (db) { try { db.close(); } catch (e) { } }
  });
}

// La gestion de connectivité est centralisée et gérée par NetworkManager.
// Plus de listeners online/offline ou d'écriture brute sur le Service Worker ici.

// ── Vérification du stockage disponible (Lot 2 hardening — F32) ──
// Utilisé avant un import volumineux (CSV produits/patients) pour avertir
// PRÉVENTIVEMENT plutôt que de découvrir un QuotaExceededError en cours de
// route, lot après lot. Best-effort : navigator.storage.estimate() n'est
// pas disponible sur tous les navigateurs (ex: Safari ancien) — dans ce cas
// on renvoie simplement "inconnu", jamais une fausse alerte.
async function checkStorageHealth() {
  try {
    if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
      return { available: false, percentUsed: null, usageMB: null, quotaMB: null };
    }
    const { usage, quota } = await navigator.storage.estimate();
    const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : null;
    return {
      available: true,
      percentUsed,
      usageMB: Math.round((usage || 0) / 1048576),
      quotaMB: Math.round((quota || 0) / 1048576)
    };
  } catch (e) {
    return { available: false, percentUsed: null, usageMB: null, quotaMB: null };
  }
}

const _DBExports = { initDB, dbAdd, dbPut, dbBulkPut, dbTransactionBulk, dbGet, dbGetAll, dbGetRecent, dbGetByKey, dbSearchProducts, dbCountProducts, dbDelete, dbCount, dbStockValue, writeAudit, seedDemoData, syncToSupabase, pullFromSupabase, _internalSyncToSupabase, _internalPullFromSupabase, resetSupabaseClient, forceSyncAll, trackInstallation, getSupabaseClient, STORES, AppState, doBackup, startAutoBackup, startAutoPull, autoBackupToStorage, restoreFromBackup, _generateSyncSafeId, detectOrphanSales, checkStorageHealth };
Object.defineProperty(_DBExports, '_isPulling', { get: () => _isPulling });
Object.defineProperty(_DBExports, '_isSystemOp', { get: () => _isSystemOp, set: (v) => { _isSystemOp = !!v; } });
window.DB = _DBExports;
