/**
 * OrdiveX v3 — Gestion des Retours de Médicaments
 * Permet le retour partiel ou total dans un délai configurable (défaut : 72h)
 * Remet le stock, enregistre le mouvement, génère un reçu.
 */

const RETURN_DELAY_HOURS = 72; // Délai max de retour en heures (3 jours)

// ═══════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════
async function renderReturns(container) {
    UI.loading(container, 'Chargement des retours...');

    const [allReturns, sales] = await Promise.all([
        DB.dbGetAll('returns'),
        DB.dbGetAll('sales'),
    ]);

    const sorted = allReturns.sort((a, b) => new Date(b.date) - new Date(a.date));
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthReturns = allReturns.filter(r => new Date(r.date) >= startOfMonth);
    const totalMonthRefund = monthReturns.reduce((a, r) => a + (r.refundAmount || 0), 0);
    const totalMonthCount = monthReturns.length;

    // Retours en attente
    const pendingReturns = allReturns.filter(r => r.status === 'pending');

    const showRefundKpi = Auth.can('dash_view_margin') || DB.AppState.currentUser?.role === 'admin';
    const canInitiateReturn = Auth.can('sales_cancel') || DB.AppState.currentUser?.role === 'admin';

    container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i data-lucide="undo-2" class="page-title-icon"></i> Retours de Médicaments</h1>
        <p class="page-subtitle">Gestion des retours — délai max ${RETURN_DELAY_HOURS}h après la vente</p>
      </div>
      <div class="header-actions">
        ${Auth.can('caisse_export_csv') || DB.AppState.currentUser?.role === 'admin' ? `
        <button class="btn btn-secondary" onclick="exportReturnsPDF()"><i data-lucide="printer"></i> PDF</button>
        ` : ''}
        ${canInitiateReturn ? `
        <button class="btn btn-primary" onclick="openNewReturn()">
          <i data-lucide="plus-circle"></i> Initier un Retour
        </button>
        ` : ''}
      </div>
    </div>

    <div class="kpi-grid kpi-grid-3">
      <div class="kpi-card kpi-orange">
        <div class="kpi-icon"><i data-lucide="undo-2"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${totalMonthCount}</div>
          <div class="kpi-label">Retours ce mois</div>
          <div class="kpi-sub">${pendingReturns.length} en attente</div>
        </div>
      </div>
      ${showRefundKpi ? `
      <div class="kpi-card kpi-red">
        <div class="kpi-icon"><i data-lucide="banknote"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${UI.formatCurrency(totalMonthRefund)}</div>
          <div class="kpi-label">Remboursements mois</div>
          <div class="kpi-sub">Valeur retournée</div>
        </div>
      </div>` : ''}
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i data-lucide="package-open"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${allReturns.length}</div>
          <div class="kpi-label">Total retours</div>
          <div class="kpi-sub">Depuis l'ouverture</div>
        </div>
      </div>
    </div>

    <div class="filter-bar" style="margin-bottom:16px">
      <input type="date" id="ret-from" class="filter-input" style="max-width:180px" onchange="filterReturns()">
      <span class="filter-sep"><i data-lucide="arrow-right"></i></span>
      <input type="date" id="ret-to" class="filter-input" style="max-width:180px" onchange="filterReturns()">
      <select id="ret-status" class="filter-select" onchange="filterReturns()">
        <option value="">Tous les statuts</option>
        <option value="approved">Approuvé</option>
        <option value="pending">En attente</option>
        <option value="rejected">Refusé</option>
      </select>
      <button class="btn btn-ghost" onclick="exportReturns()"><i data-lucide="download"></i> CSV</button>
    </div>

    <div id="returns-table-container"></div>
  `;

    // Date par défaut
    document.getElementById('ret-from').value = startOfMonth.toISOString().split('T')[0];
    document.getElementById('ret-to').value = today.toISOString().split('T')[0];

    window._returnsData = sorted;
    filterReturns();
    if (window.lucide) lucide.createIcons();
}

function filterReturns() {
    const from = document.getElementById('ret-from')?.value;
    const to = document.getElementById('ret-to')?.value;
    const status = document.getElementById('ret-status')?.value;

    let data = window._returnsData || [];
    if (from) data = data.filter(r => new Date(r.date) >= new Date(from));
    if (to) data = data.filter(r => new Date(r.date) <= new Date(to + 'T23:59:59'));
    if (status) data = data.filter(r => r.status === status);

    renderReturnsTable(data);
}

function renderReturnsTable(data) {
    const container = document.getElementById('returns-table-container');
    if (!container) return;

    // ── PAGINATION ──
    const PAGE_SIZE = 30;
    window._filteredReturns = data;
    window._returnsPage = window._returnsPage || 1;
    if (data !== window._lastFilteredReturns) {
      window._returnsPage = 1;
      window._lastFilteredReturns = data;
    }
    const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
    if (window._returnsPage > totalPages) window._returnsPage = totalPages;
    const start = (window._returnsPage - 1) * PAGE_SIZE;
    const pageData = data.slice(start, start + PAGE_SIZE);

    const statusBadge = (s) => {
        const map = {
            approved: ['badge-success', 'check-circle', 'Approuvé'],
            pending: ['badge-warning', 'clock', 'En attente'],
            rejected: ['badge-danger', 'x-circle', 'Refusé'],
        };
        const [cls, icon, label] = map[s] || ['badge-neutral', 'circle', s];
        return `<span class="badge ${cls}"><i data-lucide="${icon}"></i> ${label}</span>`;
    };

    const isAdmin = DB.AppState.currentUser?.role !== 'caissier';
    const columns = [
        { label: 'N° Retour', render: r => `<code class="code-tag">RET-${String(r.id).padStart(5, '0')}</code>` },
        { label: 'Date', render: r => UI.formatDateTime(new Date(r.date).getTime()) },
        { label: 'Vente liée', render: r => `<code class="code-tag">#${String(r.saleId).padStart(6, '0')}</code>` },
        { label: 'Patient', render: r => r.patientName || '<span class="text-muted">Comptant</span>' },
        { label: 'Articles', render: r => `<span class="badge badge-neutral">${(r.items || []).length} art.</span>` },
        ...(isAdmin ? [{ label: 'Remboursement', render: r => `<strong class="text-warning">${UI.formatCurrency(r.refundAmount || 0)}</strong>` }] : []),
        { label: 'Motif', render: r => `<span class="text-muted" style="font-size:0.85em;max-width:200px;display:inline-block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.reason || '—'}</span>` },
        { label: 'Statut', render: r => statusBadge(r.status) },
        {
            label: 'Actions', render: r => `
        <div style="display:flex;gap:6px">
          <button class="btn btn-xs btn-primary" onclick="viewReturnDetail(${r.id})"><i data-lucide="eye"></i> Détail</button>
          <button class="btn btn-xs btn-ghost" onclick="printReturnReceipt(${r.id})" title="Imprimer reçu"><i data-lucide="printer"></i></button>
        </div>`
        },
    ];

    UI.table(container, columns, pageData, { emptyMessage: 'Aucun retour enregistré', emptyIcon: 'undo-2', pageSize: PAGE_SIZE, paginate: false });

    // ── Contrôles de pagination ──
    if (data.length > PAGE_SIZE) {
      const pagDiv = document.createElement('div');
      pagDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:16px 0;gap:12px;flex-wrap:wrap;';
      pagDiv.innerHTML = `
        <span style="font-size:13px;color:var(--text-muted)">${data.length.toLocaleString()} retours — Page ${window._returnsPage}/${totalPages}</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary btn-sm" ${window._returnsPage <= 1 ? 'disabled' : ''} onclick="window._returnsPage--;renderReturnsTable(window._filteredReturns)">◀ Précédent</button>
          <button class="btn btn-secondary btn-sm" ${window._returnsPage >= totalPages ? 'disabled' : ''} onclick="window._returnsPage++;renderReturnsTable(window._filteredReturns)">Suivant ▶</button>
        </div>
      `;
      container.appendChild(pagDiv);
    }
    if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════
