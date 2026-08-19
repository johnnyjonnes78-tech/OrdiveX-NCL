/**
 * OrdiveX — Catalogue Produits
 */

async function deduplicateProducts() {
  try {
    const products = await DB.dbGetAll('products');
    const nameGroups = {};
    
    // Regrouper par nom insensible à la casse et aux espaces superflus
    products.forEach(p => {
      if (!p.name) return;
      const key = p.name.trim().toLowerCase();
      if (!nameGroups[key]) nameGroups[key] = [];
      nameGroups[key].push(p);
    });
    
    let hasChanges = false;
    
    // Charger tous les bons de commande en mémoire une seule fois
    const purchaseOrders = await DB.dbGetAll('purchaseOrders') || [];
    const modifiedPOs = new Map();

    for (const key in nameGroups) {
      const group = nameGroups[key];
      if (group.length <= 1) continue;
      
      // Calculer le score de complétion pour chaque produit du groupe
      const scored = group.map(p => {
        let score = 0;
        const fields = [
          'code', 'genericName', 'brand', 'form', 'category', 'subcategory',
          'purchasePrice', 'salePrice', 'expiryDate', 'barcode', 'minStock',
          'maxStock', 'location', 'supplier', 'lab', 'requiresPrescription',
          'isControlled', 'notes', 'image'
        ];
        fields.forEach(f => {
          if (p[f] !== undefined && p[f] !== null && p[f] !== '' && p[f] !== 0 && p[f] !== false) {
            score++;
          }
        });
        return { product: p, score: score };
      });
      
      // Trier par score décroissant
      scored.sort((a, b) => b.score - a.score);
      
      const master = scored[0].product;
      const slaves = scored.slice(1).map(s => s.product);
      
      for (const slave of slaves) {
        console.log(`[Deduplication] Fusion de ${slave.name} (ID: ${slave.id}) vers Master ${master.name} (ID: ${master.id})`);
        
        // 1. Lots
        const slaveLots = await DB.dbGetAll('lots', 'productId', slave.id) || [];
        for (const lot of slaveLots) {
          lot.productId = master.id;
          lot._synced = false;
          lot._updatedAt = Date.now();
          await DB.dbPut('lots', lot);
        }
        
        // 2. Mouvements
        const slaveMovements = await DB.dbGetAll('movements', 'productId', slave.id) || [];
        for (const mov of slaveMovements) {
          mov.productId = master.id;
          mov._synced = false;
          mov._updatedAt = Date.now();
          await DB.dbPut('movements', mov);
        }
        
        // 3. Stock
        const slaveStock = await DB.dbGet('stock', slave.id);
        if (slaveStock) {
          const masterStock = await DB.dbGet('stock', master.id) || { productId: master.id, quantity: 0, reservedQuantity: 0 };
          masterStock.quantity = (masterStock.quantity || 0) + (slaveStock.quantity || 0);
          masterStock.reservedQuantity = (masterStock.reservedQuantity || 0) + (slaveStock.reservedQuantity || 0);
          masterStock._synced = false;
          masterStock._updatedAt = Date.now();
          await DB.dbPut('stock', masterStock);
          await DB.dbDelete('stock', slave.id);
        }
        
        // 4. SaleItems (Filtrage à la source via index productId — ultra performant)
        const slaveSaleItems = await DB.dbGetAll('saleItems', 'productId', slave.id) || [];
        for (const si of slaveSaleItems) {
          si.productId = master.id;
          si._synced = false;
          si._updatedAt = Date.now();
          await DB.dbPut('saleItems', si);
        }
        
        // 5. PurchaseOrders
        purchaseOrders.forEach(po => {
          let poChanged = false;
          if (po.items && Array.isArray(po.items)) {
            po.items.forEach(it => {
              if (it.productId === slave.id) {
                it.productId = master.id;
                poChanged = true;
              }
            });
          }
          if (poChanged) {
            po._synced = false;
            po._updatedAt = Date.now();
            modifiedPOs.set(po.id, po);
          }
        });
        
        // 6. Désactiver définitivement le produit esclave (soft delete pour Supabase)
        // car si on fait un dbDelete local immédiat, l'appareil n'enverra rien à Supabase
        // et le doublon réapparaîtra au prochain pull depuis Supabase.
        slave.status = 'inactive';
        slave._synced = false;
        slave._updatedAt = Date.now();
        await DB.dbPut('products', slave);
        hasChanges = true;
      }
    }

    // Sauvegarder les PO modifiés en bloc
    if (modifiedPOs.size > 0) {
      for (const po of modifiedPOs.values()) {
        await DB.dbPut('purchaseOrders', po);
      }
      console.log(`[Deduplication] ${modifiedPOs.size} bons de commande mis à jour.`);
    }

    if (hasChanges) {
      console.log('[Deduplication] Doublons résolus avec succès.');
      // Lancer un push pour propager les modifications
      if (window.NM && typeof window.NM.requestSync === 'function') {
        window.NM.requestSync();
      }
    }
  } catch (err) {
    console.error('[Deduplication] Erreur lors de la déduplication :', err);
  }
}

