/**
 * OrdiveX — Module d'Inventaires Physiques Professionnel
 */

async function renderInventory(container) {
  UI.loading(container, 'Chargement de l\'espace inventaire...');

  // Récupérer les données requises
  const [products, stockAll, suppliers, invoices, inventories, users] = await Promise.all([
    DB.dbGetAll('products'),
    DB.dbGetAll('stock'),
    DB.dbGetAll('suppliers'),
    DB.dbGetAll('invoices'),
    DB.dbGetAll('inventories'),
    DB.dbGetAll('users')
  ]);

  // Dictionnaires et mappings utiles
  const stockMap = {};
  stockAll.forEach(s => { stockMap[s.productId] = s.quantity || 0; });

  const userMap = {};
  users.forEach(u => { userMap[u.id] = u.name || u.username; });

  const supplierMap = {};
  suppliers.forEach(s => { supplierMap[s.id] = s.name; });

  // Mapping de chaque produit vers son dernier fournisseur connu (via les factures d'achat) et son dernier prix d'achat
  const productSupplierMap = {};
  const productInvoicePriceMap = {};
  const sortedInvoices = [...invoices].sort((a, b) => new Date(a.date) - new Date(b.date));
  sortedInvoices.forEach(inv => {
    const sName = supplierMap[inv.supplierId] || inv.supplierName || 'Inconnu';
    if (inv.items && Array.isArray(inv.items)) {
      inv.items.forEach(it => {
        if (it.productId) {
          productSupplierMap[it.productId] = sName;
          if (it.purchasePrice || it.unitPrice || it.prixAchat) {
            productInvoicePriceMap[it.productId] = parseFloat(it.purchasePrice || it.unitPrice || it.prixAchat || 0);
          }
        }
      });
    }
  });

  // State global de la session courante dans la page
  const state = {
    view: 'history', // 'history', 'create', 'entry', 'validate', 'summary'
    products,
    stockMap,
    supplierMap,
    productSupplierMap,
    productInvoicePriceMap,
    userMap,
    inventories: inventories.sort((a, b) => new Date(b.datetime || 0) - new Date(a.datetime || 0)),
    
    // Config de l'inventaire en cours
    currentInventory: null,
    
    // Pagination & Selection
    selectedProductsMap: {},
    selectCurrentPage: 1
  };

  window._inventoryPageState = state;

  // Fonction de rendu principale
  const render = () => {
    if (state.view === 'history') {
      renderHistoryView(container);
    } else if (state.view === 'create') {
      renderCreateView(container);
    } else if (state.view === 'entry') {
      renderEntryView(container);
    } else if (state.view === 'validate') {
      renderValidateView(container);
    } else if (state.view === 'summary') {
      renderSummaryView(container);
    }
  };

  window.reloadInventoryHistory = async function() {
    const [invs, stockAll] = await Promise.all([
      DB.dbGetAll('inventories'),
      DB.dbGetAll('stock')
    ]);
    state.inventories = invs.sort((a, b) => new Date(b.datetime || 0) - new Date(a.datetime || 0));
    state.stockMap = {};
    stockAll.forEach(s => { state.stockMap[s.productId] = s.quantity || 0; });
  };

  window._refreshInventoryDOM = render;
  render();
}

// ═══════════════════════════════════════════════════════════════════
// VUE : HISTORIQUE DES INVENTAIRES
// ═══════════════════════════════════════════════════════════════════
function renderHistoryView(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Inventaires Physiques</h1>
        <p class="page-subtitle">Réalisez des inventaires complets ou ciblés et pilotez les ajustements de stock</p>
      </div>
      <div class="header-actions">
        ${Auth.can('inventory_create') ? `<button class="btn btn-primary" onclick="_inventoryPageState.view = 'create'; _refreshInventoryDOM();">
          <i data-lucide="plus-circle"></i> Nouvel Inventaire
        </button>` : ''}
      </div>
    </div>

    <div class="settings-card2" style="margin-top: 10px;">
      <h3 class="settings-card2-title"><i data-lucide="history"></i> Historique des Inventaires</h3>
      <div class="table-wrapper">
        <table class="data-table" id="inventory-history-table">
          <thead>
            <tr>
              <th>Date & Heure</th>
              <th>Utilisateur</th>
              <th>Périmètre / Type</th>
              <th>Détails Périmètre</th>
              <th class="ta-c">Produits</th>
              <th class="ta-c">Écarts</th>
              <th class="ta-r">Valeur Écarts (Achat)</th>
              <th class="ta-c">Statut Stock</th>
              <th class="ta-r" style="width: 130px;">Actions</th>
            </tr>
          </thead>
          <tbody id="history-inventory-tbody">
            <!-- Rendu via renderHistoryPage() -->
          </tbody>
        </table>
      </div>
      <div id="history-pagination" style="margin-top:12px"></div>
    </div>
  `;

  window.renderHistoryPage(1);
  if (window.lucide) lucide.createIcons();
}

window.renderHistoryPage = function(page = 1) {
  const state = window._inventoryPageState;
  state.historyCurrentPage = page;
  const list = state.inventories || [];
  const PAGE_SIZE = 15;
  const totalPages = Math.ceil(list.length / PAGE_SIZE) || 1;
  const p = Math.max(1, Math.min(page, totalPages));
  const start = (p - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById('history-inventory-tbody');
  if (!tbody) return;

  tbody.innerHTML = pageItems.map(inv => {
    const dt = new Date(inv.datetime || inv.date);
    const dateStr = dt.toLocaleDateString('fr-FR');
    const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const valClass = inv.gapsValue === 0 ? 'text-success' : inv.gapsValue > 0 ? 'text-info' : 'text-danger';
    
    let statusBadge = '';
    if (inv.status === 'validated_adjusted') {
      statusBadge = '<span class="badge badge-success">Ajusté</span>';
    } else {
      statusBadge = '<span class="badge badge-neutral">Analyse seule</span>';
    }

    return `
      <tr>
        <td><strong>${dateStr}</strong> à ${timeStr}</td>
        <td>${state.userMap[inv.userId] || 'Inconnu'}</td>
        <td><span class="badge badge-info">${formatScopeType(inv.type)}</span></td>
        <td><span class="text-muted text-sm">${inv.scope || 'Tous'}</span></td>
        <td class="ta-c"><strong>${inv.productsCount}</strong></td>
        <td class="ta-c">
          <span class="badge ${inv.gapsCount > 0 ? 'badge-warning' : 'badge-success'}">${inv.gapsCount}</span>
        </td>
        <td class="ta-r ${valClass}"><strong>${UI.formatCurrency(inv.gapsValue)}</strong></td>
        <td class="ta-c">${statusBadge}</td>
        <td class="ta-r">
          <div style="display: flex; gap: 4px; justify-content: flex-end;">
            <button class="btn btn-xs btn-secondary" onclick="viewInventoryDetails(${inv.id})" title="Consulter"><i data-lucide="eye"></i></button>
            <button class="btn btn-xs btn-secondary" onclick="exportPastInventoryPDF(${inv.id})" title="PDF"><i data-lucide="printer"></i></button>
            <button class="btn btn-xs btn-secondary" onclick="exportPastInventoryCSV(${inv.id})" title="CSV"><i data-lucide="download"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="ta-c text-muted">Aucun inventaire enregistré dans l\'historique.</td></tr>';
  }

  const pagination = document.getElementById('history-pagination');
  if (pagination) {
    pagination.innerHTML = totalPages > 1 ? `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:13px; color:var(--text-muted)">${list.length} inventaires au total</span>
        <div style="display:flex; gap:8px">
          <button type="button" class="btn btn-sm btn-secondary" onclick="window.renderHistoryPage(${p - 1})" ${p === 1 ? 'disabled' : ''}>Précédent</button>
          <span style="font-size:13px; padding:4px 8px">Page ${p} / ${totalPages}</span>
          <button type="button" class="btn btn-sm btn-secondary" onclick="window.renderHistoryPage(${p + 1})" ${p === totalPages ? 'disabled' : ''}>Suivant</button>
        </div>
      </div>
    ` : '';
  }
};