// INITIER UN NOUVEAU RETOUR
// ═══════════════════════════════════════════════════════════════════
async function openNewReturn(prefillSaleId = null) {
    if (window.Auth && !Auth.can('sales_cancel') && DB.AppState.currentUser?.role !== 'admin') {
        UI.toast('⛔ Vous n\'avez pas la permission d\'initier un retour.', 'error', 4000);
        return;
    }
    const cutoff = Date.now() - RETURN_DELAY_HOURS * 60 * 60 * 1000;
    const allSales = await DB.dbGetAll('sales');

    // Seules les ventes dans le délai et status completed/paid
    const eligible = allSales.filter(s =>
        new Date(s.date).getTime() >= cutoff &&
        ['completed', 'paid'].includes(s.status)
    ).sort((a, b) => new Date(b.date) - new Date(a.date));

    // Vérifier s'il y a déjà un retour sur ces ventes
    const existingReturns = await DB.dbGetAll('returns');
    const fullyReturnedSaleIds = new Set(
        existingReturns
            .filter(r => r.status === 'approved' && r.isFullReturn)
            .map(r => r.saleId)
    );

    const eligibleFiltered = eligible.filter(s => !fullyReturnedSaleIds.has(s.id));

    if (!eligibleFiltered.length) {
        UI.toast(`Aucune vente éligible au retour (délai max : ${RETURN_DELAY_HOURS}h)`, 'warning', 5000);
        return;
    }

    const content = `
    <div style="margin-bottom:16px">
      <div class="return-info-banner">
        <i data-lucide="info"></i>
        <span>Seules les ventes des dernières <strong>${RETURN_DELAY_HOURS}h</strong> (${Math.floor(RETURN_DELAY_HOURS / 24)} jours) sont éligibles au retour.</span>
      </div>
    </div>
    <div id="return-step1">
      <label class="form-label" style="font-weight:600;margin-bottom:8px;display:block">Sélectionner la vente à retourner :</label>
      <div class="return-sale-list">
        ${eligibleFiltered.map(s => {
        const hoursAgo = Math.round((Date.now() - new Date(s.date).getTime()) / 3600000);
        const remaining = RETURN_DELAY_HOURS - hoursAgo;
        const hasReturn = existingReturns.some(r => r.saleId === s.id && r.status === 'approved');
        return `
            <div class="return-sale-card ${prefillSaleId === s.id ? 'selected' : ''}" onclick="selectSaleForReturn(${s.id}, this)">
              <div class="return-sale-ref">
                <code class="code-tag">#${String(s.id).padStart(6, '0')}</code>
                ${hasReturn ? '<span class="badge badge-warning badge-sm"><i data-lucide="alert-triangle"></i> Retour partiel existant</span>' : ''}
              </div>
              <div class="return-sale-meta">
                <span><i data-lucide="calendar"></i> ${UI.formatDateTime(new Date(s.date).getTime())}</span>
                <span><i data-lucide="user"></i> ${s.patientName || 'Patient Comptant'}</span>
                <strong>${UI.formatCurrency(s.total)}</strong>
              </div>
              <div class="return-deadline ${remaining <= 6 ? 'deadline-urgent' : ''}">
                <i data-lucide="clock"></i> Délai restant : <strong>${remaining}h${remaining <= 6 ? ' — URGENT' : ''}</strong>
              </div>
            </div>`;
    }).join('')}
      </div>
    </div>
    <div id="return-step2" style="display:none"></div>
  `;

    UI.modal('<i data-lucide="undo-2" class="modal-icon-inline"></i> Initier un Retour', content, {
        size: 'large',
        footer: `<button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>`
    });

    if (window.lucide) lucide.createIcons();
    if (prefillSaleId) {
        const card = document.querySelector(`.return-sale-card`);
        if (card) selectSaleForReturn(prefillSaleId, card);
    }
}

