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
      'module_dashboard', 'module_reports', 'module_metrics', 'module_sales', 'module_caisse', 'module_products', 'module_stock', 'module_inventory', 'module_reorder', 'module_prescriptions', 'module_patients', 'module_claims', 'module_suppliers', 'module_purchase_orders', 'module_invoices', 'module_traceability', 'module_management_control', 'module_accounting', 'module_rh', 'module_shifts', 'module_settings',
      'dash_view_today_sales', 'dash_view_month_sales', 'dash_view_margin', 'dash_view_active_products', 'dash_view_active_alerts', 'dash_view_sales_chart', 'dash_view_payments_chart', 'dash_view_top_products', 'dash_view_recent_alerts', 'dash_view_low_stock', 'alerts_view', 'alerts_resolve',
      'pos_view', 'pos_sales_create', 'pos_discount', 'pos_modify_price', 'pos_modify_qty', 'pos_pay_cash', 'pos_pay_mobile', 'pos_pay_credit', 'pos_pay_assurance', 'pos_create_prescription', 'pos_session_tabs', 'pos_clear_cart', 'sales_cancel',
      'caisse_view', 'caisse_view_details', 'caisse_view_stats', 'caisse_depot_retrait', 'caisse_cloture', 'caisse_export_csv', 'caisse_view_manual_movements',
      'products_view', 'products_view_kpis', 'products_view_purchase_price', 'products_view_profit', 'products_view_margin', 'products_create', 'products_edit', 'products_delete', 'products_bulk_edit', 'products_import', 'products_export', 'products_filter',
      'stock_view', 'stock_view_kpis', 'stock_view_purchase_price', 'stock_view_value', 'stock_adjust', 'stock_exit', 'stock_import', 'stock_export', 'stock_print', 'stock_view_expiry', 'stock_view_exits_history',
      'inventory_view', 'inventory_create', 'inventory_edit', 'inventory_adjust', 'inventory_delete', 'inventory_export',
      'reorder_view', 'reorder_create_po', 'po_view', 'po_create', 'po_send', 'po_receive', 'po_cancel', 'po_delete',
      'invoices_view', 'invoices_create', 'invoices_edit', 'invoices_delete', 'suppliers_view', 'suppliers_create', 'suppliers_edit', 'suppliers_delete',
      'patients_view', 'patients_create', 'patients_edit', 'patients_delete', 'patients_credit_limit', 'patients_debt_settle', 'patients_debt_print', 'claims_view', 'claims_export',
      'traceability_view', 'traceability_view_expired', 'traceability_financial_loss', 'traceability_destroy_lot', 'traceability_recalls',
      'accounting_view_journal', 'accounting_view_reports', 'accounting_write', 'accounting_export', 'mc_view', 'mc_view_kpis', 'mc_view_charts', 'mc_export',
      'reports_view', 'reports_view_financial', 'reports_view_sales', 'reports_export',
      'metrics_view', 'metrics_view_kpis', 'metrics_view_charts', 'metrics_export',
      'hr_view_salary', 'hr_manage_employees', 'hr_manage_attendance', 'hr_manage_payroll', 'hr_manage_leaves', 'hr_write_caisse', 'hr_view_compta', 'hr_export_pdf',
      'shifts_view', 'shifts_open_close', 'shifts_manage_teams', 'shifts_manage_tasks', 'shifts_manage_absences', 'shifts_view_history', 'shifts_view_reports',
      'settings_view', 'settings_edit', 'settings_users', 'settings_permissions', 'settings_backup', 'settings_sync', 'settings_device'
    ],
    rh: [
      'module_rh',
      'hr_view_salary', 'hr_manage_employees', 'hr_manage_attendance', 'hr_manage_payroll', 'hr_manage_leaves', 'hr_write_caisse', 'hr_view_compta', 'hr_export_pdf'
    ],
    pharmacien: [
      'module_dashboard', 'module_reports', 'module_metrics', 'module_sales', 'module_caisse', 'module_products', 'module_stock', 'module_inventory', 'module_reorder', 'module_prescriptions', 'module_patients', 'module_claims', 'module_suppliers', 'module_purchase_orders', 'module_invoices', 'module_traceability', 'module_management_control', 'module_accounting', 'module_rh', 'module_shifts',
      'dash_view_today_sales', 'dash_view_month_sales', 'dash_view_margin', 'dash_view_active_products', 'dash_view_active_alerts', 'dash_view_sales_chart', 'dash_view_payments_chart', 'dash_view_top_products', 'dash_view_recent_alerts', 'dash_view_low_stock', 'alerts_view', 'alerts_resolve',
      'pos_view', 'pos_sales_create', 'pos_discount', 'pos_modify_qty', 'pos_pay_cash', 'pos_pay_mobile', 'pos_pay_credit', 'pos_pay_assurance', 'pos_create_prescription', 'pos_session_tabs', 'pos_clear_cart', 'sales_cancel',
      'caisse_view', 'caisse_view_details', 'caisse_view_stats', 'caisse_depot_retrait', 'caisse_cloture', 'caisse_export_csv', 'caisse_view_manual_movements',
      'products_view', 'products_view_kpis', 'products_view_purchase_price', 'products_view_profit', 'products_view_margin', 'products_create', 'products_edit', 'products_bulk_edit', 'products_export', 'products_filter',
      'stock_view', 'stock_view_kpis', 'stock_view_purchase_price', 'stock_view_value', 'stock_adjust', 'stock_exit', 'stock_export', 'stock_print', 'stock_view_expiry', 'stock_view_exits_history',
      'inventory_view', 'inventory_create', 'inventory_edit', 'inventory_adjust', 'inventory_export',
      'reorder_view', 'reorder_create_po', 'po_view', 'po_create', 'po_send', 'po_receive', 'po_cancel',
      'invoices_view', 'invoices_create', 'invoices_edit', 'suppliers_view', 'suppliers_create', 'suppliers_edit',
      'patients_view', 'patients_create', 'patients_edit', 'patients_debt_settle', 'patients_debt_print', 'claims_view', 'claims_export',
      'traceability_view', 'traceability_view_expired', 'traceability_financial_loss', 'traceability_destroy_lot', 'traceability_recalls',
      'accounting_view_journal', 'accounting_view_reports', 'mc_view', 'mc_view_kpis', 'mc_view_charts', 'mc_export',
      'reports_view', 'reports_view_financial', 'reports_view_sales', 'reports_export',
      'metrics_view', 'metrics_view_kpis', 'metrics_view_charts', 'metrics_export',
      'hr_manage_employees', 'hr_manage_attendance',
      'shifts_view', 'shifts_open_close', 'shifts_manage_teams', 'shifts_manage_tasks', 'shifts_manage_absences', 'shifts_view_history', 'shifts_view_reports'
    ],
    caissier: [
      'module_sales', 'module_caisse',
      'pos_view', 'pos_sales_create', 'pos_discount', 'pos_modify_qty', 'pos_pay_cash', 'pos_pay_mobile', 'pos_session_tabs',
      'caisse_view'
    ],
    receptionniste: [
      'module_sales',
      'pos_view', 'pos_sales_create', 'pos_pay_cash'
    ],
    gestionnaire_stock: [
      'module_stock', 'module_products', 'module_inventory', 'module_reorder', 'module_suppliers', 'module_purchase_orders',
      'products_view', 'products_filter',
      'stock_view', 'stock_view_kpis', 'stock_view_expiry', 'stock_adjust', 'stock_exit', 'stock_export', 'stock_print',
      'inventory_view', 'inventory_create', 'inventory_edit', 'inventory_export',
      'reorder_view', 'reorder_create_po', 'po_view', 'po_receive'
    ],
    comptable: [
      'module_dashboard', 'module_accounting', 'module_management_control',
      'dash_view_today_sales', 'dash_view_month_sales', 'dash_view_margin', 'dash_view_sales_chart', 'dash_view_payments_chart',
      'accounting_view_journal', 'accounting_view_reports', 'accounting_export',
      'mc_view', 'mc_view_kpis', 'mc_view_charts', 'mc_export',
      'reports_view', 'reports_view_financial'
    ],
    assistant: [],
  },

  ALL_PERMISSIONS: [
    // === ACCÈS AUX MODULES (SIDEBAR) ===
    { key: 'module_dashboard',         label: 'Accéder au Tableau de Bord',                   cat: 'modules' },
    { key: 'module_reports',           label: 'Accéder aux Rapports & Analytique',            cat: 'reports' },
    { key: 'module_metrics',           label: 'Accéder aux Métriques Business',               cat: 'metrics' },
    { key: 'module_sales',             label: 'Accéder aux Ventes (POS/Historique)',          cat: 'modules' },
    { key: 'module_caisse',            label: 'Accéder à la Caisse Journalière',              cat: 'modules' },
    { key: 'module_products',          label: 'Accéder au Catalogue Produits',                cat: 'modules' },
    { key: 'module_stock',             label: 'Accéder à la Gestion des Stocks',              cat: 'modules' },
    { key: 'module_inventory',         label: 'Accéder aux Inventaires Physiques',            cat: 'modules' },
    { key: 'module_reorder',           label: 'Accéder au Réapprovisionnement',               cat: 'modules' },
    { key: 'module_prescriptions',     label: 'Accéder aux Ordonnances',                      cat: 'modules' },
    { key: 'module_patients',          label: 'Accéder aux Dossiers Patients',                cat: 'modules' },
    { key: 'module_claims',            label: 'Accéder aux Créances & Assurances',            cat: 'modules' },
    { key: 'module_suppliers',         label: 'Accéder aux Fournisseurs',                     cat: 'modules' },
    { key: 'module_purchase_orders',   label: 'Accéder aux Bons de Commande',                 cat: 'modules' },
    { key: 'module_invoices',          label: 'Accéder aux Factures Fournisseurs',            cat: 'modules' },
    { key: 'module_traceability',      label: 'Accéder à la Traçabilité & Pharmacovigilance', cat: 'modules' },
    { key: 'module_management_control', label: 'Accéder au Pilotage & Contrôle',              cat: 'modules' },
    { key: 'module_accounting',        label: 'Accéder à la Comptabilité Générale',           cat: 'modules' },
    { key: 'module_rh',                label: 'Accéder aux Ressources Humaines',              cat: 'modules' },
    { key: 'module_shifts',            label: 'Accéder aux Équipes Matin / Soir',             cat: 'modules' },
    { key: 'module_settings',          label: 'Accéder aux Paramètres Généraux',              cat: 'modules' },

    // === TABLEAU DE BORD ===
    { key: 'dash_view_today_sales',    label: "Voir le chiffre d'affaires du jour",           cat: 'dashboard' },
    { key: 'dash_view_month_sales',    label: 'Voir le chiffre d\'affaires du mois',          cat: 'dashboard' },
    { key: 'dash_view_margin',         label: 'Voir le pourcentage de marge du mois',         cat: 'dashboard' },
    { key: 'dash_view_active_products',label: 'Voir le nombre de produits actifs',            cat: 'dashboard' },
    { key: 'dash_view_active_alerts',  label: 'Voir le nombre d\'alertes actives',            cat: 'dashboard' },
    { key: 'dash_view_sales_chart',    label: 'Voir le graphique d\'évolution des ventes',    cat: 'dashboard' },
    { key: 'dash_view_payments_chart', label: 'Voir le graphique des modes de paiement',      cat: 'dashboard' },
    { key: 'dash_view_top_products',   label: 'Voir les Top Produits du mois',                cat: 'dashboard' },
    { key: 'dash_view_recent_alerts',  label: 'Voir les alertes récentes',                    cat: 'dashboard' },
    { key: 'dash_view_low_stock',      label: 'Voir les alertes de stocks bas',               cat: 'dashboard' },
    { key: 'alerts_view',              label: 'Consulter le centre d\'alertes',               cat: 'dashboard' },
    { key: 'alerts_resolve',           label: 'Marquer les alertes comme lues',               cat: 'dashboard' },

    // === CAISSE & POINT DE VENTE (POS) ===
    { key: 'pos_view',                 label: 'Accéder à l\'interface de vente',               cat: 'pos' },
    { key: 'pos_sales_create',         label: 'Créer et valider des ventes',                  cat: 'pos' },
    { key: 'pos_discount',             label: 'Appliquer des remises au POS',                 cat: 'pos' },
    { key: 'pos_modify_price',         label: 'Modifier les prix au panier',                  cat: 'pos' },
    { key: 'pos_modify_qty',           label: 'Modifier la quantité d\'un article au panier',  cat: 'pos' },
    { key: 'pos_pay_cash',             label: 'Autoriser l\'encaissement en Espèces',         cat: 'pos' },
    { key: 'pos_pay_mobile',           label: 'Autoriser l\'encaissement via Mobile Money',   cat: 'pos' },
    { key: 'pos_pay_credit',           label: 'Autoriser la vente à crédit (dette client)',   cat: 'pos' },
    { key: 'pos_pay_assurance',        label: 'Autoriser la vente avec mutuelle/assurance',   cat: 'pos' },
    { key: 'pos_create_prescription',  label: 'Associer des ordonnances aux ventes',          cat: 'pos' },
    { key: 'pos_session_tabs',         label: 'Gérer plusieurs onglets de vente simultanés',  cat: 'pos' },
    { key: 'pos_clear_cart',           label: 'Vider le panier en cours',                     cat: 'pos' },
    { key: 'sales_cancel',             label: 'Annuler une vente validée (remboursement)',     cat: 'pos' },

    // === CAISSE JOURNALIÈRE ===
    { key: 'caisse_view',              label: 'Voir le résumé de caisse',                     cat: 'caisse' },
    { key: 'caisse_view_details',      label: 'Accéder au détail du calcul financier',        cat: 'caisse' },
    { key: 'caisse_view_stats',        label: 'Accéder aux statistiques & clôtures',          cat: 'caisse' },
    { key: 'caisse_depot_retrait',     label: 'Mouvements manuels de caisse (dépôt/retrait)',  cat: 'caisse' },
    { key: 'caisse_cloture',           label: 'Faire la clôture journalière de la caisse',     cat: 'caisse' },
    { key: 'caisse_export_csv',        label: 'Exporter les transactions du jour en CSV',     cat: 'caisse' },
    { key: 'caisse_view_manual_movements', label: 'Consulter la liste des flux manuels',      cat: 'caisse' },

    // === CATALOGUE PRODUITS ===
    { key: 'products_view',            label: 'Consulter la liste des produits',              cat: 'products' },
    { key: 'products_view_kpis',       label: 'Voir les indicateurs financiers du catalogue', cat: 'products' },
    { key: 'products_view_purchase_price', label: 'Voir les prix d\'achat fournisseur',       cat: 'products' },
    { key: 'products_view_profit',     label: 'Voir le bénéfice estimé par produit',          cat: 'products' },
    { key: 'products_view_margin',     label: 'Voir le taux de marge des produits',           cat: 'products' },
    { key: 'products_create',          label: 'Ajouter un nouveau produit',                   cat: 'products' },
    { key: 'products_edit',            label: 'Modifier un produit existant',                 cat: 'products' },
    { key: 'products_delete',          label: 'Désactiver ou archiver un produit',            cat: 'products' },
    { key: 'products_bulk_edit',       label: 'Effectuer des modifications groupées',         cat: 'products' },
    { key: 'products_import',          label: 'Importer des produits (CSV)',                  cat: 'products' },
    { key: 'products_export',          label: 'Exporter le catalogue (PDF/CSV)',              cat: 'products' },
    { key: 'products_filter',          label: 'Rechercher et filtrer les produits',           cat: 'products' },

    // === GESTION DES STOCKS ===
    { key: 'stock_view',               label: 'Consulter la grille des stocks',               cat: 'stock' },
    { key: 'stock_view_kpis',          label: 'Voir les indicateurs clés de stocks',          cat: 'stock' },
    { key: 'stock_view_purchase_price',label: 'Voir les prix d\'achat dans le stock',         cat: 'stock' },
    { key: 'stock_view_value',         label: 'Voir la valeur totale du stock',               cat: 'stock' },
    { key: 'stock_adjust',             label: 'Ajuster manuellement les quantités de stock',  cat: 'stock' },
    { key: 'stock_exit',               label: 'Déclarer des pertes, casses, vols ou dons',    cat: 'stock' },
    { key: 'stock_import',             label: 'Importer des données de stock (CSV)',          cat: 'stock' },
    { key: 'stock_export',             label: 'Exporter l\'état des stocks (PDF/CSV)',        cat: 'stock' },
    { key: 'stock_print',              label: 'Imprimer des fiches physiques de stock',       cat: 'stock' },
    { key: 'stock_view_expiry',        label: 'Voir les dates d\'expiration des lots',        cat: 'stock' },
    { key: 'stock_view_exits_history', label: 'Voir l\'historique des sorties de stock',      cat: 'stock' },

    // === INVENTAIRES PHYSIQUES ===
    { key: 'inventory_view',           label: 'Voir l\'historique des inventaires',            cat: 'inventory' },
    { key: 'inventory_create',         label: 'Lancer un nouvel inventaire physique',         cat: 'inventory' },
    { key: 'inventory_edit',           label: 'Saisir les comptages dans l\'inventaire',      cat: 'inventory' },
    { key: 'inventory_adjust',         label: 'Valider et appliquer les écarts de stock',     cat: 'inventory' },
    { key: 'inventory_delete',         label: 'Annuler ou supprimer un inventaire',           cat: 'inventory' },
    { key: 'inventory_export',         label: 'Exporter le Procès-Verbal d\'inventaire',      cat: 'inventory' },

    // === RÉAPPROVISIONNEMENT & BONS DE COMMANDE ===
    { key: 'reorder_view',             label: 'Consulter les suggestions de réappro',         cat: 'reorder' },
    { key: 'reorder_create_po',        label: 'Générer un bon de commande depuis les sugg.',  cat: 'reorder' },
    { key: 'po_view',                  label: 'Voir la liste des bons de commande',           cat: 'reorder' },
    { key: 'po_create',                label: 'Créer un bon de commande manuel',              cat: 'reorder' },
    { key: 'po_send',                  label: 'Envoyer/valider un bon de commande',           cat: 'reorder' },
    { key: 'po_receive',               label: 'Réceptionner les commandes (entrée stock)',    cat: 'reorder' },
    { key: 'po_cancel',                label: 'Annuler un bon de commande en cours',          cat: 'reorder' },
    { key: 'po_delete',                label: 'Supprimer définitivement un bon de commande',  cat: 'reorder' },

    // === FACTURES & FOURNISSEURS ===
    { key: 'invoices_view',            label: 'Consulter le journal des factures',            cat: 'achats' },
    { key: 'invoices_create',          label: 'Enregistrer une nouvelle facture',             cat: 'achats' },
    { key: 'invoices_edit',            label: 'Modifier une facture existante (brouillon)',   cat: 'achats' },
    { key: 'invoices_delete',          label: 'Supprimer une facture d\'achat',               cat: 'achats' },
    { key: 'suppliers_view',           label: 'Consulter la liste des fournisseurs',          cat: 'achats' },
    { key: 'suppliers_create',         label: 'Ajouter un nouveau fournisseur',               cat: 'achats' },
    { key: 'suppliers_edit',           label: 'Modifier les informations d\'un fournisseur',  cat: 'achats' },
    { key: 'suppliers_delete',         label: 'Supprimer un fournisseur',                     cat: 'achats' },

    // === PATIENTS & CRÉANCES ===
    { key: 'patients_view',            label: 'Consulter la liste des patients',              cat: 'patients' },
    { key: 'patients_create',          label: 'Créer une fiche patient',                      cat: 'patients' },
    { key: 'patients_edit',            label: 'Modifier les informations d\'un patient',      cat: 'patients' },
    { key: 'patients_delete',          label: 'Supprimer un patient',                         cat: 'patients' },
    { key: 'patients_credit_limit',    label: 'Modifier le plafond de crédit patient',        cat: 'patients' },
    { key: 'patients_debt_settle',     label: 'Encaisser le remboursement d\'une dette',      cat: 'patients' },
    { key: 'patients_debt_print',      label: 'Imprimer les relevés de dettes clients',       cat: 'patients' },
    { key: 'claims_view',              label: 'Consulter le module des créances mutuelles',   cat: 'patients' },
    { key: 'claims_export',            label: 'Exporter les récapitulatifs des créances',     cat: 'patients' },

    // === RAPPORTS & ANALYTIQUE ===
    { key: 'reports_view',             label: 'Consulter les rapports de ventes & financiers', cat: 'reports' },
    { key: 'reports_view_financial',   label: 'Voir les indicateurs financiers (CA, marge)',   cat: 'reports' },
    { key: 'reports_view_sales',       label: 'Voir les statistiques de ventes détaillées',    cat: 'reports' },
    { key: 'reports_export',           label: 'Exporter les rapports (PDF/CSV)',               cat: 'reports' },

    // === MÉTRIQUES BUSINESS ===
    { key: 'metrics_view',             label: 'Consulter le tableau des métriques business',   cat: 'metrics' },
    { key: 'metrics_view_kpis',        label: 'Voir les KPIs avancés (ROI, panier moyen...)',  cat: 'metrics' },
    { key: 'metrics_view_charts',      label: "Voir les graphiques d'évolution des métriques", cat: 'metrics' },
    { key: 'metrics_export',           label: 'Exporter les métriques en PDF',                 cat: 'metrics' },

    // === TRAÇABILITÉ ===
    { key: 'traceability_view',        label: 'Consulter le module de traçabilité',           cat: 'traceability' },
    { key: 'traceability_view_expired', label: 'Voir les produits périmés / proches',         cat: 'traceability' },
    { key: 'traceability_financial_loss', label: 'Consulter la perte financière',              cat: 'traceability' },
    { key: 'traceability_destroy_lot', label: 'Effectuer la destruction officielle d\'un lot',cat: 'traceability' },
    { key: 'traceability_recalls',     label: 'Consulter les alertes de rappels de lots',     cat: 'traceability' },

    // === COMPTABILITÉ & PILOTAGE ===
    { key: 'accounting_view_journal',  label: 'Consulter le journal des écritures',           cat: 'accounting' },
    { key: 'accounting_view_reports',  label: 'Consulter la balance et bilans financiers',    cat: 'accounting' },
    { key: 'accounting_write',         label: 'Saisir des écritures manuelles',               cat: 'accounting' },
    { key: 'accounting_export',        label: 'Exporter les rapports et journaux de compta',  cat: 'accounting' },
    { key: 'mc_view',                  label: 'Accéder au module Pilotage & Contrôle',        cat: 'accounting' },
    { key: 'mc_view_kpis',             label: 'Voir les indicateurs financiers de pilotage',  cat: 'accounting' },
    { key: 'mc_view_charts',           label: 'Voir les graphiques d\'évolution de pilotage',  cat: 'accounting' },
    { key: 'mc_export',                label: 'Exporter les données de pilotage en PDF',      cat: 'accounting' },

    // === RESSOURCES HUMAINES ===
    { key: 'hr_view_salary',           label: 'Consulter la masse salariale globale',         cat: 'hr' },
    { key: 'hr_manage_employees',      label: 'Gérer les dossiers des employés',              cat: 'hr' },
    { key: 'hr_manage_attendance',     label: 'Valider pointages et présences',               cat: 'hr' },
    { key: 'hr_manage_payroll',        label: 'Gérer les fiches de paie et salaires',         cat: 'hr' },
    { key: 'hr_manage_leaves',         label: 'Gérer et approuver les congés',                cat: 'hr' },
    { key: 'hr_write_caisse',          label: 'Autoriser les décaissements RH depuis la caisse', cat: 'hr' },
    { key: 'hr_view_compta',           label: 'Accéder à l\'onglet comptabilité RH',          cat: 'hr' },
    { key: 'hr_export_pdf',            label: 'Exporter les fiches de paie / états RH',       cat: 'hr' },

    // === ÉQUIPES / SHIFTS ===
    { key: 'shifts_view',              label: 'Consulter le planning des équipes',            cat: 'shifts' },
    { key: 'shifts_open_close',        label: 'Ouvrir et clôturer un Shift d\'équipe',        cat: 'shifts' },
    { key: 'shifts_manage_teams',      label: 'Gérer la configuration des équipes',           cat: 'shifts' },
    { key: 'shifts_manage_tasks',      label: 'Gérer et attribuer des tâches',                cat: 'shifts' },
    { key: 'shifts_manage_absences',   label: 'Gérer les absences des membres d\'équipe',     cat: 'shifts' },
    { key: 'shifts_view_history',      label: 'Voir l\'historique des ventes par équipe',     cat: 'shifts' },
    { key: 'shifts_view_reports',      label: 'Consulter les rapports rapides des équipes',   cat: 'shifts' },

    // === PARAMÈTRES & SYSTÈME ===
    { key: 'settings_view',            label: 'Consulter les paramètres système',             cat: 'admin' },
    { key: 'settings_edit',            label: 'Modifier les infos de pharmacie / devise',     cat: 'admin' },
    { key: 'settings_users',           label: 'Gérer les comptes utilisateurs et rôles',      cat: 'admin' },
    { key: 'settings_permissions',     label: 'Modifier la grille de permissions',            cat: 'admin' },
    { key: 'settings_backup',          label: 'Sauvegarder et restaurer les données',         cat: 'admin' },
    { key: 'settings_sync',            label: 'Gérer la synchronisation Supabase',            cat: 'admin' },
    { key: 'settings_device',          label: 'Configurer le nom du terminal/caisse',         cat: 'admin' }
  ],

  ALL_PERMISSION_CATS: [
    { key: 'modules',    label: 'Accès aux Modules de l\'ERP' },
    { key: 'dashboard',  label: 'Tableau de Bord & Centre d\'Alertes' },
    { key: 'pos',        label: 'Point de Vente (Panier & Caisse)' },
    { key: 'caisse',     label: 'Caisse Journalière & Clôtures' },
    { key: 'products',   label: 'Catalogue des Médicaments' },
    { key: 'stock',      label: 'Gestion des Stocks & Mouvements' },
    { key: 'inventory',  label: 'Inventaires Physiques' },
    { key: 'reorder',    label: 'Aide à la Commande & Bons d\'Achat' },
    { key: 'achats',     label: 'Factures d\'Achat & Fournisseurs' },
    { key: 'patients',   label: 'Patients, Créances & Assurances' },
    { key: 'traceability',label: 'Traçabilité & Pharmacovigilance' },
    { key: 'accounting', label: 'Comptabilité & Pilotage de Gestion' },
    { key: 'reports',    label: 'Rapports Analytiques & Financiers' },
    { key: 'metrics',    label: 'Métriques Business & Tableaux de Bord' },
    { key: 'hr',         label: 'Ressources Humaines' },
    { key: 'shifts',     label: 'Gestion des Équipes (Shifts)' },
    { key: 'admin',      label: 'Paramètres & Système' }
  ],

  ALL_ROLES: [
    { key: 'admin',      label: 'Administrateur' },
    { key: 'pharmacien', label: 'Pharmacien' },
    { key: 'caissier',   label: 'Caissier' }
  ]
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
    
    // Garde de sécurité centralisé basé sur les permissions de NAV_ITEMS
    if (DB.AppState.currentUser && typeof NAV_ITEMS !== 'undefined') {
      const navItem = NAV_ITEMS.find(item => item.page === page);
      if (navItem && navItem.permission && typeof Auth !== 'undefined' && typeof Auth.can === 'function') {
        if (!Auth.can(navItem.permission)) {
          console.warn(`[Router] Navigation bloquée pour ${page} - Droits insuffisants.`);
          if (typeof UI !== 'undefined' && typeof UI.toast === 'function') {
            UI.toast('⛔ Accès refusé : vous n\'avez pas les droits nécessaires.', 'error', 4000);
          }
          page = 'dashboard';
        }
      }
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
