/**
 * OrdiveX — Gestion des Stocks
 */

async function renderStock(container) {
  UI.loading(container, 'Chargement des stocks...');

  const [allProducts, stockAll, lots] = await Promise.all([
    DB.dbGetAll('products'),
    DB.dbGetAll('stock'),
    DB.dbGetAll('lots'),
  ]);
  const products = allProducts.filter(p => p.status !== 'inactive');
  await new Promise(r => setTimeout(r, 0));

  const stockMap = {};
  stockAll.forEach(s => { stockMap[s.productId] = s; });

  // Indexer les lots par productId pour éviter un O(n²)
  const lotsMap = {};
  lots.forEach(l => {
    if (l.status === 'active') {
      if (!lotsMap[l.productId]) lotsMap[l.productId] = [];
      lotsMap[l.productId].push(l);
    }
  });

  const stockData = products.map(p => {
    const pLots = lotsMap[p.id] || [];
    let qtyRayon = 0, qtyReserve = 0;
    pLots.forEach(l => {
      if (!l.location || l.location === 'rayon') qtyRayon += (l.quantity || 0);
      else qtyReserve += (l.quantity || 0);
    });
    return {
      ...p,
      currentStock: stockMap[p.id]?.quantity || 0,
      reservedQty: stockMap[p.id]?.reservedQuantity || 0,
      lots: pLots,
      qtyRayon,
      qtyReserve
    };
  });

  // Stats
  const totalProducts = products.length;
  const inStock = stockData.filter(p => p.currentStock > 0).length;
  const ruptures = stockData.filter(p => p.currentStock === 0).length;
  const lowStock = stockData.filter(p => p.currentStock > 0 && p.currentStock <= p.minStock).length;

  const today = new Date();
  const alertExpiry = lots.filter(l => {
    const days = UI.daysUntilExpiry(l.expiryDate);
    return l.status === 'active' && days !== null && days <= 90;
  }).length;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gestion des Stocks</h1>
        <p class="page-subtitle">Inventaire temps réel — ${totalProducts} produits référencés</p>
      </div>
      <div class="header-actions">
        ${Auth.can('stock_print') || Auth.can('stock_export') ? `<button class="btn btn-secondary" onclick="exportStockPDF()"><i data-lucide="printer"></i> PDF</button>` : ''}
        ${Auth.can('stock_edit') ? `
          <button class="btn btn-secondary" onclick="showImportStockModal()"><i data-lucide="upload"></i> Importer Stock (CSV)</button>
          <input type="file" id="import-stock-file" accept=".csv" style="display:none" onchange="importStockCsv(event)">
          <button class="btn btn-primary" onclick="renderStockEntry()"><i data-lucide="plus"></i> Entrée Stock</button>
        ` : ''}
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-chip stat-blue"><span class="stat-val">${totalProducts}</span><span class="stat-label">Produits</span></div>
      <div class="stat-chip stat-green"><span class="stat-val">${inStock}</span><span class="stat-label">En Stock</span></div>
      <div class="stat-chip stat-orange"><span class="stat-val">${lowStock}</span><span class="stat-label">Stock Bas</span></div>
      <div class="stat-chip stat-red"><span class="stat-val">${ruptures}</span><span class="stat-label">Ruptures</span></div>
      <div class="stat-chip stat-purple"><span class="stat-val">${alertExpiry}</span><span class="stat-label">Exp. < 90j</span></div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <input type="text" id="stock-search" placeholder="Chercher un produit..." class="filter-input" oninput="filterStock()">
      <select id="stock-filter-status" class="filter-select" onchange="filterStock()">
        <option value="">Tous les états</option>
        <option value="ok">En stock normal</option>
        <option value="low">Stock bas</option>
        <option value="rupture">Rupture</option>
        <option value="expiry">Expiration proche</option>
        <option value="expired">Déjà expiré</option>
      </select>
      <select id="stock-filter-location" class="filter-select" onchange="filterStock()">
        <option value="">Tous les emplacements</option>
        <option value="rayon">En Rayon</option>
        <option value="reserve">En Réserve</option>
      </select>
      <select id="stock-filter-category" class="filter-select" onchange="filterStock()">
        <option value="">Toutes catégories</option>
        ${[...new Set(products.map(p => (p.category || '').trim()).filter(Boolean))].sort().map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      <select id="stock-filter-form" class="filter-select" onchange="filterStock()">
        <option value="">Toutes les formes</option>
        ${[...new Set(products.map(p => (p.form || p.forme || '').trim()).filter(Boolean))].sort().map(f => `<option value="${f}">${f}</option>`).join('')}
      </select>
      <select id="stock-sort" class="filter-select" onchange="filterStock()">
        <option value="alpha-asc" selected>De A à Z</option>
        <option value="alpha-desc">De Z à A</option>
        <option value="">Tri par ordre d'ajout</option>
      </select>
    </div>

    <div id="stock-table-container"></div>
  `;

  window._stockData = stockData;
  renderStockTable(stockData);

  document.getElementById('stock-search')?.focus();
}

function filterStock() {
  const search = (document.getElementById('stock-search')?.value || '').toLowerCase();
  const status = document.getElementById('stock-filter-status')?.value || '';
  const location = document.getElementById('stock-filter-location')?.value || '';
  const category = document.getElementById('stock-filter-category')?.value || '';
  const form = document.getElementById('stock-filter-form')?.value || '';
  const sort = document.getElementById('stock-sort')?.value || 'alpha-asc';

  let data = window._stockData || [];

  if (search) data = data.filter(p =>
    p.name.toLowerCase().includes(search) ||
    (p.dci || '').toLowerCase().includes(search) ||
    (p.code || '').toLowerCase().includes(search)
  );

  if (category) data = data.filter(p => p.category === category);
  if (form) data = data.filter(p => (p.form || p.forme || '').trim() === form);

  if (status === 'rupture') data = data.filter(p => p.currentStock === 0);
  else if (status === 'low') data = data.filter(p => p.currentStock > 0 && p.currentStock <= p.minStock);
  else if (status === 'ok') data = data.filter(p => p.currentStock > p.minStock);
  else if (status === 'expiry') {
    data = data.filter(p => {
      const lotExpiry = p.lots.some(l => { const d = UI.daysUntilExpiry(l.expiryDate); return d !== null && d > 0 && d <= 90 && (l.quantity || 0) > 0; });
      // Fallback sur products.expiryDate seulement si le produit a encore du stock
      const prodExpiry = p.currentStock > 0 && p.expiryDate ? (UI.daysUntilExpiry(p.expiryDate) !== null && UI.daysUntilExpiry(p.expiryDate) > 0 && UI.daysUntilExpiry(p.expiryDate) <= 90) : false;
      return lotExpiry || prodExpiry;
    });
  } else if (status === 'expired') {
    data = data.filter(p => {
      const lotExpired = p.lots.some(l => { const d = UI.daysUntilExpiry(l.expiryDate); return d !== null && d <= 0 && (l.quantity || 0) > 0; });
      // Fallback seulement si le produit a encore du stock
      const prodExpired = p.currentStock > 0 && p.expiryDate ? (UI.daysUntilExpiry(p.expiryDate) !== null && UI.daysUntilExpiry(p.expiryDate) <= 0) : false;
      return lotExpired || prodExpired;
    });
  }

  if (location === 'rayon') data = data.filter(p => p.qtyRayon > 0);
  else if (location === 'reserve') data = data.filter(p => p.qtyReserve > 0);
  
  // Sorting
  if (sort === 'alpha' || sort === 'alpha-asc') {
    data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sort === 'alpha-desc') {
    data.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  }

  renderStockTable(data);
}

function renderStockTable(data) {
  const container = document.getElementById('stock-table-container');
  if (!container) return;

  // Pagination
  const PAGE_SIZE = 100;
  window._filteredStock = data;
  window._stockPage = window._stockPage || 1;
  if (data !== window._lastFilteredStock) {
    window._stockPage = 1;
    window._lastFilteredStock = data;
  }
  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  if (window._stockPage > totalPages) window._stockPage = totalPages;
  const start = (window._stockPage - 1) * PAGE_SIZE;
  const pageData = data.slice(start, start + PAGE_SIZE);

  const columns = [
    { label: 'Code', key: 'code', render: r => `<code class="code-tag">${r.code}</code>` },
    {
      label: 'Médicament', render: r => `
      <div class="product-name-cell">
        <strong>${r.name}</strong>
        <span class="text-muted text-sm">${r.dci || r.brand || ''}</span>
      </div>` },
    { label: 'Catégorie', render: r => `<span class="category-tag">${r.category}</span>` },
    { label: 'Stock', render: r => UI.stockBadge(r.currentStock, r.minStock, r) },
    { label: 'Min. Seuil', key: 'minStock' },
    { label: 'Lots actifs', render: r => `<span class="text-center">${r.lots.length}</span>` },
    {
      label: 'Prochaine Exp.', render: r => {
        // Uniquement les lots actifs avec du stock disponible
        const activeLots = r.lots.filter(l => l.expiryDate && l.status === 'active' && (l.quantity || 0) > 0);
        if (activeLots.length > 0) {
          activeLots.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
          return UI.expiryBadge(activeLots[0].expiryDate);
        }
        // Fallback sur le champ produit seulement si le produit a encore du stock global
        return (r.currentStock > 0 && r.expiryDate) ? UI.expiryBadge(r.expiryDate) : '—';
      }
    },
    { label: 'Prix Vente', render: r => UI.formatCurrency(r.salePrice) },
    { label: 'Rx', render: r => r.requiresPrescription ? '<span class="badge badge-warning">Rx</span>' : '<span class="badge badge-neutral">OTC</span>' },
    {
      label: 'Actions', render: r => `
      <div class="actions-cell">
        <button class="btn btn-xs btn-primary" onclick="viewProductLots(${r.id})" title="Voir les lots"><i data-lucide="package"></i></button>
        <button class="btn btn-xs btn-secondary" onclick="showStockMovements(${r.id})" title="Mouvements"><i data-lucide="clipboard-list"></i></button>
        ${Auth.can('inventory_adjust') || Auth.can('stock_edit') || DB.AppState.currentUser?.role === 'admin' ? `<button class="btn btn-xs btn-warning" onclick="showAdjustStock(${r.id})" title="Ajuster le stock"><i data-lucide="pencil"></i></button>` : ''}
        ${Auth.can('stock_edit') ? `<button class="btn btn-xs btn-ghost" onclick="editProduct(${r.id})" title="Modifier"><i data-lucide="edit-3"></i></button>` : ''}
      </div>` },
  ];

  UI.table(container, columns, pageData, {
    emptyMessage: 'Aucun produit trouvé',
    emptyIcon: 'package',
    paginate: false
  });

  // Pagination controls
  const pagDiv = document.createElement('div');
  pagDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:16px 0;gap:12px;flex-wrap:wrap;';
  pagDiv.innerHTML = `
    <span style="font-size:13px;color:var(--text-muted)">${data.length.toLocaleString()} produits — Page ${window._stockPage}/${totalPages}</span>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-secondary btn-sm" ${window._stockPage <= 1 ? 'disabled' : ''} onclick="window._stockPage--;renderStockTable(window._filteredStock)">◀ Précédent</button>
      <button class="btn btn-secondary btn-sm" ${window._stockPage >= totalPages ? 'disabled' : ''} onclick="window._stockPage++;renderStockTable(window._filteredStock)">Suivant ▶</button>
    </div>
  `;
  container.appendChild(pagDiv);
  if (window.lucide) lucide.createIcons();
}

async function viewProductLots(productId) {
  const [product, lots, stock] = await Promise.all([
    DB.dbGet('products', productId),
    DB.dbGetAll('lots', 'productId', productId),
    DB.dbGetAll('stock', 'productId', productId),
  ]);

  let qtyRayon = 0, qtyReserve = 0;
  lots.forEach(l => {
    if (l.status === 'active') {
      if (!l.location || l.location === 'rayon') qtyRayon += (l.quantity || 0);
      else qtyReserve += (l.quantity || 0);
    }
  });

  const headerHtml = `
    <div style="display:flex;gap:20px;margin-bottom:15px;background:var(--surface-2);padding:10px;border-radius:8px;">
      <div><span class="text-muted">Stock Total:</span> <strong>${qtyRayon + qtyReserve}</strong></div>
      <div><span class="text-muted"><i data-lucide="layout-grid" style="width:14px;height:14px"></i> En Rayon:</span> <strong class="text-success">${qtyRayon}</strong></div>
      <div><span class="text-muted"><i data-lucide="box" style="width:14px;height:14px"></i> En Réserve:</span> <strong class="text-warning">${qtyReserve}</strong></div>
    </div>
  `;

  const lotsHTML = lots.length === 0 ? '<p class="text-muted text-center">Aucun lot enregistré</p>' : `
    ${headerHtml}
    <table class="data-table">
      <thead>
        <tr><th>N° Lot</th><th>Emplacement</th><th>Facture Réf.</th><th>Quantité</th><th>Expiration</th><th>Action</th></tr>
      </thead>
      <tbody>
        ${lots.map(l => {
          const isRayon = (!l.location || l.location === 'rayon');
          return `
          <tr>
            <td><code>${l.lotNumber}</code></td>
            <td>${isRayon ? '<span class="badge badge-success"><i data-lucide="layout-grid" style="width:12px;height:12px"></i> Rayon</span>' : '<span class="badge badge-warning"><i data-lucide="box" style="width:12px;height:12px"></i> Réserve</span>'}</td>
            <td>${l.invoiceRef ? `<span class="badge badge-neutral" style="font-size:10px;"><i data-lucide="file-text" style="width:12px;height:12px"></i> ${l.invoiceRef}</span>` : '—'}</td>
            <td><strong>${l.quantity}</strong> / ${l.initialQuantity}</td>
            <td>${UI.expiryBadge(l.expiryDate)}</td>
            <td>
              ${(!isRayon && l.quantity > 0 && l.status === 'active') ? `<button class="btn btn-xs btn-primary" onclick="initTransferLot(${l.id})"><i data-lucide="arrow-right-left"></i> Transférer</button>` : '—'}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  UI.modal(`<i data-lucide="package" class="modal-icon-inline"></i> Lots — ${product?.name}`, lotsHTML, { size: 'large' });
  if (window.lucide) lucide.createIcons();
}

window.initTransferLot = async function(lotId) {
  const lot = await DB.dbGet('lots', lotId);
  if (!lot) return;
  
  const formHTML = `
    <div class="info-box" style="margin-bottom:15px;">
      Transférer le stock du lot <strong>${lot.lotNumber}</strong> de la <span class="badge badge-warning">Réserve</span> vers le <span class="badge badge-success">Rayon</span>.
      <br><br>Stock disponible dans ce carton : <strong>${lot.quantity}</strong>
    </div>
    <div class="form-group">
      <label>Quantité à transférer en rayon</label>
      <input type="number" id="transfer-qty" class="form-control" max="${lot.quantity}" min="1" value="${lot.quantity}" required>
    </div>
  `;

  UI.modal('Transférer en Rayon', formHTML, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitTransferLot(${lot.id}, this)"><i data-lucide="check"></i> Valider le Transfert</button>
    `
  });
  if (window.lucide) lucide.createIcons();
};

window.submitTransferLot = async function(lotId, btn) {
  const qtyInput = document.getElementById('transfer-qty');
  if (!qtyInput || !qtyInput.checkValidity()) { qtyInput?.reportValidity(); return; }
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="lucide-loader"></i> Transfert...';
  }

  const transferQty = parseInt(qtyInput.value);
  try {
    const lot = await DB.dbGet('lots', lotId);
    if (!lot || transferQty > lot.quantity || transferQty <= 0) {
      UI.toast('Quantité invalide', 'error');
      return;
    }

    if (transferQty === lot.quantity) {
      // Transfert total
      lot.location = 'rayon';
      await DB.dbPut('lots', lot);
    } else {
      // Transfert partiel : on crée un nouveau lot pour le rayon
      lot.quantity -= transferQty;
      await DB.dbPut('lots', lot);
      
      const newLot = { ...lot };
      delete newLot.id; // nouvel ID
      newLot.quantity = transferQty;
      newLot.initialQuantity = transferQty;
      newLot.location = 'rayon';
      newLot.createdAt = new Date().toISOString();
      await DB.dbAdd('lots', newLot);
    }

    // Traçabilité mouvement
    await DB.dbAdd('movements', {
      productId: lot.productId,
      type: 'TRANSFER',
      quantity: 0,
      date: new Date().toISOString(),
      reference: lot.lotNumber,
      note: `Transfert de ${transferQty} unités de la réserve vers le rayon`,
      userId: DB.AppState.currentUser?.id
    });

    UI.toast('Transfert effectué avec succès', 'success');
    await viewProductLots(lot.productId); // Rafraîchit directement le contenu de la modale sans la fermer
  } catch(e) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check"></i> Valider le Transfert';
    }
    UI.toast('Erreur de transfert', 'error');
    console.error(e);
  }
};