window.selectSaleForReturn = async function (saleId, cardEl) {
    // Highlight selection
    document.querySelectorAll('.return-sale-card').forEach(c => c.classList.remove('selected'));
    if (cardEl) cardEl.classList.add('selected');

    const [sale, items] = await Promise.all([
        DB.dbGet('sales', saleId),
        DB.dbGetAll('saleItems', 'saleId', saleId),
    ]);
    if (!sale || !items.length) { UI.toast('Vente introuvable', 'error'); return; }

    // Vérifier les articles déjà retournés
    const existingReturns = await DB.dbGetAll('returns', 'saleId', saleId);
    const returnedQties = {};
    existingReturns.filter(r => r.status === 'approved').forEach(r => {
        (r.items || []).forEach(ri => {
            returnedQties[ri.saleItemId] = (returnedQties[ri.saleItemId] || 0) + ri.quantity;
        });
    });

    const step2 = document.getElementById('return-step2');
    if (!step2) return;

    step2.style.display = 'block';
    step2.innerHTML = `
    <hr style="margin:16px 0;border:none;border-top:1px solid var(--border)">
    <div style="font-weight:600;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <i data-lucide="package-open"></i>
      Articles à retourner
      <span class="badge badge-neutral" style="font-weight:400;font-size:0.78em">Vente #${String(saleId).padStart(6, '0')}</span>
    </div>
    <div class="return-items-list">
      ${items.map(item => {
        const alreadyReturned = returnedQties[item.id] || 0;
        const maxQty = item.quantity - alreadyReturned;
        if (maxQty <= 0) return `
          <div class="return-item-row return-item-exhausted">
            <div class="return-item-name">${item.productName} <span class="badge badge-neutral badge-sm">Déjà retourné</span></div>
          </div>`;
        return `
          <div class="return-item-row" data-item-id="${item.id}" data-product-id="${item.productId}" data-unit-price="${item.unitPrice}" data-max="${maxQty}">
            <label class="return-item-check">
              <input type="checkbox" class="return-item-cb" data-item-id="${item.id}"
                onchange="toggleReturnItem(${item.id}, ${maxQty})" checked>
            </label>
            <div class="return-item-info">
              <div class="return-item-name">${item.productName}</div>
              <div class="return-item-meta">${UI.formatCurrency(item.unitPrice)} / unité · Commandé: ${item.quantity}${alreadyReturned > 0 ? ` · Déjà retourné: ${alreadyReturned}` : ''}</div>
            </div>
            <div class="return-item-qty-wrap">
              <label style="font-size:0.78em;color:var(--text-muted)">Qté à retourner</label>
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
                <button class="qty-ctrl" onclick="changeReturnQty(${item.id}, -1)">−</button>
                <input type="number" id="return-qty-${item.id}" class="qty-direct" value="${maxQty}" min="1" max="${maxQty}"
                  onchange="updateReturnTotal()">
                <button class="qty-ctrl" onclick="changeReturnQty(${item.id}, 1)">+</button>
              </div>
              <div style="font-size:0.75em;color:var(--text-muted);margin-top:3px">Max: ${maxQty}</div>
            </div>
            <div class="return-item-subtotal" id="return-sub-${item.id}">
              ${UI.formatCurrency(maxQty * item.unitPrice)}
            </div>
          </div>`;
    }).join('')}
    </div>

    <div class="return-reason-block">
      <label class="form-label">Motif du retour <span style="color:var(--danger)">*</span></label>
      <select id="return-reason-select" class="form-control" onchange="handleReasonSelect(this.value)" required>
        <option value="">— Sélectionner un motif —</option>
        <option value="Médecin n'a pas validé l'ordonnance">Médecin n'a pas validé l'ordonnance</option>
        <option value="Erreur de délivrance">Erreur de délivrance</option>
        <option value="Médicament non toléré (effets secondaires)">Médicament non toléré (effets secondaires)</option>
        <option value="Doublon avec traitement existant">Doublon avec traitement existant</option>
        <option value="Changement de traitement par le médecin">Changement de traitement par le médecin</option>
        <option value="Autre">Autre (préciser ci-dessous)</option>
      </select>
      <textarea id="return-reason-detail" class="form-control" style="margin-top:8px;display:none"
        placeholder="Précisez le motif du retour..." rows="2"></textarea>
    </div>

    <div class="return-total-block">
      <div class="return-total-row">
        <span>Total remboursement estimé</span>
        <strong id="return-total-amount" class="text-warning" style="font-size:1.2em">—</strong>
      </div>
    </div>
  `;

    // Mettre à jour le footer du modal
    const modalFooter = document.querySelector('.modal-footer');
    if (modalFooter) {
        modalFooter.innerHTML = `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-warning" onclick="validateReturn(${saleId})">
        <i data-lucide="undo-2"></i> Confirmer le Retour
      </button>`;
    }

    if (window.lucide) lucide.createIcons();
    updateReturnTotal();
};

