// Fonction d'aide pour le bouton Percevoir Tout
window.setPayAmount = function(amount) {
  const el = document.getElementById('pay-amount');
  if (el) {
    el.value = amount;
    // Déclencher manuellement l'événement input pour mise à jour éventuelle des écouteurs
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
};

async function renderInsurances(container) {
  if (window.Auth && !Auth.can('claims_view') && DB.AppState.currentUser?.role !== 'admin') {
    container.innerHTML = `
      <div style="padding:40px; text-align:center; color:var(--text-muted)">
        <i data-lucide="lock" style="width:48px; height:48px; margin:0 auto 16px; opacity:0.3; display:block"></i>
        <h3>Accès refusé</h3>
        <p>Vous n'avez pas la permission de consulter le registre des assurances et tiers payant.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ root: container });
    return;
  }

  UI.loading(container, 'Chargement du module assurances...');

  const [insurances, sales, users] = await Promise.all([
    DB.dbGetAll('insurances'),
    DB.dbGetAll('sales', 'paymentMethod', 'assurance'), // Index paymentMethod — charge uniquement les ventes assurance
    DB.dbGetAll('users')
  ]);

  // Scope global pour filtrage et actions
  window._insurancesData = insurances || [];
  window._insurancesSales = sales || [];
  window._insurancesUsers = users || [];
  window._activeInsuranceId = null;

  // Calculer l'encours global
  let totalBilledAll = 0;
  let totalPaidAll = 0;
  
  // Parcourir toutes les ventes pour calculer les encours
  sales.forEach(s => {
    if (s.paymentMethod === 'assurance' && s.insuranceId) {
      totalBilledAll += s.assuranceAmount || s.total || 0;
      totalPaidAll += s.insurancePaidAmount || 0;
    }
  });
  const globalEncours = Math.max(0, totalBilledAll - totalPaidAll);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Assurances & Tiers Payant</h1>
        <p class="page-subtitle">Gestion des organismes de couverture, suivi financier et recouvrement des créances</p>
      </div>
      <div class="header-actions">
        ${Auth.can('claims_view') || DB.AppState.currentUser?.role === 'admin' ? `
        <button class="btn btn-primary" onclick="showAddInsuranceModal()"><i data-lucide="plus"></i> Nouvelle Assurance</button>
        ` : ''}
      </div>
    </div>

    <!-- BLOCS KPI GLOBAUX -->
    <div class="kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:20px;">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i data-lucide="shield"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${insurances.length}</div>
          <div class="kpi-label">Organismes Enregistrés</div>
        </div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i data-lucide="banknote"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${UI.formatCurrency(totalBilledAll)}</div>
          <div class="kpi-label">Total Tiers Payant Facturé</div>
        </div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i data-lucide="check-circle"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${UI.formatCurrency(totalPaidAll)}</div>
          <div class="kpi-label">Total Règlements Reçus</div>
        </div>
      </div>
      <div class="kpi-card kpi-red">
        <div class="kpi-icon"><i data-lucide="alert-circle"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${UI.formatCurrency(globalEncours)}</div>
          <div class="kpi-label">Encours Restant Global</div>
        </div>
      </div>
    </div>

    <div class="insurances-layout-grid" style="display:grid; grid-template-columns: 300px minmax(0, 1fr); gap:20px; align-items:start;">
      <!-- COLONNE GAUCHE : LISTE DES ASSURANCES -->
      <div class="card" style="padding:16px; position:sticky; top:80px;">
        <h3 style="font-size:14px; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <i data-lucide="list"></i> Liste des Organismes
        </h3>
        <div class="form-group" style="margin-bottom:12px;">
          <input type="text" id="insurance-list-search" class="form-control" placeholder="Rechercher par nom, code..." oninput="filterInsurancesList()">
        </div>
        <div id="insurances-list-container" style="max-height:calc(100vh - 340px); overflow-y:auto; display:flex; flex-direction:column; gap:8px;">
          <!-- Injecté dynamiquement -->
        </div>
      </div>

      <!-- COLONNE DROITE : SYNTHÈSE / DÉTAILS DE L'ASSURANCE -->
      <div id="insurance-details-container" style="min-height:60vh;">
        <div class="empty-state" style="padding:60px; text-align:center; background:var(--surface); border-radius:12px; border:1px solid var(--border);">
          <div class="empty-icon" style="font-size:48px; color:var(--text-muted); margin-bottom:12px;"><i data-lucide="shield-alert"></i></div>
          <h3 style="font-size:16px; font-weight:700; margin-bottom:4px;">Aucun organisme sélectionné</h3>
          <p style="color:var(--text-muted); font-size:13px;">Veuillez cliquer sur une assurance dans la liste de gauche pour afficher son dossier financier ERP et gérer ses factures et paiements.</p>
        </div>
      </div>
    </div>
  `;

  // Rendre la liste de gauche
  filterInsurancesList();
  
  if (window.lucide) lucide.createIcons();
}

function filterInsurancesList() {
  const search = (document.getElementById('insurance-list-search')?.value || '').toLowerCase();
  const container = document.getElementById('insurances-list-container');
  if (!container) return;

  const filtered = window._insurancesData.filter(ins => 
    ins.name.toLowerCase().includes(search) || 
    (ins.code && ins.code.toLowerCase().includes(search))
  );

  if (filtered.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:12px; padding:20px;">Aucune assurance trouvée</p>`;
    return;
  }

  // Calculer l'encours par assurance pour l'afficher sur chaque carte
  container.innerHTML = filtered.map(ins => {
    let billed = 0;
    let paid = 0;
    window._insurancesSales.forEach(s => {
      if (s.paymentMethod === 'assurance' && String(s.insuranceId) === String(ins.id)) {
        billed += s.assuranceAmount || s.total || 0;
        paid += s.insurancePaidAmount || 0;
      }
    });
    const due = Math.max(0, billed - paid);
    const activeClass = String(window._activeInsuranceId) === String(ins.id) ? 'active-insurance-card' : '';
    const statusBadge = ins.status === 'active' 
      ? `<span class="badge badge-success" style="font-size:9px; padding:2px 6px;">Active</span>` 
      : `<span class="badge badge-danger" style="font-size:9px; padding:2px 6px;">Inactive</span>`;

    return `
      <div class="insurance-item-card ${activeClass}" onclick="selectInsurance(${ins.id})" 
        style="padding:12px; border:1px solid var(--border); border-radius:10px; cursor:pointer; background:var(--surface); transition:all 0.2s;">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:4px;">
          <strong style="font-size:13px; color:var(--text);">${ins.name}</strong>
          ${statusBadge}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-muted);">
          <span>Code: <code>${ins.code || '—'}</code></span>
          <span style="font-weight:700; color:${due > 0 ? 'var(--red)' : 'var(--green)'}">${UI.formatCurrency(due)} dû</span>
        </div>
      </div>
    `;
  }).join('');
}

async function selectInsurance(id) {
  window._activeInsuranceId = id;
  
  // Mettre à jour la classe active sur les cartes
  filterInsurancesList();

  const ins = window._insurancesData.find(x => String(x.id) === String(id));
  if (!ins) return;

  const container = document.getElementById('insurance-details-container');
  if (!container) return;

  // Récupérer les ventes et paiements liés à cette assurance
  const allPayments = await DB.dbGetAll('insurancePayments') || [];
  // Stocker en cache global pour l'export CSV
  window._insurancesPaymentsCache = allPayments;
  const payments = allPayments.filter(p => String(p.insuranceId) === String(id)).sort((a,b) => b.timestamp - a.timestamp);
  const sales = window._insurancesSales.filter(s => s.paymentMethod === 'assurance' && String(s.insuranceId) === String(id))
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  // Calculs financiers
  let totalBilled = 0;
  let totalPaid = 0;
  sales.forEach(s => {
    totalBilled += s.assuranceAmount || s.total || 0;
    totalPaid += s.insurancePaidAmount || 0;
  });
  const totalDue = Math.max(0, totalBilled - totalPaid);

  // Valeurs par défaut pour filtres de date de facturation groupée
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const fromDefault = startOfMonth.toISOString().split('T')[0];
  const toDefault = today.toISOString().split('T')[0];

  container.innerHTML = `
    <div class="card" style="padding:20px;">
      <!-- EN-TÊTE ASSURANCE -->
      <div style="display:flex; justify-content:space-between; align-items:start; border-bottom:1px solid var(--border); padding-bottom:16px; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <div>
          <span style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--primary-color);">Dossier Assurance</span>
          <h2 style="font-size:20px; font-weight:800; margin:4px 0 2px 0; color:var(--text);">${ins.name}</h2>
          <div style="font-size:12px; color:var(--text-muted); display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:4px;">
            <span>Code interne : <code>${ins.code}</code></span>
            <span>&bull;</span>
            <span>Mode : <strong>${ins.paymentMode === 'integral' ? 'Paiement Intégral' : 'Paiement Échelonné'}</strong></span>
            ${ins.contact ? `<span>&bull;</span><span><i data-lucide="user-cog" style="width:12px;height:12px;"></i> ${ins.contact}</span>` : ''}
            ${ins.phone ? `<span><i data-lucide="phone" style="width:12px;height:12px;"></i> ${ins.phone}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="showEditInsuranceModal(${ins.id})"><i data-lucide="edit"></i> Modifier</button>
          <button class="btn btn-success btn-sm" ${totalDue <= 0 ? 'disabled' : ''} onclick="showAddPaymentModal(${ins.id}, ${totalDue})"><i data-lucide="credit-card"></i> Enregistrer Règlement</button>
        </div>
      </div>

      <!-- KPIs FINANCIERS DE L'ASSURANCE -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-bottom:20px;">
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px 12px; border-radius:10px; text-align:center;">
          <div style="font-size:10px; color:#64748B; font-weight:700; text-transform:uppercase;">Total Facturé</div>
          <div style="font-size:18px; font-weight:800; color:#0F172A; margin-top:4px;">${UI.formatCurrency(totalBilled)}</div>
          <div style="font-size:10px; color:#94A3B8; margin-top:2px;">${sales.length} facture(s)</div>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px 12px; border-radius:10px; text-align:center;">
          <div style="font-size:10px; color:#64748B; font-weight:700; text-transform:uppercase;">Total Encaissé</div>
          <div style="font-size:18px; font-weight:800; color:#16A34A; margin-top:4px;">${UI.formatCurrency(totalPaid)}</div>
          <div style="font-size:10px; color:#94A3B8; margin-top:2px;">${payments.length} règlement(s)</div>
        </div>
        <div style="background:${totalDue > 0 ? '#FEF2F2' : '#F0FDF4'}; border:1px solid ${totalDue > 0 ? '#FEE2E2' : '#DCFCE7'}; padding:14px 12px; border-radius:10px; text-align:center;">
          <div style="font-size:10px; color:${totalDue > 0 ? '#991B1B' : '#166534'}; font-weight:700; text-transform:uppercase;">Solde Restant</div>
          <div style="font-size:18px; font-weight:800; color:${totalDue > 0 ? '#DC2626' : '#15803D'}; margin-top:4px;">${UI.formatCurrency(totalDue)}</div>
          <div style="font-size:10px; color:#94A3B8; margin-top:2px;">${totalDue > 0 ? 'Encours dû' : 'Soldé'}</div>
        </div>
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:14px 12px; border-radius:10px; text-align:center;">
          <div style="font-size:10px; color:#64748B; font-weight:700; text-transform:uppercase;">Couverture</div>
          <div style="font-size:18px; font-weight:800; color:var(--primary-color); margin-top:4px;">${ins.coveragePercent || ins.coverage || 70}%</div>
          <div style="font-size:10px; color:#94A3B8; margin-top:2px;">Part assurance</div>
        </div>
      </div>

      <!-- INFORMATIONS COMPLÉMENTAIRES -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:16px; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:20px; font-size:14px; line-height:1.8;">
        <div>
          <h4 style="margin:0 0 10px 0; font-size:12px; font-weight:700; color:var(--primary-color); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px; border-bottom:1px solid var(--border); padding-bottom:6px;">
            <i data-lucide="user-cog" style="width:14px;height:14px;"></i> Contact & Coordonnées
          </h4>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div><span style="color:var(--text-muted); min-width:80px; display:inline-block;">Référent</span> <strong>${ins.contact || '—'}</strong></div>
            <div><span style="color:var(--text-muted); min-width:80px; display:inline-block;">Téléphone</span> <strong>${ins.phone || '—'}</strong></div>
            <div><span style="color:var(--text-muted); min-width:80px; display:inline-block;">E-mail</span> <strong>${ins.email || '—'}</strong></div>
            <div><span style="color:var(--text-muted); min-width:80px; display:inline-block;">Adresse</span> <strong>${ins.address || '—'}</strong></div>
          </div>
        </div>
        <div>
          <h4 style="margin:0 0 10px 0; font-size:12px; font-weight:700; color:var(--primary-color); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px; border-bottom:1px solid var(--border); padding-bottom:6px;">
            <i data-lucide="settings" style="width:14px;height:14px;"></i> Paramètres Tiers Payant
          </h4>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div><span style="color:var(--text-muted); min-width:100px; display:inline-block;">Réf. Interne</span> <code>${ins.refPerson || ins.referent || '—'}</code></div>
            <div><span style="color:var(--text-muted); min-width:100px; display:inline-block;">Couverture</span> <span class="badge badge-info" style="font-size:12px; font-weight:700;">${ins.coveragePercent || ins.coverage || 70}%</span></div>
            <div><span style="color:var(--text-muted); min-width:100px; display:inline-block;">Règlement</span> <span>${ins.paymentMode === 'integral' ? 'Paiement Intégral' : 'Paiement Échelonné'}</span></div>
            <div><span style="color:var(--text-muted); min-width:100px; display:inline-block;">Statut</span> <span class="badge badge-${ins.status === 'active' ? 'success' : 'danger'}">${ins.status === 'active' ? 'Active' : 'Inactive'}</span></div>
          </div>
        </div>
        <div style="grid-column:1/-1;">
          <h4 style="margin:0 0 8px 0; font-size:12px; font-weight:700; color:var(--primary-color); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px; border-bottom:1px solid var(--border); padding-bottom:6px;">
            <i data-lucide="file-text" style="width:14px;height:14px;"></i> Conditions de Prise en Charge
          </h4>
          <div style="background:rgba(0,0,0,0.02); padding:12px 16px; border-radius:8px; border:1px dashed var(--border); font-style:italic; white-space:pre-wrap; color:var(--text); font-size:13px;">${ins.conditions || 'Aucune condition spécifique définie.'}</div>
          ${ins.observations ? `<div style="margin-top:10px;"><h4 style="margin:0 0 6px 0; font-size:12px; font-weight:700; color:var(--primary-color); text-transform:uppercase; display:flex; align-items:center; gap:6px;"><i data-lucide="notepad-text" style="width:14px;height:14px;"></i> Observations</h4><div style="background:rgba(0,0,0,0.02); padding:10px 14px; border-radius:8px; border:1px dashed var(--border); white-space:pre-wrap; color:var(--text-muted); font-size:13px;">${ins.observations}</div></div>` : ''}
        </div>
      </div>

      <!-- NAVIGATION PAR ONGLETS -->
      <div style="display:flex; border-bottom:2px solid var(--border); margin-bottom:16px; gap:0; overflow-x:auto;">
        <button class="tab-header active" id="tab-btn-factures" onclick="switchInsuranceTab('factures')" 
          style="padding:10px 16px; font-weight:700; background:none; border:none; cursor:pointer; font-size:13px; color:var(--primary-color); border-bottom:2px solid var(--primary-color); display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
          <i data-lucide="receipt" style="width:16px;height:16px;"></i> Historique Factures (${sales.length})
        </button>
        <button class="tab-header" id="tab-btn-payments" onclick="switchInsuranceTab('payments')" 
          style="padding:10px 16px; font-weight:700; background:none; border:none; cursor:pointer; font-size:13px; color:var(--text-muted); border-bottom:2px solid transparent; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
          <i data-lucide="wallet" style="width:16px;height:16px;"></i> Règlements (${payments.length})
        </button>
        <button class="tab-header" id="tab-btn-group" onclick="switchInsuranceTab('group')" 
          style="padding:10px 16px; font-weight:700; background:none; border:none; cursor:pointer; font-size:13px; color:var(--text-muted); border-bottom:2px solid transparent; display:inline-flex; align-items:center; gap:6px; white-space:nowrap;">
          <i data-lucide="building" style="width:16px;height:16px;"></i> Facturation Groupée
        </button>
      </div>

      <!-- ONGLET HISTORIQUE DES FACTURES -->
      <div class="insurance-tab-content" id="tab-content-factures">
        <!-- Barre de filtre par période -->
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:12px; padding:12px 14px; background:var(--surface); border:1px solid var(--border); border-radius:10px;">
          <i data-lucide="calendar-range" style="width:16px;height:16px; color:var(--text-muted);"></i>
          <span style="font-size:12px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Filtrer :</span>
          <input type="date" id="sales-filter-from" class="form-control" style="width:auto; font-size:12px;" oninput="renderInsuranceSalesTableFiltered()">
          <span style="color:var(--text-muted);">→</span>
          <input type="date" id="sales-filter-to" class="form-control" style="width:auto; font-size:12px;" oninput="renderInsuranceSalesTableFiltered()">
          <div style="display:flex; gap:6px; margin-left:4px;">
            <button class="btn btn-secondary btn-sm" onclick="setInsuranceSalesPeriod('month')" style="font-size:11px;">Ce mois</button>
            <button class="btn btn-secondary btn-sm" onclick="setInsuranceSalesPeriod('quarter')" style="font-size:11px;">Ce trimestre</button>
            <button class="btn btn-secondary btn-sm" onclick="setInsuranceSalesPeriod('year')" style="font-size:11px;">Cette année</button>
            <button class="btn btn-secondary btn-sm" onclick="setInsuranceSalesPeriod('all')" style="font-size:11px;">Tout afficher</button>
          </div>
        </div>
        <div id="insurance-sales-table"></div>
      </div>

      <!-- ONGLET HISTORIQUE DES PAIEMENTS -->
      <div class="insurance-tab-content" id="tab-content-payments" style="display:none;">
        <div id="insurance-payments-table"></div>
      </div>

      <!-- ONGLET FACTURATION GROUPÉE -->
      <div class="insurance-tab-content" id="tab-content-group" style="display:none;">
        <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:16px; border-radius:10px; margin-bottom:16px; display:flex; gap:12px; align-items:end; flex-wrap:wrap;">
          <div style="flex:1; min-width:150px;">
            <label style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase; margin-bottom:4px; display:block;">Période Début</label>
            <input type="date" id="group-date-from" class="form-control" value="${fromDefault}" onchange="renderGroupedInvoices()">
          </div>
          <div style="flex:1; min-width:150px;">
            <label style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase; margin-bottom:4px; display:block;">Période Fin</label>
            <input type="date" id="group-date-to" class="form-control" value="${toDefault}" onchange="renderGroupedInvoices()">
          </div>
          <button class="btn btn-secondary" onclick="exportGroupedPDF()"><i data-lucide="printer"></i> Imprimer Relevé</button>
          <button class="btn btn-secondary" onclick="exportGroupedCSV()"><i data-lucide="download"></i> CSV</button>
        </div>
        <div id="grouped-invoices-table"></div>
      </div>
    </div>
  `;

  // Rendre les tables internes
  renderInsuranceSalesTable(sales);
  renderInsurancePaymentsTable(payments);
  renderGroupedInvoices();

  if (window.lucide) lucide.createIcons();
}

function switchInsuranceTab(tabName) {
  document.querySelectorAll('.tab-header').forEach(btn => {
    btn.style.color = 'var(--text-muted)';
    btn.style.borderBottomColor = 'transparent';
  });
  const activeBtn = document.getElementById(`tab-btn-${tabName}`);
  if (activeBtn) {
    activeBtn.style.color = 'var(--primary-color)';
    activeBtn.style.borderBottom = '2px solid var(--primary-color)';
  }

  document.querySelectorAll('.insurance-tab-content').forEach(content => {
    content.style.display = 'none';
  });
  const activeContent = document.getElementById(`tab-content-${tabName}`);
  if (activeContent) activeContent.style.display = 'block';
}

function renderInsuranceSalesTable(sales) {
  const container = document.getElementById('insurance-sales-table');
  if (!container) return;

  // Stocker pour usage par le filtre
  window._currentInsuranceSales = sales;

  const columns = [
    { label: 'N° Facture', render: r => `<code class="code-tag">#${String(r.id).padStart(6, '0')}</code>` },
    { label: 'Date', render: r => UI.formatDate(r.date ? r.date.split('T')[0] : '') },
    { label: 'Patient', render: r => `<strong>${r.patientName || 'Anonyme'}</strong>` },
    { label: 'Total Vente', render: r => UI.formatCurrency(r.total) },
    { label: 'Part Assurance', render: r => `<span class="text-primary" style="font-weight:700;">${UI.formatCurrency(r.assuranceAmount != null ? r.assuranceAmount : r.total)}</span>` },
    { label: 'Déjà Réglé', render: r => `<span class="text-success">${UI.formatCurrency(r.insurancePaidAmount || 0)}</span>` },
    { 
      label: 'Reste à payer', 
      render: r => {
        const amt = r.assuranceAmount != null ? r.assuranceAmount : r.total;
        const due = Math.max(0, amt - (r.insurancePaidAmount || 0));
        return due > 0 
          ? `<strong class="text-danger">${UI.formatCurrency(due)}</strong>` 
          : `<span class="badge badge-success">Soldé</span>`;
      } 
    },
    {
      label: 'Statut',
      render: r => {
        const amt = r.assuranceAmount != null ? r.assuranceAmount : r.total;
        const due = Math.max(0, amt - (r.insurancePaidAmount || 0));
        return due <= 0 
          ? `<span class="badge badge-success">Payé</span>` 
          : (r.insurancePaidAmount > 0)
            ? `<span class="badge badge-warning">Partiel</span>`
            : `<span class="badge badge-danger">Impayé</span>`;
      }
    }
  ];

  UI.table(container, columns, sales, {
    emptyMessage: "Aucune facture trouvée pour la période.",
    emptyIcon: 'file-text'
  });
}

window.renderInsuranceSalesTableFiltered = function() {
  const fromVal = document.getElementById('sales-filter-from')?.value;
  const toVal = document.getElementById('sales-filter-to')?.value;
  let filtered = window._currentInsuranceSales || [];
  if (fromVal) filtered = filtered.filter(s => (s.date || '') >= fromVal);
  if (toVal) filtered = filtered.filter(s => (s.date || '').split('T')[0] <= toVal);
  renderInsuranceSalesTable(filtered);
};

window.setInsuranceSalesPeriod = function(period) {
  const today = new Date();
  let from, to = today.toISOString().split('T')[0];
  if (period === 'month') {
    from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  } else if (period === 'quarter') {
    const q = Math.floor(today.getMonth() / 3);
    from = new Date(today.getFullYear(), q * 3, 1).toISOString().split('T')[0];
  } else if (period === 'year') {
    from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
  } else {
    from = '';
    to = '';
  }
  const fromEl = document.getElementById('sales-filter-from');
  const toEl = document.getElementById('sales-filter-to');
  if (fromEl) fromEl.value = from;
  if (toEl) toEl.value = to;
  renderInsuranceSalesTableFiltered();
};

function renderInsurancePaymentsTable(payments) {
  const container = document.getElementById('insurance-payments-table');
  if (!container) return;

  // Créer un dictionnaire rapide des utilisateurs
  const userMap = {};
  window._insurancesUsers.forEach(u => { userMap[u.id] = u.name || u.username; });

  const columns = [
    { label: 'Date règlement', render: r => UI.formatDateTime(r.timestamp) },
    { label: 'Montant perçu', render: r => `<strong class="text-success">${UI.formatCurrency(r.amount)}</strong>` },
    { label: 'Mode paiement', render: r => `<span style="text-transform:capitalize;">${r.paymentMethod.replace('_', ' ')}</span>` },
    { label: 'Référence / Chèque', render: r => `<code>${r.reference || '—'}</code>` },
    { label: 'Observations', render: r => `<span class="text-muted" style="font-size:11px;">${r.observations || '—'}</span>` },
    { label: 'Enregistré par', render: r => userMap[r.userId] || 'Inconnu' }
  ];

  UI.table(container, columns, payments, {
    emptyMessage: "Aucun règlement enregistré pour cette assurance.",
    emptyIcon: 'banknote'
  });
}

function renderGroupedInvoices() {
  const container = document.getElementById('grouped-invoices-table');
  if (!container) return;

  const fromDate = document.getElementById('group-date-from')?.value;
  const toDate = document.getElementById('group-date-to')?.value;

  let filteredSales = window._insurancesSales.filter(s => s.paymentMethod === 'assurance' && String(s.insuranceId) === String(window._activeInsuranceId));

  if (fromDate) {
    filteredSales = filteredSales.filter(s => new Date(s.date) >= new Date(fromDate));
  }
  if (toDate) {
    filteredSales = filteredSales.filter(s => new Date(s.date) <= new Date(toDate + 'T23:59:59'));
  }

  // Stocker dans une variable globale pour les exports
  window._groupedFilteredSales = filteredSales;

  const columns = [
    { label: 'N° Facture', render: r => `<code class="code-tag">#${String(r.id).padStart(6, '0')}</code>` },
    { label: 'Date & Heure', render: r => UI.formatDateTime(new Date(r.date).getTime()) },
    { label: 'Patient / Bénéficiaire', render: r => `<strong>${r.patientName || 'Anonyme'}</strong>` },
    { label: 'Montant Total', render: r => UI.formatCurrency(r.total) },
    { label: 'Part Assurance', render: r => `<strong>${UI.formatCurrency(r.assuranceAmount || r.total)}</strong>` },
    { label: 'Déjà Réglé', render: r => `<span class="text-success">${UI.formatCurrency(r.insurancePaidAmount || 0)}</span>` },
    { 
      label: 'Reste à payer', 
      render: r => {
        const due = Math.max(0, (r.assuranceAmount || r.total) - (r.insurancePaidAmount || 0));
        return due > 0 
          ? `<strong class="text-danger">${UI.formatCurrency(due)}</strong>` 
          : `<span class="text-muted">—</span>`;
      } 
    }
  ];

  UI.table(container, columns, filteredSales, {
    emptyMessage: "Aucune facture trouvée pour la période sélectionnée.",
    emptyIcon: 'calendar'
  });
}

// FORMULAIRE D'AJOUT / MODIFICATION D'ASSURANCE
window.showAddInsuranceModal = function() {
  if (window.Auth && !Auth.can('claims_view') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'ajouter une assurance.', 'error', 4000);
    return;
  }
  UI.modal('<i data-lucide="shield" class="modal-icon-inline"></i> Ajouter un nouvel organisme d\'assurance', `
    <form id="insurance-form" onsubmit="submitInsurance(event)" style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">Nom de l'assurance / Société <span class="text-danger">*</span></label>
          <input type="text" name="name" class="form-control" required placeholder="Ex: ASCOMA, CNSS, Orange S.A.">
        </div>
        <div class="form-group">
          <label class="form-label">Code interne <span class="text-danger">*</span></label>
          <input type="text" name="code" class="form-control" required placeholder="Ex: ASCO, CNSS01">
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">Contact référent</label>
          <input type="text" name="contact" class="form-control" placeholder="Nom du responsable tiers payant">
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone</label>
          <input type="text" name="phone" class="form-control" placeholder="Numéro de contact">
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input type="email" name="email" class="form-control" placeholder="Adresse e-mail">
        </div>
        <div class="form-group">
          <label class="form-label">Adresse physique</label>
          <input type="text" name="address" class="form-control" placeholder="Adresse géographique">
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">Personne de référence</label>
          <input type="text" name="refPerson" class="form-control" placeholder="Code ou ref contrat">
        </div>
        <div class="form-group">
          <label class="form-label">Couverture par défaut (%)</label>
          <input type="number" name="coverage" class="form-control" min="1" max="100" value="80" required>
        </div>
        <div class="form-group">
          <label class="form-label">Mode de règlement <span class="text-danger">*</span></label>
          <select name="paymentMode" class="form-control" required>
            <option value="echelonne">Paiement Échelonné (partiels)</option>
            <option value="integral">Paiement Intégral (en bloc)</option>
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">Conditions spécifiques</label>
          <input type="text" name="conditions" class="form-control" placeholder="Ex: Plafond mensuel 5 000 000 GNF">
        </div>
        <div class="form-group">
          <label class="form-label">Statut <span class="text-danger">*</span></label>
          <select name="status" class="form-control" required>
            <option value="active">Active (Disponible pour patients)</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Observations</label>
        <textarea name="observations" class="form-control" rows="2" placeholder="Notes complémentaires..."></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:12px;">
        <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  `);
  if (window.lucide) lucide.createIcons();
};