async function renderProducts(container) {
  UI.loading(container, 'Chargement des produits...');
  
  const [products, stockData, lotsAll] = await Promise.all([
    DB.dbGetAll('products'),
    DB.dbGetAll('stock'),
    DB.dbGetAll('lots'),
  ]);

  // Indexer les lots actifs avec stock > 0 par productId
  const lotsMapProd = {};
  lotsAll.forEach(l => {
    if (l.status === 'active' && (l.quantity || 0) > 0 && l.expiryDate) {
      if (!lotsMapProd[l.productId]) lotsMapProd[l.productId] = [];
      lotsMapProd[l.productId].push(l.expiryDate);
    }
  });

  // KPIs Inventaire — calcul local
  const stockMap = {};
  stockData.forEach(s => { stockMap[s.productId] = s.quantity || 0; });
  let valAchat = 0, valVente = 0, rupture = 0;
  products.forEach(p => {
    const qty = stockMap[p.id] || 0;
    const pa = parseFloat(p.purchasePrice || p.prixAchat || 0);
    const pv = parseFloat(p.salePrice || p.price || p.prixVente || 0);
    valAchat += pa * qty;
    valVente += pv * qty;
    if (qty <= 0) rupture++;
  });
  const profit = valVente - valAchat;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Catalogue Produits</h1>
        <p class="page-subtitle">${products.length} produits référencés</p>
      </div>
      <div class="header-actions">
        ${Auth.can('products_import') ? `<button class="btn btn-secondary" onclick="showImportModal()"><i data-lucide="upload"></i> Importer</button>` : ''}
        ${Auth.can('products_export') ? `
          <button class="btn btn-secondary" onclick="exportProductsPDF()"><i data-lucide="printer"></i> PDF</button>
          <button class="btn btn-secondary" onclick="exportProducts()"><i data-lucide="download"></i> CSV</button>
        ` : ''}
        ${Auth.can('products_create') ? `<button class="btn btn-primary" onclick="showAddProduct()"><i data-lucide="plus"></i> Nouveau Produit</button>` : ''}
      </div>
    </div>

    <!-- Dashboard Inventaire KPIs -->
    <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 16px;">
      ${Auth.can('products_view_purchase_price') ? `<div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(46,134,193,0.1);color:#2E86C1"><i data-lucide="package"></i></div>
        <div class="kpi-info"><div class="kpi-value">${UI.formatCurrency(valAchat)}</div><div class="kpi-label">Valeur Stock (Achat)</div></div>
      </div>` : ''}
      <div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(30,132,73,0.1);color:#1E8449"><i data-lucide="banknote"></i></div>
        <div class="kpi-info"><div class="kpi-value">${UI.formatCurrency(valVente)}</div><div class="kpi-label">Valeur Stock (Vente)</div></div>
      </div>
      ${Auth.can('products_view_profit') ? `<div class="kpi-card">
        <div class="kpi-icon" style="background:rgba(142,68,173,0.1);color:#8E44AD"><i data-lucide="trending-up"></i></div>
        <div class="kpi-info"><div class="kpi-value">${UI.formatCurrency(profit)}</div><div class="kpi-label">Profit Potentiel</div></div>
      </div>` : ''}
      <div class="kpi-card">
        <div class="kpi-icon" style="background:${rupture > 0 ? 'rgba(214,59,59,0.1)' : 'rgba(30,132,73,0.1)'};color:${rupture > 0 ? '#D63B3B' : '#1E8449'}"><i data-lucide="alert-circle"></i></div>
        <div class="kpi-info"><div class="kpi-value" style="color:${rupture > 0 ? 'var(--danger)' : 'inherit'}">${rupture}</div><div class="kpi-label">En Rupture</div></div>
      </div>
    </div>

    <div class="filter-bar">
      <input type="text" id="prod-search" placeholder="Rechercher..." class="filter-input" oninput="filterProducts()">
      <select id="prod-cat" class="filter-select" onchange="filterProducts()">
        <option value="">Toutes catégories</option>
        ${(() => {
          const allProductCats = new Set(products.map(p => (p.category || '').trim()).filter(Boolean));
          const builtOptions = _PHARMA_CATEGORIES.map(g => {
            const existingItems = g.items.filter(item => allProductCats.has(item));
            if (existingItems.length === 0) return '';
            return `<optgroup label="${g.group}">${existingItems.map(c => `<option value="${c}">${c}</option>`).join('')}</optgroup>`;
          }).join('');
          const coveredCats = new Set(_PHARMA_CATEGORIES.flatMap(g => g.items));
          const leftoverCats = [...allProductCats].filter(c => !coveredCats.has(c)).sort();
          const leftoversOptGroup = leftoverCats.length > 0 ? `<optgroup label="Autres">${leftoverCats.map(c => `<option value="${c}">${c}</option>`).join('')}</optgroup>` : '';
          return builtOptions + leftoversOptGroup;
        })()}
      </select>
      <select id="prod-form" class="filter-select" onchange="filterProducts()">
        <option value="">Toutes les formes</option>
        ${[...new Set(products.map(p => (p.form || p.forme || '').trim()).filter(Boolean))].sort().map(f => `<option value="${f}">${f}</option>`).join('')}
      </select>
      <select id="prod-sort" class="filter-select" onchange="filterProducts()">
        <option value="alpha-asc" selected>De A à Z</option>
        <option value="alpha-desc">De Z à A</option>
        <option value="">Tri par ordre d'ajout</option>
      </select>
      <select id="prod-rx" class="filter-select" onchange="filterProducts()">
        <option value="">Rx + OTC</option>
        <option value="1">Ordonnance (Rx)</option>
        <option value="0">Sans ordonnance (OTC)</option>
      </select>
      <select id="prod-status" class="filter-select" onchange="filterProducts()">
        <option value="active" selected>Statut : Actifs</option>
        <option value="inactive">Statut : Inactifs (Supprimés)</option>
        <option value="all">Statut : Tous</option>
      </select>
    </div>
    <div id="prod-table-container"></div>
  `;

  // Calculer la date la plus proche des lots actifs pour chaque produit
  const enrichedProducts = products.map(p => {
    const dates = lotsMapProd[p.id] || [];
    const closestExpiry = dates.length > 0
      ? dates.sort((a, b) => new Date(a) - new Date(b))[0]
      : null;
    return { ...p, _closestExpiry: closestExpiry };
  });

  window._productsData = enrichedProducts;
  window._selectedProductIds = new Set(); // init sélection vide
  filterProducts();
  if (window.lucide) lucide.createIcons();
  if (window._autoAnimateKPIValues) setTimeout(_autoAnimateKPIValues, 100);

  if (!document.getElementById('scroll-float-btns')) {
    const scrollWidget = document.createElement('div');
    scrollWidget.id = 'scroll-float-btns';
    scrollWidget.innerHTML = `
      <button onclick="window.scrollTo({top:0,behavior:'smooth'})" style="width:40px;height:40px;border-radius:50%;border:none;background:var(--primary);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.2)"><i data-lucide='chevron-up'></i></button>
      <button onclick="window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})" style="width:40px;height:40px;border-radius:50%;border:none;background:var(--primary);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.2)"><i data-lucide='chevron-down'></i></button>
    `;
    scrollWidget.style.cssText = 'position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:8px;z-index:999';
    document.body.appendChild(scrollWidget);
    if (window.lucide) lucide.createIcons();
  }
  Router.onLeave(() => {
    const el = document.getElementById('scroll-float-btns');
    if (el) el.remove();
  });
}

function filterProducts() {
  const search = (document.getElementById('prod-search')?.value || '').toLowerCase();
  const cat = document.getElementById('prod-cat')?.value || '';
  const form = document.getElementById('prod-form')?.value || '';
  const sort = document.getElementById('prod-sort')?.value || 'alpha-asc';
  const rx = document.getElementById('prod-rx')?.value;
  const status = document.getElementById('prod-status')?.value || 'active';
  let data = window._productsData || [];
  
  if (search) data = data.filter(p => p.name.toLowerCase().includes(search) || (p.dci || '').toLowerCase().includes(search) || (p.code || '').toLowerCase().includes(search));
  if (cat) data = data.filter(p => p.category === cat);
  if (form) data = data.filter(p => (p.form || p.forme || '').trim() === form);
  if (rx !== '') data = data.filter(p => p.requiresPrescription === (rx === '1'));
  
  if (status === 'active') {
    data = data.filter(p => p.status !== 'inactive');
  } else if (status === 'inactive') {
    data = data.filter(p => p.status === 'inactive');
  }

  
  // Sorting
  if (sort === 'alpha' || sort === 'alpha-asc') {
    data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sort === 'alpha-desc') {
    data.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
  }
  
  renderProductsTable(data);
}

function renderProductsTable(data) {
  const container = document.getElementById('prod-table-container');
  if (!container) return;

  // Pagination
  const PAGE_SIZE = 100;
  window._filteredProducts = data;
  window._prodPage = window._prodPage || 1;
  if (data !== window._lastFilteredData) {
    window._prodPage = 1;
    window._lastFilteredData = data;
  }

  const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  if (window._prodPage > totalPages) window._prodPage = totalPages;
  const start = (window._prodPage - 1) * PAGE_SIZE;
  const pageData = data.slice(start, start + PAGE_SIZE);

  if (!window._selectedProductIds) window._selectedProductIds = new Set();

  // ── Barre d'actions groupées ──────────────────────────────────
  const selCount = window._selectedProductIds.size;
  const bulkBarHtml = selCount > 0 ? `
    <div id="bulk-action-bar" style="
      position:sticky;top:0;z-index:40;
      display:flex;align-items:center;gap:12px;flex-wrap:wrap;
      background:var(--primary);color:#fff;
      padding:10px 16px;border-radius:10px;margin-bottom:12px;
      box-shadow:0 4px 16px rgba(46,134,193,0.35);
      animation:fadeInDown 0.2s ease;
    ">
      <span style="font-weight:700;font-size:14px">
        <i data-lucide="check-square" style="width:16px;height:16px;vertical-align:middle;margin-right:6px"></i>
        ${selCount} produit${selCount>1?'s':''} sélectionné${selCount>1?'s':''}
      </span>
      <div style="flex:1"></div>
      <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);" onclick="bulkEditProducts()">
        <i data-lucide="pencil" style="width:14px;height:14px"></i> Modifier en lot
      </button>
      <button class="btn btn-sm" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);" onclick="bulkReactivateProducts()">
        <i data-lucide="toggle-right" style="width:14px;height:14px"></i> Réactiver
      </button>
      <button class="btn btn-sm" style="background:rgba(214,59,59,0.8);color:#fff;border:none;" onclick="bulkDeleteProducts()">
        <i data-lucide="trash-2" style="width:14px;height:14px"></i> Désactiver
      </button>
      <button class="btn btn-xs" style="background:rgba(255,255,255,0.1);color:#fff;border:none;padding:4px 10px;" onclick="clearProductSelection()" title="Désélectionner tout">
        ✕ Désélectionner
      </button>
    </div>` : '';

  const allPageSelected = pageData.length > 0 && pageData.every(p => window._selectedProductIds.has(p.id));

  const columns = [
    {
      label: `<input type="checkbox" id="chk-all-products" ${allPageSelected ? 'checked' : ''}
        onchange="toggleSelectAllProducts(this.checked)"
        style="width:16px;height:16px;cursor:pointer;">`,
      render: r => `<input type="checkbox" class="prod-chk" data-id="${r.id}"
        ${window._selectedProductIds.has(r.id) ? 'checked' : ''}
        onchange="toggleProductSelection(${r.id},this.checked)"
        style="width:16px;height:16px;cursor:pointer;">`
    },
    { label: 'Code', render: r => `<code class="code-tag">${r.code}</code>` },
    { label: 'Produit', render: r => `<div><strong>${r.name}</strong><br><span class="text-muted text-sm">${r.dci || ''} ${r.dosage || ''}</span></div>` },
    { label: 'Marque', key: 'brand' },
    { label: 'Forme', key: 'form' },
    { label: 'Catégorie', render: r => `<span class="category-tag">${r.category}</span>` },
    { label: 'Statut', render: r => {
      let badges = r.requiresPrescription ? '<span class="badge badge-warning">Rx</span>' : '<span class="badge badge-success">OTC</span>';
      if (r.isControlled) badges += ` <span class="badge badge-danger" title="${r.controlledClass || 'Substance Contrôlée'}">SC</span>`;
      if (r.status === 'inactive') badges += ' <span class="badge badge-danger">Inactif</span>';
      return badges;
    }},
    { label: 'Prix Vente', render: r => `<strong>${UI.formatCurrency(r.salePrice)}</strong>` },
    { label: 'Prochain Lot Exp.', render: r => {
      if (r._closestExpiry) return UI.expiryBadge ? UI.expiryBadge(r._closestExpiry) : r._closestExpiry;
      if (r.expiryDate) return '<span class="text-muted" title="Aucun stock actif — date historique">' + (UI.expiryBadge ? UI.expiryBadge(r.expiryDate) : r.expiryDate) + ' ⊘</span>';
      return '<span class="text-muted">—</span>';
    }},
  ];

  if (Auth.can('products_view_purchase_price')) {
    columns.push({ label: 'Prix Achat', render: r => UI.formatCurrency(r.purchasePrice) });
  }
  if (Auth.can('products_view_margin')) {
    columns.push({ label: 'Marge', render: r => {
        const m = r.salePrice && r.purchasePrice ? ((r.salePrice - r.purchasePrice) / r.salePrice * 100).toFixed(0) : 0;
        return `<span class="badge badge-${m >= 30 ? 'success' : m >= 20 ? 'warning' : 'danger'}">${m}%</span>`;
    }});
  }

  columns.push({
    label: 'Actions', render: r => `
    <div class="actions-cell">
      <button class="btn btn-xs btn-primary" onclick="viewProduct(${r.id})" title="Détails"><i data-lucide="eye"></i></button>
      ${Auth.can('products_edit') ? `<button class="btn btn-xs btn-secondary" onclick="editProductForm(${r.id})" title="Modifier"><i data-lucide="edit-3"></i></button>` : ''}
      ${Auth.can('products_delete') ? (r.status === 'inactive'
        ? `<button class="btn btn-xs btn-success" onclick="reactivateProduct(${r.id})" title="Réactiver"><i data-lucide="rotate-ccw"></i></button>`
        : `<button class="btn btn-xs btn-danger" onclick="deleteProduct(${r.id})" title="Désactiver"><i data-lucide="trash-2"></i></button>`) : ''}
    </div>`
  });

  // Injecter la barre d'actions + tableau
  const wrapper = document.createElement('div');
  wrapper.innerHTML = bulkBarHtml;
  container.innerHTML = '';
  container.appendChild(wrapper);

  const tableWrapper = document.createElement('div');
  UI.table(tableWrapper, columns, pageData, { emptyMessage: 'Aucun produit trouvé', emptyIcon: 'pill', paginate: false });
  container.appendChild(tableWrapper);

  // Pagination controls
  const pagDiv = document.createElement('div');
  pagDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:16px 0;gap:12px;flex-wrap:wrap;';
  pagDiv.innerHTML = `
    <span style="font-size:13px;color:var(--text-muted)">${data.length.toLocaleString()} produits — Page ${window._prodPage}/${totalPages}</span>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-secondary btn-sm" ${window._prodPage <= 1 ? 'disabled' : ''} onclick="window._prodPage--;renderProductsTable(window._filteredProducts)">◀ Précédent</button>
      <button class="btn btn-secondary btn-sm" ${window._prodPage >= totalPages ? 'disabled' : ''} onclick="window._prodPage++;renderProductsTable(window._filteredProducts)">Suivant ▶</button>
    </div>
  `;
  container.appendChild(pagDiv);
  if (window.lucide) lucide.createIcons();
}

// ── Fonctions de sélection multiple ─────────────────────────────────

function toggleProductSelection(id, checked) {
  if (!window._selectedProductIds) window._selectedProductIds = new Set();
  if (checked) window._selectedProductIds.add(id);
  else window._selectedProductIds.delete(id);
  renderProductsTable(window._filteredProducts || window._productsData || []);
}

function toggleSelectAllProducts(checked) {
  if (!window._selectedProductIds) window._selectedProductIds = new Set();
  const pageData = (window._filteredProducts || window._productsData || []);
  const PAGE_SIZE = 100;
  const page = window._prodPage || 1;
  const start = (page - 1) * PAGE_SIZE;
  const current = pageData.slice(start, start + PAGE_SIZE);
  current.forEach(p => {
    if (checked) window._selectedProductIds.add(p.id);
    else window._selectedProductIds.delete(p.id);
  });
  renderProductsTable(pageData);
}

function clearProductSelection() {
  window._selectedProductIds = new Set();
  renderProductsTable(window._filteredProducts || window._productsData || []);
}

// ── Désactivation en lot ──────────────────────────────────────────────
async function bulkDeleteProducts() {
  const ids = [...(window._selectedProductIds || [])];
  if (!ids.length) return;
  if (window.Auth && !Auth.can('products_delete') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission de désactiver des produits.', 'error', 5000);
    return;
  }
  const ok = await UI.confirm(
    `⚠️ Désactiver ${ids.length} produit${ids.length > 1 ? 's' : ''} ?\n\n` +
    `Les produits seront masqués du catalogue et du POS.\nCette action est réversible.`
  );
  if (!ok) return;

  let done = 0;
  for (const id of ids) {
    const p = await DB.dbGet('products', id).catch(() => null);
    if (p) {
      await DB.dbPut('products', { ...p, status: 'inactive', updatedAt: Date.now() });
      done++;
    }
  }
  await DB.writeAudit('BULK_DEACTIVATE', 'products', null, { ids, count: done });
  window._selectedProductIds = new Set();
  window._allProducts = null; // invalider le cache du sélecteur produit (bons de commande)
  UI.toast(`✅ ${done} produit${done > 1 ? 's' : ''} désactivé${done > 1 ? 's' : ''}.`, 'success');
  Router.navigate('products');
}

// ── Réactivation en lot ─────────────────────────────────────────────
async function bulkReactivateProducts() {
  const ids = [...(window._selectedProductIds || [])];
  if (!ids.length) return;
  const ok = await UI.confirm(
    `Réactiver ${ids.length} produit${ids.length > 1 ? 's' : ''} ?\n\nIls seront de nouveau visibles dans le catalogue et le POS.`
  );
  if (!ok) return;
  let done = 0;
  for (const id of ids) {
    const p = await DB.dbGet('products', id).catch(() => null);
    if (p) {
      await DB.dbPut('products', { ...p, status: 'active', updatedAt: Date.now() });
      done++;
    }
  }
  window._selectedProductIds = new Set();
  window._allProducts = null; // invalider le cache du sélecteur produit (bons de commande)
  UI.toast(`✅ ${done} produit${done > 1 ? 's' : ''} réactivé${done > 1 ? 's' : ''}.`, 'success');
  Router.navigate('products');
}

// ── Édition en lot ────────────────────────────────────────────────────
async function bulkEditProducts() {
  const ids = [...(window._selectedProductIds || [])];
  if (!ids.length) return;

  const [suppliers, products] = await Promise.all([
    DB.dbGetAll('suppliers'),
    Promise.all(ids.map(id => DB.dbGet('products', id)))
  ]);

  const FIELDS = [
    { value: 'category',             label: 'Catégorie' },
    { value: 'form',                 label: 'Forme galénique' },
    { value: 'salePrice',            label: 'Prix de vente' },
    { value: 'purchasePrice',        label: "Prix d'achat" },
    { value: 'minStock',             label: 'Seuil minimum de stock' },
    { value: 'expiryDate',           label: 'Date de péremption' },
    { value: 'requiresPrescription', label: 'Ordonnance requise (Rx/OTC)' },
    { value: 'status',               label: 'Statut (actif/inactif)' },
    { value: 'brand',                label: 'Marque / Laboratoire' },
    { value: 'tva',                  label: 'TVA (%)' },
    { value: 'unit',                 label: 'Unité de vente' },
  ];

  const categoryGroups = window._PHARMA_CATEGORIES || [];
  const allCats = categoryGroups.flatMap(g => g.items || []);
  const allForms = ['Comprimé','Gélule','Sirop','Suspension','Solution injectable','Pommade','Crème','Gel','Suppositoire','Ovule','Gouttes','Spray','Inhalateur','Patch','Sachet','Granulé','Lyophilisat'];

  // Template des options pour les selects
  const supplierOptions = `<option value="">— Aucun —</option>` + suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  const catOptions = `<option value="">— Choisir —</option>` + allCats.map(c => `<option value="${c}">${c}</option>`).join('');
  const formOptions = `<option value="">— Choisir —</option>` + allForms.map(f => `<option value="${f}">${f}</option>`).join('');

  // Stocker les données pour la pagination
  window._bulkEditProducts = products.filter(Boolean);
  window._bulkSuppliers = suppliers;
  window._bulkGridPage = 1;
  window._bulkGridPerPage = 10;

  UI.modal(
    `<i data-lucide="layers" class="modal-icon-inline"></i> Modification en lot — ${ids.length} produit${ids.length > 1 ? 's' : ''}`,
    `
    <div class="tabs-bar" style="margin-bottom:15px;display:flex;gap:4px;">
      <button class="tab-btn active" id="bulk-tab-identical-btn" onclick="switchBulkTab('identical')"><i data-lucide="equal"></i> Modification identique</button>
      <button class="tab-btn" id="bulk-tab-grid-btn" onclick="switchBulkTab('grid')"><i data-lucide="table"></i> Grille d'édition individuelle</button>
    </div>

    <!-- Mode Identique -->
    <div id="bulk-identical-panel" class="form-grid">
      <div class="form-group" style="grid-column:1/-1">
        <label class="form-label">Champ à modifier globalement</label>
        <select id="bulk-field" class="form-select" onchange="renderBulkEditInput()">
          <option value="">— Choisir un champ —</option>
          ${FIELDS.map(f => `<option value="${f.value}">${f.label}</option>`).join('')}
        </select>
      </div>
      <div id="bulk-value-container" style="grid-column:1/-1"></div>
      <div style="grid-column:1/-1;padding:10px 12px;background:var(--surface-2);border-radius:8px;font-size:13px;color:var(--text-muted)">
        ℹ️ Cette modification globale appliquera la même valeur aux <strong>${ids.length} produits</strong> sélectionnés.
      </div>
    </div>

    <!-- Mode Grille -->
    <div id="bulk-grid-panel" style="display:none;">
      <div style="overflow-x:auto; max-height:400px; border:1px solid var(--border); border-radius:8px; margin-bottom:12px;">
        <table class="data-table" style="font-size:12px; min-width:1100px;">
          <thead>
            <tr>
              <th>Désignation</th>
              <th>P. Achat</th>
              <th>P. Vente</th>
              <th>Marge</th>
              <th>Seuil Min</th>
              <th>Péremption</th>
              <th>Catégorie</th>
              <th>Forme</th>
              <th>Fournisseur</th>
            </tr>
          </thead>
          <tbody id="bulk-grid-tbody">
            <!-- Contenu dynamique paginé -->
          </tbody>
        </table>
      </div>
      <div id="bulk-grid-pagination"></div>
      <div style="padding:10px 12px;background:var(--surface-2);border-radius:8px;font-size:13px;color:var(--text-muted);margin-top:10px;">
        ℹ️ Ajustez les valeurs individuellement pour chaque produit de la grille avant de sauvegarder.
      </div>
    </div>
    `,
    {
      size: 'large',
      footer: `
        <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
        <button class="btn btn-primary" id="bulk-save-btn" onclick="applyBulkEdit()"><i data-lucide="check"></i> Enregistrer les modifications</button>
      `
    }
  );
  if (window.lucide) lucide.createIcons();
  
  // Rendre la première page
  window.renderBulkGridPage(1);

  // Stocker l'état actuel de l'onglet actif
  window._bulkActiveTab = 'identical';
  window._bulkSelectedIds = ids;
}

window.switchBulkTab = function(tab) {
  window._bulkActiveTab = tab;
  const identicalPanel = document.getElementById('bulk-identical-panel');
  const gridPanel = document.getElementById('bulk-grid-panel');
  const identicalBtn = document.getElementById('bulk-tab-identical-btn');
  const gridBtn = document.getElementById('bulk-tab-grid-btn');
  const saveBtn = document.getElementById('bulk-save-btn');

  if (tab === 'identical') {
    if (identicalPanel) identicalPanel.style.display = 'grid';
    if (gridPanel) gridPanel.style.display = 'none';
    identicalBtn?.classList.add('active');
    gridBtn?.classList.remove('active');
    if (saveBtn) saveBtn.setAttribute('onclick', 'applyBulkEdit()');
  } else {
    if (identicalPanel) identicalPanel.style.display = 'none';
    if (gridPanel) gridPanel.style.display = 'block';
    identicalBtn?.classList.remove('active');
    gridBtn?.classList.add('active');
    if (saveBtn) saveBtn.setAttribute('onclick', 'window.applyBulkEditGrid()');
    window.renderBulkGridPage(window._bulkGridPage || 1);
  }
};

window.updateBulkRowMargin = function(id) {
  const paInput = document.getElementById(`bulk-row-pa-${id}`);
  const pvInput = document.getElementById(`bulk-row-pv-${id}`);
  const marginSpan = document.getElementById(`bulk-row-marge-${id}`);
  if (!paInput || !pvInput || !marginSpan) return;

  const pa = parseFloat(paInput.value) || 0;
  const pv = parseFloat(pvInput.value) || 0;
  
  const margin = pv > 0 ? ((pv - pa) / pv * 100).toFixed(1) : 0;
  marginSpan.innerText = `${margin}%`;
};

function renderBulkEditInput() {
  const field = document.getElementById('bulk-field')?.value;
  const cont = document.getElementById('bulk-value-container');
  if (!cont || !field) return;

  const categoryGroups = window._PHARMA_CATEGORIES || [];
  const allCats = categoryGroups.flatMap(g => g.items || []);

  const inputs = {
    category: `
      <div class="form-group">
        <label class="form-label">Nouvelle catégorie</label>
        <select id="bulk-value" class="form-select">
          <option value="">— Choisir —</option>
          ${allCats.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>`,
    form: `
      <div class="form-group">
        <label class="form-label">Nouvelle forme galénique</label>
        <select id="bulk-value" class="form-select">
          <option value="">— Choisir —</option>
          ${['Comprimé','Gélule','Sirop','Suspension','Solution injectable','Pommade','Crème','Gel','Suppositoire','Ovule','Gouttes','Spray','Inhalateur','Patch','Sachet','Granulé','Lyophilisat'].map(f => `<option value="${f}">${f}</option>`).join('')}
        </select>
      </div>`,
    salePrice: `
      <div class="form-group">
        <label class="form-label">Nouveau prix de vente (GNF)</label>
        <input id="bulk-value" type="number" min="0" step="1" class="form-input" placeholder="Ex: 15000">
      </div>`,
    purchasePrice: `
      <div class="form-group">
        <label class="form-label">Nouveau prix d'achat (GNF)</label>
        <input id="bulk-value" type="number" min="0" step="1" class="form-input" placeholder="Ex: 10000">
      </div>`,
    minStock: `
      <div class="form-group">
        <label class="form-label">Seuil minimum de stock (unités)</label>
        <input id="bulk-value" type="number" min="0" step="1" class="form-input" placeholder="Ex: 10">
      </div>`,
    expiryDate: `
      <div class="form-group">
        <label class="form-label">Date de péremption</label>
        <input id="bulk-value" type="date" class="form-input">
      </div>`,
    requiresPrescription: `
      <div class="form-group">
        <label class="form-label">Ordonnance requise</label>
        <select id="bulk-value" class="form-select">
          <option value="false">OTC — Sans ordonnance</option>
          <option value="true">Rx — Ordonnance requise</option>
        </select>
      </div>`,
    status: `
      <div class="form-group">
        <label class="form-label">Statut</label>
        <select id="bulk-value" class="form-select">
          <option value="active">Actif — visible dans le catalogue</option>
          <option value="inactive">Inactif — masqué du catalogue et POS</option>
        </select>
      </div>`,
    brand: `
      <div class="form-group">
        <label class="form-label">Marque / Laboratoire</label>
        <input id="bulk-value" type="text" class="form-input" placeholder="Ex: Sanofi, Pfizer...">
      </div>`,
    tva: `
      <div class="form-group">
        <label class="form-label">TVA (%)</label>
        <input id="bulk-value" type="number" min="0" max="100" step="0.1" class="form-input" placeholder="Ex: 18">
      </div>`,
    unit: `
      <div class="form-group">
        <label class="form-label">Unité de vente</label>
        <select id="bulk-value" class="form-select">
          <option value="boîte">Boîte</option>
          <option value="flacon">Flacon</option>
          <option value="tube">Tube</option>
          <option value="sachet">Sachet</option>
          <option value="unité">Unité</option>
          <option value="ampoule">Ampoule</option>
        </select>
      </div>`,
  };

  cont.innerHTML = inputs[field] || '<p class="text-muted">Sélectionnez un champ.</p>';
}

async function applyBulkEdit() {
  const field = document.getElementById('bulk-field')?.value;
  const rawValue = document.getElementById('bulk-value')?.value;
  if (!field || rawValue === '' || rawValue === null || rawValue === undefined) {
    UI.toast('Veuillez sélectionner un champ et saisir une valeur.', 'warning'); return;
  }

  let value = rawValue;
  if (field === 'requiresPrescription') value = (rawValue === 'true');
  else if (['salePrice','purchasePrice','minStock','tva'].includes(field)) value = parseFloat(rawValue) || 0;

  const ids = window._bulkSelectedIds || [];
  let done = 0;

  const lotCascadeFields = { salePrice: 'salePrice', purchasePrice: 'purchasePrice', expiryDate: 'expiryDate' };

  for (const id of ids) {
    const p = await DB.dbGet('products', id).catch(() => null);
    if (!p) continue;

    await DB.dbPut('products', { ...p, [field]: value, updatedAt: Date.now() });
    done++;

    if (lotCascadeFields[field]) {
      const allLots = await DB.dbGetAll('lots').catch(() => []);
      const productLots = allLots.filter(l => l.productId === id && l.status === 'active');
      for (const lot of productLots) {
        await DB.dbPut('lots', { ...lot, [lotCascadeFields[field]]: value, updatedAt: Date.now() });
      }
    }
  }

  await DB.writeAudit('BULK_EDIT', 'products', null, { ids, field, value, count: done });
  UI.closeModal();
  window._selectedProductIds = new Set();
  UI.toast(`Champ "${field}" mis à jour sur ${done} produits (et leurs lots).`, 'success');
  Router.navigate('products');
}

window._updateBulkProductField = function(id, field, value) {
  const p = (window._bulkEditProducts || []).find(x => x.id === id);
  if (!p) return;
  if (['purchasePrice', 'salePrice', 'minStock'].includes(field)) {
    p[field] = parseFloat(value) || 0;
  } else if (field === 'supplierId') {
    p[field] = parseInt(value) || null;
  } else {
    p[field] = value;
  }

  if (field === 'purchasePrice' || field === 'salePrice') {
    const marginSpan = document.getElementById(`bulk-row-marge-${id}`);
    if (marginSpan) {
      const pa = p.purchasePrice || 0;
      const pv = p.salePrice || 0;
      const margin = pv > 0 ? ((pv - pa) / pv * 100).toFixed(1) : 0;
      marginSpan.innerText = `${margin}%`;
    }
  }
};

window.renderBulkGridPage = function(page) {
  window._bulkGridPage = page;
  const products = window._bulkEditProducts || [];
  const suppliers = window._bulkSuppliers || [];
  const categoryGroups = window._PHARMA_CATEGORIES || [];
  const allCats = categoryGroups.flatMap(g => g.items || []);
  const allForms = ['Comprimé','Gélule','Sirop','Suspension','Solution injectable','Pommade','Crème','Gel','Suppositoire','Ovule','Gouttes','Spray','Inhalateur','Patch','Sachet','Granulé','Lyophilisat'];

  const start = (page - 1) * window._bulkGridPerPage;
  const end = start + window._bulkGridPerPage;
  const pageProducts = products.slice(start, end);

  const tbody = document.getElementById('bulk-grid-tbody');
  if (!tbody) return;

  tbody.innerHTML = pageProducts.map(p => {
    const margin = p.salePrice && p.purchasePrice ? ((p.salePrice - p.purchasePrice) / p.salePrice * 100).toFixed(1) : 0;
    const canPA = Auth.can('products_view_purchase_price');
    const canMarge = Auth.can('products_view_margin');
    return `
      <tr id="bulk-row-${p.id}">
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><strong>${p.name}</strong></td>
        <td>${canPA ? `<input type="number" id="bulk-row-pa-${p.id}" value="${p.purchasePrice || ''}" class="form-input" style="width:90px;padding:4px 8px;" oninput="window._updateBulkProductField(${p.id}, 'purchasePrice', this.value)">` : '<span class="text-muted">—</span>'}</td>
        <td><input type="number" id="bulk-row-pv-${p.id}" value="${p.salePrice || ''}" class="form-input" style="width:90px;padding:4px 8px;" oninput="window._updateBulkProductField(${p.id}, 'salePrice', this.value)"></td>
        <td>${canMarge ? `<strong id="bulk-row-marge-${p.id}" style="color:var(--primary);">${margin}%</strong>` : '<span class="text-muted">—</span>'}</td>
        <td><input type="number" id="bulk-row-min-${p.id}" value="${p.minStock || 10}" class="form-input" style="width:70px;padding:4px 8px;" oninput="window._updateBulkProductField(${p.id}, 'minStock', this.value)"></td>
        <td><input type="date" id="bulk-row-exp-${p.id}" value="${p.expiryDate || ''}" class="form-input" style="width:125px;padding:4px 8px;" oninput="window._updateBulkProductField(${p.id}, 'expiryDate', this.value)"></td>
        <td>
          <select id="bulk-row-cat-${p.id}" class="form-select" style="width:130px;padding:4px 8px;" onchange="window._updateBulkProductField(${p.id}, 'category', this.value)">
            <option value="">— Choisir —</option>
            ${allCats.map(c => `<option value="${c}" ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </td>
        <td>
          <select id="bulk-row-form-${p.id}" class="form-select" style="width:110px;padding:4px 8px;" onchange="window._updateBulkProductField(${p.id}, 'form', this.value)">
            <option value="">— Choisir —</option>
            ${allForms.map(f => `<option value="${f}" ${(p.form || p.forme) === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </td>
        <td>
          <select id="bulk-row-sup-${p.id}" class="form-select" style="width:120px;padding:4px 8px;" onchange="window._updateBulkProductField(${p.id}, 'supplierId', this.value)">
            <option value="">— Aucun —</option>
            ${suppliers.map(s => `<option value="${s.id}" ${p.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </td>
      </tr>
    `;
  }).join('');

  const totalPages = Math.ceil(products.length / window._bulkGridPerPage);
  const pagCont = document.getElementById('bulk-grid-pagination');
  if (pagCont) {
    pagCont.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; font-size:13px; color:var(--text-muted)">
        <div>Affichage de ${products.length ? start + 1 : 0} à ${Math.min(end, products.length)} sur ${products.length} produits</div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sm ${page > 1 ? 'btn-outline' : ''}" ${page === 1 ? 'disabled' : ''} onclick="window.renderBulkGridPage(${page - 1})">Précédent</button>
          <span style="align-self:center;margin:0 4px;">Page ${page} / ${totalPages || 1}</span>
          <button class="btn btn-sm ${page < totalPages ? 'btn-outline' : ''}" ${page === totalPages ? 'disabled' : ''} onclick="window.renderBulkGridPage(${page + 1})">Suivant</button>
        </div>
      </div>
    `;
  }
};

window.applyBulkEditGrid = async function() {
  const products = window._bulkEditProducts || [];
  if (!products.length) return;

  let done = 0;

  for (const p of products) {
    const orig = await DB.dbGet('products', p.id).catch(() => null);
    if (!orig) continue;

    let supName = '';
    if (p.supplierId) {
      const sObj = await DB.dbGet('suppliers', p.supplierId);
      if (sObj) supName = sObj.name;
    }

    const updatedProd = {
      ...orig,
      purchasePrice: p.purchasePrice,
      salePrice: p.salePrice,
      minStock: p.minStock,
      expiryDate: p.expiryDate || null,
      category: p.category,
      form: p.form,
      supplierId: p.supplierId,
      supplier: supName || null,
      updatedAt: Date.now()
    };

    await DB.dbPut('products', updatedProd);
    done++;

    // Mettre à jour en cascade dans les lots actifs
    const allLots = await DB.dbGetAll('lots').catch(() => []);
    const productLots = allLots.filter(l => l.productId === p.id && l.status === 'active');
    for (const lot of productLots) {
      await DB.dbPut('lots', {
        ...lot,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        expiryDate: p.expiryDate || null,
        supplier: supName || null,
        updatedAt: Date.now()
      });
    }
  }

  await DB.writeAudit('BULK_EDIT_GRID', 'products', null, { count: done });
  UI.closeModal();
  window._selectedProductIds = new Set();
  UI.toast(`Grille enregistrée avec succès. ${done} produits mis à jour.`, 'success');
  Router.navigate('products');
};

async function viewProduct(id) {
  const p = await DB.dbGet('products', id);
  if (!p) return;
  const margin = p.salePrice && p.purchasePrice ? ((p.salePrice - p.purchasePrice) / p.salePrice * 100).toFixed(1) : 0;
  const hasNotice = p.dosageInstructions || p.precautions || p.contraindications || p.sideEffects || p.medicalNotice;
  UI.modal(`<i data-lucide="pill" class="modal-icon-inline"></i> ${p.name}`, `
    <div class="product-detail-grid">
      <div class="detail-row"><span class="detail-label">Code</span><span><code>${p.code}</code></span></div>
      <div class="detail-row"><span class="detail-label">DCI</span><span>${p.dci || '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Marque</span><span>${p.brand || '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Forme</span><span>${p.form || '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Dosage</span><span>${p.dosage || '—'}</span></div>
      <div class="detail-row"><span class="detail-label">Catégorie</span><span><span class="category-tag">${p.category}</span></span></div>
      <div class="detail-row"><span class="detail-label">Statut</span><span>${p.requiresPrescription ? '<span class="badge badge-warning">Ordonnance requise</span>' : '<span class="badge badge-success">OTC</span>'}${p.isControlled ? ` <span class="badge badge-danger">${p.controlledClass || 'Substance Contrôlée'}</span>` : ''}</span></div>
      <div class="detail-row"><span class="detail-label">Prix Vente</span><span class="text-success font-bold">${UI.formatCurrency(p.salePrice)}</span></div>
      ${Auth.can('products_view_purchase_price') ? `<div class="detail-row"><span class="detail-label">Prix Achat</span><span>${UI.formatCurrency(p.purchasePrice)}</span></div>` : ''}
      ${Auth.can('products_view_margin') ? `<div class="detail-row"><span class="detail-label">Marge</span><span class="font-bold">${margin}%</span></div>` : ''}
      <div class="detail-row"><span class="detail-label">Date de Péremption</span><span>${p.expiryDate ? (UI.expiryBadge ? UI.expiryBadge(p.expiryDate) : p.expiryDate) : '<span class="text-muted">Non renseignée</span>'}</span></div>
      <div class="detail-row"><span class="detail-label">Seuil minimum</span><span>${p.minStock} unités</span></div>
      ${p.allowUnitSale ? `
      <div class="detail-row" style="grid-column:1/-1; background:var(--primary-light,rgba(46,134,193,0.1)); padding:8px 12px; border-radius:6px; margin-top:8px;">
        <div style="display:flex; align-items:center; gap:6px; font-weight:600; color:var(--primary); margin-bottom:4px"><i data-lucide="package-open" style="width:16px;height:16px"></i> Vente au détail autorisée</div>
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
          <span>Boîte de <strong>${p.subUnitsPerBox || 1}</strong> Plaquette(s)</span>
          <span>Prix de la plaquette : <strong>${UI.formatCurrency(p.pricePerSubUnit || p.salePrice)}</strong></span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:13px">
          <span>Plaquette de <strong>${p.unitsPerBox || 1}</strong> Unité(s)</span>
          <span>Prix de l'unité : <strong>${UI.formatCurrency(p.pricePerUnit || 0)}</strong></span>
        </div>
      </div>` : ''}
    </div>
    ${hasNotice ? `
      <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border)">
        <h4 style="margin-bottom:12px; display:flex; align-items:center; gap:8px; font-size:14px"><i data-lucide="file-text"></i> Notice Médicale</h4>
        ${p.dosageInstructions ? `<div style="margin-bottom:12px"><strong style="font-size:12px;color:var(--primary)">📋 Posologie</strong><p style="margin:4px 0 0;font-size:13px;color:var(--text)">${p.dosageInstructions}</p></div>` : ''}
        ${p.precautions ? `<div style="margin-bottom:12px; padding:10px; background:rgba(232,145,58,0.08); border-radius:8px; border-left:3px solid var(--warning)"><strong style="font-size:12px;color:var(--warning)">⚠️ Précautions</strong><p style="margin:4px 0 0;font-size:13px">${p.precautions}</p></div>` : ''}
        ${p.contraindications ? `<div style="margin-bottom:12px; padding:10px; background:rgba(214,59,59,0.08); border-radius:8px; border-left:3px solid var(--danger)"><strong style="font-size:12px;color:var(--danger)">🚫 Contre-indications</strong><p style="margin:4px 0 0;font-size:13px">${p.contraindications}</p></div>` : ''}
        ${p.sideEffects ? `<div style="margin-bottom:12px"><strong style="font-size:12px;color:var(--text-muted)">💊 Effets indésirables</strong><p style="margin:4px 0 0;font-size:13px;color:var(--text)">${p.sideEffects}</p></div>` : ''}
        ${p.medicalNotice ? `<div style="margin-bottom:12px"><strong style="font-size:12px;color:var(--info)">📄 Notice complète</strong><p style="margin:4px 0 0;font-size:13px;color:var(--text);white-space:pre-line">${p.medicalNotice}</p></div>` : ''}
        ${p.noticePdfUrl ? `<div style="margin-top:12px; padding-top:12px; border-top:1px dashed var(--border)"><a href="${p.noticePdfUrl}" target="_blank" download="notice_${p.dci||p.name}.pdf" class="btn btn-sm btn-outline"><i data-lucide="file-down"></i> Télécharger la Notice PDF du Laboratoire</a></div>` : ''}
      </div>
    ` : '<div style="margin-top:16px;padding:12px;background:var(--surface-2);border-radius:8px;text-align:center;font-size:12px;color:var(--text-muted)"><i data-lucide="info" style="width:14px;height:14px;vertical-align:text-bottom"></i> Aucune notice médicale renseignée</div>'}
  `, { size: 'medium' });
}

// Catégories médicaments + parapharmacie (Phase 2 v9.4 — 55+ catégories)
window._PHARMA_CATEGORIES = [
  { group: 'Médicaments — Système Nerveux', items: ['Antalgique', 'Anti-inflammatoire', 'Antipyrétique', 'Anxiolytique', 'Antidépresseur', 'Antiépileptique', 'Neuroleptique', 'Myorelaxant', 'Anesthésique local'] },
  { group: 'Médicaments — Infectiologie', items: ['Antibiotique', 'Antiviral', 'Antifongique', 'Antiparasitaire', 'Antipaludique', 'Antituberculeux', 'Antiseptique'] },
  { group: 'Médicaments — Cardio & Vasculaire', items: ['Antihypertenseur', 'Antiarythmique', 'Anticoagulant', 'Vasodilatateur', 'Hypolipémiant', 'Diurétique', 'Veinotonique'] },
  { group: 'Médicaments — Métabolisme', items: ['Antidiabétique', 'Thyroïdien', 'Corticostéroïde', 'Hormone'] },
  { group: 'Médicaments — Appareil Digestif', items: ['Gastroprotecteur', 'Antiacide', 'Antiémétique', 'Laxatif', 'Antidiarrhéique', 'Antispasmodique', 'Hépatoprotecteur'] },
  { group: 'Médicaments — Appareil Respiratoire', items: ['Antitussif', 'Expectorant', 'Bronchodilatateur', 'Antihistaminique', 'Décongestionnant'] },
  { group: 'Médicaments — Spécialités', items: ['Ophtalmologie', 'ORL', 'Dermatologie', 'Urologie', 'Gynécologie', 'Rhumatologie', 'Hématologie', 'Oncologie'] },
  { group: 'Médicaments — Autres', items: ['Vitamine', 'Complément alimentaire', 'Réhydratation', 'Vaccin', 'Sérum', 'Anti-allergie'] },
  { group: 'Parapharmacie', items: ['Parfumerie & Cosmétique', 'Hygiène & Soins', 'Huiles & Compléments', 'Nutrition & Diététique', 'Bébé & Maternité', 'Matériel Médical', 'Accessoires', 'Orthopédie', 'Optique & Lunetterie', 'Aromathérapie', 'Phytothérapie', 'Bien-être & Relaxation'] },
  { group: 'Autre', items: ['Autre'] }
];
const _PHARMA_CATEGORIES = window._PHARMA_CATEGORIES;

window._PARA_CATEGORIES = ['Parfumerie & Cosmétique', 'Hygiène & Soins', 'Huiles & Compléments', 'Nutrition & Diététique', 'Bébé & Maternité', 'Matériel Médical', 'Accessoires', 'Orthopédie', 'Optique & Lunetterie', 'Aromathérapie', 'Phytothérapie', 'Bien-être & Relaxation'];
const _PARA_CATEGORIES = window._PARA_CATEGORIES;

function _buildCategoryOptions(selected) {
  return _PHARMA_CATEGORIES.map(g =>
    '<optgroup label="' + g.group + '">' +
    g.items.map(c => '<option value="' + c + '"' + (c === selected ? ' selected' : '') + '>' + c + '</option>').join('') +
    '</optgroup>'
  ).join('');
}

// Datalist pour input libre avec autocomplétion
function _buildCategoryDatalist(listId) {
  var opts = [];
  _PHARMA_CATEGORIES.forEach(function(g) {
    g.items.forEach(function(c) { opts.push('<option value="' + c + '">'); });
  });
  return '<datalist id="' + listId + '">' + opts.join('') + '</datalist>';
}

function _buildCategoryInput(formId, selected, listId) {
  return '<input type="text" name="category" class="form-control" value="' + (selected || '') + '"' +
    ' list="' + listId + '" placeholder="Choisir ou saisir..." required' +
    ' oninput="_onCategoryChange(\'' + formId + '\')">' +
    _buildCategoryDatalist(listId);
}

function _onCategoryChange(formId) {
  var form = document.getElementById(formId);
  if (!form) return;
  var cat = form.querySelector('[name="category"]')?.value || '';
  var isPara = _PARA_CATEGORIES.indexOf(cat) !== -1;
  // Masquer/afficher les sections médicales
  var medSections = form.querySelectorAll('.med-only-section');
  medSections.forEach(function(el) { el.style.display = isPara ? 'none' : ''; });
  // Masquer/afficher le champ DCI
  var dciGroup = form.querySelector('.dci-group');
  if (dciGroup) dciGroup.style.display = isPara ? 'none' : '';
  // Masquer/afficher Rx
  var rxGroup = form.querySelector('.rx-group');
  if (rxGroup) rxGroup.style.display = isPara ? 'none' : '';
}

window._autoCalcSalePrice = async function(mode) {
  const typeEl = document.getElementById(`product-type-${mode}`);
  const buyEl = document.getElementById(`purchase-price-${mode}`);
  const sellEl = document.getElementById(`sale-price-${mode}`);
  const hintEl = document.getElementById(`sale-price-hint-${mode}`);
  
  if (!typeEl || !buyEl || !sellEl || sellEl.dataset.manual === 'true') return;
  
  const buyPrice = parseFloat(buyEl.value) || 0;
  if (buyPrice <= 0) return;
  
  const type = typeEl.value;
  if (!type) return; // Si aucun type n'est sélectionné, pas de calcul auto

  let coeff = type === 'specialty' ? 1.40 : 1.12;
  
  try {
    const settings = await DB.dbGetAll('settings');
    const cs = settings.find(s => s.key === 'pricing_coeff_specialty')?.value;
    const cg = settings.find(s => s.key === 'pricing_coeff_generic')?.value;
    if (type === 'specialty' && cs) coeff = parseFloat(cs) || 1.40;
    if (type === 'generic' && cg) coeff = parseFloat(cg) || 1.12;
  } catch(e) {}
  
  const calculated = Math.round(buyPrice * coeff);
  sellEl.value = calculated;
  if (hintEl) hintEl.textContent = `(calculé auto : ×${coeff.toFixed(2)})`;
};

async function showAddProduct() {
  const products = await DB.dbGetAll('products');
  const codeAuto = 'P' + String(products.length + 1).padStart(3, '0');

  UI.modal('<i data-lucide="plus-circle" class="modal-icon-inline"></i> Nouveau Produit', `
    <form id="product-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>Code *</label>
          <input type="text" name="code" class="form-control" value="${codeAuto}" required>
        </div>
        <div class="form-group dci-group">
          <label>DCI (Nom générique)</label>
          <div style="display:flex; gap:8px">
            <input type="text" name="dci" class="form-control" placeholder="Paracétamol">
            <button type="button" class="btn btn-secondary btn-sm" onclick="simulerVidalCloud('product-form')" style="white-space:nowrap;flex-shrink:0" title="Base Médicale — Résumé des Caractéristiques du Produit"><i data-lucide="cloud-lightning"></i> Base RCP</button>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nom commercial *</label>
          <input type="text" name="name" class="form-control" required>
        </div>
        <div class="form-group">
          <label>Marque / Laboratoire</label>
          <div style="display:flex;gap:4px">
            <input type="text" name="brand" class="form-control" placeholder="Labo ou Marque">
            <select name="manufacturer" class="form-control" style="width:120px">
              <option value="">Labo (Dict)</option>
              <option>Sanofi</option><option>Pfizer</option><option>GSK</option><option>Bayer</option><option>Novartis</option><option>AstraZeneca</option><option>Pierre Fabre</option><option>Biogaran</option>
            </select>
          </div>
        </div>
      </div>
      <div class="form-row med-only-section">
        <div class="form-group">
          <label>Forme galénique</label>
          <input type="text" name="form" class="form-control" placeholder="Comprimé, Sirop...">
        </div>
        <div class="form-group">
          <label>Dosage</label>
          <input type="text" name="dosage" class="form-control" placeholder="500mg">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Catégorie *</label>
          ${_buildCategoryInput('product-form', '', 'cat-list-add')}
        </div>
        <div class="form-group rx-group">
          <label>Statut</label>
          <select name="requiresPrescription" class="form-control">
            <option value="0">OTC — Sans ordonnance</option>
            <option value="1">Rx — Sur ordonnance</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type de produit (Tarification)</label>
          <select name="productType" id="product-type-add" class="form-control" onchange="_autoCalcSalePrice('add')">
            <option value="">Non spécifié (manuel)</option>
            <option value="specialty">Spécialité (marque) — ×1.40</option>
            <option value="generic">Générique (DCI) — ×1.12</option>
          </select>
        </div>
        <div class="form-group">
          <label>Prix d'achat (GNF)</label>
          <input type="number" name="purchasePrice" id="purchase-price-add" class="form-control" min="0" oninput="_autoCalcSalePrice('add')">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix de vente (GNF) * <span style="font-size:11px;color:var(--text-muted);font-weight:400" id="sale-price-hint-add"></span></label>
          <input type="number" name="salePrice" id="sale-price-add" class="form-control" min="0" required oninput="this.dataset.manual='true'; document.getElementById('sale-price-hint-add').textContent='(modifié manuellement)'">
        </div>
        <div class="form-group">
          <label>Seuil minimum (boîtes/unités brutes)</label>
          <input type="number" name="minStock" class="form-control" value="10" min="0">
        </div>
      </div>
      <div class="med-only-section" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border)">
        <h4 style="margin-bottom:12px; font-size:14px; display:flex; align-items:center; gap:8px"><i data-lucide="package-open"></i> Déconditionnement (Vente à l'unité)</h4>
        <div class="form-group">
           <label style="display:flex; align-items:center; gap:8px">
             <input type="checkbox" name="allowUnitSale" id="allowUnitSaleCb" value="1" onchange="document.getElementById('unit-sale-group').style.display = this.checked ? 'block' : 'none'">
             <span>Autoriser la vente à l'unité (fractionner la boîte)</span>
           </label>
        </div>
        <div id="unit-sale-group" style="display:none; background:var(--surface-2); padding:10px; border-radius:6px; margin-top:8px">
          <div class="form-row">
            <div class="form-group">
              <label>Sous-unités par boîte (ex: 2 Plaquettes)</label>
              <input type="number" name="subUnitsPerBox" class="form-control" value="1" min="1" oninput="calcUnitPrice('product-form')">
            </div>
            <div class="form-group">
              <label>Prix de vente (Sous-unité / Plaquette)</label>
              <input type="number" name="pricePerSubUnit" class="form-control" value="0" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Unités par sous-unité (ex: 10 Gélules / Plaquette)</label>
              <input type="number" name="unitsPerBox" class="form-control" value="1" min="1" oninput="calcUnitPrice('product-form')">
            </div>
            <div class="form-group">
              <label>Prix de vente unitaire (Gélule)</label>
              <input type="number" name="pricePerUnit" class="form-control" value="0" min="0">
            </div>
          </div>
        </div>
      </div>
      <div class="form-row med-only-section">
        <div class="form-group">
          <label>Date de Péremption</label>
          <input type="date" name="expiryDate" class="form-control">
        </div>
        <div class="form-group">
          <label>Substance Contrôlée</label>
          <select name="isControlled" class="form-control" onchange="document.getElementById('controlled-class-group').style.display = this.value === '1' ? 'block' : 'none'">
            <option value="0">Non</option>
            <option value="1">Oui — Substance réglementée</option>
          </select>
        </div>
      </div>
      <div class="form-row" id="controlled-class-group" style="display:none">
        <div class="form-group">
          <label>Classification</label>
          <select name="controlledClass" class="form-control">
            <option value="Stupéfiant">Stupéfiant (Tableau I)</option>
            <option value="Psychotrope">Psychotrope (Tableau II)</option>
            <option value="Précurseur">Précurseur chimique</option>
          </select>
        </div>
        <div class="form-group"></div>
      </div>
      <div class="med-only-section" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border)">
        <h4 style="margin-bottom:12px; font-size:14px; display:flex; align-items:center; gap:8px"><i data-lucide="file-text"></i> Notice Médicale</h4>
        <div class="form-group">
          <label>Posologie recommandée</label>
          <textarea name="dosageInstructions" class="form-control" rows="2" placeholder="Ex: Adulte : 1 comprimé 3 fois par jour, pendant 5 jours"></textarea>
        </div>
        <div class="form-group">
          <label>Précautions d'emploi</label>
          <textarea name="precautions" class="form-control" rows="2" placeholder="Ex: Ne pas dépasser la dose prescrite. Prudence en cas d'insuffisance hépatique."></textarea>
        </div>
        <div class="form-group">
          <label>Contre-indications</label>
          <textarea name="contraindications" class="form-control" rows="2" placeholder="Ex: Allergie connue au paracétamol. Insuffisance hépatique sévère."></textarea>
        </div>
        <div class="form-group">
          <label>Effets indésirables</label>
          <textarea name="sideEffects" class="form-control" rows="2" placeholder="Ex: Rarement : réactions cutanées, troubles digestifs."></textarea>
        </div>
        <div class="form-group">
          <label>Notice complète / RCP</label>
          <textarea name="medicalNotice" class="form-control" rows="3" placeholder="Résumé des Caractéristiques du Produit (texte libre)"></textarea>
        </div>
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitProduct()"><i data-lucide="check"></i> Enregistrer</button>
    `
  });
}

async function submitProduct() {
  const form = document.getElementById('product-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  data.name = UI.normalizeText(data.name);
  if (data.dci) data.dci = UI.normalizeText(data.dci);
  if (data.brand) data.brand = UI.normalizeText(data.brand);
  if (data.form) data.form = UI.normalizeText(data.form);
  if (data.category) data.category = UI.normalizeText(data.category);
  if (data.manufacturer) data.manufacturer = UI.normalizeText(data.manufacturer);
  
  data.requiresPrescription = data.requiresPrescription === '1';
  data.isControlled = data.isControlled === '1';
  data.controlledClass = data.isControlled ? (data.controlledClass || 'Stupéfiant') : null;
  data.salePrice = parseFloat(data.salePrice);
  data.purchasePrice = parseFloat(data.purchasePrice || 0);
  data.minStock = parseInt(data.minStock || 10);
  data.manufacturer = data.manufacturer || null;
  data.noticePdfUrl = data.noticePdfUrl || null;
  data.allowUnitSale = !!data.allowUnitSale;
  data.subUnitsPerBox = parseInt(data.subUnitsPerBox || 1);
  data.pricePerSubUnit = parseFloat(data.pricePerSubUnit || 0);
  data.unitsPerBox = parseInt(data.unitsPerBox || 1);
  data.pricePerUnit = parseFloat(data.pricePerUnit || 0);
  data.expiryDate = data.expiryDate || null;
  data.status = 'active';
  try {
    await DB.dbAdd('products', data);
    await DB.writeAudit('ADD_PRODUCT', 'products', null, data);
    UI.closeModal();
    UI.toast('Produit ajouté avec succès', 'success');
    Router.navigate('products');
  } catch (err) {
    UI.toast('Erreur : ' + (err.message.includes('unique') ? 'Ce code produit existe déjà' : err.message), 'error');
  }
}

async function editProductForm(id) {
  const p = await DB.dbGet('products', id);
  if (!p) { UI.toast('Produit introuvable', 'error'); return; }
  const isPara = _PARA_CATEGORIES.indexOf(p.category) !== -1;
  UI.modal('<i data-lucide="edit-3" class="modal-icon-inline"></i> Modifier le Produit', `
    <form id="edit-product-form" class="form-grid">
      <input type="hidden" name="id" value="${p.id}">
      <div class="form-row">
        <div class="form-group">
          <label>Code *</label>
          <input type="text" name="code" class="form-control" value="${p.code || ''}" required>
        </div>
        <div class="form-group dci-group" style="display:${isPara ? 'none' : ''}">
          <label>DCI (Nom générique)</label>
          <div style="display:flex;gap:8px">
            <input type="text" name="dci" class="form-control" value="${p.dci || ''}">
            <button type="button" class="btn btn-secondary btn-sm" onclick="simulerVidalCloud('edit-product-form')" style="white-space:nowrap;flex-shrink:0" title="Base Médicale — Résumé des Caractéristiques du Produit"><i data-lucide="cloud-lightning"></i> Base RCP</button>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Nom commercial *</label>
          <input type="text" name="name" class="form-control" value="${p.name || ''}" required>
        </div>
        <div class="form-group">
          <label>Marque / Laboratoire</label>
          <div style="display:flex;gap:4px">
            <input type="text" name="brand" class="form-control" value="${p.brand || ''}">
            <select name="manufacturer" class="form-control" style="width:120px">
              <option value="">Labo (Dict)</option>
              <option ${p.manufacturer==='Sanofi'?'selected':''}>Sanofi</option><option ${p.manufacturer==='Pfizer'?'selected':''}>Pfizer</option><option ${p.manufacturer==='GSK'?'selected':''}>GSK</option><option ${p.manufacturer==='Bayer'?'selected':''}>Bayer</option><option ${p.manufacturer==='Novartis'?'selected':''}>Novartis</option><option ${p.manufacturer==='AstraZeneca'?'selected':''}>AstraZeneca</option><option ${p.manufacturer==='Pierre Fabre'?'selected':''}>Pierre Fabre</option><option ${p.manufacturer==='Biogaran'?'selected':''}>Biogaran</option>
            </select>
          </div>
        </div>
      </div>
      <div class="form-row med-only-section" style="display:${isPara ? 'none' : ''}">
        <div class="form-group">
          <label>Forme galénique</label>
          <input type="text" name="form" class="form-control" value="${p.form || ''}">
        </div>
        <div class="form-group">
          <label>Dosage</label>
          <input type="text" name="dosage" class="form-control" value="${p.dosage || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Catégorie *</label>
          ${_buildCategoryInput('edit-product-form', p.category, 'cat-list-edit')}
        </div>
        <div class="form-group rx-group" style="display:${isPara ? 'none' : ''}">
          <label>Statut</label>
          <select name="requiresPrescription" class="form-control">
            <option value="0" ${!p.requiresPrescription ? 'selected' : ''}>OTC — Sans ordonnance</option>
            <option value="1" ${p.requiresPrescription ? 'selected' : ''}>Rx — Sur ordonnance</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Type de produit (Tarification)</label>
          <select name="productType" id="product-type-edit" class="form-control" onchange="_autoCalcSalePrice('edit')">
            <option value="" ${!p.productType ? 'selected' : ''}>Non spécifié (manuel)</option>
            <option value="specialty" ${p.productType === 'specialty' ? 'selected' : ''}>Spécialité (marque) — ×1.40</option>
            <option value="generic" ${p.productType === 'generic' ? 'selected' : ''}>Générique (DCI) — ×1.12</option>
          </select>
        </div>
        <div class="form-group">
          <label>Prix d'achat (GNF)</label>
          <input type="number" name="purchasePrice" id="purchase-price-edit" class="form-control" value="${p.purchasePrice || 0}" min="0" oninput="_autoCalcSalePrice('edit')">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Prix de vente (GNF) * <span style="font-size:11px;color:var(--text-muted);font-weight:400" id="sale-price-hint-edit"></span></label>
          <input type="number" name="salePrice" id="sale-price-edit" class="form-control" value="${p.salePrice || 0}" min="0" required oninput="this.dataset.manual='true'; document.getElementById('sale-price-hint-edit').textContent='(modifié manuellement)'">
        </div>
        <div class="form-group">
          <label>Seuil minimum (boîtes)</label>
          <input type="number" name="minStock" class="form-control" value="${p.minStock || 10}" min="0">
        </div>
      </div>
      <div class="med-only-section" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border); display:${isPara ? 'none' : ''}">
        <h4 style="margin-bottom:12px; font-size:14px; display:flex; align-items:center; gap:8px"><i data-lucide="package-open"></i> Déconditionnement (Vente à l'unité)</h4>
        <div class="form-group">
           <label style="display:flex; align-items:center; gap:8px">
             <input type="checkbox" name="allowUnitSale" id="allowUnitSaleCb_edit" value="1" ${p.allowUnitSale ? 'checked' : ''} onchange="document.getElementById('edit-unit-sale-group').style.display = this.checked ? 'block' : 'none'">
             <span>Autoriser la vente à l'unité (fractionner la boîte)</span>
           </label>
        </div>
        <div id="edit-unit-sale-group" style="display:${p.allowUnitSale ? 'block' : 'none'}; background:var(--surface-2); padding:10px; border-radius:6px; margin-top:8px">
          <div class="form-row">
            <div class="form-group">
              <label>Sous-unités par boîte (ex: 2 Plaquettes)</label>
              <input type="number" name="subUnitsPerBox" class="form-control" value="${p.subUnitsPerBox || 1}" min="1" oninput="calcUnitPrice('edit-product-form')">
            </div>
            <div class="form-group">
              <label>Prix de vente (Sous-unité / Plaquette)</label>
              <input type="number" name="pricePerSubUnit" class="form-control" value="${p.pricePerSubUnit || 0}" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Unités par sous-unité (ex: 10 Gélules / Plaquette)</label>
              <input type="number" name="unitsPerBox" class="form-control" value="${p.unitsPerBox || 1}" min="1" oninput="calcUnitPrice('edit-product-form')">
            </div>
            <div class="form-group">
              <label>Prix de vente unitaire (Gélule)</label>
              <input type="number" name="pricePerUnit" class="form-control" value="${p.pricePerUnit || 0}" min="0">
            </div>
          </div>
        </div>
      </div>
      <div class="form-row med-only-section" style="display:${isPara ? 'none' : ''}">
        <div class="form-group">
          <label>Date de Péremption</label>
          <input type="date" name="expiryDate" class="form-control" value="${p.expiryDate || ''}">
        </div>
        <div class="form-group">
          <label>Statut produit</label>
          <select name="status" class="form-control">
            <option value="active" ${p.status === 'active' ? 'selected' : ''}>Actif</option>
            <option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>Inactif — Retiré du catalogue</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Substance Contrôlée</label>
          <select name="isControlled" class="form-control" onchange="document.getElementById('edit-controlled-class-group').style.display = this.value === '1' ? 'block' : 'none'">
            <option value="0" ${!p.isControlled ? 'selected' : ''}>Non</option>
            <option value="1" ${p.isControlled ? 'selected' : ''}>Oui — Substance réglementée</option>
          </select>
        </div>
        <div class="form-group" id="edit-controlled-class-group" style="display:${p.isControlled ? 'block' : 'none'}">
          <label>Classification</label>
          <select name="controlledClass" class="form-control">
            <option value="Stupéfiant" ${p.controlledClass === 'Stupéfiant' ? 'selected' : ''}>Stupéfiant (Tableau I)</option>
            <option value="Psychotrope" ${p.controlledClass === 'Psychotrope' ? 'selected' : ''}>Psychotrope (Tableau II)</option>
            <option value="Précurseur" ${p.controlledClass === 'Précurseur' ? 'selected' : ''}>Précurseur chimique</option>
          </select>
        </div>
      </div>
      <div class="med-only-section" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border); display:${isPara ? 'none' : ''}">
        <h4 style="margin-bottom:12px; font-size:14px; display:flex; align-items:center; gap:8px"><i data-lucide="file-text"></i> Notice Médicale</h4>
        <div class="form-group">
          <label>Posologie recommandée</label>
          <textarea name="dosageInstructions" class="form-control" rows="2">${p.dosageInstructions || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Précautions d'emploi</label>
          <textarea name="precautions" class="form-control" rows="2">${p.precautions || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Contre-indications</label>
          <textarea name="contraindications" class="form-control" rows="2">${p.contraindications || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Effets indésirables</label>
          <textarea name="sideEffects" class="form-control" rows="2">${p.sideEffects || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Notice complète / RCP</label>
          <textarea name="medicalNotice" class="form-control" rows="3">${p.medicalNotice || ''}</textarea>
        </div>
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="updateProduct(${p.id})"><i data-lucide="save"></i> Enregistrer les modifications</button>
    `
  });
}

async function updateProduct(id) {
  const form = document.getElementById('edit-product-form');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }
  const data = Object.fromEntries(new FormData(form));
  const original = await DB.dbGet('products', id);
  if (!original) return;

  // ── Contrôle de permission : modification du prix ──
  const newSalePrice = parseFloat(data.salePrice);
  const newPurchasePrice = parseFloat(data.purchasePrice || 0);
  if ((newSalePrice !== original.salePrice || newPurchasePrice !== original.purchasePrice)
      && !Auth.can('products_edit') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission de modifier les prix.', 'error', 5000);
    return;
  }
  const updated = {
    ...original,
    code: data.code,
    name: UI.normalizeText(data.name),
    dci: data.dci ? UI.normalizeText(data.dci) : '',
    brand: data.brand ? UI.normalizeText(data.brand) : '',
    form: data.form ? UI.normalizeText(data.form) : '',
    dosage: data.dosage,
    category: data.category ? UI.normalizeText(data.category) : '',
    requiresPrescription: data.requiresPrescription === '1',
    isControlled: data.isControlled === '1',
    controlledClass: data.isControlled === '1' ? (data.controlledClass || 'Stupéfiant') : null,
    salePrice: parseFloat(data.salePrice),
    purchasePrice: parseFloat(data.purchasePrice || 0),
    minStock: parseInt(data.minStock || 10),
    allowUnitSale: !!data.allowUnitSale,
    subUnitsPerBox: parseInt(data.subUnitsPerBox || 1),
    pricePerSubUnit: parseFloat(data.pricePerSubUnit || 0),
    unitsPerBox: parseInt(data.unitsPerBox || 1),
    pricePerUnit: parseFloat(data.pricePerUnit || 0),
    unit: data.unit || 'boîte',
    status: data.status || 'active',
    expiryDate: data.expiryDate || null,
    dosageInstructions: data.dosageInstructions || null,
    precautions: data.precautions || null,
    contraindications: data.contraindications || null,
    sideEffects: data.sideEffects || null,
    medicalNotice: data.medicalNotice || null,
    manufacturer: data.manufacturer || null,
    noticePdfUrl: data.noticePdfUrl || original.noticePdfUrl || null
  };
  try {
    await DB.dbPut('products', updated);
    await DB.writeAudit('EDIT_PRODUCT', 'products', id, { name: updated.name, changes: data });

    // ══ PROPAGATION EN CASCADE VERS LES LOTS ACTIFS ══════════════════
    // Prix de vente, prix d'achat ou date de péremption modifiés ?
    const salePriceChanged    = updated.salePrice !== original.salePrice;
    const purchasePriceChanged = updated.purchasePrice !== original.purchasePrice;
    const expiryChanged        = updated.expiryDate !== original.expiryDate;

    if (salePriceChanged || purchasePriceChanged || expiryChanged) {
      try {
        const allLots = await DB.dbGetAll('lots');
        const productLots = allLots.filter(l => l.productId === id && l.status === 'active');
        let lotsUpdated = 0;
        for (const lot of productLots) {
          const lotUpdate = { ...lot, updatedAt: Date.now() };
          // Prix : propagation inconditionnelle vers tous les lots actifs
          if (salePriceChanged)     lotUpdate.salePrice     = updated.salePrice;
          if (purchasePriceChanged) lotUpdate.purchasePrice  = updated.purchasePrice;
          // Date : propagation inconditionnelle vers tous les lots actifs
          if (expiryChanged && updated.expiryDate) lotUpdate.expiryDate = updated.expiryDate;
          await DB.dbPut('lots', lotUpdate);
          lotsUpdated++;
        }
        if (lotsUpdated > 0) {
          console.log(`[Products] Cascade: ${lotsUpdated} lot(s) synchronisés pour "${updated.name}"`);
        }
      } catch (cascadeErr) {
        console.warn('[Products] Erreur cascade lots:', cascadeErr);
      }
    }
    // ═════════════════════════════════════════════════════════════════

    UI.closeModal();
    UI.toast('Produit modifié avec succès', 'success');
    Router.navigate('products');
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (window.Auth && !Auth.can('products_delete') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission de désactiver des produits.', 'error', 5000);
    return;
  }
  const p = await DB.dbGet('products', id);
  if (!p) return;
  const ok = await UI.confirm(`Êtes-vous sûr de vouloir désactiver "${p.name}" ?\n\nLe produit ne sera plus visible dans le catalogue ni au point de vente.`);
  if (!ok) return;
  await DB.dbPut('products', { ...p, status: 'inactive' });
  await DB.writeAudit('DEACTIVATE_PRODUCT', 'products', id, { name: p.name });
  window._allProducts = null; // invalider le cache du sélecteur produit (bons de commande)
  UI.toast('Produit désactivé', 'success');
  Router.navigate('products');
}

async function reactivateProduct(id) {
  if (window.Auth && !Auth.can('products_delete') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission de réactiver des produits.', 'error', 5000);
    return;
  }
  const p = await DB.dbGet('products', id);
  if (!p) return;
  const ok = await UI.confirm(`Réactiver "${p.name}" ?\n\nIl sera de nouveau visible dans le catalogue et le point de vente.`);
  if (!ok) return;
  await DB.dbPut('products', { ...p, status: 'active' });
  await DB.writeAudit('REACTIVATE_PRODUCT', 'products', id, { name: p.name });
  window._allProducts = null; // invalider le cache du sélecteur produit (bons de commande)
  UI.toast('Produit réactivé', 'success');
  Router.navigate('products');
}


function exportProducts() {
  const data = window._productsData || [];
  const csv = '\uFEFFCode,Nom,DCI,Marque,Categorie,Prix Vente,Prix Achat,Rx\n' +
    data.map(p => [p.code, '"' + (p.name || '').replace(/"/g, '""') + '"', p.dci || '', p.brand || '', p.category, p.salePrice, Auth.can('products_view_purchase_price') ? (p.purchasePrice || 0) : '***', p.requiresPrescription ? 'Oui' : 'Non'].join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'produits_pharma_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  UI.toast('Export CSV téléchargé', 'success');
  DB.writeAudit('EXPORT_CSV', 'products', null, { count: data.length, filename: a.download });
}

async function exportProductsPDF() {
  if (!window.PDFExport) {
    UI.toast("Le module PDF n'est pas chargé", "error");
    return;
  }
  
  const products = window._productsData || [];
  const stockData = await DB.dbGetAll('stock');
  const stockMap = {};
  stockData.forEach(s => { stockMap[s.productId] = s.quantity || 0; });
  
  let valAchat = 0;
  let valVente = 0;
  let rupture = 0;
  let faible = 0;
  let expires = 0;
  let proches = 0;
  let totalQty = 0;
  
  const today = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 3); // Proche = 3 mois
  
  const data = products.map(p => {
    const qty = stockMap[p.id] || 0;
    const pa = parseFloat(p.purchasePrice || p.prixAchat || 0);
    const pv = parseFloat(p.salePrice || p.price || p.prixVente || 0);
    
    totalQty += qty;
    valAchat += pa * qty;
    valVente += pv * qty;
    
    if (qty <= 0) rupture++;
    else if (qty <= (p.minStock || 10)) faible++;
    
    if (p.expiryDate) {
      const expD = new Date(p.expiryDate);
      if (expD < today) expires++;
      else if (expD < nextMonth) proches++;
    }
    
    return [
      p.code || '',
      p.name || '',
      p.category || '',
      UI.formatCurrency(pv),
      qty.toString(),
      p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('fr-FR') : '—'
    ];
  });
  
  const headers = ["Code", "Nom du Produit", "Catégorie", "Prix Vente", "En Stock", "Péremption"];
  
  const summaryBlocks = [
    { label: "Nombre total de médicaments référencés", value: products.length.toString() },
    { label: "Quantité totale en stock (tous produits)", value: totalQty.toString() },
    { label: "Valeur totale du stock (Prix Vente)", value: UI.formatCurrency(valVente) },
    { label: "Valeur totale du stock (Prix Achat)", value: UI.formatCurrency(valAchat) },
    { label: "Produits en rupture de stock", value: rupture.toString() },
    { label: "Produits en stock faible", value: faible.toString() },
    { label: "Produits expirés", value: expires.toString() },
    { label: "Produits proches de l'expiration (< 3 mois)", value: proches.toString() }
  ];
  
  await window.PDFExport.generate("Inventaire et État du Stock", headers, data, { orientation: 'p', summaryBlocks });
}

window.filterProducts = filterProducts;
window.exportProductsPDF = exportProductsPDF;
window.viewProduct = viewProduct;
window.showAddProduct = showAddProduct;
window.submitProduct = submitProduct;
window.editProductForm = editProductForm;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.exportProducts = exportProducts;
window._onCategoryChange = _onCategoryChange;
window._buildCategoryOptions = _buildCategoryOptions;
window._buildCategoryInput = _buildCategoryInput;

/* ── Bulk Import Logic ── */

function showImportModal() {
  UI.modal('<i data-lucide="upload" class="modal-icon-inline"></i> Importation de Produits (CSV)', `
    <div class="import-container">
      <p class="mb-1 text-sm">Importez votre catalogue existant depuis un fichier CSV (Excel). Les colonnes attendues sont : <strong>Code, Nom, DCI, Marque, Categorie, Forme, Prix Vente, Prix Achat, Rx</strong>.</p>
      
      <div id="import-drop-zone" class="import-drop-zone">
        <i data-lucide="file-up"></i>
        <div>
          <strong>Cliquez pour choisir un fichier</strong> ou glissez-le ici
          <p class="text-sm text-muted mt-0-5">Format CSV (.csv) uniquement</p>
        </div>
        <input type="file" id="import-file-input" accept=".csv" hidden>
      </div>

      <div id="import-progress" class="import-progress-container">
        <div class="import-progress-bar"><div id="import-progress-fill" class="import-progress-fill"></div></div>
        <div id="import-status" class="import-status-text">Préparation...</div>
      </div>

      <div id="import-results" class="import-results"></div>

      <a href="#" class="import-template-link" onclick="downloadImportTemplate(event)">
        <i data-lucide="download" style="width:12px;height:12px"></i> Télécharger un modèle de fichier
      </a>
    </div>
  `, {
    footer: `<button class="btn btn-secondary" onclick="UI.closeModal()">Fermer</button>`
  });

  const zone = document.getElementById('import-drop-zone');
  const input = document.getElementById('import-file-input');

  if (zone && input) {
    zone.onclick = () => input.click();
    input.onchange = (e) => handleImportFile(e.target.files[0]);

    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('dragover'); };
    zone.ondragleave = () => zone.classList.remove('dragover');
    zone.ondrop = (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleImportFile(e.dataTransfer.files[0]);
    };
  }
  if (window.lucide) lucide.createIcons();
}

async function handleImportFile(file) {
  if (!file) return;
  if (!file.name.endsWith('.csv')) {
    UI.toast('Veuillez sélectionner un fichier CSV', 'error');
    return;
  }

  const zone = document.getElementById('import-drop-zone');
  const progress = document.getElementById('import-progress');
  const results = document.getElementById('import-results');

  if (zone) zone.style.display = 'none';
  if (progress) progress.style.display = 'block';
  if (results) results.style.display = 'none';

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    await processImportCSV(text);
  };
  reader.onerror = () => UI.toast('Erreur de lecture du fichier', 'error');
  reader.readAsText(file, 'UTF-8');
}

async function processImportCSV(content) {
  const status = document.getElementById('import-status');
  const fill = document.getElementById('import-progress-fill');
  const results = document.getElementById('import-results');

  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length <= 1) {
    showImportError('Le fichier est vide ou ne contient que l\'en-tête.');
    return;
  }

  // Vérification préventive du stockage disponible (Lot 2 hardening — F32) :
  // avertir avant de démarrer plutôt que de découvrir un espace insuffisant
  // lot après lot, en plein milieu d'un import de plusieurs milliers de lignes.
  if (typeof DB.checkStorageHealth === 'function') {
    const health = await DB.checkStorageHealth();
    if (health.available && health.percentUsed !== null && health.percentUsed >= 90) {
      const proceed = await UI.confirm(
        `⚠ Stockage local presque plein (${UI.formatPercent(health.percentUsed)} utilisé, ${health.quotaMB - health.usageMB} Mo restants).\n\n` +
        `L'import de ${lines.length - 1} produits peut échouer en cours de route. Continuer quand même ?`
      );
      if (!proceed) return;
    }
  }

  // Detect separator
  const header = lines[0];
  const sep = header.includes(';') ? ';' : ',';
  const columns = header.split(sep).map(c => c.replace(/"/g, '').trim().toLowerCase());

  // Required columns check (relaxed names)
  const map = {
    code: columns.findIndex(c => c.includes('code')),
    name: columns.findIndex(c => c.includes('nom') || c.includes('name')),
    dci: columns.findIndex(c => c.includes('dci')),
    salePrice: columns.findIndex(c => c.includes('vente') || c.includes('sale')),
  };

  if (map.code === -1 || map.name === -1 || map.salePrice === -1) {
    showImportError('Colonnes obligatoires manquantes (Code, Nom, Prix Vente).');
    return;
  }

  // Optional columns
  map.brand = columns.findIndex(c => c.includes('marque') || c.includes('brand'));
  map.category = columns.findIndex(c => c.includes('cat'));
  map.form = columns.findIndex(c => c.includes('form'));
  map.purchasePrice = columns.findIndex(c => c.includes('achat') || c.includes('purchase'));
  map.rx = columns.findIndex(c => c.includes('rx') || c.includes('ord'));
  map.quantity = columns.findIndex(c => c.includes('quantite') || c.includes('quantity') || c.includes('qte') || c.includes('qty') || c.includes('stock'));

  let imported = 0;
  let errors = 0;
  const total = lines.length - 1;

  // Phase 1 : Charger tous les produits existants pour mapper les doublons
  if (status) status.textContent = 'Chargement de la base existante...';
  const allExisting = await DB.dbGetAll('products');
  const codeMap = new Map();
  allExisting.forEach(p => { if (p.code) codeMap.set(p.code.toLowerCase(), p); });

  // Phase 2 : Parser TOUTES les lignes en mémoire (rapide, JS pur)
  if (status) status.textContent = 'Analyse du fichier...';
  const parsedProducts = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const row = lines[i].split(sep).map(v => v.replace(/"/g, '').trim());
      if (row.length < 3) continue; // Ligne trop courte

      const code = row[map.code] || '';
      const name = row[map.name] || '';
      if (!code || !name) { errors++; continue; }

      const existing = codeMap.get(code.toLowerCase());
      const product = {
        ...(existing || {}),
        code,
        name,
        dci: map.dci !== -1 ? (row[map.dci] || '') : (existing?.dci || ''),
        brand: map.brand !== -1 ? (row[map.brand] || '') : (existing?.brand || ''),
        category: map.category !== -1 ? (row[map.category] || 'Autre') : (existing?.category || 'Autre'),
        form: map.form !== -1 ? (row[map.form] || '') : (existing?.form || ''),
        salePrice: parseFloat((row[map.salePrice] || '0').replace(/[^\d.]/g, '')) || 0,
        purchasePrice: map.purchasePrice !== -1 ? parseFloat((row[map.purchasePrice] || '0').replace(/[^\d.]/g, '')) || 0 : (existing?.purchasePrice || 0),
        requiresPrescription: map.rx !== -1 ? (row[map.rx]?.toLowerCase().includes('oui') || row[map.rx] === '1') : (existing?.requiresPrescription || false),
        minStock: existing?.minStock || 10,
        status: 'active',
        unit: existing?.unit || 'boîte',
        _createdAt: existing?._createdAt || Date.now(),
        _importQty: map.quantity !== -1 ? Math.max(0, parseInt((row[map.quantity] || '0').replace(/[^\d]/g, '')) || 0) : 0
      };

      parsedProducts.push(product);
      // Empêcher les doublons dans le fichier lui-même
      codeMap.set(code.toLowerCase(), product);
    } catch (err) {
      errors++;
    }
  }

  // Phase 3 : Écriture IndexedDB par lots via dbBulkPut (1 transaction par lot)
  const BULK_SIZE = 1000;
  const totalParsed = parsedProducts.length;

  for (let i = 0; i < totalParsed; i += BULK_SIZE) {
    const chunk = parsedProducts.slice(i, i + BULK_SIZE);
    try {
      const res = await DB.dbBulkPut('products', chunk);
      // dbBulkPut isole désormais les échecs par enregistrement (Lot 2
      // hardening) : compter précisément succès/rejets réels plutôt que de
      // supposer que tout le lot a réussi dès lors qu'aucune exception globale
      // n'a été levée — sinon des lignes silencieusement rejetées (ex: code
      // dupliqué) seraient comptées à tort comme importées.
      imported += res.count;
      if (res.rejected.length > 0) {
        errors += res.rejected.length;
        console.warn(`[Import] ${res.rejected.length} ligne(s) rejetée(s) dans ce lot :`, res.rejected.map(r => r.error));
      }
    } catch (err) {
      console.error('[Import] Erreur bulk lot:', err);
      errors += chunk.length;
    }

    // Mise à jour barre de progression + pause longue pour laisser le navigateur respirer
    const done = Math.min(i + BULK_SIZE, totalParsed);
    const pct = Math.round((done / totalParsed) * 100);
    if (fill) fill.style.width = pct + '%';
    if (status) status.textContent = `Écriture : ${done.toLocaleString()} / ${totalParsed.toLocaleString()}...`;
    // Pause de 50ms = laisse le navigateur rendre l'UI sans aucun blocage visible
    await new Promise(r => setTimeout(r, 50));
  }

  // Phase 4 : Résultats
  if (fill) fill.style.width = '100%';
  if (status) status.textContent = 'Importation terminée.';
  if (results) {
    results.style.display = 'block';
    results.className = `import-results ${imported > 0 ? 'success' : 'error'}`;
    results.innerHTML = `<strong>Résultat :</strong> ${imported} produits importés avec succès. ${errors > 0 ? `<br><small>${errors} lignes ignorées ou en erreur.</small>` : ''}`;
  }

  await DB.writeAudit('BULK_IMPORT', 'products', null, { imported, errors });

  // Phase 5 : Créer le stock pour les produits avec quantité
  if (map.quantity !== -1) {
    var stockCreated = 0;
    try {
      if (status) status.textContent = 'Mise à jour du stock...';
      var allStock = await DB.dbGetAll('stock');
      var stockMap = {};
      allStock.forEach(function(s) { stockMap[s.productId] = s; });

      for (var qi = 0; qi < parsedProducts.length; qi++) {
        var prod = parsedProducts[qi];
        var qty = prod._importQty || 0;
        if (qty <= 0 || !prod.id) continue;
        try {
          var existingStock = stockMap[prod.id];
          if (existingStock) {
            await DB.dbPut('stock', Object.assign({}, existingStock, { quantity: qty }));
          } else {
            await DB.dbAdd('stock', { productId: prod.id, quantity: qty, reservedQuantity: 0 });
          }
          stockCreated++;
        } catch (se) { console.warn('[Import] Stock error:', prod.code, se); }
      }
      if (stockCreated > 0 && results) {
        results.innerHTML += '<br><small>📦 ' + stockCreated + ' entrée(s) de stock créées/mises à jour.</small>';
      }
    } catch (stockErr) { console.warn('[Import] Stock phase error:', stockErr); }
  }

  setTimeout(() => renderProducts(document.getElementById('app-content')), 1500);
}

function showImportError(msg) {
  const status = document.getElementById('import-status');
  const results = document.getElementById('import-results');
  if (status) status.textContent = 'Échec de l\'importation.';
  if (results) {
    results.style.display = 'block';
    results.className = 'import-results error';
    results.innerHTML = `<strong>Erreur :</strong> ${msg}`;
  }
}

function downloadImportTemplate(e) {
  e.preventDefault();
  const csv = '\uFEFFCode,Nom,DCI,Marque,Categorie,Prix Vente,Prix Achat,Rx,Quantite\nP001,Paracetamole 500mg,Paracétamol,Doliprane,Antalgique,5000,3500,Non,50\nP002,Amoxicilline 1g,Amoxicilline,Clamoxyl,Antibiotique,12000,8500,Oui,30';
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'modele_import_pharma.csv';
  a.click();
}

function calcUnitPrice(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  const salePrice = parseFloat(form.salePrice.value) || 0;
  const subUnitsPerBox = parseInt(form.subUnitsPerBox.value) || 1;
  const unitsPerBox = parseInt(form.unitsPerBox.value) || 1;
  
  const allowUnitSaleCb = form.querySelector('[name="allowUnitSale"]');
  if (allowUnitSaleCb && allowUnitSaleCb.checked) {
     if (subUnitsPerBox > 1) {
        form.pricePerSubUnit.value = Math.ceil(salePrice / subUnitsPerBox);
     } else {
        form.pricePerSubUnit.value = salePrice;
     }
     
     if (unitsPerBox > 1) {
        // Price per unit is computed from the subunit price
        const currentSubUnitPrice = Math.ceil(salePrice / subUnitsPerBox);
        form.pricePerUnit.value = Math.ceil(currentSubUnitPrice / unitsPerBox);
     }
  }
}

window.showImportModal = showImportModal;
window.downloadImportTemplate = downloadImportTemplate;
window.calcUnitPrice = calcUnitPrice;

function handlePdfUpload(e, formId) {
  const file = e.target.files[0];
  if (!file) return;
  if(file.size > 2 * 1024 * 1024) { UI.toast("Le PDF est trop volumineux (Max 2Mo)", "error"); return; }
  const reader = new FileReader();
  reader.onload = (evt) => {
     const b64Input = document.getElementById(formId + '-pdf-b64');
     const nameSpan = document.getElementById(formId + '-pdf-name');
     if(b64Input) b64Input.value = evt.target.result;
     if(nameSpan) nameSpan.textContent = "📄 " + file.name;
     UI.toast("Fichier compressé et rattaché avec succès.", "success");
  };
  reader.readAsDataURL(file);
}

function simulerVidalCloud(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  const dciStr = form.dci.value.trim().toLowerCase();
  if(!dciStr) { UI.toast("Veuillez saisir une DCI ou appuyer sur la touche Entrée d'abord.", "warning"); return; }
  
  UI.toast("Connexion à la Base Claude Bernard...", "info");
  const btn = document.querySelector(`#${formId} button[onclick="simulerVidalCloud('${formId}')"]`);
  if(btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Sync...'; if(window.lucide)lucide.createIcons(); }
  
  setTimeout(() => {
     if(btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="cloud-lightning"></i> Base RCP'; if(window.lucide)lucide.createIcons(); }
     let data = null;
     if (dciStr.includes('parac') || dciStr.includes('paracetamol')) {
         data = { brand: form.brand.value || 'Doliprane', category: 'Antalgique', dosageInstructions: 'Adultes : 500mg à 1g par prise, espacées de 4h à 6h (Max 4g/j).\nEnfant : 15mg/kg toutes les 6 heures.', precautions: 'Prudence en cas de pathologie hépatique sévère ou de malnutrition chronique. Éviter la consommation d\'alcool.', contraindications: 'Hypersensibilité au paracétamol. Insuffisance hépatique sévère.', sideEffects: 'Rares : éruptions cutanées, thrombopénie.' };
     } else if (dciStr.includes('amoxi')) {
         data = { brand: form.brand.value || 'Clamoxyl', category: 'Antibiotique', dosageInstructions: 'Adultes: 1g à 2g/jour en 2 ou 3 prises.\nEnfant: 50mg/kg/jour en 3 prises.', precautions: 'Prudence en cas d\'insuffisance rénale (ajustement).', contraindications: 'Allergie aux pénicillines ou céphalosporines.', sideEffects: 'Fréquents : Nausées, diarrhées, éruptions cutanées maculopapuleuses, candidose.' };
     } else if (dciStr.includes('ibupro')) {
         data = { brand: form.brand.value || 'Advil', category: 'Anti-inflammatoire', dosageInstructions: 'Adultes: 200 à 400mg par prise. Max 1200mg/j. Au cours des repas.', precautions: 'Éviter chez la femme enceinte au 3e trimestre. Risque gastro-intestinal.', contraindications: 'Ulcère gastro-duodénal évolutif, insuffisance rénale sévère.', sideEffects: 'Nausées, gastralgies, vertiges, éruptions.' };
     } else if (dciStr.includes('chlor')) {
         data = { category: 'Antipaludique', dosageInstructions: 'Adultes : Traitement curatif de 3 jours, dose totale 25mg/kg base.', precautions: 'Surveillance ophtalmologique si traitement prolongé.', contraindications: 'Rétinopathie, hypersensibilité connue.', sideEffects: 'Troubles digestifs, prurit, troubles de l\'accommodation.' };
     } else {
         UI.toast("DCI introuvable dans le référentiel Vidal de démonstration locale.", "warning");
         return;
     }
     
     if(data) {
        if(data.brand && !form.brand.value) form.brand.value = data.brand;
        if(form.category && data.category) form.category.value = data.category;
        if(form.dosageInstructions) form.dosageInstructions.value = data.dosageInstructions;
        if(form.precautions) form.precautions.value = data.precautions;
        if(form.contraindications) form.contraindications.value = data.contraindications;
        if(form.sideEffects) form.sideEffects.value = data.sideEffects;
        UI.toast("✅ RCP (Résumé des Caractéristiques) complété auto.", "success");
     }
  }, 1200);
}

window.handlePdfUpload = handlePdfUpload;
window.simulerVidalCloud = simulerVidalCloud;

Router.register('products', renderProducts);