window.toggleReturnItem = function (itemId, maxQty) {
    const cb = document.querySelector(`.return-item-cb[data-item-id="${itemId}"]`);
    const row = document.querySelector(`.return-item-row[data-item-id="${itemId}"]`);
    const qtyInput = document.getElementById(`return-qty-${itemId}`);
    if (!cb || !row || !qtyInput) return;
    const checked = cb.checked;
    row.style.opacity = checked ? '1' : '0.45';
    qtyInput.disabled = !checked;
    updateReturnTotal();
};

window.changeReturnQty = function (itemId, delta) {
    const input = document.getElementById(`return-qty-${itemId}`);
    if (!input) return;
    const max = parseInt(input.max);
    const nv = Math.min(max, Math.max(1, parseInt(input.value || 1) + delta));
    input.value = nv;
    updateReturnTotal();
};

window.updateReturnTotal = function () {
    let total = 0;
    document.querySelectorAll('.return-item-row[data-item-id]').forEach(row => {
        const id = row.dataset.itemId;
        const unitPrice = parseFloat(row.dataset.unitPrice || 0);
        const cb = row.querySelector('.return-item-cb');
        const qtyInput = document.getElementById(`return-qty-${id}`);
        const subEl = document.getElementById(`return-sub-${id}`);
        if (cb && !cb.checked) {
            if (subEl) subEl.textContent = '—';
            return;
        }
        const qty = parseInt(qtyInput?.value || 0);
        const sub = qty * unitPrice;
        total += sub;
        if (subEl) subEl.textContent = UI.formatCurrency(sub);
    });
    const el = document.getElementById('return-total-amount');
    if (el) el.textContent = UI.formatCurrency(total);
};

