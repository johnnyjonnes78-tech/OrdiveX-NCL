/**
 * OrdiveX — Registre des Entrées et Sorties Manuelles de Stock
 * Traçabilité complète, historique immuable, filtres, pagination, impressions et exports.
 */

const MAN_MOV_PAGE_SIZE = 50;

async function renderStockExits(container) {
  UI.loading(container, 'Chargement du registre des mouvements...');

  try {
    const [movements, products, users, stock] = await Promise.all([
      DB.dbGetAll('movements'),
      DB.dbGetAll('products'),
      DB.dbGetAll('users'),
      DB.dbGetAll('stock')
    ]);

    // Filtrer les mouvements manuels (ceux qui ne sont pas des ventes automatiques ou des commandes d'achat d'invoice)
    let manualMovements = movements.filter(m => 
      m.subType === 'MANUAL_ENTRY' || 
      m.subType === 'MANUAL_EXIT' || 
      m.subType === 'ADMIN_ADJUSTMENT' ||
      m.subType === 'MANUAL' ||
      !m.subType
    );

    // Dictionnaires pour jointures rapides
    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.name || u.username; });

    // Stocker dans le scope global pour le filtrage et la pagination
    window._manualMovements = manualMovements;
    window._manMovProductMap = productMap;
    window._manMovUserMap = userMap;
    window._manMovProducts = products;
    window._manMovUsers = users;
    window._manMovCurrentPage = 1;

    // Date par défaut : Début de ce mois à aujourd'hui
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const fromDefault = startOfMonth.toISOString().split('T')[0];
    const toDefault = today.toISOString().split('T')[0];

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Entrées et Sorties Manuelles</h1>
          <p class="page-subtitle">Historique complet et registre professionnel des mouvements manuels de stock</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary" onclick="exportManualMovementsPDF()"><i data-lucide="printer"></i> PDF</button>
          <button class="btn btn-secondary" onclick="exportManualMovementsCSV()"><i data-lucide="file-spreadsheet"></i> Exporter CSV</button>
          <button class="btn btn-success" onclick="showNewManualMovementForm('ENTRY')"><i data-lucide="plus-circle"></i> Nouvelle Entrée</button>
          <button class="btn btn-danger" onclick="showNewManualMovementForm('EXIT')"><i data-lucide="minus-circle"></i> Nouvelle Sortie</button>
        </div>
      </div>

      <!-- BLOCS KPI -->
      <div class="kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:20px;">
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon"><i data-lucide="list"></i></div>
          <div class="kpi-content">
            <div class="kpi-value" id="kpi-mov-count">0</div>
            <div class="kpi-label">Total opérations</div>
          </div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon"><i data-lucide="trending-up"></i></div>
          <div class="kpi-content">
            <div class="kpi-value" id="kpi-mov-entries">0</div>
            <div class="kpi-label">Quantités Entrées</div>
          </div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-icon"><i data-lucide="trending-down"></i></div>
          <div class="kpi-content">
            <div class="kpi-value" id="kpi-mov-exits">0</div>
            <div class="kpi-label">Quantités Sorties</div>
          </div>
        </div>
      </div>

      <!-- BARRE DE RECHERCHE & FILTRES -->
      <div class="filter-bar" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; background:var(--surface); padding:16px; border-radius:12px; border:1px solid var(--border); margin-bottom:20px;">
        <div class="form-group" style="margin-bottom:0; flex:2; min-width:200px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Recherche</label>
          <input type="text" id="mov-search" class="form-control" placeholder="Rechercher par médicament, motif, réf..." oninput="filterManualMovements()">
        </div>
        <div class="form-group" style="margin-bottom:0; flex:1; min-width:150px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Type</label>
          <select id="mov-type" class="form-control" onchange="filterManualMovements()">
            <option value="">Tous les types</option>
            <option value="ENTRY">Entrée Manuelle</option>
            <option value="EXIT">Sortie Manuelle</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0; flex:1; min-width:150px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Utilisateur</label>
          <select id="mov-user" class="form-control" onchange="filterManualMovements()">
            <option value="">Tous les utilisateurs</option>
            ${users.map(u => `<option value="${u.id}">${u.name || u.username}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0; width:140px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Du</label>
          <input type="date" id="mov-date-from" class="form-control" value="${fromDefault}" onchange="filterManualMovements()">
        </div>
        <div class="form-group" style="margin-bottom:0; width:140px;">
          <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Au</label>
          <input type="date" id="mov-date-to" class="form-control" value="${toDefault}" onchange="filterManualMovements()">
        </div>
      </div>

      <div id="mov-table-container"></div>
    `;

    filterManualMovements();
    if (window.lucide) lucide.createIcons();

  } catch (err) {
    UI.toast('Erreur de chargement : ' + err.message, 'error');
  }
}

