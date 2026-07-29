/**
 * OrdiveX — Module Patients
 * Dossiers patients, historique médicaments, allergies
 */

async function renderPatients(container) {
  if (window.Auth && !Auth.can('patients_view') && DB.AppState.currentUser?.role !== 'admin') {
    container.innerHTML = `
      <div style="padding:40px; text-align:center; color:var(--text-muted)">
        <i data-lucide="lock" style="width:48px; height:48px; margin:0 auto 16px; opacity:0.3; display:block"></i>
        <h3>Accès refusé</h3>
        <p>Vous n'avez pas la permission de consulter la liste des patients.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ root: container });
    return;
  }

  UI.loading(container, 'Chargement des dossiers patients...');
  const [patients, prescriptions, sales, insurances] = await Promise.all([
    DB.dbGetAll('patients'),
    DB.dbGetAll('prescriptions'),
    DB.dbGetAll('sales'),
    DB.dbGetAll('insurances'),
  ]);
  window._allInsurances = insurances || [];

  const sorted = patients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const canCreate = Auth.can('patients_create') || DB.AppState.currentUser?.role === 'admin';
  const canExport = Auth.can('patients_export') || DB.AppState.currentUser?.role === 'admin';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dossiers Patients</h1>
        <p class="page-subtitle">${patients.length} patients enregistrés — Données confidentielles</p>
      </div>
      <div class="header-actions">
        ${canExport ? `
          <button class="btn btn-secondary" onclick="showImportPatientsModal()"><i data-lucide="upload"></i> Importer</button>
          <button class="btn btn-secondary" onclick="exportPatientsPDF()"><i data-lucide="printer"></i> PDF</button>
          <button class="btn btn-secondary" onclick="exportPatients()"><i data-lucide="download"></i> Exporter CSV</button>
        ` : ''}
        ${canCreate ? `
          <button class="btn btn-primary" onclick="showAddPatient()"><i data-lucide="plus"></i> Nouveau Patient</button>
        ` : ''}
      </div>
    </div>

    <div class="privacy-banner">
      <i data-lucide="lock"></i> <strong>Données de santé protégées</strong> — Réservé au personnel soignant habilité. Archivage conforme DNPM.
    </div>

    <div class="filter-bar">
      <input type="text" id="patient-search" placeholder="Rechercher patient (nom, téléphone)..." class="filter-input" oninput="filterPatients()">
    </div>

    <div id="patients-table-container"></div>
  `;

  window._patientsData = sorted;
  window._patientsPrescriptions = prescriptions;
  filterPatients();
  if (window.lucide) lucide.createIcons();
}

function filterPatients() {
  const search = (document.getElementById('patient-search')?.value || '').toLowerCase();
  let data = window._patientsData || [];
  if (search) data = data.filter(p =>
    (p.name || '').toLowerCase().includes(search) ||
    (p.phone || '').toLowerCase().includes(search)
  );

  const container = document.getElementById('patients-table-container');
  if (!container) return;

  // Pagination
  const PAGE_SIZE = 100;
  window._filteredPatients = data;
  window._patientsPage = window._patientsPage || 1;
  if (data !== window._lastFilteredPatients) {
    window._patientsPage = 1;
    window._lastFilteredPatients = data;
  }
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  if (window._patientsPage > totalPages) window._patientsPage = totalPages;
  const start = (window._patientsPage - 1) * PAGE_SIZE;
  const pageData = data.slice(start, start + PAGE_SIZE);

  const rxMap = {};
  (window._patientsPrescriptions || []).forEach(rx => {
    if (!rxMap[rx.patientId]) rxMap[rx.patientId] = 0;
    rxMap[rx.patientId]++;
  });

  UI.table(container, [
    {
      label: 'Patient', render: r => `
      <div class="patient-name-cell">
        <div class="patient-avatar-sm">${r.name?.charAt(0).toUpperCase() || '?'}</div>
        <div><strong>${r.name}</strong><br><span class="text-muted text-sm">${r.phone || '—'}</span></div>
      </div>` },
    { label: 'Date de naissance', render: r => r.dob ? `${UI.formatDate(r.dob)} <span class="text-muted text-sm">(${calcAge(r.dob)} ans)</span>` : '—' },
    { label: 'Allergies', render: r => r.allergies ? `<span class="badge badge-danger"><i data-lucide="alert-triangle"></i> ${r.allergies}</span>` : '<span class="text-muted">Aucune connue</span>' },
    { label: 'Ordonnances', render: r => `<span class="badge badge-info">${rxMap[r.id] || 0}</span>` },
    { label: 'Adresse', render: r => r.address || '—' },
    {
      label: 'Actions', render: r => {
        const canEdit = Auth.can('patients_edit') || DB.AppState.currentUser?.role === 'admin';
        return `
        <div class="actions-cell">
          <button class="btn btn-xs btn-primary" onclick="viewPatient(${r.id})"><i data-lucide="folder"></i> Dossier</button>
          ${canEdit ? `<button class="btn btn-xs btn-secondary" onclick="editPatient(${r.id})"><i data-lucide="edit-3"></i></button>` : ''}
        </div>`;
      }
    },
  ], pageData, { emptyMessage: 'Aucun patient trouvé', emptyIcon: 'user' });

  // Pagination controls
  const pagDiv = document.createElement('div');
  pagDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:16px 0;gap:12px;flex-wrap:wrap;';
  pagDiv.innerHTML = `
    <span style="font-size:13px;color:var(--text-muted)">${data.length.toLocaleString()} patients — Page ${window._patientsPage}/${totalPages}</span>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-secondary btn-sm" ${window._patientsPage <= 1 ? 'disabled' : ''} onclick="window._patientsPage--;filterPatients()">◀ Précédent</button>
      <button class="btn btn-secondary btn-sm" ${window._patientsPage >= totalPages ? 'disabled' : ''} onclick="window._patientsPage++;filterPatients()">Suivant ▶</button>
    </div>
  `;
  container.appendChild(pagDiv);
  if (window.lucide) lucide.createIcons();
}

function calcAge(dob) {
  if (!dob) return '—';
  const birth = new Date(dob);
  const today = new Date();
  return today.getFullYear() - birth.getFullYear() - (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate()) ? 1 : 0);
}