async function showStockMovements(productId) {
  const [product, movements] = await Promise.all([
    DB.dbGet('products', productId),
    DB.dbGetAll('movements', 'productId', productId),
  ]);

  const sorted = movements.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 30);

  const movHTML = sorted.length === 0 ? '<p class="text-muted text-center">Aucun mouvement</p>' : `
    <table class="data-table">
      <thead><tr><th>Date</th><th>Type</th><th>Quantité</th><th>Réf.</th><th>Note</th></tr></thead>
      <tbody>
        ${sorted.map(m => `
          <tr>
            <td>${UI.formatDate(m.date)}</td>
            <td><span class="badge badge-${m.type === 'ENTRY' ? 'success' : 'warning'}">${m.type === 'ENTRY' ? '<i data-lucide="arrow-up"></i> Entrée' : '<i data-lucide="arrow-down"></i> Sortie'}</span></td>
            <td class="${m.quantity > 0 ? 'text-success' : 'text-danger'} font-bold">${m.quantity > 0 ? '+' : ''}${m.quantity}</td>
            <td><code class="code-tag">${m.reference || m.lotNumber || '—'}</code></td>
            <td class="text-muted">${m.note || '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  UI.modal(`<i data-lucide="clipboard-list" class="modal-icon-inline"></i> Mouvements — ${product?.name}`, movHTML, { size: 'large' });
  if (window.lucide) lucide.createIcons();
}

