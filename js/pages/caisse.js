/**
 * OrdiveX — Module Caisse Journalière
 * Journal caisse, clôture, réconciliation, Mobile Money
 */

// Part en espèces réellement encaissée pour une vente donnée : le total
// complet pour un paiement 'cash', uniquement la part espèces pour un
// paiement 'combined' (mixte espèces + mobile money/autre), 0 sinon.
// Sans ceci, la part espèces d'un règlement mixte n'apparaissait jamais
// dans les totaux caisse (sous-évaluation systématique).
function _saleCashAmount(s) {
  if (!s.paymentMethod || s.paymentMethod === 'cash') return s.total || 0;
  if (s.paymentMethod === 'combined' && Array.isArray(s.paymentDetails)) {
    return s.paymentDetails
      .filter(d => d && d.method === 'cash')
      .reduce((a, d) => a + (d.amount || 0), 0);
  }
  return 0;
}

async function renderCaisse(container) {
  UI.loading(container, 'Chargement de la caisse...');

  const today = new Date().toISOString().split('T')[0];
  const [sales, cashRegisterRaw, returns] = await Promise.all([
    DB.dbGetAll('sales'),
    DB.dbGetAll('cashRegister'),
    DB.dbGetAll('returns'),
  ]);

  // ── Filtre RH : les opérations RH (salaires, avances) sont gérées
  // dans le module Ressources Humaines et n'apparaissent PAS ici. ──
  const cashRegister = cashRegisterRaw.filter(c => c.category !== 'RH');


  // Today's sales (we need completed, paid, AND pending if it's assurance because patient pays ticket modérateur today)
  const todaySalesRaw = sales.filter(s => s.date && s.date.startsWith(today) && ['completed', 'paid', 'pending'].includes(s.status));

  const breakdown = {
    cash: { count: 0, total: 0 },
    orange_money: { count: 0, total: 0 },
    mtn_momo: { count: 0, total: 0 },
    credit: { count: 0, total: 0 },
    transfer: { count: 0, total: 0 },
  };
  
  let totalSalesCounted = 0;
  let assuranceSalesTotal = 0;  // Montant total des couvertures créées aujourd'hui
  let assurancePending = 0;     // Montant NON encore encaissé (ce qu'on attend des entreprises)
  let assurancePaid = 0;        // Montant DÉJÀ encaissé aujourd'hui
  let assuranceCount = 0;       // Nombre total de couvertures
  let assurancePendingCount = 0;
  let assurancePaidCount = 0;
  
  todaySalesRaw.forEach(s => {
    // Avoid counting fully pending credit sales in the daily cash register
    if (s.status === 'pending' && s.paymentMethod === 'credit') return;

    totalSalesCounted++;

    // ── Helper: comptabilise la part assurance d'une vente ──
    const trackAssurance = (amount) => {
      assuranceCount++;
      assuranceSalesTotal += amount;
      if (s.status === 'pending') {
        assurancePendingCount++;
        assurancePending += amount;
      } else {
        assurancePaidCount++;
        assurancePaid += amount;
      }
    };

    if (s.paymentMethod === 'combined' && Array.isArray(s.paymentDetails) && s.paymentDetails.length > 0) {
        // Paiement mixte avec détails → ventiler chaque composante
        s.paymentDetails.forEach(d => {
            const m = d.method || 'cash';
            if (m === 'assurance') {
                trackAssurance(d.amount || 0);
            } else {
                if (!breakdown[m]) breakdown[m] = { count: 0, total: 0 };
                breakdown[m].count++;
                breakdown[m].total += d.amount || 0;
            }
        });
    } else if (s.paymentMethod === 'assurance' && Array.isArray(s.paymentDetails) && s.paymentDetails.length > 0) {
        // Assurance avec détails → seul le ticket modérateur (part patient) va en caisse
        let assurPartAmount = 0;
        s.paymentDetails.forEach(d => {
            if (d.method !== 'assurance') { // Part patient
                const m = d.method || 'cash';
                if (!breakdown[m]) breakdown[m] = { count: 0, total: 0 };
                breakdown[m].count++;
                breakdown[m].total += d.amount || 0;
            } else {
                assurPartAmount += d.amount || 0;
            }
        });
        trackAssurance(assurPartAmount);
    } else if (s.paymentMethod === 'assurance') {
        // Assurance SANS paymentDetails (anciennes données) → tout est dette
        trackAssurance(s.total || 0);
    } else if (s.paymentMethod === 'combined') {
        // Combined SANS paymentDetails (données incomplètes) → fallback espèces
        if (!breakdown.cash) breakdown.cash = { count: 0, total: 0 };
        breakdown.cash.count++;
        breakdown.cash.total += s.total || 0;
    } else {
        // Paiements simples : cash, orange_money, mtn_momo, transfer, credit
        const m = s.paymentMethod || 'cash';
        if (!breakdown[m]) breakdown[m] = { count: 0, total: 0 };
        breakdown[m].count++;
        breakdown[m].total += s.total || 0;
    }
  });

  // Debt payments received today (sales from older dates but paid today)
  const debtPaymentsToday = cashRegister.filter(c => c.date === today && c.type === 'debt_in');
  const debtByMethod = { cash: 0, orange_money: 0, mtn_momo: 0, transfer: 0 };
  debtPaymentsToday.forEach(d => {
    const m = d.paymentMethod || 'cash';
    debtByMethod[m] = (debtByMethod[m] || 0) + d.amount;
  });
  const totalDebtIn = debtPaymentsToday.reduce((a, d) => a + d.amount, 0);

  // Subtract today's returns from breakdown and gross total
  const todayReturns = returns.filter(r => r.date && r.date.startsWith(today) && r.status === 'approved');
  todayReturns.forEach(r => {
    const m = r.paymentMethod || 'cash';
    if (breakdown[m]) {
      breakdown[m].total -= (r.refundAmount || 0);
    }
  });

  const grandTotal = Object.values(breakdown).reduce((a, b) => a + b.total, 0) + totalDebtIn;
  const totalDiscounts = todaySalesRaw.reduce((a, s) => a + (s.discount || 0), 0);

  // Real Monthly Turnover calculation (Net: Sales - Returns)
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const monthlySales = sales.filter(s => s.date && s.date >= startOfMonth && ['completed', 'paid'].includes(s.status));
  const monthlyReturns = returns.filter(r => r.date && r.date >= startOfMonth && r.status === 'approved');

  const monthlyTurnover = monthlySales.reduce((a, s) => a + (s.total || 0), 0) -
    monthlyReturns.reduce((a, r) => a + (r.refundAmount || 0), 0);

  // Movements
  const manualIn = cashRegister.filter(c => c.date === today && c.type === 'manual_in').reduce((a, c) => a + c.amount, 0);
  const manualOut = cashRegister.filter(c => c.date === today && c.type === 'manual_out').reduce((a, c) => a + c.amount, 0);
  const returnOut = cashRegister.filter(c => c.date === today && c.type === 'return_out').reduce((a, c) => a + c.amount, 0);

  // Per-method sales breakdown for detail
  const cashSales = breakdown.cash.total;
  const omSales = breakdown.orange_money.total;
  const mtnSales = breakdown.mtn_momo.total;
  const transferSales = breakdown.transfer.total;
  const creditSales = breakdown.credit.total;

  // Theoretical balances by channel
  const cashBalance = cashSales + (debtByMethod.cash || 0) + manualIn - manualOut - returnOut;
  const omBalance = omSales + (debtByMethod.orange_money || 0);
  const mtnBalance = mtnSales + (debtByMethod.mtn_momo || 0);
  const transferBalance = transferSales + (debtByMethod.transfer || 0);
  const totalBalance = cashBalance + omBalance + mtnBalance + transferBalance;

  // Check if today is already closed
  const todayClosure = cashRegister.find(c => c.date === today && c.type === 'closure');

  // Get last 7 days closures
  const last7Closures = cashRegister.filter(c => c.type === 'closure').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  // Hourly sales today
  const hourlyData = new Array(24).fill(0);
  todaySalesRaw.forEach(s => {
    const h = new Date(s.date).getHours();
    hourlyData[h] += s.total || 0;
  });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Caisse Journalière</h1>
        <p class="page-subtitle">${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div class="header-actions">
        ${Auth.can('caisse_depot_retrait') ? `<button class="btn btn-secondary" onclick="openAddCashEntry()"><i data-lucide="plus"></i> Entrée/Sortie manuelle</button>` : ''}
        ${Auth.can('caisse_cloture')
          ? (!todayClosure
            ? `<button class="btn btn-primary" onclick="openCaisseClose()"><i data-lucide="lock"></i> Clôturer la journée</button>`
            : `<span class="badge badge-success" style="padding:8px 16px"><i data-lucide="check-circle"></i> Journée clôturée</span>`
          )
          : (todayClosure
            ? `<span class="badge badge-success" style="padding:8px 16px"><i data-lucide="check-circle"></i> Journée clôturée</span>`
            : `<span class="badge badge-warning" style="padding:8px 16px"><i data-lucide="lock"></i> Clôture non autorisée</span>`
          )
        }
      </div>
    </div>

    ${todayClosure ? `<div class="closure-banner"><i data-lucide="check-circle"></i> Cette journée a été clôturée à ${UI.formatDateTime(todayClosure.closedAt)} par ${todayClosure.closedBy}</div>` : ''}
    
    <!-- Tabs Navigation -->
    <div class="tabs-bar" style="margin-bottom: 20px; display:flex; flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none;">
      <style>.tabs-bar::-webkit-scrollbar { display: none; }</style>
      <button class="tab-btn active" style="flex-shrink:0" onclick="switchCaisseTab(this,'main')"><i data-lucide="banknote"></i> Ventes du jour</button>
      ${Auth.can('caisse_view_details') ? `
      <button class="tab-btn" style="flex-shrink:0" onclick="switchCaisseTab(this,'detail')"><i data-lucide="calculator"></i> Détail du calcul</button>` : ''}
      ${Auth.can('caisse_view_stats') ? `
      <button class="tab-btn" style="flex-shrink:0" onclick="switchCaisseTab(this,'stats')"><i data-lucide="bar-chart-3"></i> Statistiques & Clôtures</button>` : ''}
    </div>

    <div id="tab-caisse-main" class="tab-content active">
      <!-- Recap cards -->
      <div class="caisse-recap" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">
        <div class="caisse-total-card balance-card">
          <div class="caisse-total-icon" style="background: var(--success-color)"><i data-lucide="wallet"></i></div>
          <div>
            <div class="caisse-total-val" id="current-cash-display">${UI.formatCurrency(totalBalance)}</div>
            <div class="caisse-total-label">Solde Total Théorique</div>
            <div class="caisse-total-sub">Tous canaux confondus</div>
          </div>
        </div>
        <div class="caisse-total-card">
          <div class="caisse-total-icon"><i data-lucide="banknote"></i></div>
          <div>
            <div class="caisse-total-val">${UI.formatCurrency(grandTotal)}</div>
            <div class="caisse-total-label">Recette Totale Journée</div>
            <div class="caisse-total-sub">${totalSalesCounted} ventes${debtPaymentsToday.length ? ` · ${debtPaymentsToday.length} dette(s) encaissée(s)` : ''}${todayReturns.length ? ` · ${todayReturns.length} retour(s)` : ''}</div>
          </div>
        </div>
      </div>

      <div class="payment-breakdown-grid" style="margin-top:20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">
        ${Object.entries(breakdown).filter(([, v]) => v.count > 0).map(([method, data]) => {
      const icons = { cash: 'banknote', orange_money: 'smartphone', mtn_momo: 'smartphone', credit: 'file-text', transfer: 'landmark', assurance: 'shield-check' };
      const labels = { cash: 'Espèces', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', credit: 'Crédit', transfer: 'Virement', assurance: 'Prise en charge (Assurance)' };
      return `<div class="pay-breakdown-card">
            <span class="pay-icon-lg"><i data-lucide="${icons[method] || 'credit-card'}"></i></span>
            <div>
              <div class="pay-bd-val">${UI.formatCurrency(data.total)}</div>
              <div class="pay-bd-label">${labels[method] || method}</div>
              <div class="pay-bd-count">${data.count} vente(s)</div>
            </div>
          </div>`;
    }).join('')}
      </div>

      <!-- Today transactions list -->
      <div class="dash-panel" style="margin-top:24px">
        <div class="panel-header">
          <h3 class="panel-title"><i data-lucide="clipboard-list"></i> Transactions du jour (Ventes)</h3>
          <button class="btn btn-sm btn-ghost" onclick="exportDayTransactions('${today}')"><i data-lucide="download"></i> CSV</button>
        </div>
        <div id="today-transactions"></div>
      </div>

      <!-- Manual movements list -->
      <div class="dash-panel" style="margin-top:24px">
        <div class="panel-header">
          <h3 class="panel-title"><i data-lucide="banknote"></i> Mouvements Manuels (Hors Ventes)</h3>
        </div>
        <div id="manual-movements"></div>
      </div>
    </div>

    <!-- Tab: Balance Detail -->
    <div id="tab-caisse-detail" class="tab-content" style="display:none">
      <div class="dash-panel">
        <div class="panel-header" style="border-bottom: 1px solid var(--border); padding-bottom:16px; margin-bottom:20px;">
          <h3 class="panel-title"><i data-lucide="calculator"></i> Détail Avancé des Recettes et Flux Financiers</h3>
        </div>
        
        <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 24px;">
          
          <!-- Bloc Espèces -->
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:16px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:var(--text);">
              <div style="background:rgba(243, 156, 18, 0.1); color:#F39C12; padding:6px; border-radius:6px;"><i data-lucide="banknote" style="width:20px;height:20px;"></i></div>
              <h4 style="margin:0; font-size:15px; font-weight:600;">Caisse Espèces (Tiroir)</h4>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">+ Ventes directes</span> <strong class="text-success">${UI.formatCurrency(cashSales)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">+ Encaissements dettes</span> <strong class="text-success">${UI.formatCurrency(debtByMethod.cash || 0)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">+ Entrées manuelles</span> <strong class="text-success">${UI.formatCurrency(manualIn)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">- Sorties manuelles</span> <strong class="text-danger">-${UI.formatCurrency(manualOut)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
                <span class="text-muted">- Retours remboursés</span> <strong class="text-danger">-${UI.formatCurrency(returnOut)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span style="font-weight:600; font-size:14px;">Total Attendu Tiroir</span>
                <strong style="font-size:18px; color:var(--success-color);">${UI.formatCurrency(cashBalance)}</strong>
              </div>
            </div>
          </div>

          <!-- Bloc Mobile Money -->
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:16px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:var(--text);">
              <div style="background:rgba(231, 76, 60, 0.1); color:#E74C3C; padding:6px; border-radius:6px;"><i data-lucide="smartphone" style="width:20px;height:20px;"></i></div>
              <h4 style="margin:0; font-size:15px; font-weight:600;">Paiements Numériques</h4>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">Ventes Orange Money</span> <strong class="text-success">${UI.formatCurrency(omSales)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">Dettes Orange Money</span> <strong class="text-success">${UI.formatCurrency(debtByMethod.orange_money || 0)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">Ventes MTN MoMo</span> <strong class="text-success">${UI.formatCurrency(mtnSales)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
                <span class="text-muted">Dettes MTN MoMo</span> <strong class="text-success">${UI.formatCurrency(debtByMethod.mtn_momo || 0)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span style="font-weight:600; font-size:14px;">Total Comptes Numériques</span>
                <strong style="font-size:18px; color:var(--success-color);">${UI.formatCurrency(omBalance + mtnBalance)}</strong>
              </div>
            </div>
          </div>

          <!-- Bloc Banque -->
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:16px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:var(--text);">
              <div style="background:rgba(46, 204, 113, 0.1); color:#2ECC71; padding:6px; border-radius:6px;"><i data-lucide="landmark" style="width:20px;height:20px;"></i></div>
              <h4 style="margin:0; font-size:15px; font-weight:600;">Banque (Virements)</h4>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">Ventes par virement</span> <strong class="text-success">${UI.formatCurrency(transferSales)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; padding-bottom:8px; border-bottom:1px solid var(--border);">
                <span class="text-muted">Dettes réglées virement</span> <strong class="text-success">${UI.formatCurrency(debtByMethod.transfer || 0)}</strong>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span style="font-weight:600; font-size:14px;">Total Banque Attendus</span>
                <strong style="font-size:16px; color:var(--success-color);">${UI.formatCurrency(transferBalance)}</strong>
              </div>
            </div>
          </div>

          <!-- Bloc Créances / Assurances -->
          <div style="background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:16px; box-shadow:var(--shadow-sm);">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; color:var(--text);">
              <div style="background:rgba(52, 152, 219, 0.1); color:#3498DB; padding:6px; border-radius:6px;"><i data-lucide="file-text" style="width:20px;height:20px;"></i></div>
              <h4 style="margin:0; font-size:15px; font-weight:600;">Créances Journalières</h4>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; font-size:13px;">
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">Ventes à Crédit (${breakdown.credit?.count || 0})</span> <strong style="color:#2980B9">${UI.formatCurrency(creditSales)}</strong>
              </div>
              <div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-top:4px;">Couvertures Assurance (${assuranceCount})</div>
              ${assurancePendingCount > 0 ? `
              <div style="display:flex; justify-content:space-between; padding:6px 10px; background:rgba(231,76,60,0.06); border-radius:6px; border-left:3px solid #e74c3c;">
                <span style="color:#e74c3c; font-weight:600;">⏳ En attente (${assurancePendingCount})</span> <strong style="color:#e74c3c">${UI.formatCurrency(assurancePending)}</strong>
              </div>
              ` : `
              <div style="display:flex; justify-content:space-between;">
                <span class="text-muted">⏳ En attente</span> <strong style="color:var(--text-muted)">0 FG</strong>
              </div>
              `}
              ${assurancePaidCount > 0 ? `
              <div style="display:flex; justify-content:space-between; padding:6px 10px; background:rgba(39,174,96,0.06); border-radius:6px; border-left:3px solid #27ae60;">
                <span style="color:#27ae60; font-weight:600;">✅ Déjà réglées (${assurancePaidCount})</span> <strong style="color:#27ae60">${UI.formatCurrency(assurancePaid)}</strong>
              </div>
              ` : ''}
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; padding-top:8px; border-top:1px solid var(--border);">
                <span style="font-weight:600; font-size:14px;">Dettes Restantes</span>
                <strong style="font-size:18px; color:${(creditSales + assurancePending) > 0 ? '#e74c3c' : 'var(--success-color)'};">${UI.formatCurrency(creditSales + assurancePending)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div style="background: rgba(46,175,125,0.05); padding: 16px 20px; border-radius: 8px; border: 1px dashed var(--success-color); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:13px; color:var(--text-muted); text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">Recette Globale Multi-Canaux</div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Espèces + Mobile Money + Banque</div>
          </div>
          <div style="font-size:28px; font-weight:800; color:var(--success-color);">${UI.formatCurrency(totalBalance)}</div>
        </div>
      </div>
    </div>

    <!-- Tab: Stats & Closures -->
    <div id="tab-caisse-stats" class="tab-content" style="display:none">
      <!-- Charts row -->
      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-header"><h3 class="chart-title">Ventes par heure aujourd'hui</h3></div>
          <canvas id="chart-hourly" width="500" height="250"></canvas>
        </div>
        <div class="chart-card">
          <div class="chart-header"><h3 class="chart-title">Répartition paiements</h3></div>
          <canvas id="chart-pay-breakdown" width="500" height="250"></canvas>
        </div>
      </div>

      <!-- Last closures -->
      <div class="dash-panel" style="margin-top:24px">
        <div class="panel-header"><h3 class="panel-title"><i data-lucide="calendar"></i> Historique des 7 dernières clôtures</h3></div>
        ${last7Closures.length === 0 ? '<p class="text-muted text-center" style="padding:40px">Aucune clôture enregistrée</p>' : `
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Ventes Totales</th><th>Transactions</th><th>Clôturé par</th><th>Écart caisse</th></tr></thead>
              <tbody>
                ${last7Closures.map(c => {
      const ecart = (c.physicalCash || 0) - (c.expectedCash || 0);
      return `<tr>
                  <td>${UI.formatDate(c.date)}</td>
                  <td><strong>${UI.formatCurrency(c.totalSales || 0)}</strong></td>
                  <td>${c.transactionCount || 0}</td>
                  <td>${c.closedBy || '—'}</td>
                  <td class="${ecart === 0 ? 'text-success' : ecart > 0 ? 'text-success' : 'text-danger'} font-bold">${ecart >= 0 ? '+' : ''}${UI.formatCurrency(ecart)}</td>
                </tr>`;
    }).join('')}
              </tbody>
            </table>
          </div>`}
      </div>
    </div>
  `;

  // Render transactions & movements
  const txContainer = document.getElementById('today-transactions');
  if (txContainer) {
    if (todaySalesRaw.length === 0) {
      txContainer.innerHTML = '<div class="empty-state-small">Aucune vente aujourd\'hui</div>';
    } else {
      // Pré-calculer les remboursements par vente pour affichage net
      const refundMap = {};
      todayReturns.forEach(r => {
        refundMap[r.saleId] = (refundMap[r.saleId] || 0) + (r.refundAmount || 0);
      });

      const sortedTx = [...todaySalesRaw].sort((a, b) => new Date(b.date) - new Date(a.date));
      UI.table(txContainer, [
        { label: 'Heure', render: r => new Date(r.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) },
        { label: 'N° Vente', render: r => `<code class="code-tag">#${String(r.id).padStart(6, '0')}</code>` },
        { label: 'Articles', render: r => `${r.itemCount || '—'}` },
        { label: 'Remise', render: r => r.discount > 0 ? `<span class="text-warning">-${UI.formatCurrency(r.discount)}</span>` : '—' },
        {
          label: 'Montant Net', render: r => {
            const refunded = refundMap[r.id] || 0;
            const net = r.total - refunded;
            let badge = '';
            if (r.returnStatus === 'fully_returned') badge = ' <span class="badge badge-neutral" style="font-size:0.72em">Retourné</span>';
            else if (r.returnStatus === 'partially_returned') badge = ` <span class="badge badge-warning" style="font-size:0.72em">Ret. partiel (${UI.formatCurrency(refunded)})</span>`;
            return `<strong class="text-success">${UI.formatCurrency(net)}</strong>${badge}`;
          }
        },
        { label: 'Mode', render: r => UI.paymentMethodBadge(r.paymentMethod) },
        { label: '', render: r => `<button class="btn btn-xs btn-ghost" onclick="viewSaleDetail(${r.id})"><i data-lucide="eye"></i> Détail</button>` },
      ], sortedTx);
    }
  }
  // Render manual movements (entrées, sorties manuelles + remboursements retours)
  const manualContainer = document.getElementById('manual-movements');
  if (manualContainer) {
    const manualTx = cashRegister.filter(c => c.date === today && ['manual_in', 'manual_out', 'return_out'].includes(c.type));
    if (manualTx.length === 0) {
      manualContainer.innerHTML = '<div class="empty-state-small">Aucun mouvement manuel aujourd\'hui</div>';
    } else {
      const sortedManual = [...manualTx].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      UI.table(manualContainer, [
        { label: 'Heure', render: r => r.timestamp ? new Date(r.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—' },
        {
          label: 'Type', render: r => {
            if (r.type === 'return_out') return '<span class="badge badge-warning"><i data-lucide="undo-2"></i> Remboursement Retour</span>';
            return `<span class="badge badge-${r.type === 'manual_in' ? 'success' : 'warning'}"><i data-lucide="${r.type === 'manual_in' ? 'arrow-up' : 'arrow-down'}"></i> ${r.type === 'manual_in' ? 'Entrée' : 'Sortie'}</span>`;
          }
        },
        { label: 'Montant', render: r => `<strong class="text-danger">-${UI.formatCurrency(r.amount)}</strong>`.replace('text-danger">-', r.type === 'manual_in' ? 'text-success">+' : 'text-danger">-') },
        { label: 'Motif', render: r => r.reason || '—' },
        { label: 'Mode', render: r => UI.paymentMethodBadge(r.paymentMethod) },
        { label: 'Réf.', render: r => r.reference ? `<code class="code-tag">${r.reference}</code>` : (r.returnId ? `<code class="code-tag">RET-${String(r.returnId).padStart(5, '0')}</code>` : '—') },
      ], sortedManual);
    }
  }

  if (window.lucide) lucide.createIcons();

  // Draw charts
  requestAnimationFrame(() => {
    const activeHours = hourlyData.map((v, h) => ({ h, v })).filter(x => x.v > 0);
    const peakHour = activeHours.length > 0 ? activeHours.reduce((a, b) => b.v > a.v ? b : a).h : 12;
    const displayHours = Array.from({ length: 24 }, (_, i) => i);
    Charts.bar('chart-hourly',
      new Array(24).fill(0).map((_, h) => `${h}h`),
      [{ data: hourlyData, color: '#2E86C1' }]
    );

    const payKeys = Object.keys(breakdown).filter(k => breakdown[k].count > 0);
    const payColors = { cash: '#F39C12', orange_money: '#E74C3C', mtn_momo: '#F1C40F', credit: '#3498DB', transfer: '#2ECC71' };
    const payLabels = { cash: 'Espèces', orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', credit: 'Crédit', transfer: 'Virement' };
    Charts.donut('chart-pay-breakdown',
      payKeys.map(k => payLabels[k] || k),
      payKeys.map(k => breakdown[k].total),
      payKeys.map(k => payColors[k] || '#95A5A6')
    );
  });
}

function switchCaisseTab(btn, tabId) {
  const targetId = `tab-caisse-${tabId}`;
  const target = document.getElementById(targetId);
  if (!target) return;

  const bar = btn.closest('.tabs-bar');
  bar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  document.querySelectorAll('#tab-caisse-main, #tab-caisse-detail, #tab-caisse-stats').forEach(t => t.style.display = 'none');

  btn.classList.add('active');
  target.style.display = 'block';
}

function openAddCashEntry() {
  if (window.Auth && !Auth.can('caisse_depot_retrait') && DB.AppState.currentUser?.role !== 'admin') {
    UI.toast('⛔ Vous n\'avez pas la permission d\'effectuer des mouvements de caisse manuels.', 'error', 5000);
    return;
  }
  UI.modal('<i data-lucide="banknote" class="modal-icon-inline"></i> Mouvement de Caisse Manuel', `
    <form id="cash-entry-form" class="form-grid">
      <div class="form-group">
        <label>Type de mouvement *</label>
        <select name="type" id="cash-entry-type" class="form-control" required>
          <option value="in">Entrée (fond de caisse, autre recette)</option>
          <option value="out">Sortie (achat express, remboursement, dépense)</option>
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Montant (GNF) *</label>
          <input type="number" name="amount" class="form-control" min="1" required>
        </div>
        <div class="form-group">
          <label>Mode de paiement</label>
          <select name="paymentMethod" class="form-control">
            <option value="cash">Espèces</option>
            <option value="orange_money">Orange Money</option>
            <option value="mtn_momo">MTN MoMo</option>
            <option value="transfer">Virement</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Motif *</label>
        <input type="text" name="reason" class="form-control" placeholder="Ex: Fond de caisse initial, Remboursement patient..." required>
      </div>
      <div class="info-box-small" style="margin-top:8px">
        <i data-lucide="info"></i>
        <span>Solde actuel en caisse : <strong>${document.getElementById('current-cash-display')?.textContent || '...'}</strong></span>
      </div>
      <div class="form-group">
        <label>N° de référence</label>
        <input type="text" name="reference" class="form-control" placeholder="N° de reçu, N° transaction Orange Money...">
      </div>
    </form>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitCashEntry()"><i data-lucide="check"></i> Enregistrer</button>
    `
  });
  if (window.lucide) lucide.createIcons();
}

async function submitCashEntry() {
  if (window._caisseEntryEnCours) { UI.toast('Enregistrement en cours...', 'warning', 2000); return; }
  window._caisseEntryEnCours = true;
  
  try {
    const form = document.getElementById('cash-entry-form');
    if (!form?.checkValidity()) { form?.reportValidity(); return; }
    const data = Object.fromEntries(new FormData(form));
    const amount = parseFloat(data.amount);
    const type = data.type === 'in' ? 'manual_in' : 'manual_out';

    if (type === 'manual_out') {
      const today = new Date().toISOString().split('T')[0];
      const [sales, cashRegister] = await Promise.all([
        DB.dbGetAll('sales'),
        DB.dbGetAll('cashRegister'),
      ]);

      const cashSales = sales.filter(s => s.date?.startsWith(today) && s.status === 'completed').reduce((a, s) => a + _saleCashAmount(s), 0);
      const manualIn = cashRegister.filter(c => c.date === today && c.type === 'manual_in').reduce((a, c) => a + c.amount, 0);
      const manualOut = cashRegister.filter(c => c.date === today && c.type === 'manual_out').reduce((a, c) => a + c.amount, 0);
      const currentBalance = cashSales + manualIn - manualOut;

      if (amount > currentBalance) {
        UI.toast("L'argent n'est pas dans la caisse", 'error', 5000);
        return;
      }
    }

    await DB.dbAdd('cashRegister', {
      type,
      amount,
      paymentMethod: data.paymentMethod,
      reason: data.reason,
      reference: data.reference || '',
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
      userId: DB.AppState.currentUser?.id,
    });
    await DB.writeAudit('CASH_ENTRY', 'cashRegister', null, data);
    UI.closeModal();
    UI.toast(`Mouvement de caisse enregistré`, 'success');
    Router.navigate('caisse');
  } catch (err) {
    console.error(err);
    UI.toast('Erreur lors de la validation.', 'error');
  } finally {
    window._caisseEntryEnCours = false;
  }
}

function openCaisseClose() {
  UI.modal('<i data-lucide="lock" class="modal-icon-inline"></i> Clôture de Caisse', `
    <div class="closure-form">
      <div class="closure-warning">
        <i data-lucide="alert-triangle"></i>
        <p>La clôture de caisse est une opération définitive pour la journée. Elle doit être réalisée par le responsable de la pharmacie.</p>
      </div>
      <div class="form-grid" style="margin-top:16px">
        <div class="form-row">
          <div class="form-group">
            <label>Fond d'ouverture de caisse (GNF)</label>
            <input type="number" id="closure-opening" class="form-control" placeholder="Montant en espèces en caisse ce matin">
          </div>
          <div class="form-group">
            <label>Espèces comptées en caisse (GNF)</label>
            <input type="number" id="closure-physical" class="form-control" placeholder="Comptage physique actuel" oninput="calcClosureEcart()">
          </div>
        </div>
        <div class="form-group">
          <label>Espèces attendues selon système</label>
          <div id="closure-expected" class="closure-expected-display">Calcul en cours...</div>
        </div>
        <div class="form-group">
          <label>Écart de caisse</label>
          <div id="closure-ecart" class="closure-ecart-display">—</div>
        </div>
        <div class="form-group">
          <label>Observations</label>
          <textarea id="closure-note" class="form-control" rows="2" placeholder="Billets retirés, déposés en banque, incidents..."></textarea>
        </div>
      </div>
    </div>
  `, {
    footer: `
      <button class="btn btn-secondary" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-danger" onclick="confirmCaisseClose()"><i data-lucide="lock"></i> Confirmer la Clôture</button>
    `
  });
  if (window.lucide) lucide.createIcons();
  calcExpectedCash();
}

async function calcExpectedCash() {
  const today = new Date().toISOString().split('T')[0];
  const sales = await DB.dbGetAll('sales');
  const todayCash = sales.filter(s => s.date?.startsWith(today) && s.status === 'completed').reduce((a, s) => a + _saleCashAmount(s), 0);
  const manualIn = (await DB.dbGetAll('cashRegister')).filter(c => c.date === today && c.type === 'manual_in').reduce((a, c) => a + c.amount, 0);
  const manualOut = (await DB.dbGetAll('cashRegister')).filter(c => c.date === today && c.type === 'manual_out').reduce((a, c) => a + c.amount, 0);
  const returnOut = (await DB.dbGetAll('cashRegister')).filter(c => c.date === today && c.type === 'return_out').reduce((a, c) => a + c.amount, 0);
  const expected = todayCash + manualIn - manualOut - returnOut;
  const todayReturns = (await DB.dbGetAll('returns')).filter(r => r.date?.startsWith(today) && r.status === 'approved');
  const totalReturnsAmt = todayReturns.reduce((a, r) => a + (r.refundAmount || 0), 0);

  window._expectedCash = expected;
  window._todayCashTotal = todayCash;
  window._todaySalesCount = sales.filter(s => s.date?.startsWith(today) && s.status === 'completed').length;
  window._todaySalesTotal = sales.filter(s => s.date?.startsWith(today) && s.status === 'completed').reduce((a, s) => a + s.total, 0) - totalReturnsAmt;

  const el = document.getElementById('closure-expected');
  if (el) el.textContent = UI.formatCurrency(expected);
  calcClosureEcart();
}

function calcClosureEcart() {
  const physical = parseFloat(document.getElementById('closure-physical')?.value || 0);
  const expected = window._expectedCash || 0;
  const ecart = physical - expected;
  const el = document.getElementById('closure-ecart');
  if (el) {
    el.textContent = `${ecart >= 0 ? '+' : ''}${UI.formatCurrency(ecart)}`;
    el.className = 'closure-ecart-display ' + (ecart === 0 ? 'ecart-ok' : ecart > 0 ? 'ecart-surplus' : 'ecart-deficit');
  }
}

async function confirmCaisseClose() {
  if (window._caisseCloseEnCours) { UI.toast('Cloture en cours...', 'warning', 2000); return; }
  window._caisseCloseEnCours = true;
  // Restriction : permission caisse_cloture ou rôle admin/pharmacien
  const role = DB.AppState.currentUser?.role;
  const canClose = window.Auth ? Auth.can('caisse_cloture') : ['admin', 'pharmacien'].includes(role);
  if (!canClose) {
    UI.toast('Vous n\'avez pas la permission de clôturer la caisse. Contactez le responsable.', 'error', 5000);
    UI.closeModal();
    window._caisseCloseEnCours = false;
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const physical = parseFloat(document.getElementById('closure-physical')?.value || 0);
  const opening = parseFloat(document.getElementById('closure-opening')?.value || 0);
  const note = document.getElementById('closure-note')?.value || '';
  const ok = await UI.confirm(`Confirmer la clôture de caisse du ${today} ?\n\nCette action est irréversible. Aucune vente ne pourra être enregistrée après la clôture.`);
  if (!ok) { window._caisseCloseEnCours = false; return; }

  try {
    if (window.UI && UI.showLoader) UI.showLoader('Cloture de caisse en cours...', 10000);
    await DB.dbAdd('cashRegister', {
      type: 'closure',
      date: today,
      closedAt: Date.now(),
      closedBy: DB.AppState.currentUser?.name,
      closedByRole: role,
      openingFund: opening,
      expectedCash: window._expectedCash || 0,
      physicalCash: physical,
      totalSales: window._todaySalesTotal || 0,
      transactionCount: window._todaySalesCount || 0,
      note,
    });

    await DB.writeAudit('CAISSE_CLOSURE', 'cashRegister', null, { date: today, physical, expected: window._expectedCash, closedBy: DB.AppState.currentUser?.name });
    UI.closeModal();
    UI.toast('Caisse cloturee avec succes. Les ventes sont bloquees pour aujourd\'hui.', 'success', 5000);
    Router.navigate('caisse');
  } catch (err) {
    console.error('[Caisse Close Error]', err);
    UI.toast('Erreur lors de la clôture : ' + (err?.message || err), 'error');
  } finally {
    window._caisseCloseEnCours = false;
    if (window.UI && UI.hideLoader) UI.hideLoader();
  }
}

async function exportDayTransactions(date) {
  const sales = await DB.dbGetAll('sales');
  const daySales = sales.filter(s => s.date?.startsWith(date));
  const csv = '\uFEFFN° Vente,Heure,Articles,Remise,Total,Mode Paiement\n' +
    daySales.map(s => [s.id, new Date(s.date).toLocaleTimeString('fr-FR'), s.itemCount || '', s.discount || 0, s.total, s.paymentMethod].join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `caisse_${date}.csv`;
  a.click();
  UI.toast('Export caisse téléchargé', 'success');
  DB.writeAudit('EXPORT_CSV', 'cashRegister', null, { count: daySales.length, date, filename: a.download });
}

window.switchCaisseTab = switchCaisseTab;
window.openAddCashEntry = openAddCashEntry;
window.submitCashEntry = submitCashEntry;
window.openCaisseClose = openCaisseClose;
window.calcClosureEcart = calcClosureEcart;
window.confirmCaisseClose = confirmCaisseClose;
window.exportDayTransactions = exportDayTransactions;

Router.register('caisse', renderCaisse);