window.handleReasonSelect = function (val) {
    const detail = document.getElementById('return-reason-detail');
    if (detail) detail.style.display = val === 'Autre' ? 'block' : 'none';
};

// ═══════════════════════════════════════════════════════════════════
// TRAITEMENT DU RETOUR
// ═══════════════════════════════════════════════════════════════════
window.validateReturn = async function (saleId) {
    if (window.Auth && !Auth.can('sales_cancel') && DB.AppState.currentUser?.role !== 'admin') {
        UI.toast('⛔ Action non autorisée.', 'error', 4000);
        return;
    }
    const reasonSelect = document.getElementById('return-reason-select')?.value;
    const reasonDetail = document.getElementById('return-reason-detail')?.value?.trim();
    const reason = reasonSelect === 'Autre' ? (reasonDetail || 'Autre') : reasonSelect;

    if (!reason) {
        UI.toast('Veuillez sélectionner un motif de retour', 'warning');
        return;
    }

    // Collecter les articles sélectionnés
    const selectedItems = [];
    document.querySelectorAll('.return-item-row[data-item-id]').forEach(row => {
        const cb = row.querySelector('.return-item-cb');
        if (!cb || !cb.checked) return;
        const itemId = parseInt(row.dataset.itemId);
        const productId = parseInt(row.dataset.productId);
        const unitPrice = parseFloat(row.dataset.unitPrice);
        const qty = parseInt(document.getElementById(`return-qty-${itemId}`)?.value || 0);
        if (qty > 0) selectedItems.push({ saleItemId: itemId, productId, quantity: qty, unitPrice });
    });

    if (!selectedItems.length) {
        UI.toast('Sélectionnez au moins un article à retourner', 'warning');
        return;
    }

    const ok = await UI.confirm(
        `Confirmer le retour de ${selectedItems.length} article(s) ?\n\nLe stock sera remis à jour immédiatement.`
    );
    if (!ok) return;

    try {
        await processReturn(saleId, selectedItems, reason);
        UI.closeModal();
    } catch (err) {
        console.error('[Return]', err);
        UI.toast('Erreur lors du traitement du retour : ' + err.message, 'error', 6000);
    }
};