function filterManualMovements() {
  const query = (document.getElementById('mov-search')?.value || '').toLowerCase().trim();
  const type = document.getElementById('mov-type')?.value || '';
  const userId = document.getElementById('mov-user')?.value || '';
  const fromDate = document.getElementById('mov-date-from')?.value;
  const toDate = document.getElementById('mov-date-to')?.value;

  let filtered = [...(window._manualMovements || [])];

  // Filtre période
  if (fromDate) {
    filtered = filtered.filter(m => m.date && m.date.split('T')[0] >= fromDate);
  }
  if (toDate) {
    filtered = filtered.filter(m => m.date && m.date.split('T')[0] <= toDate);
  }

  // Filtre type
  if (type) {
    filtered = filtered.filter(m => m.type === type);
  }

  // Filtre utilisateur
  if (userId) {
    filtered = filtered.filter(m => String(m.userId) === String(userId));
  }

  // Recherche libre
  if (query) {
    filtered = filtered.filter(m => {
      const prod = window._manMovProductMap[m.productId];
      const prodName = prod ? (prod.name || '').toLowerCase() : '';
      const prodDci = prod ? (prod.dci || '').toLowerCase() : '';
      const reason = (m.note || m.reason || '').toLowerCase();
      const ref = (m.reference || '').toLowerCase();
      const obs = (m.observations || '').toLowerCase();
      const supplier = (m.supplier || '').toLowerCase();
      const destination = (m.destination || '').toLowerCase();
      return prodName.includes(query) || prodDci.includes(query) || reason.includes(query) || ref.includes(query) || obs.includes(query) || supplier.includes(query) || destination.includes(query);
    });
  }

  // Trier par date décroissante
  filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  window._manMovFilteredData = filtered;

  // Calcul statistiques KPIs
  const count = filtered.length;
  const entriesQty = filtered.filter(m => m.type === 'ENTRY').reduce((acc, m) => acc + Math.abs(m.quantity || 0), 0);
  const exitsQty = filtered.filter(m => m.type === 'EXIT').reduce((acc, m) => acc + Math.abs(m.quantity || 0), 0);

  document.getElementById('kpi-mov-count').textContent = count;
  document.getElementById('kpi-mov-entries').textContent = entriesQty;
  document.getElementById('kpi-mov-exits').textContent = exitsQty;

  const container = document.getElementById('mov-table-container');
  if (!container) return;

  UI.table(container, [
    {
      label: 'Date & Heure',
      render: r => {
        const d = new Date(r.date);
        return `<strong>${d.toLocaleDateString('fr-FR')}</strong> <span class="text-muted" style="font-size:11px">${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>`;
      }
    },
    {
      label: 'Utilisateur',
      render: r => window._manMovUserMap[r.userId] || '<span class="text-muted">Système</span>'
    },
    {
      label: 'Médicament',
      render: r => {
        const p = window._manMovProductMap[r.productId];
        return p ? `<strong>${p.name}</strong> <span class="text-muted" style="font-size:11px; display:block;">${p.code || ''}</span>` : '<span class="text-danger">Produit supprimé</span>';
      }
    },
    {
      label: 'Catégorie',
      render: r => {
        const p = window._manMovProductMap[r.productId];
        return p ? `<span class="badge badge-neutral">${p.category || 'Non classé'}</span>` : '—';
      }
    },
    {
      label: 'Type',
      render: r => {
        const isEntry = r.type === 'ENTRY';
        return `<span class="badge ${isEntry ? 'badge-success' : 'badge-danger'}">${isEntry ? 'Entrée' : 'Sortie'}</span>`;
      }
    },
    {
      label: 'Quantité',
      render: r => {
        const isEntry = r.type === 'ENTRY';
        return `<strong class="${isEntry ? 'text-success' : 'text-danger'}">${isEntry ? '+' : '-'}${Math.abs(r.quantity)}</strong>`;
      }
    },
    {
      label: 'Motif / Réf',
      render: r => `<strong>${r.note || r.reason || '—'}</strong> ${r.reference ? `<code style="display:block; font-size:10px;">Réf: ${r.reference}</code>` : ''}`
    },
    {
      label: 'Fourn. / Dest.',
      render: r => r.type === 'ENTRY' ? (r.supplier || '<span class="text-muted">—</span>') : (r.destination || '<span class="text-muted">—</span>')
    },
    {
      label: 'Observations',
      render: r => `<span style="font-size:11px; max-width:200px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.observations || ''}">${r.observations || '—'}</span>`
    },
    {
      label: 'Actions',
      render: r => `
        <button class="btn btn-xs btn-warning" onclick="showEditManualMovementForm(${r.id})" title="Modifier l'opération (audit log généré)"><i data-lucide="edit-3"></i></button>
      `
    }
  ], filtered, {
    emptyMessage: "Aucun mouvement manuel trouvé dans l'historique.",
    emptyIcon: 'shuffle',
    pageSize: MAN_MOV_PAGE_SIZE
  });

  if (window.lucide) lucide.createIcons();
}

