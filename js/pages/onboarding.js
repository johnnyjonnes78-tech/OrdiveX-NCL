/**
 * OrdiveX — onboarding.js
 * Comprehensive pharmacy setup wizard
 */

const Onboarding = {
  step: 1,
  totalSteps: 4,
  data: {},

  init: async function (container) {
    this.container = container;

    // Hide sidebar and topbar during onboarding (full-screen experience)
    document.getElementById('app-sidebar')?.style.setProperty('display', 'none');
    document.getElementById('app-topbar')?.style.setProperty('display', 'none');
    document.getElementById('app-content').style.marginLeft = '0';
    document.getElementById('app-content').style.paddingTop = '0';

    // Load existing settings if any
    const settings = await DB.dbGetAll('settings');
    settings.forEach(s => {
      this.data[s.key] = s.value;
    });
    this.render();
  },

  render: function () {
    this.container.innerHTML = `
      <div class="onboarding-layout">
        <div class="onboarding-brand-badge premium-style no-print">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary)"><path d="m7 8-4 4 4 4"/><path d="m17 8 4 4-4 4"/><path d="m14 4-4 16"/></svg>
          <span>Par <strong>TrillionX</strong></span>
        </div>
        <div class="onboarding-card elite-card">
          <div class="onboarding-header">
            <div class="onboarding-logo">
              <i data-lucide="activity"></i>
            </div>
            <div class="onboarding-progress">
              <div class="progress-text">Étape ${this.step} sur ${this.totalSteps}</div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${(this.step / this.totalSteps) * 100}%"></div>
              </div>
            </div>
          </div>

          <div class="onboarding-body">
            ${this.renderStep()}
          </div>

          <div class="onboarding-footer">
            ${this.step > 1 ? `<button class="btn btn-ghost" onclick="Onboarding.prev()"><i data-lucide="arrow-left"></i> Retour</button>` : '<div></div>'}
            <button class="btn btn-primary" onclick="Onboarding.next()">
              ${this.step === this.totalSteps ? 'Terminer la configuration' : 'Suivant'} <i data-lucide="${this.step === this.totalSteps ? 'check' : 'arrow-right'}"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  },

  renderStep: function () {
    switch (this.step) {
      case 1:
        return `
          <h2 class="onboarding-title">Identité de votre Pharmacie</h2>
          <p class="onboarding-subtitle">Ces informations apparaîtront sur vos factures et rapports.</p>
          <div class="form-grid">
            <div class="form-group">
              <label>Nom de la pharmacie</label>
              <input type="text" id="ob-pharmacy_name" class="form-control" value="${this.data.pharmacy_name || ''}" placeholder="Ex: Pharmacie du Bonheur">
            </div>
            <div class="form-group">
              <label>Slogan ou Phrase d'accroche</label>
              <input type="text" id="ob-pharmacy_slogan" class="form-control" value="${this.data.pharmacy_slogan || ''}" placeholder="Ex: Votre santé est notre priorité">
            </div>
            <div class="form-group">
              <label>Adresse complète</label>
              <input type="text" id="ob-pharmacy_address" class="form-control" value="${this.data.pharmacy_address || ''}" placeholder="Ex: Avenue de la République, Conakry">
            </div>
            <div class="form-group">
              <label>Logo (recommandé)</label>
              <div class="logo-onboarding-preview">
                ${this.data.pharmacy_logo ? `<img src="${this.data.pharmacy_logo}" style="max-height: 60px;">` : `<div class="placeholder"><i data-lucide="image"></i></div>`}
                <button class="btn btn-xs btn-secondary" onclick="document.getElementById('ob-logo-upload').click()">Choisir...</button>
                <input type="file" id="ob-logo-upload" hidden onchange="Onboarding.handleLogo(event)">
              </div>
            </div>
          </div>
          <div class="onboarding-restore-area no-print">
            <div class="divider"><span>OU</span></div>
            <p class="text-center text-muted small mb-2">Déjà configuré sur un autre appareil ?</p>
            <button class="btn btn-sm btn-outline w-100" onclick="Onboarding.showRestore()">
              <i data-lucide="cloud-download"></i> Restaurer via Magic Link
            </button>
          </div>
        `;
      case 2:
        return `
          <h2 class="onboarding-title">Contact & Réglementation</h2>
          <p class="onboarding-subtitle">Indispensable pour la conformité DNPM.</p>
          <div class="form-grid">
            <div class="form-group">
              <label>Téléphone de contact</label>
              <input type="text" id="ob-pharmacy_phone" class="form-control" value="${this.data.pharmacy_phone || ''}" placeholder="Ex: +224 620 00 00 00">
            </div>
            <div class="form-group">
              <label>Email professionnel</label>
              <input type="email" id="ob-pharmacy_email" class="form-control" value="${this.data.pharmacy_email || ''}" placeholder="Ex: contact@pharmacie.gn">
            </div>
            <div class="form-group">
              <label>N° Licence DNPM</label>
              <input type="text" id="ob-pharmacy_dnpm" class="form-control" value="${this.data.pharmacy_dnpm || ''}" placeholder="Ex: LIC-2024-XXX">
            </div>
            <div class="form-group">
              <label>Pharmacien responsable</label>
              <input type="text" id="ob-pharmacy_resp" class="form-control" value="${this.data.pharmacy_resp || ''}" placeholder="Nom du Dr en Pharmacie">
            </div>
          </div>
        `;
      case 3:
        return `
          <h2 class="onboarding-title">Configuration Technique</h2>
          <p class="onboarding-subtitle">Paramètres par défaut pour votre gestion.</p>
          <div class="form-grid">
            <div class="form-group">
              <label>Seuil d'alerte stock (unités)</label>
              <input type="number" id="ob-min_stock_alert" class="form-control" value="${this.data.min_stock_alert || 10}">
              <small>Quantité en deçà de laquelle une alerte est générée.</small>
            </div>
            <div class="form-group">
              <label>Délai alerte expiration (jours)</label>
              <input type="number" id="ob-expiry_alert_days" class="form-control" value="${this.data.expiry_alert_days || 90}">
              <small>Nombre de jours avant péremption pour déclencher l'alerte.</small>
            </div>
            <div class="form-group">
              <label>Devise locale</label>
              <input type="text" id="ob-currency" class="form-control" value="${this.data.currency || 'GNF'}" disabled>
            </div>
          </div>
          <div class="info-box-small success mt-1">
            <i data-lucide="shield-check"></i>
            <span>Vos données sont stockées localement et en toute sécurité.</span>
          </div>
        `;
      case 4:
        return `
          <h2 class="onboarding-title">Sécurité du Compte Admin</h2>
          <p class="onboarding-subtitle">Remplacez le mot de passe "admin123" par défaut.</p>
          <div class="form-grid">
            <div class="form-group">
              <label>Nouveau mot de passe administrateur *</label>
              <input type="password" id="ob-admin_password" class="form-control" placeholder="Minimum 6 caractères" required>
            </div>
            <div class="form-group">
              <label>Confirmer le mot de passe *</label>
              <input type="password" id="ob-admin_password_confirm" class="form-control" placeholder="Répétez le mot de passe" required>
            </div>
          </div>
          <div class="info-box-small warning mt-2">
            <i data-lucide="shield-alert"></i>
            <span><strong>Important</strong> : Notez bien ce mot de passe. Vous en aurez besoin pour votre première connexion.</span>
          </div>
        `;
    }
  },

  handleLogo: function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      this.data.pharmacy_logo = re.target.result;
      this.render();
    };
    reader.readAsDataURL(file);
  },

  saveCurrentStep: function () {
    const fields = {
      1: ['pharmacy_name', 'pharmacy_slogan', 'pharmacy_address'],
      2: ['pharmacy_phone', 'pharmacy_email', 'pharmacy_dnpm', 'pharmacy_resp'],
      3: ['min_stock_alert', 'expiry_alert_days', 'currency'],
      4: ['admin_password', 'admin_password_confirm']
    };
    fields[this.step].forEach(f => {
      const el = document.getElementById(`ob-${f}`);
      if (el) this.data[f] = el.value;
    });
  },

  next: async function () {
    this.saveCurrentStep();

    // Validation étape 1 : nom de pharmacie obligatoire
    if (this.step === 1 && (!this.data.pharmacy_name || !this.data.pharmacy_name.trim())) {
      UI.toast('Le nom de la pharmacie est obligatoire', 'error');
      return;
    }

    if (this.step === 4) {
      if (!this.data.admin_password || this.data.admin_password.length < 6) {
        UI.toast('Le mot de passe doit faire au moins 6 caractères', 'error');
        return;
      }
      if (this.data.admin_password !== this.data.admin_password_confirm) {
        UI.toast('Les mots de passe ne correspondent pas', 'error');
        return;
      }
    }
    if (this.step < this.totalSteps) {
      this.step++;
      this.render();
    } else {
      await this.finish();
    }
  },

  prev: function () {
    this.saveCurrentStep();
    if (this.step > 1) {
      this.step--;
      this.render();
    }
  },

  finish: async function () {
    UI.loading(this.container, 'Sécurisation et finalisation...');
    try {
      // 1. Create or Update Admin Account
      const users = await DB.dbGetAll('users');
      let admin = users.find(u => u.username === 'admin');

      const adminData = {
        username: 'admin',
        password: this.data.admin_password,
        role: 'admin',
        name: this.data.pharmacy_resp || 'Administrateur',
        email: this.data.pharmacy_email || 'admin@pharma.gn',
        active: true
      };

      if (admin) {
        await DB.dbPut('users', { ...admin, ...adminData });

      } else {
        await DB.dbAdd('users', adminData);

      }

      // 2. Save all pharmacy settings
      const settingsToSave = [
        'pharmacy_name', 'pharmacy_slogan', 'pharmacy_address', 'pharmacy_logo',
        'pharmacy_phone', 'pharmacy_email', 'pharmacy_dnpm', 'pharmacy_resp',
        'min_stock_alert', 'expiry_alert_days', 'currency',
        'supabase_url', 'supabase_key'
      ];
      for (const key of settingsToSave) {
        if (this.data[key] !== undefined) {
          await DB.dbPut('settings', { key, value: this.data[key] });
        }
      }

      // 3. Mark as done
      await DB.dbPut('settings', { key: 'onboarding_done', value: true });

      // 4. Reset Supabase client to use the new keys just saved
      if (DB.resetSupabaseClient) {
        DB.resetSupabaseClient();
      }

      // 5. Track installation (Remote)
      if (DB.trackInstallation) {
        await DB.trackInstallation();
      }

      // --- Force initial sync / Pull existing data if any ---
      try {
        if (DB.pullFromSupabase) {

          await DB.pullFromSupabase();
        }
        if (DB.syncToSupabase) {

          await DB.syncToSupabase();
        }
      } catch (syncErr) {
        console.warn('[Onboarding] Initial sync/pull partial failure:', syncErr);
      }

      UI.toast('Configuration terminée ! Connectez-vous avec votre nouveau mot de passe.', 'success', 5000);

      // 5. Restore sidebar/topbar and update display
      document.getElementById('app-sidebar')?.style.removeProperty('display');
      document.getElementById('app-topbar')?.style.removeProperty('display');
      document.getElementById('app-content').style.marginLeft = '';
      document.getElementById('app-content').style.paddingTop = '';
      if (window.updatePharmacyDisplay) await updatePharmacyDisplay();
      Router.navigate('login');
    } catch (err) {
      console.error(err);
      UI.toast('Erreur lors de la sauvegarde : ' + err.message, 'error');
      this.render();
    }
  },

  showRestore: function () {
    UI.modal('Restaurer via Magic Link', `
      <div class="p-3">
        <p class="mb-3 small">Collez ici le Magic Link que vous avez reçu par email ou WhatsApp lors de votre première configuration.</p>
        <div class="form-group">
          <label>URL du Magic Link</label>
          <textarea id="restore-magic-link" class="form-control" rows="3" placeholder="https://..."></textarea>
        </div>
      </div>
    `, {
      footer: `
        <button class="btn btn-ghost" onclick="UI.closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="Onboarding.handleRestore()">Restaurer maintenant</button>
      `
    });
  },

  handleRestore: async function () {
    const link = document.getElementById('restore-magic-link').value;
    if (!link || !link.includes('sb_url=')) {
      UI.toast('Lien invalide. Il doit contenir "sb_url=" et "sb_key="', 'error');
      return;
    }

    UI.closeModal();

    // Afficher un écran de progression détaillé
    this.container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:80vh">
        <div style="text-align:center;width:100%;max-width:400px;padding:40px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-lg)">
          <div style="width:64px;height:64px;border:4px solid var(--border);border-top-color:var(--primary);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 20px"></div>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Synchronisation Cloud</h2>
          <p id="restore-status" style="color:var(--text-muted);font-size:14px;margin-bottom:12px;min-height:40px">
            Connexion au serveur cloud...
          </p>
          <div style="width:100%;height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin:15px 0 20px">
            <div id="restore-progress-bar" style="width:0%;height:100%;background:var(--primary);transition:width 0.3s ease"></div>
          </div>
          <p style="color:var(--text-muted);font-size:12px;line-height:1.5">
            ⚠️ <strong>Ne fermez pas l'application.</strong><br>Cette première récupération contient plus de 30 000 médicaments et peut durer quelques minutes.
          </p>
        </div>
      </div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    `;

    const storeFriendlyNames = {
      users: 'Utilisateurs',
      settings: 'Paramètres généraux',
      products: 'Catalogue des médicaments',
      lots: 'Lots et péremptions',
      stock: 'Niveaux de stock',
      movements: 'Historique des mouvements',
      suppliers: 'Fournisseurs',
      purchaseOrders: 'Bons de commande',
      sales: 'Historique des ventes',
      saleItems: 'Détails des ventes',
      patients: 'Fiches patients',
      prescriptions: 'Ordonnances',
      alerts: 'Alertes de sécurité',
      cashRegister: 'Sessions de caisse',
      returns: 'Retours produits',
      invoices: 'Factures tiers-payant',
      shifts: 'Planning & Présences',
      insurances: 'Organismes d\'assurance',
      insurancePayments: 'Règlements mutuelles'
    };

    const updateStatus = (msg) => {
      const el = document.getElementById('restore-status');
      if (el) el.textContent = msg;
    };

    try {
      const url = new URL(link);
      const params = new URLSearchParams(url.search);
      const sbUrl = params.get('sb_url');
      const sbKey = params.get('sb_key');

      if (sbUrl && sbKey) {
        updateStatus('Configuration de la connexion cloud...');
        await DB.dbPut('settings', { key: 'supabase_url', value: sbUrl });
        await DB.dbPut('settings', { key: 'supabase_key', value: sbKey });
        DB.resetSupabaseClient();

        // IMPORTANT : supprimer le timestamp de dernier pull pour forcer un pull COMPLET
        localStorage.removeItem('pharma_last_pull_ts');

        updateStatus('Téléchargement de toutes les données...');

        // Callback pour mettre à jour la barre de progression en temps réel
        const onProgress = (p) => {
          const friendly = storeFriendlyNames[p.storeName] || p.storeName;
          const pct = Math.round((p.index / p.total) * 100);
          
          const bar = document.getElementById('restore-progress-bar');
          if (bar) bar.style.width = pct + '%';

          if (p.status === 'fetching') {
            updateStatus(`Téléchargement de ${friendly} (${p.index}/${p.total})...`);
          } else if (p.status === 'completed') {
            updateStatus(`Enregistrement : ${friendly} (${p.itemCount.toLocaleString()} lignes OK)`);
          } else if (p.status === 'failed') {
            updateStatus(`⚠️ Échec sur : ${friendly} (ignoré)`);
          }
        };

        // Pull COMPLET (isManual=true) avec callback de progression
        await DB.pullFromSupabase(true, onProgress);

        updateStatus('Vérification des données récupérées...');

        // Vérification complète : on vérifie les stores critiques
        const [allSettings, allProducts, allUsers, allSales, allStock] = await Promise.all([
          DB.dbGetAll('settings'),
          DB.dbGetAll('products'),
          DB.dbGetAll('users'),
          DB.dbGetAll('sales'),
          DB.dbGetAll('stock'),
        ]);

        const hasData = allSettings.length > 2 || allProducts.length > 0 || allUsers.length > 0 || allSales.length > 0;

        if (hasData) {
          await DB.dbPut('settings', { key: 'onboarding_done', value: true });
          localStorage.setItem('onboarding_done', 'true');

          const stats = [];
          if (allProducts.length > 0) stats.push(`${allProducts.length.toLocaleString()} produits`);
          if (allUsers.length > 0) stats.push(`${allUsers.length} utilisateurs`);
          if (allSales.length > 0) stats.push(`${allSales.length} ventes`);
          if (allStock.length > 0) stats.push(`${allStock.length} stocks`);
          const statsMsg = stats.length > 0 ? ` (${stats.join(', ')})` : '';

          UI.toast(`Synchronisation réussie !${statsMsg}`, 'success', 8000);

          document.getElementById('app-sidebar')?.style.removeProperty('display');
          document.getElementById('app-topbar')?.style.removeProperty('display');
          document.getElementById('app-content').style.marginLeft = '';
          document.getElementById('app-content').style.paddingTop = '';

          if (window.updatePharmacyDisplay) await updatePharmacyDisplay();
          Router.navigate('login');
        } else {
          UI.toast('Configuration Supabase OK, mais aucune donnée trouvée sur le cloud.', 'warning');
          this.render();
        }
      }
    } catch (e) {
      console.error('[Onboarding] Restore failed:', e);
      UI.toast('Erreur de restauration : ' + e.message, 'error');
      this.render();
    }
  }
};

window.renderOnboarding = (container) => Onboarding.init(container);