async function processReturn(saleId, selectedItems, reason) {
    if (window.Auth && !Auth.can('sales_cancel') && DB.AppState.currentUser?.role !== 'admin') {
        throw new Error('Vous n\'avez pas la permission de traiter un retour.');
    }
    const sale = await DB.dbGet('sales', saleId);
    if (!sale) throw new Error('Vente introuvable');

    // Vérification du délai
    const saleAge = Date.now() - new Date(sale.date).getTime();
    if (saleAge > RETURN_DELAY_HOURS * 3600000) {
        throw new Error(`Délai de retour dépassé (max ${RETURN_DELAY_HOURS}h)`);
    }

    const refundAmount = selectedItems.reduce((a, i) => a + i.quantity * i.unitPrice, 0);
    const allSaleItems = await DB.dbGetAll('saleItems', 'saleId', saleId);
    const totalSaleQty = allSaleItems.reduce((a, i) => a + i.quantity, 0);
    const returnedQty = selectedItems.reduce((a, i) => a + i.quantity, 0);
    const isFullReturn = (returnedQty >= totalSaleQty);

    // 1. Créer l'enregistrement de retour
    const returnId = await DB.dbAdd('returns', {
        saleId,
        saleRef: String(saleId).padStart(6, '0'),
        patientId: sale.patientId || null,
        patientName: sale.patientName || null,
        date: new Date().toISOString(),
        reason,
        items: selectedItems,
        refundAmount,
        isFullReturn,
        status: 'approved',
        paymentMethod: sale.paymentMethod,
        processedBy: DB.AppState.currentUser?.username || 'Système',
    });

    // 2. Remettre le stock pour chaque article retourné
    for (const ri of selectedItems) {
        const stockArr = await DB.dbGetAll('stock', 'productId', ri.productId);
        const stockEntry = stockArr[0];
        if (stockEntry) {
            await DB.dbPut('stock', {
                ...stockEntry,
                quantity: (stockEntry.quantity || 0) + ri.quantity,
                lastUpdated: Date.now(),
            });
        }

        // 3. Enregistrer le mouvement de stock
        await DB.dbAdd('movements', {
            productId: ri.productId,
            type: 'RETURN',
            subType: 'CUSTOMER_RETURN',
            quantity: ri.quantity,
            date: new Date().toISOString(),
            userId: DB.AppState.currentUser?.id,
            note: `Retour client — Vente #${String(saleId).padStart(6, '0')} — ${reason}`,
            reference: `RET-${String(returnId).padStart(5, '0')}`,
        });
    }

    // 4. Marquer la vente comme partiellement/totalement retournée
    await DB.dbPut('sales', {
        ...sale,
        returnStatus: isFullReturn ? 'fully_returned' : 'partially_returned',
        lastReturnId: returnId,
        lastReturnDate: new Date().toISOString(),
    });

    // 5. Audit
    await DB.writeAudit('RETURN_PROCESSED', 'returns', returnId, {
        saleId,
        refundAmount,
        itemCount: selectedItems.length,
        reason,
        isFullReturn,
        processedBy: DB.AppState.currentUser?.username,
    });

    // 6. Enregistrer le mouvement de caisse (sortie remboursement)
    await DB.dbAdd('cashRegister', {
        type: 'return_out',
        amount: refundAmount,
        paymentMethod: sale.paymentMethod,
        reason: `Remboursement retour — Vente #${String(saleId).padStart(6, '0')}`,
        date: new Date().toISOString().split('T')[0],
        timestamp: Date.now(),
        userId: DB.AppState.currentUser?.id,
        returnId,
    });

    UI.toast(`✅ Retour traité — ${UI.formatCurrency(refundAmount)} remboursé`, 'success', 5000);

    // Rafraîchir si on est sur la page retours
    if (Router.currentPage === 'returns') {
        const c = document.getElementById('app-content');
        await renderReturns(c);
    }

    // Sync cloud
    if (typeof DB.syncToSupabase === 'function') {
        DB.syncToSupabase().catch(console.error);
    }

    return returnId;
}