window.showEditInsuranceModal = function(id) {
  if (window.Auth && !Auth.can('claims_view') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'éditer une assurance.', 'error', 4000);
    return;
  }
  const ins = window._insurancesData.find(x => x.id === id);
  if (!ins) return;

  UI.modal('<i data-lucide="edit" class="modal-icon-inline"></i> Modifier l\'organisme : ' + ins.name, `
    <form id="insurance-form" onsubmit="submitInsurance(event, ${ins.id})" style="display:flex; flex-direction:column; gap:12px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">Nom de l'assurance / Société <span class="text-danger">*</span></label>
          <input type="text" name="name" class="form-control" required value="${ins.name}">
        </div>
        <div class="form-group">
          <label class="form-label">Code interne <span class="text-danger">*</span></label>
          <input type="text" name="code" class="form-control" required value="${ins.code}">
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">Contact référent</label>
          <input type="text" name="contact" class="form-control" value="${ins.contact || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone</label>
          <input type="text" name="phone" class="form-control" value="${ins.phone || ''}">
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">E-mail</label>
          <input type="email" name="email" class="form-control" value="${ins.email || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Adresse physique</label>
          <input type="text" name="address" class="form-control" value="${ins.address || ''}">
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">Personne de référence</label>
          <input type="text" name="refPerson" class="form-control" value="${ins.refPerson || ins.referent || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Couverture par défaut (%)</label>
          <input type="number" name="coverage" class="form-control" min="1" max="100" value="${ins.coverage || ins.coveragePercent || 80}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Mode de règlement <span class="text-danger">*</span></label>
          <select name="paymentMode" class="form-control" required>
            <option value="echelonne" ${ins.paymentMode === 'echelonne' ? 'selected' : ''}>Paiement Échelonné (partiels)</option>
            <option value="integral" ${ins.paymentMode === 'integral' ? 'selected' : ''}>Paiement Intégral (en bloc)</option>
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">Conditions spécifiques</label>
          <input type="text" name="conditions" class="form-control" value="${ins.conditions || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Statut <span class="text-danger">*</span></label>
          <select name="status" class="form-control" required>
            <option value="active" ${ins.status === 'active' ? 'selected' : ''}>Active (Disponible pour patients)</option>
            <option value="inactive" ${ins.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Observations</label>
        <textarea name="observations" class="form-control" rows="2">${ins.observations || ''}</textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:12px;">
        <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
        <button type="submit" class="btn btn-primary">Enregistrer</button>
      </div>
    </form>
  `);
  if (window.lucide) lucide.createIcons();
};