function formatScopeType(type) {
  const dict = {
    all: 'Complet',
    form: 'Par Forme',
    category: 'Par Catégorie',
    supplier: 'Par Fournisseur',
    family: 'Par Famille',
    selection: 'Sélection Libre'
  };
  return dict[type] || type;
}

// ═══════════════════════════════════════════════════════════════════
// VUE : CRÉATION / SÉLECTION DU PÉRIMÈTRE
// ═══════════════════════════════════════════════════════════════════
function renderCreateView(container) {
  const state = window._inventoryPageState;

  // Extraire les options uniques des produits pour les filtres
  // Accepter les produits actifs OU ceux sans champ status défini
  const isActive = p => p.status === 'active' || !p.status;
  const forms = [...new Set(state.products.filter(p => isActive(p) && p.form).map(p => p.form))].sort();
  const categories = [...new Set(state.products.filter(p => isActive(p) && p.category).map(p => p.category))].sort();
  
  // Extraire les fournisseurs représentés
  const supplierIds = [...new Set(state.products.filter(p => isActive(p) && p.supplierId).map(p => p.supplierId))];
  const suppliersWithProducts = supplierIds.map(id => ({ id, name: state.supplierMap[id] || `Fournisseur ID ${id}` })).sort((a,b)=>a.name.localeCompare(b.name));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Nouvel Inventaire</h1>
        <p class="page-subtitle">Choisissez le périmètre des produits à compter physiquement</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="window.reloadInventoryHistory().then(() => { _inventoryPageState.view = 'history'; _refreshInventoryDOM(); })">
          <i data-lucide="arrow-left"></i> Retour à l'historique
        </button>
      </div>
    </div>

    <div class="settings-card2" style="max-width: 680px; margin: 10px auto 0 auto;">
      <h3 class="settings-card2-title"><i data-lucide="filter"></i> Configuration du périmètre</h3>
      <form id="inventory-scope-form" class="form-grid" onsubmit="startInventorySetup(event)">
        <div class="form-group">
          <label>Périmètre de l'inventaire</label>
          <select id="inv-scope-type" class="form-control" onchange="toggleScopeInputs(this.value)" required>
            <option value="all">Inventaire complet de la pharmacie</option>
            <option value="form">Inventaire par Forme Pharmaceutique</option>
            <option value="category">Inventaire par Catégorie de produit</option>
            <option value="supplier">Inventaire par Fournisseur</option>
            <option value="family">Inventaire par Famille Thérapeutique</option>
            <option value="selection">Sélection manuelle et ciblée de produits</option>
          </select>
        </div>

        <!-- Inputs dynamiques selon le périmètre -->
        <div class="form-group" id="group-scope-form" style="display: none;">
          <label>Choisissez la Forme Pharmaceutique</label>
          <input type="text" id="select-scope-form" class="form-control" list="dl-scope-form" placeholder="Tapez pour rechercher une forme...">
          <datalist id="dl-scope-form">
            ${forms.map(f => `<option value="${f}">`).join('')}
          </datalist>
        </div>

        <div class="form-group" id="group-scope-category" style="display: none;">
          <label>Choisissez la Catégorie</label>
          <input type="text" id="select-scope-category" class="form-control" list="dl-scope-category" placeholder="Tapez pour rechercher une catégorie...">
          <datalist id="dl-scope-category">
            ${categories.map(c => `<option value="${c}">`).join('')}
          </datalist>
        </div>

        <div class="form-group" id="group-scope-supplier" style="display: none;">
          <label>Choisissez le Fournisseur</label>
          <input type="text" id="select-scope-supplier" class="form-control" list="dl-scope-supplier" placeholder="Tapez pour rechercher un fournisseur...">
          <datalist id="dl-scope-supplier">
            ${suppliersWithProducts.map(s => `<option value="${s.name}" data-id="${s.id}">`).join('')}
          </datalist>
        </div>

        <div class="form-group" id="group-scope-family" style="display: none;">
          <label>Famille Thérapeutique / Classe</label>
          <input type="text" id="select-scope-family" class="form-control" list="dl-scope-family" placeholder="Tapez pour rechercher une famille...">
          <datalist id="dl-scope-family">
            ${categories.map(c => `<option value="${c}">`).join('')}
          </datalist>
        </div>

        <!-- Sélection manuelle de produits -->
        <div class="form-group" id="group-scope-selection" style="display: none;">
          <label style="margin-bottom:8px; display:block">Sélectionnez les produits concernés</label>
          <input type="text" id="selection-search" placeholder="Recherche rapide..." class="form-control" style="margin-bottom:10px" oninput="window.renderSelectionPage(1)">
          <div class="table-wrapper" style="border: 1px solid var(--border); border-radius: 8px; padding: 8px;">
            <div id="selection-checkbox-container" style="display:flex; flex-direction:column; gap:8px;">
              <!-- Rendu via renderSelectionPage() -->
            </div>
          </div>
        </div>

        <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
          <button type="submit" class="btn btn-primary"><i data-lucide="play"></i> Démarrer la saisie</button>
        </div>
      </form>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
  
  // Initialiser la map de sélection et rendre la première page
  window._inventoryPageState.selectedProductsMap = {};
  window.renderSelectionPage(1);
}