function renderStockEntry() {
  const products = window._stockData || [];
  const formHTML = `
    <form id="stock-entry-form" class="form-grid">
      <div class="form-group">
        <label>Produit *</label>
        <input type="text" id="stock-entry-product-search" class="form-control" placeholder="Tapez pour chercher un produit..." autocomplete="off" oninput="filterStockEntryProducts(this.value)">
        <input type="hidden" name="productId" id="stock-entry-product-id" required>
        <div id="stock-entry-product-results" style="max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;display:none;margin-top:4px;background:var(--surface);"></div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>N° Lot (Optionnel)</label>
          <input type="text" name="lotNumber" class="form-control" placeholder="LOT-2024-XXX">
        </div>
        <div class="form-group">
          <label>Quantité reçue *</label>
          <input type="number" name="quantity" class="form-control" min="1" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de fabrication</label>
          <input type="date" name="manufactureDate" class="form-control">
        </div>
        <div class="form-group">
          <label>Date d'expiration *</label>
          <input type="date" name="expiryDate" class="form-control">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>N° Facture (Optionnel)</label>
          <input type="text" name="invoiceNumber" class="form-control" placeholder="Ex: F-2024-001" oninput="if(this.value.trim()){document.getElementById('stock-entry-location').value='reserve';}">
        </div>
        <div class="form-group">
          <label>Fournisseur</label>
          <input type="text" name="supplier" class="form-control" placeholder="Nom du fournisseur">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix d'achat unitaire</label>
          <input type="number" name="purchasePrice" class="form-control" placeholder="0 GNF">
        </div>
        <div class="form-group">
          <label>Prix de vente unitaire</label>
          <input type="number" name="salePrice" class="form-control" placeholder="0 GNF">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Emplacement *</label>
          <select name="location" id="stock-entry-location" class="form-control" required>
            <option value="rayon">Rayon (Produit en vitrine/étagère)</option>
            <option value="reserve">Réserve (Dans son carton)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Note</label>
          <input type="text" name="note" class="form-control" placeholder="Observations...">
        </div>
      </div>
    </form>
  `;

  const modal = UI.modal('<i data-lucide="plus-circle" class="modal-icon-inline"></i> Entrée Stock', formHTML, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitStockEntry()"><i data-lucide="check"></i> Enregistrer l'entrée</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function submitStockEntry() {
  const form = document.getElementById('stock-entry-form');
  if (!form || !form.checkValidity()) { form?.reportValidity(); return; }

  const data = Object.fromEntries(new FormData(form));

  try {
    let productId = parseInt(data.productId);

    // Auto-create product if it does not exist
    if (isNaN(productId)) {
      const newName = (document.getElementById('stock-entry-product-search')?.value || '').trim();
      if (!newName) {
        if (window.UI) UI.toast("Veuillez sélectionner ou saisir le nom du produit", "error");
        return;
      }
      productId = await DB.dbAdd('products', {
        name: newName,
        code: 'AUTO-' + Date.now().toString().slice(-5),
        category: 'Non classé',
        form: '',
        requiresPrescription: false,
        purchasePrice: parseFloat(data.purchasePrice || 0),
        salePrice: parseFloat(data.salePrice || data.purchasePrice || 0) * (data.salePrice ? 1 : 1.3),
        status: 'active'
      });
      if (window.UI) UI.toast("Nouveau produit créé automatiquement", "info");
    } else {
      // ── Synchronisation bidirectionnelle : stock → fiche produit ──
      // Si des prix ou une date sont saisis dans l'entrée stock,
      // on met à jour la fiche produit ET tous ses lots actifs existants
      const existingProd = await DB.dbGet('products', productId).catch(() => null);
      if (existingProd) {
        let prodChanged = false;
        if (data.purchasePrice && parseFloat(data.purchasePrice) > 0 && parseFloat(data.purchasePrice) !== existingProd.purchasePrice) {
          existingProd.purchasePrice = parseFloat(data.purchasePrice);
          prodChanged = true;
        }
        if (data.salePrice && parseFloat(data.salePrice) > 0 && parseFloat(data.salePrice) !== existingProd.salePrice) {
          existingProd.salePrice = parseFloat(data.salePrice);
          prodChanged = true;
        }
        if (data.expiryDate && data.expiryDate !== existingProd.expiryDate) {
          existingProd.expiryDate = data.expiryDate;
          prodChanged = true;
        }
        if (prodChanged) {
          existingProd.updatedAt = Date.now();
          await DB.dbPut('products', existingProd);
          // Propager aux lots actifs existants
          try {
            const allLots = await DB.dbGetAll('lots');
            const productLots = allLots.filter(l => l.productId === productId && l.status === 'active');
            for (const lot of productLots) {
              const lotUpdate = { ...lot, updatedAt: Date.now() };
              if (data.purchasePrice && parseFloat(data.purchasePrice) > 0) lotUpdate.purchasePrice = parseFloat(data.purchasePrice);
              if (data.salePrice && parseFloat(data.salePrice) > 0) lotUpdate.salePrice = parseFloat(data.salePrice);
              // Date : uniquement si le lot n'a pas sa propre date récente
              if (data.expiryDate && (!lot.expiryDate || lot.expiryDate === existingProd.expiryDate)) {
                lotUpdate.expiryDate = data.expiryDate;
              }
              await DB.dbPut('lots', lotUpdate);
            }
          } catch (cascadeErr) {
            console.warn('[StockEntry] Erreur cascade lots:', cascadeErr);
          }
        }
      }
    }
    // Add lot
    await DB.dbAdd('lots', {
      productId,
      lotNumber: data.lotNumber,
      expiryDate: data.expiryDate,
      manufactureDate: data.manufactureDate,
      quantity: parseInt(data.quantity),
      initialQuantity: parseInt(data.quantity),
      receiptDate: new Date().toISOString().split('T')[0],
      status: 'active',
      invoiceRef: data.invoiceNumber || null,
      location: data.location || 'rayon',
    });

    // Smart Invoice Logic
    if (data.invoiceNumber && data.invoiceNumber.trim() !== '') {
      try {
        const invoices = await DB.dbGetAll('invoices');
        const invNum = data.invoiceNumber.trim();
        let existingInvoice = invoices.find(i => i.invoiceNumber.toLowerCase() === invNum.toLowerCase());
        
        const productsAll = await DB.dbGetAll('products');
        const prod = productsAll.find(p => p.id === productId);
        
        const invoiceItem = {
          productId,
          productName: prod ? prod.name : 'Produit inconnu',
          quantity: parseInt(data.quantity),
          unitPrice: parseFloat(data.purchasePrice || prod?.purchasePrice || 0),
          total: parseInt(data.quantity) * parseFloat(data.purchasePrice || prod?.purchasePrice || 0),
          lotNumber: data.lotNumber,
          expiryDate: data.expiryDate,
        };

        if (existingInvoice) {
          // Append to existing invoice
          existingInvoice.items = existingInvoice.items || [];
          existingInvoice.items.push(invoiceItem);
          existingInvoice.totalAmount = (existingInvoice.totalAmount || 0) + invoiceItem.total;
          await DB.dbPut('invoices', existingInvoice);
        } else {
          // Create new validated invoice implicitly
          let supId = null;
          if (data.supplier) {
            const suppliers = await DB.dbGetAll('suppliers');
            const existSup = suppliers.find(s => s.name.toLowerCase() === data.supplier.toLowerCase());
            if (existSup) supId = existSup.id;
          }
          await DB.dbAdd('invoices', {
            invoiceNumber: invNum,
            supplierId: supId,
            supplierName: data.supplier || 'Inconnu (Saisie Libre)',
            date: new Date().toISOString().split('T')[0],
            status: 'validated',
            items: [invoiceItem],
            totalAmount: invoiceItem.total,
            paymentMethod: '',
            note: 'Facture générée automatiquement via l\'Entrée Stock',
            createdAt: Date.now()
          });
        }
      } catch(err) {
        console.warn('Erreur lors de la création/maj intelligente de la facture:', err);
      }
    }

    // Update stock
    const stockAll = await DB.dbGetAll('stock');
    const existing = stockAll.find(s => s.productId === productId);
    if (existing) {
      await DB.dbPut('stock', { ...existing, quantity: existing.quantity + parseInt(data.quantity) });
    } else {
      await DB.dbAdd('stock', { productId, quantity: parseInt(data.quantity), reservedQuantity: 0 });
    }

    // Movement
    await DB.dbAdd('movements', {
      productId,
      type: 'ENTRY',
      subType: 'PURCHASE',
      quantity: parseInt(data.quantity),
      lotNumber: data.lotNumber,
      reference: data.lotNumber,
      date: new Date().toISOString(),
      userId: DB.AppState.currentUser?.id,
      note: data.note || 'Entrée stock',
    });

    await DB.writeAudit('STOCK_ENTRY', 'stock', productId, data);
    UI.closeModal();
    UI.toast('Entrée stock enregistrée', 'success');

    if (typeof window._softRefreshStock === 'function') {
      await window._softRefreshStock();
    }

    // ⚡ Forcer la synchronisation immédiate vers Supabase (arrière-plan)
    if (navigator.onLine && typeof DB.syncToSupabase === 'function') {
      DB.syncToSupabase().catch(syncErr => {
        console.warn('[StockEntry] Sync différée :', syncErr.message || syncErr);
      });
    }

    Router.navigate('stock');
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function editProduct(productId) {
  if (typeof editProductForm === 'function') {
    editProductForm(productId);
  } else {
    UI.toast('Module d\'édition non disponible', 'warning');
  }
}

/**
 * Ajustement rapide du stock par l'admin — tracé dans l'audit
 */
async function showAdjustStock(productId) {
  try {
    if (!DB.AppState.currentUser || DB.AppState.currentUser.role !== 'admin') {
      UI.toast('Seul un administrateur peut ajuster le stock', 'error');
      return;
    }
    var product = await DB.dbGet('products', productId);
    if (!product) { UI.toast('Produit introuvable', 'error'); return; }

    var stockAll = await DB.dbGetAll('stock');
    var currentStock = stockAll.find(function(s) { return s.productId === productId; });
    var currentQty = currentStock ? (currentStock.quantity || 0) : 0;

    UI.modal('<i data-lucide="pencil" class="modal-icon-inline"></i> Ajuster le Stock', `
      <form id="adjust-stock-form" class="form-grid">
        <div class="rx-detail-card" style="margin-bottom:16px">
          <h4>${product.name}</h4>
          <div class="detail-row"><span>Code</span><span><code>${product.code || '—'}</code></span></div>
          <div class="detail-row"><span>Stock actuel</span><span><strong>${currentQty}</strong> ${product.unit || 'bo\u00eete(s)'}</span></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Nouvelle quantit\u00e9 *</label>
            <input type="number" name="newQty" class="form-control" value="${currentQty}" min="0" required
              oninput="var d=parseInt(this.value||0)-${currentQty};var e=document.getElementById(\'adjust-diff\');if(e){e.textContent=(d>0?\'+\':\'\')+d;e.className=d===0?\'text-muted\':d>0?\'text-success\':\'text-danger\'}">
          </div>
          <div class="form-group">
            <label>Diff\u00e9rence</label>
            <div style="padding:10px;font-size:24px;font-weight:700;text-align:center" id="adjust-diff" class="text-muted">0</div>
          </div>
        </div>
        <div class="form-group">
          <label>Raison de l\'ajustement *</label>
          <select name="reason" class="form-control" required>
            <option value="">— Choisir —</option>
            <option value="Installation initiale">Installation initiale (mise en place)</option>
            <option value="Correction inventaire">Correction apr\u00e8s inventaire</option>
            <option value="Casse/P\u00e9rim\u00e9">Casse ou produit p\u00e9rim\u00e9</option>
            <option value="Vol/Perte">Vol ou perte constat\u00e9e</option>
            <option value="Retour fournisseur">Retour fournisseur</option>
            <option value="Erreur de saisie">Correction d\'erreur de saisie</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        <div class="form-group">
          <label>D\u00e9tail / Commentaire</label>
          <textarea name="comment" class="form-control" rows="2" placeholder="Pr\u00e9cisez si n\u00e9cessaire..."></textarea>
        </div>
      </form>
    `, {
      footer: `
        <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitAdjustStock(${productId}, ${currentQty})"><i data-lucide="check"></i> Appliquer</button>
      `
    });
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    UI.toast('Erreur : ' + (err.message || err), 'error');
  }
}

async function submitAdjustStock(productId, oldQty) {
  try {
    // ── Contrôle de permission ──
    const isAdmin = DB.AppState.currentUser?.role === 'admin';
    const canAdjust = Auth.can('effectuer_sortie_stock') || Auth.can('ajuster_stock');
    if (!DB.AppState.currentUser || (!isAdmin && !canAdjust)) {
      UI.toast('⛔ Permission refusée — Vous n\'avez pas le droit d\'ajuster le stock.', 'error'); return;
    }
    var form = document.getElementById('adjust-stock-form');
    if (!form || !form.checkValidity()) { if (form) form.reportValidity(); return; }
    var data = Object.fromEntries(new FormData(form));
    var newQty = Math.max(0, parseInt(data.newQty) || 0);
    var diff = newQty - oldQty;

    if (diff === 0) { UI.toast('Aucun changement d\u00e9tect\u00e9', 'info'); UI.closeModal(); return; }
    if (!data.reason) { UI.toast('Veuillez s\u00e9lectionner une raison', 'warning'); return; }

    // Mettre \u00e0 jour le stock
    var stockAll = await DB.dbGetAll('stock');
    var existing = stockAll.find(function(s) { return s.productId === productId; });
    if (existing) {
      await DB.dbPut('stock', Object.assign({}, existing, { quantity: newQty }));
    } else {
      await DB.dbAdd('stock', { productId: productId, quantity: newQty, reservedQuantity: 0 });
    }

    // Enregistrer le mouvement
    await DB.dbAdd('movements', {
      productId: productId,
      type: diff > 0 ? 'ENTRY' : 'EXIT',
      subType: 'ADMIN_ADJUSTMENT',
      quantity: diff,
      date: new Date().toISOString(),
      userId: DB.AppState.currentUser.id,
      reference: 'ADJ-' + new Date().toISOString().split('T')[0] + '-' + productId,
      note: data.reason + (data.comment ? ' — ' + data.comment : '')
    });

    // Tracer dans l'audit
    await DB.writeAudit('ADMIN_STOCK_ADJUST', 'stock', productId, {
      oldQty: oldQty,
      newQty: newQty,
      diff: diff,
      reason: data.reason,
      comment: data.comment || '',
      adjustedBy: DB.AppState.currentUser.name || DB.AppState.currentUser.username
    });

    UI.closeModal();
    UI.toast('Stock ajust\u00e9 : ' + oldQty + ' \u2192 ' + newQty + ' (' + (diff > 0 ? '+' : '') + diff + ')', 'success');

    // ⚡ Forcer la synchronisation immédiate vers Supabase (arrière-plan)
    if (navigator.onLine && typeof DB.syncToSupabase === 'function') {
      DB.syncToSupabase().catch(syncErr => {
        console.warn('[AdjustStock] Sync différée :', syncErr.message || syncErr);
      });
    }

    Router.navigate('stock');
  } catch (err) {
    UI.toast('Erreur ajustement : ' + (err.message || err), 'error');
  }
}

window.filterStock = filterStock;
window.viewProductLots = viewProductLots;
window.showStockMovements = showStockMovements;
window.renderStockEntry = renderStockEntry;
window.submitStockEntry = submitStockEntry;
window.editProduct = editProduct;
window.showAdjustStock = showAdjustStock;
window.submitAdjustStock = submitAdjustStock;
window.importStockCsv = async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  UI.closeModal();
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      UI.toast('Importation et analyse en cours...', 'info');
      const text = e.target.result;
      const lines = text.split('\\n').filter(l => l.trim() !== '');
      if (lines.length < 2) throw new Error('Fichier CSV vide ou invalide');

      const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
      const mapCol = (names) => {
        for (let n of names) {
          const idx = headers.findIndex(h => h.includes(n));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const cName = mapCol(['name', 'nom', 'produit']);
      const cDci = mapCol(['dci', 'molecule']);
      const cBrand = mapCol(['brand', 'marque', 'labo']);
      const cForm = mapCol(['form', 'forme']);
      const cBuyPrice = mapCol(['buyprice', 'achat', 'prix achat']);
      const cSellPrice = mapCol(['sellprice', 'vente', 'prix vente']);
      const cLot = mapCol(['lot', 'lotnumber']);
      const cExpiry = mapCol(['expiry', 'peremption', 'expiration']);
      const cQty = mapCol(['qty', 'quantity', 'quantité', 'quantite']);
      const cLocation = mapCol(['location', 'emplacement', 'rayon', 'reserve']);
      const cInvoice = mapCol(['invoice', 'facture']);
      const cSupplier = mapCol(['supplier', 'fournisseur']);

      if (cName === -1 || cQty === -1) {
        throw new Error('Les colonnes Nom et Quantité sont obligatoires.');
      }

      const productsAll = await DB.dbGetAll('products');
      const invoicesAll = await DB.dbGetAll('invoices');
      const suppliersAll = await DB.dbGetAll('suppliers');

      let importedCount = 0;
      let newProductsCount = 0;
      let newInvoicesCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(';').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols.length < 2) continue;

        const pName = cols[cName];
        if (!pName) continue;

        const qty = parseInt(cols[cQty]) || 0;
        if (qty <= 0) continue;

        const buyPrice = cBuyPrice !== -1 ? (parseFloat(cols[cBuyPrice]) || 0) : 0;
        const sellPrice = cSellPrice !== -1 ? (parseFloat(cols[cSellPrice]) || 0) : 0;
        const lotNumber = cLot !== -1 && cols[cLot] ? cols[cLot] : '';
        const expiryStr = cExpiry !== -1 && cols[cExpiry] ? cols[cExpiry] : '2099-12-31';
        let location = cLocation !== -1 && cols[cLocation] ? cols[cLocation].toLowerCase() : 'reserve';
        if (location !== 'rayon' && location !== 'reserve') location = 'reserve';
        const invoiceNum = cInvoice !== -1 && cols[cInvoice] ? cols[cInvoice] : null;
        const supplierName = cSupplier !== -1 && cols[cSupplier] ? cols[cSupplier] : null;

        // 1. Trouver ou Créer le Produit
        let prod = productsAll.find(p => p.name.toLowerCase() === pName.toLowerCase());
        if (!prod) {
          const code = pName.substring(0,3).toUpperCase() + Date.now().toString().slice(-4);
          const newProd = {
            name: pName,
            dci: cDci !== -1 ? cols[cDci] : '',
            brand: cBrand !== -1 ? cols[cBrand] : '',
            form: cForm !== -1 ? cols[cForm] : '',
            code: code,
            category: 'Médicament',
            salePrice: sellPrice,
            purchasePrice: buyPrice,
            minStock: 10,
            status: 'active'
          };
          const prodId = await DB.dbAdd('products', newProd);
          prod = { ...newProd, id: prodId };
          productsAll.push(prod);
          newProductsCount++;
        }

        // 2. Créer ou Mettre à jour la Facture (Smart Invoice)
        if (invoiceNum) {
          let inv = invoicesAll.find(inv => inv.invoiceNumber.toLowerCase() === invoiceNum.toLowerCase());
          const invoiceItem = {
            productId: prod.id,
            productName: prod.name,
            quantity: qty,
            unitPrice: buyPrice || prod.purchasePrice || 0,
            total: qty * (buyPrice || prod.purchasePrice || 0),
            lotNumber: lotNumber,
            expiryDate: expiryStr
          };

          if (inv) {
            inv.items = inv.items || [];
            inv.items.push(invoiceItem);
            inv.totalAmount = (inv.totalAmount || 0) + invoiceItem.total;
            await DB.dbPut('invoices', inv);
          } else {
            let supId = null;
            if (supplierName) {
              const sup = suppliersAll.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
              if (sup) supId = sup.id;
            }
            inv = {
              invoiceNumber: invoiceNum,
              supplierId: supId,
              supplierName: supplierName || 'Import CSV',
              date: new Date().toISOString().split('T')[0],
              status: 'validated',
              items: [invoiceItem],
              totalAmount: invoiceItem.total,
              paymentMethod: '',
              note: 'Import automatique depuis CSV Stock',
              createdAt: Date.now()
            };
            const invId = await DB.dbAdd('invoices', inv);
            inv.id = invId;
            invoicesAll.push(inv);
            newInvoicesCount++;
          }
        }

        // 3. Créer le Lot
        await DB.dbAdd('lots', {
          productId: prod.id,
          lotNumber: lotNumber,
          expiryDate: expiryStr,
          quantity: qty,
          initialQuantity: qty,
          receiptDate: new Date().toISOString().split('T')[0],
          status: 'active',
          invoiceRef: invoiceNum || null,
          location: location
        });

        // 4. Mettre à jour le Stock total
        const stockAll = await DB.dbGetAll('stock');
        const existingStock = stockAll.find(s => s.productId === prod.id);
        if (existingStock) {
          await DB.dbPut('stock', { ...existingStock, quantity: existingStock.quantity + qty });
        } else {
          await DB.dbAdd('stock', { productId: prod.id, quantity: qty, reservedQuantity: 0 });
        }

        // 5. Mouvement
        await DB.dbAdd('movements', {
          productId: prod.id,
          type: 'ENTRY',
          subType: 'PURCHASE',
          quantity: qty,
          lotNumber: lotNumber,
          reference: invoiceNum || 'CSV',
          date: new Date().toISOString(),
          userId: DB.AppState.currentUser?.id,
          note: 'Import CSV'
        });

        importedCount++;
      }

      UI.toast(`Import réussi : ${importedCount} lots, ${newProductsCount} produits créés, ${newInvoicesCount} factures créées`, 'success');
      document.getElementById('import-stock-file').value = '';
      if (typeof DB.syncToSupabase === 'function') DB.syncToSupabase();
      Router.navigate('stock');

    } catch (err) {
      UI.toast(err.message || 'Erreur lors de la lecture du fichier', 'error');
      document.getElementById('import-stock-file').value = '';
    }
  };
  reader.readAsText(file);
};

