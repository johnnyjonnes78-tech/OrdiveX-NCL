/**
 * OrdiveX — Module Créances & Assurances
 * Suivi et recouvrement des factures d'assurances et d'entreprises (Tiers Payant)
 */

async function renderClaims(container) {
  UI.loading(container, 'Chargement du module de créances...');

  // Récupérer les ventes et les utilisateurs
  const [sales, users] = await Promise.all([
    DB.dbGetAll('sales'),
    DB.dbGetAll('users')
  ]);

  // Extraire les noms uniques des assurances/entreprises présentes dans les ventes
  const insuranceNames = Array.from(
    new Set(
      sales
        .filter(s => s.assuranceName && s.assuranceName.trim() !== '')
        .map(s => s.assuranceName.trim())
    )
  ).sort((a, b) => a.localeCompare(b));

  // Date par défaut : Début de ce mois à aujourd'hui
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const fromDefault = startOfMonth.toISOString().split('T')[0];
  const toDefault = today.toISOString().split('T')[0];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Créances & Assurances</h1>
        <p class="page-subtitle">Suivi du tiers payant, recouvrements et encours entreprises</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-success" id="btn-claim-settle-all" style="display:none" onclick="settleAllClaims()"><i data-lucide="check-circle"></i> Tout Solder</button>
        <button class="btn btn-secondary" onclick="exportClaimsPDF()"><i data-lucide="printer"></i> PDF</button>
        <button class="btn btn-secondary" onclick="exportClaimsCSV()"><i data-lucide="download"></i> Exporter CSV</button>
      </div>
    </div>

    <div class="filter-bar" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; background:var(--surface); padding:16px; border-radius:12px; border:1px solid var(--border); margin-bottom:20px;">
      <div class="form-group" style="margin-bottom:0; min-width:200px; flex:1;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Entreprise / Assurance</label>
        <select id="claim-insurance-select" class="form-control" onchange="filterClaimsData()">
          <option value="">-- Choisir une entreprise --</option>
          ${insuranceNames.map(name => `<option value="${name}">${name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:0; width:150px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Date de début</label>
        <input type="date" id="claim-date-from" class="form-control" value="${fromDefault}" onchange="filterClaimsData()">
      </div>
      <div class="form-group" style="margin-bottom:0; width:150px;">
        <label style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px; display:block;">Date de fin</label>
        <input type="date" id="claim-date-to" class="form-control" value="${toDefault}" onchange="filterClaimsData()">
      </div>
    </div>

    <!-- BLOCS KPI -->
    <div class="kpi-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:20px;">
      <div class="kpi-card kpi-blue">
        <div class="kpi-icon"><i data-lucide="file-text"></i></div>
        <div class="kpi-content">
          <div class="kpi-value" id="kpi-claim-count">0</div>
          <div class="kpi-label">Total Factures</div>
        </div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-icon"><i data-lucide="banknote"></i></div>
        <div class="kpi-content">
          <div class="kpi-value" id="kpi-claim-total">0 GNF</div>
          <div class="kpi-label">Montant Facturé</div>
        </div>
      </div>
      <div class="kpi-card kpi-teal">
        <div class="kpi-icon"><i data-lucide="check-circle-2"></i></div>
        <div class="kpi-content">
          <div class="kpi-value" id="kpi-claim-paid">0 GNF</div>
          <div class="kpi-label">Montant Réglé (Patient + Tiers)</div>
        </div>
      </div>
      <div class="kpi-card kpi-red">
        <div class="kpi-icon"><i data-lucide="alert-circle"></i></div>
        <div class="kpi-content">
          <div class="kpi-value" id="kpi-claim-due">0 GNF</div>
          <div class="kpi-label">Reste à Recouvrer</div>
        </div>
      </div>
    </div>

    <div id="claims-table-container"></div>
  `;

  // Mettre les données brutes dans des variables de scope global pour le filtrage
  window._claimsSales = sales;
  window._claimsUsers = users;

  // Filtrer au chargement
  filterClaimsData();

  if (window.lucide) lucide.createIcons();
}

function filterClaimsData() {
  const selectInsurance = document.getElementById('claim-insurance-select')?.value || '';
  const fromDate = document.getElementById('claim-date-from')?.value;
  const toDate = document.getElementById('claim-date-to')?.value;

  const container = document.getElementById('claims-table-container');
  if (!container) return;

  // Si aucune entreprise n'est sélectionnée, afficher un message d'invite
  if (!selectInsurance) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px; text-align:center; background:var(--surface); border-radius:12px; border:1px solid var(--border);">
        <div class="empty-icon" style="font-size:48px; color:var(--text-muted); margin-bottom:12px;"><i data-lucide="shield-question"></i></div>
        <h3 style="font-size:16px; font-weight:700; margin-bottom:4px;">Sélectionnez une assurance ou une entreprise</h3>
        <p style="color:var(--text-muted); font-size:13px;">Veuillez choisir une entreprise dans la liste ci-dessus pour afficher le rapport de ses créances.</p>
      </div>
    `;
    // Mettre à jour les KPIs à 0
    document.getElementById('kpi-claim-count').textContent = '0';
    document.getElementById('kpi-claim-total').textContent = '0 GNF';
    document.getElementById('kpi-claim-paid').textContent = '0 GNF';
    document.getElementById('kpi-claim-due').textContent = '0 GNF';
    
    // Garder une trace globale des données filtrées vides pour les exports
    window._claimsFilteredData = [];
    window._claimsSelectedName = '';

    const settleAllBtn = document.getElementById('btn-claim-settle-all');
    if (settleAllBtn) settleAllBtn.style.display = 'none';
    
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Filtrer les ventes
  let filtered = window._claimsSales.filter(s => s.assuranceName === selectInsurance);

  if (fromDate) {
    filtered = filtered.filter(s => new Date(s.date) >= new Date(fromDate));
  }
  if (toDate) {
    filtered = filtered.filter(s => new Date(s.date) <= new Date(toDate + 'T23:59:59'));
  }

  // Trier par date décroissante
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Calculer les statistiques cumulées
  let totalBilled = 0;
  let totalPaid = 0;
  let totalDue = 0;

  filtered.forEach(s => {
    const isPaid = s.status === 'completed' || s.status === 'paid';
    const remains = isPaid ? 0 : (s.assuranceAmount || s.total);
    const paid = s.total - remains;

    totalBilled += s.total;
    totalPaid += paid;
    totalDue += remains;
  });

  // Mettre à jour les KPIs
  document.getElementById('kpi-claim-count').textContent = filtered.length;
  document.getElementById('kpi-claim-total').textContent = UI.formatCurrency(totalBilled);
  document.getElementById('kpi-claim-paid').textContent = UI.formatCurrency(totalPaid);
  document.getElementById('kpi-claim-due').textContent = UI.formatCurrency(totalDue);

  // Mettre à jour la visibilité du bouton "Tout solder"
  const settleAllBtn = document.getElementById('btn-claim-settle-all');
  if (settleAllBtn) {
    settleAllBtn.style.display = totalDue > 0 ? 'inline-flex' : 'none';
    settleAllBtn.innerHTML = `<i data-lucide="check-circle"></i> Tout Solder (${UI.formatCurrency(totalDue)})`;
  }

  // Conserver les données filtrées actives pour les exports PDF/CSV
  window._claimsFilteredData = filtered;
  window._claimsSelectedName = selectInsurance;

  // Créer un dictionnaire rapide des utilisateurs pour retrouver le nom de l'auteur
  const userMap = {};
  (window._claimsUsers || []).forEach(u => {
    userMap[u.id] = u.name || u.username;
  });

  // Afficher la table
  const columns = [
    { label: 'N° Facture', render: r => `<code class="code-tag">#${String(r.id).padStart(6, '0')}</code>` },
    { label: 'Date', render: r => UI.formatDateTime(new Date(r.date).getTime()) },
    { label: 'Patient', render: r => r.patientName || '<span class="text-muted">Anonyme</span>' },
    { label: 'Montant', render: r => `<strong>${UI.formatCurrency(r.total)}</strong>` },
    { 
      label: 'Montant Payé', 
      render: r => {
        const isPaid = r.status === 'completed' || r.status === 'paid';
        const remains = isPaid ? 0 : (r.assuranceAmount || r.total);
        const paid = r.total - remains;
        return `<span class="text-success">${UI.formatCurrency(paid)}</span>`;
      } 
    },
    { 
      label: 'Reste à Payer', 
      render: r => {
        const isPaid = r.status === 'completed' || r.status === 'paid';
        const remains = isPaid ? 0 : (r.assuranceAmount || r.total);
        return remains > 0 
          ? `<strong class="text-danger">${UI.formatCurrency(remains)}</strong>` 
          : `<span class="text-muted">—</span>`;
      } 
    },
    { 
      label: 'Statut', 
      render: r => {
        const isPaid = r.status === 'completed' || r.status === 'paid';
        return isPaid 
          ? `<span class="badge badge-success">Créance Réglée</span>` 
          : `<span class="badge badge-warning">En cours (Part Assur.)</span>`;
      } 
    },
    { label: 'Auteur', render: r => userMap[r.userId] || `<span class="text-muted">Inconnu</span>` }
  ];

  UI.table(container, columns, filtered, {
    emptyMessage: `Aucune facture d'assurance trouvée pour ${selectInsurance} sur cette période.`,
    emptyIcon: 'file-text'
  });
  
  if (window.lucide) lucide.createIcons();
}

window.settleAllClaims = function() {
  const selectInsurance = window._claimsSelectedName;
  const pendingSales = (window._claimsFilteredData || []).filter(s => s.status === 'pending');
  if (pendingSales.length === 0) {
    return UI.toast("Aucune créance en cours à solder pour cette entreprise", "warning");
  }

  const totalDue = pendingSales.reduce((sum, s) => sum + (s.assuranceAmount || s.total), 0);

  UI.modal('<i data-lucide="check-circle" class="modal-icon-inline"></i> Règlement Global — ' + selectInsurance, `
    <div style="display:flex;flex-direction:column;gap:16px">

      <!-- MONTANT PRINCIPAL -->
      <div style="text-align:center;padding:20px;background:#F8FAFC;border-radius:14px;border:2px solid #E2E8F0">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#64748B;font-weight:700;margin-bottom:6px">
          Montant global à encaisser (${pendingSales.length} factures)
        </div>
        <div style="font-size:32px;font-weight:900;color:#1E40AF;letter-spacing:-1px">${UI.formatCurrency(totalDue)}</div>
        <div style="font-size:12px;color:#94A3B8;margin-top:6px">
          Tiers payant entreprise : <strong style="color:#475569">${selectInsurance}</strong>
        </div>
      </div>

      <!-- MODE DE PAIEMENT -->
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748B;margin-bottom:8px">Mode de règlement global</div>
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:8px" id="claim-pay-methods">
          <button type="button" class="pay-method-btn active" data-method="cash" onclick="selectClaimPayMethod(this)"
            style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #1E40AF;border-radius:10px;background:#EBF5FB;cursor:pointer;font-family:inherit;text-align:left">
            <div><div style="font-size:12px;font-weight:700;color:#1E40AF">Espèces</div><div style="font-size:9px;color:#6B7280">Liquide</div></div>
          </button>
          <button type="button" class="pay-method-btn" data-method="orange_money" onclick="selectClaimPayMethod(this)"
            style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #E2E8F0;border-radius:10px;background:#FFFFFF;cursor:pointer;font-family:inherit;text-align:left">
            <div><div style="font-size:12px;font-weight:700;color:#0F172A">Orange Money</div><div style="font-size:9px;color:#6B7280">Mobile</div></div>
          </button>
          <button type="button" class="pay-method-btn" data-method="mtn_momo" onclick="selectClaimPayMethod(this)"
            style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #E2E8F0;border-radius:10px;background:#FFFFFF;cursor:pointer;font-family:inherit;text-align:left">
            <div><div style="font-size:12px;font-weight:700;color:#0F172A">MTN MoMo</div><div style="font-size:9px;color:#6B7280">Mobile</div></div>
          </button>
          <button type="button" class="pay-method-btn" data-method="transfer" onclick="selectClaimPayMethod(this)"
            style="display:flex;align-items:center;gap:8px;padding:12px;border:2px solid #E2E8F0;border-radius:10px;background:#FFFFFF;cursor:pointer;font-family:inherit;text-align:left">
            <div><div style="font-size:12px;font-weight:700;color:#0F172A">Virement</div><div style="font-size:9px;color:#6B7280">Bancaire</div></div>
          </button>
        </div>
      </div>

      <!-- RÉFÉRENCE DE PAIEMENT -->
      <div>
        <label style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#64748B;display:block;margin-bottom:6px">Référence / Chèque / Bordereau</label>
        <input type="text" id="claim-pay-ref" class="form-control" placeholder="Ex: Chèque n°12345, Bordereau de virement..." style="width:100%">
      </div>

      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:10px">
        <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
        <button class="btn btn-success" style="padding:10px 20px;font-size:13px;font-weight:700" onclick="confirmSettleAllClaims()">
          <i data-lucide="check-circle"></i> Confirmer l'encaissement
        </button>
      </div>
    </div>
  `);
  if (window.lucide) lucide.createIcons();
};

window.selectClaimPayMethod = function(btn) {
  document.querySelectorAll('#claim-pay-methods .pay-method-btn').forEach(b => {
    b.classList.remove('active');
    b.style.borderColor = '#E2E8F0';
    b.style.background = '#FFFFFF';
    b.querySelector('div div').style.color = '#0F172A';
  });
  btn.classList.add('active');
  btn.style.borderColor = '#1E40AF';
  btn.style.background = '#EBF5FB';
  btn.querySelector('div div').style.color = '#1E40AF';
};

window.confirmSettleAllClaims = async function() {
  const selectInsurance = window._claimsSelectedName;
  const pendingSales = (window._claimsFilteredData || []).filter(s => s.status === 'pending');
  if (pendingSales.length === 0) return;

  const methodBtn = document.querySelector('#claim-pay-methods .pay-method-btn.active');
  const paymentMethod = methodBtn ? methodBtn.dataset.method : 'cash';
  const reference = document.getElementById('claim-pay-ref')?.value || '';

  const totalDue = pendingSales.reduce((sum, s) => sum + (s.assuranceAmount || s.total), 0);

  const ok = await UI.confirm(`Voulez-vous encaisser globalement ${UI.formatCurrency(totalDue)} pour les ${pendingSales.length} factures de l'entreprise ${selectInsurance} ?`);
  if (!ok) return;

  // Utiliser le loader global d'OrdiveX au lieu de UI.loading(document.body)
  UI.showLoader("Règlement des créances en cours...", 30000);

  try {
    const today = new Date().toISOString().split('T')[0];

    // Mettre à jour chaque vente et l'ajouter au journal de caisse en parallèle
    const promises = pendingSales.map(async (sale) => {
      const debtAmount = sale.assuranceAmount || sale.total;

      // 1. Statut payé
      sale.status = 'paid';
      sale.paidAt = Date.now();
      sale.paidDate = today;
      sale.paidMethod = paymentMethod;
      await DB.dbPut('sales', sale);

      // 2. Enregistrer le règlement individuel en caisse pour que l'historique soit propre
      await DB.dbAdd('cashRegister', {
        type: 'debt_in',
        amount: debtAmount,
        paymentMethod: paymentMethod,
        reason: `Règlement global créance ${selectInsurance} — Vente #${String(sale.id).padStart(6, '0')}${sale.patientName ? ' · ' + sale.patientName : ''}`,
        reference: reference,
        saleId: sale.id,
        date: today,
        timestamp: Date.now(),
        userId: DB.AppState.currentUser?.id,
      });
    });

    await Promise.all(promises);

    // 3. Trace d'audit globale
    await DB.writeAudit('GLOBAL_DEBT_REFUND', 'claims', null, { 
      company: selectInsurance, 
      amount: totalDue, 
      count: pendingSales.length, 
      paymentMethod 
    });

    UI.toast(`Règlement global effectué avec succès ! (${pendingSales.length} factures)`, 'success');
    UI.closeModal();

    // Re-charger les ventes fraîches de la DB locale
    const freshSales = await DB.dbGetAll('sales');
    window._claimsSales = freshSales;
    filterClaimsData();

    // Déclencher la synchronisation Supabase en tâche de fond
    if (typeof DB.syncToSupabase === 'function') {
      DB.syncToSupabase().catch(console.error);
    }

  } catch (err) {
    console.error(err);
    UI.toast('Erreur lors du règlement global : ' + err.message, 'error');
  } finally {
    // Retirer le loader proprement via l'API UI
    UI.hideLoader();
  }
};

window.exportClaimsPDF = async function() {
  if (!window._claimsSelectedName) {
    return UI.toast("Veuillez sélectionner une entreprise avant d'exporter", "warning");
  }
  if (!window._claimsFilteredData || window._claimsFilteredData.length === 0) {
    return UI.toast("Aucune donnée à exporter pour la période sélectionnée", "warning");
  }
  
  UI.showLoader("Génération du PDF...", 30000);
  
  try {
    const userMap = {};
    (window._claimsUsers || []).forEach(u => {
      userMap[u.id] = u.name || u.username;
    });

    let totalBilled = 0;
    let totalPaid = 0;
    let totalDue = 0;

    const data = window._claimsFilteredData.map(s => {
      const isPaid = s.status === 'completed' || s.status === 'paid';
      const remains = isPaid ? 0 : (s.assuranceAmount || s.total);
      const paid = s.total - remains;

      totalBilled += s.total;
      totalPaid += paid;
      totalDue += remains;

      return [
        '#' + String(s.id).padStart(6, '0'),
        new Date(s.date).toLocaleDateString('fr-FR'),
        s.patientName || 'Anonyme',
        UI.formatCurrency(s.total),
        UI.formatCurrency(paid),
        UI.formatCurrency(remains),
        isPaid ? 'Réglée' : 'En cours',
        userMap[s.userId] || 'Inconnu'
      ];
    });

    const headers = ["N° Facture", "Date", "Patient", "Montant", "Montant Payé", "Reste à payer", "Statut", "Auteur"];
    
    const fromDate = document.getElementById('claim-date-from')?.value;
    const toDate = document.getElementById('claim-date-to')?.value;
    const dateRangeStr = (fromDate && toDate) 
      ? `Période du ${new Date(fromDate).toLocaleDateString('fr-FR')} au ${new Date(toDate).toLocaleDateString('fr-FR')}`
      : '';

    // On génère un PDF personnalisé avec le récapitulatif ET le détail de chaque facture
    if (!window.jspdf || !window.jspdf.jsPDF) {
      UI.toast("L'outil d'export PDF n'a pas pu être chargé", "error");
      UI.hideLoader();
      return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');
    
    // Charger les settings pour l'en-tête
    const settings = await DB.dbGetAll('settings') || [];
    const getSetting = (k) => { const s = settings.find(x => x.key === k); return s ? s.value : ''; };
    const pharmacyName = getSetting('pharmacy_name') || 'OrdiveX Pharmacie';
    const pharmacyAddress = getSetting('pharmacy_address') || '';
    const pharmacyPhone = getSetting('pharmacy_phone') || '';
    const logoDataUrl = getSetting('pharmacy_logo');

    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-FR');
    const timeStr = today.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const currentUser = AppState?.currentUser?.name || AppState?.currentUser?.username || 'Utilisateur';

    const drawHeader = (doc, title) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(27, 79, 114);
      
      let textStartX = 14;
      let startY = 15;
      
      if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
        try {
          doc.addImage(logoDataUrl, 'PNG', 14, 10, 16, 16);
          textStartX = 34;
        } catch(e) { }
      }
      
      doc.text(pharmacyName, textStartX, startY);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      if (pharmacyAddress) {
        startY += 4;
        doc.text(pharmacyAddress, textStartX, startY);
      }
      if (pharmacyPhone) {
        startY += 4;
        doc.text("Tél : " + pharmacyPhone, textStartX, startY);
      }
      
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 28, pageWidth - 14, 28);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), pageWidth / 2, 34, { align: 'center' });
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Imprimé le : ${dateStr} à ${timeStr}`, pageWidth - 14, 12, { align: 'right' });
      doc.text(`Par : ${currentUser}`, pageWidth - 14, 16, { align: 'right' });
    };

    const drawFooter = (doc) => {
      const str = 'Page ' + doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(str, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text("Généré par OrdiveX ERP", 14, pageHeight - 10);
    };

    // 1. Première page: Le Tableau Récapitulatif
    drawHeader(doc, `Suivi des Créances — ${window._claimsSelectedName}`);
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Entreprise/Assurance : ${window._claimsSelectedName}`, 14, 40);
    if (dateRangeStr) doc.text(dateRangeStr, 14, 45);

    doc.autoTable({
      head: [headers],
      body: data,
      startY: 48,
      margin: { top: 40, bottom: 20 },
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [27, 79, 114], textColor: 255, halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didDrawPage: function (data) {
        if (doc.internal.getNumberOfPages() > 1) {
          drawHeader(doc, `Suivi des Créances — ${window._claimsSelectedName}`);
        }
        drawFooter(doc);
      }
    });

    // Bloc résumé sur la première page (ou après le tableau)
    let finalY = doc.lastAutoTable.finalY + 12;
    if (finalY + 30 > pageHeight - 20) {
      doc.addPage();
      finalY = 40;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(27, 79, 114);
    doc.text("RÉSUMÉ ET STATISTIQUES", 14, finalY);
    doc.line(14, finalY + 1.5, 60, finalY + 1.5);
    
    finalY += 6;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);

    const summaryItems = [
      { label: "Nombre total de factures", value: `${data.length}` },
      { label: "Montant total facturé", value: `${UI.formatCurrency(totalBilled)}` },
      { label: "Montant total payé", value: `${UI.formatCurrency(totalPaid)}` },
      { label: "Montant restant dû", value: `${UI.formatCurrency(totalDue)}` }
    ];

    summaryItems.forEach(block => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${block.label} :`, 14, finalY);
      doc.setFont('helvetica', 'normal');
      doc.text(`${block.value}`, 70, finalY);
      finalY += 4.5;
    });

    // 2. Pages suivantes: Détail de chaque facture
    // Récupérer les items de vente correspondants
    const allSaleItems = await DB.dbGetAll('saleItems');
    const saleItemsMap = {};
    allSaleItems.forEach(item => {
      if (!saleItemsMap[item.saleId]) saleItemsMap[item.saleId] = [];
      saleItemsMap[item.saleId].push(item);
    });

    for (const sale of window._claimsFilteredData) {
      doc.addPage();
      drawHeader(doc, `Détail Facture #${String(sale.id).padStart(6, '0')}`);
      drawFooter(doc);

      // Infos de la facture
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(`Patient : ${sale.patientName || 'Anonyme'}`, 14, 40);
      doc.text(`Date : ${new Date(sale.date).toLocaleString('fr-FR')}`, 14, 45);
      
      const isPaid = sale.status === 'completed' || sale.status === 'paid';
      const remains = isPaid ? 0 : (sale.assuranceAmount || sale.total);
      const paid = sale.total - remains;

      doc.setFont('helvetica', 'normal');
      doc.text(`Montant Total : ${UI.formatCurrency(sale.total)}`, pageWidth - 80, 40);
      doc.text(`Montant Payé (T.M.) : ${UI.formatCurrency(paid)}`, pageWidth - 80, 45);
      doc.text(`Reste à payer (Assur.) : ${UI.formatCurrency(remains)}`, pageWidth - 80, 50);

      // Tableau des produits de cette facture
      const saleItems = saleItemsMap[sale.id] || [];
      const tableRows = saleItems.map(item => [
        item.productName,
        item.lotNumber || '—',
        item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('fr-FR') : '—',
        String(item.quantity),
        UI.formatCurrency(item.unitPrice || 0),
        UI.formatCurrency(item.total || 0)
      ]);

      doc.autoTable({
        head: [["Désignation", "N° Lot", "Expiration", "Quantité", "P. Unit.", "Total GNF"]],
        body: tableRows,
        startY: 55,
        margin: { top: 40, bottom: 20 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [40, 55, 71], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: function (data) {
          drawFooter(doc);
        }
      });
    }

    const safeTitle = `suivi_creances_detail_${window._claimsSelectedName.toLowerCase().replace(/\s+/g, '_')}`;
    const filename = `${safeTitle}_${today.toISOString().split('T')[0]}.pdf`;
    
    doc.save(filename);
    UI.hideLoader();
    UI.toast("Le PDF détaillé a été généré avec succès", "success");
    DB.writeAudit('EXPORT_PDF', 'claims', null, { title: `Suivi Créances Détaillé - ${window._claimsSelectedName}`, rows: data.length });

  } catch(err) {
    console.error(err);
    UI.hideLoader();
    UI.toast("Erreur lors de la génération du PDF", "error");
  }
};