window.toggleScopeInputs = function(type) {
  document.getElementById('group-scope-form').style.display = type === 'form' ? 'block' : 'none';
  document.getElementById('group-scope-category').style.display = type === 'category' ? 'block' : 'none';
  document.getElementById('group-scope-supplier').style.display = type === 'supplier' ? 'block' : 'none';
  document.getElementById('group-scope-family').style.display = type === 'family' ? 'block' : 'none';
  document.getElementById('group-scope-selection').style.display = type === 'selection' ? 'block' : 'none';
};

window.renderSelectionPage = function(page = 1) {
  const state = window._inventoryPageState;
  state.selectCurrentPage = page;
  const PAGE_SIZE = 50;
  
  const query = (document.getElementById('selection-search')?.value || '').toLowerCase();
  const allActive = state.products.filter(p => p.status === 'active' || !p.status);
  const filtered = allActive.filter(p => !query || p.name.toLowerCase().includes(query) || (p.code||'').toLowerCase().includes(query));
  
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const p = Math.max(1, Math.min(page, totalPages));
  const start = (p - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  
  const container = document.getElementById('selection-checkbox-container');
  if (!container) return;
  
  let html = pageItems.map(prod => `
    <label style="display:flex; align-items:center; gap:8px; font-size:13px; cursor:pointer">
      <input type="checkbox" value="${prod.id}" class="selected-product-cb" ${state.selectedProductsMap[prod.id] ? 'checked' : ''} onchange="window._inventoryPageState.selectedProductsMap[${prod.id}] = this.checked;">
      <span><code>${prod.code || 'N/A'}</code> — <strong>${prod.name}</strong></span>
    </label>
  `).join('');
  
  if (totalPages > 1) {
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid var(--border)">
        <span style="font-size:12px; color:var(--text-muted)">${filtered.length} produits trouvés</span>
        <div style="display:flex; gap:8px">
          <button type="button" class="btn btn-sm btn-secondary" onclick="window.renderSelectionPage(${p - 1})" ${p === 1 ? 'disabled' : ''}>Précédent</button>
          <span style="font-size:13px; padding:4px 8px">${p} / ${totalPages}</span>
          <button type="button" class="btn btn-sm btn-secondary" onclick="window.renderSelectionPage(${p + 1})" ${p === totalPages ? 'disabled' : ''}>Suivant</button>
        </div>
      </div>
    `;
  } else if (filtered.length === 0) {
    html += `<div class="empty-state" style="padding:20px; font-size:13px">Aucun produit trouvé.</div>`;
  }
  
  container.innerHTML = html;
};

function startInventorySetup(event) {
  event.preventDefault();
  const state = window._inventoryPageState;
  const type = document.getElementById('inv-scope-type').value;

  let filtered = [];
  let scopeLabel = '';
  const isActive = p => p.status === 'active' || !p.status;

  if (type === 'all') {
    filtered = state.products.filter(p => isActive(p));
    scopeLabel = 'Pharmacie Complète';
  } else if (type === 'form') {
    const val = document.getElementById('select-scope-form').value;
    if (!val) return UI.toast('Veuillez saisir une forme pharmaceutique', 'warning');
    filtered = state.products.filter(p => isActive(p) && p.form === val);
    scopeLabel = `Forme : ${val}`;
  } else if (type === 'category') {
    const val = document.getElementById('select-scope-category').value;
    if (!val) return UI.toast('Veuillez saisir une catégorie', 'warning');
    filtered = state.products.filter(p => isActive(p) && p.category === val);
    scopeLabel = `Catégorie : ${val}`;
  } else if (type === 'family') {
    const val = document.getElementById('select-scope-family').value;
    if (!val) return UI.toast('Veuillez saisir une famille thérapeutique', 'warning');
    filtered = state.products.filter(p => isActive(p) && p.category === val);
    scopeLabel = `Famille : ${val}`;
  } else if (type === 'supplier') {
    const supName = document.getElementById('select-scope-supplier').value;
    if (!supName) return UI.toast('Veuillez saisir un fournisseur', 'warning');
    // Trouver l'ID du fournisseur à partir de son nom
    const supId = Object.keys(state.supplierMap).find(id => state.supplierMap[id] === supName);
    if (supId) {
      filtered = state.products.filter(p => isActive(p) && p.supplierId === parseInt(supId));
    } else {
      // Fallback : filtrer par le productSupplierMap
      filtered = state.products.filter(p => isActive(p) && state.productSupplierMap[p.id] === supName);
    }
    scopeLabel = `Fournisseur : ${supName}`;
  } else if (type === 'selection') {
    const checkedIds = Object.keys(state.selectedProductsMap).filter(id => state.selectedProductsMap[id]).map(Number);
    if (!checkedIds.length) {
      return UI.toast('Veuillez sélectionner au moins un produit', 'warning');
    }
    filtered = state.products.filter(p => isActive(p) && checkedIds.includes(p.id));
    scopeLabel = `${checkedIds.length} produit(s) sélectionné(s)`;
  }

  if (filtered.length === 0) {
    return UI.toast('Aucun produit actif ne correspond à ce périmètre', 'warning');
  }

  // Trier par ordre alphabétique
  filtered.sort((a,b) => (a.name||'').localeCompare(b.name||''));

  // Construire l'objet de session d'inventaire temporaire
  state.currentInventory = {
    type,
    scope: scopeLabel,
    products: filtered.map(p => {
      const theory = state.stockMap[p.id] || 0;
      return {
        id: p.id,
        code: p.code || 'N/A',
        name: p.name,
        form: p.form || '—',
        category: p.category || '—',
        purchasePrice: parseFloat(p.purchasePrice || p.prixAchat || state.productInvoicePriceMap[p.id] || 0),
        supplierName: state.productSupplierMap[p.id] || 'Aucun d\'achat',
        systemQty: theory,
        physicalQty: theory, // Initialisé à la qté théorique pour simplifier
        gap: 0,
        gapValue: 0,
        observation: ''
      };
    })
  };

  state.view = 'entry';
  _refreshInventoryDOM();
}

// ═══════════════════════════════════════════════════════════════════
// VUE : TABLE DE SAISIE DE L'INVENTAIRE
// ═══════════════════════════════════════════════════════════════════
function renderEntryView(container) {
  const state = window._inventoryPageState;
  const inv = state.currentInventory;
  const items = inv.products;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Saisie de l'Inventaire</h1>
        <p class="page-subtitle">Saisissez les stocks physiques constatés. Les écarts se calculent en temps réel.</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="cancelInventorySession()"><i data-lucide="x"></i> Annuler</button>
        <button class="btn btn-primary" onclick="proceedToValidation()"><i data-lucide="check-square"></i> Valider l'inventaire</button>
      </div>
    </div>

    <div class="settings-card2" style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap:10px;">
      <div style="font-size: 13px;">
        <strong>Périmètre :</strong> <span class="badge badge-info">${formatScopeType(inv.type)}</span> (${inv.scope})
      </div>
      <div style="font-size: 13px;">
        <strong>Écarts :</strong> <span id="entry-kpi-gaps" class="badge badge-warning">0</span> sur <strong>${items.length}</strong> produits
      </div>
    </div>

    <!-- Barre de recherche rapide de saisie -->
    <div class="filter-bar" style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <input type="text" id="entry-search" placeholder="Filtrer rapidement par nom ou code..." class="filter-input" oninput="window.renderEntryPage(1)" style="flex:1; max-width:400px;">
      <div id="entry-pagination-top" style="font-size:13px; color:var(--text-muted);"></div>
    </div>

    <div class="settings-card2">
      <div class="table-wrapper" style="border: 1px solid var(--border); border-radius: 8px; overflow-x: auto;">
        <table class="data-table" id="entry-inventory-table">
          <thead>
            <tr>
              <th style="min-width:90px;">Code</th>
              <th style="min-width:200px;">Médicament</th>
              <th style="min-width:100px;">Forme</th>
              <th style="min-width:120px;">Catégorie</th>
              <th style="min-width:150px;">Dernier Fournisseur</th>
              <th class="ta-c" style="min-width:100px;">Stock Théorique</th>
              <th class="ta-c" style="min-width:110px; width:110px;">Stock Physique</th>
              <th class="ta-c" style="min-width:80px;">Écart</th>
              <th class="ta-r" style="min-width:110px;">Valeur Écart</th>
              <th style="min-width:150px;">Observation</th>
            </tr>
          </thead>
          <tbody id="entry-inventory-tbody">
            <!-- Rendu via renderEntryPage() -->
          </tbody>
        </table>
      </div>
      <div id="entry-pagination-bottom" style="margin-top:12px"></div>
    </div>
  `;

  state.entryCurrentPage = 1;
  window.renderEntryPage(1);

  if (window.lucide) lucide.createIcons();
}

window.renderEntryPage = function(page = 1) {
  const state = window._inventoryPageState;
  state.entryCurrentPage = page;
  const items = state.currentInventory.products;
  const PAGE_SIZE = 50;

  const query = (document.getElementById('entry-search')?.value || '').toLowerCase();
  const filtered = items.filter(it => !query || it.name.toLowerCase().includes(query) || (it.code||'').toLowerCase().includes(query));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const p = Math.max(1, Math.min(page, totalPages));
  const start = (p - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById('entry-inventory-tbody');
  if (!tbody) return;

  tbody.innerHTML = pageItems.map(it => `
    <tr class="entry-row">
      <td><code class="code-tag">${it.code || 'N/A'}</code></td>
      <td><strong>${it.name}</strong></td>
      <td class="text-sm text-muted">${it.form || ''}</td>
      <td><span class="category-tag">${it.category || ''}</span></td>
      <td class="text-sm text-muted">${it.supplierName || ''}</td>
      <td class="ta-c"><strong>${it.systemQty}</strong></td>
      <td class="ta-c">
        <input type="number" class="form-control ta-c" id="phys-qty-${it.id}" value="${it.physicalQty}" min="0" style="width: 80px; font-weight: 700;"
          oninput="onPhysicalQtyChange(${it.id}, this.value)">
      </td>
      <td class="ta-c" id="phys-gap-cell-${it.id}"><span class="badge badge-success">0</span></td>
      <td class="ta-r" id="phys-val-cell-${it.id}" style="font-weight:600;">0 GNF</td>
      <td>
        <input type="text" class="form-control" placeholder="Obs..." id="phys-obs-${it.id}" value="${it.observation || ''}" style="width: 140px;"
          oninput="onObservationChange(${it.id}, this.value)">
      </td>
    </tr>
  `).join('');

  // Re-calculer visuellement les écarts pour les lignes rendues
  pageItems.forEach(it => {
    onPhysicalQtyChange(it.id, it.physicalQty, false);
  });
  updateEntryGapsKPI();

  // Mettre à jour la pagination
  const pagHtml = totalPages > 1 ? `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:13px; color:var(--text-muted)">${filtered.length} produits trouvés</span>
      <div style="display:flex; gap:8px">
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.renderEntryPage(${p - 1})" ${p === 1 ? 'disabled' : ''}>Précédent</button>
        <span style="font-size:13px; padding:4px 8px">Page ${p} / ${totalPages}</span>
        <button type="button" class="btn btn-sm btn-secondary" onclick="window.renderEntryPage(${p + 1})" ${p === totalPages ? 'disabled' : ''}>Suivant</button>
      </div>
    </div>
  ` : '';
  
  const bottomPag = document.getElementById('entry-pagination-bottom');
  if (bottomPag) bottomPag.innerHTML = pagHtml;
  
  const topPag = document.getElementById('entry-pagination-top');
  if (topPag) topPag.innerHTML = totalPages > 1 ? `Page ${p}/${totalPages}` : '';
};

// Obsolete
window.filterEntryTable = function(q) {
  window.renderEntryPage(1);
};

window.onPhysicalQtyChange = function(itemId, val, shouldUpdateKPI = true) {
  const state = window._inventoryPageState;
  const it = state.currentInventory.products.find(p => p.id === itemId);
  if (!it) return;

  const physical = parseInt(val) || 0;
  it.physicalQty = physical;
  it.gap = physical - it.systemQty;
  it.gapValue = it.gap * it.purchasePrice;

  // Mettre à jour l'affichage de l'écart
  const gapCell = document.getElementById(`phys-gap-cell-${itemId}`);
  if (gapCell) {
    if (it.gap === 0) {
      gapCell.innerHTML = `<span class="badge badge-success">0</span>`;
    } else {
      const cls = it.gap > 0 ? 'badge-info' : 'badge-danger';
      const prefix = it.gap > 0 ? '+' : '';
      gapCell.innerHTML = `<span class="badge ${cls}">${prefix}${it.gap}</span>`;
    }
  }

  // Mettre à jour la valeur financière
  const valCell = document.getElementById(`phys-val-cell-${itemId}`);
  if (valCell) {
    valCell.className = it.gap === 0 ? '' : it.gap > 0 ? 'text-info' : 'text-danger';
    valCell.textContent = (it.gap > 0 ? '+' : '') + UI.formatCurrency(it.gapValue);
  }

  if (shouldUpdateKPI) {
    updateEntryGapsKPI();
  }
};

window.onObservationChange = function(itemId, val) {
  const state = window._inventoryPageState;
  const it = state.currentInventory.products.find(p => p.id === itemId);
  if (it) {
    it.observation = val;
  }
};

function updateEntryGapsKPI() {
  const state = window._inventoryPageState;
  const totalGaps = state.currentInventory.products.filter(p => p.gap !== 0).length;
  const el = document.getElementById('entry-kpi-gaps');
  if (el) {
    el.textContent = totalGaps;
    el.className = `badge ${totalGaps > 0 ? 'badge-warning' : 'badge-success'}`;
  }
}

window.cancelInventorySession = async function() {
  const ok = await UI.confirm("Êtes-vous sûr de vouloir annuler l'inventaire en cours ? Toutes les saisies seront perdues.");
  if (!ok) return;

  window._inventoryPageState.currentInventory = null;
  window._inventoryPageState.view = 'history';
  if (window.reloadInventoryHistory) await window.reloadInventoryHistory();
  _refreshInventoryDOM();
};

function proceedToValidation() {
  const state = window._inventoryPageState;
  
  // S'assurer que le calcul des écarts est complet
  state.currentInventory.gaps = state.currentInventory.products.filter(p => p.gap !== 0);
  
  state.view = 'validate';
  _refreshInventoryDOM();
}

// ═══════════════════════════════════════════════════════════════════
// VUE : VALIDATION ET CHOIX DES AJUSTEMENTS
// ═══════════════════════════════════════════════════════════════════
function renderValidateView(container) {
  const state = window._inventoryPageState;
  const inv = state.currentInventory;
  const gaps = inv.gaps;

  // Calculs financiers
  const totalGapsCount = gaps.length;
  let totalPositiveValue = 0;
  let totalNegativeValue = 0;
  let netImpact = 0;

  gaps.forEach(g => {
    if (g.gap > 0) totalPositiveValue += g.gapValue;
    else totalNegativeValue += g.gapValue;
    netImpact += g.gapValue;
  });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Validation de l'Inventaire</h1>
        <p class="page-subtitle">Vérifiez les écarts avant d'enregistrer et de choisir le mode d'ajustement</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="_inventoryPageState.view = 'entry'; _refreshInventoryDOM();">
          <i data-lucide="arrow-left"></i> Retourner à la saisie
        </button>
      </div>
    </div>

    <div class="settings-2col">
      <!-- Résumé Général -->
      <div class="settings-card2">
        <h3 class="settings-card2-title"><i data-lucide="info"></i> Résumé Financier des Écarts</h3>
        
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 20px;">
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border); padding-bottom:8px">
            <span class="text-muted">Périmètre inventorié :</span>
            <strong>${inv.scope}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border); padding-bottom:8px">
            <span class="text-muted">Total produits comptés :</span>
            <strong>${inv.products.length}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border); padding-bottom:8px">
            <span class="text-muted">Nombre de lignes en écart :</span>
            <span class="badge ${totalGapsCount > 0 ? 'badge-warning' : 'badge-success'}">${totalGapsCount}</span>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border); padding-bottom:8px">
            <span class="text-muted">Excédents (+) :</span>
            <strong class="text-info">${UI.formatCurrency(totalPositiveValue)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; border-bottom:1px dashed var(--border); padding-bottom:8px">
            <span class="text-muted">Déficits (-) :</span>
            <strong class="text-danger">${UI.formatCurrency(totalNegativeValue)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:10px 0; background:var(--bg-secondary); border-radius:8px; padding:12px;">
            <span style="font-weight:700">Impact Financier Net :</span>
            <strong class="${netImpact >= 0 ? 'text-success' : 'text-danger'}" style="font-size:16px">${netImpact >= 0 ? '+' : ''}${UI.formatCurrency(netImpact)}</strong>
          </div>
        </div>

        <!-- Mode de validation -->
        <h3 class="settings-card2-title" style="border:none; margin-top:20px; padding-bottom:0;"><i data-lucide="settings"></i> Option d'ajustement du stock</h3>
        
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 24px;">
          <label style="display:flex; gap:10px; cursor:pointer; padding:14px; border:1px solid var(--border); border-radius:10px; background:var(--surface)" class="adj-option">
            <input type="radio" name="adjust_option" value="apply" checked style="margin-top:3px">
            <div>
              <strong style="display:block; font-size:14px">Appliquer automatiquement les ajustements</strong>
              <span style="font-size:12px; color:var(--text-muted)">Le stock théorique actuel sera mis à jour en base pour correspondre exactement à votre stock physique saisi.</span>
            </div>
          </label>

          <label style="display:flex; gap:10px; cursor:pointer; padding:14px; border:1px solid var(--border); border-radius:10px; background:var(--surface)" class="adj-option">
            <input type="radio" name="adjust_option" value="analyze" style="margin-top:3px">
            <div>
              <strong style="display:block; font-size:14px">Conserver les écarts sans modifier le stock (Analyse seule)</strong>
              <span style="font-size:12px; color:var(--text-muted)">Les écarts seront enregistrés dans le rapport historique d'inventaire, mais aucun changement ne sera fait sur les quantités réelles en stock.</span>
            </div>
          </label>
        </div>

        <div style="display:flex; gap:10px">
          <button class="btn btn-secondary" onclick="cancelInventorySession()"><i data-lucide="trash-2"></i> Annuler tout</button>
          <button class="btn btn-primary" onclick="confirmValidation()"><i data-lucide="check-circle-2"></i> Confirmer & Finaliser</button>
        </div>
      </div>

      <!-- Liste détaillée des écarts -->
      <div class="settings-card2">
        <h3 class="settings-card2-title"><i data-lucide="alert-triangle"></i> Écarts Détectés (${totalGapsCount})</h3>
        <div class="table-wrapper" style="max-height: 50vh; overflow-y:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Médicament</th>
                <th class="ta-c">Théorique</th>
                <th class="ta-c">Physique</th>
                <th class="ta-c">Écart</th>
                <th class="ta-r">Valeur</th>
              </tr>
            </thead>
            <tbody>
              ${gaps.map(g => `
                <tr>
                  <td><strong>${g.name}</strong></td>
                  <td class="ta-c text-muted">${g.systemQty}</td>
                  <td class="ta-c"><strong>${g.physicalQty}</strong></td>
                  <td class="ta-c">
                    <span class="badge ${g.gap > 0 ? 'badge-info' : 'badge-danger'}">${g.gap > 0 ? '+' : ''}${g.gap}</span>
                  </td>
                  <td class="ta-r ${g.gap > 0 ? 'text-info' : 'text-danger'}"><strong>${UI.formatCurrency(g.gapValue)}</strong></td>
                </tr>
              `).join('')}
              ${gaps.length === 0 ? '<tr><td colspan="5" class="ta-c text-success">Aucun écart détecté — Le stock théorique correspond à 100% au stock physique.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

async function confirmValidation() {
  const state = window._inventoryPageState;
  const inv = state.currentInventory;
  const gaps = inv.gaps;
  
  const adjustOption = document.querySelector('input[name="adjust_option"]:checked')?.value || 'apply';
  const shouldAdjust = adjustOption === 'apply';

  UI.showLoader('Enregistrement de l\'inventaire...');

  try {
    const timestamp = Date.now();
    const isoStr = new Date(timestamp).toISOString();
    const dateStr = isoStr.split('T')[0];

    // 1. Calculer les statistiques globales
    const totalGapsCount = gaps.length;
    const netGapsValue = gaps.reduce((sum, g) => sum + g.gapValue, 0);

    // 2. Mettre à jour les stocks et enregistrer les ajustements si l'option est activée
    const dbAdjustments = [];
    const dbMovements = [];
    
    if (shouldAdjust && totalGapsCount > 0) {
      const stockAll = await DB.dbGetAll('stock');
      const allLots = await DB.dbGetAll('lots');

      for (const g of gaps) {
        const existingStock = stockAll.find(s => s.productId === g.id);

        // Mettre à jour IndexedDB stock
        if (existingStock) {
          await DB.dbPut('stock', { ...existingStock, quantity: g.physicalQty });
        } else {
          await DB.dbAdd('stock', { productId: g.id, quantity: g.physicalQty, reservedQuantity: 0 });
        }

        // Répercuter l'écart sur les lots (rayon d'abord, réserve en dernier
        // recours pour une baisse) — sans cela, le total agrégé change mais
        // aucun lot ne reflète la quantité réelle, rendant le produit
        // invisible en rayon ET en réserve au POS après l'inventaire.
        if (g.gap > 0) {
          const rayonLot = allLots.find(l => l.productId === g.id && l.status === 'active' && (!l.location || l.location === 'rayon'));
          if (rayonLot) {
            rayonLot.quantity = (rayonLot.quantity || 0) + g.gap;
            await DB.dbPut('lots', rayonLot);
          } else {
            const newLotId = await DB.dbAdd('lots', {
              productId: g.id,
              lotNumber: 'INV-' + dateStr + '-' + g.id,
              expiryDate: null,
              quantity: g.gap,
              initialQuantity: g.gap,
              location: 'rayon',
              status: 'active',
            });
            allLots.push({ id: newLotId, productId: g.id, quantity: g.gap, status: 'active', location: 'rayon' });
          }
        } else if (g.gap < 0) {
          let rem = Math.abs(g.gap);
          const productLots = allLots
            .filter(l => l.productId === g.id && l.status === 'active')
            .sort((a, b) => (a.location === 'reserve' ? 1 : 0) - (b.location === 'reserve' ? 1 : 0));
          for (const lot of productLots) {
            if (rem <= 0) break;
            const take = Math.min(rem, lot.quantity || 0);
            if (take <= 0) continue;
            lot.quantity = (lot.quantity || 0) - take;
            rem -= take;
            await DB.dbPut('lots', lot);
          }
        }

        // Préparer l'objet mouvement standard
        dbMovements.push({
          id: await DB._generateSyncSafeId(), // id sync-safe : évite les collisions inter-appareils (Lot 1 hardening)
          productId: g.id,
          type: g.gap > 0 ? 'ENTRY' : 'EXIT',
          subType: 'INVENTORY_ADJUSTMENT',
          quantity: g.gap,
          date: isoStr,
          userId: DB.AppState.currentUser?.id,
          reference: 'INVENTAIRE-' + dateStr,
          note: `Ajustement inventaire : ${g.observation || 'Écart constaté'}`
        });

        // Préparer l'ajustement détaillé
        dbAdjustments.push({
          date: dateStr,
          time: new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          userId: DB.AppState.currentUser?.id,
          productId: g.id,
          oldQty: g.systemQty,
          newQty: g.physicalQty,
          gap: g.gap,
          reason: g.observation || 'Inventaire de stock',
          // L'ID d'inventaire sera lié juste après
        });
      }

      // Enregistrer les mouvements
      for (const mov of dbMovements) {
        await DB.dbAdd('movements', mov);
      }
    }

    // 3. Enregistrer la fiche d'inventaire
    const newInventoryDoc = {
      date: dateStr,
      datetime: isoStr,
      userId: DB.AppState.currentUser?.id,
      type: inv.type,
      scope: inv.scope,
      productsCount: inv.products.length,
      gapsCount: totalGapsCount,
      gapsValue: netGapsValue,
      status: shouldAdjust ? 'validated_adjusted' : 'validated_only',
      items: inv.products.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        form: p.form,
        category: p.category,
        supplierName: p.supplierName,
        systemQty: p.systemQty,
        physicalQty: p.physicalQty,
        gap: p.gap,
        gapValue: p.gapValue,
        observation: p.observation
      }))
    };

    const savedInventoryId = await DB.dbAdd('inventories', newInventoryDoc);

    // Relier et sauvegarder les ajustements individuels
    if (shouldAdjust && dbAdjustments.length > 0) {
      for (const adj of dbAdjustments) {
        adj.inventoryId = savedInventoryId;
        await DB.dbAdd('inventoryAdjustments', adj);
      }
    }

    // Écrire dans le journal d'audit
    await DB.writeAudit('INVENTORY_VALIDATED', 'stock', savedInventoryId, {
      scope: inv.scope,
      adjusted: shouldAdjust,
      gaps: totalGapsCount,
      netValue: netGapsValue
    });

    // ⚡ Déclencher la synchronisation en tâche de fond
    if (navigator.onLine && typeof DB.syncToSupabase === 'function') {
      DB.syncToSupabase().catch(() => {});
    }

    UI.hideLoader();
    UI.toast("L'inventaire a été validé avec succès !", "success");

    // Stocker la fiche validée en state pour l'écran de synthèse final
    state.lastSavedInventory = {
      ...newInventoryDoc,
      id: savedInventoryId
    };
    state.view = 'summary';
    _refreshInventoryDOM();

  } catch (err) {
    UI.hideLoader();
    UI.toast("Erreur lors de la validation : " + err.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════════════
// VUE : SYNTHÈSE FINALE DE L'INVENTAIRE (POST-VALIDATION)
// ═══════════════════════════════════════════════════════════════════
function renderSummaryView(container) {
  const state = window._inventoryPageState;
  const inv = state.lastSavedInventory;
  const gaps = inv.items.filter(i => i.gap !== 0);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Inventaire Enregistré</h1>
        <p class="page-subtitle">L'inventaire a été validé et archivé dans votre historique</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="window.reloadInventoryHistory().then(() => { _inventoryPageState.view = 'history'; _refreshInventoryDOM(); })">
          <i data-lucide="home"></i> Retourner à l'historique
        </button>
      </div>
    </div>

    <div class="settings-card2" style="max-width: 800px; margin: 10px auto 0 auto; text-align: center; padding: 36px 24px;">
      <div style="width:72px; height:72px; border-radius:50%; background:rgba(16,185,129,0.1); color:#10b981; display:flex; align-items:center; justify-content:center; margin: 0 auto 20px auto;">
        <i data-lucide="check" style="width:36px; height:36px; stroke-width:3px"></i>
      </div>
      <h2 style="font-weight:800; font-size:22px; color:var(--text); margin-bottom:8px">Validation Réussie !</h2>
      <p style="color:var(--text-muted); font-size:14px; margin-bottom:24px; max-width:550px; margin-left:auto; margin-right:auto">
        L'inventaire de type <strong>${formatScopeType(inv.type)} (${inv.scope})</strong> a été validé et enregistré sous le statut 
        <strong>${inv.status === 'validated_adjusted' ? 'Ajusté en Stock' : 'Analyse Seule'}</strong>.
      </p>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:32px;">
        <div style="background:var(--bg-secondary); padding:16px; border-radius:12px; border:1px solid var(--border)">
          <div style="font-size:20px; font-weight:800; color:var(--text)">${inv.productsCount}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px">Produits vérifiés</div>
        </div>
        <div style="background:var(--bg-secondary); padding:16px; border-radius:12px; border:1px solid var(--border)">
          <div style="font-size:20px; font-weight:800; color:var(--text)">${inv.gapsCount}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px">Écarts détectés</div>
        </div>
        <div style="background:var(--bg-secondary); padding:16px; border-radius:12px; border:1px solid var(--border)">
          <div style="font-size:20px; font-weight:800; color:${inv.gapsValue === 0 ? 'var(--text)' : inv.gapsValue > 0 ? 'var(--primary)' : 'var(--danger)'}">
            ${UI.formatCurrency(inv.gapsValue)}
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px">Impact financier</div>
        </div>
      </div>

      <div style="display:flex; justify-content:center; gap:12px; border-top: 1px solid var(--border); padding-top:24px;">
        <button class="btn btn-secondary" onclick="exportPastInventoryPDF(${inv.id})"><i data-lucide="printer"></i> Imprimer Rapport PDF</button>
        <button class="btn btn-secondary" onclick="exportPastInventoryCSV(${inv.id})"><i data-lucide="download"></i> Exporter CSV</button>
        <button class="btn btn-primary" onclick="window.reloadInventoryHistory().then(() => { _inventoryPageState.view = 'history'; _refreshInventoryDOM(); })"><i data-lucide="arrow-right"></i> Aller à l'historique</button>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════
// DÉTAILS MODAL - IMPRESSIONS ET EXPORTS
// ═══════════════════════════════════════════════════════════════════
window.viewInventoryDetails = async function(inventoryId) {
  const state = window._inventoryPageState;
  const inv = state.inventories.find(i => i.id === inventoryId);
  if (!inv) return UI.toast("Inventaire introuvable", "error");

  const gaps = inv.items.filter(it => it.gap !== 0);

  UI.modal(`<i data-lucide="eye" class="modal-icon-inline"></i> Détails de l'Inventaire #${inv.id}`, `
    <div style="display:flex; flex-direction:column; gap:16px">
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; background:var(--bg-secondary); padding:16px; border-radius:12px;">
        <div>
          <span class="text-muted text-xs block">Date & Heure :</span>
          <strong>${new Date(inv.datetime).toLocaleString('fr-FR')}</strong>
        </div>
        <div>
          <span class="text-muted text-xs block">Opérateur :</span>
          <strong>${state.userMap[inv.userId] || 'Inconnu'}</strong>
        </div>
        <div>
          <span class="text-muted text-xs block">Périmètre :</span>
          <strong>${formatScopeType(inv.type)} (${inv.scope})</strong>
        </div>
        <div>
          <span class="text-muted text-xs block">Statut Stock :</span>
          <strong>${inv.status === 'validated_adjusted' ? 'Stock Ajusté' : 'Analyse Seule'}</strong>
        </div>
      </div>

      <div class="stats-bar" style="grid-template-columns: repeat(3, 1fr); padding:0; box-shadow:none; border:none; margin:0">
        <div class="stat-chip stat-blue"><span class="stat-val">${inv.productsCount}</span><span class="stat-label">Vérifiés</span></div>
        <div class="stat-chip stat-orange"><span class="stat-val">${inv.gapsCount}</span><span class="stat-label">Écarts</span></div>
        <div class="stat-chip ${inv.gapsValue >= 0 ? 'stat-green' : 'stat-red'}">
          <span class="stat-val" style="font-size:1.1rem">${UI.formatCurrency(inv.gapsValue)}</span><span class="stat-label">Impact financier</span>
        </div>
      </div>

      <h4 style="font-weight:700; font-size:14px; margin-top:8px">Liste détaillée des écarts (${gaps.length})</h4>
      <div class="table-wrapper" style="max-height: 250px; overflow-y: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Médicament</th>
              <th>Dernier Fournisseur</th>
              <th class="ta-c">Théorique</th>
              <th class="ta-c">Physique</th>
              <th class="ta-c">Écart</th>
              <th class="ta-r">Valeur (Achat)</th>
            </tr>
          </thead>
          <tbody>
            ${gaps.map(g => `
              <tr>
                <td><strong>${g.name}</strong><br><code style="font-size:11px">${g.code}</code></td>
                <td class="text-muted text-sm">${g.supplierName || 'Aucun'}</td>
                <td class="ta-c text-muted">${g.systemQty}</td>
                <td class="ta-c"><strong>${g.physicalQty}</strong></td>
                <td class="ta-c">
                  <span class="badge ${g.gap > 0 ? 'badge-info' : 'badge-danger'}">${g.gap > 0 ? '+' : ''}${g.gap}</span>
                </td>
                <td class="ta-r ${g.gap > 0 ? 'text-info' : 'text-danger'}"><strong>${UI.formatCurrency(g.gapValue)}</strong></td>
              </tr>
            `).join('')}
            ${gaps.length === 0 ? '<tr><td colspan="6" class="ta-c text-success">Aucun écart de stock constaté.</td></tr>' : ''}
          </tbody>
        </table>
      </div>
    </div>
  `, {
    size: 'large',
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Fermer</button>
      <button class="btn btn-secondary" onclick="exportPastInventoryPDF(${inv.id})"><i data-lucide="printer"></i> PDF</button>
      <button class="btn btn-primary" onclick="exportPastInventoryCSV(${inv.id})"><i data-lucide="download"></i> Exporter CSV</button>
    `
  });
  if (window.lucide) lucide.createIcons();
};

window.exportPastInventoryPDF = async function(inventoryId) {
  const state = window._inventoryPageState;
  
  // Si on exporte depuis l'historique sans avoir chargé le reste, on recharge
  let inventories = state ? state.inventories : [];
  if (inventories.length === 0) {
    inventories = await DB.dbGetAll('inventories');
  }

  const inv = inventories.find(i => i.id === inventoryId);
  if (!inv) return UI.toast("Inventaire introuvable pour l'impression", "error");

  if (!window.PDFExport) {
    return UI.toast("Module PDF non disponible", "error");
  }

  // Maper les utilisateurs si besoin
  let users = state ? state.userMap : null;
  if (!users) {
    const usersAll = await DB.dbGetAll('users');
    users = {};
    usersAll.forEach(u => { users[u.id] = u.name || u.username; });
  }

  const items = inv.items || [];
  // Inclure TOUS les produits inventoriés, pas seulement les écarts
  const gapItems = items.filter(it => it.gap !== 0);
  let totalPositive = 0;
  let totalNegative = 0;

  const data = items.map(it => {
    if (it.gap > 0) totalPositive += (it.gapValue || 0);
    else if (it.gap < 0) totalNegative += (it.gapValue || 0);

    return [
      it.code || 'N/A',
      (it.name || 'Inconnu').substring(0, 35),
      it.form || '—',
      (it.category || '—').substring(0, 15),
      String(it.systemQty ?? 0),
      String(it.physicalQty ?? 0),
      it.gap === 0 ? '0' : (it.gap > 0 ? '+' : '') + it.gap,
      UI.formatCurrency(it.gapValue || 0),
      (it.observation || '—').substring(0, 20)
    ];
  });

  const headers = ["Code", "Médicament", "Forme", "Catégorie", "Théo.", "Phys.", "Écart", "Val. Écart", "Obs."];
  
  const dt = new Date(inv.datetime || inv.date);
  const dateStr = dt.toLocaleDateString('fr-FR');
  const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  window.PDFExport.generate(
    `Rapport d'Inventaire Physique #${inv.id}`,
    headers,
    data,
    {
      orientation: items.length > 0 ? 'landscape' : 'portrait',
      subHeader: [
        `Périmètre : ${formatScopeType(inv.type)} (${inv.scope})`,
        `Date : ${dateStr} à ${timeStr}`,
        `Réalisé par : ${users[inv.userId] || 'Inconnu'}`,
        `Statut Stock : ${inv.status === 'validated_adjusted' ? 'Stock théorique AJUSTÉ' : 'ANALYSE SEULE'}`,
        `Total produits : ${items.length} — Produits en écart : ${gapItems.length}`
      ],
      summaryBlocks: [
        { label: "Produits inventoriés", value: `${inv.productsCount || items.length}` },
        { label: "Produits en écart", value: `${inv.gapsCount || gapItems.length}` },
        { label: "Excédents (surplus)", value: `${UI.formatCurrency(totalPositive)}` },
        { label: "Manquants (déficits)", value: `${UI.formatCurrency(totalNegative)}` },
        { label: "Impact financier net", value: `${UI.formatCurrency(inv.gapsValue || (totalPositive + totalNegative))}` }
      ]
    }
  );
};

window.exportPastInventoryCSV = async function(inventoryId) {
  const state = window._inventoryPageState;
  let inventories = state ? state.inventories : [];
  if (inventories.length === 0) {
    inventories = await DB.dbGetAll('inventories');
  }

  const inv = inventories.find(i => i.id === inventoryId);
  if (!inv) return UI.toast("Inventaire introuvable pour l'export", "error");

  let users = state ? state.userMap : null;
  if (!users) {
    const usersAll = await DB.dbGetAll('users');
    users = {};
    usersAll.forEach(u => { users[u.id] = u.name || u.username; });
  }

  const csvRows = [
    ["Code", "Medicament", "Forme", "Categorie", "Dernier Fournisseur", "Stock Theorique", "Stock Physique", "Ecart", "Valeur Ecart (Achat)", "Observation"]
  ];

  (inv.items || []).forEach(it => {
    csvRows.push([
      `"${it.code}"`,
      `"${it.name.replace(/"/g, '""')}"`,
      `"${(it.form || '—').replace(/"/g, '""')}"`,
      `"${(it.category || '—').replace(/"/g, '""')}"`,
      `"${(it.supplierName || 'Aucun').replace(/"/g, '""')}"`,
      it.systemQty,
      it.physicalQty,
      it.gap,
      it.gapValue,
      `"${(it.observation || '').replace(/"/g, '""')}"`
    ]);
  });

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  
  const dtStr = new Date(inv.datetime || inv.date).toISOString().split('T')[0];
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `rapport_inventaire_${inv.id}_${dtStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  UI.toast("Le fichier CSV a été exporté avec succès", "success");
  DB.writeAudit('EXPORT_CSV', 'inventories', inv.id, { count: inv.productsCount });
};

// Enregistrer la route dans le Router global
Router.register('inventory', renderInventory);