async function viewPatient(patientId) {
  const [patient, prescriptions, allSales] = await Promise.all([
    DB.dbGet('patients', patientId),
    DB.dbGetAll('prescriptions'),
    DB.dbGetAll('sales'),
  ]);
  if (!patient) return;

  // Filtrer les ventes de ce patient
  const patientSales = allSales.filter(s => s.patientId === patientId || s.patientName === patient.name);
  const patientRx = prescriptions.filter(r => r.patientId === patientId);
  const sortedRx = patientRx.sort((a, b) => new Date(b.date) - new Date(a.date));

  // KPIs financiers
  const totalSpent = patientSales.reduce((sum, s) => sum + (s.total || 0), 0);
  const avgBasket = patientSales.length > 0 ? Math.round(totalSpent / patientSales.length) : 0;
  const lastVisitDate = patientSales.length > 0 ? patientSales.sort((a,b) => new Date(b.date) - new Date(a.date))[0].date : null;
  const creditSales = patientSales.filter(s => s.paymentMethod === 'credit' && s.creditStatus !== 'paid');
  const totalCredit = creditSales.reduce((sum, s) => sum + (s.total || 0), 0);

  // Drug history from prescriptions
  const drugHistory = {};
  patientRx.forEach(rx => {
    (rx.items || []).forEach(item => {
      if (!drugHistory[item.productName]) drugHistory[item.productName] = { count: 0, lastDate: null };
      drugHistory[item.productName].count++;
      if (!drugHistory[item.productName].lastDate || rx.date > drugHistory[item.productName].lastDate) {
        drugHistory[item.productName].lastDate = rx.date;
      }
    });
  });
  const topDrugs = Object.entries(drugHistory).sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  // Charger les saleItems pour tous les crédits afin d'afficher les médicaments
  const allSaleItems = await DB.dbGetAll('saleItems');
  const saleItemsMap = {};
  allSaleItems.forEach(si => {
    if (!saleItemsMap[si.saleId]) saleItemsMap[si.saleId] = [];
    saleItemsMap[si.saleId].push(si);
  });

  // Attacher les items à chaque vente
  const creditSalesWithItems = creditSales.map(s => ({
    ...s,
    items: saleItemsMap[s.id] || []
  }));
  const patientSalesWithItems = patientSales.map(s => ({
    ...s,
    items: saleItemsMap[s.id] || []
  }));

  // Stocker dans des variables globales pour la pagination client
  window._curPatientId = patientId;
  window._curPatientSales = patientSalesWithItems.sort((a,b) => new Date(b.date) - new Date(a.date));
  window._curPatientCredits = creditSalesWithItems.sort((a,b) => new Date(b.date) - new Date(a.date));
  window._curPatientRx = sortedRx;

  UI.modal(`<i data-lucide="folder" class="modal-icon-inline"></i> Dossier — ${patient.name}`, `
    <div class="patient-detail" style="max-width:1050px; width:100%; margin:0 auto;">
      <div class="patient-detail-header" style="flex-wrap:wrap; gap:16px;">
        <div class="patient-avatar-lg">${patient.name?.charAt(0).toUpperCase() || '?'}</div>
        <div class="patient-detail-info" style="flex:1; min-width:250px;">
          <h2>${patient.name}</h2>
          <div class="patient-detail-meta" style="flex-wrap:wrap; gap:12px;">
            ${patient.dob ? `<span><i data-lucide="calendar"></i> ${UI.formatDate(patient.dob)} (${calcAge(patient.dob)} ans)</span>` : ''}
            ${patient.phone ? `<span style="display:inline-flex;align-items:center;gap:6px"><i data-lucide="phone"></i> ${patient.phone} <button class="btn btn-xs btn-primary" onclick="openSmsModal(${patient.id})" title="Envoyer un SMS"><i data-lucide="message-square" style="width:12px;height:12px"></i></button></span>` : ''}
            ${patient.address ? `<span><i data-lucide="map-pin"></i> ${patient.address}</span>` : ''}
          </div>
          ${patient.allergies ? `<div class="allergy-alert"><i data-lucide="alert-triangle"></i> Allergie : <strong>${patient.allergies}</strong></div>` : ''}
          <div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;">
            <span class="badge badge-${patient.status === 'ayant_droit' ? 'warning' : 'primary'}"><i data-lucide="users" style="width:12px;height:12px;margin-right:4px;"></i> ${patient.status === 'ayant_droit' ? 'Ayant Droit' : 'Souscripteur Principal'}</span>
            ${patient.creditLimit > 0 ? `<span class="badge badge-success"><i data-lucide="file-clock" style="width:12px;height:12px;margin-right:4px;"></i> Crédit autorisé: ${UI.formatCurrency(patient.creditLimit)}</span>` : `<span class="badge badge-danger"><i data-lucide="lock" style="width:12px;height:12px;margin-right:4px;"></i> Crédit bloqué</span>`}
          </div>
          ${patient.assurances && patient.assurances.length > 0 ? `
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
              ${patient.assurances.map(a => `<span class="badge badge-info"><i data-lucide="shield" style="width:12px;height:12px;margin-right:4px;"></i> <b>${a.name}</b> ${a.enterprise ? `[${a.enterprise}]` : ''} (${a.coverage}%) ${a.ref ? `- Police: ${a.ref}` : ''}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- KPIs 360° -->
      <div class="patient-stats-row" style="grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:12px; margin-top:20px;">
        <div class="patient-stat-card">
          <div class="patient-stat-val kpi-value">${UI.formatCurrency(totalSpent)}</div>
          <div class="patient-stat-label">Total dépensé</div>
        </div>
        <div class="patient-stat-card">
          <div class="patient-stat-val kpi-value">${patientSales.length}</div>
          <div class="patient-stat-label">Visites</div>
        </div>
        <div class="patient-stat-card">
          <div class="patient-stat-val kpi-value">${UI.formatCurrency(avgBasket)}</div>
          <div class="patient-stat-label">Panier moyen</div>
        </div>
        <div class="patient-stat-card">
          <div class="patient-stat-val">${lastVisitDate ? UI.formatDate(lastVisitDate) : '—'}</div>
          <div class="patient-stat-label">Dernière visite</div>
        </div>
        <div class="patient-stat-card" id="kpi-credit-card" style="border-color:${totalCredit > 0 ? 'var(--danger)' : 'var(--border)'}; cursor:pointer;" onclick="document.querySelectorAll('.p360-panel').forEach(e=>e.style.display='none');document.getElementById('p360-credits').style.display='';document.querySelectorAll('.patient360-tab').forEach(e=>e.classList.remove('active')); const btn = Array.from(document.querySelectorAll('.patient360-tab')).find(b => b.textContent.includes('Crédits')); if(btn) btn.classList.add('active');">
          <div class="patient-stat-val kpi-value" style="color:${totalCredit > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${UI.formatCurrency(totalCredit)}</div>
          <div class="patient-stat-label">Crédit en cours</div>
        </div>
        <div class="patient-stat-card">
          <div class="patient-stat-val">${patientRx.length}</div>
          <div class="patient-stat-label">Ordonnances</div>
        </div>
      </div>

      <!-- Onglets -->
      <div style="margin-top:20px;">
        <div class="patient360-tabs" style="display:flex;gap:4px;border-bottom:2px solid var(--border);margin-bottom:12px;overflow-x:auto;white-space:nowrap;">
          <button class="patient360-tab active" onclick="document.querySelectorAll('.p360-panel').forEach(e=>e.style.display='none');document.getElementById('p360-summary').style.display='';document.querySelectorAll('.patient360-tab').forEach(e=>e.classList.remove('active'));this.classList.add('active')">Résumé</button>
          <button class="patient360-tab" onclick="document.querySelectorAll('.p360-panel').forEach(e=>e.style.display='none');document.getElementById('p360-purchases').style.display='';document.querySelectorAll('.patient360-tab').forEach(e=>e.classList.remove('active'));this.classList.add('active')">Achats (${patientSales.length})</button>
          <button class="patient360-tab" id="tab-credits-header" onclick="document.querySelectorAll('.p360-panel').forEach(e=>e.style.display='none');document.getElementById('p360-credits').style.display='';document.querySelectorAll('.patient360-tab').forEach(e=>e.classList.remove('active'));this.classList.add('active')" style="color:${totalCredit > 0 ? 'var(--danger)' : 'inherit'}">Crédits (${creditSales.length})</button>
          <button class="patient360-tab" onclick="document.querySelectorAll('.p360-panel').forEach(e=>e.style.display='none');document.getElementById('p360-rx').style.display='';document.querySelectorAll('.patient360-tab').forEach(e=>e.classList.remove('active'));this.classList.add('active')">Ordonnances (${patientRx.length})</button>
        </div>

        <!-- Panel Résumé -->
        <div id="p360-summary" class="p360-panel">
          ${topDrugs.length > 0 ? `
            <div class="patient-drugs-section">
              <h4><i data-lucide="pill"></i> Médicaments fréquents</h4>
              <div class="drugs-grid">
                ${topDrugs.map(([name, data]) => `
                  <div class="drug-chip">
                    <span class="drug-name">${name}</span>
                    <span class="drug-count">${data.count}x</span>
                  </div>`).join('')}
              </div>
            </div>` : '<p class="text-muted">Aucun médicament récurrent enregistré</p>'}
          ${patient.medicalHistory ? `<div style="margin-top:12px;padding:10px;background:var(--surface-2);border-radius:8px;"><strong style="font-size:12px;color:var(--text-muted)">Antécédents médicaux</strong><p style="margin:4px 0 0;font-size:13px;">${patient.medicalHistory}</p></div>` : ''}
          ${patient.note ? `<div class="patient-note"><h4><i data-lucide="file-edit"></i> Notes</h4><p>${patient.note}</p></div>` : ''}
        </div>

        <!-- Panel Achats -->
        <div id="p360-purchases" class="p360-panel" style="display:none;">
          <div id="p360-purchases-table-container"></div>
        </div>

        <!-- Panel Crédits -->
        <div id="p360-credits" class="p360-panel" style="display:none;">
          <div id="p360-credits-table-container"></div>
        </div>

        <!-- Panel Ordonnances -->
        <div id="p360-rx" class="p360-panel" style="display:none;">
          <div id="p360-rx-table-container"></div>
        </div>
      </div>

      <div class="patient-legal-footer" style="margin-top:24px;">
        <span class="text-muted text-sm"><i data-lucide="lock"></i> Données confidentielles — Accès tracé — Conservation conforme DNPM</span>
      </div>
    </div>

    <!-- Styles CSS Responsive et Mobile-First spécifiques à la fiche Patient 360 -->
    <style>
      /* Adaptation des tableaux sur mobile : cartes fluides */
      @media (max-width: 768px) {
        .responsive-table-card table, 
        .responsive-table-card thead, 
        .responsive-table-card tbody, 
        .responsive-table-card th, 
        .responsive-table-card td, 
        .responsive-table-card tr { 
          display: block; 
        }
        .responsive-table-card thead tr { 
          position: absolute;
          top: -9999px;
          left: -9999px;
        }
        .responsive-table-card tr { 
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-card);
          margin-bottom: 12px;
          padding: 12px;
          box-shadow: var(--shadow-sm);
        }
        .responsive-table-card td { 
          border: none;
          border-bottom: 1px solid var(--border-light); 
          position: relative;
          padding-left: 50% !important; 
          text-align: right;
          font-size: 13px;
          min-height: 36px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .responsive-table-card td:last-child {
          border-bottom: none;
        }
        .responsive-table-card td:before { 
          position: absolute;
          left: 12px;
          width: 45%; 
          padding-right: 10px; 
          white-space: nowrap;
          text-align: left;
          font-weight: 700;
          color: var(--text-muted);
          content: attr(data-label);
        }
        .responsive-table-card td .action-btn-group {
          justify-content: flex-end;
          width: 100%;
        }
      }
    </style>
  `, { size: 'large' });

  // Initialiser les tables paginées
  window._renderPatientPurchases(1);
  window._renderPatientCredits(1);
  window._renderPatientRx(1);

  if (window.lucide) lucide.createIcons();
  if (window._autoAnimateKPIValues) setTimeout(_autoAnimateKPIValues, 100);
  // Log access to patient data
  await DB.writeAudit('VIEW_PATIENT', 'patients', patientId, { patientName: patient.name });
}

// ──────────────────────────────────────────────────────────
// FONCTIONS DE RENDU PAGINÉ ET RESPONSIVE DU DOSSIER PATIENT
// ──────────────────────────────────────────────────────────

window._renderPatientPurchases = function(page) {
  const container = document.getElementById('p360-purchases-table-container');
  if (!container) return;

  const sales = window._curPatientSales || [];
  if (sales.length === 0) {
    container.innerHTML = '<p class="text-muted">Aucun achat enregistré</p>';
    return;
  }

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(sales.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const pageData = sales.slice(start, start + PAGE_SIZE);

  let html = `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <span>${sales.length} achat(s) — Page ${page}/${totalPages}</span>
    </div>
    <div class="responsive-table-card" style="max-height:380px;overflow-y:auto;border-radius:8px;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Montant</th>
            <th>Paiement</th>
            <th>Médicaments</th>
            <th>Vendeur</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.map(s => {
            const drugsText = (s.items || []).map(i => `${i.quantity}x ${i.productName || i.name}`).join(', ');
            return `
              <tr>
                <td data-label="Date">${UI.formatDate(s.date)}</td>
                <td data-label="Montant"><strong>${UI.formatCurrency(s.total || 0)}</strong></td>
                <td data-label="Paiement"><span class="badge badge-${s.paymentMethod === 'credit' ? 'danger' : s.paymentMethod === 'cash' ? 'success' : 'info'}">${s.paymentMethod || 'Espèces'}</span></td>
                <td data-label="Médicaments" style="max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${drugsText}">${drugsText || '—'}</td>
                <td data-label="Vendeur" class="text-muted text-sm">${s.sellerName || '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Pagination controls
  if (totalPages > 1) {
    html += `
      <div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px;">
        <button class="btn btn-secondary btn-xs" ${page <= 1 ? 'disabled' : ''} onclick="window._renderPatientPurchases(${page - 1})">◀ Précédent</button>
        <span style="font-size:12px;color:var(--text-muted)">${page} / ${totalPages}</span>
        <button class="btn btn-secondary btn-xs" ${page >= totalPages ? 'disabled' : ''} onclick="window._renderPatientPurchases(${page + 1})">Suivant ▶</button>
      </div>
    `;
  }

  container.innerHTML = html;
};

window._renderPatientCredits = function(page) {
  const container = document.getElementById('p360-credits-table-container');
  if (!container) return;

  const credits = window._curPatientCredits || [];
  const totalCredit = credits.reduce((sum, s) => sum + (s.total || 0), 0);

  if (credits.length === 0) {
    container.innerHTML = '<p class="text-muted">Aucun crédit en cours</p>';
    // Mettre à jour l'état du KPI et de l'onglet
    const tabHeader = document.getElementById('tab-credits-header');
    if (tabHeader) {
      tabHeader.style.color = 'inherit';
      tabHeader.textContent = `Crédits (0)`;
    }
    const kpiCard = document.getElementById('kpi-credit-card');
    if (kpiCard) {
      kpiCard.style.borderColor = 'var(--border)';
      const kpiVal = kpiCard.querySelector('.patient-stat-val');
      if (kpiVal) {
        kpiVal.style.color = 'var(--text-muted)';
        kpiVal.textContent = '0 GNF';
      }
    }
    return;
  }

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(credits.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const pageData = credits.slice(start, start + PAGE_SIZE);

  const canSettle = Auth.can('patients_debt_settle') || DB.AppState.currentUser?.role === 'admin';

  let html = `
    <div style="padding:12px;background:rgba(214,59,59,0.06);border-radius:8px;margin-bottom:12px;border-left:3px solid var(--danger);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div>
        <strong style="color:var(--danger)">Encours total : ${UI.formatCurrency(totalCredit)}</strong>
        <span class="text-muted text-sm"> — ${credits.length} vente(s) à crédit</span>
      </div>
      ${canSettle && credits.length > 1 ? `
        <button class="btn btn-xs btn-danger" onclick="window.settleAllPatientDebts(window._curPatientId)">
          <i data-lucide="check-square"></i> Solder tout l'encours
        </button>
      ` : ''}
    </div>
    <div class="responsive-table-card" style="overflow-y:auto;border-radius:8px;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Montant</th>
            <th>Médicaments détaillés</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.map(s => {
            const drugsList = (s.items || []).map(i => `
              <div style="font-size:11px;background:var(--surface-2);border:1px solid var(--border);padding:2px 6px;border-radius:4px;margin-bottom:2px;display:inline-block;">
                <strong>${i.quantity}x</strong> ${i.productName || i.name || '?'} <span class="text-muted">(${UI.formatCurrency(i.unitPrice || i.price || 0)})</span>
              </div>
            `).join(' ');

            return `
              <tr>
                <td data-label="Date">${UI.formatDate(s.date)}</td>
                <td data-label="Montant"><strong style="color:var(--danger)">${UI.formatCurrency(s.total || 0)}</strong></td>
                <td data-label="Médicaments détaillés" style="max-width:400px;text-align:left;">
                  <div style="display:flex;flex-wrap:wrap;gap:4px;">${drugsList || '—'}</div>
                </td>
                <td data-label="Statut"><span class="badge badge-warning">${s.creditStatus || 'En attente'}</span></td>
                <td data-label="Action">
                  <div class="action-btn-group" style="display:flex;gap:4px;">
                    ${canSettle ? `
                      <button class="btn btn-xs btn-success" onclick="window.settleDebt(${s.id})" style="padding:4px 8px;font-size:11px;">
                        <i data-lucide="check-circle" style="width:12px;height:12px;margin-right:4px;"></i> Régler
                      </button>
                    ` : '—'}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Pagination controls
  if (totalPages > 1) {
    html += `
      <div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px;">
        <button class="btn btn-secondary btn-xs" ${page <= 1 ? 'disabled' : ''} onclick="window._renderPatientCredits(${page - 1})">◀ Précédent</button>
        <span style="font-size:12px;color:var(--text-muted)">${page} / ${totalPages}</span>
        <button class="btn btn-secondary btn-xs" ${page >= totalPages ? 'disabled' : ''} onclick="window._renderPatientCredits(${page + 1})">Suivant ▶</button>
      </div>
    `;
  }

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons({ root: container });
};

window._renderPatientRx = function(page) {
  const container = document.getElementById('p360-rx-table-container');
  if (!container) return;

  const rxList = window._curPatientRx || [];
  if (rxList.length === 0) {
    container.innerHTML = '<p class="text-muted">Aucune ordonnance enregistrée</p>';
    return;
  }

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(rxList.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const pageData = rxList.slice(start, start + PAGE_SIZE);

  let html = `
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <span>Page ${page}/${totalPages}</span>
    </div>
    <div class="responsive-table-card" style="max-height:380px;overflow-y:auto;border-radius:8px;">
      <table class="data-table">
        <thead>
          <tr>
            <th>N° Rx</th>
            <th>Date</th>
            <th>Médecin</th>
            <th>Médicaments</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.map(rx => {
            const rxDrugs = (rx.items || []).map(i => i.productName).join(', ');
            return `
              <tr>
                <td data-label="N° Rx"><code class="code-tag">Rx-${String(rx.id).padStart(5, '0')}</code></td>
                <td data-label="Date">${UI.formatDate(rx.date)}</td>
                <td data-label="Médecin">${rx.doctorName || '—'}</td>
                <td data-label="Médicaments" style="max-width:320px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${rxDrugs}">${rxDrugs}</td>
                <td data-label="Statut"><span class="badge badge-${rx.status === 'dispensed' ? 'success' : 'warning'}">${rx.status}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Pagination controls
  if (totalPages > 1) {
    html += `
      <div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px;">
        <button class="btn btn-secondary btn-xs" ${page <= 1 ? 'disabled' : ''} onclick="window._renderPatientRx(${page - 1})">◀ Précédent</button>
        <span style="font-size:12px;color:var(--text-muted)">${page} / ${totalPages}</span>
        <button class="btn btn-secondary btn-xs" ${page >= totalPages ? 'disabled' : ''} onclick="window._renderPatientRx(${page + 1})">Suivant ▶</button>
      </div>
    `;
  }

  container.innerHTML = html;
};

// ──────────────────────────────────────────────────────────
// FONCTIONS DE RÈGLEMENT DE TOUTES LES DETTES D'UN PATIENT
// ──────────────────────────────────────────────────────────

window.settleAllPatientDebts = async function(patientId) {
  if (window.Auth && !Auth.can('patients_debt_settle') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'encaisser des dettes.', 'error', 4000);
    return;
  }
  const allSales = await DB.dbGetAll('sales');
  const patient = await DB.dbGet('patients', patientId);
  if (!patient) return;
  const creditSales = allSales.filter(s => (s.patientId === patientId || s.patientName === patient.name) && s.paymentMethod === 'credit' && s.creditStatus !== 'paid');

  if (creditSales.length === 0) {
    UI.toast('Aucune dette en cours pour ce patient.', 'info');
    return;
  }

  const totalAmount = creditSales.reduce((sum, s) => sum + (s.total || 0), 0);

  UI.modal('<i data-lucide="receipt" class="modal-icon-inline"></i> Tout solder', `
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- ENCOURS TOTAL -->
      <div style="text-align:center;padding:20px;background:#F8FAFC;border-radius:14px;border:2px solid #E2E8F0">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#64748B;font-weight:700;margin-bottom:6px">
          💵 Encours total à solder
        </div>
        <div style="font-size:38px;font-weight:900;color:#D32F2F;letter-spacing:-1px">${UI.formatCurrency(totalAmount)}</div>
        <div style="font-size:12px;color:#94A3B8;margin-top:6px">
          Patient : <strong style="color:#475569">${patient.name}</strong> · <strong>${creditSales.length} facture(s) à crédit</strong>
        </div>
      </div>

      <!-- MODE DE PAIEMENT -->
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748B;margin-bottom:8px">Mode de règlement</div>
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:8px" id="all-debt-pay-methods">
          <button type="button" class="pay-method-btn active" data-method="cash" onclick="selectDebtPayMethod(this)"
            style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #1E40AF;border-radius:10px;background:#EBF5FB;cursor:pointer;font-family:inherit;text-align:left">
            <span style="font-size:18px">💵</span>
            <div><div style="font-size:12px;font-weight:700;color:#1E40AF">Espèces</div><div style="font-size:9px;color:#6B7280">Liquide</div></div>
          </button>
          <button type="button" class="pay-method-btn" data-method="orange_money" onclick="selectDebtPayMethod(this)"
            style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #E2E8F0;border-radius:10px;background:#FFFFFF;cursor:pointer;font-family:inherit;text-align:left">
            <span style="font-size:18px">📱</span>
            <div><div style="font-size:12px;font-weight:700;color:#0F172A">Orange Money</div><div style="font-size:9px;color:#6B7280">Mobile</div></div>
          </button>
          <button type="button" class="pay-method-btn" data-method="mtn_momo" onclick="selectDebtPayMethod(this)"
            style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #E2E8F0;border-radius:10px;background:#FFFFFF;cursor:pointer;font-family:inherit;text-align:left">
            <span style="font-size:18px">📲</span>
            <div><div style="font-size:12px;font-weight:700;color:#0F172A">MTN MoMo</div><div style="font-size:9px;color:#6B7280">Mobile</div></div>
          </button>
          <button type="button" class="pay-method-btn" data-method="transfer" onclick="selectDebtPayMethod(this)"
            style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #E2E8F0;border-radius:10px;background:#FFFFFF;cursor:pointer;font-family:inherit;text-align:left">
            <span style="font-size:18px">🏦</span>
            <div><div style="font-size:12px;font-weight:700;color:#0F172A">Virement / Chèque</div><div style="font-size:9px;color:#6B7280">Bancaire</div></div>
          </button>
        </div>
      </div>

      <!-- RÉFÉRENCE -->
      <div>
        <label style="font-size:11px;font-weight:600;color:#64748B;display:block;margin-bottom:5px">Référence (optionnel)</label>
        <input type="text" id="all-debt-pay-ref" style="width:100%;padding:10px 14px;border:2px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;background:#FFFFFF" placeholder="N° transaction, reçu...">
      </div>

    </div>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="window.viewPatient(${patientId})">Annuler</button>
      <button class="btn btn-success" style="padding:10px 20px;font-size:13px;font-weight:700" onclick="window.confirmSettleAllDebts(${patientId}, this)"><i data-lucide="check-circle"></i> Solder tout (${UI.formatCurrency(totalAmount)})</button>
    `
  });

  if (window.lucide) lucide.createIcons();
};

window.confirmSettleAllDebts = async function(patientId, btn) {
  if (window.Auth && !Auth.can('patients_debt_settle') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Action non autorisée.', 'error', 4000);
    return;
  }
  const methodBtn = document.querySelector('#all-debt-pay-methods .pay-method-btn.active');
  const paymentMethod = methodBtn ? methodBtn.dataset.method : 'cash';
  const reference = document.getElementById('all-debt-pay-ref')?.value || '';

  const ok = await UI.confirm('Confirmer l\'encaissement et le règlement complet de toutes les dettes de ce patient ?');
  if (!ok) return;

  return ActionGuard.run('settle-all-debts-' + patientId, () => _confirmSettleAllDebtsImpl(patientId, paymentMethod, reference), btn, 'Encaissement...');
};

async function _confirmSettleAllDebtsImpl(patientId, paymentMethod, reference) {
  try {
    const allSales = await DB.dbGetAll('sales');
    const patient = await DB.dbGet('patients', patientId);
    const creditSales = allSales.filter(s => (s.patientId === patientId || s.patientName === patient.name) && s.paymentMethod === 'credit' && s.creditStatus !== 'paid');
    const today = new Date().toISOString().split('T')[0];

    for (const sale of creditSales) {
      // 1. Update status
      sale.status = 'paid';
      sale.creditStatus = 'paid'; // aligné avec le filtre patients.js
      sale.paidAt = Date.now();
      sale.paidDate = today;
      sale.paidMethod = paymentMethod;
      await DB.dbPut('sales', sale);

      // 2. Record in cashRegister
      await DB.dbAdd('cashRegister', {
        type: 'debt_in',
        amount: sale.total,
        paymentMethod: paymentMethod,
        reason: `Règlement global dette — Vente #${String(sale.id).padStart(6, '0')} · Patient: ${patient.name}`,
        reference: reference,
        saleId: sale.id,
        date: today,
        timestamp: Date.now(),
        userId: DB.AppState.currentUser?.id,
      });

      // 3. Audit
      await DB.writeAudit('DEBT_REFUND', 'sales', sale.id, { amount: sale.total, patient: patient.name, paymentMethod });
    }

    UI.toast('Toutes les dettes ont été réglées avec succès !', 'success');
    UI.closeModal();

    // Recharger la fiche
    setTimeout(() => window.viewPatient(patientId), 300);

    // Sync
    if (typeof DB.syncToSupabase === 'function') {
      DB.syncToSupabase().catch(console.error);
    }
  } catch (err) {
    console.error(err);
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function showAddPatient() {
  if (window.Auth && !Auth.can('patients_create') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission de créer un patient.', 'error', 4000);
    return;
  }
  const insurances = await DB.dbGetAll('insurances');
  window._allInsurances = insurances || [];
  UI.modal('<i data-lucide="user-plus" class="modal-icon-inline"></i> Nouveau Patient', `
    <form id="patient-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Nom complet *</label>
          <input type="text" name="name" class="form-control" required placeholder="Prénom Nom">
        </div>
        <div class="form-group">
          <label>Téléphone</label>
          <input type="tel" name="phone" class="form-control" placeholder="+224 6XX XXX XXX">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de naissance</label>
          <input type="date" name="dob" class="form-control">
        </div>
      <div class="form-row">
        <div class="form-group">
          <label>Sexe</label>
          <select name="gender" class="form-control">
            <option value="">Non précisé</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </div>
        <div class="form-group">
          <label>Statut Assuré / Client</label>
          <select name="status" class="form-control">
            <option value="principal">Souscripteur Principal</option>
            <option value="ayant_droit">Ayant droit (Enfant / Conjoint)</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Adresse</label>
          <input type="text" name="address" class="form-control" placeholder="Quartier, commune, ville">
        </div>
        <div class="form-group">
           <label><i data-lucide="file-clock"></i> Plafond de crédit (GNF)</label>
           <input type="number" name="creditLimit" class="form-control" placeholder="0 = Bloqué" value="0">
        </div>
      </div>
      <div class="form-group">
        <label><i data-lucide="alert-triangle"></i> Allergies connues</label>
        <input type="text" name="allergies" class="form-control" placeholder="Ex: Pénicilline, Aspirine, Sulfamides... (laisser vide si aucune)">
      </div>
      <div class="form-group">
        <label>Antécédents médicaux</label>
        <textarea name="medicalHistory" class="form-control" rows="2" placeholder="HTA, Diabète, Asthme..."></textarea>
      </div>
      <div class="form-group">
        <label>Note</label>
        <textarea name="note" class="form-control" rows="2"></textarea>
      </div>
      <div style="grid-column: 1 / -1; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border)">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
          <h4 style="font-size:14px; margin:0;"><i data-lucide="shield"></i> Couvertures d'Assurance</h4>
          <button type="button" class="btn btn-xs btn-primary" onclick="addAssuranceRow('patient-assurances-container')"><i data-lucide="plus"></i> Ajouter</button>
        </div>
        <div id="patient-assurances-container"></div>
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitPatient()"><i data-lucide="check"></i> Enregistrer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

window.updateDefaultCoverage = function(select, idx) {
  const selectedOption = select.options[select.selectedIndex];
  const coverage = selectedOption.dataset.coverage;
  if (coverage) {
    const input = document.getElementById('assurCoverageInput_' + idx);
    if (input) input.value = coverage;
  }
};

window.addAssuranceRow = function(containerId, data = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const idx = Date.now() + Math.floor(Math.random() * 1000);
  const row = document.createElement('div');
  row.className = 'assurance-row';
  row.style.cssText = "display:flex; gap:8px; margin-bottom:8px; align-items:end; background:var(--surface); padding:8px; border-radius:6px; border:1px solid var(--border);";

  const insurancesList = window._allInsurances || [];
  const optionsHtml = insurancesList.map(ins => 
    `<option value="${ins.id}" data-coverage="${ins.coverage}" ${data?.insuranceId === ins.id || data?.name === ins.name ? 'selected' : ''}>${ins.name}</option>`
  ).join('');

  row.innerHTML = `
    <div style="flex:2">
      <label style="font-size:11px;color:var(--text-muted)">Entreprise (Employeur)</label>
      <input type="text" name="assurEnterprise_${idx}" class="form-control form-control-sm" value="${data?.enterprise || ''}" placeholder="Ex: Rio Tinto, Braguinée...">
    </div>
    <div style="flex:2">
      <label style="font-size:11px;color:var(--text-muted)">Assurance / Mutuelle <span class="text-danger">*</span></label>
      <select name="assurInsuranceId_${idx}" class="form-control form-control-sm" required onchange="updateDefaultCoverage(this, '${idx}')">
        <option value="">-- Choisir --</option>
        ${optionsHtml}
      </select>
    </div>
    <div style="flex:1">
      <label style="font-size:11px;color:var(--text-muted)">Couverture (%)</label>
      <input type="number" id="assurCoverageInput_${idx}" name="assurCoverage_${idx}" class="form-control form-control-sm" value="${data?.coverage || 80}" min="1" max="100" required>
    </div>
    <div style="flex:2">
      <label style="font-size:11px;color:var(--text-muted)">N° Police / Matricule</label>
      <input type="text" name="assurRef_${idx}" class="form-control form-control-sm" value="${data?.ref || ''}" placeholder="Numéro assuré">
    </div>
    <div>
      <button type="button" class="btn btn-xs btn-danger" onclick="this.closest('.assurance-row').remove()"><i data-lucide="trash-2"></i></button>
    </div>
  `;
  container.appendChild(row);
  if (window.lucide) lucide.createIcons();
};

function extractAssurances(data) {
  const assurances = [];
  Object.keys(data).forEach(k => {
    if (k.startsWith('assurInsuranceId_')) {
      const idx = k.split('_')[1];
      const insuranceId = parseInt(data[k]);
      const matched = (window._allInsurances || []).find(ins => ins.id === insuranceId);
      
      if (matched) {
        assurances.push({
          insuranceId: insuranceId,
          name: matched.name,
          enterprise: data['assurEnterprise_' + idx] || '',
          coverage: parseInt(data['assurCoverage_' + idx] || 0),
          ref: data['assurRef_' + idx] || ''
        });
      }
      
      delete data[k];
      delete data['assurEnterprise_' + idx];
      delete data['assurCoverage_' + idx];
      delete data['assurRef_' + idx];
    }
  });
  return assurances;
}

async function submitPatient() {
  if (window.Auth && !Auth.can('patients_create') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Action non autorisée.', 'error', 4000);
    return;
  }
  const form = document.getElementById('patient-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  data.name = UI.normalizeText(data.name);
  if (data.employer) data.employer = UI.normalizeText(data.employer);
  data.assurances = extractAssurances(data);
  try {
    const id = await DB.dbAdd('patients', data);
    await DB.writeAudit('ADD_PATIENT', 'patients', id, { name: data.name });
    UI.closeModal();
    UI.toast('Patient enregistré', 'success');
    Router.navigate('patients');
  } catch (err) { UI.toast('Erreur : ' + err.message, 'error'); }
}

async function editPatient(patientId) {
  if (window.Auth && !Auth.can('patients_edit') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission de modifier un patient.', 'error', 4000);
    return;
  }
  const [patient, insurances] = await Promise.all([
    DB.dbGet('patients', patientId),
    DB.dbGetAll('insurances')
  ]);
  if (!patient) return;
  window._allInsurances = insurances || [];
  UI.modal('<i data-lucide="edit-3" class="modal-icon-inline"></i> Modifier Patient', `
    <form id="edit-patient-form" class="form-grid">
      <div class="form-row">
        <div class="form-group"><label>Nom complet *</label><input type="text" name="name" class="form-control" value="${patient.name || ''}" required></div>
        <div class="form-group"><label>Téléphone</label><input type="tel" name="phone" class="form-control" value="${patient.phone || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Date de naissance</label><input type="date" name="dob" class="form-control" value="${patient.dob || ''}"></div>
        <div class="form-group">
          <label>Sexe</label>
          <select name="gender" class="form-control">
            <option ${!patient.gender ? 'selected' : ''}>Non précisé</option>
            <option value="M" ${patient.gender === 'M' ? 'selected' : ''}>Masculin</option>
            <option value="F" ${patient.gender === 'F' ? 'selected' : ''}>Féminin</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Statut Assuré / Client</label>
          <select name="status" class="form-control">
            <option value="principal" ${patient.status !== 'ayant_droit' ? 'selected' : ''}>Souscripteur Principal</option>
            <option value="ayant_droit" ${patient.status === 'ayant_droit' ? 'selected' : ''}>Ayant droit (Enfant / Conjoint)</option>
          </select>
        </div>
        <div class="form-group">
           <label><i data-lucide="file-clock"></i> Plafond de crédit (GNF)</label>
           <input type="number" name="creditLimit" class="form-control" placeholder="0 = Bloqué" value="${patient.creditLimit || 0}">
        </div>
      </div>
      <div class="form-group"><label>Adresse</label><input type="text" name="address" class="form-control" value="${patient.address || ''}"></div>
      <div class="form-group"><label><i data-lucide="alert-triangle"></i> Allergies</label><input type="text" name="allergies" class="form-control" value="${patient.allergies || ''}"></div>
      <div class="form-group"><label>Antécédents</label><textarea name="medicalHistory" class="form-control" rows="2">${patient.medicalHistory || ''}</textarea></div>
      <div style="grid-column: 1 / -1; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border)">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
          <h4 style="font-size:14px; margin:0;"><i data-lucide="shield"></i> Couvertures d'Assurance</h4>
          <button type="button" class="btn btn-xs btn-primary" onclick="addAssuranceRow('edit-patient-assurances-container')"><i data-lucide="plus"></i> Ajouter</button>
        </div>
        <div id="edit-patient-assurances-container"></div>
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="updatePatient(${patientId})"><i data-lucide="save"></i> Mettre à jour</button>
    `
  });
  if (window.lucide) lucide.createIcons();
  if (patient.assurances && patient.assurances.length) {
    patient.assurances.forEach(assur => window.addAssuranceRow('edit-patient-assurances-container', assur));
  }
}

async function updatePatient(patientId) {
  if (window.Auth && !Auth.can('patients_edit') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Action non autorisée.', 'error', 4000);
    return;
  }
  const form = document.getElementById('edit-patient-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  data.name = UI.normalizeText(data.name);
  if (data.employer) data.employer = UI.normalizeText(data.employer);
  data.assurances = extractAssurances(data);
  const existing = await DB.dbGet('patients', patientId);
  await DB.dbPut('patients', { ...existing, ...data });
  await DB.writeAudit('EDIT_PATIENT', 'patients', patientId, { name: data.name });
  UI.closeModal();
  UI.toast('Dossier patient mis à jour', 'success');
  Router.navigate('patients');
}
function exportPatients() {
  if (window.Auth && !Auth.can('patients_view') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'exporter.', 'error', 4000);
    return;
  }
  // Export anonymized (no names - just stats)
  const data = window._patientsData || [];
  const csv = ['ID,Age,Genre,Allergies,Ville'].join('\n') + '\n' +
    data.map((p, i) => [
      `P${String(i + 1).padStart(4, '0')}`,
      p.dob ? calcAge(p.dob) : '',
      p.gender || '',
      p.allergies ? 'Oui' : 'Non',
      p.address ? p.address.split(',').pop().trim() : '',
    ].join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `patients_anonymises_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  UI.toast('Export anonymisé téléchargé', 'success');
  DB.writeAudit('EXPORT_CSV', 'patients', null, { count: data.length, filename: a.download, anonymized: true });
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATION SMS (Feature 3)
// ═══════════════════════════════════════════════════════════════
async function openSmsModal(patientId) {
  const patient = await DB.dbGet('patients', patientId);
  if (!patient) return;
  if (!patient.phone) {
    UI.toast('Ce patient n\'a pas de numéro de téléphone enregistré', 'warning');
    return;
  }

  UI.modal(`<i data-lucide="message-square" class="modal-icon-inline"></i> Envoyer un SMS à ${patient.name}`, `
    <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
      Numéro destinataire : <strong>${patient.phone}</strong>
    </div>
    <form id="sms-patient-form">
      <div class="form-group">
        <label>Type de message</label>
        <select name="type" class="form-control" onchange="document.getElementById('sms-custom-group').style.display = this.value === 'custom' || this.value === 'renewal' || this.value === 'appointment' ? 'block' : 'none'">
          <option value="debt">Rappel de dette (généré auto)</option>
          <option value="renewal">Renouvellement traitement</option>
          <option value="appointment">Rappel rendez-vous</option>
          <option value="custom">Message personnalisé</option>
        </select>
      </div>
      <div class="form-group" id="sms-custom-group" style="display:none">
        <label>Détail / Message</label>
        <textarea name="customMessage" class="form-control" rows="3" placeholder="Saisissez votre message ou les détails (nom du médicament, date)..."></textarea>
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="sendPatientSms(${patientId})"><i data-lucide="send"></i> Envoyer le SMS</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function sendPatientSms(patientId) {
  if (!window.SMS) { UI.toast('Module SMS introuvable', 'error'); return; }
  
  const form = document.getElementById('sms-patient-form');
  const type = form.type.value;
  const customMessage = form.customMessage.value;

  const btn = event.currentTarget;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="spinner-inline"></i> Envoi...';

  try {
    const res = await SMS.quickSend(patientId, type, customMessage);
    if (res.success) {
      UI.toast('SMS envoyé avec succès !', 'success');
      UI.closeModal();
    } else {
      UI.toast('Erreur d\'envoi : ' + (res.error || 'Vérifiez la configuration'), 'error');
    }
  } catch (err) {
    UI.toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

window.exportPatientsPDF = function() {
  if (window.Auth && !Auth.can('patients_view') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'exporter.', 'error', 4000);
    return;
  }
  if (!window.PDFExport) return UI.toast("Module PDF non chargé", "error");
  const data = (window._patientsData || []).map(p => [
    p.name || '',
    p.phone || '',
    p.dob ? new Date(p.dob).toLocaleDateString('fr-FR') : '—',
    p.allergies || 'Aucune',
    p.address || ''
  ]);
  const headers = ["Nom du Patient", "Téléphone", "Date de Naissance", "Allergies", "Adresse"];
  window.PDFExport.generate("Liste des Patients", headers, data);
};

/* ══════════════════════════════════════════════════════
 * IMPORT CSV PATIENTS — Architecture Bulk (dbBulkPut)
 * ══════════════════════════════════════════════════════ */

function showImportPatientsModal() {
  if (window.Auth && !Auth.can('patients_create') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'importer des patients.', 'error', 4000);
    return;
  }
  UI.modal('<i data-lucide="upload" class="modal-icon-inline"></i> Importation de Patients (CSV)', `
    <div class="import-container">
      <p class="mb-1 text-sm">Importez vos dossiers patients depuis un fichier CSV. Colonnes attendues : <strong>Nom, Téléphone, Adresse, Sexe, Allergies</strong>.</p>
      
      <div id="import-patients-drop-zone" class="import-drop-zone">
        <i data-lucide="file-up"></i>
        <div>
          <strong>Cliquez pour choisir un fichier</strong> ou glissez-le ici
          <p class="text-sm text-muted mt-0-5">Format CSV (.csv) uniquement</p>
        </div>
        <input type="file" id="import-patients-file-input" accept=".csv" hidden>
      </div>

      <div id="import-patients-progress" class="import-progress-container">
        <div class="import-progress-bar"><div id="import-patients-progress-fill" class="import-progress-fill"></div></div>
        <div id="import-patients-status" class="import-status-text">Préparation...</div>
      </div>

      <div id="import-patients-results" class="import-results"></div>

      <a href="#" class="import-template-link" onclick="downloadPatientsTemplate(event)">
        <i data-lucide="download" style="width:12px;height:12px"></i> Télécharger un modèle de fichier
      </a>
    </div>
  `, {
    footer: `<button class="btn btn-secondary" onclick="UI.closeModal()">Fermer</button>`
  });

  const zone = document.getElementById('import-patients-drop-zone');
  const input = document.getElementById('import-patients-file-input');

  if (zone && input) {
    zone.onclick = () => input.click();
    input.onchange = (e) => handleImportPatientsFile(e.target.files[0]);
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('dragover'); };
    zone.ondragleave = () => zone.classList.remove('dragover');
    zone.ondrop = (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleImportPatientsFile(e.dataTransfer.files[0]);
    };
  }
  if (window.lucide) lucide.createIcons();
}

async function handleImportPatientsFile(file) {
  if (!file) return;
  if (!file.name.endsWith('.csv')) { UI.toast('Veuillez sélectionner un fichier CSV', 'error'); return; }

  const zone = document.getElementById('import-patients-drop-zone');
  const progress = document.getElementById('import-patients-progress');
  const results = document.getElementById('import-patients-results');
  if (zone) zone.style.display = 'none';
  if (progress) progress.style.display = 'block';
  if (results) results.style.display = 'none';

  const reader = new FileReader();
  reader.onload = async (e) => await processImportPatientsCSV(e.target.result);
  reader.onerror = () => UI.toast('Erreur de lecture du fichier', 'error');
  reader.readAsText(file, 'UTF-8');
}

async function processImportPatientsCSV(content) {
  const status = document.getElementById('import-patients-status');
  const fill = document.getElementById('import-patients-progress-fill');
  const results = document.getElementById('import-patients-results');

  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length <= 1) {
    if (status) status.textContent = 'Fichier vide.';
    if (results) { results.style.display='block'; results.className='import-results error'; results.innerHTML='<strong>Erreur :</strong> Le fichier est vide.'; }
    return;
  }

  const header = lines[0];
  const sep = header.includes(';') ? ';' : ',';
  const cols = header.split(sep).map(c => c.replace(/"/g, '').trim().toLowerCase());

  const map = {
    name: cols.findIndex(c => c.includes('nom') || c.includes('name')),
    phone: cols.findIndex(c => c.includes('tel') || c.includes('phone') || c.includes('mobile')),
    address: cols.findIndex(c => c.includes('adresse') || c.includes('address')),
    sex: cols.findIndex(c => c.includes('sexe') || c.includes('sex') || c.includes('genre')),
    allergies: cols.findIndex(c => c.includes('allergie') || c.includes('allerg')),
    email: cols.findIndex(c => c.includes('email') || c.includes('mail')),
    dob: cols.findIndex(c => c.includes('naissance') || c.includes('birth') || c.includes('dob')),
  };

  if (map.name === -1) {
    if (status) status.textContent = 'Colonne Nom manquante.';
    if (results) { results.style.display='block'; results.className='import-results error'; results.innerHTML='<strong>Erreur :</strong> La colonne "Nom" est obligatoire.'; }
    return;
  }

  // Phase 1 : Charger les patients existants pour dédoublonnage par téléphone
  if (status) status.textContent = 'Chargement de la base existante...';
  const allExisting = await DB.dbGetAll('patients');
  const phoneMap = new Map();
  allExisting.forEach(p => { if (p.phone) phoneMap.set(p.phone.replace(/\s/g, ''), p); });

  // Phase 2 : Parser toutes les lignes en mémoire
  if (status) status.textContent = 'Analyse du fichier...';
  const parsed = [];
  let errors = 0;

  for (let i = 1; i < lines.length; i++) {
    try {
      const row = lines[i].split(sep).map(v => v.replace(/"/g, '').trim());
      const name = row[map.name] || '';
      if (!name) { errors++; continue; }

      const phone = map.phone !== -1 ? (row[map.phone] || '') : '';
      const existing = phone ? phoneMap.get(phone.replace(/\s/g, '')) : null;

      const patient = {
        ...(existing || {}),
        name,
        phone,
        address: map.address !== -1 ? (row[map.address] || '') : (existing?.address || ''),
        sex: map.sex !== -1 ? (row[map.sex] || '') : (existing?.sex || ''),
        allergies: map.allergies !== -1 ? (row[map.allergies] || '') : (existing?.allergies || ''),
        email: map.email !== -1 ? (row[map.email] || '') : (existing?.email || ''),
        dateOfBirth: map.dob !== -1 ? (row[map.dob] || '') : (existing?.dateOfBirth || ''),
        status: 'active',
        _createdAt: existing?._createdAt || Date.now()
      };

      parsed.push(patient);
      if (phone) phoneMap.set(phone.replace(/\s/g, ''), patient);
    } catch (err) { errors++; }
  }

  // Phase 3 : Écriture IndexedDB par lots via dbBulkPut
  const BULK_SIZE = 1000;
  let imported = 0;

  for (let i = 0; i < parsed.length; i += BULK_SIZE) {
    const chunk = parsed.slice(i, i + BULK_SIZE);
    try {
      await DB.dbBulkPut('patients', chunk);
      imported += chunk.length;
    } catch (err) {
      console.error('[Import Patients] Erreur bulk:', err);
      errors += chunk.length;
    }
    const done = Math.min(i + BULK_SIZE, parsed.length);
    const pct = Math.round((done / parsed.length) * 100);
    if (fill) fill.style.width = pct + '%';
    if (status) status.textContent = `Écriture : ${done.toLocaleString()} / ${parsed.length.toLocaleString()}...`;
    
    // Pause de 50ms pour laisser l'interface graphique se rafraîchir sans geler
    await new Promise(r => setTimeout(r, 50));
  }

  // Phase 4 : Résultats
  if (fill) fill.style.width = '100%';
  if (status) status.textContent = 'Importation terminée.';
  if (results) {
    results.style.display = 'block';
    results.className = `import-results ${imported > 0 ? 'success' : 'error'}`;
    results.innerHTML = `<strong>Résultat :</strong> ${imported} patients importés. ${errors > 0 ? `<br><small>${errors} lignes ignorées.</small>` : ''}`;
  }
  await DB.writeAudit('BULK_IMPORT_PATIENTS', 'patients', null, { imported, errors });
  setTimeout(() => renderPatients(document.getElementById('app-content')), 1500);
}

function downloadPatientsTemplate(e) {
  e.preventDefault();
  const csv = '\uFEFFNom,Téléphone,Adresse,Sexe,Allergies,Email,Date de naissance\nMamadou Diallo,625000000,Conakry Kaloum,M,Pénicilline,mamadou@email.com,1985-03-15\nFatoumata Bah,621000000,Conakry Ratoma,F,,fatou@email.com,1990-07-22';
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'modele_patients.csv'; a.click();
  UI.toast('Modèle téléchargé', 'success');
}

window.filterPatients = filterPatients;
window.viewPatient = viewPatient;
window.showAddPatient = showAddPatient;
window.submitPatient = submitPatient;
window.editPatient = editPatient;
window.updatePatient = updatePatient;
window.exportPatients = exportPatients;
window.openSmsModal = openSmsModal;
window.sendPatientSms = sendPatientSms;
window.showImportPatientsModal = showImportPatientsModal;
window.downloadPatientsTemplate = downloadPatientsTemplate;

Router.register('patients', renderPatients);