window.submitInsurance = async function(event, id = null) {
  if (window.Auth && !Auth.can('claims_view') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Action non autorisée.', 'error', 4000);
    return;
  }
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  data.coverage = parseInt(data.coverage || 80);

  try {
    if (id) {
      // Modification
      data.id = id;
      await DB.dbPut('insurances', data);
      await DB.writeAudit('INSURANCE_EDIT', 'insurances', id, data);
      UI.toast("Organisme d'assurance mis à jour avec succès", "success");
    } else {
      // Création
      // Vérifier le code unique
      const exists = window._insurancesData.some(ins => ins.code.toLowerCase() === data.code.toLowerCase());
      if (exists) {
        return UI.toast("Un organisme d'assurance existe déjà avec ce code interne.", "error");
      }
      const newId = await DB.dbAdd('insurances', data);
      await DB.writeAudit('INSURANCE_CREATE', 'insurances', newId, data);
      UI.toast("Nouvel organisme d'assurance enregistré avec succès", "success");
    }

    UI.closeModal();

    // Recharger
    const freshInsurances = await DB.dbGetAll('insurances');
    window._insurancesData = freshInsurances;
    
    // Si modification, re-sélectionner
    if (id) {
      selectInsurance(id);
    } else {
      filterInsurancesList();
    }
  } catch (err) {
    console.error(err);
    UI.toast("Erreur lors de la sauvegarde : " + err.message, "error");
  }
};