// ═══════════════════════════════════════════════════════════════════
// DÉTAIL D'UN RETOUR
// ═══════════════════════════════════════════════════════════════════
window.viewReturnDetail = async function (returnId) {
    const ret = await DB.dbGet('returns', returnId);
    if (!ret) { UI.toast('Retour introuvable', 'error'); return; }

    const statusBadge = (s) => {
        const map = {
            approved: ['badge-success', 'check-circle', 'Approuvé'],
            pending: ['badge-warning', 'clock', 'En attente'],
            rejected: ['badge-danger', 'x-circle', 'Refusé'],
        };
        const [cls, icon, label] = map[s] || ['badge-neutral', 'circle', s];
        return `<span class="badge ${cls}"><i data-lucide="${icon}"></i> ${label}</span>`;
    };

    UI.modal(`<i data-lucide="undo-2" class="modal-icon-inline"></i> Retour RET-${String(returnId).padStart(5, '0')}`, `
    <div class="sale-detail">
      <div class="detail-meta">
        <span><i data-lucide="calendar"></i> ${UI.formatDateTime(new Date(ret.date).getTime())}</span>
        <span><i data-lucide="link"></i> Vente liée : <code class="code-tag">#${String(ret.saleId).padStart(6, '0')}</code></span>
        <span><i data-lucide="user"></i> Patient : <strong>${ret.patientName || 'Comptant'}</strong></span>
        <span><i data-lucide="user-check"></i> Traité par : <strong>${ret.processedBy || '—'}</strong></span>
        <span>${statusBadge(ret.status)}</span>
      </div>

      <div class="return-reason-display">
        <i data-lucide="message-square"></i>
        <div>
          <div style="font-size:0.78em;color:var(--text-muted);margin-bottom:2px">Motif du retour</div>
          <div style="font-weight:500">${ret.reason || '—'}</div>
        </div>
      </div>

      <table class="data-table" style="margin-top:12px">
        <thead><tr><th>Médicament</th><th>Qté retournée</th><th>Prix unit.</th><th>Remboursé</th></tr></thead>
        <tbody>
          ${(ret.items || []).map(i => `
            <tr>
              <td>${i.productName || `Produit #${i.productId}`}</td>
              <td>${i.quantity}</td>
              <td>${UI.formatCurrency(i.unitPrice)}</td>
              <td><strong>${UI.formatCurrency(i.quantity * i.unitPrice)}</strong></td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr class="table-footer-row">
            <td colspan="3"><strong>Total remboursé</strong></td>
            <td><strong class="text-warning">${UI.formatCurrency(ret.refundAmount || 0)}</strong></td>
          </tr>
        </tfoot>
      </table>

      ${ret.isFullReturn ? '<div class="return-full-badge"><i data-lucide="check-circle"></i> Retour complet de la vente</div>' : ''}
    </div>
  `, {
        size: 'large',
        footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Fermer</button>
      <button class="btn btn-primary" onclick="printReturnReceipt(${returnId})">
        <i data-lucide="printer"></i> Imprimer le Reçu
      </button>`
    });
    if (window.lucide) lucide.createIcons();
};

