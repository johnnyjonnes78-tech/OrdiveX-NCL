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
      'module_dashboard', 'module_sales', 'module_caisse', 'module_stock', 'module_products', 'module_inventory', 'module_achats', 'module_patients', 'module_accounting', 'module_rh', 'module_settings', 'module_naomi', 'module_shifts',
      'session_open', 'session_close', 'session_close_force', 'session_view_all', 'session_edit', 'session_reopen', 'session_cancel_close', 'session_reports', 'session_view_history',
      'sales_create', 'sales_edit', 'sales_cancel', 'sales_delete', 'sales_discount', 'sales_modify_price', 'sales_modify_qty', 'sales_reprint', 'sales_invoice_print', 'sales_pay_cash', 'sales_pay_mobile', 'sales_pay_credit', 'sales_pay_assurance', 'sales_view_ca', 'sales_view_profit', 'sales_view_margin', 'sales_view_stats', 'sales_export',
      'stock_view', 'stock_view_purchase_price', 'stock_view_sale_price', 'stock_view_profit', 'stock_view_margin', 'stock_view_value', 'stock_product_create', 'stock_product_edit', 'stock_product_delete', 'stock_lot_edit', 'stock_transfer', 'stock_adjust', 'stock_exit', 'stock_import', 'stock_export', 'stock_print',
      'inventory_view', 'inventory_create', 'inventory_edit', 'inventory_adjust', 'inventory_delete', 'inventory_export',
      'achats_view', 'achats_create', 'achats_edit', 'achats_send', 'achats_receive', 'achats_cancel', 'achats_delete', 'achats_supplier_edit', 'achats_supplier_delete',
      'patients_view', 'patients_create', 'patients_edit', 'patients_delete', 'patients_credit_limit', 'patients_debt_settle', 'patients_assurance_edit', 'patients_debt_print',
      'accounting_view_journal', 'accounting_view_reports', 'accounting_write', 'accounting_export',
      'caisse_depot_retrait', 'caisse_cloture', 'caisse_voir_historique',
      'hr_view_salary', 'hr_manage_employees', 'hr_manage_attendance', 'hr_manage_payroll', 'hr_write_caisse',
      'settings_view', 'settings_edit', 'settings_users', 'settings_permissions', 'settings_backup', 'settings_sync', 'settings_naomi'
    ],
    rh: [
      'module_rh',
      'hr_view_salary', 'hr_manage_employees', 'hr_manage_attendance', 'hr_manage_payroll', 'hr_write_caisse'
    ],
    pharmacien: [
      'module_dashboard', 'module_sales', 'module_caisse', 'module_stock', 'module_products', 'module_inventory', 'module_achats', 'module_patients', 'module_accounting', 'module_rh', 'module_shifts',
      'session_open', 'session_close', 'session_view_all', 'session_reports',
      'sales_create', 'sales_cancel', 'sales_discount', 'sales_modify_qty', 'sales_reprint', 'sales_invoice_print', 'sales_pay_cash', 'sales_pay_mobile', 'sales_pay_credit', 'sales_pay_assurance', 'sales_view_ca', 'sales_view_margin', 'sales_view_stats',
      'stock_view', 'stock_view_purchase_price', 'stock_view_sale_price', 'stock_view_profit', 'stock_view_margin', 'stock_view_value', 'stock_product_create', 'stock_product_edit', 'stock_lot_edit', 'stock_transfer', 'stock_adjust', 'stock_exit', 'stock_export', 'stock_print',
      'inventory_view', 'inventory_create', 'inventory_edit', 'inventory_adjust', 'inventory_export',
      'achats_view', 'achats_create', 'achats_edit', 'achats_send', 'achats_receive', 'achats_supplier_edit',
      'patients_view', 'patients_create', 'patients_edit', 'patients_debt_settle', 'patients_assurance_edit', 'patients_debt_print',
      'accounting_view_journal', 'accounting_view_reports',
      'caisse_depot_retrait', 'caisse_cloture', 'caisse_voir_historique',
      'hr_manage_employees', 'hr_manage_attendance'
    ],
    caissier: [
      'module_sales', 'module_caisse',
      'session_open', 'session_close',
      'sales_create', 'sales_discount', 'sales_modify_qty', 'sales_reprint', 'sales_pay_cash', 'sales_pay_mobile'
    ],
    receptionniste: [
      'module_sales',
      'session_open', 'session_close',
      'sales_create', 'sales_reprint', 'sales_pay_cash'
    ],
    gestionnaire_stock: [
      'module_stock', 'module_products', 'module_inventory', 'module_achats',
      'stock_view', 'stock_view_sale_price', 'stock_product_create', 'stock_product_edit', 'stock_lot_edit', 'stock_transfer', 'stock_adjust', 'stock_exit', 'stock_export', 'stock_print',
      'inventory_view', 'inventory_create', 'inventory_edit', 'inventory_export',
      'achats_view', 'achats_receive'
    ],
    comptable: [
      'module_dashboard', 'module_accounting',
      'sales_view_ca', 'sales_view_profit', 'sales_view_margin', 'sales_view_stats', 'sales_export',
      'stock_view_value', 'stock_export',
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
    { key: 'module_naomi',             label: 'Accéder à l\'assistant Naomi IA',              cat: 'modules' },
    { key: 'module_shifts',            label: 'Accéder au module Équipes Matin / Soir',        cat: 'modules' },

    // === SESSIONS ===
    { key: 'session_open',             label: 'Ouvrir sa propre session de vente',            cat: 'session' },
    { key: 'session_close',            label: 'Fermer et déclarer sa propre session',         cat: 'session' },
    { key: 'session_close_force',      label: 'Forcer la fermeture de la session d\'un tiers',cat: 'session' },
    { key: 'session_view_all',         label: 'Consulter toutes les sessions actives/passees',cat: 'session' },
    { key: 'session_edit',             label: 'Modifier les ecarts d\'une session',           cat: 'session' },
    { key: 'session_reopen',           label: 'Réouvrir une session clôturée',                cat: 'session' },
    { key: 'session_cancel_close',     label: 'Annuler la clôture d\'une session',            cat: 'session' },
    { key: 'session_reports',          label: 'Voir les rapports de clôture de session',      cat: 'session' },
    { key: 'session_view_history',     label: 'Consulter l\'historique des connexions',       cat: 'session' },

    // === VENTES ===
    { key: 'sales_create',             label: 'Créer de nouvelles ventes au POS',             cat: 'sales' },
    { key: 'sales_edit',               label: 'Modifier des ventes existantes (devis)',       cat: 'sales' },
    { key: 'sales_cancel',             label: 'Annuler ou rembourser des ventes',             cat: 'sales' },
    { key: 'sales_delete',             label: 'Supprimer une vente de l\'historique',         cat: 'sales' },
    { key: 'sales_discount',           label: 'Appliquer des remises au POS',                 cat: 'sales' },
    { key: 'sales_modify_price',       label: 'Modifier manuellement un prix au panier',      cat: 'sales' },
    { key: 'sales_modify_qty',         label: 'Modifier la quantité d\'un article au panier', cat: 'sales' },
    { key: 'sales_reprint',            label: 'Réimprimer les tickets / reçus',               cat: 'sales' },
    { key: 'sales_invoice_print',      label: 'Générer et imprimer des factures A4',          cat: 'sales' },
    { key: 'sales_pay_cash',           label: 'Autoriser l\'encaissement en Espèces',         cat: 'sales' },
    { key: 'sales_pay_mobile',         label: 'Autoriser l\'encaissement via Mobile Money',   cat: 'sales' },
    { key: 'sales_pay_credit',         label: 'Autoriser la vente à crédit (dette client)',   cat: 'sales' },
    { key: 'sales_pay_assurance',      label: 'Autoriser la vente avec mutuelle/assurance',   cat: 'sales' },
    { key: 'sales_view_ca',            label: 'Voir les indicateurs de chiffre d\'affaires',  cat: 'sales' },
    { key: 'sales_view_profit',        label: 'Voir les indicateurs de bénéfices nets',       cat: 'sales' },
    { key: 'sales_view_margin',        label: 'Voir le pourcentage de marge sur les ventes',  cat: 'sales' },
    { key: 'sales_view_stats',         label: 'Voir les graphiques et rapports de ventes',    cat: 'sales' },
    { key: 'sales_export',             label: 'Exporter l\'historique des ventes',            cat: 'sales' },

    // === STOCK & CATALOGUE ===
    { key: 'stock_view',               label: 'Voir les quantités de stock physique',          cat: 'stock' },
    { key: 'stock_view_purchase_price',label: 'Voir les prix d\'achat fournisseur',           cat: 'stock' },
    { key: 'stock_view_sale_price',    label: 'Voir les prix de vente publics',               cat: 'stock' },
    { key: 'stock_view_profit',        label: 'Voir le bénéfice potentiel par produit/lot',   cat: 'stock' },
    { key: 'stock_view_margin',        label: 'Voir le taux de marge des produits',           cat: 'stock' },
    { key: 'stock_view_value',         label: 'Voir la valeur financière totale du stock',    cat: 'stock' },
    { key: 'stock_product_create',     label: 'Créer un nouveau produit au catalogue',        cat: 'stock' },
    { key: 'stock_product_edit',       label: 'Modifier la fiche d\'un produit existant',     cat: 'stock' },
    { key: 'stock_product_delete',     label: 'Désactiver ou archiver un produit',            cat: 'stock' },
    { key: 'stock_lot_edit',           label: 'Modifier les informations d\'un lot (exp/n°)', cat: 'stock' },
    { key: 'stock_transfer',           label: 'Transférer du stock Rayon <-> Réserve',        cat: 'stock' },
    { key: 'stock_adjust',             label: 'Effectuer un ajustement manuel de quantité',   cat: 'stock' },
    { key: 'stock_exit',               label: 'Déclarer des pertes, casses, vols ou dons',    cat: 'stock' },
    { key: 'stock_import',             label: 'Importer le catalogue de produits (CSV)',       cat: 'stock' },
    { key: 'stock_export',             label: 'Exporter l\'état des stocks (PDF/CSV)',        cat: 'stock' },
    { key: 'stock_print',              label: 'Imprimer les fiches physiques de stock',       cat: 'stock' },

    // === INVENTAIRE ===
    { key: 'inventory_view',           label: 'Voir l\'historique des inventaires',            cat: 'inventory' },
    { key: 'inventory_create',         label: 'Lancer un nouvel inventaire physique',         cat: 'inventory' },
    { key: 'inventory_edit',           label: 'Saisir les comptages dans l\'inventaire',      cat: 'inventory' },
    { key: 'inventory_adjust',         label: 'Valider et appliquer les écarts de stock',     cat: 'inventory' },
    { key: 'inventory_delete',         label: 'Annuler ou supprimer un inventaire en cours',  cat: 'inventory' },
    { key: 'inventory_export',         label: 'Exporter le Procès-Verbal d\'inventaire',      cat: 'inventory' },

    // === ACHATS & FOURNISSEURS ===
    { key: 'achats_view',              label: 'Voir le journal des commandes d\'achat',       cat: 'achats' },
    { key: 'achats_create',            label: 'Créer un nouveau bon de commande',             cat: 'achats' },
    { key: 'achats_edit',              label: 'Modifier un bon de commande en brouillon',     cat: 'achats' },
    { key: 'achats_send',              label: 'Envoyer/valider le bon de commande',           cat: 'achats' },
    { key: 'achats_receive',           label: 'Réceptionner les commandes (entrée stock)',    cat: 'achats' },
    { key: 'achats_cancel',            label: 'Annuler un bon de commande en cours',          cat: 'achats' },
    { key: 'achats_delete',            label: 'Supprimer définitivement un bon de commande',  cat: 'achats' },
    { key: 'achats_supplier_edit',     label: 'Créer ou éditer une fiche de fournisseur',     cat: 'achats' },
    { key: 'achats_supplier_delete',   label: 'Supprimer un fournisseur de la base',          cat: 'achats' },

    // === PATIENTS & ASSURANCES ===
    { key: 'patients_view',            label: 'Consulter la liste des patients',              cat: 'patients' },
    { key: 'patients_create',          label: 'Créer une nouvelle fiche patient',             cat: 'patients' },
    { key: 'patients_edit',            label: 'Modifier les informations d\'un patient',      cat: 'patients' },
    { key: 'patients_delete',          label: 'Supprimer définitivement un patient',          cat: 'patients' },
    { key: 'patients_credit_limit',    label: 'Modifier le plafond de crédit autorisé',       cat: 'patients' },
    { key: 'patients_debt_settle',     label: 'Encaisser le remboursement d\'une dette',      cat: 'patients' },
    { key: 'patients_assurance_edit',  label: 'Associer mutuelles et taux de couverture',     cat: 'patients' },
    { key: 'patients_debt_print',      label: 'Imprimer les relevés de dettes clients',       cat: 'patients' },

    // === COMPTABILITÉ & CAISSE ===
    { key: 'accounting_view_journal',  label: 'Consulter le journal des écritures',           cat: 'accounting' },
    { key: 'accounting_view_reports',  label: 'Consulter la balance et les bilans financiers',cat: 'accounting' },
    { key: 'accounting_write',         label: 'Saisir des écritures comptables manuelles',    cat: 'accounting' },
    { key: 'accounting_export',        label: 'Exporter les rapports et journaux de compta',  cat: 'accounting' },
    { key: 'caisse_depot_retrait',     label: 'Mouvements manuels de caisse (dépôt/retrait)',  cat: 'caisse' },
    { key: 'caisse_cloture',           label: 'Faire la clôture journalière de la caisse',     cat: 'caisse' },
    { key: 'caisse_voir_historique',   label: 'Consulter l\'historique des clôtures',          cat: 'caisse' },

    // === RESSOURCES HUMAINES ===
    { key: 'hr_view_salary',           label: 'Consulter la masse salariale et les fiches',   cat: 'hr' },
    { key: 'hr_manage_employees',      label: 'Créer, éditer ou licencier des employés',      cat: 'hr' },
    { key: 'hr_manage_attendance',     label: 'Valider et corriger les pointages/présences',  cat: 'hr' },
    { key: 'hr_manage_payroll',        label: 'Gérer paies, acomptes, primes et retenues',   cat: 'hr' },
    { key: 'hr_write_caisse',          label: 'Autoriser les décaissements RH depuis la caisse',cat: 'hr' },

    // === SYSTEME & PARAMETRES ===
    { key: 'settings_view',            label: 'Consulter les paramètres généraux',            cat: 'admin' },
    { key: 'settings_edit',            label: 'Modifier les infos de la pharmacie / devise',  cat: 'admin' },
    { key: 'settings_users',           label: 'Gérer les comptes utilisateurs et rôles',      cat: 'admin' },
    { key: 'settings_permissions',     label: 'Modifier la grille des permissions',           cat: 'admin' },
    { key: 'settings_backup',          label: 'Créer et restaurer des sauvegardes',           cat: 'admin' },
    { key: 'settings_sync',            label: 'Gérer et forcer la synchronisation Supabase',  cat: 'admin' },
  ],

  ALL_PERMISSION_CATS: [
    { key: 'modules',    label: '🧩 Accès aux Modules de l\'ERP' },
    { key: 'session',    label: '🔑 Sessions & Équipes' },
    { key: 'sales',      label: '🛒 Point de Vente & Ventes' },
    { key: 'stock',      label: '📦 Catalogue & Stock' },
    { key: 'inventory',  label: '📋 Inventaires Physiques' },
    { key: 'achats',     label: '💼 Fournisseurs & Achats' },
    { key: 'patients',   label: '👥 Patients & Assurances' },
    { key: 'accounting', label: '📒 Comptabilité Générale' },
    { key: 'caisse',     label: '💵 Caisse Journalière & Opérations' },
    { key: 'hr',         label: '👔 Ressources Humaines' },
    { key: 'admin',      label: '⚙️ Paramètres & Système' },
  ],

  ALL_ROLES: [
    { key: 'admin',      label: 'Administrateur' },
    { key: 'pharmacien', label: 'Pharmacien' },
    { key: 'caissier',   label: 'Caissier' },
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