// ENREGISTREMENT D'UN RÈGLEMENT D'ASSURANCE
window.showAddPaymentModal = function(insuranceId, maxDue) {
  if (window.Auth && !Auth.can('claims_view') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'encaisser un règlement d\'assurance.', 'error', 4000);
    return;
  }
  UI.modal('<i data-lucide="banknote" class="modal-icon-inline"></i> Enregistrer un paiement d\'assurance', `
    <form id="insurance-pay-form" onsubmit="submitInsurancePayment(event, ${insuranceId})" style="display:flex; flex-direction:column; gap:16px;">
      
      <div style="background:#F8FAFC; border:1px solid #E2E8F0; padding:16px; border-radius:12px; text-align:center;">
        <div style="font-size:11px; font-weight:700; color:#64748B; text-transform:uppercase; letter-spacing:1px;">Encours total dû par cet organisme</div>
        <div style="font-size:28px; font-weight:900; color:#DC2626; margin-top:4px;">${UI.formatCurrency(maxDue)}</div>
      </div>

      <div class="form-group">
        <label class="form-label">Montant à percevoir <span class="text-danger">*</span></label>
        <div class="input-group" style="display:flex; gap:8px;">
          <input type="number" id="pay-amount" name="amount" class="form-control" style="font-size:18px; font-weight:800; color:#16A34A;" 
            required min="1" max="${maxDue}" value="${maxDue}" step="1">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.setPayAmount(${maxDue})">Percevoir Tout</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="form-group">
          <label class="form-label">Mode de paiement <span class="text-danger">*</span></label>
          <select name="paymentMethod" class="form-control" required>
            <option value="transfer">Virement Bancaire</option>
            <option value="cheque">Chèque</option>
            <option value="orange_money">Orange Money</option>
            <option value="mtn_momo">MTN MoMo</option>
            <option value="cash">Espèces</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Référence / Chèque / Bordereau</label>
          <input type="text" name="reference" class="form-control" placeholder="Ex: Chèque n°984728..." required>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Observations</label>
        <textarea name="observations" class="form-control" rows="2" placeholder="Ex: Virement reçu sur le compte bancaire de la pharmacie..."></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:10px;">
        <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
        <button type="submit" class="btn btn-success"><i data-lucide="check-circle"></i> Valider l'encaissement</button>
      </div>
    </form>
  `);
  if (window.lucide) lucide.createIcons();
};