// ═══════════════════════════════════════════════════════════════════
// IMPRESSION REÇU DE RETOUR
// ═══════════════════════════════════════════════════════════════════
window.printReturnReceipt = async function (returnId) {
    const ret = await DB.dbGet('returns', returnId);
    if (!ret) { UI.toast('Retour introuvable', 'error'); return; }

    const settings = await DB.dbGetAll('settings');
    const pharmacyName = settings.find(s => s.key === 'pharmacy_name')?.value || 'Pharmacie';
    const pharmacyAddress = settings.find(s => s.key === 'pharmacy_address')?.value || '';
    const pharmacyPhone = settings.find(s => s.key === 'pharmacy_phone')?.value || '';

    const receiptHtml = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Reçu de Retour RET-${String(returnId).padStart(5, '0')}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          line-height: 1.2;
          width: 76mm;
          height: auto !important;
          min-height: 0 !important;
          color: #000;
          background: #fff;
        }
        @page {
          size: 76mm auto;
          margin: 0 !important;
        }
        body {
          padding: 4px 6px 0 6px !important;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; margin: 1.5px 0; }
        .title { font-size: 13px; font-weight: bold; text-align: center; margin: 6px 0; }
        .total { font-size: 12px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 3px 0; margin-top: 3px; }
        .warning-box { border: 1px dashed #000; padding: 6px; text-align: center; margin: 6px 0; font-size: 10px; }
        @media print {
          html, body {
            width: 76mm;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body {
            padding: 4px 6px 0 6px !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="center bold" style="font-size:14px">${pharmacyName}</div>
      ${pharmacyAddress ? `<div class="center">${pharmacyAddress}</div>` : ''}
      ${pharmacyPhone ? `<div class="center">Tél: ${pharmacyPhone}</div>` : ''}
      <div class="line"></div>
      <div class="title">⟵ REÇU DE RETOUR MÉDICAMENT</div>
      <div class="line"></div>
      <div class="row"><span>N° Retour:</span><span>RET-${String(returnId).padStart(5, '0')}</span></div>
      <div class="row"><span>Vente liée:</span><span>#${String(ret.saleId).padStart(6, '0')}</span></div>
      <div class="row"><span>Date:</span><span>${new Date(ret.date).toLocaleString('fr-FR')}</span></div>
      <div class="row"><span>Patient:</span><span>${ret.patientName || 'Comptant'}</span></div>
      <div class="row"><span>Traité par:</span><span>${ret.processedBy || '—'}</span></div>
      <div class="line"></div>
      <div class="bold">Articles retournés :</div>
      ${(ret.items || []).map(i => `
        <div class="row">
          <span>${i.productName || 'Produit #' + i.productId} x${i.quantity}</span>
          <span>${(i.quantity * i.unitPrice).toLocaleString('fr-FR')} GNF</span>
        </div>`).join('')}
      <div class="line"></div>
      <div class="row total">
        <span>TOTAL REMBOURSÉ</span>
        <span>${(ret.refundAmount || 0).toLocaleString('fr-FR')} GNF</span>
      </div>
      <div class="line"></div>
      <div class="row"><span>Motif:</span></div>
      <div style="margin-top:3px;font-style:italic">${ret.reason || '—'}</div>
      <div class="line"></div>
      <div class="warning-box">
        ⚠ Ce document atteste du retour des médicaments ci-dessus.
        Gardez ce reçu comme justificatif de remboursement.
      </div>
      <div class="center" style="margin-top:8px;font-size:10px">
        Merci pour votre confiance — ${pharmacyName}
      </div>
    </body>
    </html>`;

    const win = window.open('', '_blank', 'width=400,height=600');
    if (win) {
        win.document.write(receiptHtml);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 500);
    } else {
        UI.toast('Blocage pop-up détecté. Autorisez les pop-ups pour ce site.', 'warning', 5000);
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXPORT CSV
// ═══════════════════════════════════════════════════════════════════
window.exportReturns = function () {
    if (window.Auth && !Auth.can('caisse_export_csv') && DB.AppState.currentUser?.role !== 'admin') {
        UI.toast('⛔ Vous n\'avez pas la permission d\'exporter les retours.', 'error', 4000);
        return;
    }
    const data = window._returnsData || [];
    const csv = '\uFEFFN° Retour,Date,Vente liée,Patient,Motif,Remboursement,Statut\n' +
        data.map(r => [
            `RET-${String(r.id).padStart(5, '0')}`,
            new Date(r.date).toLocaleString('fr-FR'),
            `#${String(r.saleId).padStart(6, '0')}`,
            r.patientName || 'Comptant',
            `"${(r.reason || '').replace(/"/g, '""')}"`,
            r.refundAmount || 0,
            r.status,
        ].join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `retours_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    UI.toast('Export CSV téléchargé', 'success');
};

window.exportReturnsPDF = function() {
  if (!window.PDFExport) return UI.toast("Module PDF non chargé", "error");
  const data = (window._returnsData || []).map(r => [
    'RET-' + r.id.toString().slice(-6),
    new Date(r.date).toLocaleString('fr-FR'),
    'V-' + r.saleId.toString().slice(-6),
    UI.formatCurrency(r.refundAmount || 0),
    r.reason || 'Non spécifié'
  ]);
  const headers = ["N° Retour", "Date", "Vente Initiale", "Montant Remboursé", "Motif"];
  window.PDFExport.generate("Historique des Retours", headers, data);
};

// ==========================================
// REGISTRATION
// ==========================================

window.openNewReturn = openNewReturn;
window.processReturn = processReturn;
window.filterReturns = filterReturns;
window.renderReturnsTable = renderReturnsTable;

Router.register('returns', renderReturns);

