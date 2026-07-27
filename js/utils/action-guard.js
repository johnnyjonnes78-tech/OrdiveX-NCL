/**
 * OrdiveX - Protection Anti-Double-Clic v1.0
 * Empeche qu une action critique soit declenchee deux fois
 */

const ActionGuard = {
  _locks: new Set(),

  /**
   * Execute une action de maniere securisee (une seule fois a la fois)
   * @param {string} key - Identifiant unique de l action
   * @param {Function} fn - Fonction async a executer
   * @param {HTMLElement|null} btn - Bouton a desactiver pendant l execution
   * @param {string} loadingText - Texte a afficher pendant le chargement
   */
  async run(key, fn, btn, loadingText) {
    btn = btn || null;
    loadingText = loadingText || null;

    if (this._locks.has(key)) {
      if (window.UI && UI.toast) UI.toast('Action en cours, veuillez patienter...', 'warning', 2000);
      return null;
    }

    this._locks.add(key);
    var originalContent = btn ? btn.innerHTML : null;
    var originalDisabled = btn ? btn.disabled : null;

    if (btn) {
      btn.disabled = true;
      if (loadingText) {
        btn.innerHTML = '<span class="spinner-sm"></span> ' + loadingText;
      }
    }

    try {
      var result = await fn();
      return result;
    } catch (err) {
      console.error('[ActionGuard] Erreur dans ' + key + ' :', err && err.message ? err.message : err);
      if (window.UI && UI.toast) UI.toast('Une erreur est survenue. Veuillez reessayer.', 'error');
      return null;
    } finally {
      this._locks.delete(key);
      if (btn) {
        btn.disabled = originalDisabled;
        if (loadingText && originalContent) btn.innerHTML = originalContent;
      }
    }
  },

  isLocked: function(key) { return this._locks.has(key); },
  release: function(key) { this._locks.delete(key); }
};

window.ActionGuard = ActionGuard;

(function() {
  if (document.getElementById('action-guard-styles')) return;
  var style = document.createElement('style');
  style.id = 'action-guard-styles';
  style.textContent = '.spinner-sm{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin-sm 0.7s linear infinite;vertical-align:middle;margin-right:4px}@keyframes spin-sm{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
})();
