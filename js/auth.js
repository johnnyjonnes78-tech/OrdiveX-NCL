/**
 * OrdiveX — Auth & Router
 */

const Auth = {
  async login(username, password) {
    const users = await DB.dbGetAll('users');
    const uInput = String(username || '').trim().toLowerCase();
    const pInput = String(password || '').trim();

    console.log('[Auth] Attempting login for:', uInput);
    console.log('[Auth] Users in database:', users.map(u => ({
      username: u.username,
      pwd_len: String(u.password).length,
      active: u.active
    })));

    const user = users.find(u => {
      const dbUser = String(u.username || '').trim().toLowerCase();
      const dbPass = String(u.password || '').trim();
      return (dbUser === uInput && dbPass === pInput);
    });

    if (!user) {
      console.warn('[Auth] Login failed: Credentials mismatch.');
      return null;
    }
    if (!user.active) {
      console.warn('[Auth] Login failed: Account is inactive.');
      return null;
    }
    const session = { id: 'session_' + Date.now(), userId: user.id, username: user.username, role: user.role, name: user.name, loginTime: Date.now() };
    await DB.dbPut('sessions', session);
    DB.AppState.currentUser = { ...user, sessionId: session.id };
    await DB.writeAudit('LOGIN', 'session', session.id, { username }, user.id);
    // Charger les permissions dynamiques pour ce rôle
    await Auth.loadPermissions();
    // Forcer la mise à jour immédiate du sidebar et topbar avec le BON utilisateur
    setTimeout(() => {
      if (typeof initSidebar === 'function') initSidebar();
      if (typeof updateTopbar === 'function') updateTopbar();
      if (typeof AlertsEngine !== 'undefined') AlertsEngine.start();
      if (typeof updateAlertBadge !== 'undefined') updateAlertBadge();
      if (window.SecurityLock) window.SecurityLock.reloadConfig();
    }, 500);
    return DB.AppState.currentUser;
  },

  async loadPermissions() {
    const user = DB.AppState.currentUser;
    if (!user) return;
    try {
      const rec = await DB.dbGetByKey('settings', `user_permissions_${user.id}`).catch(() => null);
      if (rec && rec.value) {
        user.permissions = JSON.parse(rec.value);
      } else {
        user.permissions = {};
      }
    } catch (e) {
      console.error('[Auth] Error loading permissions:', e);
      user.permissions = {};
    }
  },

  async logout() {
    if (DB.AppState.currentUser) {
      await DB.writeAudit('LOGOUT', 'session', null, {}, DB.AppState.currentUser.id);
    }
    if (window.SecurityLock) window.SecurityLock.stop();
    DB.AppState.currentUser = null;
    Router.navigate('login');
  },

  async checkSession() {
    // Simple session check via AppState
    return DB.AppState.currentUser;
  },

  async restoreSession() {
    // Session restoration disabled to force login on every app start as requested
    return null;
  },

  can(action) {
    const user = DB.AppState.currentUser;
    if (!user) return false;
    // Admin a toutes les permissions
    if (user.role === 'admin') return true;
    const roleKey = String(user.role || '').toLowerCase().replace(/[\s-]+/g, '_');
    // 1. Vérifier les permissions individuelles (overrides par utilisateur)
    //    Stockées dans user.permissions : { perm_key: true|false }
    const userPerms = user.permissions || {};
    if (typeof userPerms[action] === 'boolean') {
      return userPerms[action];
    }
    // 2. Vérifier les permissions du rôle (chargées dynamiquement ou par défaut)
    const rolePerms = (window._rolePermissions || {})[roleKey] || Auth._defaultPerms[roleKey] || [];
    return rolePerms.includes(action);
  },

  // Permissions par défaut pour chaque rôle (modifiables depuis les Paramètres)
  _defaultPerms: {
    responsable: [
      'module_dashboard', 'module_sales', 'module_caisse', 'module_stock', 'module_products', 'module_inventory', 'module_achats', 'module_patients', 'module_accounting', 'module_rh', 'module_settings',
      'dashboard_voir_kpi',
      'sales_create', 'sales_edit', 'sales_cancel', 'sales_discount', 'sales_credit', 'sales_view_ca', 'sales_view_profit', 'sales_view_stats', 'sales_reprint',
      'caisse_depot_retrait', 'caisse_cloture', 'caisse_voir_historique',
      'stock_view', 'stock_view_purchase_price', 'stock_view_sale_price', 'stock_view_profit', 'stock_view_margin', 'stock_view_value', 'stock_edit', 'stock_export', 'stock_print',
      'inventory_create', 'inventory_adjust',
      'achats_create', 'achats_cancel',
      'patients_edit', 'patients_credit_limit',
      'accounting_view_journal', 'accounting_view_reports', 'accounting_export',
      'hr_manage_employees', 'hr_manage_attendance', 'hr_manage_payroll', 'hr_view_salary',
      'settings_edit', 'settings_users', 'settings_backup', 'settings_sync', 'settings_naomi'
    ],
    rh: [
      'module_rh',
      'hr_manage_employees', 'hr_manage_attendance', 'hr_manage_payroll', 'hr_view_salary'
    ],
    pharmacien: [
      'module_dashboard', 'module_sales', 'module_caisse', 'module_stock', 'module_products', 'module_inventory', 'module_achats', 'module_patients', 'module_accounting', 'module_rh',
      'dashboard_voir_kpi',
      'sales_create', 'sales_cancel', 'sales_discount', 'sales_credit', 'sales_view_ca', 'sales_view_stats', 'sales_reprint',
      'caisse_depot_retrait', 'caisse_cloture', 'caisse_voir_historique',
      'stock_view', 'stock_view_purchase_price', 'stock_view_sale_price', 'stock_view_value', 'stock_edit', 'stock_export', 'stock_print',
      'inventory_create', 'inventory_adjust',
      'achats_create',
      'patients_edit',
      'accounting_view_journal', 'accounting_view_reports',
      'hr_manage_employees', 'hr_manage_attendance'
    ],
    caissier: [
      'module_sales', 'module_caisse',
      'sales_create', 'sales_discount', 'sales_reprint'
    ],
    receptionniste: [
      'module_sales',
      'sales_create', 'sales_reprint'
    ],
    gestionnaire_stock: [
      'module_stock', 'module_products', 'module_inventory',
      'stock_view', 'stock_view_sale_price', 'stock_edit', 'stock_export', 'stock_print',
      'inventory_create'
    ],
    comptable: [
      'module_dashboard', 'module_accounting',
      'dashboard_voir_kpi',
      'sales_view_ca', 'sales_view_profit', 'sales_view_stats',
      'stock_view_value',
      'accounting_view_journal', 'accounting_view_reports', 'accounting_export'
    ],
    assistant: [],
  },

  ALL_PERMISSIONS: [
    // === ACCÈS MODULES ===
    { key: 'module_dashboard',         label: 'Accéder au Tableau de Bord',                   cat: 'modules' },
    { key: 'module_sales',             label: 'Accéder aux Ventes (POS/Historique)',          cat: 'modules' },
    { key: 'module_caisse',            label: 'Accéder à la Caisse Journalière',              cat: 'modules' },
    { key: 'module_stock',             label: 'Accéder au module Stock & Mouvements',         cat: 'modules' },
    { key: 'module_products',          label: 'Accéder au Catalogue Produits',                cat: 'modules' },
    { key: 'module_inventory',         label: 'Accéder aux Inventaires Physiques',            cat: 'modules' },
    { key: 'module_achats',            label: 'Accéder au module Achats & Fournisseurs',      cat: 'modules' },
    { key: 'module_patients',          label: 'Accéder aux Dossiers Patients & Assurances',   cat: 'modules' },
    { key: 'module_accounting',        label: 'Accéder au module Comptabilité',               cat: 'modules' },
    { key: 'module_rh',                label: 'Accéder aux Ressources Humaines',              cat: 'modules' },
    { key: 'module_settings',          label: 'Accéder aux Paramètres Généraux',              cat: 'modules' },

    // === TABLEAU DE BORD ===
    { key: 'dashboard_voir_kpi',       label: 'Voir les indicateurs financiers globaux',      cat: 'dashboard' },

    // === VENTES ===
    { key: 'sales_create',             label: 'Créer de nouvelles ventes',                    cat: 'sales' },
    { key: 'sales_edit',               label: 'Modifier des ventes existantes',               cat: 'sales' },
    { key: 'sales_cancel',             label: 'Annuler ou rembourser des ventes',             cat: 'sales' },
    { key: 'sales_discount',           label: 'Appliquer des remises au POS',                 cat: 'sales' },
    { key: 'sales_credit',             label: 'Autoriser les ventes à crédit / dette',        cat: 'sales' },
    { key: 'sales_view_ca',            label: 'Voir le chiffre d\'affaires des ventes',       cat: 'sales' },
    { key: 'sales_view_profit',        label: 'Voir le bénéfice généré par les ventes',       cat: 'sales' },
    { key: 'sales_view_stats',         label: 'Voir les rapports et statistiques de ventes',  cat: 'sales' },
    { key: 'sales_reprint',            label: 'Réimprimer les tickets / reçus',               cat: 'sales' },

    // === CAISSE ===
    { key: 'caisse_depot_retrait',     label: 'Mouvements manuels de caisse (dépôt/retrait)',  cat: 'caisse' },
    { key: 'caisse_cloture',           label: 'Faire la clôture journalière de la caisse',     cat: 'caisse' },
    { key: 'caisse_voir_historique',   label: 'Voir l\'historique des transactions de caisse', cat: 'caisse' },

    // === STOCK & PRODUITS ===
    { key: 'stock_view',               label: 'Voir les quantités de stock physique',          cat: 'stock' },
    { key: 'stock_view_purchase_price',label: 'Voir les prix d\'achat fournisseur',           cat: 'stock' },
    { key: 'stock_view_sale_price',    label: 'Voir les prix de vente publics',               cat: 'stock' },
    { key: 'stock_view_profit',        label: 'Voir les bénéfices par lot/produit',           cat: 'stock' },
    { key: 'stock_view_margin',        label: 'Voir les marges bénéficiaires',                cat: 'stock' },
    { key: 'stock_view_value',         label: 'Voir la valeur financière globale du stock',   cat: 'stock' },
    { key: 'stock_edit',               label: 'Modifier ou ajouter des produits/stocks',      cat: 'stock' },
    { key: 'stock_export',             label: 'Exporter la liste du stock (CSV/Excel)',       cat: 'stock' },
    { key: 'stock_print',              label: 'Imprimer les fiches et états de stock',        cat: 'stock' },

    // === INVENTAIRE ===
    { key: 'inventory_create',         label: 'Lancer et enregistrer un inventaire',          cat: 'inventory' },
    { key: 'inventory_adjust',         label: 'Valider et appliquer les ajustements d\'écarts',cat: 'inventory' },

    // === ACHATS & FOURNISSEURS ===
    { key: 'achats_create',            label: 'Créer des bons de commande & factures d\'achat',cat: 'achats' },
    { key: 'achats_cancel',            label: 'Annuler ou supprimer des factures d\'achat',    cat: 'achats' },

    // === PATIENTS & ASSURANCES ===
    { key: 'patients_edit',            label: 'Gérer les fiches patients & assurances',       cat: 'patients' },
    { key: 'patients_credit_limit',    label: 'Modifier les plafonds de crédit autorisés',    cat: 'patients' },

    // === COMPTABILITÉ ===
    { key: 'accounting_view_journal',  label: 'Voir le journal des écritures comptables',     cat: 'accounting' },
    { key: 'accounting_view_reports',  label: 'Voir la balance, bilans et rapports financiers',cat: 'accounting' },
    { key: 'accounting_export',        label: 'Exporter les journaux et rapports (PDF/CSV)',  cat: 'accounting' },

    // === RESSOURCES HUMAINES ===
    { key: 'hr_manage_employees',      label: 'Gérer les fiches employés & contrats',         cat: 'hr' },
    { key: 'hr_manage_attendance',     label: 'Enregistrer et gérer les pointages/présences', cat: 'hr' },
    { key: 'hr_manage_payroll',        label: 'Gérer les paies, primes, retenues et avances', cat: 'hr' },
    { key: 'hr_view_salary',           label: 'Voir les salaires et éditer les bulletins paie',cat: 'hr' },

    // === CONFIGURATION & SYSTÈME ===
    { key: 'settings_edit',            label: 'Modifier les paramètres généraux de l\'ERP',    cat: 'admin' },
    { key: 'settings_users',           label: 'Gérer les utilisateurs et leurs permissions',  cat: 'admin' },
    { key: 'settings_backup',          label: 'Faire des sauvegardes et restaurations',       cat: 'admin' },
    { key: 'settings_sync',            label: 'Piloter la synchronisation Supabase',          cat: 'admin' },
    { key: 'settings_naomi',           label: 'Interagir avec l\'assistant Naomi IA',         cat: 'admin' },
  ],

  ALL_PERMISSION_CATS: [
    { key: 'modules',    label: '🧩 Accès aux Modules de l\'ERP' },
    { key: 'dashboard',  label: '📊 Tableau de Bord (KPIs)' },
    { key: 'sales',      label: '🛒 Point de Vente & Ventes' },
    { key: 'caisse',     label: '🏧 Caisse Journalière' },
    { key: 'stock',      label: '📦 Stock & Catalogue' },
    { key: 'inventory',  label: '📋 Inventaires Physiques' },
    { key: 'achats',     label: '💼 Fournisseurs & Achats' },
    { key: 'patients',   label: '👥 Patients & Assurances' },
    { key: 'accounting', label: '📒 Comptabilité Générale' },
    { key: 'hr',         label: '👔 Ressources Humaines' },
    { key: 'admin',      label: '⚙️ Paramètres & Système' },
  ],

  ALL_ROLES: [
    { key: 'responsable',        label: 'Responsable / Manager' },
    { key: 'rh',                 label: 'Directeur RH' },
    { key: 'pharmacien',         label: 'Pharmacien' },
    { key: 'caissier',           label: 'Caissier' },
    { key: 'receptionniste',     label: 'Réceptionniste' },
    { key: 'gestionnaire_stock', label: 'Gestionnaire de stock' },
    { key: 'comptable',          label: 'Comptable' },
    { key: 'assistant',          label: 'Assistant' },
  ],
};

