/**
 * OrdiveX — Module Gestion des Factures Professionnelles
 * Factures fournisseurs, traçabilité, liaison stock
 */

const INVOICE_PAGE_SIZE = 50;

async function renderInvoices(container) {
  // Garde d'accès module
  if (window.Auth && !Auth.can('module_invoices') && DB.AppState.currentUser?.role !== 'admin') {
    container.innerHTML = `
      <div style="padding:60px; text-align:center; color:var(--text-muted)">
        <i data-lucide="lock" style="width:56px; height:56px; margin:0 auto 16px; opacity:0.3; display:block"></i>
        <h3>Accès refusé</h3>
        <p>Vous n'avez pas la permission de consulter les factures fournisseurs.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ root: container });
    return;
  }

  UI.loading(container, 'Chargement des factures...');
  const [invoices, suppliers, products] = await Promise.all([
    DB.dbGetAll('invoices'),
    DB.dbGetAll('suppliers'),
    DB.dbGetAll('products'),
  ]);

  const supplierMap = {};
  suppliers.forEach(s => { supplierMap[s.id] = s; });
  // Exclure les médicaments désactivés : un produit supprimé du catalogue
  // ne doit plus pouvoir être ajouté à une facture (même un ancien brouillon).
  window._invoicesProducts = products.filter(p => p.status !== 'inactive');

  const sorted = invoices.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const draft = invoices.filter(i => i.status === 'draft');
  const validated = invoices.filter(i => i.status === 'validated');

  window._invoicesData = sorted;
  window._invoicesSupplierMap = supplierMap;
  window._invoicesCurrentPage = 1;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Factures Professionnelles</h1>
        <p class="page-subtitle">${invoices.length} factures — ${draft.length} en brouillon</p>
      </div>
      <div class="header-actions">
        ${Auth.can('invoices_create') ? `<input type="file" id="inv-csv-file" accept=".csv" style="display:none" onchange="importInvoiceCsv(event)">` : ''}
        ${Auth.can('invoices_create') ? `<button class="btn btn-secondary" onclick="document.getElementById('inv-csv-file').click()"><i data-lucide="upload-cloud"></i> Importer Facture (CSV)</button>` : ''}
        <button class="btn btn-secondary" onclick="exportInvoicesPDF()"><i data-lucide="printer"></i> PDF</button>
        <button class="btn btn-secondary" onclick="exportInvoicesCsv()"><i data-lucide="file-spreadsheet"></i> Exporter CSV</button>
        ${Auth.can('invoices_create') ? `<button class="btn btn-primary" onclick="showNewInvoiceForm()"><i data-lucide="plus"></i> Nouvelle Facture</button>` : ''}
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-chip stat-orange"><span class="stat-val">${draft.length}</span><span class="stat-label">Brouillons</span></div>
      <div class="stat-chip stat-green"><span class="stat-val">${validated.length}</span><span class="stat-label">Validées</span></div>
      <div class="stat-chip stat-blue"><span class="stat-val">${UI.formatCurrency(validated.reduce((a, i) => a + (i.totalAmount || 0), 0))}</span><span class="stat-label">Total Validé</span></div>
    </div>

    <div class="filter-bar" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 20px;">
      <input type="text" id="inv-search" class="filter-input" placeholder="N° de facture..." oninput="var c=document.getElementById('inv-table-container'); if(c) c.dataset.page=1; filterInvoices();" style="flex: 1; min-width: 200px;">
      <select id="inv-status" class="filter-select" onchange="var c=document.getElementById('inv-table-container'); if(c) c.dataset.page=1; filterInvoices();" style="min-width: 150px;">
        <option value="">Tous statuts</option>
        <option value="draft">Brouillon</option>
        <option value="validated">Validée</option>
      </select>
      <select id="inv-supplier" class="filter-select" onchange="var c=document.getElementById('inv-table-container'); if(c) c.dataset.page=1; filterInvoices();" style="min-width: 200px;">
        <option value="">Tous fournisseurs</option>
        ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
    </div>

    <div id="inv-table-container"></div>
  `;

  filterInvoices();
}

function filterInvoices() {
  const query = (document.getElementById('inv-search')?.value || '').trim().toLowerCase();
  const status = document.getElementById('inv-status')?.value || '';
  const supId = document.getElementById('inv-supplier')?.value;
  let data = window._invoicesData || [];
  
  // Filtrage
  if (query) {
    data = data.filter(i => (i.invoiceNumber || '').toLowerCase().includes(query));
  }
  if (status) {
    data = data.filter(i => i.status === status);
  }
  if (supId) {
    data = data.filter(i => i.supplierId === parseInt(supId));
  }

  const container = document.getElementById('inv-table-container');
  if (!container) return;

  const statusConfig = {
    draft: { label: 'Brouillon', cls: 'badge-neutral' },
    validated: { label: 'Validée', cls: 'badge-success' },
  };

  UI.table(container, [
    { label: 'N° Facture', render: r => `<code class="code-tag">${r.invoiceNumber || 'F-' + String(r.id).padStart(5, '0')}</code>` },
    { label: 'Date', render: r => UI.formatDate(r.date) },
    {
      label: 'Fournisseur', render: r => {
        const s = window._invoicesSupplierMap?.[r.supplierId];
        return s ? `<strong>${s.name}</strong>` : `<strong>${r.supplierName || '—'}</strong>`;
      }
    },
    { label: 'Articles', render: r => `${(r.items || []).length} référence(s)` },
    { label: 'Montant Total', render: r => `<strong>${UI.formatCurrency(r.totalAmount || 0)}</strong>` },
    {
      label: 'Statut', render: r => {
        const s = statusConfig[r.status] || { label: r.status, cls: 'badge-neutral' };
        return `<span class="badge ${s.cls}">${s.label}</span>`;
      }
    },
    {
      label: 'Actions', render: r => {
        const gs = (key) => (window._appSettings || {})[key];
        const canCorriger = r.status === 'validated' && (gs('purchase_allow_edit_after') === 'true' || DB.AppState.currentUser?.role === 'admin');
        const canDelete = r.status === 'draft' && (Auth.can('invoices_delete') || DB.AppState.currentUser?.role === 'admin');
        const canEdit   = r.status === 'draft' && (Auth.can('invoices_edit')   || DB.AppState.currentUser?.role === 'admin');
        const canValidate = r.status === 'draft' && (Auth.can('invoices_create') || DB.AppState.currentUser?.role === 'admin');
        return `
        <div class="actions-cell">
          <button class="btn btn-xs btn-primary" onclick="viewInvoice(${r.id})"><i data-lucide="eye"></i> Voir</button>
          ${canValidate ? `<button class="btn btn-xs btn-success" onclick="validateInvoice(${r.id})"><i data-lucide="check-circle"></i> Valider &amp; Stock</button>` : ''}
          ${canEdit    ? `<button class="btn btn-xs btn-warning" onclick="showNewInvoiceForm(${r.id})"><i data-lucide="edit"></i> Modifier</button>` : ''}
          ${canCorriger ? `<button class="btn btn-xs btn-warning" onclick="unvalidateInvoice(${r.id}, this)"><i data-lucide="rotate-ccw"></i> Corriger</button>` : ''}
          ${canDelete  ? `<button class="btn btn-xs btn-danger" onclick="deleteInvoice(${r.id})"><i data-lucide="trash-2"></i></button>` : ''}
          <button class="btn btn-xs btn-secondary" onclick="printInvoicePDF(${r.id})"><i data-lucide="printer"></i> PDF</button>
        </div>`;
      }
    },
  ], data, { emptyMessage: 'Aucune facture trouvée', emptyIcon: 'file-search', pageSize: INVOICE_PAGE_SIZE });

  if (window.lucide) lucide.createIcons();
}

async function showNewInvoiceForm(invoiceId = null) {
  const suppliers = await DB.dbGetAll('suppliers');
  window._editingInvoiceId = invoiceId;
  window._tvaManuallyModified = false;
  const tvaSetting = ((window._appSettings || {})['pharmacy_tva'] || '0').trim();

  let invoice = null;
  if (invoiceId) {
    invoice = await DB.dbGet('invoices', invoiceId);
  }

  const title = invoice ? `Modifier la Facture N° ${invoice.invoiceNumber}` : 'Nouvelle Facture (Entrée de stock)';
  
  UI.modal(`<i data-lucide="file-text" class="modal-icon-inline"></i> ${title}`, `
    <form id="invoice-form" class="form-grid">
      <div class="form-row">
        <div class="form-group">
          <label>N° Facture *</label>
          <input type="text" name="invoiceNumber" class="form-control" required placeholder="N° inscrit sur la facture" value="${invoice ? invoice.invoiceNumber : ''}">
        </div>
        <div class="form-group">
          <label>Fournisseur *</label>
          <select name="supplierId" id="inv-supplier-select" class="form-control" required>
            <option value="">Sélectionner...</option>
            ${suppliers.map(s => `<option value="${s.id}" ${invoice && invoice.supplierId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Date de facturation *</label>
          <input type="date" name="date" class="form-control" value="${invoice ? invoice.date : new Date().toISOString().split('T')[0]}" required>
        </div>
        <div class="form-group">
          <label>Mode de paiement</label>
          <select name="paymentMethod" class="form-control">
            <option value="virement" ${invoice && invoice.paymentMethod === 'virement' ? 'selected' : ''}>Virement</option>
            <option value="cheque" ${invoice && invoice.paymentMethod === 'cheque' ? 'selected' : ''}>Chèque</option>
            <option value="especes" ${invoice && invoice.paymentMethod === 'especes' ? 'selected' : ''}>Espèces</option>
            <option value="mobile_money" ${invoice && invoice.paymentMethod === 'mobile_money' ? 'selected' : ''}>Mobile Money</option>
            <option value="credit" ${invoice && invoice.paymentMethod === 'credit' ? 'selected' : ''}>Crédit</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Note additionnelle</label>
        <textarea name="note" class="form-control" rows="2" placeholder="Informations complémentaires...">${invoice ? invoice.note || '' : ''}</textarea>
      </div>
    </form>

    <div class="rx-section" style="margin-top:16px">
      <div class="rx-section-header">
        <h4 class="rx-section-title"><i data-lucide="package"></i> Articles facturés</h4>
        <button type="button" class="btn btn-sm btn-primary" onclick="addInvoiceItem()"><i data-lucide="plus"></i> Ajouter article</button>
      </div>
      <div id="invoice-items-list">
        <div class="rx-empty-items">Ajoutez les produits présents sur la facture</div>
      </div>

      <!-- Barre de totaux (arrière-plan bleu, écritures blanches claires) -->
      <div class="order-total-bar" id="invoice-total-bar" style="display:none;flex-direction:column;gap:6px;padding:12px 16px;background:var(--primary);color:#ffffff;border-radius:var(--radius-sm);margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:14px;color:#ffffff">Total Net à Payer :</strong>
          <strong id="invoice-total-display" style="font-size:16px;color:#ffffff;font-weight:800">0 GNF</strong>
        </div>
      </div>
    </div>
  `, {
    size: 'large',
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal(); window._editingInvoiceId = null;">Annuler</button>
      <button class="btn btn-warning" onclick="submitInvoice('draft', this)"><i data-lucide="save"></i> Enregistrer Brouillon</button>
      <button class="btn btn-success" onclick="submitInvoice('validated', this)"><i data-lucide="check-circle"></i> Valider (Mettre à jour stocks)</button>
    `
  });
  if (window.lucide) lucide.createIcons();
  window._invoiceItemCounter = 0;
  
  if (invoice && invoice.items && invoice.items.length > 0) {
    invoice.items.forEach(item => {
      addInvoiceItem(item);
    });
  } else {
    // Ajouter un premier champ vide
    addInvoiceItem();
  }
}

function addInvoiceItem(itemData = null) {
  const listEl = document.getElementById('invoice-items-list');
  if (!listEl) return;
  listEl.querySelector('.rx-empty-items')?.remove();
  document.getElementById('invoice-total-bar')?.style.setProperty('display', 'block');

  const idx = window._invoiceItemCounter++;
  const div = document.createElement('div');
  div.className = 'rx-item-row';
  div.id = `inv-item-${idx}`;
  div.style = 'flex-wrap: wrap; gap: 8px; margin-bottom: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px;';
  
  // Récupérer le taux par défaut de la TVA globale
  const defaultTva = parseFloat(((window._appSettings || {})['pharmacy_tva'] || '0').trim()) || 0;
  
  // Ligne 1: Produit, Qté, Prix Achat, Prix Vente
  // Ligne 2: N° Lot, Date d'expiration
  div.innerHTML = `
    <div style="display: flex; gap: 8px; width: 100%; margin-bottom: 8px;">
      <div class="form-group flex-grow" style="position:relative; margin-bottom:0;">
        <label style="font-size:11px; margin-bottom:2px;">Produit *</label>
        <input type="text" class="form-control" id="inv-search-${idx}" placeholder="Rechercher..." autocomplete="off" oninput="invoiceProductSearch(${idx})">
        <input type="hidden" id="inv-prod-${idx}">
        <div id="inv-dropdown-${idx}" class="order-product-dropdown" style="display:none"></div>
      </div>
      <div class="form-group" style="width:80px; margin-bottom:0;">
        <label style="font-size:11px; margin-bottom:2px;">Qté *</label>
        <input type="number" class="form-control" id="inv-qty-${idx}" placeholder="Qté" min="1" value="1" oninput="updateInvoiceTotal()">
      </div>
      <div class="form-group" style="width:120px; margin-bottom:0;">
        <label style="font-size:11px; margin-bottom:2px;">P. Achat *</label>
        <input type="number" class="form-control" id="inv-price-${idx}" placeholder="Achat" min="0" oninput="updateInvoiceTotal(); autoCalcInvoiceSalePrice(${idx})">
      </div>
      <div class="form-group" style="width:120px; margin-bottom:0;">
        <label style="font-size:11px; margin-bottom:2px;">P. Vente</label>
        <input type="number" class="form-control" id="inv-sale-price-${idx}" placeholder="Vente" min="0" oninput="document.getElementById('inv-sale-price-${idx}').dataset.manual = 'true'">
      </div>
      <div style="display: flex; align-items: flex-end; padding-bottom: 4px;">
        <button type="button" class="btn btn-xs btn-danger" onclick="removeInvoiceItem(${idx})"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
    <div style="display: flex; gap: 8px; width: 100%;">
      <div class="form-group flex-grow" style="margin-bottom:0;">
        <label style="font-size:11px; margin-bottom:2px;">N° de Lot <span style="color:var(--text-muted);font-weight:400">(Optionnel)</span></label>
        <input type="text" class="form-control" id="inv-lot-${idx}" placeholder="Ex: L123456">
      </div>
      <div class="form-group flex-grow" style="margin-bottom:0;">
        <label style="font-size:11px; margin-bottom:2px;">Date d'expiration *</label>
        <input type="date" class="form-control" id="inv-exp-${idx}">
      </div>
    </div>
  `;
  
  // Insérer en haut pour éviter de scroller
  if (listEl.firstChild) {
    listEl.insertBefore(div, listEl.firstChild);
  } else {
    listEl.appendChild(div);
  }
  
  if (window.lucide) lucide.createIcons();

  if (itemData) {
    setTimeout(() => {
      const searchEl = document.getElementById(`inv-search-${idx}`);
      const prodEl = document.getElementById(`inv-prod-${idx}`);
      const qtyEl = document.getElementById(`inv-qty-${idx}`);
      const priceEl = document.getElementById(`inv-price-${idx}`);
      const salePriceEl = document.getElementById(`inv-sale-price-${idx}`);
      const tvaPctEl = document.getElementById(`inv-tva-pct-${idx}`);
      const lotEl = document.getElementById(`inv-lot-${idx}`);
      const expEl = document.getElementById(`inv-exp-${idx}`);
      
      if (searchEl) searchEl.value = itemData.productName || '';
      if (prodEl) {
        prodEl.value = itemData.productId;
        prodEl.dataset.name = itemData.productName || '';
      }
      if (qtyEl) qtyEl.value = itemData.quantity || 1;
      if (priceEl) priceEl.value = itemData.unitPrice || 0;
      if (salePriceEl) salePriceEl.value = itemData.salePrice || 0;
      if (tvaPctEl) tvaPctEl.value = typeof itemData.tvaPct !== 'undefined' ? itemData.tvaPct : 0;
      if (lotEl) lotEl.value = itemData.lotNumber || '';
      if (expEl) expEl.value = itemData.expiryDate || '';
      updateInvoiceTotal();
    }, 50);
  } else {
    // Focus sur la saisie produit
    setTimeout(() => {
      document.getElementById(`inv-search-${idx}`)?.focus();
    }, 50);
  }
}

function invoiceProductSearch(idx) {
  const input = document.getElementById(`inv-search-${idx}`);
  const dropdown = document.getElementById(`inv-dropdown-${idx}`);
  if (!input || !dropdown) return;

  const q = input.value.trim().toLowerCase();
  if (q.length < 2) { dropdown.style.display = 'none'; return; }

  const products = window._invoicesProducts || [];
  const matches = products.filter(p =>
    (p.name || '').toLowerCase().includes(q) ||
    (p.code || '').toLowerCase().includes(q) ||
    (p.dci || '').toLowerCase().includes(q)
  ).slice(0, 15);

  if (!matches.length) {
    dropdown.innerHTML = '<div class="order-dd-empty">Aucun produit trouvé</div>';
    dropdown.style.display = 'block';
    return;
  }

  dropdown.innerHTML = matches.map(p => `
    <div class="order-dd-item" onclick="selectInvoiceProduct(${idx}, ${p.id})">
      <strong>${p.name}</strong> <span style="color:var(--text-muted);font-size:11px">(${p.code})</span>
      ${p.purchasePrice ? `<span style="float:right;color:var(--primary);font-weight:700">${UI.formatCurrency(p.purchasePrice)}</span>` : ''}
    </div>
  `).join('');
  dropdown.style.display = 'block';
}

async function selectInvoiceProduct(idx, productId) {
  const products = window._invoicesProducts || [];
  const prod = products.find(p => p.id === productId);
  if (!prod) return;

  const input = document.getElementById(`inv-search-${idx}`);
  const hidden = document.getElementById(`inv-prod-${idx}`);
  const dropdown = document.getElementById(`inv-dropdown-${idx}`);
  const priceInput = document.getElementById(`inv-price-${idx}`);
  const salePriceInput = document.getElementById(`inv-sale-price-${idx}`);
  const lotInput = document.getElementById(`inv-lot-${idx}`);
  const expInput = document.getElementById(`inv-exp-${idx}`);

  if (input) input.value = prod.name;
  if (hidden) { hidden.value = prod.id; hidden.dataset.name = prod.name; }
  if (priceInput) priceInput.value = prod.purchasePrice || '';
  if (salePriceInput) salePriceInput.value = prod.salePrice || '';
  
  try {
    const lots = await DB.dbGetAll('lots');
    const activeLots = lots.filter(l => l.productId === prod.id && l.status === 'active' && l.lotNumber && l.expiryDate);
    if (activeLots.length > 0) {
      activeLots.sort((a,b) => new Date(b.receiptDate || 0) - new Date(a.receiptDate || 0));
      const recentLot = activeLots[0];
      if (lotInput) lotInput.value = recentLot.lotNumber;
      if (expInput) expInput.value = recentLot.expiryDate;
    } else {
      if (expInput && prod.expiryDate) expInput.value = prod.expiryDate;
    }
  } catch(e) {}

  if (dropdown) dropdown.style.display = 'none';
  updateInvoiceTotal();
}

async function autoCalcInvoiceSalePrice(idx) {
  const buyEl = document.getElementById(`inv-price-${idx}`);
  const sellEl = document.getElementById(`inv-sale-price-${idx}`);
  const hiddenProd = document.getElementById(`inv-prod-${idx}`);
  
  if (!buyEl || !sellEl || sellEl.dataset.manual === 'true') return;
  
  const buyPrice = parseFloat(buyEl.value) || 0;
  if (buyPrice <= 0) return;
  
  // Try to determine product type
  let type = 'generic'; // default
  if (hiddenProd && hiddenProd.value) {
    const products = window._invoicesProducts || [];
    const prod = products.find(p => p.id == hiddenProd.value);
    if (prod && prod.productType) type = prod.productType;
  }
  
  let coeff = type === 'specialty' ? 1.40 : 1.12;
  try {
    const settings = await DB.dbGetAll('settings');
    const cs = settings.find(s => s.key === 'pricing_coeff_specialty')?.value;
    const cg = settings.find(s => s.key === 'pricing_coeff_generic')?.value;
    if (type === 'specialty' && cs) coeff = parseFloat(cs) || 1.40;
    if (type === 'generic' && cg) coeff = parseFloat(cg) || 1.12;
  } catch(e) {}
  
  sellEl.value = Math.round(buyPrice * coeff);
}

function removeInvoiceItem(idx) {
  document.getElementById(`inv-item-${idx}`)?.remove();
  updateInvoiceTotal();
}

function updateInvoiceTotal() {
  let subtotal = 0;

  document.querySelectorAll('.rx-item-row[id^="inv-item-"]').forEach(row => {
    const idx = row.id.replace('inv-item-', '');
    const qty = parseFloat(document.getElementById(`inv-qty-${idx}`)?.value || 0);
    const price = parseFloat(document.getElementById(`inv-price-${idx}`)?.value || 0);
    
    const rowHT = qty * price;
    subtotal += rowHT;
  });

  const total = subtotal;
  const el = document.getElementById('invoice-total-display');
  if (el) el.textContent = UI.formatCurrency(total);

  // Afficher la barre si des items existent
  const bar = document.getElementById('invoice-total-bar');
  if (bar) bar.style.display = subtotal > 0 ? 'flex' : 'none';

  return total;
}

async function submitInvoice(status, btn) {
  const guardKey = 'submit-invoice-' + (window._editingInvoiceId || 'new');
  return ActionGuard.run(guardKey, () => _submitInvoiceImpl(status), btn, 'Enregistrement...');
}

async function _submitInvoiceImpl(status) {
  const form = document.getElementById('invoice-form');
  if (!form || !form.checkValidity()) {
    if (form) form.reportValidity();
    return;
  }

  const supplierId = parseInt(document.getElementById('inv-supplier-select')?.value);
  if (!supplierId) { UI.toast('Sélectionnez un fournisseur', 'error'); return; }
  
  const supplier = window._invoicesSupplierMap ? window._invoicesSupplierMap[supplierId] : null;

  const items = [];
  let validationError = null;
  const gs = (key) => (window._appSettings || {})[key];

  document.querySelectorAll('.rx-item-row[id^="inv-item-"]').forEach(row => {
    const idx = row.id.replace('inv-item-', '');
    const hidden = document.getElementById(`inv-prod-${idx}`);
    const qty = parseInt(document.getElementById(`inv-qty-${idx}`)?.value || 0);
    const price = parseFloat(document.getElementById(`inv-price-${idx}`)?.value || 0);
    const salePrice = parseFloat(document.getElementById(`inv-sale-price-${idx}`)?.value || 0);
    const lotNumber = document.getElementById(`inv-lot-${idx}`)?.value?.trim();
    const expiryDate = document.getElementById(`inv-exp-${idx}`)?.value;

    const rowHT = qty * price;

    if (hidden?.value) {
      // ── Validations conditionnelles selon les Paramètres ──
      if (status === 'validated') {
        if (gs('purchase_expiry_required') !== 'false' && !expiryDate) {
          validationError = "La date d'expiration est requise (paramètre Achats activé).";
        }
        if (gs('purchase_lot_required') === 'true' && !lotNumber) {
          validationError = "Le N° de lot est requis (paramètre Achats activé).";
        }
        if (gs('purchase_saleprice_required') === 'true' && (!salePrice || salePrice <= 0)) {
          validationError = "Le prix de vente est requis (paramètre Achats activé).";
        }
      }
      if (qty > 0) {
        items.push({ 
          productId: parseInt(hidden.value), 
          productName: hidden.dataset?.name || '', 
          quantity: qty, 
          unitPrice: price, 
          salePrice: salePrice,
          tvaPct: 0,
          tvaAmount: 0,
          lotNumber, 
          expiryDate,
          total: rowHT
        });
      }
    }
  });

  if (validationError && status === 'validated') {
    UI.toast(validationError, 'error');
    return;
  }

  if (!items.length) { UI.toast('Ajoutez au moins un article', 'warning'); return; }

  const formData = Object.fromEntries(new FormData(form));
  const subtotal = items.reduce((a, i) => a + i.total, 0);
  const tvaAmount = 0;
  const totalAmount = subtotal;
  
  const invoiceData = {
    // ID résistant aux collisions inter-appareils (voir audit factures) —
    // ignoré côté dbPut en cas d'édition (l'id existant est réappliqué juste
    // après), utilisé tel quel côté dbAdd pour une nouvelle facture.
    id: await DB._generateSyncSafeId(),
    invoiceNumber: formData.invoiceNumber,
    supplierId,
    supplierName: supplier ? supplier.name : 'Inconnu',
    date: formData.date,
    subtotal,
    tvaAmount,
    totalAmount,
    items,
    status, // 'draft' or 'validated'
    paymentMethod: formData.paymentMethod,
    note: formData.note || '',
    createdBy: DB.AppState.currentUser?.id,
  };

  const isEdit = typeof window._editingInvoiceId !== 'undefined' && window._editingInvoiceId !== null;

  try {
    if (status === 'validated') {
      // Revérifier l'état actuel depuis la base — empêche de valider deux
      // fois la même facture (double-clic, ou réouverture d'un formulaire
      // obsolète) et donc de doubler l'entrée en stock qui en découle.
      if (isEdit) {
        const freshInvoice = await DB.dbGet('invoices', window._editingInvoiceId);
        if (freshInvoice && freshInvoice.status === 'validated') {
          UI.toast('Cette facture a déjà été validée — le stock a déjà été mis à jour.', 'warning');
          return;
        }
      }

      const confirm = await UI.confirm(`Confirmer la validation de la facture ?\n\nCela va générer les entrées en stock (Lots et Mouvements) de manière définitive.`);
      if (!confirm) return;

      let invoiceId;
      if (isEdit) {
        invoiceId = window._editingInvoiceId;
        await DB.dbPut('invoices', { ...invoiceData, id: invoiceId });
        await DB.writeAudit('EDIT_INVOICE_VALIDATED', 'invoices', invoiceId, { invoiceNumber: formData.invoiceNumber });
      } else {
        invoiceId = await DB.dbAdd('invoices', invoiceData);
      }

      // Process stock entry — lots/stock/mouvements regroupés dans UNE SEULE
      // transaction IndexedDB (tout s'applique ou rien), pour éviter un
      // stock incohérent en cas de plantage/fermeture en cours de traitement.
      const stockAll = await DB.dbGetAll('stock');
      const stockByProduct = new Map(stockAll.map(s => [s.productId, s]));
      const stockOpByProduct = new Map();
      const txOps = [];

      for (const item of items) {
        txOps.push({
          store: 'lots',
          type: 'add',
          data: {
            productId: item.productId,
            lotNumber: item.lotNumber,
            expiryDate: item.expiryDate,
            quantity: item.quantity,
            initialQuantity: item.quantity,
            supplierId: supplierId,
            receiptDate: formData.date,
            status: 'active',
            invoiceId: invoiceId,
            invoiceRef: formData.invoiceNumber
          }
        });

        let stockOp = stockOpByProduct.get(item.productId);
        if (stockOp) {
          stockOp.data.quantity += item.quantity;
        } else {
          const existing = stockByProduct.get(item.productId);
          stockOp = existing
            ? { store: 'stock', type: 'put', data: { ...existing, quantity: (existing.quantity || 0) + item.quantity, lastUpdated: Date.now() } }
            : { store: 'stock', type: 'add', data: { productId: item.productId, quantity: item.quantity, reservedQuantity: 0, lastUpdated: Date.now() } };
          stockOpByProduct.set(item.productId, stockOp);
          txOps.push(stockOp);
        }

        txOps.push({
          store: 'movements',
          type: 'add',
          data: {
            id: await DB._generateSyncSafeId(),
            productId: item.productId,
            type: 'ENTRY',
            subType: 'PURCHASE',
            quantity: item.quantity,
            lotNumber: item.lotNumber,
            date: formData.date,
            userId: DB.AppState.currentUser?.id,
            note: `Facture N° ${formData.invoiceNumber}`,
            reference: formData.invoiceNumber,
            invoiceRef: formData.invoiceNumber
          }
        });
      }

      if (txOps.length > 0) {
        try {
          await DB.dbTransactionBulk(txOps);
        } catch (txErr) {
          console.error('[Invoice] Échec de la transaction stock:', txErr);
          UI.toast('Erreur lors de la mise à jour du stock — aucune donnée n\'a été modifiée. Réessayez.', 'error', 6000);
          return;
        }
      }

      // Cascade prix/date catalogue produits — best-effort, non bloquant
      for (const item of items) {
        try {
          const productsAll = await DB.dbGetAll('products');
          const existingProd = productsAll.find(p => Number(p.id) === Number(item.productId));
          if (existingProd) {
            let updatedProd = false;
            if (item.unitPrice && existingProd.purchasePrice !== item.unitPrice) {
              existingProd.purchasePrice = item.unitPrice;
              updatedProd = true;
            }
            if (item.salePrice && existingProd.salePrice !== item.salePrice) {
              existingProd.salePrice = item.salePrice;
              updatedProd = true;
            }
            if (item.expiryDate && existingProd.expiryDate !== item.expiryDate) {
              existingProd.expiryDate = item.expiryDate;
              updatedProd = true;
            }
            if (updatedProd) {
              existingProd.updatedAt = Date.now();
              await DB.dbPut('products', existingProd);
              window._invoicesProducts = null; // force reload next time

              // Propagation en cascade vers tous les lots actifs du produit
              try {
                const allLots = await DB.dbGetAll('lots');
                const productLots = allLots.filter(l => Number(l.productId) === Number(item.productId) && l.status === 'active');
                for (const lot of productLots) {
                  const lotUpdate = { ...lot, updatedAt: Date.now() };
                  if (item.unitPrice) lotUpdate.purchasePrice = item.unitPrice;
                  if (item.salePrice) lotUpdate.salePrice = item.salePrice;
                  if (item.expiryDate) lotUpdate.expiryDate = item.expiryDate;
                  await DB.dbPut('lots', lotUpdate);
                }
              } catch (cascadeErr) {
                console.warn('[Invoice Sync] Erreur cascade lots:', cascadeErr);
              }
            }
          }
        } catch(e) {}
      }

      await DB.writeAudit('VALIDATE_INVOICE', 'invoices', invoiceId, { invoiceNumber: formData.invoiceNumber, totalAmount });
      UI.toast(`Facture validée et stocks mis à jour`, 'success');
      
    } else {
      // Draft
      if (isEdit) {
        await DB.dbPut('invoices', { ...invoiceData, id: window._editingInvoiceId });
        await DB.writeAudit('EDIT_INVOICE_DRAFT', 'invoices', window._editingInvoiceId, { invoiceNumber: formData.invoiceNumber });
        UI.toast(`Brouillon mis à jour`, 'success');
      } else {
        const invoiceId = await DB.dbAdd('invoices', invoiceData);
        await DB.writeAudit('CREATE_INVOICE_DRAFT', 'invoices', invoiceId, { invoiceNumber: formData.invoiceNumber });
        UI.toast(`Facture enregistrée en brouillon`, 'success');
      }
    }
    
    window._editingInvoiceId = null;
    UI.closeModal();
    renderInvoices(document.getElementById('app-content'));
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function validateInvoice(invoiceId) {
  if (window.Auth && !Auth.can('invoices_create') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission de valider des factures.', 'error', 4000);
    return;
  }
  const invoice = await DB.dbGet('invoices', invoiceId);
  if (!invoice || invoice.status === 'validated') return;

  
  // Ensure all items have lot and expiry
  const missingData = invoice.items.find(i => !i.expiryDate);
  if (missingData) {
    UI.toast('Impossible de valider : certains articles n\'ont pas de date d\'expiration.', 'error');
    // TODO: Open edit form
    return;
  }
  
  const confirm = await UI.confirm(`Voulez-vous valider la facture ${invoice.invoiceNumber} ?\n\nCela mettra à jour le stock et l'action est irréversible.`);
  if (!confirm) return;
  
  try {
    invoice.status = 'validated';
    await DB.dbPut('invoices', invoice);
    
    // Process stock entry
    for (const item of invoice.items) {
      const lotData = {
        productId: item.productId,
        lotNumber: item.lotNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        initialQuantity: item.quantity,
        supplierId: invoice.supplierId,
        receiptDate: invoice.date,
        status: 'active',
        invoiceId: invoice.id,
        invoiceRef: invoice.invoiceNumber
      };
      const lotId = await DB.dbAdd('lots', lotData);
      
      let stock = null;
      try {
        const stocks = await DB.dbGetAll('stock');
        stock = stocks.find(s => s.productId === item.productId);
      } catch(e) {}
      
      if (stock) {
        stock.quantity += item.quantity;
        stock.lastUpdated = Date.now();
        await DB.dbPut('stock', stock);
      } else {
        await DB.dbAdd('stock', {
          productId: item.productId,
          quantity: item.quantity,
          reservedQuantity: 0,
          lastUpdated: Date.now()
        });
      }
      
      try {
        const productsAll = await DB.dbGetAll('products');
        const existingProd = productsAll.find(p => Number(p.id) === Number(item.productId));
        if (existingProd) {
          let updatedProd = false;
          if (item.unitPrice && existingProd.purchasePrice !== item.unitPrice) {
            existingProd.purchasePrice = item.unitPrice;
            updatedProd = true;
          }
          if (item.salePrice && existingProd.salePrice !== item.salePrice) {
            existingProd.salePrice = item.salePrice;
            updatedProd = true;
          }
          if (item.expiryDate && existingProd.expiryDate !== item.expiryDate) {
            existingProd.expiryDate = item.expiryDate;
            updatedProd = true;
          }
          if (updatedProd) {
            existingProd.updatedAt = Date.now();
            await DB.dbPut('products', existingProd);
            window._invoicesProducts = null;

            // Propagation en cascade vers tous les lots actifs du produit
            try {
              const allLots = await DB.dbGetAll('lots');
              const productLots = allLots.filter(l => Number(l.productId) === Number(item.productId) && l.status === 'active');
              for (const lot of productLots) {
                const lotUpdate = { ...lot, updatedAt: Date.now() };
                if (item.unitPrice) lotUpdate.purchasePrice = item.unitPrice;
                if (item.salePrice) lotUpdate.salePrice = item.salePrice;
                if (item.expiryDate) lotUpdate.expiryDate = item.expiryDate;
                await DB.dbPut('lots', lotUpdate);
              }
            } catch (cascadeErr) {
              console.warn('[Invoice Sync] Erreur cascade lots:', cascadeErr);
            }
          }
        }
      } catch(e) {}
      
      await DB.dbAdd('movements', {
        id: await DB._generateSyncSafeId(),
        productId: item.productId,
        type: 'ENTRY',
        subType: 'PURCHASE',
        quantity: item.quantity,
        lotNumber: item.lotNumber,
        date: invoice.date,
        userId: DB.AppState.currentUser?.id,
        note: `Facture N° ${invoice.invoiceNumber}`,
        reference: invoice.invoiceNumber,
        invoiceRef: invoice.invoiceNumber
      });
    }
    
    await DB.writeAudit('VALIDATE_INVOICE', 'invoices', invoice.id, { invoiceNumber: invoice.invoiceNumber });
    UI.toast(`Facture validée et stocks mis à jour`, 'success');
    renderInvoices(document.getElementById('app-content'));
  } catch (err) {
    UI.toast('Erreur lors de la validation : ' + err.message, 'error');
  }
}

async function viewInvoice(invoiceId) {
  const invoice = await DB.dbGet('invoices', invoiceId);
  if (!invoice) return;
  
  UI.modal(`<i data-lucide="file-text" class="modal-icon-inline"></i> Facture ${invoice.invoiceNumber}`, `
    <div class="rx-detail-grid" style="margin-bottom:16px">
      <div class="rx-detail-card">
        <h4>Informations Facture</h4>
        <div class="detail-row"><span>Numéro</span><span><code>${invoice.invoiceNumber}</code></span></div>
        <div class="detail-row"><span>Date</span><span>${UI.formatDate(invoice.date)}</span></div>
        <div class="detail-row"><span>Fournisseur</span><span><strong>${invoice.supplierName || '—'}</strong></span></div>
        <div class="detail-row"><span>Statut</span><span><span class="badge ${invoice.status === 'validated' ? 'badge-success' : 'badge-neutral'}">${invoice.status === 'validated' ? 'Validée' : 'Brouillon'}</span></span></div>
      </div>
      <div class="rx-detail-card">
        <h4>Détails Paiement</h4>
        <div class="detail-row"><span>Méthode</span><span>${invoice.paymentMethod || '—'}</span></div>
        <div class="detail-row"><span>Note</span><span>${invoice.note || '—'}</span></div>
        <div class="detail-row"><span>Montant Total</span><span><strong style="font-size:16px">${UI.formatCurrency(invoice.totalAmount || 0)}</strong></span></div>
      </div>
    </div>
    
    <h4 style="margin-bottom:8px">Lignes de la facture</h4>
    <table class="data-table">
      <thead>
        <tr>
          <th>Produit</th>
          <th>Lot</th>
          <th>Date Exp.</th>
          <th>Qté</th>
          <th>Prix Unitaire</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${(invoice.items || []).map(item => {
          const itemTotal = item.total || (item.quantity * item.unitPrice) || 0;
          return `
            <tr>
              <td><strong>${item.productName}</strong></td>
              <td><code>${item.lotNumber || '—'}</code></td>
              <td>${item.expiryDate ? UI.formatDate(item.expiryDate) : '—'}</td>
              <td>${item.quantity}</td>
              <td>${UI.formatCurrency(item.unitPrice || 0)}</td>
              <td><strong>${UI.formatCurrency(itemTotal)}</strong></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `, {
    size: 'large',
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Fermer</button>
      <button class="btn btn-secondary" onclick="exportSingleInvoiceCsv(${invoiceId})"><i data-lucide="download"></i> Exporter (CSV)</button>
      <button class="btn btn-primary" onclick="printInvoicePDF(${invoiceId})"><i data-lucide="printer"></i> Imprimer PDF</button>
      ${invoice.status === 'draft' ? `<button class="btn btn-success" onclick="UI.closeModal(); validateInvoice(${invoiceId})"><i data-lucide="check-circle"></i> Valider</button>` : ''}
    `
  });
  if (window.lucide) lucide.createIcons();
}

function exportInvoicesCsv() {
  const data = window._invoicesData || [];
  if (data.length === 0) { UI.toast('Aucune facture à exporter', 'warning'); return; }
  
  let csv = 'ID,Numero Facture,Fournisseur,Date,Statut,Methode Paiement,Montant Total,Note\n';
  data.forEach(i => {
    csv += `"${i.id}","${i.invoiceNumber}","${(i.supplierName || '').replace(/"/g, '""')}","${i.date}","${i.status}","${i.paymentMethod || ''}","${i.totalAmount || 0}","${(i.note || '').replace(/"/g, '""')}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Factures_OrdiveX_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportSingleInvoiceCsv(invoiceId) {
  const invoice = window._invoicesData?.find(i => i.id === invoiceId);
  if (!invoice) return;

  let csv = 'Produit,Lot,Peremption,Quantite,Prix Unitaire,Total\n';
  (invoice.items || []).forEach(item => {
    csv += `"${item.productName}","${item.lotNumber || ''}","${item.expiryDate || ''}","${item.quantity}","${item.unitPrice || 0}","${item.total || (item.quantity * item.unitPrice) || 0}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Facture_${invoice.invoiceNumber}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function importInvoiceCsv(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    const lines = content.split('\\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) { UI.toast('Fichier CSV invalide ou vide', 'error'); return; }

    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());

    const items = [];
    const products = window._invoicesProducts || (await DB.dbGetAll('products')).filter(p => p.status !== 'inactive');
    
    // Essayer d'identifier les colonnes
    const idxProd = headers.findIndex(h => h.includes('produit') || h.includes('nom') || h.includes('article'));
    const idxQty = headers.findIndex(h => h.includes('qte') || h.includes('quantit') || h.includes('qty'));
    const idxPrice = headers.findIndex(h => h.includes('prix') || h.includes('price') || h.includes('achat'));
    const idxLot = headers.findIndex(h => h.includes('lot'));
    const idxExp = headers.findIndex(h => h.includes('exp') || h.includes('peremption') || h.includes('date'));

    if (idxProd === -1 || idxQty === -1) {
      UI.toast('Colonnes produit et quantité introuvables dans le CSV', 'error');
      return;
    }

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;

      const pName = cols[idxProd];
      const qty = parseInt(cols[idxQty] || '0');
      const price = parseFloat(cols[idxPrice] || '0');
      const lot = idxLot !== -1 ? cols[idxLot] : '';
      let exp = idxExp !== -1 ? cols[idxExp] : '';
      
      // Auto-match product
      const match = products.find(p => p.name.toLowerCase() === pName.toLowerCase() || p.name.toLowerCase().includes(pName.toLowerCase()));
      
      items.push({
        productId: match ? match.id : null,
        productName: match ? match.name : pName,
        quantity: qty,
        unitPrice: price || (match?.purchasePrice || 0),
        lotNumber: lot,
        expiryDate: exp,
      });
    }

    showNewInvoiceForm();
    
    // Remplir dynamiquement après un court délai pour laisser le temps au DOM de se créer
    setTimeout(() => {
      const listEl = document.getElementById('invoice-items-list');
      if (listEl) {
        listEl.innerHTML = '';
        window._invoiceItemCounter = 0;
        
        items.forEach(item => {
          addInvoiceItem();
          const currentIdx = window._invoiceItemCounter - 1;
          
          if (item.productId) {
            selectInvoiceProduct(currentIdx, item.productId, item.productName, item.unitPrice);
          } else {
            document.getElementById(`inv-search-${currentIdx}`).value = item.productName;
          }
          
          document.getElementById(`inv-qty-${currentIdx}`).value = item.quantity;
          document.getElementById(`inv-price-${currentIdx}`).value = item.unitPrice;
          document.getElementById(`inv-lot-${currentIdx}`).value = item.lotNumber;
          document.getElementById(`inv-exp-${currentIdx}`).value = item.expiryDate;
        });
        updateInvoiceTotal();
        UI.toast(`Facture importée: ${items.length} lignes. Veuillez vérifier et compléter.`, 'success', 5000);
      }
    }, 500);
  };
  reader.readAsText(file);
  event.target.value = ''; // reset
}

function printInvoicePDF(invoiceId) {
  const invoice = window._invoicesData?.find(i => i.id === invoiceId);
  if (!invoice) return;
  
  const pharmacyName = (typeof gs === 'function' ? gs('pharmacy_name') : '') || 'OrdiveX Pharmacie';
  const pharmacySlogan = (typeof gs === 'function' ? gs('pharmacy_slogan') : '') || 'Votre santé, notre priorité';
  const pharmacyAddress = (typeof gs === 'function' ? gs('pharmacy_address') : '') || 'Conakry, Guinée';
  const pharmacyPhone = (typeof gs === 'function' ? gs('pharmacy_phone') : '') || '';
  
  // Utiliser DB.AppState pour récupérer l'utilisateur si disponible
  let createdBy = 'Administrateur';
  if (window.DB && DB.AppState && DB.AppState.currentUser) {
    createdBy = DB.AppState.currentUser.name || DB.AppState.currentUser.username || createdBy;
  }

  const subtotal = (invoice.items || []).reduce((sum, item) => sum + (item.total || (item.quantity * item.unitPrice) || 0), 0);
  const tva = invoice.tvaAmount || 0;
  const finalTotal = subtotal + tva;

  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <html>
      <head>
        <title>Facture ${invoice.invoiceNumber}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 0; }
          body { 
            font-family: 'Inter', sans-serif; 
            margin: 0; 
            padding: 40px; 
            color: #1e293b; 
            background: #fff;
            font-size: 13px;
            line-height: 1.5;
          }
          .invoice-box {
            max-width: 800px;
            margin: auto;
            padding: 30px;
            box-sizing: border-box;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #f1f5f9;
          }
          .pharma-info h1 {
            margin: 0 0 5px 0;
            color: #0f172a;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .pharma-info p {
            margin: 0;
            color: #64748b;
            font-size: 13px;
          }
          .invoice-title {
            text-align: right;
          }
          .invoice-title h2 {
            margin: 0 0 8px 0;
            color: #3b82f6;
            font-size: 32px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .badge-success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
          .badge-draft { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
          
          .info-blocks {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            gap: 20px;
          }
          .info-card {
            flex: 1;
            background: #f8fafc;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
          }
          .info-card h3 {
            margin: 0 0 15px 0;
            font-size: 12px;
            text-transform: uppercase;
            color: #94a3b8;
            letter-spacing: 1px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }
          .info-label { color: #64748b; }
          .info-val { font-weight: 600; color: #0f172a; text-align: right; }
          
          table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-bottom: 30px;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #e2e8f0;
          }
          th {
            background: #f8fafc;
            color: #475569;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
            padding: 14px 16px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
          }
          td {
            padding: 14px 16px;
            border-bottom: 1px solid #f1f5f9;
            color: #334155;
          }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) { background: #fafafa; }
          
          .product-name { font-weight: 600; color: #0f172a; }
          .money { font-family: 'Courier New', Courier, monospace; font-weight: 600; }
          
          .totals-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .notes {
            flex: 1;
            padding-right: 40px;
            color: #64748b;
          }
          .notes h4 { margin: 0 0 10px 0; color: #0f172a; }
          
          .totals-box {
            width: 300px;
            background: #f8fafc;
            padding: 20px;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
            color: #475569;
          }
          .total-row.grand-total {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px dashed #cbd5e1;
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            color: #94a3b8;
            font-size: 11px;
            border-top: 1px solid #f1f5f9;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header">
            <div class="pharma-info">
              <h1>${pharmacyName}</h1>
              <p style="font-weight: 500; color: #3b82f6; margin-bottom: 5px;">${pharmacySlogan}</p>
              <p>${pharmacyAddress}</p>
              ${pharmacyPhone ? `<p>Tel: ${pharmacyPhone}</p>` : ''}
            </div>
            <div class="invoice-title">
              <h2>FACTURE ENTREE</h2>
              <p style="font-size: 16px; color: #64748b; margin: 0 0 10px 0;">N° <strong>${invoice.invoiceNumber}</strong></p>
              <span class="badge ${invoice.status === 'validated' ? 'badge-success' : 'badge-draft'}">
                ${invoice.status === 'validated' ? 'VALIDÉE / STOCK AJOUTÉ' : 'BROUILLON'}
              </span>
            </div>
          </div>
          
          <div class="info-blocks">
            <div class="info-card">
              <h3>Informations Fournisseur</h3>
              <div class="info-row">
                <span class="info-label">Nom</span>
                <span class="info-val">${invoice.supplierName || '—'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Méthode de paiement</span>
                <span class="info-val" style="text-transform: capitalize;">${invoice.paymentMethod || 'Non spécifié'}</span>
              </div>
            </div>
            
            <div class="info-card">
              <h3>Détails d'Enregistrement</h3>
              <div class="info-row">
                <span class="info-label">Date de facture</span>
                <span class="info-val">${new Date(invoice.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Enregistré par</span>
                <span class="info-val">${createdBy}</span>
              </div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 28px;">#</th>
                <th>Produit</th>
                <th>N° Lot</th>
                <th>Péremption</th>
                <th style="text-align: right;">Qté</th>
                <th style="text-align: right;">P. Achat</th>
                <th style="text-align: right;">P. Vente</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map((item, idx) => {
                const itemTotal = item.total || (item.quantity * item.unitPrice) || 0;
                const hasSalePrice = item.salePrice && item.salePrice > 0;
                const expDate = item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                return `
                  <tr>
                    <td style="color: #94a3b8; font-weight: 600;">${idx + 1}</td>
                    <td class="product-name">${item.productName}</td>
                    <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${item.lotNumber || '—'}</code></td>
                    <td>${expDate}</td>
                    <td style="text-align: right; font-weight: 600;">${item.quantity}</td>
                    <td style="text-align: right;" class="money">${item.unitPrice ? item.unitPrice.toLocaleString('fr-FR') : '0'}</td>
                    <td style="text-align: right;" class="money">${hasSalePrice ? item.salePrice.toLocaleString('fr-FR') : '—'}</td>
                    <td style="text-align: right; font-weight: 700;" class="money">${itemTotal.toLocaleString('fr-FR')} GNF</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="totals-section">
            <div class="notes">
              <h4>Notes / Observations</h4>
              <p style="font-size: 12px; font-style: italic; background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 3px solid #3b82f6;">
                ${invoice.note || 'Aucune note particulière pour cette facture d\'entrée de stock.'}
              </p>
            </div>
            
            <div class="totals-box">
              <div class="total-row">
                <span>Nombre d'articles</span>
                <span>${invoice.items?.length || 0}</span>
              </div>
              <div class="total-row">
                <span>Quantité totale</span>
                <span>${(invoice.items || []).reduce((s, i) => s + (i.quantity || 0), 0)}</span>
              </div>
              <div class="total-row grand-total">
                <span>Total Facture</span>
                <span style="color: #3b82f6;">${subtotal.toLocaleString('fr-FR')} GNF</span>
              </div>
            </div>
          </div>
          
          <div class="footer">
            Document généré électroniquement par <strong>OrdiveX ERP</strong> le ${new Date().toLocaleString('fr-FR')}
          </div>
        </div>
        <script>
          setTimeout(() => { window.print(); }, 800);
        </script>
      </body>
    </html>
  `);
  printWin.document.close();
}

window.exportInvoicesPDF = function() {
  if (!window.PDFExport) return UI.toast("Module PDF non chargé", "error");
  const data = (window._invoicesData || []).map(inv => [
    inv.invoiceNumber || '',
    new Date(inv.date).toLocaleDateString('fr-FR'),
    (window._invoicesSupplierMap[inv.supplierId] ? window._invoicesSupplierMap[inv.supplierId].name : inv.supplierName) || 'Inconnu',
    UI.formatCurrency(inv.totalAmount || 0),
    inv.status === 'draft' ? 'Brouillon' : inv.status === 'validated' ? 'Validé' : inv.status
  ]);
  const headers = ["N° Facture", "Date", "Fournisseur", "Montant Total", "Statut"];
  window.PDFExport.generate("Liste des Factures Fournisseurs", headers, data);
};

async function unvalidateInvoice(invoiceId, btn) {
  const gs = (key) => (window._appSettings || {})[key];
  if (gs('purchase_allow_edit_after') !== 'true' && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Action non autorisée par les paramètres d\'achat.', 'error');
    return;
  }

  const confirm = await UI.confirm("Voulez-vous annuler la validation de cette facture ?\n\nCela déduira les articles du stock et remettra la facture en statut Brouillon pour modification.");
  if (!confirm) return;

  return ActionGuard.run('unvalidate-invoice-' + invoiceId, () => _unvalidateInvoiceImpl(invoiceId), btn, 'Traitement...');
}

async function _unvalidateInvoiceImpl(invoiceId) {
  try {
    // Revérifier l'état actuel — empêche un double-clic (ou une réexécution
    // après re-rendu) de déduire deux fois le stock de la même facture.
    const invoice = await DB.dbGet('invoices', invoiceId);
    if (!invoice || invoice.status !== 'validated') {
      UI.toast('Cette facture a déjà été traitée.', 'warning');
      return;
    }

    // Déduire les articles du stock et désactiver les lots — regroupé dans
    // UNE SEULE transaction IndexedDB (tout s'applique ou rien), pour éviter
    // un stock partiellement corrigé en cas de plantage en cours de traitement.
    const stockAll = await DB.dbGetAll('stock');
    const stockMap = new Map();
    stockAll.forEach(s => stockMap.set(s.productId, s));

    const lotsAll = await DB.dbGetAll('lots');
    const txOps = [];

    for (const item of invoice.items) {
      // 1. Déduire du stock
      const se = stockMap.get(item.productId);
      if (se) {
        const nq = Math.max(0, se.quantity - item.quantity);
        txOps.push({ store: 'stock', type: 'put', data: { ...se, quantity: nq } });
        stockMap.set(item.productId, { ...se, quantity: nq }); // pour cumuler si le même produit apparaît sur 2 lignes
      }

      // 2. Déduire ou désactiver les lots correspondants
      const lot = lotsAll.find(l => l.productId === item.productId && l.lotNumber === item.lotNumber);
      if (lot) {
        const nq = Math.max(0, lot.quantity - item.quantity);
        lot.quantity = nq;
        if (nq === 0) lot.status = 'inactive';
        txOps.push({ store: 'lots', type: 'put', data: lot });
      }

      // 3. Enregistrer un mouvement EXIT de correction
      txOps.push({
        store: 'movements',
        type: 'add',
        data: {
          id: await DB._generateSyncSafeId(),
          productId: item.productId,
          type: 'EXIT',
          subType: 'PURCHASE_CANCEL',
          quantity: -item.quantity,
          date: new Date().toISOString(),
          userId: DB.AppState.currentUser?.id,
          reference: `CANCEL-${invoice.invoiceNumber}`,
          lotNumber: item.lotNumber
        }
      });
    }

    if (txOps.length > 0) {
      try {
        await DB.dbTransactionBulk(txOps);
      } catch (txErr) {
        console.error('[Invoice] Échec de la transaction stock:', txErr);
        UI.toast('Erreur lors de la mise à jour du stock — aucune donnée n\'a été modifiée. Réessayez.', 'error', 6000);
        return;
      }
    }

    invoice.status = 'draft';
    await DB.dbPut('invoices', invoice);
    await DB.writeAudit('UNVALIDATE_INVOICE', 'invoices', invoiceId, { invoiceNumber: invoice.invoiceNumber });

    UI.toast('Facture repassée en brouillon et stock mis à jour', 'success');
    renderInvoices(document.getElementById('app-content'));
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

async function deleteInvoice(invoiceId) {
  if (window.Auth && !Auth.can('invoices_delete') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission de supprimer des factures.', 'error', 5000);
    return;
  }
  const confirm = await UI.confirm('Voulez-vous supprimer définitivement ce brouillon de facture ?');
  if (!confirm) return;
  try {
    await DB.dbDelete('invoices', invoiceId);
    UI.toast('Facture supprimée', 'success');
    renderInvoices(document.getElementById('app-content'));
  } catch (err) {
    UI.toast('Erreur : ' + err.message, 'error');
  }
}

window.renderInvoices = renderInvoices;
window.filterInvoices = filterInvoices;
window.showNewInvoiceForm = showNewInvoiceForm;
window.addInvoiceItem = addInvoiceItem;
window.invoiceProductSearch = invoiceProductSearch;
window.selectInvoiceProduct = selectInvoiceProduct;
window.removeInvoiceItem = removeInvoiceItem;
window.updateInvoiceTotal = updateInvoiceTotal;
window.submitInvoice = submitInvoice;
window.validateInvoice = validateInvoice;
window.viewInvoice = viewInvoice;
window.exportInvoicesCsv = exportInvoicesCsv;
window.exportSingleInvoiceCsv = exportSingleInvoiceCsv;
window.importInvoiceCsv = importInvoiceCsv;
window.printInvoicePDF = printInvoicePDF;
window.unvalidateInvoice = unvalidateInvoice;
window.deleteInvoice = deleteInvoice;

Router.register('invoices', renderInvoices);