window.showImportStockModal = function() {
  const content = `
    <div class="info-box" style="margin-bottom:15px">
      <strong>Format attendu :</strong> Fichier CSV avec séparateur point-virgule (;).<br>
      Le système reconnaîtra automatiquement les colonnes. S'ils n'existent pas, les produits et les factures seront créés automatiquement.
      <br><br>
      Colonnes obligatoires : <b>Nom</b>, <b>Quantité</b>.<br>
      Si <b>Emplacement</b> (Rayon / Réserve) n'est pas précisé, le stock ira en Réserve par défaut.
    </div>
    <div style="display:flex; gap:10px; justify-content:center;">
      <button class="btn btn-outline" onclick="downloadStockCsvTemplate()"><i data-lucide="download"></i> Télécharger le Modèle</button>
      <button class="btn btn-primary" onclick="document.getElementById('import-stock-file').click()"><i data-lucide="upload"></i> Choisir le Fichier CSV</button>
    </div>
  `;
  UI.modal('<i data-lucide="file-spreadsheet" class="modal-icon-inline"></i> Importation Avancée de Stock', content);
  if (window.lucide) lucide.createIcons();
};

window.downloadStockCsvTemplate = function() {
  const headers = "Nom;Quantité;Achat;Vente;Expiration;Lot;Emplacement;Facture;Fournisseur;DCI;Marque;Forme\\n";
  const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Modele_Import_Stock.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

window.filterStockEntryProducts = function(query) {
  const resultsDiv = document.getElementById('stock-entry-product-results');
  if (!resultsDiv) return;
  
  // Update productId to empty if user is typing manually
  document.getElementById('stock-entry-product-id').value = '';
  
  if (!query || query.length < 2) {
    resultsDiv.style.display = 'none';
    return;
  }
  const q = query.toLowerCase();
  const products = window._stockData || [];
  const matches = products.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.code || '').toLowerCase().includes(q) ||
    (p.dci || '').toLowerCase().includes(q)
  ).slice(0, 20);

  let html = '';
  
  if (matches.length > 0) {
    html += matches.map(p => `
      <div style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;display:flex;justify-content:space-between;align-items:center;"
           onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''"
           onclick="selectStockEntryProduct(${p.id}, '${(p.name || '').replace(/'/g, "\\'")}')">
        <div><strong>${p.name}</strong> <span class="text-muted">${p.dci || ''}</span></div>
        <code class="code-tag">${p.code}</code>
      </div>
    `).join('');
  }
  
  html += `
    <div style="padding:10px;cursor:pointer;background:rgba(46,134,193,0.1);color:#2E86C1;font-size:13px;text-align:center;border-top:1px solid var(--border);"
         onclick="selectStockEntryProduct('', '${query.replace(/'/g, "\\'")}')">
      <i data-lucide="plus-circle" style="width:14px;height:14px;vertical-align:middle;"></i> Ajouter comme nouveau médicament : <strong>${query}</strong>
      <div style="font-size:11px;opacity:0.8;margin-top:2px;">(Il est conseillé de créer depuis le catalogue)</div>
    </div>
  `;

  resultsDiv.innerHTML = html;
  if (window.lucide) lucide.createIcons();
  resultsDiv.style.display = 'block';
};

