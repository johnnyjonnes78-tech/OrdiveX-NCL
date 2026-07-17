/**
 * OrdiveX — Registre des Entrées et Sorties de Caisse (Dépenses / Recettes)
 * Gestion professionnelle des mouvements financiers manuels hors ventes.
 */

const CASH_MOV_PAGE_SIZE = 50;

async function renderStockExits(container) {
  UI.loading(container, 'Chargement du registre de trésorerie...');

  try {
    const [cashRegisterRaw, users] = await Promise.all([
      DB.dbGetAll('cashRegister'),
      DB.dbGetAll('users')
    ]);

    // Filtrer les opérations manuelles (exclure les ventes, retours, paies RH d'ici)
    const manualMovements = cashRegisterRaw.filter(c => 
      c.type === 'manual_in' || 
      c.type === 'manual_out'
    );

    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.name || u.username; });

    // Stocker dans le scope global pour le filtrage, pagination et actions
    window._cashMovements = manualMovements;
    window._cashMovUserMap = userMap;
    window._cashMovUsers = users;
    window._cashMovCurrentPage = 1;

    // Date par défaut : Début de ce mois à aujourd'hui
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const fromDefault = startOfMonth.toISOString().split('T')[0];
    const toDefault = today.toISOString().split('T')[0];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Entrées et Sorties de Caisse</h1>
          <p class="page-subtitle">Registre de traçabilité des dépenses et recettes manuelles hors-vente</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" onclick="exportCashMovementsPDF()"><i data-lucide="printer"></i> PDF</button>
          <button class="btn btn-secondary" onclick="exportCashMovementsCSV()"><i data-lucide="file-spreadsheet"></i> Exporter CSV</button>
          <button class="btn btn-success" onclick="showNewCashMovementForm('manual_in')"><i data-lucide="plus-circle"></i> Nouveau Dépôt (Entrée)</button>
          <button class="btn btn-danger" onclick="showNewCashMovementForm('manual_out')"><i data-lucide="minus-circle"></i> Nouvelle Dépense (Sortie)</button>
        </div>
      </div>

      <!-- BLOCS KPI -->
      <div class="kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:20px;">
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon"><i data-lucide="calculator"></i></div>
          <div class="kpi-content">
            <div class="kpi-value" id="kpi-cash-count">0</div>
            <div class="kpi-label">Nombre d'opérations</div>
          </div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon"><i data-lucide="trending-up"></i></div>
          <div class="kpi-content">
            <div class="kpi-value" id="kpi-cash-entries">0 GNF</div>
            <div class="kpi-label">Total Entrées (Dépôts)</div>
          </div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-icon"><i data-lucide="trending-down"></i></div>
          <div class="kpi-content">
            <div class="kpi-value" id="kpi-cash-exits">0 GNF</div>
            <div class="kpi-label">Total Sorties (Dépenses)</div>
          </div>
        </div>
        <div class="kpi-card kpi-purple">
          <div class="kpi-icon"><i data-lucide="wallet"></i></div>
          <div class="kpi-content">
            <div class="kpi-value" id="kpi-cash-balance">0 GNF</div>
            <div class="kpi-label">Solde Net</div>
          </div>
        </div>
      </div>

      <!-- BARRE DE RECHERCHE & FILTRES -->
      <div class="filter-bar" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; background:var(--surface); padding:16px; border-radius:12px; border:1px solid var(--border); margin-bottom:20px;">
        <div class="form-group" style="margin-bottom:0; flex:2; min-width:200px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Recherche</label>
          <input type="text" id="cash-search" class="form-control" placeholder="Rechercher par libellé, référence..." oninput="filterCashMovements()">
        </div>
        <div class="form-group" style="margin-bottom:0; flex:1; min-width:150px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Type</label>
          <select id="cash-type" class="form-control" onchange="filterCashMovements()">
            <option value="">Tous les flux</option>
            <option value="manual_in">Dépôt (Entrée)</option>
            <option value="manual_out">Dépense (Sortie)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0; flex:1; min-width:150px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Mode</label>
          <select id="cash-method" class="form-control" onchange="filterCashMovements()">
            <option value="">Tous les modes</option>
            <option value="cash">Espèces</option>
            <option value="orange_money">Orange Money</option>
            <option value="mtn_momo">MTN MoMo</option>
            <option value="transfer">Virement</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0; width:140px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Du</label>
          <input type="date" id="cash-date-from" class="form-control" value="${fromDefault}" onchange="filterCashMovements()">
        </div>
        <div class="form-group" style="margin-bottom:0; width:140px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Au</label>
          <input type="date" id="cash-date-to" class="form-control" value="${toDefault}" onchange="filterCashMovements()">
        </div>
      </div>

      <div id="cash-table-container"></div>
    `;

    filterCashMovements();
    if (window.lucide) lucide.createIcons();

  } catch (err) {
    UI.toast('Erreur de chargement : ' + err.message, 'error');
  }
}

function filterCashMovements() {
  const query = (document.getElementById('cash-search')?.value || '').toLowerCase().trim();
  const type = document.getElementById('cash-type')?.value || '';
  const method = document.getElementById('cash-method')?.value || '';
  const fromDate = document.getElementById('cash-date-from')?.value;
  const toDate = document.getElementById('cash-date-to')?.value;

  let filtered = [...(window._cashMovements || [])];

  // Filtre période
  if (fromDate) {
    filtered = filtered.filter(c => c.date && c.date >= fromDate);
  }
  if (toDate) {
    filtered = filtered.filter(c => c.date && c.date <= toDate);
  }

  // Filtre type
  if (type) {
    filtered = filtered.filter(c => c.type === type);
  }

  // Filtre mode règlement
  if (method) {
    filtered = filtered.filter(c => c.paymentMethod === method);
  }

  // Recherche libre
  if (query) {
    filtered = filtered.filter(c => {
      const reason = (c.reason || '').toLowerCase();
      const ref = (c.reference || '').toLowerCase();
      const obs = (c.observations || '').toLowerCase();
      return reason.includes(query) || ref.includes(query) || obs.includes(query);
    });
  }

  // Trier par date/timestamp décroissant
  filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  window._cashMovFilteredData = filtered;

  // Calcul statistiques KPIs
  const count = filtered.length;
  const totalEntries = filtered.filter(c => c.type === 'manual_in').reduce((acc, c) => acc + (c.amount || 0), 0);
  const totalExits = filtered.filter(c => c.type === 'manual_out').reduce((acc, c) => acc + (c.amount || 0), 0);
  const netBalance = totalEntries - totalExits;

  document.getElementById('kpi-cash-count').textContent = count;
  document.getElementById('kpi-cash-entries').textContent = UI.formatCurrency(totalEntries);
  document.getElementById('kpi-cash-exits').textContent = UI.formatCurrency(totalExits);
  
  const balanceEl = document.getElementById('kpi-cash-balance');
  balanceEl.textContent = UI.formatCurrency(netBalance);
  balanceEl.style.color = netBalance >= 0 ? '#16A34A' : '#DC2626';

  const container = document.getElementById('cash-table-container');
  if (!container) return;

  UI.table(container, [
    {
      label: 'Date & Heure',
      render: r => {
        const d = r.timestamp ? new Date(r.timestamp) : (r.date ? new Date(r.date) : new Date());
        return `<strong>${d.toLocaleDateString('fr-FR')}</strong> <span class="text-muted" style="font-size:11px">${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>`;
      }
    },
    {
      label: 'Libellé / Objet',
      render: r => `<strong>${r.reason || '—'}</strong>`
    },
    {
      label: 'Type',
      render: r => {
        const isEntry = r.type === 'manual_in';
        return `<span class="badge ${isEntry ? 'badge-success' : 'badge-danger'}">${isEntry ? 'Dépôt (Entrée)' : 'Dépense (Sortie)'}</span>`;
      }
    },
    {
      label: 'Montant',
      render: r => {
        const isEntry = r.type === 'manual_in';
        return `<strong class="${isEntry ? 'text-success' : 'text-danger'}">${isEntry ? '+' : '-'}${UI.formatCurrency(r.amount || 0)}</strong>`;
      }
    },
    {
      label: 'Mode de règlement',
      render: r => {
        const m = r.paymentMethod || 'cash';
        const labels = { cash: 'Espèces', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', transfer: 'Virement' };
        return `<span class="badge badge-neutral">${labels[m] || m}</span>`;
      }
    },
    {
      label: 'Utilisateur',
      render: r => window._cashMovUserMap[r.userId] || '<span class="text-muted">Système</span>'
    },
    {
      label: 'Référence / Pièce',
      render: r => r.reference ? `<code>${r.reference}</code>` : '<span class="text-muted">—</span>'
    },
    {
      label: 'Observations',
      render: r => `<span style="font-size:11px; max-width:200px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.observations || ''}">${r.observations || '—'}</span>`
    },
    {
      label: 'Actions',
      render: r => `
        <button class="btn btn-xs btn-warning" onclick="showEditCashMovementForm(${r.id})" title="Modifier l'opération (audit log généré)"><i data-lucide="edit-3"></i></button>
      `
    }
  ], filtered, {
    emptyMessage: "Aucun mouvement manuel de trésorerie trouvé.",
    emptyIcon: 'banknote',
    pageSize: CASH_MOV_PAGE_SIZE
  });

  if (window.lucide) lucide.createIcons();
}

function showNewCashMovementForm(type) {
  const isEntry = type === 'manual_in';
  const title = isEntry ? "Nouveau Dépôt en Caisse (Entrée)" : "Nouvelle Dépense (Sortie de Caisse)";
  
  const formHTML = `
    <form id="cash-mov-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Montant (GNF) *</label>
          <input type="number" name="amount" class="form-control" min="1" placeholder="Ex: 50000" required>
        </div>
        <div class="form-group">
          <label>Mode de règlement *</label>
          <select name="paymentMethod" class="form-control" required>
            <option value="cash">Espèces</option>
            <option value="orange_money">Orange Money</option>
            <option value="mtn_momo">MTN MoMo</option>
            <option value="transfer">Virement</option>
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Libellé / Objet *</label>
          <input type="text" name="reason" class="form-control" placeholder="Ex: ${isEntry ? 'Apport de fonds monnaie' : 'Achat de rames de papier'}" required>
        </div>
        <div class="form-group">
          <label>Référence / N° Pièce</label>
          <input type="text" name="reference" class="form-control" placeholder="Ex: CHQ-99, FAC-88">
        </div>
      </div>

      <div class="form-group">
        <label>Observations / Notes</label>
        <textarea name="observations" class="form-control" rows="2" placeholder="Informations complémentaires..."></textarea>
      </div>
    </form>
  `;

  UI.modal(`<i data-lucide="${isEntry ? 'plus-circle' : 'minus-circle'}" class="modal-icon-inline"></i> ${title}`, formHTML, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn ${isEntry ? 'btn-success' : 'btn-danger'}" onclick="submitNewCashMovement('${type}')"><i data-lucide="check"></i> Confirmer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function submitNewCashMovement(type) {
  const form = document.getElementById('cash-mov-form');
  if (!form || !form.checkValidity()) { form?.reportValidity(); return; }

  const formData = Object.fromEntries(new FormData(form));
  const amount = parseFloat(formData.amount);
  
  if (isNaN(amount) || amount <= 0) { UI.toast('Veuillez saisir un montant valide', 'warning'); return; }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const movementRecord = {
      type: type,
      amount: amount,
      paymentMethod: formData.paymentMethod,
      reason: formData.reason,
      reference: formData.reference || '',
      observations: formData.observations || '',
      date: todayStr,
      timestamp: Date.now(),
      userId: DB.AppState.currentUser?.id || null
    };

    const movId = await DB.dbAdd('cashRegister', movementRecord);

    // Enregistrer dans l'audit log
    await DB.writeAudit(type === 'manual_in' ? 'CASH_MANUAL_IN' : 'CASH_MANUAL_OUT', 'cashRegister', movId, {
      amount,
      reason: formData.reason,
      reference: formData.reference || '',
      user: DB.AppState.currentUser?.name || DB.AppState.currentUser?.username
    });

    UI.closeModal();
    UI.toast('Opération enregistrée avec succès', 'success');

    if (typeof DB.syncToSupabase === 'function') DB.syncToSupabase();
    renderStockExits(document.getElementById('app-content'));

  } catch(err) {
    UI.toast('Erreur lors de l\'enregistrement : ' + err.message, 'error');
  }
}

async function showEditCashMovementForm(movId) {
  try {
    const movObj = await DB.dbGet('cashRegister', movId);
    if (!movObj) return;

    const isEntry = movObj.type === 'manual_in';
    
    const formHTML = `
      <form id="cash-mov-edit-form" class="form-grid">
        <div class="form-row">
          <div class="form-group">
            <label>Montant (GNF) *</label>
            <input type="number" name="amount" class="form-control" min="1" value="${movObj.amount}" required>
          </div>
          <div class="form-group">
            <label>Motif de la modification *</label>
            <input type="text" id="edit-audit-reason" class="form-control" placeholder="Justification obligatoire..." required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Libellé / Objet *</label>
            <input type="text" name="reason" class="form-control" value="${movObj.reason || ''}" required>
          </div>
          <div class="form-group">
            <label>Mode de règlement *</label>
            <select name="paymentMethod" class="form-control" required>
              <option value="cash" ${movObj.paymentMethod === 'cash' ? 'selected' : ''}>Espèces</option>
              <option value="orange_money" ${movObj.paymentMethod === 'orange_money' ? 'selected' : ''}>Orange Money</option>
              <option value="mtn_momo" ${movObj.paymentMethod === 'mtn_momo' ? 'selected' : ''}>MTN MoMo</option>
              <option value="transfer" ${movObj.paymentMethod === 'transfer' ? 'selected' : ''}>Virement</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Référence / N° Pièce</label>
            <input type="text" name="reference" class="form-control" value="${movObj.reference || ''}">
          </div>
        </div>

        <div class="form-group">
          <label>Observations / Notes</label>
          <textarea name="observations" class="form-control" rows="2">${movObj.observations || ''}</textarea>
        </div>
      </form>
    `;

    UI.modal('<i data-lucide="edit-3" class="modal-icon-inline"></i> Modifier le Mouvement de Caisse', formHTML, {
      footer: `
        <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
        <button class="btn btn-warning" onclick="submitEditCashMovement(${movId})"><i data-lucide="save"></i> Enregistrer les modifications</button>
      `
    });
    if (window.lucide) lucide.createIcons();

  } catch(err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function submitEditCashMovement(movId) {
  const form = document.getElementById('cash-mov-edit-form');
  const auditReason = document.getElementById('edit-audit-reason')?.value?.trim();
  if (!form || !form.checkValidity()) { form?.reportValidity(); return; }
  if (!auditReason) { UI.toast('Veuillez saisir un motif de modification', 'warning'); return; }

  const formData = Object.fromEntries(new FormData(form));
  const newAmount = parseFloat(formData.amount);
  if (isNaN(newAmount) || newAmount <= 0) { UI.toast('Veuillez saisir un montant valide', 'warning'); return; }

  try {
    const movObj = await DB.dbGet('cashRegister', movId);
    if (!movObj) return;

    const oldAmount = movObj.amount;

    const updatedMovObj = {
      ...movObj,
      amount: newAmount,
      reason: formData.reason,
      paymentMethod: formData.paymentMethod,
      reference: formData.reference || '',
      observations: formData.observations || '',
      updatedAt: Date.now(),
      updatedBy: DB.AppState.currentUser?.id
    };

    await DB.dbPut('cashRegister', updatedMovObj);

    // Enregistrer dans l'audit log
    await DB.writeAudit('CASH_MANUAL_EDIT', 'cashRegister', movId, {
      oldAmount,
      newAmount,
      oldReason: movObj.reason,
      newReason: formData.reason,
      auditReason,
      editedBy: DB.AppState.currentUser?.name || DB.AppState.currentUser?.username
    });

    UI.closeModal();
    UI.toast('Mouvement mis à jour et tracé dans l\'audit', 'success');

    if (typeof DB.syncToSupabase === 'function') DB.syncToSupabase();
    renderStockExits(document.getElementById('app-content'));

  } catch(err) {
    UI.toast('Erreur de mise à jour : ' + err.message, 'error');
  }
}

function exportCashMovementsCSV() {
  const data = window._cashMovFilteredData || [];
  if (data.length === 0) { UI.toast('Aucune donnée à exporter', 'warning'); return; }

  let csv = '\uFEFFDate,Heure,Libelle/Objet,Type,Montant,Mode,Utilisateur,Reference/Piece,Observations\n';
  data.forEach(c => {
    const d = c.timestamp ? new Date(c.timestamp) : (c.date ? new Date(c.date) : new Date());
    const dateStr = d.toLocaleDateString('fr-FR');
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const typeLabel = c.type === 'manual_in' ? 'Depot (Entree)' : 'Depense (Sortie)';
    const amount = c.amount || 0;
    const labels = { cash: 'Especes', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', transfer: 'Virement' };
    const method = labels[c.paymentMethod] || c.paymentMethod;
    const user = window._cashMovUserMap[c.userId] || 'Systeme';
    const ref = c.reference || '';
    const obs = c.observations || '';

    csv += `"${dateStr}","${timeStr}","${(c.reason || '').replace(/"/g, '""')}","${typeLabel}","${amount}","${method}","${user.replace(/"/g, '""')}","${ref.replace(/"/g, '""')}","${obs.replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Mouvements_Tresorerie_Caisse_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  UI.toast("Fichier CSV exporté avec succès", "success");
}

