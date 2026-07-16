/**
 * OrdiveX — Moteur d'Alertes Automatiques
 * Scan périodique : stocks bas, expirations, anomalies
 */

const AlertsEngine = {
  intervalId: null,
  lastRun: null,

  async start() {

    // Run immediately then every 15 minutes
    await this.run();
    this.intervalId = setInterval(() => this.run(), 15 * 60 * 1000);
  },

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);

  },

  async run() {
    if (!DB.AppState.currentUser) return;
    if (DB._isPulling) return; // Ne pas scanner pendant un pull
    this.lastRun = Date.now();


    try {
      await Promise.all([
        this.checkStockAlerts(),
        this.checkExpiryAlerts(),
        this.checkPendingOrders(),
        this.checkCaisseReminder(),
      ]);
    } catch (e) {
      console.warn('[AlertsEngine] Erreur:', e.message);
    }
  },

  async checkStockAlerts() {
    const [products, stockAll, existingAlerts, allSettings] = await Promise.all([
      DB.dbGetAll('products'),
      DB.dbGetAll('stock'),
      DB.dbGetAll('alerts'),
      DB.dbGetAll('settings'),
    ]);

    const stockMap = {};
    stockAll.forEach(s => { stockMap[s.productId] = s.quantity; });

    // Récupérer le seuil d'alerte global configuré
    const thresholdSetting = (allSettings || []).find(s => s.key === 'min_stock_alert');
    const defaultThreshold = parseInt(thresholdSetting ? thresholdSetting.value : '5', 10) || 5;

    // --- RESCUE MODE : Nettoyage d'urgence si la BDD a été spammée ---
    if (existingAlerts.length > 3000) {
      console.warn('[AlertsEngine] Rescue: Trop d\'alertes détectées, purge en cours...');
      for (const a of existingAlerts) {
        if (a.type === 'RUPTURE' || a.type === 'LOW_STOCK') {
           await DB.dbDelete('alerts', a.id);
        }
      }
      return; // On s'arrête ici pour ce cycle, le prochain créera les groupes propres
    }
    // -----------------------------------------------------------------

    const activeRuptureAlerts = existingAlerts.filter(a => a.status === 'unread' && a.type === 'RUPTURE');
    const activeLowStockAlerts = existingAlerts.filter(a => a.status === 'unread' && a.type === 'LOW_STOCK');

    const ruptureSet = new Set(activeRuptureAlerts.map(a => a.productId));
    const lowStockSet = new Set(activeLowStockAlerts.map(a => a.productId));

    let newRuptures = [];
    let newLowStocks = [];

    for (const product of products) {
      if (product.status !== 'active') continue;
      const qty = stockMap[product.id] || 0;
      const min = product.minStock || defaultThreshold;

      if (qty === 0) {
        if (!ruptureSet.has(product.id) && !ruptureSet.has(-1)) newRuptures.push(product);
      } else if (qty <= min) {
        if (!lowStockSet.has(product.id) && !lowStockSet.has(-2)) newLowStocks.push({product, qty, min});
      }
    }

    // Protection contre l'explosion d'alertes
    if (newRuptures.length > 50) {
      await DB.dbAdd('alerts', {
        type: 'RUPTURE',
        productId: -1,
        productName: 'Alerte Globale',
        message: `Rupture massive: ${newRuptures.length} produits sont en rupture.`,
        status: 'unread',
        date: Date.now(),
        priority: 'critical',
      });
    } else {
      for (const p of newRuptures) {
        await DB.dbAdd('alerts', {
          type: 'RUPTURE',
          productId: p.id,
          productName: p.name,
          message: `RUPTURE : ${p.name} — Stock épuisé`,
          status: 'unread',
          date: Date.now(),
          priority: 'critical',
        });
      }
    }

    if (newLowStocks.length > 50) {
      await DB.dbAdd('alerts', {
        type: 'LOW_STOCK',
        productId: -2,
        productName: 'Alerte Globale',
        message: `Stock bas massif: ${newLowStocks.length} produits sont presque épuisés.`,
        status: 'unread',
        date: Date.now(),
        priority: 'high',
      });
    } else {
      for (const item of newLowStocks) {
        await DB.dbAdd('alerts', {
          type: 'LOW_STOCK',
          productId: item.product.id,
          productName: item.product.name,
          message: `Stock bas : ${item.product.name} — ${item.qty} unités (seuil: ${item.min})`,
          status: 'unread',
          date: Date.now(),
          priority: item.qty <= Math.floor(item.min / 2) ? 'high' : 'medium',
        });
      }
    }
  },

  async checkExpiryAlerts() {
    const [lots, products, existingAlerts] = await Promise.all([
      DB.dbGetAll('lots'),
      DB.dbGetAll('products'),
      DB.dbGetAll('alerts'),
    ]);

    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });
    const today = new Date().toISOString().split('T')[0];

    for (const lot of lots) {
      if (lot.status !== 'active') continue;
      const days = UI.daysUntilExpiry(lot.expiryDate);
      if (days === null) continue;

      const prod = productMap[lot.productId];
      if (!prod || prod.status === 'inactive') continue;

      // Don't re-alert same lot same day
      const hasAlert = existingAlerts.some(a =>
        a.lotId === lot.id &&
        a.status === 'unread' &&
        new Date(a.date).toISOString().split('T')[0] === today
      );
      if (hasAlert) continue;

      if (days <= 0) {
        await DB.dbAdd('alerts', {
          type: 'EXPIRY_CRITICAL',
          productId: lot.productId,
          lotId: lot.id,
          productName: prod.name,
          message: `LOT EXPIRÉ : ${prod.name} — Lot ${lot.lotNumber} — ${lot.quantity} unités à détruire`,
          status: 'unread',
          date: Date.now(),
          priority: 'critical',
        });
        // Auto-block lot
        await DB.dbPut('lots', { ...lot, status: 'blocked' });
      } else if (days <= 30) {
        await DB.dbAdd('alerts', {
          type: 'EXPIRY_CRITICAL',
          productId: lot.productId,
          lotId: lot.id,
          productName: prod.name,
          message: `Expiration dans ${days} jours — ${prod.name} (Lot ${lot.lotNumber}) — ${lot.quantity} unités`,
          status: 'unread',
          date: Date.now(),
          priority: 'high',
        });
      } else if (days <= 90) {
        await DB.dbAdd('alerts', {
          type: 'EXPIRY_SOON',
          productId: lot.productId,
          lotId: lot.id,
          productName: prod.name,
          message: `Expiration dans ${days} jours — ${prod.name} (Lot ${lot.lotNumber})`,
          status: 'unread',
          date: Date.now(),
          priority: days <= 60 ? 'medium' : 'low',
        });
      }
    }
  },

  async checkPendingOrders() {
    const orders = await DB.dbGetAll('purchaseOrders');
    const existingAlerts = await DB.dbGetAll('alerts');
    const today = new Date().toISOString().split('T')[0];

    for (const order of orders) {
      if (order.status !== 'sent') continue;
      if (!order.expectedDate) continue;

      const daysLate = Math.floor((new Date() - new Date(order.expectedDate)) / 86400000);
      if (daysLate < 3) continue;

      const hasAlert = existingAlerts.some(a =>
        a.orderId === order.id && a.type === 'ORDER_LATE' && a.status === 'unread'
      );
      if (hasAlert) continue;

      await DB.dbAdd('alerts', {
        type: 'ORDER_LATE',
        orderId: order.id,
        message: `Commande en retard : ${order.orderNumber} — ${daysLate} jours de retard`,
        status: 'unread',
        date: Date.now(),
        priority: daysLate >= 7 ? 'high' : 'medium',
      });
    }
  },

  async checkCaisseReminder() {
    // Remind at end of day if caisse not closed
    const now = new Date();
    if (now.getHours() < 18) return; // Only after 18h

    const today = now.toISOString().split('T')[0];
    const cashRegister = await DB.dbGetAll('cashRegister');
    const todayClosed = cashRegister.some(c => c.type === 'closure' && c.date === today);
    if (todayClosed) return;

    const existingAlerts = await DB.dbGetAll('alerts');
    const hasAlert = existingAlerts.some(a =>
      a.type === 'CAISSE_REMINDER' && a.status === 'unread' &&
      new Date(a.date).toISOString().split('T')[0] === today
    );
    if (hasAlert) return;

    await DB.dbAdd('alerts', {
      type: 'CAISSE_REMINDER',
      message: `Rappel : Clôture de caisse journalière non effectuée`,
      status: 'unread',
      date: Date.now(),
      priority: 'medium',
    });
  },
};