window.submitInsurancePayment = async function(event, insuranceId) {
  if (window.Auth && !Auth.can('claims_view') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Action non autorisée.', 'error', 4000);
    return;
  }
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  const amount = parseFloat(data.amount);
  
  if (isNaN(amount) || amount <= 0) {
    return UI.toast("Le montant saisi est invalide.", "error");
  }

  const ok = await UI.confirm(`Confirmez-vous la perception de ${UI.formatCurrency(amount)} de la part de cet organisme ?`);
  if (!ok) return;

  UI.showLoader("Enregistrement du règlement...", 30000);

  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Enregistrer l'objet paiement d'assurance dans IndexedDB
    const paymentRecord = {
      insuranceId: insuranceId,
      amount: amount,
      paymentMethod: data.paymentMethod,
      reference: data.reference,
      observations: data.observations,
      userId: DB.AppState.currentUser?.id,
      date: todayStr,
      timestamp: Date.now()
    };
    const paymentId = await DB.dbAdd('insurancePayments', paymentRecord);

    // 2. Imputer le paiement sur les créances (ventes en tiers payant) par FIFO
    // On ne considère que les ventes avec un solde dû > 0 (non entièrement réglées)
    const activeSales = window._insurancesSales
      .filter(s => {
        if (s.paymentMethod !== 'assurance' || String(s.insuranceId) !== String(insuranceId)) return false;
        // Calculer la part assurance de cette vente
        const saleAmt = s.assuranceAmount != null ? s.assuranceAmount : s.total;
        const salePaid = s.insurancePaidAmount || 0;
        return Math.max(0, saleAmt - salePaid) > 0; // uniquement celles avec solde > 0
      })
      .sort((a,b) => new Date(a.date) - new Date(b.date)); // Du plus ancien au plus récent

    let amountRemaining = amount;

    for (const sale of activeSales) {
      if (amountRemaining <= 0) break;

      // Utiliser assuranceAmount en priorité (part exacte prise en charge par l'assurance)
      // Si absent, utiliser total (100% prise en charge)
      const saleAssuranceAmt = sale.assuranceAmount != null ? sale.assuranceAmount : sale.total;
      const alreadyPaid = sale.insurancePaidAmount || 0;
      const saleDue = Math.max(0, saleAssuranceAmt - alreadyPaid);
      if (saleDue <= 0) continue;

      const paymentToApply = Math.min(amountRemaining, saleDue);
      sale.insurancePaidAmount = Math.round((alreadyPaid + paymentToApply) * 100) / 100;
      
      // Ne marquer comme 'paid' que si le solde restant est nul (avec tolérance 1 FCFA)
      const newDue = Math.max(0, saleAssuranceAmt - sale.insurancePaidAmount);
      if (newDue <= 1) {
        // Entièrement soldé
        sale.status = 'paid';
        sale.paidAt = Date.now();
        sale.paidDate = todayStr;
        sale.paidMethod = data.paymentMethod;
        sale.insurancePaidAmount = saleAssuranceAmt; // corriger les écarts d'arrondi
      } else {
        // Partiellement soldé — NE PAS marquer paid
        sale.status = 'partial';
      }
      
      await DB.dbPut('sales', sale);
      amountRemaining -= paymentToApply;
    }

    // 3. Enregistrer un versement global en caisse
    const ins = window._insurancesData.find(x => String(x.id) === String(insuranceId));
    await DB.dbAdd('cashRegister', {
      type: 'debt_in',
      amount: amount,
      paymentMethod: data.paymentMethod,
      reason: `Règlement assurance : ${ins ? ins.name : 'Inconnu'} (Réf: ${data.reference || '—'})`,
      reference: data.reference || '',
      date: todayStr,
      timestamp: Date.now(),
      userId: DB.AppState.currentUser?.id
    });

    // 4. Log d'audit
    await DB.writeAudit('INSURANCE_PAYMENT_REC', 'insurances', insuranceId, {
      paymentId: paymentId,
      amount: amount,
      paymentMethod: data.paymentMethod,
      reference: data.reference
    });

    UI.toast(`Règlement de ${UI.formatCurrency(amount)} enregistré avec succès !`, "success");
    UI.closeModal();

    // Recharger les données fraîches
    const [freshSales, freshPayments] = await Promise.all([
      DB.dbGetAll('sales'),
      DB.dbGetAll('insurancePayments')
    ]);
    window._insurancesSales = freshSales;
    
    // Déclencher la synchro en tâche de fond si dispo
    if (typeof DB.syncToSupabase === 'function') {
      DB.syncToSupabase().catch(console.error);
    }

    // Rafraîchir les détails
    selectInsurance(insuranceId);

  } catch (err) {
    console.error(err);
    UI.toast("Erreur lors de l'enregistrement du règlement : " + err.message, "error");
  } finally {
    UI.hideLoader();
  }
};

