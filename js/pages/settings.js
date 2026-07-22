/**
 * OrdiveX — Settings, Users, Login
 */

function renderLogin(container) {
  document.getElementById('app-sidebar')?.style.setProperty('display', 'none');
  document.getElementById('app-topbar')?.style.setProperty('display', 'none');
  document.getElementById('app-content').style.marginLeft = '0';
  if (window.hideSupportWidget) hideSupportWidget();
  document.getElementById('app-content').style.paddingTop = '0';

  container.innerHTML = `
    <div class="login-wrapper">
      <div class="login-aside">
        <div class="login-aside-content">
          <div class="login-header">
            <div class="login-logo-elite">
              <i data-lucide="activity"></i>
            </div>
            <h1 class="login-title-elite">Ordive<span>X</span></h1>
            <p class="login-subtitle-elite">L'excellence opérationnelle pour votre officine.</p>
          </div>

          <form id="login-form" class="login-form-elite" onsubmit="handleLogin(event)">
            <div class="input-group-elite">
              <label for="login-username">Identifiant</label>
              <div class="input-wrapper-elite">
                <i data-lucide="user"></i>
                <input type="text" id="login-username" placeholder="votre identifiant" required
                  autocomplete="username" autocorrect="off" autocapitalize="none" spellcheck="false">
              </div>
            </div>
            
            <div class="input-group-elite">
              <label for="login-password">Mot de passe</label>
              <div class="input-wrapper-elite">
                <i data-lucide="lock"></i>
                <input type="password" id="login-password" placeholder="••••••••" required
                  autocomplete="current-password" autocorrect="off" autocapitalize="none"
                  spellcheck="false" inputmode="text">
                <button type="button" id="toggle-password" class="pwd-toggle-btn" onclick="togglePasswordVisibility()" tabindex="-1" aria-label="Afficher le mot de passe" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;padding:6px;color:var(--text-light,#94a3b8);z-index:2;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:color 0.2s ease">
                  <svg id="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg id="eye-off-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                </button>
              </div>
            </div>

            <div id="login-error" class="login-error-elite" style="display:none"></div>

            <button type="submit" class="login-submit-elite" id="login-submit">
              <span>Se connecter</span>
              <i data-lucide="chevron-right"></i>
            </button>
          </form>

        </div>
        
        <div class="login-footer-elite">
          <span class="version-tag">OrdiveX v${window.APP_VERSION || '9.8.6'}</span>
          <div class="network-tag ${(window.NM ? window.NM.isOnline() : navigator.onLine) ? 'online' : 'offline'}">
            <i data-lucide="${(window.NM ? window.NM.isOnline() : navigator.onLine) ? 'wifi' : 'wifi-off'}"></i>
            ${(window.NM ? window.NM.isOnline() : navigator.onLine) ? 'Système synchronisé' : 'Mode hors-ligne'}
          </div>
        </div>
      </div>

      <div class="login-visual">
        <div class="mesh-gradient"></div>
        <div class="visual-content">
          <div class="glass-card">
            <div class="glass-icon"><i data-lucide="shield-check"></i></div>
            <h2>Sécurisez votre pharmacie</h2>
            <ul class="feature-list-elite">
              <li><i data-lucide="check"></i> Traçabilité patient de bout en bout</li>
              <li><i data-lucide="check"></i> Intelligence de gestion de stock</li>
              <li><i data-lucide="check"></i> Conformité DNPM Guinée garantie</li>
              <li><i data-lucide="check"></i> Paiements mobiles intégrés</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  // Ajuster le padding-right de l'input pour ne pas superposer le texte avec le bouton œil
  const pwdInput = document.getElementById('login-password');
  if (pwdInput) pwdInput.style.paddingRight = '48px';
}

// ── Toggle visibilité mot de passe ──
function togglePasswordVisibility() {
  const input = document.getElementById('login-password');
  const eyeIcon = document.getElementById('eye-icon');
  const eyeOffIcon = document.getElementById('eye-off-icon');
  const btn = document.getElementById('toggle-password');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (eyeIcon) eyeIcon.style.display = 'none';
    if (eyeOffIcon) eyeOffIcon.style.display = 'block';
    if (btn) btn.style.color = 'var(--primary, #1b6fae)';
  } else {
    input.type = 'password';
    if (eyeIcon) eyeIcon.style.display = 'block';
    if (eyeOffIcon) eyeOffIcon.style.display = 'none';
    if (btn) btn.style.color = 'var(--text-light, #94a3b8)';
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

function setDemo(u, p) {
  document.getElementById('login-username').value = u;
  document.getElementById('login-password').value = p;
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-submit');
  const errEl = document.getElementById('login-error');

  btn.disabled = true;
  btn.textContent = 'Connexion...';
  errEl.style.display = 'none';

  try {
    const user = await Auth.login(username, password);
    if (user) {
      document.getElementById('app-sidebar')?.style.removeProperty('display');
      document.getElementById('app-topbar')?.style.removeProperty('display');
      document.getElementById('app-content').style.marginLeft = '';
      document.getElementById('app-content').style.paddingTop = '';
      // Log access
      await DB.writeAudit('LOGIN', 'user', user.id, { username: user.username });

      // Navigate to dashboard
      initSidebar();
      updateTopbar();
      if (window.updatePharmacyDisplay) await updatePharmacyDisplay();
      if (window.initSupportWidget) initSupportWidget();

      // --- PIN POST-LOGIN ---
      await _showPinGate(user);
    } else {
      errEl.textContent = 'Identifiant ou mot de passe incorrect';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Erreur de connexion : ' + err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Connexion <i data-lucide="arrow-right"></i>`;
    if (window.lucide) lucide.createIcons();
  }
}
// ═══════════════════════════════════════════════════════════════════
// PIN POST-LOGIN GATE
// After username+password, user must enter a 4-digit PIN
// If no PIN is set, user is prompted to create one
// ═══════════════════════════════════════════════════════════════════
async function _showPinGate(user) {
  const pinKey = 'pin_user_' + user.id;
  const settings = await DB.dbGetAll('settings');
  let savedPin = settings.find(s => s.key === pinKey)?.value;

  // If no PIN set yet, auto-create default 0000
  if (!savedPin) {
    savedPin = '0000';
    await DB.dbPut('settings', { key: pinKey, value: '0000', updatedAt: Date.now() });
  }

  // Show PIN verification screen
  return new Promise((resolve) => {
    const firstName = (user.name || user.username || 'U').split(' ')[0];
    const initials = firstName.charAt(0).toUpperCase();
    let attempts = 0;
    const MAX_ATTEMPTS = 5;
    let currentPin = '';

    const overlay = document.createElement('div');
    overlay.id = 'pin-gate-overlay';
    overlay.innerHTML = `
      <div class="pin-gate-box">
        <div class="pin-gate-avatar">${initials}</div>
        <div class="pin-gate-name">${firstName}</div>
        <div class="pin-gate-subtitle">Entrez votre code PIN</div>
        <div class="pin-gate-dots" id="pin-gate-dots">
          <span class="pin-dot"></span>
          <span class="pin-dot"></span>
          <span class="pin-dot"></span>
          <span class="pin-dot"></span>
        </div>
        <div id="pin-gate-error" class="pin-gate-error"></div>
        <div class="pin-gate-numpad" id="pin-gate-numpad">
          <button class="pin-num" data-n="1">1</button>
          <button class="pin-num" data-n="2">2</button>
          <button class="pin-num" data-n="3">3</button>
          <button class="pin-num" data-n="4">4</button>
          <button class="pin-num" data-n="5">5</button>
          <button class="pin-num" data-n="6">6</button>
          <button class="pin-num" data-n="7">7</button>
          <button class="pin-num" data-n="8">8</button>
          <button class="pin-num" data-n="9">9</button>
          <button class="pin-num pin-clear" data-n="clear">C</button>
          <button class="pin-num" data-n="0">0</button>
          <button class="pin-num pin-back" data-n="back">&larr;</button>
        </div>
        <button id="pin-gate-logout" class="pin-gate-logout">Changer d'utilisateur</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const dots = overlay.querySelectorAll('.pin-dot');
    const errEl = overlay.querySelector('#pin-gate-error');
    const numpad = overlay.querySelector('#pin-gate-numpad');
    const logoutBtn = overlay.querySelector('#pin-gate-logout');

    function updateDots() {
      dots.forEach((d, i) => d.classList.toggle('filled', i < currentPin.length));
    }

    function shakeDots() {
      const dotsWrap = overlay.querySelector('.pin-gate-dots');
      dotsWrap.classList.add('shake');
      setTimeout(() => dotsWrap.classList.remove('shake'), 500);
    }

    async function checkPin() {
      if (currentPin === savedPin) {
        // Success
        dots.forEach(d => d.classList.add('success'));
        setTimeout(() => {
          overlay.classList.remove('visible');
          setTimeout(() => overlay.remove(), 300);
          _finishLogin(user);
          // If default PIN 0000, force user to change it
          if (savedPin === '0000') {
            setTimeout(() => _promptSetPin(user, true), 800);
          }
          resolve();
        }, 400);
      } else {
        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          errEl.textContent = 'Trop de tentatives. Reconnectez-vous.';
          setTimeout(() => {
            overlay.remove();
            if (window.Auth?.logout) Auth.logout();
          }, 1500);
          return;
        }
        errEl.textContent = 'Code PIN incorrect (' + (MAX_ATTEMPTS - attempts) + ' essais restants)';
        shakeDots();
        currentPin = '';
        setTimeout(updateDots, 500);
      }
    }

    numpad.addEventListener('click', (e) => {
      const btn = e.target.closest('.pin-num');
      if (!btn) return;
      const n = btn.dataset.n;
      errEl.textContent = '';

      if (n === 'clear') {
        currentPin = '';
        updateDots();
      } else if (n === 'back') {
        currentPin = currentPin.slice(0, -1);
        updateDots();
      } else {
        if (currentPin.length < 4) {
          currentPin += n;
          updateDots();
          if (currentPin.length === 4) {
            setTimeout(checkPin, 200);
          }
        }
      }
    });

    // Keyboard support
    document.addEventListener('keydown', function _pinKeyHandler(e) {
      if (!document.getElementById('pin-gate-overlay')) {
        document.removeEventListener('keydown', _pinKeyHandler);
        return;
      }
      if (e.key >= '0' && e.key <= '9' && currentPin.length < 4) {
        currentPin += e.key;
        updateDots();
        errEl.textContent = '';
        if (currentPin.length === 4) setTimeout(checkPin, 200);
      } else if (e.key === 'Backspace') {
        currentPin = currentPin.slice(0, -1);
        updateDots();
      } else if (e.key === 'Escape') {
        currentPin = '';
        updateDots();
      }
    });

    logoutBtn.addEventListener('click', () => {
      overlay.remove();
      if (window.Auth?.logout) Auth.logout();
      else window.location.reload();
    });
  });
}

function _finishLogin(user) {
  Router.navigate('dashboard');
  UI.toast('Bienvenue, ' + (user.name || user.username) + ' !', 'success');
  window.dispatchEvent(new CustomEvent('ordivex-login'));
}

function _promptSetPin(user, mandatory) {
  const pinKey = 'pin_user_' + user.id;
  const titleText = mandatory ? 'Changez votre code PIN par defaut' : 'Configurer votre code PIN';
  const descText = mandatory
    ? 'Votre PIN est actuellement 0000. Pour la securite de votre pharmacie, vous devez le changer maintenant.'
    : 'Pour renforcer la securite, definissez un code PIN a 4 chiffres. Il sera demande apres chaque connexion.';
  const modalEl = UI.modal(titleText,
    '<p style="margin-bottom:16px;color:var(--text-muted)">' + descText + '</p>' +
    '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">' +
    '<input type="password" id="new-pin-1" maxlength="1" style="width:50px;height:56px;text-align:center;font-size:24px;border-radius:12px;border:2px solid var(--border);background:var(--surface-2);color:var(--text);font-weight:700" inputmode="numeric" pattern="[0-9]">' +
    '<input type="password" id="new-pin-2" maxlength="1" style="width:50px;height:56px;text-align:center;font-size:24px;border-radius:12px;border:2px solid var(--border);background:var(--surface-2);color:var(--text);font-weight:700" inputmode="numeric" pattern="[0-9]">' +
    '<input type="password" id="new-pin-3" maxlength="1" style="width:50px;height:56px;text-align:center;font-size:24px;border-radius:12px;border:2px solid var(--border);background:var(--surface-2);color:var(--text);font-weight:700" inputmode="numeric" pattern="[0-9]">' +
    '<input type="password" id="new-pin-4" maxlength="1" style="width:50px;height:56px;text-align:center;font-size:24px;border-radius:12px;border:2px solid var(--border);background:var(--surface-2);color:var(--text);font-weight:700" inputmode="numeric" pattern="[0-9]">' +
    '</div>' +
    '<div id="set-pin-error" style="color:#e74c3c;font-size:13px;text-align:center;min-height:20px;margin-bottom:8px"></div>' +
    '<div style="display:flex;gap:8px;justify-content:center">' +
    (mandatory ? '' : '<button class="btn btn-secondary" onclick="UI.closeModal()">Plus tard</button>') +
    '<button class="btn btn-primary" id="save-pin-btn">Enregistrer le PIN</button>' +
    '</div>'
  );
  // If mandatory, hide close button and prevent clicking outside to close
  if (mandatory && modalEl) {
    const closeBtn = modalEl.querySelector('#modal-close-btn');
    if (closeBtn) closeBtn.style.display = 'none';
    modalEl.onclick = null; // Prevent closing by clicking overlay
  }

  // Auto-focus and auto-advance
  setTimeout(() => {
    const inputs = [1,2,3,4].map(i => document.getElementById('new-pin-' + i));
    if (inputs[0]) inputs[0].focus();
    inputs.forEach((inp, idx) => {
      if (!inp) return;
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/[^0-9]/g, '');
        if (inp.value && idx < 3) inputs[idx + 1]?.focus();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !inp.value && idx > 0) inputs[idx - 1]?.focus();
      });
    });

    const saveBtn = document.getElementById('save-pin-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const pin = inputs.map(i => i?.value || '').join('');
        const errEl = document.getElementById('set-pin-error');
        if (pin.length !== 4) {
          if (errEl) errEl.textContent = 'Le PIN doit contenir 4 chiffres';
          return;
        }
        if (pin === '0000') {
          if (errEl) errEl.textContent = 'Le code 0000 n\'est pas autorise. Choisissez un autre PIN.';
          return;
        }
        await DB.dbPut('settings', { key: pinKey, value: pin, updatedAt: Date.now() });
        UI.closeModal();
        UI.toast('Code PIN enregistre avec succes', 'success');
      });
    }
  }, 300);
}

// Inject PIN gate CSS
(function() {
  const s = document.createElement('style');
  s.textContent = `
    #pin-gate-overlay {
      position:fixed; inset:0; z-index:99998;
      background:rgba(9,26,50,0.92);
      backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
      display:flex; align-items:center; justify-content:center;
      opacity:0; transition:opacity 0.3s;
    }
    #pin-gate-overlay.visible { opacity:1; }
    .pin-gate-box {
      text-align:center; padding:40px 36px; width:340px; max-width:92vw;
      background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);
      border-radius:24px;
    }
    .pin-gate-avatar {
      width:68px; height:68px; margin:0 auto 14px; border-radius:50%;
      font-size:26px; font-weight:800;
      background:linear-gradient(135deg,#2E86C1,#1a5276);
      color:#fff; display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 20px rgba(46,134,193,0.3);
    }
    .pin-gate-name { color:#fff; font-size:18px; font-weight:700; margin-bottom:2px; }
    .pin-gate-subtitle { color:rgba(255,255,255,0.45); font-size:13px; margin-bottom:24px; }
    .pin-gate-dots {
      display:flex; gap:14px; justify-content:center; margin-bottom:16px;
    }
    .pin-gate-dots.shake { animation:pinShake 0.4s ease-in-out; }
    .pin-dot {
      width:16px; height:16px; border-radius:50%;
      border:2px solid rgba(255,255,255,0.25);
      transition:background 0.15s, border-color 0.15s;
    }
    .pin-dot.filled {
      background:#2E86C1; border-color:#2E86C1;
    }
    .pin-dot.success {
      background:#2ecc71; border-color:#2ecc71;
    }
    .pin-gate-error { color:#f87171; font-size:12px; min-height:18px; margin-bottom:10px; }
    .pin-gate-numpad {
      display:grid; grid-template-columns:repeat(3,1fr); gap:10px;
      max-width:240px; margin:0 auto 16px;
    }
    .pin-num {
      width:100%; aspect-ratio:1.5; border:none; border-radius:14px;
      background:rgba(255,255,255,0.08); color:#fff; font-size:22px; font-weight:600;
      cursor:pointer; transition:background 0.15s, transform 0.1s;
      font-family:inherit; display:flex; align-items:center; justify-content:center;
    }
    .pin-num:hover { background:rgba(255,255,255,0.15); }
    .pin-num:active { transform:scale(0.93); background:rgba(46,134,193,0.3); }
    .pin-clear { font-size:16px; color:rgba(255,255,255,0.5); }
    .pin-back { font-size:20px; }
    .pin-gate-logout {
      background:none; border:none; color:rgba(255,255,255,0.35);
      font-size:12px; cursor:pointer; margin-top:12px; padding:6px;
      transition:color 0.2s; font-family:inherit;
    }
    .pin-gate-logout:hover { color:rgba(255,255,255,0.6); }
  `;
  document.head.appendChild(s);
})();

async function renderSettings(container) {
  if (DB.AppState.currentUser?.role !== 'admin') {
    container.innerHTML = `<div class="error-state">Accès refusé — Réservé à l'administrateur</div>`;
    return;
  }

  const [users, auditLog, settingsData] = await Promise.all([
    DB.dbGetAll('users'),
    DB.dbGetAll('auditLog'),
    DB.dbGetAll('settings'),
  ]);

  // Load settings into a map
  const gs = k => settingsData.find(s => s.key === k)?.value || '';
  const smsConfigStr = settingsData.find(s => s.key === 'sms_config')?.value;
  let smsConfig = { provider: 'africastalking', enabled: false, apiKey: '', username: '', senderId: 'OrdiveX', countryCode: '+224' };
  try { if (smsConfigStr) smsConfig = JSON.parse(smsConfigStr); } catch(e) { /* corrupted sms config — use defaults */ }

  const recentAudit = auditLog.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);

  // Paramètres de sécurité (par utilisateur courant)
  const curUserId = DB.AppState.currentUser?.id;
  const lockEnabledVal = settingsData.find(s => s.key === `security_lock_enabled_${curUserId}`)?.value;
  const lockEnabled = lockEnabledVal !== undefined ? lockEnabledVal === 'true' : true; // Activé par défaut
  const lockTimeout = settingsData.find(s => s.key === `security_lock_timeout_${curUserId}`)?.value || '15';

  container.innerHTML = `
    <style>
      .settings-tabs { display:flex; gap:4px; background:var(--surface); padding:6px; border-radius:14px; border:1px solid var(--border); margin-bottom:28px; flex-wrap:wrap; }
      .settings-tab-btn { flex:1; min-width:120px; padding:10px 16px; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; background:transparent; color:var(--text-muted); transition:all 0.25s; display:flex; align-items:center; justify-content:center; gap:8px; }
      .settings-tab-btn.active { background:var(--primary); color:#fff; box-shadow:0 4px 14px rgba(46,134,193,0.3); }
      .settings-tab-btn:hover:not(.active) { background:var(--bg-secondary); color:var(--text); }
      .settings-tab-pane { display:none; animation: fadeInTab 0.25s ease; }
      .settings-tab-pane.active { display:block; }
      @keyframes fadeInTab { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      .settings-2col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
      @media(max-width:900px){ .settings-2col{grid-template-columns:1fr;} }
      .settings-card2 { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:24px; }
      .settings-card2-title { font-size:15px; font-weight:700; color:var(--text); margin:0 0 18px 0; display:flex; align-items:center; gap:10px; padding-bottom:14px; border-bottom:1px solid var(--border); }
      .settings-card2-title i { width:18px; height:18px; color:var(--primary); }
      /* Users grid */
      .users-grid2 { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; margin-top:16px; }
      .user-card2 { background:var(--bg); border:1px solid var(--border); border-radius:14px; padding:18px 16px; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; transition:box-shadow 0.2s; }
      .user-card2:hover { box-shadow:0 4px 20px rgba(0,0,0,0.08); }
      .user-card2-avatar { width:54px; height:54px; border-radius:50%; background:linear-gradient(135deg,var(--primary),#1a56db); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:22px; flex-shrink:0; box-shadow:0 4px 12px rgba(46,134,193,0.25); }
      .user-card2-name { font-weight:700; font-size:14px; color:var(--text); }
      .user-card2-username { font-size:12px; color:var(--text-muted); margin-top:-6px; }
      .user-card2-badges { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; }
      .user-card2-actions { display:flex; gap:6px; width:100%; }
      .user-card2-actions .btn { flex:1; font-size:12px; padding:6px; }
      /* Danger zone */
      .danger-zone { background:rgba(239,68,68,0.06); border:2px solid rgba(239,68,68,0.25); border-radius:16px; padding:20px; }
      .danger-zone-title { color:#dc2626; font-weight:800; font-size:15px; display:flex; align-items:center; gap:8px; margin-bottom:6px; }
      .danger-zone p { font-size:13px; color:#ef4444; margin-bottom:16px; line-height:1.5; }
      .danger-zone .form-control { border-color:rgba(239,68,68,0.4) !important; background:rgba(239,68,68,0.04) !important; }
      .danger-zone .form-control:focus { border-color:#dc2626 !important; box-shadow:0 0 0 3px rgba(239,68,68,0.15) !important; }
      .danger-zone label { color:#b91c1c !important; font-weight:600; }
    </style>

    <div class="page-header">
      <div>
        <h1 class="page-title">Paramètres & Administration</h1>
        <p class="page-subtitle">Configuration de la pharmacie, utilisateurs et sécurité</p>
      </div>
    </div>

    <div class="settings-tabs">
      <button class="settings-tab-btn active" onclick="switchSettingsTab('pharmacie',this)"><i data-lucide="hospital"></i> Pharmacie</button>
      <button class="settings-tab-btn" onclick="switchSettingsTab('utilisateurs',this)"><i data-lucide="users"></i> Utilisateurs</button>
      <button class="settings-tab-btn" onclick="switchSettingsTab('tarification',this)"><i data-lucide="percent"></i> Tarification</button>
      <button class="settings-tab-btn" onclick="switchSettingsTab('securite',this)"><i data-lucide="shield-check"></i> Sécurité</button>
      <button class="settings-tab-btn" onclick="switchSettingsTab('cloud',this)"><i data-lucide="cloud"></i> Cloud & Sync</button>
      <button class="settings-tab-btn" onclick="switchSettingsTab('sms',this)"><i data-lucide="message-square"></i> SMS</button>

      <button class="settings-tab-btn" onclick="switchSettingsTab('permissions',this)"><i data-lucide="shield-check"></i> Permissions</button>
    </div>

    <!-- ══════════════ ONGLET : PHARMACIE ══════════════ -->
    <div class="settings-tab-pane active" id="tab-pharmacie">
      <div class="settings-2col">
        <div class="settings-card2">
          <h3 class="settings-card2-title"><i data-lucide="building-2"></i> Identité de la Pharmacie</h3>
          <form id="settings-form" class="form-grid">
            <div class="form-group">
              <label>Nom de la pharmacie</label>
              <input type="text" name="pharmacy_name" class="form-control" value="${gs('pharmacy_name') || 'Pharmacie Centrale de Conakry'}">
            </div>
            <div class="form-group">
              <label>Adresse</label>
              <input type="text" name="pharmacy_address" class="form-control" value="${gs('pharmacy_address') || 'Avenue de la République, Conakry'}">
            </div>
            <div class="form-group">
              <label>Slogan / Phrase d'accroche</label>
              <input type="text" name="pharmacy_slogan" class="form-control" value="${gs('pharmacy_slogan') || 'Santé & Technologie'}" placeholder="Ex: Votre santé, notre priorité">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Téléphone</label>
                <input type="text" name="pharmacy_phone" class="form-control" value="${gs('pharmacy_phone') || '+224 620 000 000'}">
              </div>
              <div class="form-group">
                <label>Email</label>
                <input type="email" name="pharmacy_email" class="form-control" value="${gs('pharmacy_email') || ''}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>N° Licence DNPM</label>
                <input type="text" name="pharmacy_dnpm" class="form-control" value="${gs('pharmacy_dnpm') || 'LIC-DNPM-2024-001'}">
              </div>
              <div class="form-group">
                <label>Pharmacien responsable</label>
                <input type="text" name="pharmacy_resp" class="form-control" value="${gs('pharmacy_resp') || 'Pharmacien Responsable'}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Seuil alerte stock</label>
                <input type="number" name="min_stock_alert" class="form-control" value="${gs('min_stock_alert') || '10'}">
              </div>
              <div class="form-group">
                <label>Alerte expiration (jours)</label>
                <input type="number" name="expiry_alert_days" class="form-control" value="${gs('expiry_alert_days') || '90'}">
              </div>
            </div>
            <button type="button" class="btn btn-primary" onclick="saveSettings()"><i data-lucide="save"></i> Sauvegarder</button>
          </form>
        </div>

        <div class="settings-card2">
          <h3 class="settings-card2-title"><i data-lucide="image"></i> Logo de la Pharmacie</h3>
          <div id="logo-preview-container" class="settings-logo-container" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;background:var(--bg-secondary);border-radius:12px;border:2px dashed var(--border);">
            ${gs('pharmacy_logo') ? `
              <img src="${gs('pharmacy_logo')}" id="settings-logo-img" style="max-height:120px;max-width:100%;object-fit:contain;border-radius:8px;">
              <button type="button" class="btn btn-sm btn-danger" onclick="removeLogo()"><i data-lucide="trash-2"></i> Supprimer</button>
            ` : `
              <div style="width:80px;height:80px;border-radius:16px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--text-muted)"><i data-lucide="image"></i></div>
              <p style="color:var(--text-muted);font-size:13px;text-align:center;margin:0">Aucun logo configuré.<br>Formats acceptés : PNG, JPG, SVG</p>
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('logo-upload').click()"><i data-lucide="upload"></i> Choisir un logo</button>
            `}
            <input type="file" id="logo-upload" accept="image/*" style="display:none;" onchange="handleLogoUpload(event)">
            <input type="hidden" name="pharmacy_logo" id="pharmacy-logo-input" value="${gs('pharmacy_logo') || ''}">
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════ ONGLET : UTILISATEURS ══════════════ -->
    <div class="settings-tab-pane" id="tab-utilisateurs">
      ${DB.AppState.currentUser?.role === 'admin' ? `
      <div class="settings-card2">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">
          <h3 class="settings-card2-title" style="margin:0;border:none;padding:0"><i data-lucide="users"></i> ${users.length} Utilisateur${users.length > 1 ? 's' : ''} enregistré${users.length > 1 ? 's' : ''}</h3>
          <div style="display:flex;gap:8px">
            <button class="btn btn-sm btn-secondary" onclick="exportUsersPDF()"><i data-lucide="printer"></i> PDF</button>
            <button class="btn btn-sm btn-primary" onclick="showAddUser()"><i data-lucide="user-plus"></i> Ajouter</button>
          </div>
        </div>
        <div class="users-grid2">
          ${users.map(u => {
            const colors = { admin: 'linear-gradient(135deg,#7c3aed,#4f46e5)', pharmacien: 'linear-gradient(135deg,#0ea5e9,#2563eb)', caissier: 'linear-gradient(135deg,#10b981,#059669)' };
            return `
            <div class="user-card2">
              <div class="user-card2-avatar" style="background:${colors[u.role] || colors.caissier}">${(u.name||'?').charAt(0).toUpperCase()}</div>
              <div class="user-card2-name">${u.name}</div>
              <div class="user-card2-username">@${u.username}</div>
              <div class="user-card2-badges">
                ${UI.roleBadge(u.role)}
                <span class="badge badge-${u.active ? 'success' : 'neutral'}">${u.active ? 'Actif' : 'Inactif'}</span>
              </div>
              <div class="user-card2-actions" style="display:flex; gap:6px; width:100%; justify-content:center; flex-wrap:wrap;">
                <button class="btn btn-sm btn-ghost" onclick="viewEmployee360(${u.id})" title="Profil 360°" style="flex:0 0 auto; width:36px; padding:6px 0;"><i data-lucide="bar-chart-3"></i></button>
                <button class="btn btn-sm btn-secondary" onclick="editUser(${u.id})" title="Modifier" style="flex:1; white-space:nowrap;"><i data-lucide="edit-3"></i> Modifier</button>
                <button class="btn btn-sm btn-ghost" onclick="resetUserPin(${u.id},'${(u.name||'').replace(/'/g,'')}')" title="Réinitialiser PIN" style="flex:0 0 auto; width:36px; padding:6px 0;"><i data-lucide="key-round"></i></button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
      ` : '<div class="empty-state"><p>Accès réservé à l\'administrateur.</p></div>'}
    </div>

    <!-- ══════════════ ONGLET : TARIFICATION ══════════════ -->
    <div class="settings-tab-pane" id="tab-tarification">
      <div class="settings-2col">
        <div class="settings-card2">
          <h3 class="settings-card2-title"><i data-lucide="percent"></i> Coefficients de Tarification</h3>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;line-height:1.6">
            Ces coefficients définissent le prix de vente calculé automatiquement à partir du prix d'achat lors de la création ou modification d'un médicament.
          </p>
          <form id="pricing-form" class="form-grid">
            <div class="form-group">
              <label>Coefficient — Produits de Spécialité <span style="font-size:11px;color:var(--text-muted)">(marque, innovateur)</span></label>
              <div style="display:flex;align-items:center;gap:10px">
                <input type="number" name="pricing_coeff_specialty" id="coeff-specialty" class="form-control" step="0.01" min="1" max="10" value="${gs('pricing_coeff_specialty') || '1.40'}" oninput="document.getElementById('coeff-specialty-display').textContent='× '+parseFloat(this.value||1.4).toFixed(2)">
                <span id="coeff-specialty-display" style="font-size:16px;font-weight:800;color:var(--primary);white-space:nowrap;min-width:60px">× ${parseFloat(gs('pricing_coeff_specialty') || '1.40').toFixed(2)}</span>
              </div>
            </div>
            <div class="form-group">
              <label>Coefficient — Génériques / Détail <span style="font-size:11px;color:var(--text-muted)">(DCI, sans marque)</span></label>
              <div style="display:flex;align-items:center;gap:10px">
                <input type="number" name="pricing_coeff_generic" id="coeff-generic" class="form-control" step="0.01" min="1" max="10" value="${gs('pricing_coeff_generic') || '1.12'}" oninput="document.getElementById('coeff-generic-display').textContent='× '+parseFloat(this.value||1.12).toFixed(2)">
                <span id="coeff-generic-display" style="font-size:16px;font-weight:800;color:var(--primary);white-space:nowrap;min-width:60px">× ${parseFloat(gs('pricing_coeff_generic') || '1.12').toFixed(2)}</span>
              </div>
            </div>
            <div class="form-group" style="grid-column: span 2; margin-top: 10px; border-top: 1px dashed var(--border); padding-top: 16px;">
              <label style="font-weight: 700;">Configuration de la TVA (%) ou Formule de calcul</label>
              <input type="text" name="pharmacy_tva" id="pharmacy-tva" class="form-control" placeholder="Ex: 18 pour 18%, ou formule libre comme: subtotal * 0.18" value="${gs('pharmacy_tva') || '0'}">
              <small style="color:var(--text-muted); display: block; margin-top: 4px;">Entrez un nombre simple (ex: 18) pour un pourcentage de 18% appliqué sur le total net de la facture. Pour une formule personnalisée, utilisez les variables : <code>subtotal</code> et <code>discount</code>.</small>
            </div>
            <div style="background:var(--bg-secondary);border-radius:10px;padding:14px;font-size:13px;border-left:4px solid var(--primary); grid-column: span 2;">
              <strong>Comment ça marche :</strong><br>
              Saisissez le <strong>Prix d'achat</strong> lors de la création d'un produit. Le <strong>Prix de vente</strong> est calculé automatiquement selon le type. Vous pouvez toujours l'ajuster manuellement.
            </div>
            <button type="button" class="btn btn-primary" onclick="savePricingSettings()"><i data-lucide="save"></i> Sauvegarder les réglages</button>
          </form>
        </div>
        <div class="settings-card2" style="background:linear-gradient(135deg,var(--surface),var(--bg-secondary))">
          <h3 class="settings-card2-title"><i data-lucide="info"></i> Simulation de Tarif</h3>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Entrez un prix d'achat pour prévisualiser les prix de vente calculés selon vos coefficients.</p>
          <div class="form-group">
            <label>Prix d'achat (GNF)</label>
            <input type="number" id="sim-price" class="form-control" placeholder="Ex: 10000" oninput="simulatePrice(this.value)">
          </div>
          <div id="sim-result" style="margin-top:16px;display:none">
            <div style="display:flex;flex-direction:column;gap:10px">
              <div style="padding:14px 16px;background:var(--surface);border-radius:12px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:13px;color:var(--text-muted)">Spécialité (× <span id="sim-coeff-s"></span>)</span>
                <strong id="sim-price-s" style="font-size:16px;color:var(--primary)"></strong>
              </div>
              <div style="padding:14px 16px;background:var(--surface);border-radius:12px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:13px;color:var(--text-muted)">Générique (× <span id="sim-coeff-g"></span>)</span>
                <strong id="sim-price-g" style="font-size:16px;color:var(--primary)"></strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════ ONGLET : SÉCURITÉ ══════════════ -->
    <div class="settings-tab-pane" id="tab-securite">
      <div class="settings-2col">
        <div class="settings-card2">
          <h3 class="settings-card2-title"><i data-lucide="shield-check"></i> Verrouillage Automatique</h3>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px;line-height:1.6">
            Lorsqu'activé, la session se verrouille automatiquement après une période d'inactivité (aucun clic, aucune saisie, aucun mouvement de souris).
            <br><strong style="color:var(--text)">Ces préférences sont enregistrées pour votre compte uniquement.</strong>
          </p>
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding:16px;background:var(--bg-secondary);border-radius:12px;border:1px solid var(--border)">
            <div style="position:relative;width:52px;height:28px;flex-shrink:0">
              <input type="checkbox" id="lock-enabled-cb" ${lockEnabled ? 'checked' : ''} style="opacity:0;width:0;height:0;position:absolute"
                onchange="window.toggleSecurityLockUI(this)">
              <span onclick="document.getElementById('lock-enabled-cb').click();document.getElementById('lock-enabled-cb').dispatchEvent(new Event('change'))"
                id="lock-toggle-track"
                style="position:absolute;inset:0;border-radius:28px;background:${lockEnabled ? 'var(--primary)' : 'var(--border)'};cursor:pointer;transition:background 0.3s;display:flex;align-items:center;padding:3px">
                <span style="width:22px;height:22px;background:#fff;border-radius:50%;transition:transform 0.3s;box-shadow:0 2px 6px rgba(0,0,0,0.2);transform:translateX(${lockEnabled ? '24px' : '0'})"></span>
              </span>
            </div>
            <div>
              <div style="font-weight:700;font-size:14px">Verrouillage automatique</div>
              <div id="lock-desc-text" style="font-size:12px;color:var(--text-muted);margin-top:2px">${lockEnabled ? 'La session se verrouille après inactivité' : 'Aucune déconnexion automatique'}</div>
            </div>
            <span id="lock-status-badge" class="badge ${lockEnabled ? 'badge-success' : 'badge-neutral'}" style="margin-left:auto">${lockEnabled ? 'Activé' : 'Désactivé'}</span>
          </div>
          <div id="lock-timeout-group" style="opacity:${lockEnabled ? '1' : '0.4'};pointer-events:${lockEnabled ? 'auto' : 'none'};transition:opacity 0.3s">
            <label style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;display:block">Délai d'inactivité</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${[{val:'5',label:'5 min'},{val:'10',label:'10 min'},{val:'15',label:'15 min'},{val:'30',label:'30 min'},{val:'60',label:'1 heure'}].map(opt=>`
                <label style="cursor:pointer">
                  <input type="radio" name="lock_timeout" value="${opt.val}" ${lockTimeout===opt.val?'checked':''} style="display:none" class="lock-radio">
                  <span class="lock-time-btn ${lockTimeout===opt.val?'active':''}" onclick="document.querySelectorAll('.lock-time-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active');"
                    style="display:inline-block;padding:10px 20px;border-radius:24px;border:2px solid ${lockTimeout===opt.val?'var(--primary)':'var(--border)'};font-weight:700;font-size:13px;background:${lockTimeout===opt.val?'var(--primary)':'var(--surface)'};color:${lockTimeout===opt.val?'#fff':'var(--text-muted)'};transition:all 0.2s">
                    ${opt.label}
                  </span>
                </label>`).join('')}
            </div>
          </div>
          <div style="margin-top:24px">
            <button class="btn btn-primary" onclick="saveSecurityLockSettings()"><i data-lucide="shield-check"></i> Enregistrer les préférences</button>
          </div>
        </div>

        <div class="settings-card2">
          <h3 class="settings-card2-title"><i data-lucide="monitor"></i> Identité de cet Appareil</h3>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Nom de cet appareil affiché dans le Moniteur de Réseau multi-poste.</p>
          <div class="form-group">
            <label>Nom de l'appareil</label>
            <input type="text" id="device-name-input" class="form-control" value="${localStorage.getItem('pharma_device_name') || 'Caisse 1'}" placeholder="Ex: PC Bureau, Mobile Vente...">
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">ID : <code>${localStorage.getItem('pharma_device_id') || 'N/A'}</code></div>
          <button type="button" class="btn btn-secondary" onclick="saveDeviceName()"><i data-lucide="save"></i> Enregistrer le nom</button>
        </div>
      </div>
    </div>

    <!-- ══════════════ ONGLET : CLOUD & SYNC ══════════════ -->
    <div class="settings-tab-pane" id="tab-cloud">
      <div class="settings-2col">
        <div class="settings-card2">
          <h3 class="settings-card2-title"><i data-lucide="rotate-cw"></i> Synchronisation & Sauvegarde</h3>
          <div class="sync-panel">
            <div class="sync-status-row">
              <span>Statut réseau</span>
              <span class="${(window.NM ? window.NM.isOnline() : navigator.onLine) ? 'text-success' : 'text-danger'}">${(window.NM ? window.NM.isOnline() : navigator.onLine) ? '<i data-lucide="wifi"></i> En ligne' : '<i data-lucide="wifi-off"></i> Hors ligne'}</span>
            </div>
            <div class="sync-status-row">
              <span>Mode opération</span>
              <span class="badge badge-success">Offline-First <i data-lucide="check"></i></span>
            </div>
            <div class="sync-status-row">
              <span><i data-lucide="monitor" style="width:14px;height:14px;vertical-align:middle;margin-right:4px"></i> Appareils connectés</span>
              <span id="settings-device-count" class="badge badge-info" style="cursor:pointer" onclick="if(window.UI&&UI.openSyncMonitor)UI.openSyncMonitor();loadDeviceCount()">Chargement...</span>
            </div>
            <div class="sync-actions" style="margin-top:16px">
              <button class="btn btn-secondary" onclick="doBackup()"><i data-lucide="save"></i> Sauvegarder maintenant</button>
              <button class="btn btn-ghost" onclick="restoreBackup()"><i data-lucide="folder-open"></i> Restaurer</button>
            </div>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
              <button class="btn btn-sm btn-primary" onclick="triggerPull()"><i data-lucide="cloud-download"></i> Récupérer depuis le Cloud (PULL)</button>
              <button class="btn btn-sm btn-secondary" onclick="DB.syncToSupabase()"><i data-lucide="cloud-lightning"></i> Envoyer vers le Cloud (PUSH)</button>
              <button class="btn btn-xs btn-outline-danger" onclick="repairSync()"><i data-lucide="wrench"></i> Réparer l'envoi Cloud</button>
            </div>
          </div>
        </div>

        <!-- ZONE DANGEREUSE — Clés Supabase -->
        <div class="danger-zone">
          <div class="danger-zone-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            Zone Sensible — Configuration Supabase
          </div>
          <p>
            Ces clés donnent un accès complet à votre base de données cloud. Ne les partagez jamais avec des personnes non autorisées. Toute modification ici affecte immédiatement toutes les connexions.
          </p>
          <form id="supabase-config-form" class="form-grid">
            <div class="form-group">
              <label>URL du Projet Supabase</label>
              <input type="password" name="supabase_url" class="form-control" value="${gs('supabase_url') || ''}" placeholder="https://xyz.supabase.co">
            </div>
            <div class="form-group">
              <label>Clé Anon Public (API Key)</label>
              <input type="password" name="supabase_key" class="form-control" value="${gs('supabase_key') || ''}" placeholder="eyJhbGciOiJI...">
            </div>
            <button type="button" class="btn btn-sm" style="background:#dc2626;color:#fff;border:none" onclick="saveSupabaseConfig()">
              <i data-lucide="save"></i> Enregistrer la configuration Cloud
            </button>
          </form>
        </div>
      </div>
    </div>

    <!-- ══════════════ ONGLET : SMS ══════════════ -->
    <div class="settings-tab-pane" id="tab-sms">
      <div class="settings-card2" style="max-width:600px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
          <h3 class="settings-card2-title" style="margin:0;border:none;padding:0"><i data-lucide="message-square"></i> Configuration SMS</h3>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="sms-enabled-cb" ${smsConfig.enabled ? 'checked' : ''} onchange="document.getElementById('sms-settings-box').style.opacity=this.checked?'1':'0.5';document.getElementById('sms-settings-box').style.pointerEvents=this.checked?'auto':'none';">
            <span style="font-weight:600;font-size:13px">Activer les SMS</span>
          </label>
        </div>
        <div id="sms-settings-box" style="opacity:${smsConfig.enabled ? '1' : '0.5'};pointer-events:${smsConfig.enabled ? 'auto' : 'none'};transition:all 0.3s">
          <form id="sms-config-form" class="form-grid">
            <div class="form-row">
              <div class="form-group">
                <label>Fournisseur API</label>
                <select name="provider" class="form-control" onchange="document.getElementById('sms-username-group').style.display=this.value==='africastalking'?'block':'none'">
                  <option value="africastalking" ${smsConfig.provider === 'africastalking' ? 'selected' : ''}>AfricasTalking (Recommandé)</option>
                  <option value="twilio" ${smsConfig.provider === 'twilio' ? 'selected' : ''}>Twilio</option>
                  <option value="orange" ${smsConfig.provider === 'orange' ? 'selected' : ''}>Orange SMS API</option>
                </select>
              </div>
              <div class="form-group">
                <label>Sender ID (Expéditeur)</label>
                <input type="text" name="senderId" class="form-control" value="${smsConfig.senderId || 'OrdiveX'}" placeholder="Max 11 caractères">
              </div>
            </div>
            <div class="form-group" id="sms-username-group" style="display:${smsConfig.provider === 'africastalking' ? 'block' : 'none'}">
              <label>Nom d'utilisateur (Username)</label>
              <input type="text" name="username" class="form-control" value="${smsConfig.username || ''}" placeholder="Ex: sandbox">
            </div>
            <div class="form-group">
              <label>Clé API</label>
              <input type="password" name="apiKey" class="form-control" value="${smsConfig.apiKey || ''}" placeholder="Votre clé secrète">
            </div>
            <div class="form-group">
              <label>Préfixe téléphonique pays</label>
              <input type="text" name="countryCode" class="form-control" value="${smsConfig.countryCode || '+224'}" placeholder="+224" style="max-width:140px">
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn btn-primary" onclick="saveSmsConfig()"><i data-lucide="save"></i> Enregistrer</button>
              <button type="button" class="btn btn-secondary" onclick="testSmsConnection()"><i data-lucide="send"></i> Tester</button>
            </div>
          </form>
        </div>
      </div>
    </div>




    <!-- ══════════════ ONGLET : PERMISSIONS ══════════════ -->
    <div class="settings-tab-pane" id="tab-permissions">
      <div class="settings-card2">
        <h3 class="settings-card2-title"><i data-lucide="shield-check"></i> Permissions Individuelles</h3>
        <p style="font-size:.83rem;color:var(--text-muted);margin-bottom:20px">Choisissez un utilisateur pour configurer précisément ce qu'il peut voir ou faire dans l'application. L'Administrateur a toujours toutes les permissions.</p>

        <div style="margin-bottom:24px;max-width:480px">
          <label style="font-weight:700;font-size:.85rem;display:block;margin-bottom:8px;color:var(--text)"><i data-lucide="user" style="width:14px;height:14px;vertical-align:-2px"></i> Choisir un utilisateur / employé :</label>
          <select id="perm-user-select" class="form-control" style="font-size:.9rem" onchange="window.onPermUserSelectChange(this.value)">
            <option value="">-- Sélectionner un utilisateur --</option>
            ${users.filter(u => u.role !== 'admin').map(u => `<option value="${u.id}">${u.name || u.username} (@${u.username}) — ${u.role}</option>`).join('')}
          </select>
        </div>

        <div id="permissions-grid-container">
          <div style="text-align:center;padding:40px 20px;background:var(--bg);border-radius:12px;border:2px dashed var(--border)">
            <i data-lucide="users" style="width:36px;height:36px;color:var(--text-muted);margin-bottom:12px;display:block;margin-inline:auto"></i>
            <p style="color:var(--text-muted);font-size:.88rem;margin:0">Veuillez choisir un utilisateur ci-dessus pour configurer ses permissions.</p>
          </div>
        </div>

        <div style="margin-top:20px;display:none;align-items:center;justify-content:space-between;background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);padding:10px 16px;border-radius:8px;" id="perm-save-btn-container">
          <span style="font-size:.82rem;color:#10b981;font-weight:600;display:flex;align-items:center;gap:6px"><i data-lucide="check-circle" style="width:14px;height:14px"></i> Sauvegarde instantanée active</span>
          <button class="btn btn-danger btn-xs" onclick="window.resetSelectedUserPermissions()"><i data-lucide="rotate-ccw" style="width:12px;height:12px"></i> Réinitialiser</button>
        </div>
      </div>
    </div>
  `;

  // Rendre les icônes Lucide IMMÉDIATEMENT pour éviter le layout shift
  if (window.lucide) lucide.createIcons();

  // Charger le compteur d'appareils automatiquement
  setTimeout(() => { if (window.loadDeviceCount) loadDeviceCount(); }, 500);
}

window.switchSettingsTab = function(tabName, btn) {
  document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById('tab-' + tabName);
  if (pane) pane.classList.add('active');
  if (btn) btn.classList.add('active');
  if (window.lucide) lucide.createIcons();
  // Re-init Lucide icons inside the newly visible pane
  if (pane && window.lucide) lucide.createIcons({ node: pane });
};

// ─── SÉLECTION UTILISATEUR POUR PERMISSIONS ───────────────────────────────────
window.onPermUserSelectChange = function(userId) {
  window._selectedPermUserId = userId ? parseInt(userId) : null;
  renderPermissionsGrid();
};

// ─── GRILLE PERMISSIONS PAR UTILISATEUR ───────────────────────────────────────
window.renderPermissionsGrid = async function() {
  const container = document.getElementById('permissions-grid-container');
  const saveBtn = document.getElementById('perm-save-btn-container');
  if (!container) return;

  const userId = window._selectedPermUserId;
  if (!userId) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;background:var(--bg);border-radius:12px;border:2px dashed var(--border)">
        <i data-lucide="users" style="width:36px;height:36px;color:var(--text-muted);margin-bottom:12px;display:block;margin-inline:auto"></i>
        <p style="color:var(--text-muted);font-size:.88rem;margin:0">Veuillez choisir un utilisateur ci-dessus pour configurer ses permissions.</p>
      </div>`;
    if (saveBtn) saveBtn.style.display = 'none';
    if (window.lucide) lucide.createIcons({ node: container });
    return;
  }

  const user = await DB.dbGet('users', userId).catch(() => null);
  if (!user) { container.innerHTML = '<p style="color:red">Utilisateur introuvable.</p>'; return; }

  // Charger les permissions individuelles existantes
  const rec = await DB.dbGetByKey('settings', `user_permissions_${userId}`).catch(() => null);
  const userPerms = rec && rec.value
    ? (typeof rec.value === 'string' ? JSON.parse(rec.value) : rec.value)
    : null;

  // Initialiser ou synchroniser window._userPermOverrides pour cet utilisateur
  if (window._lastSelectedPermUserId !== userId) {
    window._lastSelectedPermUserId = userId;
    window._userPermOverrides = {};
    
    // Remplir d'abord avec les défauts du rôle
    const roleKey = String(user.role || '').toLowerCase().replace(/[\s-]+/g, '_');
    const rolePerms = (window._rolePermissions || {})[roleKey] || Auth._defaultPerms[roleKey] || [];
    Auth.ALL_PERMISSIONS.forEach(p => {
      window._userPermOverrides[p.key] = rolePerms.includes(p.key);
    });

    // Écraser par les surcharges personnalisées existantes
    if (userPerms) {
      Object.assign(window._userPermOverrides, userPerms);
    }
  }

  const roleKey = String(user.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const rolePerms = (window._rolePermissions || {})[roleKey] || Auth._defaultPerms[roleKey] || [];

  const perms = Auth.ALL_PERMISSIONS;
  // Filtrer la catégorie 'modules' car elle est maintenant répartie hiérarchiquement dans les modules respectifs
  const cats = (Auth.ALL_PERMISSION_CATS || []).filter(c => c.key !== 'modules');

  const badgeColors = { admin:'#7c3aed', pharmacien:'#0ea5e9', caissier:'#10b981', responsable:'#f59e0b', rh:'#ec4899', gestionnaire_stock:'#6366f1', comptable:'#14b8a6', assistant:'#94a3b8' };
  const roleColor = badgeColors[roleKey] || '#6366f1';

  // Mapping des catégories de permissions de l'UI vers leur parent respectif (clé de module)
  const CAT_PARENTS = {
    dashboard:    'module_dashboard',
    pos:          'module_sales',
    caisse:       'module_caisse',
    products:     'module_products',
    stock:        'module_stock',
    inventory:    'module_inventory',
    reorder:      'module_reorder',
    achats:       'module_invoices',
    patients:     'module_patients',
    traceability: 'module_traceability',
    accounting:   'module_accounting',
    reports:      'module_reports',
    metrics:      'module_metrics',
    hr:           'module_rh',
    shifts:       'module_shifts',
    admin:        'module_settings'
  };

  const catIcons = {
    dashboard:    'layout-dashboard',
    pos:          'monitor-smartphone',
    caisse:       'banknote',
    products:     'pill',
    stock:        'package-search',
    inventory:    'clipboard-list',
    reorder:      'refresh-ccw-dot',
    achats:       'factory',
    patients:     'users',
    traceability: 'shield-check',
    accounting:   'landmark',
    reports:      'bar-chart-3',
    metrics:      'bar-chart-2',
    hr:           'user-cog',
    shifts:       'clock-3',
    admin:        'settings-2'
  };

  // Recherche en direct
  const searchQuery = (window._permSearchQuery || '').toLowerCase();

  // Mémoriser l'état d'ouverture des catégories
  if (!window._permCatsOpen) window._permCatsOpen = {};

  let html = `
    <!-- En-tete utilisateur -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:linear-gradient(135deg, var(--bg), var(--surface));border-radius:12px;margin-bottom:16px;border:1px solid var(--border);flex-wrap:wrap;box-shadow:0 2px 8px rgba(0,0,0,.06)">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;border-radius:50%;background:${roleColor};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;flex-shrink:0;box-shadow:0 2px 8px ${roleColor}44">${(user.name||'?').charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-weight:700;font-size:.95rem">${user.name || user.username}</div>
          <div style="font-size:.78rem;color:var(--text-muted)">@${user.username} — <span style="color:${roleColor};font-weight:600">${user.role}</span>${userPerms ? ' · <span style="color:#10b981;font-weight:600">Personnalisé</span>' : ' · Defaut du role'}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-xs btn-secondary" onclick="window.setAllPermissions(true)"><i data-lucide="check-square" style="width:12px;height:12px"></i> Tout autoriser</button>
        <button class="btn btn-xs btn-secondary" onclick="window.setAllPermissions(false)"><i data-lucide="square" style="width:12px;height:12px"></i> Tout retirer</button>
        <button class="btn btn-xs btn-danger" onclick="window.resetSelectedUserPermissions()"><i data-lucide="rotate-ccw" style="width:12px;height:12px"></i> Reinitialiser</button>
      </div>
    </div>

    <!-- Barre de recherche -->
    <div style="position:relative;margin-bottom:16px;">
      <i data-lucide="search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-muted)"></i>
      <input type="text" class="form-control" placeholder="Recherche rapide de permissions..." style="padding-left:36px;width:100%" value="${window._permSearchQuery || ''}" oninput="window._permSearchQuery=this.value;window.renderPermissionsGrid()">
    </div>

    <div style="display:flex;flex-direction:column;gap:10px">`;

  cats.forEach((cat, catIdx) => {
    let catPerms = perms.filter(p => (p.cat || 'all') === cat.key);
    if (searchQuery) {
      catPerms = catPerms.filter(p => p.label.toLowerCase().includes(searchQuery) || p.key.toLowerCase().includes(searchQuery));
    }
    if (catPerms.length === 0) return;

    // Récupérer la permission d'accès globale (parent)
    const parentKey = CAT_PARENTS[cat.key];
    const parentPerm = perms.find(p => p.key === parentKey);

    // Compter les permissions actives dans cette catégorie (y compris le parent)
    let activeCount = 0;
    let totalCount = catPerms.length;
    
    // Déterminer l'état du parent
    let parentHas = false;
    if (parentKey) {
      totalCount += 1;
      parentHas = window._userPermOverrides[parentKey] === true;
      if (parentHas) activeCount++;
    }

    catPerms.forEach(p => {
      const has = window._userPermOverrides[p.key] === true;
      if (has) activeCount++;
    });

    const isOpen = searchQuery ? true : (window._permCatsOpen[cat.key] !== undefined ? window._permCatsOpen[cat.key] : catIdx === 0);
    const icon = catIcons[cat.key] || 'folder';
    const pctActive = Math.round((activeCount / totalCount) * 100);
    const barColor = pctActive === 100 ? '#10b981' : pctActive > 50 ? '#f59e0b' : '#ef4444';

    html += `
    <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface);box-shadow:0 1px 4px rgba(0,0,0,.04);transition:box-shadow .2s">
      <!-- En-tete de categorie (cliquable) -->
      <div onclick="window._permCatsOpen=window._permCatsOpen||{};window._permCatsOpen['${cat.key}']=!${isOpen};window.renderPermissionsGrid()"
        class="perm-cat-header"
        style="display:flex;align-items:center;padding:12px 16px;cursor:pointer;user-select:none;gap:12px;background:var(--bg);transition:background .15s">
        <i data-lucide="${isOpen ? 'chevron-down' : 'chevron-right'}" style="width:16px;height:16px;color:var(--text-muted);flex-shrink:0;transition:transform .2s"></i>
        <i data-lucide="${icon}" style="width:18px;height:18px;color:${roleColor};flex-shrink:0"></i>
        <span style="font-weight:700;font-size:.9rem;flex:1">${cat.label}</span>
        <span style="font-size:.72rem;color:var(--text-muted);white-space:nowrap;font-weight:600">${activeCount}/${totalCount}</span>
        <div style="width:50px;height:5px;border-radius:10px;background:var(--border);overflow:hidden;flex-shrink:0">
          <div style="width:${pctActive}%;height:100%;background:${barColor};border-radius:10px;transition:width .3s"></div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
          <button class="btn btn-xs btn-secondary" style="padding:2px 6px;font-size:10px" onclick="event.stopPropagation();window._toggleCatPerms('${cat.key}',true)">☑</button>
          <button class="btn btn-xs btn-secondary" style="padding:2px 6px;font-size:10px" onclick="event.stopPropagation();window._toggleCatPerms('${cat.key}',false)">☐</button>
        </div>
      </div>`;

    if (isOpen) {
      html += `<div style="border-top:1px solid var(--border)">`;

      // 1. Rendu du SWITCH PARENT GLOBAL DU MODULE
      if (parentKey && parentPerm) {
        const isParentCustomized = userPerms !== null && userPerms[parentKey] !== undefined;
        html += `
          <div style="background:var(--bg-secondary, var(--bg));padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;border-left:4px solid var(--primary)">
            <label style="display:flex;align-items:center;gap:12px;cursor:pointer;flex:1;margin:0">
              <input type="checkbox" id="user_perm_${parentKey}" ${parentHas ? 'checked' : ''}
                onchange="window._setUserPermOverride('${parentKey}', this.checked); window._toggleSubPermsVisibility('${cat.key}',this.checked)"
                style="width:19px;height:19px;cursor:pointer;accent-color:var(--primary);flex-shrink:0">
              <span style="font-weight:800;font-size:.9rem;color:var(--text-primary)">${parentPerm.label}</span>
            </label>
            ${isParentCustomized ? '<span style="font-size:.68rem;color:#f59e0b;white-space:nowrap;font-weight:700;background:rgba(245,158,11,.1);padding:2px 7px;border-radius:10px">Personnalisé</span>' : '<span style="font-size:.68rem;color:var(--text-muted);white-space:nowrap">Hérité</span>'}
          </div>`;
      }

      // 2. Rendu des SOUS-PERMISSIONS dans un conteneur pliable
      html += `<div id="sub-perms-${cat.key}" style="display:${parentHas ? 'block' : 'none'};transition:all .3s ease">`;

      catPerms.forEach((perm, i) => {
        const bg = i % 2 === 0 ? 'var(--surface)' : 'var(--bg)';
        const hasPerm = window._userPermOverrides[perm.key] === true;
        const isCustomized = userPerms !== null && userPerms[perm.key] !== undefined;
        const highlight = searchQuery && (perm.label.toLowerCase().includes(searchQuery) || perm.key.toLowerCase().includes(searchQuery));

        html += `
          <label class="perm-row-label ${highlight ? 'highlighted' : ''}" style="display:flex;align-items:center;padding:10px 16px 10px 44px;background:${highlight ? 'rgba(99,102,241,.06)' : bg};border-bottom:1px solid var(--border);gap:12px;cursor:pointer;transition:background .12s">
            <input type="checkbox" id="user_perm_${perm.key}" ${hasPerm ? 'checked' : ''}
              onchange="window._setUserPermOverride('${perm.key}', this.checked)"
              style="width:17px;height:17px;cursor:pointer;accent-color:var(--primary);flex-shrink:0">
            <span style="flex:1;font-size:.85rem;font-weight:500">${perm.label}</span>
            ${isCustomized ? '<span style="font-size:.68rem;color:#f59e0b;white-space:nowrap;font-weight:700;background:rgba(245,158,11,.1);padding:2px 7px;border-radius:10px">Personnalisé</span>' : '<span style="font-size:.68rem;color:var(--text-muted);white-space:nowrap">Hérité</span>'}
          </label>`;
      });

      html += `</div></div>`;
    }

    html += `</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;
  if (saveBtn) saveBtn.style.display = 'flex';
  if (window.lucide) lucide.createIcons({ node: container });
};

window._setUserPermOverride = function(key, checked) {
  if (window._userPermOverrides) {
    window._userPermOverrides[key] = checked;
    // Sauvegarde instantanée en base de données
    const userId = window._selectedPermUserId;
    if (userId) {
      DB.dbPut('settings', { key: `user_permissions_${userId}`, value: JSON.stringify(window._userPermOverrides) }).then(() => {
        if (DB.AppState.currentUser && DB.AppState.currentUser.id === userId) {
          DB.AppState.currentUser.permissions = { ...window._userPermOverrides };
          if (typeof initSidebar === 'function') initSidebar();
        }
      }).catch(e => console.error('[Permissions] Erreur sauvegarde auto:', e));
    }
  }
};

// Fonction de basculement visuel des sous-permissions en temps réel
window._toggleSubPermsVisibility = function(catKey, checked) {
  const el = document.getElementById(`sub-perms-${catKey}`);
  if (el) {
    el.style.display = checked ? 'block' : 'none';
  }
};

// Cocher/decocher toutes les permissions d'une catégorie
window._toggleCatPerms = function(catKey, checked) {
  const CAT_PARENTS = {
    dashboard:    'module_dashboard',
    pos:          'module_sales',
    caisse:       'module_caisse',
    products:     'module_products',
    stock:        'module_stock',
    inventory:    'module_inventory',
    reorder:      'module_reorder',
    achats:       'module_invoices',
    patients:     'module_patients',
    traceability: 'module_traceability',
    accounting:   'module_accounting',
    reports:      'module_reports',
    metrics:      'module_metrics',
    hr:           'module_rh',
    shifts:       'module_shifts',
    admin:        'module_settings'
  };
  const parentKey = CAT_PARENTS[catKey];
  if (parentKey) {
    window._setUserPermOverride(parentKey, checked);
    const parentChk = document.getElementById(`user_perm_${parentKey}`);
    if (parentChk) {
      parentChk.checked = checked;
      window._toggleSubPermsVisibility(catKey, checked);
    }
  }

  const catPerms = Auth.ALL_PERMISSIONS.filter(p => (p.cat || 'all') === catKey);
  catPerms.forEach(perm => {
    window._setUserPermOverride(perm.key, checked);
    const chk = document.getElementById(`user_perm_${perm.key}`);
    if (chk) chk.checked = checked;
  });
};

// Fonction helper pour cocher/decocher globalement
window.setAllPermissions = function(checked) {
  const perms = Auth.ALL_PERMISSIONS;
  perms.forEach(perm => {
    window._setUserPermOverride(perm.key, checked);
    const chk = document.getElementById(`user_perm_${perm.key}`);
    if (chk) chk.checked = checked;
  });
  
  const CAT_PARENTS = {
    dashboard:    'module_dashboard',
    pos:          'module_sales',
    caisse:       'module_caisse',
    products:     'module_products',
    stock:        'module_stock',
    inventory:    'module_inventory',
    reorder:      'module_reorder',
    achats:       'module_invoices',
    patients:     'module_patients',
    traceability: 'module_traceability',
    accounting:   'module_accounting',
    reports:      'module_reports',
    metrics:      'module_metrics',
    hr:           'module_rh',
    shifts:       'module_shifts',
    admin:        'module_settings'
  };
  Object.keys(CAT_PARENTS).forEach(catKey => {
    window._toggleSubPermsVisibility(catKey, checked);
  });
  UI.toast(checked ? 'Toutes les permissions cochées' : 'Toutes les permissions décochées', 'info', 1500);
};

// ─── SAUVEGARDER LES PERMISSIONS D'UN UTILISATEUR ─────────────────────────────
window.saveSelectedUserPermissions = async function() {
  const userId = window._selectedPermUserId;
  if (!userId) { UI.toast('Veuillez d\'abord choisir un utilisateur', 'warning'); return; }
  
  if (!window._userPermOverrides) {
    UI.toast('Aucun changement à enregistrer', 'info');
    return;
  }

  try {
    await DB.dbPut('settings', { key: `user_permissions_${userId}`, value: JSON.stringify(window._userPermOverrides) });
    if (DB.AppState.currentUser && DB.AppState.currentUser.id === userId) {
      DB.AppState.currentUser.permissions = window._userPermOverrides;
      if (typeof initSidebar === 'function') initSidebar();
    }
    await DB.writeAudit('SET_USER_PERMISSIONS', 'users', userId, { overrides: window._userPermOverrides });
    UI.toast('✅ Permissions enregistrées et appliquées immédiatement', 'success', 3000);
    renderPermissionsGrid(); // Re-render pour afficher les badges "Personnalisé"
  } catch(e) {
    UI.toast('Erreur : ' + (e.message || e), 'error');
  }
};

// ─── RÉINITIALISER LES PERMISSIONS D'UN UTILISATEUR ───────────────────────────
window.resetSelectedUserPermissions = async function() {
  const userId = window._selectedPermUserId;
  if (!userId) return;
  const ok = await UI.confirm('Réinitialiser les permissions personnalisées de cet utilisateur ?\n\nIl retrouvera les permissions par défaut de son rôle.');
  if (!ok) return;
  try {
    await DB.dbDelete('settings', `user_permissions_${userId}`);
    window._userPermOverrides = null;
    window._lastSelectedPermUserId = null; // forcer re-sync au prochain render
    if (DB.AppState.currentUser && DB.AppState.currentUser.id === userId) {
      DB.AppState.currentUser.permissions = {};
      if (typeof initSidebar === 'function') initSidebar();
    }
    UI.toast('Permissions réinitialisées — retour aux défauts du rôle', 'success', 3000);
    renderPermissionsGrid();
  } catch(e) {
    UI.toast('Erreur : ' + (e.message || e), 'error');
  }
};

// Alias conservé pour compatibilité
window.savePermissionsGrid = window.saveSelectedUserPermissions;



// ─── PERMISSIONS PAR UTILISATEUR (Overrides individuels) ──────────────────────
window.editUserPermissions = async function(userId) {
  const user = await DB.dbGet('users', userId);
  if (!user) { UI.toast('Utilisateur introuvable', 'error'); return; }
  if (user.role === 'admin') { UI.toast('L\'admin a toutes les permissions par défaut', 'info'); return; }

  // Charger les permissions individuelles existantes
  const rec = await DB.dbGetByKey('settings', `user_permissions_${userId}`).catch(() => null);
  const userPerms = rec && rec.value
    ? (typeof rec.value === 'string' ? JSON.parse(rec.value) : rec.value)
    : {};

  // Permissions du rôle pour afficher l'état hérité
  const roleKey = String(user.role || '').toLowerCase().replace(/[\s-]+/g, '_');
  const rolePerms = (window._rolePermissions || {})[roleKey] || Auth._defaultPerms[roleKey] || [];

  const perms = Auth.ALL_PERMISSIONS;
  const cats = Auth.ALL_PERMISSION_CATS || [{ key: 'all', label: 'Toutes' }];

  let html = `<div style="margin-bottom:12px;padding:10px 14px;background:var(--info-bg, #e8f4fd);border-radius:8px;font-size:.83rem;color:var(--text-muted)">
    <strong>🔐 Permissions individuelles pour ${user.name}</strong><br>
    <span>Rôle actuel : <strong>${user.role}</strong> — Les cases cochées <em>en gris</em> sont héritées du rôle.</span><br>
    <span>Cochez ou décochez pour <strong>outrepasser</strong> les permissions du rôle. Sélectionnez « — Hérité — » pour revenir au comportement par défaut du rôle.</span>
  </div>`;

  html += `<div style="max-height:55vh;overflow-y:auto;border:1px solid var(--border);border-radius:8px">`;

  cats.forEach(cat => {
    const catPerms = perms.filter(p => (p.cat || 'all') === cat.key);
    if (catPerms.length === 0) return;
    html += `<div style="background:var(--primary-color);color:#fff;padding:8px 14px;font-weight:700;font-size:13px">${cat.label}</div>`;
    catPerms.forEach((perm, i) => {
      const bg = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2, var(--bg))';
      const roleHas = rolePerms.includes(perm.key);
      const userOverride = userPerms[perm.key]; // true, false, ou undefined (hérité)
      // 3 états : 'inherit' (pas d'override), 'allow', 'deny'
      let state = 'inherit';
      if (userOverride === true) state = 'allow';
      else if (userOverride === false) state = 'deny';

      html += `<div style="display:flex;align-items:center;padding:8px 14px;background:${bg};border-bottom:1px solid var(--border);gap:12px">
        <span style="flex:1;font-size:.85rem;font-weight:500">${perm.label}</span>
        <span style="font-size:.75rem;color:var(--text-muted);min-width:60px;text-align:center">${roleHas ? '✅ Rôle' : '❌ Rôle'}</span>
        <select id="uperm_${perm.key}" style="width:140px;padding:5px 8px;border-radius:6px;border:1px solid var(--border);font-size:.8rem;background:var(--surface)">
          <option value="inherit" ${state === 'inherit' ? 'selected' : ''}>— Hérité —</option>
          <option value="allow" ${state === 'allow' ? 'selected' : ''}>✅ Autoriser</option>
          <option value="deny" ${state === 'deny' ? 'selected' : ''}>🚫 Interdire</option>
        </select>
      </div>`;
    });
  });

  html += `</div>`;

  UI.modal(`🔐 Permissions — ${user.name}`, html, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-danger" onclick="resetUserPermissions(${userId})"><i data-lucide="rotate-ccw"></i> Tout réinitialiser</button>
      <button class="btn btn-primary" onclick="saveUserPermissions(${userId})"><i data-lucide="check"></i> Enregistrer</button>
    `,
    width: '650px'
  });
  if (window.lucide) lucide.createIcons();
};

window.saveUserPermissions = async function(userId) {
  const perms = Auth.ALL_PERMISSIONS;
  const overrides = {};
  let hasOverride = false;
  perms.forEach(perm => {
    const sel = document.getElementById(`uperm_${perm.key}`);
    if (!sel) return;
    if (sel.value === 'allow') { overrides[perm.key] = true; hasOverride = true; }
    else if (sel.value === 'deny') { overrides[perm.key] = false; hasOverride = true; }
    // 'inherit' => pas d'entrée dans l'objet
  });

  try {
    if (hasOverride) {
      await DB.dbPut('settings', { key: `user_permissions_${userId}`, value: JSON.stringify(overrides) });
    } else {
      // Aucune exception : supprimer la clé
      try { await DB.dbDelete('settings', `user_permissions_${userId}`); } catch(e) { /* peut ne pas exister */ }
    }
    // Mettre à jour l'utilisateur courant si c'est lui
    if (DB.AppState.currentUser && DB.AppState.currentUser.id === userId) {
      DB.AppState.currentUser.permissions = hasOverride ? overrides : {};
    }
    await DB.writeAudit('SET_USER_PERMISSIONS', 'users', userId, { overrides });
    UI.closeModal();
    UI.toast('✅ Permissions individuelles enregistrées', 'success', 3000);
  } catch(e) {
    UI.toast('Erreur lors de la sauvegarde : ' + e.message, 'error');
  }
};

window.resetUserPermissions = async function(userId) {
  const ok = await UI.confirm('Réinitialiser toutes les permissions individuelles de cet utilisateur ?\n\nIl retrouvera uniquement les permissions de son rôle.');
  if (!ok) return;
  try {
    try { await DB.dbDelete('settings', `user_permissions_${userId}`); } catch(e) {}
    if (DB.AppState.currentUser && DB.AppState.currentUser.id === userId) {
      DB.AppState.currentUser.permissions = {};
    }
    UI.closeModal();
    UI.toast('Permissions individuelles réinitialisées', 'success');
  } catch(e) {
    UI.toast('Erreur : ' + e.message, 'error');
  }
};



// Sauvegarde d'un paramètre toggle (boolean)
window.saveToggleSetting = async function(key, value) {
  try {
    await DB.dbPut('settings', { key, value: value ? 'true' : 'false' });
    if (window._appSettings) window._appSettings[key] = value ? 'true' : 'false';
    UI.toast('Paramètre enregistré', 'success', 1500);
  } catch(e) {
    UI.toast('Erreur lors de la sauvegarde', 'error');
  }
};

// Sauvegarde d'un paramètre texte/number
window.saveInputSetting = async function(key, value) {
  try {
    await DB.dbPut('settings', { key, value: String(value) });
    if (window._appSettings) window._appSettings[key] = String(value);
    UI.toast('Paramètre enregistré', 'success', 1500);
  } catch(e) {
    UI.toast('Erreur lors de la sauvegarde', 'error');
  }
};

window.simulatePrice = function(price) {
  const val = parseFloat(price);
  const result = document.getElementById('sim-result');
  if (!result) return;
  if (!val || isNaN(val)) { result.style.display = 'none'; return; }
  result.style.display = 'block';
  const cs = parseFloat(document.getElementById('coeff-specialty')?.value || 1.4);
  const cg = parseFloat(document.getElementById('coeff-generic')?.value || 1.12);
  document.getElementById('sim-coeff-s').textContent = cs.toFixed(2);
  document.getElementById('sim-coeff-g').textContent = cg.toFixed(2);
  document.getElementById('sim-price-s').textContent = UI.formatCurrency(Math.round(val * cs));
  document.getElementById('sim-price-g').textContent = UI.formatCurrency(Math.round(val * cg));
};

window.saveSecurityLockSettings = async function() {
  const user = DB.AppState.currentUser;
  if (!user) return UI.toast('Utilisateur non connecté', 'error');

  const enabledCb = document.getElementById('lock-enabled-cb');
  const selectedRadio = document.querySelector('input.lock-radio:checked') ||
                        document.querySelector('input[name="lock_timeout"]:checked');

  const enabled = enabledCb ? enabledCb.checked : true;
  const timeout = selectedRadio ? selectedRadio.value : '15';

  const enabledKey = `security_lock_enabled_${user.id}`;
  const timeoutKey = `security_lock_timeout_${user.id}`;

  try {
    const allS = await DB.dbGetAll('settings');

    const upsert = async (key, value) => {
      const existing = allS.find(s => s.key === key);
      if (existing) {
        await DB.dbPut('settings', { ...existing, value: String(value), updatedAt: Date.now() });
      } else {
        await DB.dbAdd('settings', { key, value: String(value), updatedAt: Date.now() });
      }
    };

    await upsert(enabledKey, enabled);
    await upsert(timeoutKey, timeout);

    // Mettre à jour le toggle visuellement
    const track = document.getElementById('lock-toggle-track');
    if (track) {
      track.style.background = enabled ? 'var(--primary)' : 'var(--border)';
      const thumb = track.querySelector('span');
      if (thumb) thumb.style.transform = `translateX(${enabled ? '24px' : '0'})`;
    }

    // Reconfigurer SecurityLock sans délai
    if (window.SecurityLock) {
      window.SecurityLock._enabled = enabled;
      window.SecurityLock._timeoutMs = parseInt(timeout) * 60 * 1000;
      if (enabled) {
        window.SecurityLock.start();
      } else {
        window.SecurityLock.stop();
      }
    }

    await DB.writeAudit('SAVE_SECURITY_LOCK', 'settings', null, { enabled, timeout });
    UI.toast(`Verrouillage automatique ${enabled ? 'activé après ' + (timeout === '60' ? '1 heure' : timeout + ' min') : 'désactivé'}`, 'success');
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
};

async function savePricingSettings() {
  const form = document.getElementById('pricing-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  try {
    for (const [key, value] of Object.entries(data)) {
      const allS = await DB.dbGetAll('settings');
      const existing = allS.find(s => s.key === key);
      if (existing) {
        await DB.dbPut('settings', { ...existing, value: String(value), updatedAt: Date.now() });
      } else {
        await DB.dbAdd('settings', { key, value: String(value), updatedAt: Date.now() });
      }
    }
    await DB.writeAudit('SAVE_PRICING_SETTINGS', 'settings', null, data);
    UI.toast('Coefficients de tarification sauvegardés', 'success');
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function saveSettings() {
  const form = document.getElementById('settings-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  
  // Read logo manually as it is outside #settings-form
  const logoInput = document.getElementById('pharmacy-logo-input');
  if (logoInput) {
    data.pharmacy_logo = logoInput.value;
  }

  // Normalisation textuelle automatique
  if (data.pharmacy_name) data.pharmacy_name = UI.normalizeText(data.pharmacy_name);
  if (data.pharmacy_address) data.pharmacy_address = UI.normalizeText(data.pharmacy_address);
  if (data.pharmacy_resp) data.pharmacy_resp = UI.normalizeText(data.pharmacy_resp);

  try {
    for (const [key, value] of Object.entries(data)) {
      const existing = (await DB.dbGetAll('settings')).find(s => s.key === key);
      if (existing) {
        await DB.dbPut('settings', { ...existing, value, updatedAt: Date.now() });
      } else {
        await DB.dbAdd('settings', { key, value, updatedAt: Date.now() });
      }
    }
    await DB.writeAudit('SAVE_SETTINGS', 'settings', null, data);
    // Synchroniser window._appSettings immédiatement
    if (!window._appSettings) window._appSettings = {};
    Object.entries(data).forEach(([k, v]) => { window._appSettings[k] = v; });
    updatePharmacyDisplay();
    UI.toast('Paramètres sauvegardés avec succès', 'success');
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

function showAddUser() {
  UI.modal('<i data-lucide="user-plus" class="modal-icon-inline"></i> Nouvel Utilisateur', `
    <form id="user-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" name="name" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Identifiant *</label>
          <input type="text" name="username" class="form-control" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Mot de passe *</label>
          <input type="password" name="password" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Rôle *</label>
          <select name="role" class="form-control" required>
            <option value="admin">Administrateur</option>
            <option value="pharmacien">Pharmacien</option>
            <option value="caissier">Caissier</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" class="form-control">
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitUser()"><i data-lucide="check"></i> Créer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function submitUser() {
  const form = document.getElementById('user-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  data.active = true;
  try {
    await DB.dbAdd('users', data);
    await DB.writeAudit('ADD_USER', 'users', null, { name: data.name, username: data.username, role: data.role });
    UI.closeModal();
    UI.toast('Utilisateur créé', 'success');
    Router.navigate('settings');
  } catch (err) {
    UI.toast('Erreur : ' + (err.message.includes('unique') ? 'Cet identifiant existe déjà' : err.message), 'error');
  }
}

async function editUser(id) {
  const u = await DB.dbGet('users', id);
  if (!u) { UI.toast('Utilisateur introuvable', 'error'); return; }

  UI.modal('<i data-lucide="edit-3" class="modal-icon-inline"></i> Modifier l\'utilisateur', `
    <form id="edit-user-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" name="name" class="form-control" value="${u.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Identifiant</label>
          <input type="text" class="form-control" value="${u.username}" disabled>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nouveau mot de passe</label>
          <input type="password" name="password" class="form-control" placeholder="(laisser vide pour ne pas changer)">
        </div>
        <div class="form-group">
          <label>Rôle *</label>
          <select name="role" class="form-control" required>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrateur</option>
            <option value="pharmacien" ${u.role === 'pharmacien' ? 'selected' : ''}>Pharmacien</option>
            <option value="caissier" ${u.role === 'caissier' ? 'selected' : ''}>Caissier</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" class="form-control" value="${u.email || ''}">
        </div>
        <div class="form-group">
          <label>Statut</label>
          <select name="active" class="form-control">
            <option value="true" ${u.active ? 'selected' : ''}>Actif</option>
            <option value="false" ${!u.active ? 'selected' : ''}>Inactif — Désactivé</option>
          </select>
        </div>
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="updateUser(${u.id})"><i data-lucide="check"></i> Enregistrer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function updateUser(id) {
  const form = document.getElementById('edit-user-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  const original = await DB.dbGet('users', id);
  if (!original) return;

  const updated = {
    ...original,
    name: data.name,
    role: data.role,
    email: data.email || '',
    active: data.active === 'true',
  };
  if (data.password && data.password.trim()) {
    updated.password = data.password;
  }

  try {
    await DB.dbPut('users', updated);
    await DB.writeAudit('EDIT_USER', 'users', id, { name: updated.name, role: updated.role, active: updated.active });
    UI.closeModal();
    UI.toast('Utilisateur modifié', 'success');
    Router.navigate('settings');
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function doBackup() {
  const stores = ['products', 'lots', 'stock', 'movements', 'suppliers', 'purchaseOrders', 'sales', 'saleItems', 'prescriptions', 'patients', 'users', 'auditLog', 'settings', 'alerts', 'cashRegister', 'returns'];
  const backup = {};
  for (const s of stores) {
    backup[s] = await DB.dbGetAll(s);
  }
  backup._exportDate = new Date().toISOString();
  backup._version = '1.0';

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `pharma_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  UI.toast('Sauvegarde téléchargée', 'success');
}

/**
 * RESTAURATION DE SAUVEGARDE (Protocole Zero Loss)
 */
function restoreBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Double confirmation de sécurité
    const ok1 = await UI.confirm(`⚠️ ATTENTION : La restauration remplacera TOUTES vos données actuelles par celles du fichier "${file.name}".\n\nSouhaitez-vous continuer ?`);
    if (!ok1) return;

    const ok2 = await UI.confirm(`🛡️ SÉCURITÉ : Un fichier de secours de vos données actuelles va être téléchargé automatiquement AVANT la restauration.\n\nConfirmer le lancement du protocole "Zéro Perte" ?`);
    if (!ok2) return;

    try {
      UI.toast('⏳ Analyse du fichier et préparation du secours...', 'info', 3000);
      const text = await file.text();
      const data = JSON.parse(text);

      const result = await DB.restoreFromBackup(data);
      if (result.success) {
        UI.toast('✅ Restauration réussie ! Redémarrage du système...', 'success', 5000);
        setTimeout(() => location.reload(), 2000);
      }
    } catch (err) {
      console.error('Erreur restauration:', err);
      UI.toast('❌ Échec de la restauration : ' + err.message, 'error', 10000);
    }
  };
  input.click();
}

async function updatePharmacyDisplay() {
  const settings = await DB.dbGetAll('settings');
  const gs = k => settings.find(s => s.key === k)?.value || '';

  const name = gs('pharmacy_name') || 'OrdiveX';
  const slogan = gs('pharmacy_slogan') || 'Santé & Technologie';
  const logo = gs('pharmacy_logo');

  const nameEl = document.getElementById('pharmacy-name-display');
  const sloganEl = document.getElementById('pharmacy-slogan-display');
  const logoEl = document.getElementById('sidebar-logo-icon');

  if (nameEl) nameEl.textContent = name;
  if (sloganEl) sloganEl.textContent = slogan;
  if (logoEl) {
    if (logo) {
      logoEl.innerHTML = `<img src="${logo}" style="width:100%; height:100%; object-fit:contain; border-radius:4px;">`;
    } else {
      logoEl.innerHTML = '<i data-lucide="activity"></i>';
    }
    if (window.lucide) lucide.createIcons();
  }
}

async function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 1024 * 1024) { // 1MB limit for IndexedDB/Supabase safety
    UI.toast('L\'image est trop lourde (max 1Mo)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    document.getElementById('pharmacy-logo-input').value = base64;

    const container = document.getElementById('logo-preview-container');
    // Preserve the hidden input and file input
    const hiddenInput = document.getElementById('pharmacy-logo-input');
    const fileInput = document.getElementById('logo-upload');
    container.innerHTML = `
      <img src="${base64}" id="settings-logo-img" style="max-height: 80px; object-fit: contain; margin-bottom: 0.5rem; display: block;">
      <button type="button" class="btn btn-xs btn-danger" onclick="removeLogo()"><i data-lucide="trash-2"></i> Supprimer le logo</button>
    `;
    container.appendChild(fileInput);
    container.appendChild(hiddenInput);
    hiddenInput.value = base64;
    UI.toast('Logo prêt (cliquez sur Sauvegarder pour appliquer)', 'info');
    if (window.lucide) lucide.createIcons();
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  document.getElementById('pharmacy-logo-input').value = '';
  const container = document.getElementById('logo-preview-container');
  container.innerHTML = `
    <div class="logo-placeholder" style="width: 60px; height: 60px; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 0.5rem;"><i data-lucide="image"></i></div>
    <button type="button" class="btn btn-xs btn-secondary" onclick="document.getElementById('logo-upload').click()"><i data-lucide="upload"></i> Choisir un logo...</button>
    <input type="file" id="logo-upload" accept="image/*" style="display: none;" onchange="handleLogoUpload(event)">
    <input type="hidden" name="pharmacy_logo" id="pharmacy-logo-input" value="">
  `;
  if (window.lucide) lucide.createIcons();
}

async function saveSupabaseConfig() {
  const form = document.getElementById('supabase-config-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  try {
    for (const [key, value] of Object.entries(data)) {
      const existing = (await DB.dbGetAll('settings')).find(s => s.key === key);
      if (existing) {
        await DB.dbPut('settings', { ...existing, value, updatedAt: Date.now() });
      } else {
        await DB.dbAdd('settings', { key, value, updatedAt: Date.now() });
      }
    }
    UI.toast('Configuration Supabase enregistrée', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function repairSync() {
  const ok = await UI.confirm("Cette action va marquer TOUTES vos données locales comme 'non synchronisées' pour forcer un renvoi complet vers Supabase.\n\nCela peut prendre quelques minutes et réparera les problèmes de comptes manquants sur mobile.\n\nContinuer ?");
  if (!ok) return;

  const btn = event.currentTarget;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="spinner-inline"></i> Réparation en cours...';

  try {
    await DB.forceSyncAll();
    UI.toast('Synchronisation Cloud réparée et relancée !', 'success');
  } catch (err) {
    UI.toast('Erreur lors de la réparation : ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

async function triggerPull() {
  const btn = event.currentTarget;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="spinner-inline"></i> Récupération...';

  try {
    UI.toast('Début de la récupération des données...', 'info');
    await DB.pullFromSupabase(true);
    UI.toast('Données récupérées avec succès ! Vos catalogues sont à jour.', 'success');
    setTimeout(() => location.reload(), 2000);
  } catch (err) {
    UI.toast('Erreur lors de la récupération : ' + err.message, 'error', 10000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}


async function saveSmsConfig() {
  const form = document.getElementById('sms-config-form');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  data.enabled = document.getElementById('sms-enabled-cb').checked;
  try {
    if (window.SMS) {
      await SMS.saveConfig(data);
      UI.toast('Configuration SMS enregistrée', 'success');
      await DB.writeAudit('SAVE_SMS_CONFIG', 'settings', null, { provider: data.provider, enabled: data.enabled });
    } else {
      UI.toast('Module SMS introuvable !', 'error');
    }
  } catch(e) {
    UI.toast('Erreur: ' + e.message, 'error');
  }
}

async function testSmsConnection() {
  if (!window.SMS) {
    UI.toast('Module SMS introuvable !', 'error');
    return;
  }
  const btn = event.currentTarget;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="spinner-inline"></i> Test en cours...';

  try {
    // Save current unsubmitted form state to config first for testing
    const form = document.getElementById('sms-config-form');
    const data = Object.fromEntries(new FormData(form));
    data.enabled = document.getElementById('sms-enabled-cb').checked;
    await SMS.saveConfig(data);

    const res = await SMS.testConnection();
    if (res.success) {
      UI.toast('Test réussi ! SMS envoyé à TrillionX.', 'success');
    } else {
      UI.toast('Erreur d\'envoi: ' + (res.error || 'Vérifiez vos paramètres'), 'error');
    }
  } catch (e) {
    UI.toast('Erreur: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

window.updatePharmacyDisplay = updatePharmacyDisplay;
window.saveSupabaseConfig = saveSupabaseConfig;
// window.resetSmsConfig = resetSmsConfig;
window.toggleSecurityLockUI = function(cb) {
  const isChecked = cb.checked;
  const group = document.getElementById('lock-timeout-group');
  if (group) {
    group.style.opacity = isChecked ? '1' : '0.4';
    group.style.pointerEvents = isChecked ? 'auto' : 'none';
  }
  const track = document.getElementById('lock-toggle-track');
  if (track) {
    track.style.background = isChecked ? 'var(--primary)' : 'var(--border)';
    const thumb = track.querySelector('span');
    if (thumb) thumb.style.transform = `translateX(${isChecked ? '24px' : '0'})`;
  }
  const desc = document.getElementById('lock-desc-text');
  if (desc) desc.textContent = isChecked ? 'La session se verrouille après inactivité' : 'Aucune déconnexion automatique';
  const badge = document.getElementById('lock-status-badge');
  if (badge) {
    badge.className = `badge ${isChecked ? 'badge-success' : 'badge-neutral'}`;
    badge.textContent = isChecked ? 'Activé' : 'Désactivé';
  }
};

window.exportUsersPDF = async function() {
  if (!window.PDFExport) return UI.toast("Module PDF non chargé", "error");
  UI.showLoader('Génération du PDF...', 3000);
  try {
    const users = await DB.dbGetAll('users');
    const settings = await DB.dbGetAll('settings');
    const gs = k => settings.find(s => s.key === k)?.value;
    const nomPharma = gs('pharmacy_name') || 'Pharmacie Centrale';

    const data = users.map(u => [
      u.name || 'N/A',
      u.username,
      u.role || 'N/A',
      u.active ? 'Actif' : 'Inactif',
      u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—'
    ]);
    const headers = ["Nom Complet", "Nom d'utilisateur", "Rôle", "Statut", "Création"];
    const subHeader = [
      nomPharma,
      `Date d'édition : ${new Date().toLocaleString('fr-FR')}`,
      `Total Utilisateurs : ${data.length}`
    ];
    await window.PDFExport.generate("Liste des Utilisateurs", headers, data, { subHeader, orientation: 'portrait' });
  } catch (err) {
    console.error(err);
    UI.toast("Erreur lors de l'export PDF", "error");
  } finally {
    UI.hideLoader();
  }
};
window.testSmsConnection = testSmsConnection;
window.handleLogoUpload = handleLogoUpload;
window.removeLogo = removeLogo;
window.handleLogin = handleLogin;
window.setDemo = setDemo;
window.showAddUser = showAddUser;
window.submitUser = submitUser;
window.editUser = editUser;
window.updateUser = updateUser;
window.saveSettings = saveSettings;
window.doBackup = doBackup;
window.restoreBackup = restoreBackup;
window.repairSync = repairSync;
window.triggerPull = triggerPull;
window.viewEmployee360 = viewEmployee360;
window.resetUserPin = resetUserPin;

async function resetUserPin(userId, userName) {
  const ok = await UI.confirm('Reinitialiser le PIN de ' + userName + ' a 0000 ?');
  if (!ok) return;
  const pinKey = 'pin_user_' + userId;
  await DB.dbPut('settings', { key: pinKey, value: '0000', updatedAt: Date.now() });
  UI.toast('PIN de ' + userName + ' reinitialise a 0000', 'success');
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 5 — Vue 360° Employé (Admin uniquement)
// ═══════════════════════════════════════════════════════════════════
async function viewEmployee360(userId) {
  if (DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('Accès réservé à l\'administrateur', 'error');
    return;
  }
  const [user, allSales, auditLog] = await Promise.all([
    DB.dbGet('users', userId),
    DB.dbGetAll('sales'),
    DB.dbGetAll('auditLog'),
  ]);
  if (!user) return;

  // Filtrer les ventes de cet employé
  const empSales = allSales.filter(s => s.userId === userId || s.sellerName === user.name);
  const totalCA = empSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const avgTicket = empSales.length > 0 ? Math.round(totalCA / empSales.length) : 0;
  const lastSale = empSales.length > 0 ? empSales.sort((a,b) => new Date(b.date) - new Date(a.date))[0].date : null;

  // Dernière connexion depuis l'audit
  const logins = auditLog.filter(l => l.action === 'LOGIN' && (l.userId === userId || l.username === user.username));
  const lastLogin = logins.length > 0 ? logins.sort((a,b) => b.timestamp - a.timestamp)[0].timestamp : null;

  // Ventes par mois (3 derniers mois)
  const now = new Date();
  const months = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().substring(0, 7);
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    const sales = empSales.filter(s => s.date && s.date.substring(0, 7) === key);
    months.push({ label, count: sales.length, total: sales.reduce((sum,s) => sum + (s.total||0), 0) });
  }

  UI.modal(`<i data-lucide="bar-chart-3" class="modal-icon-inline"></i> Profil — ${user.name}`, `
    <div class="patient-detail">
      <div class="patient-detail-header">
        <div class="patient-avatar-lg" style="background:var(--primary-light);color:var(--primary)">${user.name?.charAt(0).toUpperCase() || '?'}</div>
        <div class="patient-detail-info">
          <h2>${user.name}</h2>
          <div class="patient-detail-meta">
            <span><i data-lucide="user"></i> <code>${user.username}</code></span>
            <span>${UI.roleBadge(user.role)}</span>
            <span class="badge badge-${user.active ? 'success' : 'neutral'}">${user.active ? 'Actif' : 'Inactif'}</span>
          </div>
          <div style="margin-top:8px;color:var(--text-muted);font-size:12px;">
            <i data-lucide="clock" style="width:12px;height:12px"></i> Dernière connexion : ${lastLogin ? UI.formatDateTime(lastLogin) : 'Jamais'}
          </div>
        </div>
      </div>

      <div class="patient-stats-row" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));">
        <div class="patient-stat-card">
          <div class="patient-stat-val kpi-value">${UI.formatCurrency(totalCA)}</div>
          <div class="patient-stat-label">CA généré</div>
        </div>
        <div class="patient-stat-card">
          <div class="patient-stat-val kpi-value">${empSales.length}</div>
          <div class="patient-stat-label">Ventes</div>
        </div>
        <div class="patient-stat-card">
          <div class="patient-stat-val kpi-value">${UI.formatCurrency(avgTicket)}</div>
          <div class="patient-stat-label">Ticket moyen</div>
        </div>
        <div class="patient-stat-card">
          <div class="patient-stat-val">${lastSale ? UI.formatDate(lastSale) : '—'}</div>
          <div class="patient-stat-label">Dernière vente</div>
        </div>
      </div>

      <!-- Performance 3 mois -->
      <div style="margin-top:16px;">
        <h4 style="font-size:14px;margin-bottom:8px;"><i data-lucide="trending-up"></i> Performance (3 derniers mois)</h4>
        <table class="data-table">
          <thead><tr><th>Mois</th><th>Nb Ventes</th><th>CA</th></tr></thead>
          <tbody>
            ${months.map(m => `<tr><td>${m.label}</td><td><strong>${m.count}</strong></td><td>${UI.formatCurrency(m.total)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Dernières ventes -->
      <div style="margin-top:16px;">
        <h4 style="font-size:14px;margin-bottom:8px;"><i data-lucide="receipt"></i> Dernières ventes</h4>
        ${empSales.length === 0 ? '<p class="text-muted">Aucune vente enregistrée</p>' : `
          <table class="data-table">
            <thead><tr><th>Date</th><th>Patient</th><th>Montant</th><th>Paiement</th></tr></thead>
            <tbody>
              ${empSales.sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 15).map(s => `
                <tr>
                  <td>${UI.formatDate(s.date)}</td>
                  <td>${s.patientName || '<span class="text-muted">—</span>'}</td>
                  <td><strong>${UI.formatCurrency(s.total || 0)}</strong></td>
                  <td><span class="badge badge-${s.paymentMethod === 'credit' ? 'danger' : 'success'}">${s.paymentMethod || 'Espèces'}</span></td>
                </tr>`).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `, { size: 'large' });
  if (window.lucide) lucide.createIcons();
  if (window._autoAnimateKPIValues) setTimeout(_autoAnimateKPIValues, 100);
}

async function saveDeviceName() {
  var input = document.getElementById('device-name-input');
  if (!input || !input.value.trim()) {
    UI.toast('Veuillez entrer un nom pour cet appareil', 'warning');
    return;
  }
  var name = input.value.trim();
  localStorage.setItem('pharma_device_name', name);
  if (DB.AppState) DB.AppState.deviceName = name;

  // Pousser le nouveau nom DIRECTEMENT vers Supabase
  try {
    var sb = await DB.getSupabaseClient();
    if (sb) {
      var deviceId = localStorage.getItem('pharma_device_id');
      var isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
      var heartbeat = {
        key: 'device_status_' + deviceId,
        value: JSON.stringify({
          name: name,
          last_sync: Date.now(),
          pending: 0,
          online: true,
          type: isMobileDevice ? 'mobile' : 'desktop'
        })
      };
      var res = await sb.from('settings').upsert(heartbeat, { onConflict: 'key' });
      if (res.error) {
        console.error('[Device] Erreur upsert:', res.error.message);
        UI.toast('Nom sauvegardé localement', 'info');
      } else {
        UI.toast('✅ "' + name + '" — synchronisé !', 'success');
        console.log('[Device] ✅ Nom mis à jour : ' + name);
        // Re-push après 2s pour écraser tout heartbeat automatique
        setTimeout(async function() {
          try {
            heartbeat.value = JSON.stringify({ name: name, last_sync: Date.now(), pending: 0, online: true, type: isMobileDevice ? 'mobile' : 'desktop' });
            await sb.from('settings').upsert(heartbeat, { onConflict: 'key' });
          } catch(e2) {}
        }, 2000);
      }
      if (window.loadDeviceCount) loadDeviceCount();
      // Toujours rafraîchir le moniteur
      if (window.UI && UI.openSyncMonitor) {
        var monitorModal = document.getElementById('sync-monitor-modal');
        if (monitorModal && monitorModal.style.display === 'flex') {
          setTimeout(function() { UI.openSyncMonitor(); }, 500);
        }
      }
    } else {
      UI.toast('Nom sauvegardé localement', 'info');
    }
  } catch(e) {
    console.error('[Device] Exception:', e);
    UI.toast('Nom sauvegardé localement', 'info');
  }
}

window.saveDeviceName = saveDeviceName;

async function loadDeviceCount() {
  const el = document.getElementById('settings-device-count');
  if (!el) return;
  try {
    if ((window.NM && !window.NM.isOnline()) || !navigator.onLine || (window.DB && window.DB.AppState && (window.DB.AppState._confirmedOffline || !window.DB.AppState.isOnline))) { el.textContent = 'Hors ligne'; return; }
    const sb = await DB.getSupabaseClient();
    if (!sb || (window.NM && !window.NM.isOnline())) { el.textContent = 'Non configuré'; return; }
    // Entourer la requête Supabase dans son propre try/catch pour absorber
    // silencieusement les échecs réseau si la connexion tombe en cours de requête
    var data;
    try {
      const result = await sb.from('settings').select('value').like('key', 'device_status_%');
      if (result.error) { el.textContent = 'Hors ligne'; return; }
      data = result.data;
    } catch (reqErr) {
      el.textContent = 'Hors ligne'; return;
    }

    // Chaque device_id = un appareil distinct (pas de dédup par nom)
    var allDevices = [];
    var now = Date.now();
    var ACTIVE_THRESHOLD = 48 * 3600000;
    (data || []).forEach(function(row) {
      try {
        var s = JSON.parse(row.value);
        allDevices.push(s);
      } catch(e) {}
    });
    var devices = allDevices.filter(function(d) { return (now - d.last_sync) < ACTIVE_THRESHOLD; });
    var count = devices.length;
    var onlineNow = devices.filter(function(d) { return d.online && (now - d.last_sync < 3600000); }).length;

    el.textContent = count + ' appareil' + (count > 1 ? 's' : '') + ' (' + onlineNow + ' en ligne)';
    el.className = 'badge ' + (count > 1 ? 'badge-warning' : 'badge-info');
    el.style.fontSize = '0.85rem';
    el.style.cursor = 'pointer';
  } catch(e) {
    el.textContent = 'Erreur réseau';
  }
}

window.loadDeviceCount = loadDeviceCount;

Router.register('login', renderLogin);
Router.register('settings', renderSettings);

