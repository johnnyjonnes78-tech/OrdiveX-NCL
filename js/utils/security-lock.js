/**
 * OrdiveX — Gestionnaire de verrouillage automatique de session par inactivité
 */

const SecurityLock = {
  _timer: null,
  _timeoutMs: 0,
  _enabled: false,

  async init() {
    this.setupListeners();
    await this.reloadConfig();
  },

  async reloadConfig() {
    const user = DB.AppState.currentUser;
    if (!user) {
      this.stop();
      return;
    }

    const settings = await DB.dbGetAll('settings');
    const enabledKey = `security_lock_enabled_${user.id}`;
    const timeoutKey = `security_lock_timeout_${user.id}`;

    const enabledSetting = settings.find(s => s.key === enabledKey);
    const timeoutSetting = settings.find(s => s.key === timeoutKey);

    // Par défaut : Activé après 15 minutes si non configuré
    this._enabled = enabledSetting ? (enabledSetting.value === 'true') : true;
    const timeoutMin = timeoutSetting ? (parseInt(timeoutSetting.value) || 15) : 15;
    this._timeoutMs = timeoutMin * 60 * 1000;

    if (this._enabled && this._timeoutMs > 0) {
      this.start();
    } else {
      this.stop();
    }
  },

  start() {
    this.stop();
    if (!this._enabled || this._timeoutMs <= 0) return;
    
    this._timer = setTimeout(() => {
      this.lockSession();
    }, this._timeoutMs);
  },

  stop() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  },

  resetTimer() {
    if (this._enabled && this._timeoutMs > 0) {
      this.start();
    }
  },

  setupListeners() {
    const events = ['mousemove', 'mousedown', 'click', 'keydown', 'touchstart', 'scroll'];
    const handler = () => {
      this.resetTimer();
    };

    events.forEach(evt => {
      window.addEventListener(evt, handler, { passive: true });
    });
  },

  async lockSession() {
    this.stop();
    if (DB.AppState.currentUser) {
      console.log('[SecurityLock] Inactivité détectée. Verrouillage automatique...');
      if (typeof window._showLockScreen === 'function') {
        window._showLockScreen();
      } else {
        Auth.logout();
      }
    }
  }
};

window.SecurityLock = SecurityLock;
