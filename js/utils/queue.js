/**
 * OrdiveX - OperationQueue v1.0
 * File d attente persistante (IndexedDB) pour les operations offline
 *
 * Principe :
 *   - Toute operation critique (vente, mouvement stock, paiement)
 *     est d abord ecrite dans la file AVANT d etre envoyee a Supabase.
 *   - Si l application se ferme brutalement, la file est relue au
 *     prochain demarrage et les operations sont reenvoyees.
 *   - Chaque operation a un statut : pending / processing / done / error
 *   - Integre avec le backoff exponentiel existant dans db.js
 */

const OperationQueue = (function () {

  const STORE_NAME = 'syncQueue';
  const MAX_RETRIES = 5;
  const BACKOFF = [1000, 2000, 5000, 10000, 30000]; // delais entre retries

  // Ouvre la base IDB via la fonction centrale db.js
  function _getDB() {
    if (window.DB && typeof window.DB.initDB === 'function') {
      return window.DB.initDB();
    }
    return Promise.reject(new Error('[Queue] DB non initialise'));
  }

  // Ecrire une operation dans la file
  async function enqueue(type, payload, meta) {
    meta = meta || {};
    const db = await _getDB();
    return new Promise(function (resolve, reject) {
      const tx = db.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const op = {
        id: 'op_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        type: type,
        payload: payload,
        meta: meta,
        status: 'pending',
        retries: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      var req = store.add(op);
      req.onsuccess = function () { resolve(op); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // Lire toutes les operations en attente ou en erreur
  async function getPending() {
    const db = await _getDB();
    return new Promise(function (resolve, reject) {
      var results = [];
      var tx = db.transaction([STORE_NAME], 'readonly');
      var store = tx.objectStore(STORE_NAME);
      var req = store.openCursor();
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor) { resolve(results); return; }
        var op = cursor.value;
        if (op.status === 'pending' || op.status === 'error') {
          if (op.retries < MAX_RETRIES) results.push(op);
        }
        cursor.continue();
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  // Mettre a jour le statut d une operation
  async function updateStatus(id, status, error) {
    const db = await _getDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction([STORE_NAME], 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var getReq = store.get(id);
      getReq.onsuccess = function () {
        var op = getReq.result;
        if (!op) { resolve(); return; }
        op.status = status;
        op.updatedAt = Date.now();
        if (error) op.lastError = String(error);
        if (status === 'error') op.retries = (op.retries || 0) + 1;
        var putReq = store.put(op);
        putReq.onsuccess = function () { resolve(); };
        putReq.onerror = function () { reject(putReq.error); };
      };
      getReq.onerror = function () { reject(getReq.error); };
    });
  }

  // Supprimer les operations terminees (nettoyage)
  async function cleanDone() {
    const db = await _getDB();
    return new Promise(function (resolve) {
      var tx = db.transaction([STORE_NAME], 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var req = store.openCursor();
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (!cursor) { resolve(); return; }
        var op = cursor.value;
        // Supprimer les done (garder les 24h de securite) et les error definitives
        var isDone = op.status === 'done' && (Date.now() - op.updatedAt > 86400000);
        var isDeadLetter = op.status === 'error' && op.retries >= MAX_RETRIES;
        if (isDone || isDeadLetter) {
          cursor.delete();
        }
        cursor.continue();
      };
      req.onerror = function () { resolve(); }; // silencieux
    });
  }

  // Compter les operations en attente (pour le badge UI)
  async function countPending() {
    var ops = await getPending();
    return ops.length;
  }

  // ─────────────────────────────────────────────────
  // PROCESSEUR PRINCIPAL
  // Lance le traitement de la file quand on revient en ligne
  // ─────────────────────────────────────────────────
  var _processing = false;

  async function process() {
    if (_processing) return;
    const isOnline = window.NM && typeof window.NM.isOnline === 'function' ? window.NM.isOnline() : navigator.onLine;
    if (!isOnline) return;

    _processing = true;

    try {
      var ops = await getPending();
      if (!ops.length) { _processing = false; return; }

      console.log('[Queue] ' + ops.length + ' operation(s) en attente - traitement...');

      for (var i = 0; i < ops.length; i++) {
        var op = ops[i];

        // Attendre le delai de backoff si c est un retry
        if (op.retries > 0) {
          var delay = BACKOFF[Math.min(op.retries - 1, BACKOFF.length - 1)];
          await new Promise(function (r) { setTimeout(r, delay); });
        }

        // Verifier qu on est toujours en ligne avant chaque operation
        const stillOnline = window.NM && typeof window.NM.isOnline === 'function' ? window.NM.isOnline() : navigator.onLine;
        if (!stillOnline) break;

        try {
          await updateStatus(op.id, 'processing');
          await _executeOperation(op);
          await updateStatus(op.id, 'done');
          console.log('[Queue] OK: ' + op.type + ' (' + op.id + ')');
        } catch (err) {
          await updateStatus(op.id, 'error', err && err.message ? err.message : String(err));
          console.warn('[Queue] Echec: ' + op.type + ' (retry ' + (op.retries + 1) + '/' + MAX_RETRIES + ')');
          
          // Vérifier si le réseau a été coupé suite à cet échec, et arrêter la boucle si oui
          const checkOnline = window.NM && typeof window.NM.isOnline === 'function' ? window.NM.isOnline() : navigator.onLine;
          if (!checkOnline) {
            console.log('[Queue] Réseau déconnecté détecté pendant l\'exécution -> arrêt immédiat de la file.');
            break;
          }
        }
      }

      // Nettoyer les ops terminees en arriere-plan
      cleanDone().catch(function () {});

    } catch (err) {
      console.warn('[Queue] Erreur processeur:', err && err.message ? err.message : err);
    } finally {
      _processing = false;
    }
  }

  // Execute une operation selon son type
  async function _executeOperation(op) {
    switch (op.type) {
      case 'SYNC_STORE':
        // Declenche un syncToSupabase cible sur le store concerne
        if (window.DB && typeof window.DB.syncToSupabase === 'function') {
          // Utilise _internalSyncToSupabase si disponible pour contourner les guards
          const syncFn = window.DB._internalSyncToSupabase || window.DB.syncToSupabase;
          await syncFn(op.payload && op.payload.store ? [op.payload.store] : null);
        }
        break;

      default:
        // Type inconnu : on marque done pour ne pas bloquer
        console.warn('[Queue] Type inconnu ignore:', op.type);
    }
  }

  // ─────────────────────────────────────────────────
  // DEMARRAGE AUTO
  // ─────────────────────────────────────────────────
  function start() {
    // Exposer l'ancien trigger pour compatibilité de signature
    window._triggerQueueProcess = function() {
      if (window.NM && typeof window.NM.requestSync === 'function') {
        window.NM.requestSync();
      } else {
        setTimeout(process, 2000);
      }
    };

    // Nettoyage periodique des ops mortes (toutes les heures)
    setInterval(cleanDone, 3600000);

    console.log('[Queue] File d attente operationnelle');
  }

  return {
    enqueue: enqueue,
    getPending: getPending,
    updateStatus: updateStatus,
    countPending: countPending,
    process: process,
    cleanDone: cleanDone,
    start: start
  };

})();

window.OperationQueue = OperationQueue;