window.selectStockEntryProduct = async function(id, label) {
  document.getElementById('stock-entry-product-id').value = id || '';
  document.getElementById('stock-entry-product-search').value = label;
  document.getElementById('stock-entry-product-results').style.display = 'none';

  if (!id) return;
  const products = window._stockData || [];
  const prod = products.find(p => p.id == id);
  if (!prod) return;

  const getF = (name) => document.querySelector(`#stock-entry-form [name="${name}"]`);
  
  if (getF('purchasePrice') && !getF('purchasePrice').value) getF('purchasePrice').value = prod.purchasePrice || '';
  if (getF('salePrice') && !getF('salePrice').value) getF('salePrice').value = prod.salePrice || '';
  if (getF('supplier') && !getF('supplier').value && prod.supplierId) {
    try {
      const sups = await DB.dbGetAll('suppliers');
      const sup = sups.find(s => s.id === prod.supplierId);
      if (sup) getF('supplier').value = sup.name;
    } catch(e) {}
  }

  try {
    const lots = await DB.dbGetAll('lots');
    const activeLots = lots.filter(l => l.productId == id && l.status === 'active' && l.lotNumber && l.expiryDate);
    if (activeLots.length > 0) {
      activeLots.sort((a,b) => new Date(b.receiptDate || 0) - new Date(a.receiptDate || 0));
      const recentLot = activeLots[0];
      if (getF('lotNumber') && !getF('lotNumber').value) getF('lotNumber').value = recentLot.lotNumber;
      if (getF('expiryDate') && !getF('expiryDate').value) getF('expiryDate').value = recentLot.expiryDate;
    } else {
      if (getF('expiryDate') && !getF('expiryDate').value && prod && prod.expiryDate) {
        getF('expiryDate').value = prod.expiryDate;
      }
    }
  } catch(e) {}
};