function exportCashMovementsPDF() {
  const dataList = window._cashMovFilteredData || [];
  if (dataList.length === 0) {
    return UI.toast("Aucune donnée à exporter", "warning");
  }
  if (!window.PDFExport) {
    return UI.toast("Module PDF non chargé", "error");
  }

  let totalEntries = 0;
  let totalExits = 0;

  const data = dataList.map(c => {
    const isEntry = c.type === 'manual_in';
    const amount = c.amount || 0;
    if (isEntry) totalEntries += amount;
    else totalExits += amount;

    const d = c.timestamp ? new Date(c.timestamp) : (c.date ? new Date(c.date) : new Date());
    const dateStr = d.toLocaleDateString('fr-FR');
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const user = window._cashMovUserMap[c.userId] || 'Système';
    const labels = { cash: 'Espèces', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', transfer: 'Virement' };

    return [
      dateStr + ' ' + timeStr,
      c.reason || '—',
      isEntry ? 'Entrée (Dépôt)' : 'Sortie (Dépense)',
      (isEntry ? '+' : '-') + UI.formatCurrency(amount),
      labels[c.paymentMethod] || c.paymentMethod,
      user,
      c.reference || '—'
    ];
  });

  const headers = ["Date & Heure", "Libellé / Objet", "Type", "Montant", "Mode", "Utilisateur", "Référence"];
  
  const fromDate = document.getElementById('cash-date-from')?.value;
  const toDate = document.getElementById('cash-date-to')?.value;
  const dateRangeStr = (fromDate && toDate) 
    ? `Période du ${new Date(fromDate).toLocaleDateString('fr-FR')} au ${new Date(toDate).toLocaleDateString('fr-FR')}`
    : '';

  window.PDFExport.generate(
    `Registre des Entrées et Sorties de Caisse (Dépenses / Recettes)`,
    headers,
    data,
    {
      subtitle: dateRangeStr || `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
      filename: `Registre_Tresorerie_Caisse_${new Date().toISOString().split('T')[0]}.pdf`,
      footerText: `Total Entrées : ${UI.formatCurrency(totalEntries)} | Total Sorties : ${UI.formatCurrency(totalExits)} | Solde Net : ${UI.formatCurrency(totalEntries - totalExits)}`
    }
  );
}

// Enregistrement dans le routeur global
Router.register('stock-exits', renderStockExits);

// Exposer globalement les fonctions déclenchées par l'UI
window.filterCashMovements = filterCashMovements;
window.showNewCashMovementForm = showNewCashMovementForm;
window.submitNewCashMovement = submitNewCashMovement;
window.showEditCashMovementForm = showEditCashMovementForm;
window.submitEditCashMovement = submitEditCashMovement;
window.exportCashMovementsCSV = exportCashMovementsCSV;
window.exportCashMovementsPDF = exportCashMovementsPDF;