async function showNewManualMovementForm(type) {
  const products = window._manMovProducts || [];
  const title = type === 'ENTRY' ? "Nouvelle Entrée Manuelle" : "Nouvelle Sortie Manuelle";
  
  const formHTML = `
    <form id="man-mov-form" class="form-grid">
      <div class="form-group" style="position:relative;">
        <label>Médicament *</label>
        <input type="text" id="man-mov-search" class="form-control" placeholder="Rechercher par nom..." autocomplete="off" oninput="manMovProductSearch(this.value)">
        <input type="hidden" name="productId" id="man-mov-prod-id" required>
        <div id="man-mov-dropdown" class="order-product-dropdown" style="display:none"></div>
      </div>
      
      <div id="man-mov-lot-container" style="display:none; margin-bottom: 12px;">
        <!-- Sera rempli dynamiquement pour les sorties -->
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Quantité *</label>
          <input type="number" name="quantity" class="form-control" min="1" value="1" required>
        </div>
        <div class="form-group">
          <label>Motif *</label>
          <select name="reason" class="form-control" required>
            <option value="">Sélectionner...</option>
            ${type === 'ENTRY' ? `
              <option value="Réajustement / Inventaire">Réajustement / Inventaire</option>
              <option value="Retour client">Retour client</option>
              <option value="Don reçu">Don reçu</option>
              <option value="Autre">Autre</option>
            ` : `
              <option value="Périmé / Expire">Périmé / Expire</option>
              <option value="Cassé / Endommagé">Cassé / Endommagé</option>
              <option value="Perte">Perte</option>
              <option value="Don offert">Don offert</option>
              <option value="Vol / Ecart stock">Vol / Écart stock</option>
              <option value="Consommation interne">Consommation interne</option>
              <option value="Autre">Autre</option>
            `}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>${type === 'ENTRY' ? 'Fournisseur' : 'Destination'}</label>
          <input type="text" name="${type === 'ENTRY' ? 'supplier' : 'destination'}" class="form-control" placeholder="Ex: ${type === 'ENTRY' ? 'Grossiste Pharma' : 'Destruction / Poubelle'}">
        </div>
        <div class="form-group">
          <label>Référence (Optionnel)</label>
          <input type="text" name="reference" class="form-control" placeholder="Ex: LOT-1234, FACT-XYZ">
        </div>
      </div>

      <div class="form-group">
        <label>Observations / Notes</label>
        <textarea name="observations" class="form-control" rows="2" placeholder="Détails supplémentaires..."></textarea>
      </div>
    </form>
  `;

  UI.modal(`<i data-lucide="${type === 'ENTRY' ? 'plus-circle' : 'minus-circle'}" class="modal-icon-inline"></i> ${title}`, formHTML, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn ${type === 'ENTRY' ? 'btn-success' : 'btn-danger'}" onclick="submitNewManualMovement('${type}')"><i data-lucide="check"></i> Confirmer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

function manMovProductSearch(q) {
  const dropdown = document.getElementById('man-mov-dropdown');
  if (!dropdown) return;
  const val = q.trim().toLowerCase();
  if (val.length < 2) { dropdown.style.display = 'none'; return; }

  const products = window._manMovProducts || [];
  const matches = products.filter(p =>
    (p.name || '').toLowerCase().includes(val) ||
    (p.code || '').toLowerCase().includes(val)
  ).slice(0, 10);

  if (!matches.length) {
    dropdown.innerHTML = '<div class="order-dd-empty">Aucun produit trouvé</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = matches.map(p => `
    <div class="order-dd-item" onclick="selectManMovProduct(${p.id})">
      <strong>${p.name}</strong> <span style="color:var(--text-muted);font-size:11px">(${p.code})</span>
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

async function selectManMovProduct(productId) {
  const prod = window._manMovProducts.find(p => p.id === productId);
  if (!prod) return;

  const searchInput = document.getElementById('man-mov-search');
  const hiddenInput = document.getElementById('man-mov-prod-id');
  const dropdown = document.getElementById('man-mov-dropdown');

  if (searchInput) searchInput.value = prod.name;
  if (hiddenInput) hiddenInput.value = prod.id;
  if (dropdown) dropdown.style.display = 'none';

  // S'il s'agit d'une sortie, charger les lots actifs pour proposer la déduction
  const lotContainer = document.getElementById('man-mov-lot-container');
  if (lotContainer) {
    lotContainer.style.display = 'none';
    try {
      const lots = await DB.dbGetAll('lots');
      const prodLots = lots.filter(l => l.productId === productId && l.status === 'active' && l.quantity > 0);
      if (prodLots.length > 0) {
        lotContainer.innerHTML = `
          <label>Sélectionner le lot spécifique à déduire (Recommandé)</label>
          <select id="man-mov-lot-select" class="form-control" style="background:var(--bg-secondary);font-weight:600">
            <option value="">Sortir du stock global (Premier lot expiré en premier)</option>
            ${prodLots.map(l => `<option value="${l.id}">Lot: ${l.lotNumber || 'Sans lot'} - Expire: ${l.expiryDate ? UI.formatDate(l.expiryDate) : 'N/A'} (Dispo: ${l.quantity})</option>`).join('')}
          </select>
        `;
        lotContainer.style.display = 'block';
      }
    } catch(err) {
      console.error(err);
    }
  }
}

async function submitNewManualMovement(type) {
  const form = document.getElementById('man-mov-form');
  if (!form || !form.checkValidity()) { form?.reportValidity(); return; }

  const formData = Object.fromEntries(new FormData(form));
  const productId = parseInt(formData.productId);
  const qty = parseInt(formData.quantity);
  
  if (isNaN(productId)) { UI.toast('Veuillez sélectionner un médicament', 'warning'); return; }
  if (qty <= 0) { UI.toast('La quantité doit être supérieure à 0', 'warning'); return; }

  try {
    const stocks = await DB.dbGetAll('stock');
    const existingStock = stocks.find(s => s.productId === productId);
    const stockQty = existingStock ? existingStock.quantity : 0;

    if (type === 'EXIT' && stockQty < qty) {
      const confirm = await UI.confirm(`Le stock disponible (${stockQty}) est inférieur à la quantité demandée (${qty}). Voulez-vous forcer la sortie en stock négatif ?`);
      if (!confirm) return;
    }

    // Mettre à jour le stock global
    const newQty = type === 'ENTRY' ? (stockQty + qty) : (stockQty - qty);
    if (existingStock) {
      await DB.dbPut('stock', { ...existingStock, quantity: newQty, lastUpdated: Date.now() });
    } else {
      await DB.dbAdd('stock', { productId, quantity: newQty, reservedQuantity: 0, lastUpdated: Date.now() });
    }

    // Mettre à jour les lots associés
    let selectedLotId = document.getElementById('man-mov-lot-select')?.value;
    if (selectedLotId) {
      selectedLotId = parseInt(selectedLotId);
      const lotObj = await DB.dbGet('lots', selectedLotId);
      if (lotObj) {
        const nextLotQty = type === 'ENTRY' ? (lotObj.quantity + qty) : (lotObj.quantity - qty);
        await DB.dbPut('lots', { 
          ...lotObj, 
          quantity: Math.max(0, nextLotQty), 
          status: nextLotQty <= 0 ? 'depleted' : 'active',
          updatedAt: Date.now()
        });
      }
    } else if (type === 'EXIT') {
      // Stratégie FIFO par date d'expiration pour déduire les lots automatiquement
      const lots = await DB.dbGetAll('lots');
      const activeLots = lots.filter(l => l.productId === productId && l.status === 'active' && l.quantity > 0)
                            .sort((a,b) => new Date(a.expiryDate || 0) - new Date(b.expiryDate || 0));
      
      let remainingToDeduct = qty;
      for (const lot of activeLots) {
        if (remainingToDeduct <= 0) break;
        const toDeduct = Math.min(lot.quantity, remainingToDeduct);
        lot.quantity -= toDeduct;
        if (lot.quantity <= 0) lot.status = 'depleted';
        lot.updatedAt = Date.now();
        await DB.dbPut('lots', lot);
        remainingToDeduct -= toDeduct;
      }
    }

    // Enregistrer l'opération dans movements
    const movId = await DB.dbAdd('movements', {
      productId,
      type,
      subType: type === 'ENTRY' ? 'MANUAL_ENTRY' : 'MANUAL_EXIT',
      quantity: type === 'ENTRY' ? qty : -qty,
      date: new Date().toISOString(),
      userId: DB.AppState.currentUser?.id || null,
      note: formData.reason,
      supplier: type === 'ENTRY' ? (formData.supplier || '') : null,
      destination: type === 'EXIT' ? (formData.destination || '') : null,
      reference: formData.reference || '',
      observations: formData.observations || ''
    });

    // Écrire dans le journal d'audit
    await DB.writeAudit(type === 'ENTRY' ? 'MANUAL_STOCK_ENTRY' : 'MANUAL_STOCK_EXIT', 'movements', movId, {
      productId,
      quantity: qty,
      reason: formData.reason,
      reference: formData.reference || '',
      user: DB.AppState.currentUser?.name || DB.AppState.currentUser?.username
    });

    UI.closeModal();
    UI.toast('Mouvement enregistré avec succès', 'success');

    // Recharger la page
    if (typeof DB.syncToSupabase === 'function') DB.syncToSupabase();
    renderStockExits(document.getElementById('app-content'));

  } catch(err) {
    UI.toast('Erreur lors de l\'enregistrement : ' + err.message, 'error');
  }
}

async function showEditManualMovementForm(movId) {
  try {
    const movObj = await DB.dbGet('movements', movId);
    if (!movObj) return;

    const prod = window._manMovProductMap[movObj.productId];
    const type = movObj.type;
    
    const formHTML = `
      <form id="man-mov-edit-form" class="form-grid">
        <div class="form-group">
          <label>Médicament</label>
          <input type="text" class="form-control" value="${prod ? prod.name : 'Inconnu'}" disabled style="background:var(--bg-secondary)">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Quantité *</label>
            <input type="number" name="quantity" class="form-control" min="1" value="${Math.abs(movObj.quantity)}" required>
          </div>
          <div class="form-group">
            <label>Motif de modification *</label>
            <input type="text" id="edit-audit-reason" class="form-control" placeholder="Justification de la correction..." required>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Motif de l'opération *</label>
            <select name="reason" class="form-control" required>
              ${type === 'ENTRY' ? `
                <option value="Réajustement / Inventaire" ${movObj.note === 'Réajustement / Inventaire' ? 'selected' : ''}>Réajustement / Inventaire</option>
                <option value="Retour client" ${movObj.note === 'Retour client' ? 'selected' : ''}>Retour client</option>
                <option value="Don reçu" ${movObj.note === 'Don reçu' ? 'selected' : ''}>Don reçu</option>
                <option value="Autre" ${movObj.note === 'Autre' ? 'selected' : ''}>Autre</option>
              ` : `
                <option value="Périmé / Expire" ${movObj.note === 'Périmé / Expire' ? 'selected' : ''}>Périmé / Expire</option>
                <option value="Cassé / Endommagé" ${movObj.note === 'Cassé / Endommagé' ? 'selected' : ''}>Cassé / Endommagé</option>
                <option value="Perte" ${movObj.note === 'Perte' ? 'selected' : ''}>Perte</option>
                <option value="Don offert" ${movObj.note === 'Don offert' ? 'selected' : ''}>Don offert</option>
                <option value="Vol / Ecart stock" ${movObj.note === 'Vol / Ecart stock' ? 'selected' : ''}>Vol / Écart stock</option>
                <option value="Consommation interne" ${movObj.note === 'Consommation interne' ? 'selected' : ''}>Consommation interne</option>
                <option value="Autre" ${movObj.note === 'Autre' ? 'selected' : ''}>Autre</option>
              `}
            </select>
          </div>
          <div class="form-group">
            <label>${type === 'ENTRY' ? 'Fournisseur' : 'Destination'}</label>
            <input type="text" name="${type === 'ENTRY' ? 'supplier' : 'destination'}" class="form-control" 
              value="${type === 'ENTRY' ? (movObj.supplier || '') : (movObj.destination || '')}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Référence</label>
            <input type="text" name="reference" class="form-control" value="${movObj.reference || ''}">
          </div>
        </div>

        <div class="form-group">
          <label>Observations / Notes</label>
          <textarea name="observations" class="form-control" rows="2">${movObj.observations || ''}</textarea>
        </div>
      </form>
    `;

    UI.modal('<i data-lucide="edit-3" class="modal-icon-inline"></i> Modifier le Mouvement Manuel', formHTML, {
      footer: `
        <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
        <button class="btn btn-warning" onclick="submitEditManualMovement(${movId})"><i data-lucide="save"></i> Enregistrer les modifications</button>
      `
    });
    if (window.lucide) lucide.createIcons();

  } catch(err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function submitEditManualMovement(movId) {
  const form = document.getElementById('man-mov-edit-form');
  const auditReason = document.getElementById('edit-audit-reason')?.value?.trim();
  if (!form || !form.checkValidity()) { form?.reportValidity(); return; }
  if (!auditReason) { UI.toast('Veuillez saisir un motif de modification', 'warning'); return; }

  const formData = Object.fromEntries(new FormData(form));
  const newQty = parseInt(formData.quantity);
  if (newQty <= 0) { UI.toast('La quantité doit être supérieure à 0', 'warning'); return; }

  try {
    const movObj = await DB.dbGet('movements', movId);
    if (!movObj) return;

    const oldQty = Math.abs(movObj.quantity);
    const quantityDiff = newQty - oldQty;

    if (quantityDiff !== 0) {
      // Ajuster le stock global
      const stocks = await DB.dbGetAll('stock');
      const existingStock = stocks.find(s => s.productId === movObj.productId);
      if (existingStock) {
        const multiplier = movObj.type === 'ENTRY' ? 1 : -1;
        const updatedGlobalQty = existingStock.quantity + (quantityDiff * multiplier);
        await DB.dbPut('stock', { ...existingStock, quantity: updatedGlobalQty, lastUpdated: Date.now() });
      }
    }

    const updatedMovObj = {
      ...movObj,
      quantity: movObj.type === 'ENTRY' ? newQty : -newQty,
      note: formData.reason,
      supplier: movObj.type === 'ENTRY' ? (formData.supplier || '') : null,
      destination: movObj.type === 'EXIT' ? (formData.destination || '') : null,
      reference: formData.reference || '',
      observations: formData.observations || '',
      updatedAt: Date.now(),
      updatedBy: DB.AppState.currentUser?.id
    };

    await DB.dbPut('movements', updatedMovObj);

    // Enregistrer l'opération d'édition dans l'audit log
    await DB.writeAudit('MANUAL_MOVEMENT_EDIT', 'movements', movId, {
      oldQty,
      newQty,
      oldReason: movObj.note,
      newReason: formData.reason,
      oldObservations: movObj.observations || '',
      newObservations: formData.observations || '',
      auditReason,
      editedBy: DB.AppState.currentUser?.name || DB.AppState.currentUser?.username
    });

    UI.closeModal();
    UI.toast('Mouvement mis à jour et tracé dans l\'audit log', 'success');

    if (typeof DB.syncToSupabase === 'function') DB.syncToSupabase();
    renderStockExits(document.getElementById('app-content'));

  } catch(err) {
    UI.toast('Erreur de mise à jour : ' + err.message, 'error');
  }
}

function exportManualMovementsCSV() {
  const data = window._manMovFilteredData || [];
  if (data.length === 0) { UI.toast('Aucune donnée à exporter', 'warning'); return; }

  let csv = 'Date,Heure,Utilisateur,Medicament,Categorie,Type,Quantite,Motif,Reference,Fournisseur/Destination,Observations\n';
  data.forEach(m => {
    const d = new Date(m.date);
    const dateStr = d.toLocaleDateString('fr-FR');
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const user = window._manMovUserMap[m.userId] || 'Système';
    const prod = window._manMovProductMap[m.productId];
    const prodName = prod ? prod.name : 'Inconnu';
    const cat = prod ? prod.category || 'Non classé' : 'Non classé';
    const typeLabel = m.type === 'ENTRY' ? 'Entree' : 'Sortie';
    const qty = Math.abs(m.quantity);
    const reason = m.note || m.reason || '';
    const ref = m.reference || '';
    const flow = m.type === 'ENTRY' ? (m.supplier || '') : (m.destination || '');
    const obs = m.observations || '';

    csv += `"${dateStr}","${timeStr}","${user.replace(/"/g, '""')}","${prodName.replace(/"/g, '""')}","${cat.replace(/"/g, '""')}","${typeLabel}","${qty}","${reason.replace(/"/g, '""')}","${ref.replace(/"/g, '""')}","${flow.replace(/"/g, '""')}","${obs.replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Mouvements_Manuels_Stock_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportManualMovementsPDF() {
  const dataList = window._manMovFilteredData || [];
  if (dataList.length === 0) {
    return UI.toast("Aucune donnée à exporter", "warning");
  }
  if (!window.PDFExport) {
    return UI.toast("Module PDF non chargé", "error");
  }

  let totalEntries = 0;
  let totalExits = 0;

  const data = dataList.map(m => {
    const isEntry = m.type === 'ENTRY';
    const qty = Math.abs(m.quantity || 0);
    if (isEntry) totalEntries += qty;
    else totalExits += qty;

    const d = new Date(m.date);
    const dateStr = d.toLocaleDateString('fr-FR');
    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const user = window._manMovUserMap[m.userId] || 'Système';
    const prod = window._manMovProductMap[m.productId];
    const prodName = prod ? prod.name : 'Inconnu';
    const flow = isEntry ? (m.supplier || '—') : (m.destination || '—');

    return [
      dateStr + ' ' + timeStr,
      user,
      prodName,
      isEntry ? 'Entrée' : 'Sortie',
      (isEntry ? '+' : '-') + qty,
      m.note || m.reason || '—',
      flow,
      m.reference || '—'
    ];
  });

  const headers = ["Date & Heure", "Utilisateur", "Médicament", "Type", "Quantité", "Motif", "Fourn./Dest.", "Réf"];
  
  const fromDate = document.getElementById('mov-date-from')?.value;
  const toDate = document.getElementById('mov-date-to')?.value;
  const dateRangeStr = (fromDate && toDate) 
    ? `Période du ${new Date(fromDate).toLocaleDateString('fr-FR')} au ${new Date(toDate).toLocaleDateString('fr-FR')}`
    : '';

  window.PDFExport.generate(
    `Registre des Entrées et Sorties Manuelles de Stock`,
    headers,
    data,
    {
      subtitle: dateRangeStr || `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
      filename: `Registre_Mouvements_Manuels_${new Date().toISOString().split('T')[0]}.pdf`,
      footerText: `Total Entrées : ${totalEntries} | Total Sorties : ${totalExits}`
    }
  );
}

// Enregistrement dans le routeur global
Router.register('stock-exits', renderStockExits);

// Exposer globalement les fonctions déclenchées par l'UI
window.filterManualMovements = filterManualMovements;
window.showNewManualMovementForm = showNewManualMovementForm;
window.submitNewManualMovement = submitNewManualMovement;
window.showEditManualMovementForm = showEditManualMovementForm;
window.submitEditManualMovement = submitEditManualMovement;
window.exportManualMovementsCSV = exportManualMovementsCSV;
window.exportManualMovementsPDF = exportManualMovementsPDF;
