/**
 * OrdiveX — Module Pilotage & Controle de Gestion
 * Centre de pilotage unifie pour le responsable pharmacie
 */

// ══════════════════════════════════════════════════════════════════════
// 1. POINT D'ENTREE & RENDU PRINCIPAL
// ══════════════════════════════════════════════════════════════════════

async function renderManagementControl(container) {
  const today = new Date().toISOString().split('T')[0];
  window._mcDateFrom = window._mcDateFrom || today;
  window._mcDateTo = window._mcDateTo || today;
  window._mcTab = window._mcTab || 'dashboard';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Pilotage & Controle de Gestion</h1>
        <p class="page-subtitle">Centre de decision — Vue unifiee de l'activite</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="mcExportPDF()"><i data-lucide="download"></i> Exporter PDF</button>
      </div>
    </div>

    <!-- Barre de periode -->
    <div class="filter-bar" style="flex-wrap:wrap;gap:8px;align-items:center;">
      <button class="btn btn-sm ${window._mcDateFrom === today ? 'btn-primary' : 'btn-ghost'}" onclick="mcSetPeriod('today')">Aujourd'hui</button>
      <button class="btn btn-sm btn-ghost" onclick="mcSetPeriod('week')">Cette semaine</button>
      <button class="btn btn-sm btn-ghost" onclick="mcSetPeriod('month')">Ce mois</button>
      <button class="btn btn-sm btn-ghost" onclick="mcSetPeriod('last-month')">Mois dernier</button>
      <span style="border-left:1px solid var(--border);height:24px;margin:0 4px;"></span>
      <input type="date" id="mc-date-from" class="filter-input" style="max-width:160px" value="${window._mcDateFrom}" onchange="mcCustomPeriod()">
      <span style="color:var(--text-muted);font-size:12px;">au</span>
      <input type="date" id="mc-date-to" class="filter-input" style="max-width:160px" value="${window._mcDateTo}" onchange="mcCustomPeriod()">
    </div>

    <!-- Onglets -->
    <div class="mc-tabs" style="display:flex;gap:0;margin:16px 0 0 0;border-bottom:2px solid var(--border);">
      <button class="mc-tab ${window._mcTab === 'dashboard' ? 'mc-tab-active' : ''}" onclick="mcSwitchTab('dashboard')"><i data-lucide="layout-dashboard" style="width:16px;height:16px"></i> Tableau de bord</button>
      <button class="mc-tab ${window._mcTab === 'detail' ? 'mc-tab-active' : ''}" onclick="mcSwitchTab('detail')"><i data-lucide="list" style="width:16px;height:16px"></i> Detail des ventes</button>
      <button class="mc-tab ${window._mcTab === 'reorder' ? 'mc-tab-active' : ''}" onclick="mcSwitchTab('reorder')"><i data-lucide="shopping-cart" style="width:16px;height:16px"></i> Aide a la commande</button>
    </div>

    <div id="mc-content" style="margin-top:20px;"></div>
  `;

  if (window.lucide) lucide.createIcons();
  await mcLoadData();
}

// ══════════════════════════════════════════════════════════════════════
// 2. CHARGEMENT DES DONNEES (OPTIMISE)
// ══════════════════════════════════════════════════════════════════════

async function mcLoadData() {
  const contentEl = document.getElementById('mc-content');
  if (!contentEl) return;
  UI.loading(contentEl, 'Analyse en cours...');

  try {
    const from = window._mcDateFrom;
    const to = window._mcDateTo;

    // Plage de recherche par date (ISO String standard)
    const range = IDBKeyRange.bound(from, to + 'z');

    // Charger les tables transactionnelles par index (tres performant !)
    const [sales, periodMovements, periodReturns, products, lots, stockAll, patients, appUsers] = await Promise.all([
      DB.dbGetAll('sales', 'date', range),
      DB.dbGetAll('movements', 'date', range),
      DB.dbGetAll('returns', 'date', range),
      DB.dbGetAll('products'),
      DB.dbGetAll('lots'),
      DB.dbGetAll('stock'),
      DB.dbGetAll('patients'),
      DB.dbGetAll('users').catch(() => []),
    ]);

    // Charger uniquement les saleItems des ventes de la periode pour eviter un dbGetAll massif
    let saleItems = [];
    if (sales.length > 0) {
      const itemsNested = await Promise.all(sales.map(s => DB.dbGetAll('saleItems', 'saleId', s.id)));
      saleItems = itemsNested.flat();
    }

    // Index rapides
    const productMap = {};
    const activeProducts = products.filter(p => p.status !== 'inactive');
    activeProducts.forEach(p => { productMap[p.id] = p; });
    const stockMap = {};
    stockAll.forEach(s => { stockMap[s.productId] = s; });
    const userMap = {};
    appUsers.forEach(u => { userMap[u.id] = u; });
    const patientMap = {};
    patients.forEach(p => { patientMap[p.id] = p; });

    // Stocker en memoire pour les onglets
    window._mcData = {
      sales, saleItems, products: activeProducts, productMap, lots, stockAll, stockMap,
      movements: periodMovements, returns: periodReturns,
      userMap, patientMap, from, to, allSales: sales, allSaleItems: saleItems
    };

    mcRenderCurrentTab();
  } catch (err) {
    contentEl.innerHTML = `<div class="empty-state"><h3>Erreur de chargement</h3><p>${err.message}</p></div>`;
    console.error('[MC] Erreur:', err);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 3. NAVIGATION PAR ONGLETS & PERIODES
// ══════════════════════════════════════════════════════════════════════

function mcSwitchTab(tab) {
  window._mcTab = tab;
  document.querySelectorAll('.mc-tab').forEach(el => {
    el.classList.toggle('mc-tab-active', el.textContent.trim().toLowerCase().includes(
      tab === 'dashboard' ? 'tableau' : tab === 'detail' ? 'detail' : 'commande'
    ));
  });
  mcRenderCurrentTab();
}

function mcRenderCurrentTab() {
  const contentEl = document.getElementById('mc-content');
  if (!contentEl || !window._mcData) return;
  if (window._mcTab === 'dashboard') mcRenderDashboard(contentEl);
  else if (window._mcTab === 'detail') mcRenderDetail(contentEl);
  else if (window._mcTab === 'reorder') mcRenderReorder(contentEl);
}

function mcSetPeriod(preset) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  let from, to;

  if (preset === 'today') {
    from = to = today;
  } else if (preset === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1); // Lundi
    from = d.toISOString().split('T')[0];
    to = today;
  } else if (preset === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    to = today;
  } else if (preset === 'last-month') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  }

  window._mcDateFrom = from;
  window._mcDateTo = to;
  Router.navigate('management-control');
}

function mcCustomPeriod() {
  const f = document.getElementById('mc-date-from')?.value;
  const t = document.getElementById('mc-date-to')?.value;
  if (f) window._mcDateFrom = f;
  if (t) window._mcDateTo = t;
  mcLoadData();
}

// ══════════════════════════════════════════════════════════════════════
// 4. ONGLET 1 — TABLEAU DE BORD QUOTIDIEN
// ══════════════════════════════════════════════════════════════════════

function mcRenderDashboard(contentEl) {
  const { sales: allPeriodSales, saleItems: allPeriodSaleItems, products, productMap, stockAll, stockMap, lots, movements, returns: allPeriodReturns, userMap } = window._mcData;

  // Fiabilisation — le Chiffre d'Affaires comptait auparavant TOUTES les
  // ventes de la période sans filtrer sur le statut : une vente annulée
  // (sale.status === 'annulled', stock déjà restauré par annulerVente)
  // était additionnée à la fois au CA et au COGS comme une vraie vente
  // réalisée, et une vente crédit/assurance encore en attente de règlement
  // y était comptée comme du chiffre d'affaires encaissé. Résultat : ce CA
  // pouvait différer de celui du Tableau de Bord et des Métriques Business
  // pour la MÊME période — même correctif ['completed','paid'] que ces deux
  // pages, pour une seule vérité de CA dans toute l'application.
  const sales = allPeriodSales.filter(s => ['completed', 'paid'].includes(s.status));
  const completedSaleIds = new Set(sales.map(s => s.id));
  const saleItems = allPeriodSaleItems.filter(si => completedSaleIds.has(si.saleId));
  // Un retour peut être traité sur une vente crédit/assurance encore en
  // attente (returns.js ne l'interdit pas) — dans ce cas sale.total n'est
  // jamais compté dans totalCA ci-dessus : ne pas non plus soustraire ce
  // retour, sous peine de faire baisser artificiellement CA/bénéfice d'un
  // montant qui n'a jamais été ajouté.
  const returns = allPeriodReturns.filter(r => r.status !== 'approved' || completedSaleIds.has(r.saleId));

  // KPIs Calculs
  const totalCA = sales.reduce((a, s) => a + (s.total || 0), 0);
  const nbVentes = sales.length;
  const nbArticles = saleItems.reduce((a, si) => a + (si.quantity || 0), 0);
  const clientIds = new Set(sales.filter(s => s.patientId).map(s => s.patientId));
  const nbClients = clientIds.size;

  // Benefice estime
  const totalCOGS = saleItems.reduce((a, si) => {
    const prod = productMap[si.productId];
    const costPrice = si.purchasePrice || (prod ? prod.purchasePrice : 0) || 0;
    return a + costPrice * (si.quantity || 0);
  }, 0);
  // Fiabilisation — coût et montant des articles retournés (approuvés) :
  // sans cette double soustraction, la marchandise revenue en stock restait
  // comptée comme vendue (COGS) et son remboursement n'était jamais déduit
  // du CA/bénéfice affichés (montantRetours était calculé plus bas mais
  // jamais réellement soustrait de `benefice`).
  const approvedReturns = returns.filter(r => r.status === 'approved');
  const returnsRefundTotal = approvedReturns.reduce((a, r) => a + (r.refundAmount || 0), 0);
  const returnsCOGS = approvedReturns.reduce((a, r) => {
    return a + (r.items || []).reduce((acc, ri) => {
      const si = allPeriodSaleItems.find(x => x.id === ri.saleItemId);
      return acc + (si?.purchasePrice || 0) * (ri.quantity || 0);
    }, 0);
  }, 0);
  const benefice = (totalCA - returnsRefundTotal) - (totalCOGS - returnsCOGS);

  // Valeur du stock restant et vendu
  const stockValue = products.reduce((a, p) => {
    const s = stockMap[p.id];
    return a + ((s?.quantity || 0) * (p.purchasePrice || 0));
  }, 0);
  const stockSaleValue = products.reduce((a, p) => {
    const s = stockMap[p.id];
    return a + ((s?.quantity || 0) * (p.salePrice || 0));
  }, 0);

  // Mouvements
  const entries = movements.filter(m => m.type === 'ENTRY');
  const exits = movements.filter(m => m.type === 'EXIT' || m.type === 'SALE');
  const nbRetours = returns.length;
  const montantRetours = returnsRefundTotal;

  // Ventilation paiement
  const payBreakdown = {};
  sales.forEach(s => {
    const method = s.paymentMethod || 'autre';
    if (!payBreakdown[method]) payBreakdown[method] = { count: 0, total: 0 };
    payBreakdown[method].count++;
    payBreakdown[method].total += (s.total || 0);
  });
  const payLabels = {
    cash: 'Especes', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo',
    credit: 'Credit', transfer: 'Virement', insurance: 'Assurance', autre: 'Autre'
  };

  // Produits plus vendus (Top 10)
  const prodSales = {};
  saleItems.forEach(si => {
    if (!prodSales[si.productId]) prodSales[si.productId] = { qty: 0, revenue: 0 };
    prodSales[si.productId].qty += (si.quantity || 0);
    prodSales[si.productId].revenue += (si.total || si.quantity * si.price || 0);
  });
  const topProducts = Object.entries(prodSales)
    .map(([id, data]) => ({ id: Number(id), ...data, name: productMap[id]?.name || 'Produit #' + id }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Produits vendus (IDs)
  const soldProductIds = new Set(Object.keys(prodSales).map(Number));

  // Produits NON vendus
  const unsoldProducts = products.filter(p => !soldProductIds.has(p.id) && (stockMap[p.id]?.quantity || 0) > 0);

  // Produits en rupture et stock bas
  const ruptures = products.filter(p => (stockMap[p.id]?.quantity || 0) === 0);
  const lowStock = products.filter(p => {
    const qty = stockMap[p.id]?.quantity || 0;
    return qty > 0 && qty <= (p.minStock || 10);
  });

  contentEl.innerHTML = `
    <!-- KPIs principaux -->
    <div class="kpi-grid kpi-grid-3" style="margin-bottom:24px;">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i data-lucide="banknote"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${UI.formatCurrency(totalCA)}</div>
          <div class="kpi-label">Chiffre d'Affaires</div>
          <div class="kpi-sub">${nbVentes} vente${nbVentes > 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i data-lucide="trending-up"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${UI.formatCurrency(benefice)}</div>
          <div class="kpi-label">Benefice estime</div>
          <div class="kpi-sub">${totalCA > 0 ? (benefice / totalCA * 100).toFixed(1) : 0}% de marge</div>
        </div>
      </div>
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i data-lucide="shopping-bag"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${nbArticles}</div>
          <div class="kpi-label">Articles vendus</div>
          <div class="kpi-sub">${nbClients} client${nbClients > 1 ? 's' : ''} unique${nbClients > 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>

    <!-- KPIs secondaires : Stock & Mouvements -->
    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px;">
      <div class="kpi-card" style="background:var(--surface);">
        <div class="kpi-content" style="text-align:center;padding:14px 10px;">
          <div class="kpi-value" style="font-size:18px;color:var(--primary)">${UI.formatCurrency(stockValue)}</div>
          <div class="kpi-label" style="font-size:11px;">Valeur stock (achat)</div>
        </div>
      </div>
      <div class="kpi-card" style="background:var(--surface);">
        <div class="kpi-content" style="text-align:center;padding:14px 10px;">
          <div class="kpi-value" style="font-size:18px;color:var(--success)">${UI.formatCurrency(stockSaleValue)}</div>
          <div class="kpi-label" style="font-size:11px;">Valeur stock (vente)</div>
        </div>
      </div>
      <div class="kpi-card" style="background:var(--surface);">
        <div class="kpi-content" style="text-align:center;padding:14px 10px;">
          <div class="kpi-value" style="font-size:18px;color:var(--success)">${entries.length}</div>
          <div class="kpi-label" style="font-size:11px;">Entrees stock</div>
        </div>
      </div>
      <div class="kpi-card" style="background:var(--surface);">
        <div class="kpi-content" style="text-align:center;padding:14px 10px;">
          <div class="kpi-value" style="font-size:18px;color:var(--danger)">${exits.length}</div>
          <div class="kpi-label" style="font-size:11px;">Sorties stock</div>
        </div>
      </div>
      <div class="kpi-card" style="background:var(--surface);">
        <div class="kpi-content" style="text-align:center;padding:14px 10px;">
          <div class="kpi-value" style="font-size:18px;color:var(--warning)">${nbRetours}</div>
          <div class="kpi-label" style="font-size:11px;">Retours (${UI.formatCurrency(montantRetours)})</div>
        </div>
      </div>
    </div>

    <!-- Ventilation Paiements -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
      <div style="background:var(--surface);border-radius:12px;padding:20px;border:1px solid var(--border);">
        <h3 style="margin:0 0 14px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;"><i data-lucide="credit-card" style="width:18px;height:18px;color:var(--primary)"></i> Ventilation des paiements</h3>
        ${Object.keys(payBreakdown).length === 0 ? '<p class="text-muted">Aucune vente sur cette periode</p>' :
          `<table class="data-table" style="margin:0;"><thead><tr><th>Mode</th><th style="text-align:right">Nombre</th><th style="text-align:right">Montant</th></tr></thead><tbody>
          ${Object.entries(payBreakdown).map(([k, v]) =>
            `<tr><td>${payLabels[k] || k}</td><td style="text-align:right"><strong>${v.count}</strong></td><td style="text-align:right">${UI.formatCurrency(v.total)}</td></tr>`
          ).join('')}
          </tbody></table>`
        }
      </div>
      <div style="background:var(--surface);border-radius:12px;padding:20px;border:1px solid var(--border);">
        <h3 style="margin:0 0 14px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;"><i data-lucide="award" style="width:18px;height:18px;color:var(--success)"></i> Top 10 des produits vendus</h3>
        ${topProducts.length === 0 ? '<p class="text-muted">Aucune vente sur cette periode</p>' :
          `<table class="data-table" style="margin:0;"><thead><tr><th>Produit</th><th style="text-align:right">Quantite</th><th style="text-align:right">Revenu</th></tr></thead><tbody>
          ${topProducts.map((p, i) =>
            `<tr><td><span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:${i < 3 ? 'var(--primary)' : 'var(--text-muted)'};color:white;text-align:center;line-height:20px;font-size:10px;font-weight:700;margin-right:8px;">${i + 1}</span>${p.name}</td><td style="text-align:right"><strong>${p.qty}</strong></td><td style="text-align:right">${UI.formatCurrency(p.revenue)}</td></tr>`
          ).join('')}
          </tbody></table>`
        }
      </div>
    </div>

    <!-- Alertes Stock : Ruptures + Stock bas -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
      <div style="background:var(--surface);border-radius:12px;padding:20px;border:1px solid var(--border);">
        <h3 style="margin:0 0 14px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;color:var(--danger);">
          <i data-lucide="alert-triangle" style="width:18px;height:18px"></i> Ruptures de stock (${ruptures.length})
        </h3>
        ${ruptures.length === 0 ? '<p class="text-muted">Aucune rupture detectee</p>' :
          `<div style="max-height:250px;overflow-y:auto;">
          <table class="data-table" style="margin:0;"><thead><tr><th>Produit</th><th>Categorie</th></tr></thead><tbody>
          ${ruptures.slice(0, 30).map(p => `<tr><td><strong>${p.name}</strong></td><td><span class="category-tag">${p.category || '—'}</span></td></tr>`).join('')}
          ${ruptures.length > 30 ? `<tr><td colspan="2" class="text-muted text-center">... et ${ruptures.length - 30} autres</td></tr>` : ''}
          </tbody></table></div>`
        }
      </div>
      <div style="background:var(--surface);border-radius:12px;padding:20px;border:1px solid var(--border);">
        <h3 style="margin:0 0 14px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;color:var(--warning);">
          <i data-lucide="alert-circle" style="width:18px;height:18px"></i> Stock bas (${lowStock.length})
        </h3>
        ${lowStock.length === 0 ? '<p class="text-muted">Aucun stock bas detecte</p>' :
          `<div style="max-height:250px;overflow-y:auto;">
          <table class="data-table" style="margin:0;"><thead><tr><th>Produit</th><th style="text-align:right">Stock</th><th style="text-align:right">Seuil</th></tr></thead><tbody>
          ${lowStock.slice(0, 30).map(p => `<tr><td><strong>${p.name}</strong></td><td style="text-align:right;color:var(--warning);font-weight:700;">${stockMap[p.id]?.quantity || 0}</td><td style="text-align:right">${p.minStock || 10}</td></tr>`).join('')}
          ${lowStock.length > 30 ? `<tr><td colspan="3" class="text-muted text-center">... et ${lowStock.length - 30} autres</td></tr>` : ''}
          </tbody></table></div>`
        }
      </div>
    </div>

    <!-- Produits non vendus -->
    <div style="background:var(--surface);border-radius:12px;padding:20px;border:1px solid var(--border);margin-bottom:24px;">
      <h3 style="margin:0 0 14px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;">
        <i data-lucide="package-x" style="width:18px;height:18px;color:var(--text-muted)"></i> Produits en stock non vendus sur la periode (${unsoldProducts.length})
      </h3>
      ${unsoldProducts.length === 0 ? '<p class="text-muted">Tous les produits en stock ont ete vendus sur cette periode</p>' :
        `<div style="max-height:300px;overflow-y:auto;">
        <table class="data-table" style="margin:0;"><thead><tr><th>Produit</th><th>Categorie</th><th style="text-align:right">Stock</th><th style="text-align:right">Val. Stock (achat)</th></tr></thead><tbody>
        ${unsoldProducts.slice(0, 50).map(p =>
          `<tr><td><strong>${p.name}</strong></td><td><span class="category-tag">${p.category || '—'}</span></td><td style="text-align:right">${stockMap[p.id]?.quantity || 0}</td><td style="text-align:right">${UI.formatCurrency((stockMap[p.id]?.quantity || 0) * (p.purchasePrice || 0))}</td></tr>`
        ).join('')}
        ${unsoldProducts.length > 50 ? `<tr><td colspan="4" class="text-muted text-center">... et ${unsoldProducts.length - 50} autres</td></tr>` : ''}
        </tbody></table></div>`
      }
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}


// ══════════════════════════════════════════════════════════════════════
// 5. ONGLET 2 — RAPPORT DETAILLE DES VENTES
// ══════════════════════════════════════════════════════════════════════

function mcRenderDetail(contentEl) {
  const { saleItems: allPeriodSaleItems, sales: allPeriodSales, productMap, stockMap, userMap, patientMap, products } = window._mcData;
  window._mcDetailPage = window._mcDetailPage || 1;

  // Fiabilisation — même correctif que mcRenderDashboard : sans ce filtre,
  // ce rapport détaillé listait des lignes de ventes ANNULÉES (coût/profit
  // affichés comme si la vente avait réellement eu lieu) et de ventes
  // crédit/assurance encore en attente — en désaccord avec le nombre de
  // ventes affiché par l'onglet Tableau de Bord de CETTE MÊME page pour la
  // même période.
  const sales = allPeriodSales.filter(s => ['completed', 'paid'].includes(s.status));
  const completedSaleIds = new Set(sales.map(s => s.id));
  const saleItems = allPeriodSaleItems.filter(si => completedSaleIds.has(si.saleId));

  // Construire les donnees detaillees : chaque saleItem enrichi
  const saleMap = {};
  sales.forEach(s => { saleMap[s.id] = s; });

  let detailData = saleItems.map(si => {
    const sale = saleMap[si.saleId] || {};
    const prod = productMap[si.productId] || {};
    const costPrice = si.purchasePrice || prod.purchasePrice || 0;
    const sellPrice = si.price || prod.salePrice || 0;
    const profit = (sellPrice - costPrice) * (si.quantity || 0);
    const user = userMap[sale.userId];
    const patient = sale.patientId ? patientMap[sale.patientId] : null;

    return {
      productId: si.productId,
      name: prod.name || si.productName || 'Inconnu',
      form: prod.form || '—',
      category: prod.category || '—',
      brand: prod.brand || '—',
      qty: si.quantity || 0,
      stockQty: stockMap[si.productId]?.quantity ?? '—',
      costPrice,
      sellPrice,
      profit,
      date: sale.date || '—',
      seller: user?.name || user?.username || '—',
      client: patient?.name || (sale.patientName || '—'),
      paymentMethod: sale.paymentMethod || '—',
    };
  });

  // Filtres
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
  const forms = [...new Set(products.map(p => p.form || p.forme).filter(Boolean))].sort();
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
  const sellers = [...new Set(sales.map(s => userMap[s.userId]?.name || userMap[s.userId]?.username).filter(Boolean))].sort();

  // Appliquer les filtres
  const fCat = window._mcFilterCat || '';
  const fForm = window._mcFilterForm || '';
  const fBrand = window._mcFilterBrand || '';
  const fSeller = window._mcFilterSeller || '';
  const fSearch = (window._mcFilterSearch || '').toLowerCase();

  if (fCat) detailData = detailData.filter(d => d.category === fCat);
  if (fForm) detailData = detailData.filter(d => d.form === fForm);
  if (fBrand) detailData = detailData.filter(d => d.brand === fBrand);
  if (fSeller) detailData = detailData.filter(d => d.seller === fSeller);
  if (fSearch) detailData = detailData.filter(d => d.name.toLowerCase().includes(fSearch));

  // Tri par date decroissante
  detailData.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Pagination
  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(detailData.length / PAGE_SIZE));
  if (window._mcDetailPage > totalPages) window._mcDetailPage = totalPages;
  const start = (window._mcDetailPage - 1) * PAGE_SIZE;
  const pageData = detailData.slice(start, start + PAGE_SIZE);

  // Totaux
  const totalQty = detailData.reduce((a, d) => a + d.qty, 0);
  const totalRevenue = detailData.reduce((a, d) => a + d.sellPrice * d.qty, 0);
  const totalProfit = detailData.reduce((a, d) => a + d.profit, 0);

  contentEl.innerHTML = `
    <!-- Filtres -->
    <div class="filter-bar" style="flex-wrap:wrap;gap:8px;margin-bottom:16px;">
      <input type="text" class="filter-input" style="max-width:200px" placeholder="Rechercher un medicament..." value="${fSearch}" oninput="window._mcFilterSearch=this.value;window._mcDetailPage=1;mcRenderCurrentTab()">
      <select class="filter-select" onchange="window._mcFilterCat=this.value;window._mcDetailPage=1;mcRenderCurrentTab()">
        <option value="">Toutes categories</option>
        ${categories.map(c => `<option value="${c}" ${fCat === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
      <select class="filter-select" onchange="window._mcFilterForm=this.value;window._mcDetailPage=1;mcRenderCurrentTab()">
        <option value="">Toutes formes</option>
        ${forms.map(f => `<option value="${f}" ${fForm === f ? 'selected' : ''}>${f}</option>`).join('')}
      </select>
      <select class="filter-select" onchange="window._mcFilterBrand=this.value;window._mcDetailPage=1;mcRenderCurrentTab()">
        <option value="">Tous laboratoires</option>
        ${brands.map(b => `<option value="${b}" ${fBrand === b ? 'selected' : ''}>${b}</option>`).join('')}
      </select>
      <select class="filter-select" onchange="window._mcFilterSeller=this.value;window._mcDetailPage=1;mcRenderCurrentTab()">
        <option value="">Tous vendeurs</option>
        ${sellers.map(s => `<option value="${s}" ${fSeller === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>

    <!-- Totaux -->
    <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:13px;">
        <strong>${detailData.length}</strong> lignes &middot; <strong>${totalQty}</strong> articles
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:13px;">
        CA : <strong style="color:var(--primary)">${UI.formatCurrency(totalRevenue)}</strong>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:13px;">
        Benefice : <strong style="color:var(--success)">${UI.formatCurrency(totalProfit)}</strong>
      </div>
    </div>

    <!-- Tableau -->
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Designation</th>
            <th>Forme</th>
            <th>Categorie</th>
            <th style="text-align:right">Qte vendue</th>
            <th style="text-align:right">Stock restant</th>
            <th style="text-align:right">P. Achat</th>
            <th style="text-align:right">P. Vente</th>
            <th style="text-align:right">Benefice</th>
            <th>Date & Heure</th>
            <th>Vendeur</th>
            <th>Client</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.length === 0 ? '<tr><td colspan="11" class="text-muted text-center">Aucune vente sur cette periode</td></tr>' :
            pageData.map(d => `
              <tr>
                <td><strong>${d.name}</strong></td>
                <td>${d.form}</td>
                <td><span class="category-tag">${d.category}</span></td>
                <td style="text-align:right;font-weight:700;">${d.qty}</td>
                <td style="text-align:right;${d.stockQty === 0 ? 'color:var(--danger);font-weight:700;' : ''}">${d.stockQty}</td>
                <td style="text-align:right">${UI.formatCurrency(d.costPrice)}</td>
                <td style="text-align:right">${UI.formatCurrency(d.sellPrice)}</td>
                <td style="text-align:right;color:${d.profit >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:700;">${UI.formatCurrency(d.profit)}</td>
                <td style="white-space:nowrap;">${UI.formatDateTime(d.date)}</td>
                <td>${d.seller}</td>
                <td>${d.client}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;gap:12px;flex-wrap:wrap;">
      <span style="font-size:13px;color:var(--text-muted)">${detailData.length} lignes — Page ${window._mcDetailPage}/${totalPages}</span>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" ${window._mcDetailPage <= 1 ? 'disabled' : ''} onclick="window._mcDetailPage--;mcRenderCurrentTab()">Precedent</button>
        <button class="btn btn-secondary btn-sm" ${window._mcDetailPage >= totalPages ? 'disabled' : ''} onclick="window._mcDetailPage++;mcRenderCurrentTab()">Suivant</button>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}


// ══════════════════════════════════════════════════════════════════════
// 6. ONGLET 3 — AIDE A LA COMMANDE FOURNISSEUR
// ══════════════════════════════════════════════════════════════════════

function mcRenderReorder(contentEl) {
  const { products, productMap, stockMap, allSales, allSaleItems } = window._mcData;
  window._mcReorderPage = window._mcReorderPage || 1;

  // Calculer la consommation moyenne quotidienne (CMQ) sur les 30 derniers jours
  const now = new Date();
  const d30Ago = new Date(now);
  d30Ago.setDate(d30Ago.getDate() - 30);
  const d30Str = d30Ago.toISOString().split('T')[0];

  const recentSales = allSales.filter(s => s.date && s.date.slice(0, 10) >= d30Str);
  const recentSaleIds = new Set(recentSales.map(s => s.id));
  const recentItems = allSaleItems.filter(si => recentSaleIds.has(si.saleId));

  // Consommation par produit sur 30 jours
  const consumption = {};
  recentItems.forEach(si => {
    consumption[si.productId] = (consumption[si.productId] || 0) + (si.quantity || 0);
  });

  // Identifier les ventes d'aujourd'hui et d'hier (médicaments sortis récemment)
  const todayStr = now.toISOString().split('T')[0];
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = yest.toISOString().split('T')[0];

  const soldTodayOrYesterday = {};
  const dailySalesRecent = allSales.filter(s => s.date && (s.date.startsWith(todayStr) || s.date.startsWith(yesterdayStr)));
  const dailySaleIdsRecent = new Set(dailySalesRecent.map(s => s.id));
  const dailyItemsRecent = allSaleItems.filter(si => dailySaleIdsRecent.has(si.saleId));
  dailyItemsRecent.forEach(si => {
    soldTodayOrYesterday[si.productId] = (soldTodayOrYesterday[si.productId] || 0) + (si.quantity || 0);
  });

  // Nombre de jours effectifs (entre premiere vente et aujourd'hui, max 30)
  const nbDays = 30;

  // Construire la liste de recommandations
  let recommendations = products.map(p => {
    const currentStock = stockMap[p.id]?.quantity || 0;
    const totalConsumed = consumption[p.id] || 0;
    const cmq = totalConsumed / nbDays;
    const coverageDays = cmq > 0 ? Math.floor(currentStock / cmq) : (currentStock > 0 ? 999 : 0);

    // Determiner la priorite
    let priority, priorityLabel, priorityCls, justification;
    if (currentStock === 0 || (cmq > 0 && coverageDays < 2)) {
      priority = 1;
      priorityLabel = 'Critique';
      priorityCls = 'badge-danger';
      justification = currentStock === 0
        ? 'Rupture de stock — Reapprovisionnement urgent requis'
        : `Moins de 2 jours de couverture (${coverageDays}j). Risque imminent de rupture.`;
    } else if (currentStock <= (p.minStock || 10)) {
      priority = 2;
      priorityLabel = 'Elevee';
      priorityCls = 'badge-warning';
      justification = `Stock (${currentStock}) inferieur ou egal au seuil minimum (${p.minStock || 10}).`;
    } else if (cmq > 0 && coverageDays < 15) {
      priority = 3;
      priorityLabel = 'Moyenne';
      priorityCls = 'badge-info';
      justification = `Couverture de ${coverageDays} jours seulement. Recommandation preventive.`;
    } else if (cmq > 0 && coverageDays < 30) {
      priority = 4;
      priorityLabel = 'Faible';
      priorityCls = 'badge-neutral';
      justification = `Couverture de ${coverageDays} jours. A surveiller dans les prochains jours.`;
    } else {
      priority = 5;
      priorityLabel = null; // Pas besoin de reapprovisionnement
    }

    // Quantite suggeree pour atteindre 30 jours de couverture
    const targetStock = Math.ceil(cmq * 30);
    let suggestedQty = Math.max(0, targetStock - currentStock);

    // Si le produit a été vendu aujourd'hui ou hier et n'est pas déjà critique/élevé, forcer une priorité Moyenne
    const qtyRecent = soldTodayOrYesterday[p.id] || 0;
    if (qtyRecent > 0 && (priority >= 4 || !priorityLabel)) {
      priority = 3;
      priorityLabel = 'Moyenne';
      priorityCls = 'badge-info';
      justification = `Vente recente (${qtyRecent} u. vendue(s) aujourd'hui/hier).`;
      suggestedQty = Math.max(suggestedQty, qtyRecent);
    }

    return {
      id: p.id, name: p.name, category: p.category, form: p.form,
      currentStock, minStock: p.minStock || 10, cmq,
      coverageDays: cmq > 0 ? coverageDays : null,
      priority, priorityLabel, priorityCls,
      suggestedQty, justification,
      purchasePrice: p.purchasePrice || 0,
    };
  }).filter(r => r.priorityLabel !== null);

  // Trier par priorite (critique en premier)
  recommendations.sort((a, b) => a.priority - b.priority || b.cmq - a.cmq);

  // Filtre de priorite
  const fPriority = window._mcReorderPriority || '';
  const fSearchReorder = (window._mcReorderSearch || '').toLowerCase();
  if (fPriority) recommendations = recommendations.filter(r => r.priorityLabel === fPriority);
  if (fSearchReorder) recommendations = recommendations.filter(r => r.name.toLowerCase().includes(fSearchReorder));

  // Pagination
  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(recommendations.length / PAGE_SIZE));
  if (window._mcReorderPage > totalPages) window._mcReorderPage = totalPages;
  const start = (window._mcReorderPage - 1) * PAGE_SIZE;
  const pageData = recommendations.slice(start, start + PAGE_SIZE);

  // Compteurs
  const critCount = recommendations.filter(r => r.priority === 1).length;
  const highCount = recommendations.filter(r => r.priority === 2).length;
  const medCount = recommendations.filter(r => r.priority === 3).length;
  const lowCount = recommendations.filter(r => r.priority === 4).length;

  // Cout total estime de reapprovisionnement
  const totalReorderCost = recommendations.reduce((a, r) => a + r.suggestedQty * r.purchasePrice, 0);

  contentEl.innerHTML = `
    <!-- Resume -->
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      <div style="background:linear-gradient(135deg,rgba(231,76,60,0.1),rgba(231,76,60,0.05));border:1px solid rgba(231,76,60,0.2);border-radius:10px;padding:12px 18px;font-size:13px;cursor:pointer;" onclick="window._mcReorderPriority='Critique';window._mcReorderPage=1;mcRenderCurrentTab()">
        <strong style="font-size:20px;color:var(--danger);">${critCount}</strong> <span style="color:var(--danger)">Critiques</span>
      </div>
      <div style="background:linear-gradient(135deg,rgba(243,156,18,0.1),rgba(243,156,18,0.05));border:1px solid rgba(243,156,18,0.2);border-radius:10px;padding:12px 18px;font-size:13px;cursor:pointer;" onclick="window._mcReorderPriority='Elevee';window._mcReorderPage=1;mcRenderCurrentTab()">
        <strong style="font-size:20px;color:var(--warning);">${highCount}</strong> <span style="color:var(--warning)">Elevees</span>
      </div>
      <div style="background:linear-gradient(135deg,rgba(52,152,219,0.1),rgba(52,152,219,0.05));border:1px solid rgba(52,152,219,0.2);border-radius:10px;padding:12px 18px;font-size:13px;cursor:pointer;" onclick="window._mcReorderPriority='Moyenne';window._mcReorderPage=1;mcRenderCurrentTab()">
        <strong style="font-size:20px;color:var(--primary);">${medCount}</strong> <span style="color:var(--primary)">Moyennes</span>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 18px;font-size:13px;cursor:pointer;" onclick="window._mcReorderPriority='Faible';window._mcReorderPage=1;mcRenderCurrentTab()">
        <strong style="font-size:20px;">${lowCount}</strong> Faibles
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 18px;font-size:13px;margin-left:auto;">
        Cout estime : <strong style="color:var(--primary)">${UI.formatCurrency(totalReorderCost)}</strong>
      </div>
    </div>

    <!-- Filtres -->
    <div class="filter-bar" style="gap:8px;margin-bottom:16px;">
      <input type="text" class="filter-input" style="max-width:200px" placeholder="Rechercher..." value="${fSearchReorder}" oninput="window._mcReorderSearch=this.value;window._mcReorderPage=1;mcRenderCurrentTab()">
      <select class="filter-select" onchange="window._mcReorderPriority=this.value;window._mcReorderPage=1;mcRenderCurrentTab()">
        <option value="" ${!fPriority ? 'selected' : ''}>Toutes priorites</option>
        <option value="Critique" ${fPriority === 'Critique' ? 'selected' : ''}>Critique</option>
        <option value="Elevee" ${fPriority === 'Elevee' ? 'selected' : ''}>Elevee</option>
        <option value="Moyenne" ${fPriority === 'Moyenne' ? 'selected' : ''}>Moyenne</option>
        <option value="Faible" ${fPriority === 'Faible' ? 'selected' : ''}>Faible</option>
      </select>
      <button class="btn btn-ghost btn-sm" onclick="window._mcReorderPriority='';window._mcReorderSearch='';window._mcReorderPage=1;mcRenderCurrentTab()"><i data-lucide="x"></i> Reinitialiser</button>
    </div>

    <!-- Tableau -->
    <div style="overflow-x:auto;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Categorie</th>
            <th style="text-align:right">Stock actuel</th>
            <th style="text-align:right">CMQ</th>
            <th style="text-align:right">Couverture</th>
            <th style="text-align:center">Priorite</th>
            <th style="text-align:right">Qte suggeree</th>
            <th style="text-align:right">Cout estime</th>
            <th>Justification</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.length === 0 ? '<tr><td colspan="9" class="text-muted text-center">Aucune recommandation de reapprovisionnement</td></tr>' :
            pageData.map(r => `
              <tr>
                <td><strong>${r.name}</strong><br><span class="text-muted" style="font-size:11px;">${r.form || ''}</span></td>
                <td><span class="category-tag">${r.category || '—'}</span></td>
                <td style="text-align:right;font-weight:700;color:${r.currentStock === 0 ? 'var(--danger)' : r.currentStock <= r.minStock ? 'var(--warning)' : 'inherit'};">${r.currentStock}</td>
                <td style="text-align:right">${r.cmq.toFixed(1)}/j</td>
                <td style="text-align:right;font-weight:700;">${r.coverageDays !== null ? r.coverageDays + 'j' : '—'}</td>
                <td style="text-align:center"><span class="badge ${r.priorityCls}">${r.priorityLabel}</span></td>
                <td style="text-align:right;font-weight:700;color:var(--primary);">${r.suggestedQty}</td>
                <td style="text-align:right">${UI.formatCurrency(r.suggestedQty * r.purchasePrice)}</td>
                <td style="font-size:12px;max-width:250px;color:var(--text-muted);">${r.justification}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;gap:12px;flex-wrap:wrap;">
      <span style="font-size:13px;color:var(--text-muted)">${recommendations.length} produits a reapprovisionner — Page ${window._mcReorderPage}/${totalPages}</span>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" ${window._mcReorderPage <= 1 ? 'disabled' : ''} onclick="window._mcReorderPage--;mcRenderCurrentTab()">Precedent</button>
        <button class="btn btn-secondary btn-sm" ${window._mcReorderPage >= totalPages ? 'disabled' : ''} onclick="window._mcReorderPage++;mcRenderCurrentTab()">Suivant</button>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}


// ══════════════════════════════════════════════════════════════════════
// 7. EXPORT PDF / IMPRESSION
// ══════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════
// 7. EXPORT PDF PROFESSIONNEL (UTILISE PDFEXPORT.GENERATE)
// ══════════════════════════════════════════════════════════════════════

async function mcExportPDF() {
  if (!window.PDFExport) {
    UI.toast("Le module PDF n'est pas charge", "error");
    return;
  }

  const dataObj = window._mcData;
  if (!dataObj) { UI.toast('Aucune donnee chargee', 'warning'); return; }

  const from = window._mcDateFrom;
  const to = window._mcDateTo;
  const periodLabel = from === to ? UI.formatDate(from) : `${UI.formatDate(from)} au ${UI.formatDate(to)}`;

  const activeTab = window._mcTab || 'dashboard';

  if (activeTab === 'dashboard') {
    // ── Onglet 1 : Tableau de bord quotidien ──
    // Fiabilisation — même correctif que mcRenderDashboard : exclure les
    // ventes annulées/en attente du CA/COGS exportés, sinon ce CSV peut
    // afficher un CA différent de ce que montre l'écran pour la même période.
    const { sales: allPeriodSales, saleItems: allPeriodSaleItems, productMap, stockMap, products, movements, returns: allPeriodReturns } = dataObj;
    const sales = allPeriodSales.filter(s => ['completed', 'paid'].includes(s.status));
    const completedSaleIds = new Set(sales.map(s => s.id));
    const saleItems = allPeriodSaleItems.filter(si => completedSaleIds.has(si.saleId));
    const returns = allPeriodReturns.filter(r => r.status !== 'approved' || completedSaleIds.has(r.saleId));

    const totalCA = sales.reduce((a, s) => a + (s.total || 0), 0);
    const nbVentes = sales.length;
    const nbArticles = saleItems.reduce((a, si) => a + (si.quantity || 0), 0);
    const clientIds = new Set(sales.filter(s => s.patientId).map(s => s.patientId));
    const nbClients = clientIds.size;

    const totalCOGS = saleItems.reduce((a, si) => {
      const prod = productMap[si.productId];
      const costPrice = si.purchasePrice || (prod ? prod.purchasePrice : 0) || 0;
      return a + costPrice * (si.quantity || 0);
    }, 0);
    const approvedReturns = returns.filter(r => r.status === 'approved');
    const returnsRefundTotal = approvedReturns.reduce((a, r) => a + (r.refundAmount || 0), 0);
    const returnsCOGS = approvedReturns.reduce((a, r) => {
      return a + (r.items || []).reduce((acc, ri) => {
        const si = allPeriodSaleItems.find(x => x.id === ri.saleItemId);
        return acc + (si?.purchasePrice || 0) * (ri.quantity || 0);
      }, 0);
    }, 0);
    const benefice = (totalCA - returnsRefundTotal) - (totalCOGS - returnsCOGS);

    const stockValue = products.reduce((a, p) => a + ((stockMap[p.id]?.quantity || 0) * (p.purchasePrice || 0)), 0);
    const stockSaleValue = products.reduce((a, p) => a + ((stockMap[p.id]?.quantity || 0) * (p.salePrice || 0)), 0);

    const entries = movements.filter(m => m.type === 'ENTRY');
    const exits = movements.filter(m => m.type === 'EXIT' || m.type === 'SALE');
    const nbRetours = returns.length;
    const montantRetours = returnsRefundTotal;

    const headers = ["Indicateur", "Valeur"];
    const rows = [
      ["Chiffre d'Affaires", UI.formatCurrency(totalCA)],
      ["Benefice estime", UI.formatCurrency(benefice)],
      ["Marge brute globale", (totalCA > 0 ? (benefice / totalCA * 100).toFixed(1) : 0) + "%"],
      ["Nombre de ventes", nbVentes.toString()],
      ["Nombre d'articles vendus", nbArticles.toString()],
      ["Nombre de clients uniques", nbClients.toString()],
      ["Valeur du stock restant (Achat)", UI.formatCurrency(stockValue)],
      ["Valeur du stock restant (Vente)", UI.formatCurrency(stockSaleValue)],
      ["Nombre d'entrees de stock", entries.length.toString()],
      ["Nombre de sorties de stock", exits.length.toString()],
      ["Nombre de retours valides", `${nbRetours} (${UI.formatCurrency(montantRetours)})`],
    ];

    await PDFExport.generate(
      "Rapport de Pilotage — Tableau de bord",
      headers,
      rows,
      {
        orientation: 'portrait',
        subHeader: [
          `Periode : ${periodLabel}`,
          "Resume complet des indicateurs cles de la pharmacie"
        ]
      }
    );

  } else if (activeTab === 'detail') {
    // ── Onglet 2 : Rapport detaille des ventes ──
    // Fiabilisation — même correctif que mcRenderDetail (affichage écran).
    const { saleItems: allPeriodSaleItems, sales: allPeriodSales, productMap, stockMap, userMap, patientMap } = dataObj;
    const sales = allPeriodSales.filter(s => ['completed', 'paid'].includes(s.status));
    const completedSaleIds = new Set(sales.map(s => s.id));
    const saleItems = allPeriodSaleItems.filter(si => completedSaleIds.has(si.saleId));

    const saleMap = {};
    sales.forEach(s => { saleMap[s.id] = s; });

    let detailData = saleItems.map(si => {
      const sale = saleMap[si.saleId] || {};
      const prod = productMap[si.productId] || {};
      const costPrice = si.purchasePrice || prod.purchasePrice || 0;
      const sellPrice = si.price || prod.salePrice || 0;
      const profit = (sellPrice - costPrice) * (si.quantity || 0);
      const user = userMap[sale.userId];
      const patient = sale.patientId ? patientMap[sale.patientId] : null;

      return {
        name: prod.name || si.productName || 'Inconnu',
        form: prod.form || '—',
        category: prod.category || '—',
        brand: prod.brand || '—',
        qty: si.quantity || 0,
        stockQty: stockMap[si.productId]?.quantity ?? '—',
        costPrice,
        sellPrice,
        profit,
        date: sale.date || '—',
        seller: user?.name || user?.username || '—',
        client: patient?.name || (sale.patientName || '—'),
      };
    });

    // Appliquer les memes filtres que l'affichage
    const fCat = window._mcFilterCat || '';
    const fForm = window._mcFilterForm || '';
    const fBrand = window._mcFilterBrand || '';
    const fSeller = window._mcFilterSeller || '';
    const fSearch = (window._mcFilterSearch || '').toLowerCase();

    if (fCat) detailData = detailData.filter(d => d.category === fCat);
    if (fForm) detailData = detailData.filter(d => d.form === fForm);
    if (fBrand) detailData = detailData.filter(d => d.brand === fBrand);
    if (fSeller) detailData = detailData.filter(d => d.seller === fSeller);
    if (fSearch) detailData = detailData.filter(d => d.name.toLowerCase().includes(fSearch));

    detailData.sort((a, b) => new Date(b.date) - new Date(a.date));

    const headers = ["Medicament", "Forme", "Categorie", "Qte", "Stock Rest.", "P. Achat", "P. Vente", "Benefice", "Date & Heure", "Vendeur"];
    const rows = detailData.map(d => [
      d.name,
      d.form,
      d.category,
      d.qty.toString(),
      d.stockQty.toString(),
      UI.formatCurrency(d.costPrice),
      UI.formatCurrency(d.sellPrice),
      UI.formatCurrency(d.profit),
      UI.formatDateTime(d.date),
      d.seller
    ]);

    const totalQty = detailData.reduce((a, d) => a + d.qty, 0);
    const totalRevenue = detailData.reduce((a, d) => a + d.sellPrice * d.qty, 0);
    const totalProfit = detailData.reduce((a, d) => a + d.profit, 0);

    await PDFExport.generate(
      "Rapport detaille des ventes",
      headers,
      rows,
      {
        orientation: 'landscape',
        subHeader: [
          `Periode : ${periodLabel}`,
          `Filtres appliques : ${fSearch ? 'Recherche: "' + fSearch + '" ' : ''}${fCat ? 'Categorie: ' + fCat + ' ' : ''}${fForm ? 'Forme: ' + fForm : ''}`
        ],
        summaryBlocks: [
          { label: "Volume total des ventes", value: `${totalQty} articles vendus` },
          { label: "Chiffre d'Affaires total", value: UI.formatCurrency(totalRevenue) },
          { label: "Benefice net estime", value: UI.formatCurrency(totalProfit) }
        ]
      }
    );

  } else if (activeTab === 'reorder') {
    // ── Onglet 3 : Aide a la commande fournisseur ──
    const { products, stockMap, allSales, allSaleItems } = dataObj;

    const now = new Date();
    const d30Ago = new Date(now);
    d30Ago.setDate(d30Ago.getDate() - 30);
    const d30Str = d30Ago.toISOString().split('T')[0];

    const recentSales = allSales.filter(s => s.date && s.date.slice(0, 10) >= d30Str);
    const recentSaleIds = new Set(recentSales.map(s => s.id));
    const recentItems = allSaleItems.filter(si => recentSaleIds.has(si.saleId));

    const consumption = {};
    recentItems.forEach(si => {
      consumption[si.productId] = (consumption[si.productId] || 0) + (si.quantity || 0);
    });

    const nbDays = 30;

    let recommendations = products.map(p => {
      const currentStock = stockMap[p.id]?.quantity || 0;
      const totalConsumed = consumption[p.id] || 0;
      const cmq = totalConsumed / nbDays;
      const coverageDays = cmq > 0 ? Math.floor(currentStock / cmq) : (currentStock > 0 ? 999 : 0);

      let priority, priorityLabel, justification;
      if (currentStock === 0 || (cmq > 0 && coverageDays < 2)) {
        priority = 1;
        priorityLabel = 'Critique';
      } else if (currentStock <= (p.minStock || 10)) {
        priority = 2;
        priorityLabel = 'Elevee';
      } else if (cmq > 0 && coverageDays < 15) {
        priority = 3;
        priorityLabel = 'Moyenne';
      } else if (cmq > 0 && coverageDays < 30) {
        priority = 4;
        priorityLabel = 'Faible';
      } else {
        priority = 5;
        priorityLabel = null;
      }

      const targetStock = Math.ceil(cmq * 30);
      const suggestedQty = Math.max(0, targetStock - currentStock);

      return {
        name: p.name,
        category: p.category || '—',
        currentStock,
        cmq,
        coverageDays: cmq > 0 ? coverageDays : null,
        priority,
        priorityLabel,
        suggestedQty,
        justification: currentStock === 0 ? 'Rupture' : `${coverageDays}j de couverture`,
        purchasePrice: p.purchasePrice || 0,
      };
    }).filter(r => r.priorityLabel !== null);

    recommendations.sort((a, b) => a.priority - b.priority || b.cmq - a.cmq);

    // Appliquer les filtres
    const fPriority = window._mcReorderPriority || '';
    const fSearchReorder = (window._mcReorderSearch || '').toLowerCase();
    if (fPriority) recommendations = recommendations.filter(r => r.priorityLabel === fPriority);
    if (fSearchReorder) recommendations = recommendations.filter(r => r.name.toLowerCase().includes(fSearchReorder));

    const headers = ["Medicament", "Categorie", "Stock Actuel", "CMQ", "Couverture", "Priorite", "Qte Suggeree", "Cout Estime", "Detail"];
    const rows = recommendations.map(r => [
      r.name,
      r.category,
      r.currentStock.toString(),
      r.cmq.toFixed(1) + "/j",
      r.coverageDays !== null ? r.coverageDays + "j" : "—",
      r.priorityLabel,
      r.suggestedQty.toString(),
      UI.formatCurrency(r.suggestedQty * r.purchasePrice),
      r.justification
    ]);

    const totalReorderCost = recommendations.reduce((a, r) => a + r.suggestedQty * r.purchasePrice, 0);

    await PDFExport.generate(
      "Suggestions de Reapprovisionnement Fournisseur",
      headers,
      rows,
      {
        orientation: 'landscape',
        subHeader: [
          `Genere le : ${UI.formatDate(new Date())}`,
          `Filtre prioritaire : ${fPriority || 'Toutes priorites'}`
        ],
        summaryBlocks: [
          { label: "Nombre de produits a commander", value: `${recommendations.length} medicaments` },
          { label: "Budget de commande estime", value: UI.formatCurrency(totalReorderCost) }
        ]
      }
    );
  }
}


// ══════════════════════════════════════════════════════════════════════
// 8. STYLES CSS DU MODULE (injectes une seule fois)
// ══════════════════════════════════════════════════════════════════════

(function injectMCStyles() {
  if (document.getElementById('mc-styles')) return;
  const style = document.createElement('style');
  style.id = 'mc-styles';
  style.textContent = `
    .mc-tab {
      padding: 10px 20px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      border-bottom: 3px solid transparent;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .mc-tab:hover {
      color: var(--text);
      background: var(--surface-2, rgba(0,0,0,0.03));
    }
    .mc-tab-active {
      color: var(--primary) !important;
      border-bottom-color: var(--primary) !important;
    }
    @media (max-width: 768px) {
      .mc-tab { padding: 8px 12px; font-size: 12px; }
    }
  `;
  document.head.appendChild(style);
})();


// ══════════════════════════════════════════════════════════════════════
// 9. ENREGISTREMENT & EXPORTS
// ══════════════════════════════════════════════════════════════════════

Router.register('management-control', renderManagementControl);

window.mcSwitchTab = mcSwitchTab;
window.mcSetPeriod = mcSetPeriod;
window.mcCustomPeriod = mcCustomPeriod;
window.mcRenderCurrentTab = mcRenderCurrentTab;
window.mcExportPDF = mcExportPDF;