const Router = {
  routes: {},
  currentPage: null,
  _cleanupFns: [],

  // Enregistrer une fonction de cleanup pour la page courante
  // Appelee automatiquement avant de quitter la page
  onLeave(fn) {
    if (typeof fn === 'function') this._cleanupFns.push(fn);
  },

  _runCleanup() {
    var fns = this._cleanupFns.slice();
    this._cleanupFns = [];
    for (var i = 0; i < fns.length; i++) {
      try { fns[i](); } catch(e) { /* silencieux */ }
    }
  },

  register(name, renderFn) {
    this.routes[name] = renderFn;
    if (this.currentPage === name) {
      const main = document.getElementById('app-content');
      if (main && main.innerHTML.includes('Page introuvable')) {
        this.render(name);
      }
    }
  },

  navigate(page, params) {
    params = params || {};
    if (!DB.AppState.currentUser && page !== 'login' && page !== 'onboarding') {
      page = 'login';
    }
    // Cleanup de la page precedente AVANT de changer
    this._runCleanup();
    this.currentPage = page;
    DB.AppState.currentPage = page;
    this.render(page, params);
    this.updateNav(page);
  },

  render(page, params) {
    const main = document.getElementById('app-content');
    if (!main) return;

    // Nettoyage memoire des donnees temporaires de la page precedente
    const tempKeys = ['_stockData', '_salesData', '_saleItemsData', '_ordersData', '_ordersSupplierMap', '_ordersProducts',
      '_reorderSuggestions', '_inventoryItems', '_traceProductMap', '_traceLots', '_traceMovements',
      '_tracePrescriptions', '_tracePatients', '_currentReceiveOrder', '_allProducts'];
    tempKeys.forEach(function(k) { try { delete window[k]; } catch(e) {} });

    const fn = this.routes[page];
    if (fn) {
      main.innerHTML = '';
      try {
        const result = fn(main, params);
        if (result && typeof result.catch === 'function') {
          result.catch(function(err) {
            console.error('[Router] Erreur async dans "' + page + '":', err);
            main.innerHTML = '<div class="empty-state"><div style="font-size:48px;margin-bottom:16px">!</div><h2>Erreur de chargement</h2><p style="color:var(--text-muted);margin:8px 0">' + (err.message || 'Erreur inconnue') + '</p><button class="btn btn-primary" style="margin-top:12px" onclick="Router.navigate(\'' + page + '\')">Reessayer</button><button class="btn btn-secondary" style="margin-top:12px;margin-left:8px" onclick="Router.navigate(\'dashboard\')">Tableau de bord</button></div>';
          });
        }
      } catch (err) {
        console.error('[Router] Erreur dans "' + page + '":', err);
        main.innerHTML = '<div class="empty-state"><div style="font-size:48px;margin-bottom:16px">!</div><h2>Erreur de chargement</h2><p style="color:var(--text-muted);margin:8px 0">' + (err.message || 'Erreur inconnue') + '</p><button class="btn btn-primary" style="margin-top:12px" onclick="Router.navigate(\'' + page + '\')">Reessayer</button><button class="btn btn-secondary" style="margin-top:12px;margin-left:8px" onclick="Router.navigate(\'dashboard\')">Tableau de bord</button></div>';
      }
    } else {
      main.innerHTML = '<div class="empty-state"><h2>Page introuvable : ' + page + '</h2></div>';
    }
  },

  updateNav(page) {
    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.page === page);
    });
  }
};


window.Auth = Auth;
window.Router = Router;

window.normalizeText = function(str) {
  if (!str) return '';
  return str.trim()
    .toLowerCase()
    .replace(/(^|\s|[-'\/\(\)\.\,])(\S)/g, (m, sep, c) => sep + c.toUpperCase());
};
