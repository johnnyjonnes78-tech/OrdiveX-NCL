/**
 * OrdiveX — DevTools Guard v9.4.6
 * Bloque l'acces aux outils developpeur pour les utilisateurs finaux
 * 
 * ACTIVATION LOCALE : localStorage.setItem('ordivex_production_mode', 'true')
 * ACTIVATION DISTANCE : Dans Supabase > table "settings" > inserer :
 *   key = 'production_mode', value = 'true'
 *   Tous les appareils l'activeront au prochain pull automatique.
 * 
 * DESACTIVATION : Meme procedure avec value = 'false'
 * Par defaut : DESACTIVE (mode developpement/test)
 * Ce fichier est 100% autonome — il ne modifie AUCUNE variable/fonction existante
 */
(function () {
  'use strict';

  // ── SECURITE : tout est wrappe pour ne JAMAIS crasher l'app ──
  try {

    // Cache local du mode production (evite les lectures IndexedDB repetees)
    var _prodModeCache = null;
    var _prodModeCacheTime = 0;

    // Verifier si le mode production est active (localStorage OU IndexedDB)
    function _isProductionMode() {
      try {
        // Source 1 : localStorage (reponse instantanee)
        var local = localStorage.getItem('ordivex_production_mode');
        if (local === 'true') return true;
        if (local === 'false') return false;

        // Source 2 : Cache IndexedDB (mis a jour toutes les 30s)
        if (_prodModeCache !== null) return _prodModeCache;

        return false; // Par defaut : desactive
      } catch (e) {
        return false;
      }
    }

    // Lire le setting depuis IndexedDB (async, met a jour le cache)
    function _refreshFromIndexedDB() {
      try {
        var request = indexedDB.open('OrdiveXDB');
        request.onsuccess = function (e) {
          try {
            var db = e.target.result;
            if (!db.objectStoreNames.contains('settings')) { db.close(); return; }
            var tx = db.transaction('settings', 'readonly');
            var store = tx.objectStore('settings');
            var get = store.get('production_mode');
            get.onsuccess = function () {
              if (get.result && get.result.value) {
                var val = String(get.result.value).toLowerCase();
                _prodModeCache = (val === 'true' || val === '1');
                _prodModeCacheTime = Date.now();
                // Synchroniser avec localStorage pour les prochains checks rapides
                if (_prodModeCache) {
                  try { localStorage.setItem('ordivex_production_mode', 'true'); } catch (e) { }
                }
              }
              db.close();
            };
            get.onerror = function () { db.close(); };
          } catch (e) { }
        };
        request.onerror = function () { };
      } catch (e) { }
    }

    // Rafraichir depuis IndexedDB au demarrage puis toutes les 30s
    _refreshFromIndexedDB();
    setInterval(_refreshFromIndexedDB, 30000);

    // ═══════════════════════════════════════════════════════════════
    // 1. BLOQUER LES RACCOURCIS CLAVIER DevTools
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('keydown', function (e) {
      if (!_isProductionMode()) return;

      // F12 — Ouvrir DevTools
      if (e.key === 'F12') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+I — Inspecter
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+J — Console
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+C — Selecteur d'elements
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+U — Voir le code source
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);

    // ═══════════════════════════════════════════════════════════════
    // 2. DESACTIVER LE CLIC DROIT (menu "Inspecter")
    // ═══════════════════════════════════════════════════════════════
    document.addEventListener('contextmenu', function (e) {
      if (!_isProductionMode()) return;
      e.preventDefault();
      return false;
    }, true);

    // ═══════════════════════════════════════════════════════════════
    // 3. DETECTION DevTools OUVERT (fallback si contournement)
    // ═══════════════════════════════════════════════════════════════
    var _devtoolsWarned = false;
    function _checkDevTools() {
      if (!_isProductionMode()) return;
      var t0 = performance.now();
      (function () {}).constructor('debugger')();
      var t1 = performance.now();
      if (t1 - t0 > 100 && !_devtoolsWarned) {
        _devtoolsWarned = true;
        if (window.UI && UI.toast) {
          UI.toast('Acces non autorise aux outils developpeur', 'warning', 5000);
        }
        setTimeout(function () { _devtoolsWarned = false; }, 30000);
      }
    }
    setInterval(_checkDevTools, 3000);

    // ═══════════════════════════════════════════════════════════════
    // 4. VIDER LA CONSOLE (si quelqu'un arrive a l'ouvrir)
    // ═══════════════════════════════════════════════════════════════
    setInterval(function () {
      if (!_isProductionMode()) return;
      try { console.clear(); } catch (e) { }
    }, 2000);

  } catch (e) {
    // Si QUOI QUE CE SOIT echoue, on ne fait RIEN
  }
})();