// IMPORTS/EXPORTS DE FACTURATION GROUPÉE
window.exportGroupedPDF = async function() {
  if (window.Auth && !Auth.can('claims_export') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'exporter.', 'error', 4000);
    return;
  }
  const ins = window._insurancesData.find(x => x.id === window._activeInsuranceId);
  if (!ins) return;

  const sales = window._groupedFilteredSales || [];
  if (sales.length === 0) {
    return UI.toast("Aucune facture à exporter pour la période sélectionnée", "warning");
  }

  UI.showLoader("Génération du relevé PDF...", 30000);

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');
    
    const settings = await DB.dbGetAll('settings') || [];
    const getSetting = (k) => { const s = settings.find(x => x.key === k); return s ? s.value : ''; };
    const pharmacyName = getSetting('pharmacy_name') || 'OrdiveX Pharmacie';
    const pharmacyAddress = getSetting('pharmacy_address') || '';
    const pharmacyPhone = getSetting('pharmacy_phone') || '';
    const logoDataUrl = getSetting('pharmacy_logo');

    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    const today = new Date();
    
    // Dessiner en-tête
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(27, 79, 114);
    let startY = 15;
    let textStartX = 14;
    
    if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
      try {
        doc.addImage(logoDataUrl, 'PNG', 14, 10, 16, 16);
        textStartX = 34;
      } catch(e) {}
    }
    
    doc.text(pharmacyName, textStartX, startY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    if (pharmacyAddress) {
      startY += 4;
      doc.text(pharmacyAddress, textStartX, startY);
    }
    if (pharmacyPhone) {
      startY += 4;
      doc.text("Tél : " + pharmacyPhone, textStartX, startY);
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 28, pageWidth - 14, 28);

    // Titre
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("RELEVÉ DE COMPTE DE TIERS PAYANT", pageWidth / 2, 36, { align: 'center' });
    
    // Infos assurance
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("Organisme : " + ins.name, 14, 46);
    doc.setFont('helvetica', 'normal');
    doc.text("Code interne : " + ins.code, 14, 51);
    doc.text("Mode de paiement : " + (ins.paymentMode === 'integral' ? 'Intégral' : 'Échelonné'), 14, 56);
    
    const fromDate = document.getElementById('group-date-from')?.value;
    const toDate = document.getElementById('group-date-to')?.value;
    if (fromDate && toDate) {
      doc.text(`Période : du ${new Date(fromDate).toLocaleDateString('fr-FR')} au ${new Date(toDate).toLocaleDateString('fr-FR')}`, 14, 61);
    }
    doc.text("Généré le : " + today.toLocaleDateString('fr-FR') + " à " + today.toLocaleTimeString('fr-FR'), pageWidth - 80, 46);

    // Résumé financier de la période
    let periodTotalBilled = 0;
    let periodTotalPaid = 0;
    sales.forEach(s => {
      periodTotalBilled += s.assuranceAmount || s.total || 0;
      periodTotalPaid += s.insurancePaidAmount || 0;
    });
    const periodDue = Math.max(0, periodTotalBilled - periodTotalPaid);

    doc.setFillColor(245, 247, 250);
    doc.rect(14, 66, pageWidth - 28, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text("TOTAL FACTURÉ TIERS PAYANT", 18, 72);
    doc.text("TOTAL REMBOURSÉ SUR PÉRIODE", pageWidth / 2, 72, { align: 'center' });
    doc.text("RESTE À PERCEVOIR", pageWidth - 18, 72, { align: 'right' });

    doc.setFontSize(11);
    doc.setTextColor(27, 79, 114);
    doc.text(UI.formatCurrency(periodTotalBilled), 18, 80);
    doc.setTextColor(22, 163, 74);
    doc.text(UI.formatCurrency(periodTotalPaid), pageWidth / 2, 80, { align: 'center' });
    doc.setTextColor(220, 38, 38);
    doc.text(UI.formatCurrency(periodDue), pageWidth - 18, 80, { align: 'right' });

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text("DÉTAIL DES FACTURES CONCERNÉES :", 14, 94);

    // Tableau de factures
    const tableHeaders = [["N° Facture", "Date", "Patient / Assuré", "Total Facture", "Part Tiers", "Déjà Payé", "Solde Dû"]];
    const tableData = sales.map(s => {
      const due = Math.max(0, (s.assuranceAmount || s.total) - (s.insurancePaidAmount || 0));
      return [
        '#' + String(s.id).padStart(6, '0'),
        new Date(s.date).toLocaleDateString('fr-FR'),
        s.patientName || 'Anonyme',
        UI.formatCurrency(s.total),
        UI.formatCurrency(s.assuranceAmount || s.total),
        UI.formatCurrency(s.insurancePaidAmount || 0),
        UI.formatCurrency(due)
      ];
    });

    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) {
      doc.autoTable({
        startY: 97,
        head: tableHeaders,
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [27, 79, 114], fontSize: 8, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5 },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' }
        }
      });
    }

    doc.save(`Releve_Assurance_${ins.name.replace(/[^a-zA-Z0-9]/g, '_')}_${today.toISOString().split('T')[0]}.pdf`);
    UI.toast("Relevé PDF généré et téléchargé", "success");

  } catch (err) {
    console.error(err);
    UI.toast("Erreur lors de la génération PDF : " + err.message, "error");
  } finally {
    UI.hideLoader();
  }
};