window._softRefreshStock = async function() {
  if (document.getElementById('stock-table-container')) {
    const [products, stockAll, lots] = await Promise.all([
      DB.dbGetAll('products'),
      DB.dbGetAll('stock'),
      DB.dbGetAll('lots'),
    ]);
    const stockMap = {};
    stockAll.forEach(s => { stockMap[s.productId] = s; });
    const lotsMap = {};
    lots.forEach(l => {
      if (l.status === 'active') {
        if (!lotsMap[l.productId]) lotsMap[l.productId] = [];
        lotsMap[l.productId].push(l);
      }
    });
    const stockData = products.map(p => {
      const pLots = lotsMap[p.id] || [];
      let qtyRayon = 0, qtyReserve = 0;
      pLots.forEach(l => {
        if (!l.location || l.location === 'rayon') qtyRayon += (l.quantity || 0);
        else qtyReserve += (l.quantity || 0);
      });
      return {
        ...p,
        currentStock: stockMap[p.id]?.quantity || 0,
        reservedQty: stockMap[p.id]?.reservedQuantity || 0,
        lots: pLots,
        qtyRayon,
        qtyReserve
      };
    });
    window._stockData = stockData;
    
    // Update stats bar if it exists
    const inStock = stockData.filter(p => p.currentStock > 0).length;
    const ruptures = stockData.filter(p => p.currentStock === 0).length;
    const lowStock = stockData.filter(p => p.currentStock > 0 && p.currentStock <= p.minStock).length;
    const alertExpiry = lots.filter(l => {
      const days = UI.daysUntilExpiry(l.expiryDate);
      return l.status === 'active' && days !== null && days <= 90;
    }).length;
    
    const statsVals = document.querySelectorAll('.stats-bar .stat-val');
    if (statsVals.length >= 5) {
      statsVals[0].textContent = products.length;
      statsVals[1].textContent = inStock;
      statsVals[2].textContent = lowStock;
      statsVals[3].textContent = ruptures;
      statsVals[4].textContent = alertExpiry;
    }
    
    if (typeof filterStock === 'function') {
      filterStock();
    }
  }
};

window.exportStockPDF = function() {
  if (!window.PDFExport) return UI.toast("Module PDF non chargé", "error");
  const data = (window._stockData || []).map(p => [
    p.code,
    p.name,
    p.currentStock.toString(),
    p.qtyRayon.toString(),
    p.qtyReserve.toString(),
    UI.formatCurrency(p.purchasePrice || 0)
  ]);
  const headers = ["Code", "Produit", "Stock Total", "Rayon", "Réserve", "Prix Achat"];
  window.PDFExport.generate("État du Stock Global", headers, data);
};

window.exportInventoryPDF = function() {
  if (!window.PDFExport) return UI.toast("Module PDF non chargé", "error");
  const data = (window._inventoryItems || []).map(item => [
    item.code,
    item.name,
    item.systemQty.toString(),
    (item.physicalQty !== undefined ? item.physicalQty : '').toString(),
    ((item.physicalQty || 0) - item.systemQty).toString()
  ]);
  const headers = ["Code", "Produit", "Stock Système", "Qté Physique", "Écart"];
  window.PDFExport.generate("Procès-Verbal d'Inventaire", headers, data, { orientation: 'l' });
};

Router.register('stock', renderStock);