// Auto-generate stock suggestions for low stock
async function generateReorderSuggestions() {
  const [products, stockAll, movements] = await Promise.all([
    DB.dbGetAll('products'),
    DB.dbGetAll('stock'),
    DB.dbGetAll('movements'),
  ]);

  const stockMap = {};
  stockAll.forEach(s => { stockMap[s.productId] = s.quantity; });

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentSales = movements.filter(m => m.type === 'EXIT' && m.subType === 'SALE' && new Date(m.date).getTime() > thirtyDaysAgo);

  // Indexer les ventes par productId pour éviter O(n²)
  const salesByProduct = {};
  recentSales.forEach(m => {
    if (!salesByProduct[m.productId]) salesByProduct[m.productId] = 0;
    salesByProduct[m.productId] += Math.abs(m.quantity || 0);
  });

  const suggestions = [];

  for (const product of products.filter(p => p.status === 'active')) {
    const qty = stockMap[product.id] || 0;
    if (qty > product.minStock * 1.5) continue;

    // Calculate average daily consumption
    const totalSold = salesByProduct[product.id] || 0;
    const avgDailyConsumption = totalSold / 30;

    // Days of stock remaining
    const daysRemaining = avgDailyConsumption > 0 ? Math.floor(qty / avgDailyConsumption) : 999;

    // Suggested order quantity (30-day supply)
    const suggestedQty = Math.max(product.minStock * 3, Math.ceil(avgDailyConsumption * 30));

    suggestions.push({
      product,
      currentStock: qty,
      avgDailyConsumption: avgDailyConsumption.toFixed(2),
      daysRemaining,
      suggestedQty,
      urgency: daysRemaining <= 7 ? 'critical' : daysRemaining <= 14 ? 'high' : 'medium',
    });
  }

  return suggestions.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// Render reorder suggestions panel
async function renderReorderSuggestions(container) {
  UI.loading(container, 'Calcul des suggestions de réapprovisionnement...');

  const suggestions = await generateReorderSuggestions();
  
  // Initialiser les stats de liste pour la pagination
  suggestions.forEach(s => {
    s.selected = true;
    s.suggestedQtyToOrder = s.suggestedQty;
  });
  window._reorderSuggestions = suggestions;
  window._reorderPage = 1;

  if (suggestions.length === 0) {
    UI.empty(container, 'Tous les stocks sont suffisants', 'package');
    return;
  }

  const criticalCount = suggestions.filter(s => s.urgency === 'critical').length;
  const highCount = suggestions.filter(s => s.urgency === 'high').length;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Suggestions de Réapprovisionnement</h1>
        <p class="page-subtitle">Basé sur la consommation des 30 derniers jours</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" id="bulk-order-btn" onclick="bulkOrderFromSuggestions()" style="display:none"><i data-lucide="shopping-cart"></i> Commander la sélection</button>
        <button class="btn btn-secondary" onclick="Router.navigate('purchase-orders')"><i data-lucide="file-text"></i> Bons de Commande</button>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-chip stat-red"><span class="stat-val">${criticalCount}</span><span class="stat-label">Urgents &lt;7j</span></div>
      <div class="stat-chip stat-orange"><span class="stat-val">${highCount}</span><span class="stat-label">Prioritaires &lt;14j</span></div>
      <div class="stat-chip stat-blue"><span class="stat-val">${suggestions.length}</span><span class="stat-label">Total à commander</span></div>
    </div>

    <div id="reorder-table-container"></div>
  `;
  renderReorderTable();
}

function updateReorderState(idx, key, val) {
  if (!window._reorderSuggestions) return;
  if (key === 'selected') window._reorderSuggestions[idx].selected = val;
  if (key === 'qty') window._reorderSuggestions[idx].suggestedQtyToOrder = parseInt(val) || 0;
  // Mettre à jour le bouton de commande massive
  _updateBulkOrderBtn();
}

function _updateBulkOrderBtn() {
  var btn = document.getElementById('bulk-order-btn');
  if (!btn) return;
  var suggestions = window._reorderSuggestions || [];
  var selected = suggestions.filter(function(s) { return s.selected; });
  if (selected.length > 0) {
    btn.style.display = 'inline-flex';
    btn.innerHTML = '<i data-lucide="shopping-cart"></i> Commander ' + selected.length + ' produit(s)';
    if (window.lucide) lucide.createIcons({ node: btn });
  } else {
    btn.style.display = 'none';
  }
}

function renderReorderTable() {
  const container = document.getElementById('reorder-table-container');
  if (!container) return;

  const suggestions = window._reorderSuggestions || [];
  const PAGE_SIZE = 100;
  const totalPages = Math.max(1, Math.ceil(suggestions.length / PAGE_SIZE));
  if (window._reorderPage > totalPages) window._reorderPage = totalPages;
  const start = (window._reorderPage - 1) * PAGE_SIZE;
  const pageData = suggestions.slice(start, start + PAGE_SIZE);

  container.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="select-all-suggestions" onchange="toggleAllSuggestions(this)" checked></th>
            <th>Produit</th>
            <th>Stock actuel</th>
            <th>Conso/jour</th>
            <th>Jours restants</th>
            <th>Qté suggérée</th>
            <th>Urgence</th>
            <th>Commander</th>
          </tr>
        </thead>
        <tbody>
          ${pageData.map((s, i) => {
            const originalIdx = start + i;
            return `
            <tr>
              <td><input type="checkbox" class="suggestion-cb" data-idx="${originalIdx}" ${s.selected ? 'checked' : ''} onchange="updateReorderState(${originalIdx}, 'selected', this.checked)"></td>
              <td>
                <div><strong>${s.product.name}</strong></div>
                <div class="text-muted text-sm">${s.product.category}</div>
              </td>
              <td>
                <span class="${s.currentStock === 0 ? 'text-danger' : s.currentStock <= s.product.minStock ? 'text-warning' : 'text-success'} font-bold">${s.currentStock}</span>
                <span class="text-muted text-sm"> / min ${s.product.minStock}</span>
              </td>
              <td>${s.avgDailyConsumption}</td>
              <td>
                <span class="badge badge-${s.urgency === 'critical' ? 'danger' : s.urgency === 'high' ? 'warning' : 'info'}">
                  ${s.daysRemaining >= 999 ? '∞' : s.daysRemaining + 'j'}
                </span>
              </td>
              <td><input type="number" class="input-sm" id="suggest-qty-${originalIdx}" value="${s.suggestedQtyToOrder}" min="1" style="width:70px" onchange="updateReorderState(${originalIdx}, 'qty', this.value)"></td>
              <td><span class="badge badge-${s.urgency === 'critical' ? 'danger' : s.urgency === 'high' ? 'warning' : 'info'}">${s.urgency === 'critical' ? 'Critique' : s.urgency === 'high' ? 'Haute' : 'Normale'}</span></td>
              <td>
                <button class="btn btn-xs btn-primary" onclick="quickOrder(${s.product.id}, '${s.product.name.replace(/'/g, "\\'")}')">Commander</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <!-- Le bouton de commande massive a été retiré -->

    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;gap:12px;flex-wrap:wrap;">
      <span style="font-size:13px;color:var(--text-muted)">${suggestions.length.toLocaleString()} suggestions — Page ${window._reorderPage}/${totalPages}</span>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" ${window._reorderPage <= 1 ? 'disabled' : ''} onclick="window._reorderPage--;renderReorderTable()">◀ Précédent</button>
        <button class="btn btn-secondary btn-sm" ${window._reorderPage >= totalPages ? 'disabled' : ''} onclick="window._reorderPage++;renderReorderTable()">Suivant ▶</button>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function toggleAllSuggestions(cb) {
  if (!window._reorderSuggestions) return;
  window._reorderSuggestions.forEach(s => s.selected = cb.checked);
  renderReorderTable();
  _updateBulkOrderBtn();
}

async function createOrderFromSuggestions() {
  const suggestions = window._reorderSuggestions || [];
  const selected = suggestions.filter(s => s.selected);

  if (selected.length === 0) {
    UI.toast('Sélectionnez au moins un produit', 'warning');
    return;
  }

  const suppliers = await DB.dbGetAll('suppliers');
  if (suppliers.length === 0) {
    UI.toast('Aucun fournisseur enregistré', 'warning');
    return;
  }

  // Get quantities from state
  const items = selected.map((s, i) => {
    return { 
      productId: s.product.id, 
      productName: s.product.name, 
      quantity: s.suggestedQtyToOrder || s.suggestedQty, 
      unitPrice: s.product.purchasePrice || 0, 
      receivedQty: 0 
    };
  });

  const totalAmount = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
  const orderId = await DB.dbAdd('purchaseOrders', {
    supplierId: suppliers[0].id,
    orderNumber: `BC-AUTO-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
    date: new Date().toISOString().split('T')[0],
    expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    items,
    totalAmount,
    status: 'pending',
    note: 'Commande générée automatiquement depuis les suggestions de réapprovisionnement',
    createdBy: DB.AppState.currentUser?.id,
  });

  await DB.writeAudit('AUTO_ORDER', 'purchaseOrders', orderId, { itemCount: items.length, totalAmount });
  UI.toast(`Bon de commande BC-AUTO créé — ${items.length} produit(s)`, 'success', 4000);
  Router.navigate('purchase-orders');
}

async function quickOrder(productId, productName) {
  var suppliers = await DB.dbGetAll('suppliers');
  if (suppliers.length === 0) {
    UI.toast('Ajoutez d\'abord un fournisseur', 'warning');
    return;
  }
  // Récupérer les infos complètes du produit pour le pré-remplissage
  var product = await DB.dbGet('products', parseInt(productId));
  await showNewOrder(suppliers[0].id, suppliers[0].name, product || { id: productId, name: productName });
}

async function bulkOrderFromSuggestions() {
  var suggestions = window._reorderSuggestions || [];
  var selected = suggestions.filter(function(s) { return s.selected; });
  if (selected.length === 0) {
    UI.toast('Sélectionnez au moins un produit', 'warning');
    return;
  }

  var suppliers = await DB.dbGetAll('suppliers');
  if (suppliers.length === 0) {
    UI.toast('Ajoutez d\'abord un fournisseur dans le menu Fournisseurs', 'warning');
    return;
  }

  // Modale de choix du fournisseur + confirmation
  var supplierOptions = suppliers.map(function(s) {
    return '<option value="' + s.id + '">' + s.name + '</option>';
  }).join('');

  var totalEstime = selected.reduce(function(acc, s) {
    return acc + (s.suggestedQtyToOrder || s.suggestedQty) * (s.product.purchasePrice || 0);
  }, 0);

  UI.modal('<i data-lucide="shopping-cart" class="modal-icon-inline"></i> Commander ' + selected.length + ' produits', '\
    <div class="form-grid">\
      <div class="form-group">\
        <label>Fournisseur *</label>\
        <select id="bulk-order-supplier" class="form-control">' + supplierOptions + '</select>\
      </div>\
      <div class="form-group">\
        <label>Date de livraison prévue</label>\
        <input type="date" id="bulk-order-date" class="form-control" value="' + new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0] + '">\
      </div>\
      <div class="form-group">\
        <label>Note / Urgence</label>\
        <textarea id="bulk-order-note" class="form-control" rows="2" placeholder="Commande urgente, spécifications spéciales..."></textarea>\
      </div>\
    </div>\
    <div style="margin-top:16px;padding:12px;background:var(--surface-hover);border-radius:8px">\
      <strong>' + selected.length + ' produits sélectionnés</strong>\
      <span style="float:right;font-weight:700;color:var(--primary)">Total estimé : ' + UI.formatCurrency(totalEstime) + '</span>\
      <div style="margin-top:8px;max-height:200px;overflow-y:auto">\
        <table class="data-table" style="font-size:12px"><thead><tr><th>Produit</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead><tbody>' +
        selected.map(function(s) {
          var qty = s.suggestedQtyToOrder || s.suggestedQty;
          var price = s.product.purchasePrice || 0;
          return '<tr><td>' + s.product.name + '</td><td>' + qty + '</td><td>' + UI.formatCurrency(price) + '</td><td>' + UI.formatCurrency(qty * price) + '</td></tr>';
        }).join('') +
        '</tbody></table>\
      </div>\
    </div>', {
    size: 'large',
    footer: '\
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>\
      <button class="btn btn-warning" onclick="submitBulkOrder(\'pending\')"><i data-lucide="save"></i> Brouillon</button>\
      <button class="btn btn-primary" onclick="submitBulkOrder(\'sent\')"><i data-lucide="send"></i> Créer & Envoyer</button>'
  });
  if (window.lucide) lucide.createIcons();
}

async function submitBulkOrder(status) {
  var suggestions = window._reorderSuggestions || [];
  var selected = suggestions.filter(function(s) { return s.selected; });
  var supplierId = parseInt(document.getElementById('bulk-order-supplier')?.value);
  var note = document.getElementById('bulk-order-note')?.value || '';

  if (!supplierId) { UI.toast('Sélectionnez un fournisseur', 'error'); return; }
  if (selected.length === 0) { UI.toast('Aucun produit sélectionné', 'warning'); return; }

  var items = selected.map(function(s) {
    return {
      productId: s.product.id,
      productName: s.product.name,
      quantity: s.suggestedQtyToOrder || s.suggestedQty,
      unitPrice: s.product.purchasePrice || 0
    };
  });

  UI.closeModal();

  // Stocker dans la variable globale de transfert
  window._pendingOrderData = {
    supplierId: supplierId,
    items: items,
    note: note
  };

  Router.navigate('purchase-orders');
}

window.AlertsEngine = AlertsEngine;
window.generateReorderSuggestions = generateReorderSuggestions;
window.renderReorderSuggestions = renderReorderSuggestions;
window.toggleAllSuggestions = toggleAllSuggestions;
window.createOrderFromSuggestions = createOrderFromSuggestions;
window.quickOrder = quickOrder;
window.bulkOrderFromSuggestions = bulkOrderFromSuggestions;
window.submitBulkOrder = submitBulkOrder;
window._updateBulkOrderBtn = _updateBulkOrderBtn;

Router.register('reorder', (container) => renderReorderSuggestions(container));