window.exportClaimsCSV = function() {
  if (!window._claimsSelectedName) {
    return UI.toast("Veuillez sélectionner une entreprise avant d'exporter", "warning");
  }
  if (!window._claimsFilteredData || window._claimsFilteredData.length === 0) {
    return UI.toast("Aucune donnée à exporter", "warning");
  }

  const userMap = {};
  (window._claimsUsers || []).forEach(u => {
    userMap[u.id] = u.name || u.username;
  });

  const csvRows = [
    ["N° Facture", "Date", "Patient", "Montant Total", "Montant Payé", "Reste a Payer", "Statut", "Auteur"]
  ];

  window._claimsFilteredData.forEach(s => {
    const isPaid = s.status === 'completed' || s.status === 'paid';
    const remains = isPaid ? 0 : (s.assuranceAmount || s.total);
    const paid = s.total - remains;
    const author = userMap[s.userId] || 'Inconnu';

    csvRows.push([
      `"${String(s.id).padStart(6, '0')}"`,
      `"${new Date(s.date).toISOString().split('T')[0]}"`,
      `"${(s.patientName || 'Anonyme').replace(/"/g, '""')}"`,
      s.total,
      paid,
      remains,
      isPaid ? "Reglee" : "En cours",
      `"${author.replace(/"/g, '""')}"`
    ]);
  });

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  
  const fromDate = document.getElementById('claim-date-from')?.value || '';
  const toDate = document.getElementById('claim-date-to')?.value || '';
  const dateSuffix = fromDate ? `_${fromDate}_to_${toDate}` : '';

  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `creances_${window._claimsSelectedName.toLowerCase().replace(/\s+/g, '_')}${dateSuffix}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  UI.toast("Le fichier CSV a été exporté avec succès", "success");
  DB.writeAudit('EXPORT_CSV', 'claims', null, { company: window._claimsSelectedName, count: window._claimsFilteredData.length });
};

// Enregistrer la route
Router.register('claims', renderClaims);
