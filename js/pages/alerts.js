/**
 * OrdiveX — Gestion Moderne des Alertes
 * Filtres par mois, type, priorité, statut + Stats + Actions groupées
 */

const AlertsPage = {
  // State
  filters: {
    month: '', // 'YYYY-MM' ou '' pour tout
    type: 'all',
    priority: 'all',
    status: 'unread', // Par défaut: non lues
    search: '',
  },

  alertTypes: {
    LOW_STOCK:          { icon: 'package',        label: 'Stock bas',           color: '#E8913A', cls: 'badge-warning' },
    EXPIRY_SOON:        { icon: 'clock',          label: 'Expiration proche',   color: '#E8913A', cls: 'badge-warning' },
    EXPIRY_CRITICAL:    { icon: 'alert-octagon',  label: 'Expiration critique', color: '#D63B3B', cls: 'badge-danger' },
    RUPTURE:            { icon: 'x-circle',       label: 'Rupture de stock',    color: '#D63B3B', cls: 'badge-danger' },
    LOT_RECALL:         { icon: 'alert-triangle', label: 'Rappel de lot',       color: '#D63B3B', cls: 'badge-danger' },
    ORDER_LATE:         { icon: 'truck',          label: 'Commande en retard',  color: '#E8913A', cls: 'badge-warning' },
    CAISSE_REMINDER:    { icon: 'banknote',       label: 'Rappel caisse',       color: '#4A9FD9', cls: 'badge-info' },
    NON_CONFORMITY:     { icon: 'shield-alert',   label: 'Non-conformité',      color: '#D63B3B', cls: 'badge-danger' },
    PHARMACOVIGILANCE:  { icon: 'microscope',     label: 'Pharmacovigilance',   color: '#8B5CF6', cls: 'badge-purple' },
  },

  priorityMap: {
    critical: { label: 'Critique', icon: 'alert-octagon', cls: 'priority-critical', color: '#D63B3B' },
    high:     { label: 'Haute',    icon: 'alert-triangle', cls: 'priority-high',     color: '#E8913A' },
    medium:   { label: 'Moyenne',  icon: 'info',           cls: 'priority-medium',   color: '#4A9FD9' },
    low:      { label: 'Basse',    icon: 'minus-circle',   cls: 'priority-low',      color: '#94A3B8' },
  },

  getFilteredAlerts(allAlerts) {
    let filtered = [...allAlerts];

    // Filter by status
    if (this.filters.status === 'unread') {
      filtered = filtered.filter(a => a.status === 'unread');
    } else if (this.filters.status === 'read') {
      filtered = filtered.filter(a => a.status === 'read');
    }

    // Filter by month
    if (this.filters.month) {
      filtered = filtered.filter(a => {
        const d = new Date(a.date);
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return m === this.filters.month;
      });
    }

    // Filter by type
    if (this.filters.type !== 'all') {
      filtered = filtered.filter(a => a.type === this.filters.type);
    }

    // Filter by priority
    if (this.filters.priority !== 'all') {
      filtered = filtered.filter(a => a.priority === this.filters.priority);
    }

    // Search
    if (this.filters.search.trim()) {
      const q = this.filters.search.toLowerCase();
      filtered = filtered.filter(a =>
        (a.message || '').toLowerCase().includes(q) ||
        (a.productName || '').toLowerCase().includes(q) ||
        (a.type || '').toLowerCase().includes(q)
      );
    }

    // Sort: unread first, then by priority, then by date desc
    const pri = { critical: 4, high: 3, medium: 2, low: 1 };
    filtered.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'unread' ? -1 : 1;
      return (pri[b.priority] || 0) - (pri[a.priority] || 0) || (b.date || 0) - (a.date || 0);
    });

    return filtered;
  },

  getAvailableMonths(allAlerts) {
    const months = new Set();
    allAlerts.forEach(a => {
      if (a.date) {
        const d = new Date(a.date);
        months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    });
    return [...months].sort().reverse();
  },

  formatMonth(ym) {
    const [y, m] = ym.split('-');
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${monthNames[parseInt(m) - 1]} ${y}`;
  },

  getStats(allAlerts) {
    const unread = allAlerts.filter(a => a.status === 'unread');
    const critical = unread.filter(a => a.priority === 'critical').length;
    const high = unread.filter(a => a.priority === 'high').length;
    const medium = unread.filter(a => a.priority === 'medium').length;
    const low = unread.filter(a => a.priority === 'low').length;

    // By type
    const byType = {};
    unread.forEach(a => {
      byType[a.type] = (byType[a.type] || 0) + 1;
    });

    // Today
    const today = new Date().toISOString().split('T')[0];
    const todayCount = unread.filter(a => {
      try { return new Date(a.date).toISOString().split('T')[0] === today; } catch { return false; }
    }).length;

    return { total: allAlerts.length, unread: unread.length, critical, high, medium, low, byType, todayCount };
  },

  async render(container) {
    UI.loading(container, 'Chargement des alertes...');
    const allAlerts = await DB.dbGetAll('alerts');
    const stats = this.getStats(allAlerts);
    const filtered = this.getFilteredAlerts(allAlerts);
    const months = this.getAvailableMonths(allAlerts);

    // Pagination
    const PAGE_SIZE = 100;
    const totalFiltered = filtered.length;
    const totalPages = Math.ceil(totalFiltered / PAGE_SIZE) || 1;
    let currentPage = parseInt(container.dataset.alertPage || '1');
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const paginated = filtered.slice(startIdx, startIdx + PAGE_SIZE);

    // Group only paginated alerts by month for timeline
    const grouped = {};
    paginated.forEach(a => {
      const d = new Date(a.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    });
    const sortedGroupKeys = Object.keys(grouped).sort().reverse();

    container.innerHTML = `
      <div class="alerts-page">
        <!-- Header -->
        <div class="page-header">
          <div>
            <h1 class="page-title">Centre d'Alertes</h1>
            <p class="page-subtitle">${stats.unread} alerte(s) active(s) · ${stats.todayCount} aujourd'hui</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary" onclick="AlertsPage.exportCSV()" title="Exporter">
              <i data-lucide="download"></i> CSV
            </button>
            <button class="btn btn-secondary" onclick="AlertsPage.deleteReadAlerts()">
              <i data-lucide="trash-2"></i> Purger les lues
            </button>
            <button class="btn btn-primary" onclick="AlertsPage.markAllRead()">
              <i data-lucide="check-check"></i> Tout marquer lu
            </button>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="alerts-stats-grid">
          <div class="alerts-stat-card stat-critical" onclick="AlertsPage.quickFilter('priority','critical')">
            <div class="alerts-stat-icon"><i data-lucide="alert-octagon"></i></div>
            <div class="alerts-stat-value">${stats.critical}</div>
            <div class="alerts-stat-label">Critiques</div>
          </div>
          <div class="alerts-stat-card stat-high" onclick="AlertsPage.quickFilter('priority','high')">
            <div class="alerts-stat-icon"><i data-lucide="alert-triangle"></i></div>
            <div class="alerts-stat-value">${stats.high}</div>
            <div class="alerts-stat-label">Hautes</div>
          </div>
          <div class="alerts-stat-card stat-medium" onclick="AlertsPage.quickFilter('priority','medium')">
            <div class="alerts-stat-icon"><i data-lucide="info"></i></div>
            <div class="alerts-stat-value">${stats.medium}</div>
            <div class="alerts-stat-label">Moyennes</div>
          </div>
          <div class="alerts-stat-card stat-low" onclick="AlertsPage.quickFilter('priority','low')">
            <div class="alerts-stat-icon"><i data-lucide="minus-circle"></i></div>
            <div class="alerts-stat-value">${stats.low}</div>
            <div class="alerts-stat-label">Basses</div>
          </div>
          <div class="alerts-stat-card stat-total" onclick="AlertsPage.quickFilter('status','all')">
            <div class="alerts-stat-icon"><i data-lucide="bell"></i></div>
            <div class="alerts-stat-value">${stats.total}</div>
            <div class="alerts-stat-label">Total</div>
          </div>
        </div>

        <!-- Filters Bar -->
        <div class="alerts-filters-bar">
          <div class="alerts-filter-group">
            <label><i data-lucide="search"></i></label>
            <input type="text" id="alerts-search" class="alerts-filter-input"
              placeholder="Rechercher une alerte..."
              value="${this.filters.search}"
              oninput="AlertsPage.onFilterChange()">
          </div>

          <div class="alerts-filter-group">
            <label><i data-lucide="calendar"></i></label>
            <select id="alerts-month" class="alerts-filter-select" onchange="AlertsPage.onFilterChange()">
              <option value="">Tous les mois</option>
              ${months.map(m => `<option value="${m}" ${this.filters.month === m ? 'selected' : ''}>${this.formatMonth(m)}</option>`).join('')}
            </select>
          </div>

          <div class="alerts-filter-group">
            <label><i data-lucide="tag"></i></label>
            <select id="alerts-type" class="alerts-filter-select" onchange="AlertsPage.onFilterChange()">
              <option value="all">Tous les types</option>
              ${Object.entries(this.alertTypes).map(([key, val]) => {
                const count = stats.byType[key] || 0;
                return `<option value="${key}" ${this.filters.type === key ? 'selected' : ''}>${val.label}${count ? ` (${count})` : ''}</option>`;
              }).join('')}
            </select>
          </div>

          <div class="alerts-filter-group">
            <label><i data-lucide="flag"></i></label>
            <select id="alerts-priority" class="alerts-filter-select" onchange="AlertsPage.onFilterChange()">
              <option value="all" ${this.filters.priority === 'all' ? 'selected' : ''}>Toutes priorités</option>
              <option value="critical" ${this.filters.priority === 'critical' ? 'selected' : ''}>🔴 Critique</option>
              <option value="high" ${this.filters.priority === 'high' ? 'selected' : ''}>🟠 Haute</option>
              <option value="medium" ${this.filters.priority === 'medium' ? 'selected' : ''}>🔵 Moyenne</option>
              <option value="low" ${this.filters.priority === 'low' ? 'selected' : ''}>⚪ Basse</option>
            </select>
          </div>

          <div class="alerts-filter-group">
            <label><i data-lucide="eye"></i></label>
            <select id="alerts-status" class="alerts-filter-select" onchange="AlertsPage.onFilterChange()">
              <option value="unread" ${this.filters.status === 'unread' ? 'selected' : ''}>Non lues</option>
              <option value="read" ${this.filters.status === 'read' ? 'selected' : ''}>Lues</option>
              <option value="all" ${this.filters.status === 'all' ? 'selected' : ''}>Toutes</option>
            </select>
          </div>

          ${(this.filters.month || this.filters.type !== 'all' || this.filters.priority !== 'all' || this.filters.status !== 'unread' || this.filters.search) ? `
            <button class="btn btn-xs btn-ghost alerts-clear-btn" onclick="AlertsPage.clearFilters()">
              <i data-lucide="x"></i> Réinitialiser
            </button>
          ` : ''}
        </div>

        <!-- Results Count -->
        <div class="alerts-results-bar" style="display:flex; justify-content:space-between; align-items:center;">
          <span class="alerts-results-count">${totalFiltered.toLocaleString()} alerte(s) | Page ${currentPage}/${totalPages}</span>
          ${totalPages > 1 ? `
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="AlertsPage.changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>◀ Précédent</button>
              <button class="btn btn-secondary btn-sm" onclick="AlertsPage.changePage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Suivant ▶</button>
            </div>
          ` : ''}
        </div>

        <!-- Alerts Timeline -->
        <div class="alerts-timeline">
          ${paginated.length === 0 ? `
            <div class="alerts-empty">
              <div class="alerts-empty-icon"><i data-lucide="bell-off"></i></div>
              <h3>Aucune alerte</h3>
              <p>Aucune alerte ne correspond à vos filtres.</p>
            </div>
          ` : sortedGroupKeys.map(monthKey => `
            <div class="alerts-month-group">
              <div class="alerts-month-header">
                <div class="alerts-month-dot"></div>
                <span class="alerts-month-label">${this.formatMonth(monthKey)}</span>
                <span class="alerts-month-count">${grouped[monthKey].length} alerte(s) (cette page)</span>
              </div>
              <div class="alerts-cards-grid">
                ${grouped[monthKey].map(a => this.renderAlertCard(a)).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        
        ${totalPages > 1 ? `
        <div class="alerts-results-bar" style="display:flex; justify-content:center; align-items:center; margin-top:20px;">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="AlertsPage.changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>◀ Précédent</button>
              <button class="btn btn-secondary btn-sm" onclick="AlertsPage.changePage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Suivant ▶</button>
            </div>
        </div>
        ` : ''}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    if (window.updateAlertBadge) updateAlertBadge();
  },

  renderAlertCard(a) {
    const type = this.alertTypes[a.type] || { icon: 'info', label: a.type || 'Info', color: '#94A3B8', cls: 'badge-neutral' };
    const prio = this.priorityMap[a.priority] || this.priorityMap.medium;
    const isUnread = a.status === 'unread';
    const timeAgo = this.timeAgo(a.date);

    return `
      <div class="alert-card ${isUnread ? 'alert-card-unread' : 'alert-card-read'} alert-card-${a.priority || 'medium'}"
           data-alert-id="${a.id}">
        <div class="alert-card-priority-strip" style="background:${prio.color}"></div>
        <div class="alert-card-body">
          <div class="alert-card-top">
            <span class="badge ${type.cls} alert-card-type">
              <i data-lucide="${type.icon}"></i> ${type.label}
            </span>
            <span class="alert-card-time" title="${UI.formatDateTime(a.date)}">
              <i data-lucide="clock" style="width:12px;height:12px"></i> ${timeAgo}
            </span>
          </div>
          <div class="alert-card-message ${isUnread ? 'font-semibold' : ''}">${a.message || '—'}</div>
          ${a.productName ? `<div class="alert-card-product"><i data-lucide="pill" style="width:12px;height:12px"></i> ${a.productName}</div>` : ''}
          <div class="alert-card-bottom">
            <span class="alert-card-priority-badge ${prio.cls}">
              <i data-lucide="${prio.icon}" style="width:12px;height:12px"></i> ${prio.label}
            </span>
            <div class="alert-card-actions">
              ${isUnread ? `
                <button class="btn btn-xs btn-secondary" onclick="AlertsPage.dismiss(${a.id})" title="Marquer lu">
                  <i data-lucide="check"></i>
                </button>
              ` : `
                <button class="btn btn-xs btn-ghost" onclick="AlertsPage.deleteOne(${a.id})" title="Supprimer">
                  <i data-lucide="trash-2"></i>
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  timeAgo(ts) {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `il y a ${days}j`;
    if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
    return UI.formatDate(new Date(ts).toISOString());
  },

  // === Filter handlers ===
  onFilterChange() {
    this.filters.search = document.getElementById('alerts-search')?.value || '';
    this.filters.month = document.getElementById('alerts-month')?.value || '';
    this.filters.type = document.getElementById('alerts-type')?.value || 'all';
    this.filters.priority = document.getElementById('alerts-priority')?.value || 'all';
    this.filters.status = document.getElementById('alerts-status')?.value || 'unread';
    const container = document.getElementById('app-content');
    container.dataset.alertPage = '1';
    this.render(container);
  },

  quickFilter(key, value) {
    this.filters[key] = value;
    if (key === 'priority' && value !== 'all') {
      this.filters.status = 'unread'; // Show unread when filtering by priority
    }
    const container = document.getElementById('app-content');
    container.dataset.alertPage = '1';
    this.render(container);
  },

  clearFilters() {
    this.filters = { month: '', type: 'all', priority: 'all', status: 'unread', search: '' };
    const container = document.getElementById('app-content');
    container.dataset.alertPage = '1';
    this.render(container);
  },

  changePage(p) {
    const container = document.getElementById('app-content');
    container.dataset.alertPage = p;
    this.render(container);
  },

  // === Actions ===
  async dismiss(id) {
    const a = await DB.dbGet('alerts', id);
    if (a) {
      await DB.dbPut('alerts', { ...a, status: 'read' });
      // Animate card out
      const card = document.querySelector(`[data-alert-id="${id}"]`);
      if (card) {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => {
          const container = document.getElementById('app-content');
          this.render(container);
        }, 300);
      } else {
        const container = document.getElementById('app-content');
        this.render(container);
      }
    }
    if (window.updateAlertBadge) updateAlertBadge();
  },

  async markAllRead() {
    const allAlerts = await DB.dbGetAll('alerts');
    const unread = allAlerts.filter(a => a.status === 'unread');
    if (unread.length === 0) {
      UI.toast('Toutes les alertes sont déjà lues', 'info');
      return;
    }
    for (const a of unread) {
      await DB.dbPut('alerts', { ...a, status: 'read' });
    }
    UI.toast(`${unread.length} alerte(s) marquée(s) comme lue(s)`, 'success');
    if (window.updateAlertBadge) updateAlertBadge();
    const container = document.getElementById('app-content');
    this.render(container);
  },

  async deleteReadAlerts() {
    const allAlerts = await DB.dbGetAll('alerts');
    const readAlerts = allAlerts.filter(a => a.status === 'read');
    if (readAlerts.length === 0) {
      UI.toast('Aucune alerte lue à supprimer', 'info');
      return;
    }
    const ok = await UI.confirm(`Supprimer ${readAlerts.length} alerte(s) déjà lue(s) ?\n\nCette action est irréversible.`);
    if (!ok) return;

    for (const a of readAlerts) {
      await DB.dbDelete('alerts', a.id);
    }
    UI.toast(`${readAlerts.length} alerte(s) supprimée(s)`, 'success');
    const container = document.getElementById('app-content');
    this.render(container);
  },

  async deleteOne(id) {
    await DB.dbDelete('alerts', id);
    UI.toast('Alerte supprimée', 'success');
    const container = document.getElementById('app-content');
    this.render(container);
  },

  async exportCSV() {
    const allAlerts = await DB.dbGetAll('alerts');
    const filtered = this.getFilteredAlerts(allAlerts);
    if (filtered.length === 0) {
      UI.toast('Aucune alerte à exporter', 'warning');
      return;
    }

    const headers = ['Date', 'Type', 'Message', 'Produit', 'Priorité', 'Statut'];
    const rows = filtered.map(a => [
      UI.formatDateTime(a.date),
      (this.alertTypes[a.type] || {}).label || a.type,
      `"${(a.message || '').replace(/"/g, '""')}"`,
      a.productName || '',
      (this.priorityMap[a.priority] || {}).label || a.priority,
      a.status === 'unread' ? 'Non lu' : 'Lu',
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url = URL.createObjectURL(blob);
            </div>
          `).join('')}
        </div>
        
        ${totalPages > 1 ? `
        <div class="alerts-results-bar" style="display:flex; justify-content:center; align-items:center; margin-top:20px;">
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary btn-sm" onclick="AlertsPage.changePage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>◀ Précédent</button>
              <button class="btn btn-secondary btn-sm" onclick="AlertsPage.changePage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Suivant ▶</button>
            </div>
        </div>
        ` : ''}
      </div>
    `;

    if (window.lucide) lucide.createIcons();
    if (window.updateAlertBadge) updateAlertBadge();
  },

  renderAlertCard(a) {
    const type = this.alertTypes[a.type] || { icon: 'info', label: a.type || 'Info', color: '#94A3B8', cls: 'badge-neutral' };
    const prio = this.priorityMap[a.priority] || this.priorityMap.medium;
    const isUnread = a.status === 'unread';
    const timeAgo = this.timeAgo(a.date);

    return `
      <div class="alert-card ${isUnread ? 'alert-card-unread' : 'alert-card-read'} alert-card-${a.priority || 'medium'}"
           data-alert-id="${a.id}">
        <div class="alert-card-priority-strip" style="background:${prio.color}"></div>
        <div class="alert-card-body">
          <div class="alert-card-top">
            <span class="badge ${type.cls} alert-card-type">
              <i data-lucide="${type.icon}"></i> ${type.label}
            </span>
            <span class="alert-card-time" title="${UI.formatDateTime(a.date)}">
              <i data-lucide="clock" style="width:12px;height:12px"></i> ${timeAgo}
            </span>
          </div>
          <div class="alert-card-message ${isUnread ? 'font-semibold' : ''}">${a.message || '—'}</div>
          ${a.productName ? `<div class="alert-card-product"><i data-lucide="pill" style="width:12px;height:12px"></i> ${a.productName}</div>` : ''}
          <div class="alert-card-bottom">
            <span class="alert-card-priority-badge ${prio.cls}">
              <i data-lucide="${prio.icon}" style="width:12px;height:12px"></i> ${prio.label}
            </span>
            <div class="alert-card-actions">
              ${isUnread ? `
                <button class="btn btn-xs btn-secondary" onclick="AlertsPage.dismiss(${a.id})" title="Marquer lu">
                  <i data-lucide="check"></i>
                </button>
              ` : `
                <button class="btn btn-xs btn-ghost" onclick="AlertsPage.deleteOne(${a.id})" title="Supprimer">
                  <i data-lucide="trash-2"></i>
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  timeAgo(ts) {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `il y a ${days}j`;
    if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
    return UI.formatDate(new Date(ts).toISOString());
  },

  // === Filter handlers ===
  onFilterChange() {
    this.filters.search = document.getElementById('alerts-search')?.value || '';
    this.filters.month = document.getElementById('alerts-month')?.value || '';
    this.filters.type = document.getElementById('alerts-type')?.value || 'all';
    this.filters.priority = document.getElementById('alerts-priority')?.value || 'all';
    this.filters.status = document.getElementById('alerts-status')?.value || 'unread';
    const container = document.getElementById('app-content');
    container.dataset.alertPage = '1';
    this.render(container);
  },

  quickFilter(key, value) {
    this.filters[key] = value;
    if (key === 'priority' && value !== 'all') {
      this.filters.status = 'unread'; // Show unread when filtering by priority
    }
    const container = document.getElementById('app-content');
    container.dataset.alertPage = '1';
    this.render(container);
  },

  clearFilters() {
    this.filters = { month: '', type: 'all', priority: 'all', status: 'unread', search: '' };
    const container = document.getElementById('app-content');
    container.dataset.alertPage = '1';
    this.render(container);
  },

  changePage(p) {
    const container = document.getElementById('app-content');
    container.dataset.alertPage = p;
    this.render(container);
  },

  // === Actions ===
  async dismiss(id) {
    const a = await DB.dbGet('alerts', id);
    if (a) {
      await DB.dbPut('alerts', { ...a, status: 'read' });
      // Animate card out
      const card = document.querySelector(`[data-alert-id="${id}"]`);
      if (card) {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(20px)';
        setTimeout(() => {
          const container = document.getElementById('app-content');
          this.render(container);
        }, 300);
      } else {
        const container = document.getElementById('app-content');
        this.render(container);
      }
    }
    if (window.updateAlertBadge) updateAlertBadge();
  },

  async markAllRead() {
    const allAlerts = await DB.dbGetAll('alerts');
    const unread = allAlerts.filter(a => a.status === 'unread');
    if (unread.length === 0) {
      UI.toast('Toutes les alertes sont déjà lues', 'info');
      return;
    }
    for (const a of unread) {
      await DB.dbPut('alerts', { ...a, status: 'read' });
    }
    UI.toast(`${unread.length} alerte(s) marquée(s) comme lue(s)`, 'success');
    if (window.updateAlertBadge) updateAlertBadge();
    const container = document.getElementById('app-content');
    this.render(container);
  },

  async deleteReadAlerts() {
    const allAlerts = await DB.dbGetAll('alerts');
    const readAlerts = allAlerts.filter(a => a.status === 'read');
    if (readAlerts.length === 0) {
      UI.toast('Aucune alerte lue à supprimer', 'info');
      return;
    }
    const ok = await UI.confirm(`Supprimer ${readAlerts.length} alerte(s) déjà lue(s) ?\n\nCette action est irréversible.`);
    if (!ok) return;

    for (const a of readAlerts) {
      await DB.dbDelete('alerts', a.id);
    }
    UI.toast(`${readAlerts.length} alerte(s) supprimée(s)`, 'success');
    const container = document.getElementById('app-content');
    this.render(container);
  },

  async deleteOne(id) {
    await DB.dbDelete('alerts', id);
    UI.toast('Alerte supprimée', 'success');
    const container = document.getElementById('app-content');
    this.render(container);
  },

  async exportCSV() {
    const allAlerts = await DB.dbGetAll('alerts');
    const filtered = this.getFilteredAlerts(allAlerts);
    if (filtered.length === 0) {
      UI.toast('Aucune alerte à exporter', 'warning');
      return;
    }

    const headers = ['Date', 'Type', 'Message', 'Produit', 'Priorité', 'Statut'];
    const rows = filtered.map(a => [
      UI.formatDateTime(a.date),
      (this.alertTypes[a.type] || {}).label || a.type,
      `"${(a.message || '').replace(/"/g, '""')}"`,
      a.productName || '',
      (this.priorityMap[a.priority] || {}).label || a.priority,
      a.status === 'unread' ? 'Non lu' : 'Lu',
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alertes_OrdiveX_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.toast('Export téléchargé', 'success');
  }
};

window.AlertsPage = AlertsPage;
Router.register('alerts', (container) => AlertsPage.render(container));
