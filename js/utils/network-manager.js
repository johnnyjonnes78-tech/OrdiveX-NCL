/**
 * OrdiveX - NetworkManager v2.0
 * Gestionnaire réseau centralisé avec détection OFFLINE immédiate,
 * classification intelligente des erreurs, Circuit Breaker et Mutex global.
 */

(function () {
  const NetworkState = {
    OFFLINE: 'OFFLINE',
    CONNECTING: 'CONNECTING',
    ONLINE: 'ONLINE',
    SYNCING: 'SYNCING',
    RETRYING: 'RETRYING'
  };

  // ─── Mutex async (Exclusion Mutuelle) ───────────────────────────────────────
  class Mutex {
    constructor() {
      this._queue = [];
      this._locked = false;
    }

    async run(job) {
      if (this._locked) {
        return new Promise((resolve, reject) => {
          this._queue.push({ job, resolve, reject });
        });
      }
      this._locked = true;
      try {
        return await job();
      } finally {
        this._locked = false;
        if (this._queue.length > 0) {
          const next = this._queue.shift();
          setTimeout(() => this.run(next.job).then(next.resolve).catch(next.reject), 0);
        }
      }
    }

    // Vider toutes les opérations en attente (appelé lors de la transition offline)
    flush() {
      const pending = this._queue.splice(0);
      for (const item of pending) {
        try { item.reject(new Error('network_offline')); } catch (e) {}
      }
    }
  }

  // ─── Classification des erreurs ─────────────────────────────────────────────
  function _isNetworkError(errStr) {
    // Erreurs indiquant une absence de connectivité réseau RÉELLE
    const networkPatterns = [
      'ERR_NAME_NOT_RESOLVED',
      'ERR_INTERNET_DISCONNECTED',
      'ERR_NETWORK_CHANGED',
      'ERR_CONNECTION_REFUSED',
      'ERR_CONNECTION_TIMED_OUT',
      'ERR_CONNECTION_RESET',
      'net::ERR_',
      'Failed to fetch',
      'NetworkError',
      'Load failed',         // Safari
      'ENOTFOUND',
      'network error',
      'offline',
      'aborted',             // Requêtes annulées lors du passage offline
      'AbortError',
    ];
    return networkPatterns.some(p => errStr.toLowerCase().includes(p.toLowerCase()));
  }

  function _isServerError(errStr, status) {
    // Supabase temporairement indisponible, mais réseau OK
    if (status === 503 || status === 502) return true;
    return errStr.includes('503') || errStr.includes('502');
  }

  function _isAuthError(errStr, status) {
    // Problème d'authentification, pas de connectivité
    if (status === 401 || status === 403) return true;
    return errStr.includes('401') || errStr.includes('403') || errStr.includes('PGRST301');
  }

  // ─── NetworkManager ─────────────────────────────────────────────────────────
  class NetworkManager {
    constructor() {
      this.state = NetworkState.OFFLINE;
      this.consecutiveFailures = 0;
      this.lastSuccessTime = 0;
      this.lastCommunicationTime = 0;
      this.lastError = '';
      this._retryTimer = null;
      this._reconnectAttempts = 0;
      this._probing = false; // Verrou anti-probes concurrents
      this._mutex = new Mutex();
      this._syncCoalescePending = false;
      this._pullCoalescePending = false;
      this._lastLogMessages = {};
      this._offlineLogged = false;

      // Backoff exponentiel : 2s → 5s → 10s → 20s → 30s → 60s → 120s → 300s
      this._backoffDelays = [2000, 5000, 10000, 20000, 30000, 60000, 120000, 300000];

      // Liaison avec les événements OS réseau
      window.addEventListener('online',  () => this._onOsOnline());
      window.addEventListener('offline', () => this._onOsOffline());

      // Réveil immédiat et automatique de la veille hors-ligne uniquement lorsque l'OS
      // signale un changement matériel de connexion via navigator.connection
      if (navigator.connection) {
        navigator.connection.addEventListener('change', () => {
          if (navigator.onLine) {
            console.log('[NM] Signal matériel de connexion détecté (connection.change) → tentative de réactivation...');
            this.consecutiveFailures = 0;
            this._reconnectAttempts = 0;
            this._offlineLogged = false;
            this._attemptReconnect();
          }
        });
      }

      // Au focus de l'application, simplement rafraîchir visuellement le statut réseau dans l'UI
      // sans lancer de probe réseau physique pour éviter d'inonder la console en cas de hors-ligne long.
      window.addEventListener('focus', () => {
        if (typeof window.updateNetworkStatus === 'function') {
          window.updateNetworkStatus();
        }
      });

      // Démarrage initial : laisser le temps à db.js de s'initialiser proprement
      setTimeout(() => this._startup(), 3000);

      // Auto-pull périodique toutes les 5 minutes s'il est en ligne
      setInterval(() => {
        if (this.isOnline()) {
          this.requestPull();
          console.log('[NM] ⬇️ Pull automatique périodique déclenché');
        }
      }, 5 * 60 * 1000);



      console.log('[NM] Central Network Manager initialisé');
    }

    // ── État ──────────────────────────────────────────────────────────────────

    isOnline() {
      return this.state === NetworkState.ONLINE || this.state === NetworkState.SYNCING;
    }

    // Transition atomique (idempotente)
    transition(newState) {
      if (this.state === newState) return;
      const old = this.state;
      this.state = newState;
      this._logOnce('log', `[NM] État: ${old} ➔ ${newState}`);
      
      if (newState === NetworkState.ONLINE || newState === NetworkState.SYNCING) {
        this._offlineLogged = false; // Réarmer pour la prochaine coupure
      }

      // Toasts UI — UNE SEULE FOIS lors de la perte/retour réel de connexion
      // On ne considère que ONLINE/SYNCING comme "connecté" (pas CONNECTING)
      const wasOnline = old === NetworkState.ONLINE || old === NetworkState.SYNCING;
      const isNowOffline = newState === NetworkState.OFFLINE || newState === NetworkState.RETRYING;
      const isNowOnline = newState === NetworkState.ONLINE;
      const wasOffline = old === NetworkState.OFFLINE || old === NetworkState.RETRYING;

      if (isNowOffline && wasOnline) {
        if (window.UI && typeof window.UI.toast === 'function') {
          window.UI.toast('Connexion perdue. L\'application fonctionne en mode hors-ligne.', 'warning', 5000);
        }
      } else if (isNowOnline && wasOffline) {
        if (window.UI && typeof window.UI.toast === 'function') {
          window.UI.toast('Connexion rétablie. Synchronisation active.', 'success', 3000);
        }
      }

      this._updateHealth();
      this._syncAppState();
    }

    _syncAppState() {
      if (window.DB && window.DB.AppState) {
        // Les getters de AppState lisent déjà window.NM.state — rien à faire
      }
      this._notifySw(this.state === NetworkState.OFFLINE || this.state === NetworkState.RETRYING);
      if (typeof window.updateNetworkStatus === 'function') window.updateNetworkStatus();
    }

    _notifySw(isOffline) {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
          navigator.serviceWorker.controller.postMessage({ type: 'OFFLINE_STATE', offline: isOffline });
        } catch (e) {}
      }
    }

    // ── Démarrage ─────────────────────────────────────────────────────────────

    _startup() {
      if (navigator.onLine) {
        // Ne pas transitionner à CONNECTING — laisser le probe confirmer d'abord
        this._attemptReconnect();
      } else {
        this.transition(NetworkState.OFFLINE);
      }
    }

    // ── Événements OS ─────────────────────────────────────────────────────────

    _onOsOnline() {
      console.log('[NM] Signal réseau OS détecté → vérification immédiate...');
      this._clearRetryTimer();
      this.consecutiveFailures = 0;
      this._reconnectAttempts = 0;
      this._offlineLogged = false;
      
      // Probe immédiat
      this._attemptReconnect();
      
      // Probe de secours après 1.5 seconde au cas où la carte réseau met du temps à acquérir son IP / DNS
      setTimeout(() => {
        if (this.state === NetworkState.OFFLINE || this.state === NetworkState.RETRYING) {
          console.log('[NM] Signal réseau OS (secours 1.5s) → nouvelle tentative de vérification...');
          this._attemptReconnect();
        }
      }, 1500);
    }

    _onOsOffline() {
      // OS confirme la coupure → OFFLINE immédiat, pas de retry (on attend window.online)
      if (this.state === NetworkState.OFFLINE) return;
      console.log('[NM] Réseau OS déconnecté → OFFLINE immédiat.');
      this._clearRetryTimer();
      this.transition(NetworkState.OFFLINE);
      this._shutdownSupabase();
    }

    // ── Gestion des erreurs réseau (appeléé depuis le fetch interceptor) ──────

    /**
     * Doit être appelé pour TOUTE erreur sur une requête Supabase.
     * @param {Error|string} error
     * @param {number|null} httpStatus
     */
    handleFetchFailure(error, httpStatus) {
      const errStr = error ? String(error.message || error) : 'Erreur réseau';
      this.lastError = errStr;

      // ── GUARD: Si on est déjà offline/retrying, ignorer silencieusement ──
      // Les requêtes Supabase en vol qui échouent après la détection initiale
      // ne doivent PAS re-déclencher le cycle de reconnexion.
      if (this.state === NetworkState.RETRYING || this.state === NetworkState.OFFLINE) {
        return;
      }

      // 1. Erreurs d'authentification ou de ressource → pas de changement d'état réseau
      if (_isAuthError(errStr, httpStatus)) {
        this._logOnce('warn', `[NM] Erreur auth Supabase (ignorée pour état réseau): ${errStr.substring(0, 80)}`);
        return;
      }

      // 2. Serveur Supabase temporairement down (503/502) → réseau OK, pas de OFFLINE
      if (_isServerError(errStr, httpStatus)) {
        this._logOnce('warn', `[NM] Supabase temporairement indisponible (503/502) — réseau fonctionnel.`);
        return;
      }

      // 3. Erreur réseau réelle → OFFLINE immédiat
      if (_isNetworkError(errStr)) {
        this._goOfflineFromNetworkError(errStr);
        return;
      }

      // 4. Autre erreur inconnue → Circuit Breaker progressif
      this.consecutiveFailures++;
      this._logOnce('warn', `[NM] Erreur Supabase non-réseau (${this.consecutiveFailures}/3): ${errStr.substring(0, 80)}`);
      if (this.consecutiveFailures >= 3) {
        this._logOnce('warn', '[NM] Circuit Breaker ouvert → suspension temporaire.');
        this.transition(NetworkState.RETRYING);
        this._shutdownSupabase();
        this._scheduleRetry();
      }
    }

    /**
     * Transition immédiate vers OFFLINE sur erreur réseau confirmée.
     */
    _goOfflineFromNetworkError(errStr) {
      // Déjà offline/retrying → simplement incrémenter l'échec, ne pas respammer
      if (this.state === NetworkState.OFFLINE || this.state === NetworkState.RETRYING) {
        this.consecutiveFailures++;
        return;
      }

      this.consecutiveFailures++;
      if (!this._offlineLogged) {
        this._offlineLogged = true;
        const nextDelay = this._backoffDelays[Math.min(this._reconnectAttempts, this._backoffDelays.length - 1)];
        console.warn(`[NM] ⚡ Réseau indisponible — Synchronisation suspendue. Nouvelle tentative dans ${nextDelay / 1000}s.`);
      }

      this._clearRetryTimer();
      this.transition(NetworkState.RETRYING);
      this._shutdownSupabase();
      this._scheduleRetry();
    }

    /**
     * Succès réseau → réinitialiser les compteurs et passer ONLINE.
     */
    handleFetchSuccess() {
      this.lastCommunicationTime = Date.now();
      const wasProblematic = this.consecutiveFailures > 0 ||
        this.state === NetworkState.RETRYING ||
        this.state === NetworkState.OFFLINE;

      this.consecutiveFailures = 0;
      this._offlineLogged = false;

      if (wasProblematic) {
        this._logOnce('log', '[NM] ✅ Connectivité restaurée.');
        this._reconnectAttempts = 0;
      }

      if (this.state === NetworkState.CONNECTING || this.state === NetworkState.RETRYING || this.state === NetworkState.OFFLINE) {
        this.transition(NetworkState.ONLINE);
      }
    }

    // ── Contrôle de l'instance Supabase ──────────────────────────────────────

    _shutdownSupabase() {
      // Vider la file d'opérations en attente (empêche la cascade de setTimeout)
      this._mutex.flush();
      // Couper les WebSockets et les timers de refresh token du SDK Supabase
      if (window.DB && typeof window.DB.resetSupabaseClient === 'function') {
        try { window.DB.resetSupabaseClient(); } catch (e) {}
      }
    }

    // ── Backoff et reconnexion ─────────────────────────────────────────────────

    _clearRetryTimer() {
      if (this._retryTimer) {
        clearTimeout(this._retryTimer);
        this._retryTimer = null;
      }
    }

    _scheduleRetry() {
      this._clearRetryTimer();

      // Si l'OS dit qu'on est offline, ne pas démarrer de timer (on attend window.online)
      if (!navigator.onLine) {
        this.transition(NetworkState.OFFLINE);
        return;
      }

      // ── Limite pour le mode "Sommeil Profond Hors-Ligne" ──
      // Si on a tenté plus de 2 fois sans succès (~7s), on arrête de spammer la console et le réseau.
      // On passe en sommeil profond OFFLINE. On se réveillera si l'OS repasse Online,
      // toutes les 30 minutes via la veille passive, ou sur action utilisateur (sync/mutation).
      if (this._reconnectAttempts >= 2) {
        if (!this._offlineLogged) {
          this._offlineLogged = true;
          console.warn('[NM] 💤 Trop de tentatives échouées. Entrée en mode Sommeil Profond Hors-Ligne pour préserver les ressources.');
        }
        this.transition(NetworkState.OFFLINE);
        return;
      }

      const delay = this._backoffDelays[Math.min(this._reconnectAttempts, this._backoffDelays.length - 1)];
      this._reconnectAttempts++;

      this._retryTimer = setTimeout(() => {
        this._retryTimer = null;
        if (!navigator.onLine) {
          this.transition(NetworkState.OFFLINE);
          return;
        }
        this._attemptReconnect();
      }, delay);
    }

    // ── Probe réseau léger (fetch/HEAD) ──
    // On utilise location.pathname + '?_probe=' pour contourner le cache du Service Worker
    // et interroger le réseau réel de manière ultra-rapide (méthode HEAD, 0 octets transférés).
    _silentProbe() {
      // PRÉ-VÉRIFICATION : Si l'OS confirme qu'il n'y a pas de réseau,
      // retourner false immédiatement SANS faire de fetch.
      // Cela élimine 100% des erreurs rouges Chrome quand le réseau est coupé.
      if (!navigator.onLine) {
        return Promise.resolve(false);
      }

      return new Promise(resolve => {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => { ctrl.abort(); resolve(false); }, 6000);
        
        fetch(location.origin + location.pathname + '?_probe=' + Date.now(), {
          method: 'HEAD',
          cache: 'no-store',
          signal: ctrl.signal
        })
        .then(resp => {
          clearTimeout(timeout);
          // 200 OK ou 304 Not Modified indiquent que le serveur a répondu -> internet OK
          resolve(resp.ok || resp.status === 304);
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve(false);
        });
      });
    }

    async _attemptReconnect() {
      // Verrou : empêcher les probes concurrents
      if (this._probing) return;
      this._probing = true;

      try {
        if (!navigator.onLine) {
          this.transition(NetworkState.OFFLINE);
          return;
        }

        // Probe léger et fiable
        const internetOk = await this._silentProbe();

        if (!internetOk) {
          // Internet pas encore disponible
          if (!this._offlineLogged) {
            this._offlineLogged = true;
            console.warn('[NM] ⚡ Internet indisponible. Mode hors-ligne actif.');
          }
          if (this.state !== NetworkState.RETRYING && this.state !== NetworkState.OFFLINE) {
            this.transition(NetworkState.RETRYING);
          }
          this._scheduleRetry();
          return;
        }

        // ── Internet confirmé — passer directement ONLINE ──
        this.handleFetchSuccess();
        this.lastSuccessTime = Date.now();
        console.log('[NM] ✅ Connectivité internet confirmée.');

        // Réactiver le client Supabase
        try {
          if (window.DB && typeof window.DB.getSupabaseClient === 'function') {
            const sb = await window.DB.getSupabaseClient();
            if (sb && sb.auth?.startAutoRefresh) {
              try { sb.auth.startAutoRefresh(); } catch (e) {}
            }
          }
        } catch (e) {}

        // Déclencher pull + sync après reconnexion
        setTimeout(() => {
          if (!this.isOnline()) return;
          this.requestPull();
          this.requestSync();
        }, 500);

        // Reconnecter les canaux Realtime
        this._reconnectRealtime();

      } finally {
        this._probing = false;
      }
    }

    _reconnectRealtime() {
      setTimeout(async () => {
        // Double vérification : le NM peut avoir re-basculé offline entre-temps
        if (!this.isOnline()) return;
        try {
          if (window.DB && typeof window.DB.getSupabaseClient === 'function') {
            const sb = await window.DB.getSupabaseClient();
            if (sb && this.isOnline()) {
              if (window._setupRealtime) { try { window._setupRealtime(sb); } catch (e) {} }
              if (window._setupBroadcast) { try { window._setupBroadcast(sb); } catch (e) {} }
            }
          }
        } catch (e) {}
      }, 2000);
    }

    // ── Notifications de mutation (dbAdd / dbPut) ────────────────────────────

    notifyMutation(storeName) {
      if (storeName === 'syncQueue' || storeName === 'auditLog') return;

      if (window.OperationQueue && typeof window.OperationQueue.enqueue === 'function') {
        window.OperationQueue.enqueue('SYNC_STORE', { store: storeName })
          .then(() => { this._updateHealth(); this.requestSync(); })
          .catch(() => this.requestSync());
      } else {
        this.requestSync();
      }
    }

    // ── PUSH (Sync montante) ─────────────────────────────────────────────────

    requestSync(isManual = false) {
      // ── Réveil actif du Sommeil Profond sur action manuelle ──
      if (isManual && this.state === NetworkState.OFFLINE && navigator.onLine) {
        console.log('[NM] 🔄 Sync manuelle demandée -> tentative de réveil du mode hors-ligne...');
        this.consecutiveFailures = 0;
        this._reconnectAttempts = 0;
        this._offlineLogged = false;
        this._attemptReconnect();
      }

      if (!isManual && (this.state === NetworkState.OFFLINE || this.state === NetworkState.RETRYING)) return;
      if (this._syncCoalescePending && !isManual) return;
      this._syncCoalescePending = true;

      setTimeout(() => {
        this._syncCoalescePending = false;
        if (!isManual && !this.isOnline()) return;

        this._mutex.run(async () => {
          // Garde : si le NM a basculé offline pendant l'attente en file, ne rien lancer
          if (!isManual && !this.isOnline()) return;
          this.transition(NetworkState.SYNCING);
          try {
            if (window.OperationQueue?.process) await window.OperationQueue.process();
            if (window.DB?._internalSyncToSupabase) await window.DB._internalSyncToSupabase();
            if (this.state === NetworkState.SYNCING) {
              this.lastSuccessTime = Date.now();
              this.consecutiveFailures = 0;
              this.transition(NetworkState.ONLINE);
            }
          } catch (err) {
            this._handleSyncError(err, 'PUSH');
          } finally {
            this._updateHealth();
          }
        });
      }, 2000);
    }

    // ── PULL (Sync descendante) ──────────────────────────────────────────────

    requestPull(isManual = false) {
      // ── Réveil actif du Sommeil Profond sur action manuelle ──
      if (isManual && this.state === NetworkState.OFFLINE && navigator.onLine) {
        console.log('[NM] 🔄 Pull manuel demandé -> tentative de réveil du mode hors-ligne...');
        this.consecutiveFailures = 0;
        this._reconnectAttempts = 0;
        this._offlineLogged = false;
        this._attemptReconnect();
      }

      if (!isManual && (this.state === NetworkState.OFFLINE || this.state === NetworkState.RETRYING)) return;
      if (this._pullCoalescePending && !isManual) return;
      this._pullCoalescePending = true;

      setTimeout(() => {
        this._pullCoalescePending = false;
        if (!isManual && !this.isOnline()) return;

        this._mutex.run(async () => {
          // Garde : si le NM a basculé offline pendant l'attente en file, ne rien lancer
          if (!isManual && !this.isOnline()) return;
          this.transition(NetworkState.SYNCING);
          try {
            if (window.DB?._internalPullFromSupabase) await window.DB._internalPullFromSupabase(isManual);
            if (this.state === NetworkState.SYNCING) {
              this.lastSuccessTime = Date.now();
              this.consecutiveFailures = 0;
              this.transition(NetworkState.ONLINE);
            }
          } catch (err) {
            this._handleSyncError(err, 'PULL');
          } finally {
            this._updateHealth();
          }
        });
      }, isManual ? 0 : 1000);
    }

    _handleSyncError(err, label) {
      const errStr = err?.message || String(err || '');
      if (errStr === 'network_offline' || _isNetworkError(errStr)) {
        this._goOfflineFromNetworkError(errStr);
      } else {
        this._logOnce('warn', `[NM] Erreur ${label}: ${errStr.substring(0, 100)}`);
        if (this.state === NetworkState.SYNCING) {
          this.transition(NetworkState.ONLINE);
        }
      }
    }

    // ── Service NetworkHealth ────────────────────────────────────────────────

    _updateHealth() {
      const health = {
        state: this.state,
        lastSuccessTime: this.lastSuccessTime,
        lastCommunicationTime: this.lastCommunicationTime,
        pendingOpsCount: 0,
        consecutiveFailures: this.consecutiveFailures,
        lastError: this.lastError
      };
      window.NetworkHealth = health;

      if (window.OperationQueue?.countPending) {
        window.OperationQueue.countPending().then(count => {
          window.NetworkHealth.pendingOpsCount = count;
          window.dispatchEvent(new CustomEvent('network-health-change', { detail: window.NetworkHealth }));
        }).catch(() => window.dispatchEvent(new CustomEvent('network-health-change', { detail: window.NetworkHealth })));
      } else {
        window.dispatchEvent(new CustomEvent('network-health-change', { detail: window.NetworkHealth }));
      }
    }

    // ── Déduplication des logs console ───────────────────────────────────────

    _logOnce(level, msg) {
      const now = Date.now();
      // Supprimer les messages identiques dans une fenêtre de 30s
      if (this._lastLogMessages[msg] && (now - this._lastLogMessages[msg]) < 30000) return;
      this._lastLogMessages[msg] = now;
      if (level === 'warn') console.warn(msg);
      else console.log(msg);
    }
  }

  // ─── Instanciation globale ───────────────────────────────────────────────────
  window.NM = new NetworkManager();
  window.NetworkState = NetworkState;

  window.NetworkHealth = {
    state: NetworkState.OFFLINE,
    lastSuccessTime: 0,
    lastCommunicationTime: 0,
    pendingOpsCount: 0,
    consecutiveFailures: 0,
    lastError: ''
  };
})();
