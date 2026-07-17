// ═══════════════════════════════════════════════════════════════════════════
//  OrdiveX — Module Comptabilité Générale v9.7.70
//  js/pages/accounting.js
//  Journal comptable unifié : ventes, dépenses caisse, retours, paies, factures fournisseurs
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const fmt = (n) => UI.formatCurrency(n);
  const fmtD = (d) => d ? UI.formatDate(d) : '—';
  const today = () => new Date().toISOString().slice(0, 10);

  // Pagination
  function paginate(data, page, size = 30) {
    const totalPages = Math.max(1, Math.ceil(data.length / size));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * size;
    return { items: data.slice(start, start + size), page: safePage, totalPages, total: data.length };
  }

  if (window.Router) {
    Router.register('accounting', (container) => renderAccounting(container));
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════
  async function renderAccounting(container) {
    if (window.Auth && !Auth.can('accounting_view_journal') && !Auth.can('accounting_view_reports') && DB.AppState.currentUser?.role !== 'admin') {
      container.innerHTML = `
        <div style="padding:40px; text-align:center; color:var(--text-muted)">
          <i data-lucide="lock" style="width:48px; height:48px; margin:0 auto 16px; opacity:0.3; display:block"></i>
          <h3>Accès refusé</h3>
          <p>Vous n'avez pas la permission de consulter la comptabilité.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ root: container });
      return;
    }

    const canJournal = Auth.can('accounting_view_journal') || DB.AppState.currentUser?.role === 'admin';
    const canReports = Auth.can('accounting_view_reports') || DB.AppState.currentUser?.role === 'admin';
    const canExport = Auth.can('accounting_export') || DB.AppState.currentUser?.role === 'admin';

    let defaultTab = '';
    if (canJournal) defaultTab = 'journal';
    else if (canReports) defaultTab = 'balance';

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:20px">
        <div>
          <h1 class="page-title">Comptabilité Générale</h1>
          <p class="page-subtitle" style="color:var(--text-muted);font-size:.85rem;margin-top:4px">
            Journal comptable, dépenses, recettes et rapports financiers
          </p>
        </div>
        <div class="header-actions">
          ${canExport ? `<button class="btn btn-secondary" onclick="acctExportPDF()"><i data-lucide="download"></i> Exporter PDF</button>` : ''}
        </div>
      </div>

      <div class="hr-tabs" id="acct-tabs">
        ${canJournal ? `
        <button class="hr-tab-btn active" onclick="acctSwitchTab('journal',this)" id="acct-btn-journal">
          <i data-lucide="book-open"></i> Journal Comptable
        </button>
        <button class="hr-tab-btn" onclick="acctSwitchTab('depenses',this)" id="acct-btn-depenses">
          <i data-lucide="arrow-down-circle"></i> Dépenses
        </button>
        <button class="hr-tab-btn" onclick="acctSwitchTab('recettes',this)" id="acct-btn-recettes">
          <i data-lucide="arrow-up-circle"></i> Recettes
        </button>
        ` : ''}
        ${canReports ? `
        <button class="hr-tab-btn ${!canJournal ? 'active' : ''}" onclick="acctSwitchTab('balance',this)" id="acct-btn-balance">
          <i data-lucide="scale"></i> Balance & Rapports
        </button>
        ` : ''}
      </div>

      <div id="acct-tab-content"></div>
    `;
    if (window.lucide) lucide.createIcons({ node: container });
    if (defaultTab) {
      await acctRenderTab(defaultTab);
    }
  }

  window.acctSwitchTab = async function (tab, btn) {
    if (window.Auth && DB.AppState.currentUser?.role !== 'admin') {
      if (['journal', 'depenses', 'recettes'].includes(tab) && !Auth.can('accounting_view_journal')) {
        UI.toast('⛔ Vous n\'avez pas la permission d\'accéder à cet onglet.', 'error', 4000);
        return;
      }
      if (tab === 'balance' && !Auth.can('accounting_view_reports')) {
        UI.toast('⛔ Vous n\'avez pas la permission d\'accéder à cet onglet.', 'error', 4000);
        return;
      }
    }
    document.querySelectorAll('#acct-tabs .hr-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    window._acctCurrentTab = tab;
    await acctRenderTab(tab);
  };

  async function acctRenderTab(tab) {
    const c = document.getElementById('acct-tab-content');
    if (!c) return;
    c.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    try {
      switch (tab) {
        case 'journal':  await renderJournal(c); break;
        case 'depenses': await renderDepenses(c); break;
        case 'recettes': await renderRecettes(c); break;
        case 'balance':  await renderBalance(c); break;
        default: c.innerHTML = '<p>Onglet inconnu</p>';
      }
    } catch (e) {
      c.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">Erreur : ${e.message}</p></div>`;
      console.error('[Accounting]', e);
    }
    if (window.lucide) lucide.createIcons({ node: c });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  CHARGEMENT DES DONNÉES
  // ═══════════════════════════════════════════════════════════════════════
  async function loadAccountingData(dateFrom, dateTo) {
    const [sales, cashRegister, returns, payroll, purchaseOrders, users] = await Promise.all([
      DB.dbGetAll('sales'),
      DB.dbGetAll('cashRegister'),
      DB.dbGetAll('movements'),
      DB.dbGetAll('hr_payroll').catch(() => []),
      DB.dbGetAll('purchaseOrders').catch(() => []),
      DB.dbGetAll('users').catch(() => []),
    ]);

    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    // Construire le journal unifié
    const entries = [];

    // 1. Ventes => Recette
    sales.forEach(s => {
      const d = (s.date || '').slice(0, 10);
      if (d < dateFrom || d > dateTo) return;
      const userName = userMap[s.userId]?.name || userMap[s.userId]?.username || '—';
      entries.push({
        date: s.date,
        type: 'recette',
        category: 'Vente',
        label: `Vente #${s.saleNumber || s.id}`,
        debit: 0,
        credit: s.total || 0,
        ref: s.saleNumber || String(s.id),
        user: userName,
        method: s.paymentMethod || 'cash',
      });
    });

    // 2. Sorties manuelles de caisse => Dépense
    cashRegister.filter(c => c.category !== 'RH').forEach(c => {
      const d = (c.date || '').slice(0, 10);
      if (d < dateFrom || d > dateTo) return;
      if (c.type === 'manual_out') {
        const userName = userMap[c.userId]?.name || userMap[c.userId]?.username || '—';
        entries.push({
          date: c.date,
          type: 'depense',
          category: 'Sortie de caisse',
          label: c.reason || 'Sortie manuelle',
          debit: c.amount || 0,
          credit: 0,
          ref: c.reference || '',
          user: userName,
          method: c.paymentMethod || 'cash',
        });
      } else if (c.type === 'manual_in') {
        const userName = userMap[c.userId]?.name || userMap[c.userId]?.username || '—';
        entries.push({
          date: c.date,
          type: 'recette',
          category: 'Dépôt en caisse',
          label: c.reason || 'Dépôt manuel',
          debit: 0,
          credit: c.amount || 0,
          ref: c.reference || '',
          user: userName,
          method: c.paymentMethod || 'cash',
        });
      } else if (c.type === 'return_out') {
        const userName = userMap[c.userId]?.name || userMap[c.userId]?.username || '—';
        entries.push({
          date: c.date,
          type: 'depense',
          category: 'Remboursement retour',
          label: c.reason || 'Retour médicament',
          debit: c.amount || 0,
          credit: 0,
          ref: c.reference || '',
          user: userName,
          method: 'cash',
        });
      } else if (c.type === 'debt_in') {
        // Encaissement d'une créance assurance (tiers payant)
        const userName = userMap[c.userId]?.name || userMap[c.userId]?.username || '—';
        entries.push({
          date: c.date,
          type: 'recette',
          category: 'Règlement Assurance',
          label: c.reason || c.label || 'Encaissement tiers payant',
          debit: 0,
          credit: c.amount || 0,
          ref: c.reference || '',
          user: userName,
          method: c.paymentMethod || 'transfer',
        });
      }
    });

    // 3. Paies RH => Dépense
    payroll.forEach(p => {
      const d = (p.datePaiement || p.date || '').slice(0, 10);
      if (d < dateFrom || d > dateTo) return;
      if (p.status !== 'paye') return;
      const emp = userMap[p.employeeId];
      entries.push({
        date: p.datePaiement || p.date,
        type: 'depense',
        category: 'Salaire',
        label: `Paie ${emp?.nom || emp?.name || '?'} — ${p.period || ''}`,
        debit: p.netAPayer || 0,
        credit: 0,
        ref: `PAY-${p.id}`,
        user: '—',
        method: 'virement',
      });
    });

    // 4. Factures fournisseurs payées => Dépense
    purchaseOrders.forEach(po => {
      const d = (po.date || '').slice(0, 10);
      if (d < dateFrom || d > dateTo) return;
      if ((po.paid || 0) <= 0) return;
      entries.push({
        date: po.date,
        type: 'depense',
        category: 'Achat fournisseur',
        label: `Commande #${po.orderNumber || po.id}`,
        debit: po.paid || 0,
        credit: 0,
        ref: po.orderNumber || String(po.id),
        user: '—',
        method: 'virement',
      });
    });

    // Trier par date décroissante
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { entries, sales, cashRegister, payroll, purchaseOrders, userMap };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 1 : JOURNAL COMPTABLE
  // ═══════════════════════════════════════════════════════════════════════
  async function renderJournal(c) {
    const dateFrom = window._acctDateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const dateTo = window._acctDateTo || today();
    window._acctDateFrom = dateFrom;
    window._acctDateTo = dateTo;
    window._acctJournalPage = window._acctJournalPage || 1;
    window._acctJournalSearch = window._acctJournalSearch || '';
    window._acctJournalFilter = window._acctJournalFilter || '';

    const data = await loadAccountingData(dateFrom, dateTo);
    window._acctData = data;

    let filtered = data.entries;
    const search = window._acctJournalSearch.toLowerCase();
    const filter = window._acctJournalFilter;
    if (search) filtered = filtered.filter(e => e.label.toLowerCase().includes(search) || e.category.toLowerCase().includes(search) || (e.ref || '').toLowerCase().includes(search));
    if (filter) filtered = filtered.filter(e => e.type === filter);

    const totalDebit = filtered.reduce((a, e) => a + e.debit, 0);
    const totalCredit = filtered.reduce((a, e) => a + e.credit, 0);
    const solde = totalCredit - totalDebit;

    const pg = paginate(filtered, window._acctJournalPage, 30);

    c.innerHTML = `
      <!-- Filtres de période -->
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px;">
        <label style="font-size:.82rem;font-weight:600;color:var(--text-muted)">Du</label>
        <input type="date" class="form-control" value="${dateFrom}" style="max-width:160px" onchange="window._acctDateFrom=this.value;window._acctJournalPage=1;acctSwitchTab('journal',document.getElementById('acct-btn-journal'))">
        <label style="font-size:.82rem;font-weight:600;color:var(--text-muted)">Au</label>
        <input type="date" class="form-control" value="${dateTo}" style="max-width:160px" onchange="window._acctDateTo=this.value;window._acctJournalPage=1;acctSwitchTab('journal',document.getElementById('acct-btn-journal'))">
        <div style="position:relative;flex:1;min-width:200px">
          <i data-lucide="search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--text-muted)"></i>
          <input type="text" class="form-control" placeholder="Rechercher..." style="padding-left:32px" value="${window._acctJournalSearch}" oninput="window._acctJournalSearch=this.value;window._acctJournalPage=1;acctSwitchTab('journal',document.getElementById('acct-btn-journal'))">
        </div>
        <select class="form-control" style="max-width:160px" onchange="window._acctJournalFilter=this.value;window._acctJournalPage=1;acctSwitchTab('journal',document.getElementById('acct-btn-journal'))">
          <option value="">Tout</option>
          <option value="recette" ${filter==='recette'?'selected':''}>Recettes</option>
          <option value="depense" ${filter==='depense'?'selected':''}>Dépenses</option>
        </select>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
        <div class="stat-chip stat-green" style="padding:16px;text-align:center;">
          <span class="stat-val" style="font-size:1.2rem">${fmt(totalCredit)}</span>
          <span class="stat-label">Total Recettes (Crédit)</span>
        </div>
        <div class="stat-chip stat-red" style="padding:16px;text-align:center;">
          <span class="stat-val" style="font-size:1.2rem">${fmt(totalDebit)}</span>
          <span class="stat-label">Total Dépenses (Débit)</span>
        </div>
        <div class="stat-chip ${solde >= 0 ? 'stat-blue' : 'stat-orange'}" style="padding:16px;text-align:center;">
          <span class="stat-val" style="font-size:1.2rem">${fmt(solde)}</span>
          <span class="stat-label">Solde Net</span>
        </div>
        <div class="stat-chip stat-purple" style="padding:16px;text-align:center;">
          <span class="stat-val" style="font-size:1.2rem">${filtered.length}</span>
          <span class="stat-label">Écritures</span>
        </div>
      </div>

      <!-- Tableau Journal -->
      <div class="table-responsive" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <table class="data-table" style="margin:0">
          <thead>
            <tr>
              <th>Date</th>
              <th>Catégorie</th>
              <th>Libellé</th>
              <th>Référence</th>
              <th style="text-align:right">Débit</th>
              <th style="text-align:right">Crédit</th>
              <th>Par</th>
            </tr>
          </thead>
          <tbody>
            ${pg.items.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-muted)">Aucune écriture pour cette période</td></tr>` : ''}
            ${pg.items.map(e => `
              <tr>
                <td style="white-space:nowrap;font-size:.82rem;">${fmtD(e.date)}</td>
                <td><span class="badge badge-${e.type === 'recette' ? 'success' : 'danger'}" style="font-size:.72rem">${e.category}</span></td>
                <td style="font-size:.85rem;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.label}</td>
                <td style="font-size:.78rem;color:var(--text-muted)">${e.ref || '—'}</td>
                <td style="text-align:right;font-weight:600;color:${e.debit > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${e.debit > 0 ? fmt(e.debit) : '—'}</td>
                <td style="text-align:right;font-weight:600;color:${e.credit > 0 ? 'var(--success)' : 'var(--text-muted)'}">${e.credit > 0 ? fmt(e.credit) : '—'}</td>
                <td style="font-size:.78rem;color:var(--text-muted)">${e.user}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--surface-2);font-weight:700;">
              <td colspan="4" style="text-align:right">TOTAUX :</td>
              <td style="text-align:right;color:var(--danger)">${fmt(totalDebit)}</td>
              <td style="text-align:right;color:var(--success)">${fmt(totalCredit)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Pagination -->
      ${pg.totalPages > 1 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;gap:10px;flex-wrap:wrap;">
        <span style="font-size:13px;color:var(--text-muted)">${pg.total} écritures — Page ${pg.page}/${pg.totalPages}</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" ${pg.page<=1?'disabled':''} onclick="window._acctJournalPage=${pg.page-1};acctSwitchTab('journal',document.getElementById('acct-btn-journal'))">Précédent</button>
          <button class="btn btn-secondary btn-sm" ${pg.page>=pg.totalPages?'disabled':''} onclick="window._acctJournalPage=${pg.page+1};acctSwitchTab('journal',document.getElementById('acct-btn-journal'))">Suivant</button>
        </div>
      </div>` : ''}
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 2 : DÉPENSES
  // ═══════════════════════════════════════════════════════════════════════
  async function renderDepenses(c) {
    const dateFrom = window._acctDateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const dateTo = window._acctDateTo || today();
    const data = window._acctData || await loadAccountingData(dateFrom, dateTo);
    window._acctData = data;

    const depenses = data.entries.filter(e => e.type === 'depense');
    window._acctDepensePage = window._acctDepensePage || 1;

    // Grouper par catégorie pour les statistiques
    const catMap = {};
    depenses.forEach(d => {
      catMap[d.category] = (catMap[d.category] || 0) + d.debit;
    });
    const totalDepenses = depenses.reduce((a, d) => a + d.debit, 0);

    const pg = paginate(depenses, window._acctDepensePage, 25);

    c.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:800;color:var(--danger)">${fmt(totalDepenses)}</div>
          <div style="font-size:.78rem;color:var(--text-muted)">Total Dépenses</div>
        </div>
        ${Object.entries(catMap).sort((a,b) => b[1] - a[1]).slice(0, 4).map(([cat, val]) => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:1rem;font-weight:700;">${fmt(val)}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${cat}</div>
          </div>
        `).join('')}
      </div>

      <div class="table-responsive" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <table class="data-table" style="margin:0">
          <thead><tr><th>Date</th><th>Catégorie</th><th>Libellé</th><th>Référence</th><th style="text-align:right">Montant</th><th>Par</th></tr></thead>
          <tbody>
            ${pg.items.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Aucune dépense</td></tr>' : ''}
            ${pg.items.map(e => `
              <tr>
                <td style="font-size:.82rem;">${fmtD(e.date)}</td>
                <td><span class="badge badge-danger" style="font-size:.72rem">${e.category}</span></td>
                <td style="font-size:.85rem;">${e.label}</td>
                <td style="font-size:.78rem;color:var(--text-muted)">${e.ref || '—'}</td>
                <td style="text-align:right;font-weight:700;color:var(--danger)">${fmt(e.debit)}</td>
                <td style="font-size:.78rem;color:var(--text-muted)">${e.user}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${pg.totalPages > 1 ? `
      <div style="display:flex;justify-content:center;gap:8px;padding:14px 0;">
        <button class="btn btn-secondary btn-sm" ${pg.page<=1?'disabled':''} onclick="window._acctDepensePage=${pg.page-1};acctSwitchTab('depenses',document.getElementById('acct-btn-depenses'))">Précédent</button>
        <span style="font-size:.82rem;color:var(--text-muted);line-height:32px;">Page ${pg.page}/${pg.totalPages}</span>
        <button class="btn btn-secondary btn-sm" ${pg.page>=pg.totalPages?'disabled':''} onclick="window._acctDepensePage=${pg.page+1};acctSwitchTab('depenses',document.getElementById('acct-btn-depenses'))">Suivant</button>
      </div>` : ''}
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 3 : RECETTES
  // ═══════════════════════════════════════════════════════════════════════
  async function renderRecettes(c) {
    const dateFrom = window._acctDateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const dateTo = window._acctDateTo || today();
    const data = window._acctData || await loadAccountingData(dateFrom, dateTo);
    window._acctData = data;

    const recettes = data.entries.filter(e => e.type === 'recette');
    window._acctRecettePage = window._acctRecettePage || 1;

    const catMap = {};
    recettes.forEach(r => {
      catMap[r.category] = (catMap[r.category] || 0) + r.credit;
    });
    const totalRecettes = recettes.reduce((a, r) => a + r.credit, 0);

    // Ventilation par méthode de paiement
    const methodMap = {};
    recettes.forEach(r => {
      const m = r.method === 'cash' ? 'Espèces' : r.method === 'card' ? 'Carte' : r.method === 'mobile' ? 'Mobile Money' : r.method === 'insurance' ? 'Assurance' : r.method || 'Autre';
      methodMap[m] = (methodMap[m] || 0) + r.credit;
    });

    const pg = paginate(recettes, window._acctRecettePage, 25);

    c.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:800;color:var(--success)">${fmt(totalRecettes)}</div>
          <div style="font-size:.78rem;color:var(--text-muted)">Total Recettes</div>
        </div>
        ${Object.entries(methodMap).sort((a,b) => b[1] - a[1]).map(([m, val]) => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;">
            <div style="font-size:1rem;font-weight:700;">${fmt(val)}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">${m}</div>
          </div>
        `).join('')}
      </div>

      <div class="table-responsive" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <table class="data-table" style="margin:0">
          <thead><tr><th>Date</th><th>Catégorie</th><th>Libellé</th><th>Référence</th><th style="text-align:right">Montant</th><th>Par</th></tr></thead>
          <tbody>
            ${pg.items.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted)">Aucune recette</td></tr>' : ''}
            ${pg.items.map(e => `
              <tr>
                <td style="font-size:.82rem;">${fmtD(e.date)}</td>
                <td><span class="badge badge-success" style="font-size:.72rem">${e.category}</span></td>
                <td style="font-size:.85rem;">${e.label}</td>
                <td style="font-size:.78rem;color:var(--text-muted)">${e.ref || '—'}</td>
                <td style="text-align:right;font-weight:700;color:var(--success)">${fmt(e.credit)}</td>
                <td style="font-size:.78rem;color:var(--text-muted)">${e.user}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${pg.totalPages > 1 ? `
      <div style="display:flex;justify-content:center;gap:8px;padding:14px 0;">
        <button class="btn btn-secondary btn-sm" ${pg.page<=1?'disabled':''} onclick="window._acctRecettePage=${pg.page-1};acctSwitchTab('recettes',document.getElementById('acct-btn-recettes'))">Précédent</button>
        <span style="font-size:.82rem;color:var(--text-muted);line-height:32px;">Page ${pg.page}/${pg.totalPages}</span>
        <button class="btn btn-secondary btn-sm" ${pg.page>=pg.totalPages?'disabled':''} onclick="window._acctRecettePage=${pg.page+1};acctSwitchTab('recettes',document.getElementById('acct-btn-recettes'))">Suivant</button>
      </div>` : ''}
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 4 : BALANCE & RAPPORTS
  // ═══════════════════════════════════════════════════════════════════════
  async function renderBalance(c) {
    const dateFrom = window._acctDateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const dateTo = window._acctDateTo || today();
    const data = window._acctData || await loadAccountingData(dateFrom, dateTo);
    window._acctData = data;

    const entries = data.entries;
    const totalDebit = entries.reduce((a, e) => a + e.debit, 0);
    const totalCredit = entries.reduce((a, e) => a + e.credit, 0);
    const solde = totalCredit - totalDebit;

    // Répartition par catégorie
    const catStats = {};
    entries.forEach(e => {
      if (!catStats[e.category]) catStats[e.category] = { debit: 0, credit: 0 };
      catStats[e.category].debit += e.debit;
      catStats[e.category].credit += e.credit;
    });

    // Répartition par jour
    const dailyStats = {};
    entries.forEach(e => {
      const d = (e.date || '').slice(0, 10);
      if (!dailyStats[d]) dailyStats[d] = { debit: 0, credit: 0 };
      dailyStats[d].debit += e.debit;
      dailyStats[d].credit += e.credit;
    });
    const dailySorted = Object.entries(dailyStats).sort((a, b) => b[0].localeCompare(a[0]));

    c.innerHTML = `
      <!-- Résumé financier -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px;">
        <div style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border-radius:14px;padding:24px;text-align:center;">
          <div style="font-size:1.5rem;font-weight:800">${fmt(totalCredit)}</div>
          <div style="font-size:.82rem;opacity:.85;margin-top:4px">Total Recettes</div>
        </div>
        <div style="background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border-radius:14px;padding:24px;text-align:center;">
          <div style="font-size:1.5rem;font-weight:800">${fmt(totalDebit)}</div>
          <div style="font-size:.82rem;opacity:.85;margin-top:4px">Total Dépenses</div>
        </div>
        <div style="background:linear-gradient(135deg,${solde >= 0 ? '#3b82f6,#2563eb' : '#f59e0b,#d97706'});color:#fff;border-radius:14px;padding:24px;text-align:center;">
          <div style="font-size:1.5rem;font-weight:800">${fmt(solde)}</div>
          <div style="font-size:.82rem;opacity:.85;margin-top:4px">Solde Net (${solde >= 0 ? 'Excédent' : 'Déficit'})</div>
        </div>
      </div>

      <!-- Balance par catégorie -->
      <h3 style="font-size:.95rem;font-weight:700;margin-bottom:12px"><i data-lucide="pie-chart" style="width:16px;height:16px"></i> Balance par Catégorie</h3>
      <div class="table-responsive" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:24px;">
        <table class="data-table" style="margin:0">
          <thead><tr><th>Catégorie</th><th style="text-align:right">Débit</th><th style="text-align:right">Crédit</th><th style="text-align:right">Solde</th></tr></thead>
          <tbody>
            ${Object.entries(catStats).sort((a,b) => (b[1].credit - b[1].debit) - (a[1].credit - a[1].debit)).map(([cat, v]) => `
              <tr>
                <td style="font-weight:600">${cat}</td>
                <td style="text-align:right;color:var(--danger)">${v.debit > 0 ? fmt(v.debit) : '—'}</td>
                <td style="text-align:right;color:var(--success)">${v.credit > 0 ? fmt(v.credit) : '—'}</td>
                <td style="text-align:right;font-weight:700;color:${(v.credit - v.debit) >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(v.credit - v.debit)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--surface-2);font-weight:800;">
              <td>TOTAL</td>
              <td style="text-align:right;color:var(--danger)">${fmt(totalDebit)}</td>
              <td style="text-align:right;color:var(--success)">${fmt(totalCredit)}</td>
              <td style="text-align:right;color:${solde >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(solde)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Résumé journalier -->
      <h3 style="font-size:.95rem;font-weight:700;margin-bottom:12px"><i data-lucide="calendar" style="width:16px;height:16px"></i> Résumé Journalier</h3>
      <div class="table-responsive" style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">
        <table class="data-table" style="margin:0">
          <thead><tr><th>Date</th><th style="text-align:right">Recettes</th><th style="text-align:right">Dépenses</th><th style="text-align:right">Solde du jour</th></tr></thead>
          <tbody>
            ${dailySorted.slice(0, 31).map(([d, v]) => `
              <tr>
                <td>${fmtD(d)}</td>
                <td style="text-align:right;color:var(--success)">${fmt(v.credit)}</td>
                <td style="text-align:right;color:var(--danger)">${fmt(v.debit)}</td>
                <td style="text-align:right;font-weight:700;color:${(v.credit - v.debit) >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(v.credit - v.debit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  EXPORT PDF
  // ═══════════════════════════════════════════════════════════════════════
  window.acctExportPDF = async function() {
    if (window.Auth && !Auth.can('accounting_export') && DB.AppState.currentUser?.role !== 'admin') {
      UI.toast('⛔ Vous n\'avez pas la permission d\'exporter les rapports de comptabilité.', 'error', 4000);
      return;
    }
    if (!window.PDFExport) { UI.toast("Module PDF non chargé", "error"); return; }

    const dateFrom = window._acctDateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const dateTo = window._acctDateTo || today();
    const data = window._acctData || await loadAccountingData(dateFrom, dateTo);

    const entries = data.entries;
    const totalDebit = entries.reduce((a, e) => a + e.debit, 0);
    const totalCredit = entries.reduce((a, e) => a + e.credit, 0);
    const solde = totalCredit - totalDebit;

    const headers = ["Date", "Catégorie", "Libellé", "Référence", "Débit", "Crédit"];
    const rows = entries.map(e => [
      fmtD(e.date),
      e.category,
      e.label,
      e.ref || '—',
      e.debit > 0 ? fmt(e.debit) : '',
      e.credit > 0 ? fmt(e.credit) : '',
    ]);

    await PDFExport.generate(
      "Journal Comptable",
      headers,
      rows,
      {
        orientation: 'landscape',
        subHeader: [
          `Période : ${fmtD(dateFrom)} au ${fmtD(dateTo)}`,
          `${entries.length} écritures comptables`
        ],
        summaryBlocks: [
          { label: "Total Recettes (Crédit)", value: fmt(totalCredit) },
          { label: "Total Dépenses (Débit)", value: fmt(totalDebit) },
          { label: "Solde Net", value: fmt(solde) },
        ]
      }
    );
  };

})();