window.exportGroupedCSV = function() {
  if (window.Auth && !Auth.can('claims_export') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'exporter.', 'error', 4000);
    return;
  }
  const ins = window._insurancesData.find(x => String(x.id) === String(window._activeInsuranceId));
  if (!ins) return;

  const sales = window._groupedFilteredSales || [];
  if (sales.length === 0) return UI.toast("Aucune donnée à exporter", "warning");

  // ─── Récupérer les paiements associés ───
  const allPayments = window._insurancesPaymentsCache || [];
  const insPayments = allPayments.filter(p => String(p.insuranceId) === String(ins.id))
    .sort((a,b) => a.timestamp - b.timestamp);

  let csvContent = "\ufeff"; // BOM UTF-8

  // Section 1 : Détail des factures avec état avant/après règlement
  csvContent += `RELEVÉ DES CRÉANCES — ${ins.name} (Code: ${ins.code})\n`;
  csvContent += `Organisme;${ins.name}\n`;
  csvContent += `Code Interne;${ins.code}\n`;
  csvContent += `Mode Règlement;${ins.paymentMode === 'integral' ? 'Paiement Intégral' : 'Paiement Échelonné'}\n`;
  csvContent += `Date d'export;${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}\n`;
  csvContent += `\n`;

  csvContent += `=== DÉTAIL DES FACTURES ===\n`;
  csvContent += `N° Facture;Date;Patient / Assuré;Montant Total Vente;Part Assurance Initiale;Montant Réglé;Reste à Percevoir;Statut\n`;

  let totalFacture = 0, totalPartAss = 0, totalRegle = 0, totalReste = 0;
  sales.forEach(s => {
    const partAss = s.assuranceAmount != null ? s.assuranceAmount : s.total;
    const regle = s.insurancePaidAmount || 0;
    const reste = Math.max(0, partAss - regle);
    const statut = reste <= 0 ? 'SOLDÉ' : (regle > 0 ? 'PARTIEL' : 'IMPAYÉ');
    totalFacture += s.total || 0;
    totalPartAss += partAss;
    totalRegle += regle;
    totalReste += reste;
    csvContent += [
      '#' + String(s.id).padStart(6, '0'),
      s.date ? new Date(s.date).toLocaleDateString('fr-FR') : '—',
      `"${(s.patientName || 'Anonyme').replace(/"/g, "'")}"`  ,
      s.total,
      partAss,
      regle,
      reste,
      statut
    ].join(';') + "\n";
  });

  csvContent += `TOTAUX;;;${totalFacture};${totalPartAss};${totalRegle};${totalReste};\n`;
  csvContent += `\n`;

  // Section 2 : Historique des règlements reçus
  csvContent += `=== HISTORIQUE DES RÈGLEMENTS REÇUS ===\n`;
  csvContent += `Date Règlement;Montant Perçu;Mode Paiement;Référence / Chèque;Observations\n`;
  insPayments.forEach(p => {
    csvContent += [
      p.timestamp ? new Date(p.timestamp).toLocaleDateString('fr-FR') : (p.date || '—'),
      p.amount,
      p.paymentMethod || '—',
      `"${(p.reference || '').replace(/"/g, "'")}"`,
      `"${(p.observations || '').replace(/"/g, "'")}"`
    ].join(';') + "\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const fromDate = document.getElementById('group-date-from')?.value || '';
  const toDate = document.getElementById('group-date-to')?.value || '';
  const suffix = fromDate && toDate ? `_${fromDate}_${toDate}` : `_${new Date().toISOString().split('T')[0]}`;
  link.setAttribute("download", `Releve_Assurance_${ins.name.replace(/[^a-zA-Z0-9]/g, '_')}${suffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  UI.toast("Fichier CSV détaillé téléchargé", "success");
};

// Enregistrer la page dans le routeur principal
if (typeof Router !== 'undefined') {
  Router.register('insurances', renderInsurances);
}
