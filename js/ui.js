/**
 * OrdiveX — UI Utilities
 */

const UI = {
  // ─── Devise dynamique — lit window._appSettings.currency ───
  getCurrency() {
    return (window._appSettings && window._appSettings['currency']) || 'GNF';
  },

  formatCurrency(amount) {
    const num = Math.round(amount || 0);
    const formatted = num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${formatted} ${this.getCurrency()}`;
  },

  normalizeText(str) {
    if (!str) return '';
    const trimmed = str.trim();
    if (!trimmed) return '';
    return trimmed.toLowerCase().replace(/(^|\s|[-'\/\(\)\.\,])(\S)/g, (m, sep, c) => sep + c.toUpperCase());
  },

  // ─── Format de date configurable — lit window._appSettings.date_format ───
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const fmt = (window._appSettings && window._appSettings['date_format']) || 'DD/MM/YYYY';
    if (fmt === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
    if (fmt === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
    return `${dd}/${mm}/${yyyy}`;
  },

  formatDateTime(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '—';
    const datePart = this.formatDate(d);
    const timePart = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} ${timePart}`;
  },

  daysUntilExpiry(dateStr) {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    const today = new Date();
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  },

  expiryBadge(dateStr) {
    const days = this.daysUntilExpiry(dateStr);
    if (days === null) return '';
    if (days < 0) return `<span class="badge badge-danger">Expiré</span>`;
    if (days <= 30) return `<span class="badge badge-danger">J-${days}</span>`;
    if (days <= 90) return `<span class="badge badge-warning">J-${days}</span>`;
    return `<span class="badge badge-success">${this.formatDate(dateStr)}</span>`;
  },

  stockBadge(qty, minStock, product = null) {
    let displayStr = qty;
    if (product && product.allowUnitSale && product.unitsPerBox > 1) {
      displayStr = `${Math.floor(qty / product.unitsPerBox)} bt ${qty % product.unitsPerBox} u`;
      minStock = minStock * product.unitsPerBox; // Optionnel : ajuster le test bas/rupture selon le seuil si exprimé en boîtes
    }
    if (qty === 0) return `<span class="badge badge-danger">Rupture</span>`;
    if (qty <= minStock) return `<span class="badge badge-warning">${displayStr} (bas)</span>`;
    return `<span class="badge badge-success">${displayStr}</span>`;
  },

  toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container') || (() => {
      const c = document.createElement('div');
      c.id = 'toast-container';
      document.body.appendChild(c);
      return c;
    })();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: 'check-circle', error: 'alert-circle', warning: 'alert-triangle', info: 'info' };
    toast.innerHTML = `<span class="toast-icon"><i data-lucide="${icons[type] || 'info'}"></i></span><span class="toast-msg">${message}</span>`;
    container.appendChild(toast);
    if (window.lucide) lucide.createIcons({ props: { size: 18 } });
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  },

  confirm(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box confirm-box">
          <div class="modal-icon"><i data-lucide="alert-triangle"></i></div>
          <p class="modal-msg">${message}</p>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="confirm-no">Annuler</button>
            <button class="btn btn-danger" id="confirm-yes">Confirmer</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      if (window.lucide) lucide.createIcons();
      document.getElementById('confirm-yes').onclick = () => { overlay.remove(); resolve(true); };
      document.getElementById('confirm-no').onclick = () => { overlay.remove(); resolve(false); };
    });
  },

  modal(title, contentHTML, options = {}) {
    const existing = document.getElementById('global-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'global-modal';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box ${options.size === 'large' ? 'modal-large' : ''}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" id="modal-close-btn">✕</button>
        </div>
        <div class="modal-body">${contentHTML}</div>
        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
      </div>`;
    document.body.appendChild(overlay);
    if (window.lucide) lucide.createIcons();
    document.getElementById('modal-close-btn').onclick = () => overlay.remove();
    if (options.onClose) overlay.addEventListener('click', e => { if (e.target === overlay) options.onClose(); });
    return overlay;
  },

  openModal(config) {
    let footer = config.footer || '';
    if (config.buttons && Array.isArray(config.buttons)) {
      footer = config.buttons.map(b => {
        let onClickAction = '';
        if (b.action === 'close') {
          onClickAction = "UI.closeModal()";
        } else if (typeof b.action === 'function') {
          const fnName = 'modal_btn_cb_' + Math.random().toString(36).slice(2, 9);
          window[fnName] = b.action;
          onClickAction = `window.${fnName}()`;
        } else if (typeof b.action === 'string') {
          onClickAction = b.action;
        }
        return `<button class="btn ${b.class || 'btn-secondary'}" onclick="${onClickAction}">${b.label}</button>`;
      }).join(' ');
    }
    return this.modal(config.title, config.body || config.contentHTML, {
      ...config,
      footer: footer
    });
  },

  closeModal() {
    const m = document.getElementById('global-modal');
    if (m) m.remove();
  },

  loading(container, message) {
    message = message || 'Chargement...';
    if (window._isBackgroundRefresh) return;
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>' + message + '</p></div>';
  },

  // ── LOADER GLOBAL PLEIN ECRAN ──
  // Affiche un overlay de chargement sur toute l app.
  // SECURITE : se ferme automatiquement apres 8s si hideLoader n est pas appele.
  _loaderTimer: null,
  _loaderDepth: 0,

  showLoader(message, timeoutMs) {
    message = message || 'Chargement...';
    timeoutMs = timeoutMs || 8000;
    this._loaderDepth++;

    var el = document.getElementById('global-loader-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-loader-overlay';
      el.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:99999',
        'background:rgba(0,0,0,0.55)', 'backdrop-filter:blur(3px)',
        'display:flex', 'flex-direction:column',
        'align-items:center', 'justify-content:center',
        'gap:16px', 'transition:opacity 0.2s'
      ].join(';');
      el.innerHTML =
        '<div style="width:44px;height:44px;border:4px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:spin-global 0.8s linear infinite"></div>' +
        '<p id="global-loader-msg" style="color:#fff;font-size:15px;font-weight:500;letter-spacing:0.02em;margin:0;text-align:center;max-width:240px"></p>';
      // Injecter le keyframe une seule fois
      if (!document.getElementById('global-loader-style')) {
        var st = document.createElement('style');
        st.id = 'global-loader-style';
        st.textContent = '@keyframes spin-global{to{transform:rotate(360deg)}}';
        document.head.appendChild(st);
      }
      document.body.appendChild(el);
    }

    var msgEl = document.getElementById('global-loader-msg');
    if (msgEl) msgEl.textContent = message;
    el.style.display = 'flex';

    // Fallback securite : auto-fermeture apres timeoutMs
    if (this._loaderTimer) clearTimeout(this._loaderTimer);
    var self = this;
    this._loaderTimer = setTimeout(function() {
      self._loaderDepth = 0;
      self.hideLoader(true);
    }, timeoutMs);
  },

  hideLoader(forced) {
    if (!forced) {
      this._loaderDepth = Math.max(0, this._loaderDepth - 1);
      if (this._loaderDepth > 0) return; // nested calls
    }
    if (this._loaderTimer) { clearTimeout(this._loaderTimer); this._loaderTimer = null; }
    this._loaderDepth = 0;
    var el = document.getElementById('global-loader-overlay');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 220);
  },

  empty(container, message = 'Aucune donnée', icon = 'package') {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="${icon}"></i></div><p>${message}</p></div>`;
    if (window.lucide) lucide.createIcons();
  },

  table(container, columns, rows, options) {
    options = options || {};
    if (!rows.length) {
      this.empty(container, options.emptyMessage || 'Aucun resultat', options.emptyIcon);
      return;
    }

    // Pagination : 50 lignes par defaut — previent les crashs sur gros volumes
    var pageSize = options.pageSize || 50;
    var isPaginated = options.paginate !== false && rows.length > pageSize;
    var currentPage = parseInt(container.dataset.page || '1');

    var totalPages = Math.ceil(rows.length / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var displayRows = rows;
    if (isPaginated) {
      var start = (currentPage - 1) * pageSize;
      displayRows = rows.slice(start, start + pageSize);
    }

    // ── DocumentFragment : construit le DOM hors-ecran, ZERO reflow intermediaire ──
    var frag = document.createDocumentFragment();

    var wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    var table = document.createElement('table');
    table.className = 'data-table';

    // THEAD
    var thead = document.createElement('thead');
    var theadRow = document.createElement('tr');
    for (var ci = 0; ci < columns.length; ci++) {
      var th = document.createElement('th');
      var labelVal = columns[ci].label || '';
      if (typeof labelVal === 'string' && (labelVal.includes('<') || labelVal.includes('&'))) {
        th.innerHTML = labelVal;
      } else {
        th.textContent = labelVal;
      }
      theadRow.appendChild(th);
    }
    thead.appendChild(theadRow);
    table.appendChild(thead);

    // TBODY via fragment interne
    var tbody = document.createElement('tbody');
    var tbodyFrag = document.createDocumentFragment();

    for (var ri = 0; ri < displayRows.length; ri++) {
      var row = displayRows[ri];
      var globalIdx = isPaginated ? ((currentPage - 1) * pageSize + ri) : ri;
      var tr = document.createElement('tr');
      if (options.onRowClick) {
        tr.className = 'clickable';
        tr.dataset.idx = globalIdx;
      }
      for (var cj = 0; cj < columns.length; cj++) {
        var col = columns[cj];
        var td = document.createElement('td');
        
        var labelClean = col.label || '';
        if (typeof labelClean === 'string' && labelClean.includes('<')) {
          labelClean = ''; // Pas de code HTML dans l'attribut responsive
        }
        td.setAttribute('data-label', labelClean);
        
        var val = typeof col.render === 'function' ? col.render(row, globalIdx) : (row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '-');
        // Seul innerHTML si la valeur contient du HTML (badges, etc)
        if (typeof val === 'string' && (val.includes('<') || val.includes('&'))) {
          td.innerHTML = val;
        } else {
          td.textContent = val;
        }
        tr.appendChild(td);
      }
      tbodyFrag.appendChild(tr);
    }
    tbody.appendChild(tbodyFrag);
    table.appendChild(tbody);
    wrapper.appendChild(table);
    frag.appendChild(wrapper);

    // Pagination
    if (isPaginated) {
      var pagDiv = document.createElement('div');
      pagDiv.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:16px 0;gap:12px;flex-wrap:wrap;';

      var info = document.createElement('span');
      info.style.cssText = 'font-size:13px;color:var(--text-muted)';
      info.textContent = rows.length.toLocaleString('fr-FR') + ' donnees - Page ' + currentPage + '/' + totalPages;
      pagDiv.appendChild(info);

      var btnWrap = document.createElement('div');
      btnWrap.style.cssText = 'display:flex;gap:8px;';

      var prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn-secondary btn-sm';
      prevBtn.textContent = '< Precedent';
      prevBtn.disabled = currentPage <= 1;
      prevBtn.onclick = function() { container.dataset.page = currentPage - 1; UI.table(container, columns, rows, options); };

      var nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn-secondary btn-sm';
      nextBtn.textContent = 'Suivant >';
      nextBtn.disabled = currentPage >= totalPages;
      nextBtn.onclick = function() { container.dataset.page = currentPage + 1; UI.table(container, columns, rows, options); };

      btnWrap.appendChild(prevBtn);
      btnWrap.appendChild(nextBtn);
      pagDiv.appendChild(btnWrap);
      frag.appendChild(pagDiv);
    }

    // Injection unique dans le DOM (1 seul reflow)
    container.innerHTML = '';
    container.appendChild(frag);

    // Listeners de clic sur lignes
    if (options.onRowClick) {
      tbody.querySelectorAll('tr[data-idx]').forEach(function(tr) {
        tr.onclick = function() { options.onRowClick(rows[parseInt(tr.dataset.idx)]); };
      });
    }

    if (window.lucide) lucide.createIcons({ root: container });
  },


  paymentMethodBadge(method) {
    const m = { cash: ['banknote', 'Espèces', 'badge-neutral'], orange_money: ['smartphone', 'Orange Money', 'badge-orange'], mtn_momo: ['smartphone', 'MTN MoMo', 'badge-yellow'], credit: ['file-clock', 'Crédit', 'badge-warning'], transfer: ['building-2', 'Virement', 'badge-info'] };
    const [icon, label, cls] = m[method] || ['help-circle', method, 'badge-neutral'];
    return `<span class="badge ${cls}"><i data-lucide="${icon}" style="width:12px;height:12px;margin-right:4px"></i> ${label}</span>`;
  },

  roleBadge(role) {
    const r = { admin: ['shield-alert', 'Administrateur', 'badge-danger'], pharmacien: ['user-check', 'Pharmacien', 'badge-success'], caissier: ['user', 'Caissier', 'badge-info'] };
    const [icon, label, cls] = r[role] || ['help-circle', role, 'badge-neutral'];
    return `<span class="badge ${cls}"><i data-lucide="${icon}" style="width:12px;height:12px;margin-right:4px"></i> ${label}</span>`;
  },

  /* ── Master Theme Management (Dark Mode) ── */
  initTheme() {
    const saved = localStorage.getItem('pharma-theme') || 'light';
    this.setTheme(saved);
  },

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('pharma-theme', theme);
    // Notify charts to re-render if needed
    window.dispatchEvent(new CustomEvent('themechanged', { detail: { theme } }));
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    this.setTheme(current === 'light' ? 'dark' : 'light');
  },

  getThemeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  },

  // ── Sync Monitoring (Intelligent) ──
  async openSyncMonitor() {
    var modal = document.getElementById('sync-monitor-modal');
    var list = document.getElementById('sync-monitor-list');
    document.getElementById('current-device-id-display').textContent = 'ID : ' + (DB.AppState.deviceId || localStorage.getItem('pharma_device_id') || '?');
    
    if (typeof window.updateNetworkStatus === 'function') window.updateNetworkStatus();
    list.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="spinner"></div><p>Analyse du réseau...</p></div>';
    modal.style.display = 'flex';

    if (window.NM ? !window.NM.isOnline() : !navigator.onLine) {
        list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);"><i data-lucide="wifi-off" style="width:40px;height:40px;margin-bottom:8px;"></i><p>Vous êtes hors ligne</p></div>';
        if (window.lucide) lucide.createIcons({ root: list });
        return;
    }

    try {
        var sb = await DB.getSupabaseClient();
        if (!sb) {
            // Distinguer entre hors-ligne réel et non configuré
            const settings = await DB.dbGetAll('settings');
            const url = settings.find(s => s.key === 'supabase_url')?.value;
            if (url) {
                throw new Error('Pas de connexion internet (Hors-ligne)');
            } else {
                throw new Error('Supabase non configuré');
            }
        }

        var res = await sb.from('settings').select('key, value').like('key', 'device_status_%');
        if (res.error) throw res.error;
        var data = res.data || [];

        // Parse tous les appareils
        var allDevices = [];
        data.forEach(function(row) {
            try {
                var s = JSON.parse(row.value);
                s._key = row.key;
                allDevices.push(s);
            } catch(e) {}
        });

        // Chaque appareil a un device_id unique (clé device_status_DEV_XXX)
        // Pas de déduplication par nom — chaque device_id est un appareil distinct
        var now = Date.now();
        var ACTIVE_THRESHOLD = 48 * 60 * 60 * 1000; // 48h

        // Filtrer : garder uniquement les appareils actifs (<48h)
        var devices = allDevices.filter(function(d) { return (now - d.last_sync) < ACTIVE_THRESHOLD; });

        // Trier : en ligne d'abord, puis par date
        devices.sort(function(a, b) {
            var aOnline = a.online && (now - a.last_sync < 3600000);
            var bOnline = b.online && (now - b.last_sync < 3600000);
            if (aOnline && !bOnline) return -1;
            if (!aOnline && bOnline) return 1;
            return b.last_sync - a.last_sync;
        });

        // Compteurs
        var activeDevices = devices;
        var onlineCount = 0;
        var pendingCount = 0;
        var hasAlerts = false;

        activeDevices.forEach(function(d) {
            if (d.online && (now - d.last_sync < 3600000)) onlineCount++;
            if (d.pending > 0) { pendingCount++; if (d.name !== (DB.AppState.deviceName || localStorage.getItem('pharma_device_name'))) hasAlerts = true; }
        });

        // SVG Icons professionnels
        var pcSvg = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
        var mobileSvg = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';

        // Résumé
        var summaryHtml = '<div style="display:flex; justify-content:space-around; padding:16px; margin-bottom:16px; background:linear-gradient(135deg, rgba(46,134,193,0.08), rgba(46,134,193,0.02)); border-radius:12px; border:1px solid var(--border);">'
           + '<div style="text-align:center;"><div style="font-size:2rem; font-weight:800; color:var(--primary);">' + activeDevices.length + '</div><div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Appareils</div></div>'
           + '<div style="width:1px; background:var(--border);"></div>'
           + '<div style="text-align:center;"><div style="font-size:2rem; font-weight:800; color:var(--success);">' + onlineCount + '</div><div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">En ligne</div></div>'
           + '<div style="width:1px; background:var(--border);"></div>'
           + '<div style="text-align:center;"><div style="font-size:2rem; font-weight:800; color:' + (pendingCount > 0 ? 'var(--warning)' : 'var(--text-muted)') + ';">' + pendingCount + '</div><div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">En attente</div></div>'
           + '</div>';

        // Liste des appareils
        var html = '';
        var _myDeviceId = localStorage.getItem('pharma_device_id');
        devices.forEach(function(status) {
            var isCurrent = status._key === ('device_status_' + _myDeviceId);
            var isActive = (now - status.last_sync) < ACTIVE_THRESHOLD;
            var isOnline = status.online && (now - status.last_sync < 3600000);
            var hasPending = status.pending > 0;

            if (!isActive) return; // Masquer les appareils inactifs >48h

            // Détection intelligente : type explicite OU déduction par le nom
            var nameLower = (status.name || '').toLowerCase();
            var isMobile = status.type === 'mobile' || /mobile|phone|smartphone|téléphone|android|iphone/i.test(nameLower);
            var icon = isMobile ? mobileSvg : pcSvg;
            var deviceLabel = isMobile ? '📱 Mobile' : '🖥️ Bureau';
            var iconColor = isOnline ? 'var(--primary)' : 'var(--text-muted)';
            var borderColor = hasPending ? 'var(--warning)' : (isOnline ? 'var(--success)' : '#ddd');

            var statusLabel = hasPending ? '<span style="color:var(--warning); font-weight:700;">' + status.pending + ' en attente</span>'
                            : (isOnline ? '<span style="color:var(--success); font-weight:600;">Synchronisé</span>'
                            : '<span style="color:var(--text-muted);">Hors ligne</span>');

            var timeDiff = now - status.last_sync;
            var timeAgo = '';
            if (timeDiff < 60000) timeAgo = 'À l\'instant';
            else if (timeDiff < 3600000) timeAgo = Math.floor(timeDiff / 60000) + ' min';
            else if (timeDiff < 86400000) timeAgo = Math.floor(timeDiff / 3600000) + 'h';
            else timeAgo = Math.floor(timeDiff / 86400000) + 'j';

            var pulseAnim = isOnline ? 'style="width:8px;height:8px;border-radius:50%;background:var(--success);box-shadow:0 0 0 0 rgba(34,197,94,0.4);animation:pulse 2s infinite;"' : 'style="width:8px;height:8px;border-radius:50%;background:#ccc;"';

            html += '<div style="display:flex; align-items:center; gap:14px; padding:14px 16px; background:var(--surface); border-radius:12px; border:1px solid var(--border); border-left:4px solid ' + borderColor + '; transition:all 0.2s;">'
               + '<div style="color:' + iconColor + '; flex-shrink:0;">' + icon + '</div>'
               + '<div style="flex:1; min-width:0;">'
               + '<div style="display:flex; align-items:center; gap:8px;">'
               + '<span style="font-weight:700; font-size:0.95rem;">' + status.name + '</span>'
               + (isCurrent ? '<span style="background:var(--primary); color:white; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:600;">VOUS</span>' : '')
               + '<div ' + pulseAnim + '></div>'
               + '</div>'
               + '<div style="display:flex; align-items:center; gap:12px; margin-top:4px; font-size:0.8rem; color:var(--text-muted);">'
               + '<span>' + deviceLabel + '</span>'
               + '<span>·</span>'
               + '<span>' + timeAgo + '</span>'
               + '<span>·</span>'
               + statusLabel
               + '</div>'
               + '</div>'
               + '</div>';
        });

        if (html === '') {
            html = '<div style="text-align:center; padding:30px; color:var(--text-muted);"><p>Aucun appareil actif détecté</p></div>';
        }

        // Nettoyer les entrées très anciennes (>7 jours) dans Supabase
        var STALE_THRESHOLD = 7 * 24 * 60 * 60 * 1000;
        var staleKeys = allDevices.filter(function(d) { return (now - d.last_sync) > STALE_THRESHOLD; });
        if (staleKeys.length > 0) {
            staleKeys.forEach(function(d) {
                sb.from('settings').delete().eq('key', d._key).then(function(){}).catch(function(){});
            });
        }

        // Pulse animation CSS
        var styleTag = '<style>@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}70%{box-shadow:0 0 0 6px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}</style>';

        // Bouton purge si doublons détectés
        var purgeHtml = '';
        if (devices.length > 1) {
          purgeHtml = '<div style="text-align:center; margin-top:12px; padding-top:12px; border-top:1px dashed var(--border);">'
            + '<button onclick="window._purgeOldDevices()" style="background:none; border:1px solid var(--danger); color:var(--danger); padding:6px 16px; border-radius:8px; cursor:pointer; font-size:0.8rem;">'
            + '🧹 Purger les anciens appareils (garder seulement le mien)'
            + '</button></div>';
        }

        list.innerHTML = styleTag + summaryHtml + html + purgeHtml;
        if (window.lucide) lucide.createIcons({ root: list });

        // Stocker les données pour la purge
        window._monitorAllDevices = allDevices;

        // Badge topbar
        var badge = document.getElementById('device-sync-badge');
        var iconEl = document.getElementById('device-sync-icon');
        if (badge && iconEl) {
           iconEl.style.color = hasAlerts ? 'var(--warning)' : 'var(--success)';
           badge.style.display = activeDevices.length > 0 ? 'inline-block' : 'none';
           badge.textContent = activeDevices.length;
           badge.style.background = hasAlerts ? 'var(--warning)' : 'var(--primary)';
        }

    } catch (e) {
        var isOffline = e.message.includes('Hors-ligne') || e.message.includes('offline');
        if (isOffline) {
            list.innerHTML = '<div style="padding:30px 20px; text-align:center; color:var(--text-muted);">'
                + '<div style="font-size:3rem; margin-bottom:12px; opacity:0.8;">📡</div>'
                + '<p style="font-weight:700; margin-bottom:6px; color:var(--text);">Pas de connexion internet</p>'
                + '<p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:20px; max-width:280px; margin-left:auto; margin-right:auto;">L\'application fonctionne localement sans perte de données. Vos modifications seront synchronisées dès le retour du réseau.</p>'
                + '<button onclick="window._retrySyncMonitor()" style="background:var(--primary); color:white; border:none; padding:8px 20px; border-radius:8px; cursor:pointer; font-size:0.85rem; font-weight:600; display:inline-flex; align-items:center; gap:8px;">'
                + '🔄 Réessayer la connexion'
                + '</button></div>';
        } else {
            list.innerHTML = '<div style="padding:20px; text-align:center; color:var(--danger);"><p>Erreur : ' + e.message + '</p></div>';
        }
    }
  }
};

window._retrySyncMonitor = function() {
  if (window.DB && window.DB.AppState) {
    window.DB.AppState._confirmedOffline = false;
  }
  if (typeof window.updateNetworkStatus === 'function') window.updateNetworkStatus();
  if (window.DB && typeof window.DB.pullFromSupabase === 'function') {
    window.DB.pullFromSupabase().catch(function(){});
  }
  UI.openSyncMonitor();
};

// Fonction de purge globale
window._purgeOldDevices = async function() {
  if (!confirm('Supprimer TOUS les appareils sauf le vôtre ?\nLes autres appareils réapparaîtront à leur prochaine connexion.')) return;
  try {
    var sb = await DB.getSupabaseClient();
    if (!sb) return;
    var myKey = 'device_status_' + (DB.AppState.deviceId || localStorage.getItem('pharma_device_id'));
    var allDevices = window._monitorAllDevices || [];
    var deleted = 0;
    for (var i = 0; i < allDevices.length; i++) {
      if (allDevices[i]._key !== myKey) {
        await sb.from('settings').delete().eq('key', allDevices[i]._key);
        deleted++;
      }
    }
    if (window.UI && UI.toast) UI.toast('🧹 ' + deleted + ' ancien(s) appareil(s) supprimé(s)', 'success');
    if (window.UI && UI.openSyncMonitor) UI.openSyncMonitor();
  } catch(e) {
    if (window.UI && UI.toast) UI.toast('Erreur : ' + e.message, 'danger');
  }
};

window.addEventListener('themechanged', () => {
  if (window.Router && Router.currentPage) {
    Router.render(Router.currentPage);
  }
});

// Chart utilities
const Charts = {
  bar(canvasId, labels, datasets, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const maxVal = Math.max(...datasets.flatMap(d => d.data));
    const w = canvas.width, h = canvas.height;
    const pad = { top: 50, right: 20, bottom: 50, left: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = UI.getThemeColor('--surface');
    ctx.fillRect(0, 0, w, h);

    const barW = Math.floor(chartW / labels.length * 0.6);
    const gap = chartW / labels.length;

    // Grid lines
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + chartH - (i / 5) * chartH;
      ctx.strokeStyle = UI.getThemeColor('--border');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '11px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * i / 5).toLocaleString('fr-FR'), pad.left - 8, y + 4);
    }

    // Bars + store positions for tooltips
    const barRects = [];
    datasets.forEach((dataset, di) => {
      const color = dataset.color || `hsl(${200 + di * 40}, 70%, 55%)`;
      dataset.data.forEach((val, i) => {
        const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
        const x = pad.left + gap * i + gap * 0.2 + di * (barW / datasets.length);
        const y = pad.top + chartH - barH;
        const bw = barW / datasets.length - 2;

        barRects.push({ x, y, w: bw, h: barH, val, label: labels[i] });

        const grad = ctx.createLinearGradient(0, y, 0, pad.top + chartH);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color + '88');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, barH, 3);
        ctx.fill();
      });
    });

    // Labels
    labels.forEach((label, i) => {
      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      const x = pad.left + gap * i + gap * 0.5;
      ctx.fillText(label.length > 8 ? label.substring(0, 8) + '..' : label, x, h - 10);
    });

    // Title
    if (options.title) {
      ctx.fillStyle = UI.getThemeColor('--text');
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(options.title, w / 2, 18);
    }

    // ── Tooltip hover (desktop only) ──
    if (!('ontouchstart' in window)) {
      Charts._addBarTooltip(canvas, barRects);
    }
  },

  donut(canvasId, labels, data, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w * 0.38, cy = h * 0.45; // Décentrer à gauche
    const R = Math.min(w, h) * 0.35; // Rayon optimal
    const r = R * 0.6;
    const total = data.reduce((a, b) => a + b, 0);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = UI.getThemeColor('--surface');
    ctx.fillRect(0, 0, w, h);

    if (total === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Aucune donnée', cx, cy);
      return;
    }

    let startAngle = -Math.PI / 2;
    data.forEach((val, i) => {
      const slice = (val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      startAngle += slice;
    });

    // Center hole
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = UI.getThemeColor('--surface'); // Match background
    ctx.fill();

    // Center text
    ctx.fillStyle = UI.getThemeColor('--text');
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(total.toLocaleString('fr-FR'), cx, cy + 5);
    ctx.font = '11px system-ui';
    ctx.fillStyle = UI.getThemeColor('--text-muted');
    ctx.fillText('Total', cx, cy + 20);

    // Legend (bottom)
    const legY = h - (Math.ceil(labels.length / 2) * 20) - 5;
    labels.forEach((label, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const lx = col === 0 ? w * 0.72 : w * 0.72; // Colonne unique à droite ou ajustée
      const ly = (h * 0.15) + i * 22; // Légende verticale à droite
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.roundRect(lx, ly - 9, 10, 10, 2);
      ctx.fill();
      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '500 10px system-ui';
      ctx.textAlign = 'left';
      const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : 0;
      ctx.fillText(`${label.substring(0, 15)} (${pct}%)`, lx + 15, ly);
    });

    // ── Tooltip hover (desktop only) ──
    if (!('ontouchstart' in window)) {
      const slices = labels.map((label, i) => ({ label, val: data[i] }));
      Charts._addDonutTooltip(canvas, slices, total);
    }
  },

  line(canvasId, labels, datasets, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const pad = { top: 50, right: 20, bottom: 45, left: 65 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const allVals = datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allVals, 1);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = UI.getThemeColor('--surface');
    ctx.fillRect(0, 0, w, h);

    // Grid
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + chartH - (i / 5) * chartH;
      ctx.strokeStyle = UI.getThemeColor('--border');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * i / 5).toLocaleString('fr-FR'), pad.left - 6, y + 3);
    }

    // Store point positions for tooltip
    const allPoints = [];
    datasets.forEach((dataset, di) => {
      const color = dataset.color || `hsl(${180 + di * 60}, 70%, 50%)`;
      const points = dataset.data.map((val, i) => ({
        x: pad.left + (i / (labels.length - 1)) * chartW,
        y: pad.top + chartH - (val / maxVal) * chartH,
        val, label: labels[i]
      }));
      allPoints.push(...points);

      // Area fill with custom gradient support
      ctx.beginPath();
      ctx.moveTo(points[0].x, pad.top + chartH);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
      ctx.closePath();
      if (dataset.gradient && dataset.gradient.length >= 2) {
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
        grad.addColorStop(0, dataset.gradient[0]);
        grad.addColorStop(1, dataset.gradient[1]);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = color + '22';
      }
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach((p, i) => {
        if (i > 0) {
          const cp = { x: (points[i - 1].x + p.x) / 2, y: (points[i - 1].y + p.y) / 2 };
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cp.x, cp.y);
        }
      });
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Points
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });

    // X labels
    labels.forEach((label, i) => {
      const x = pad.left + (i / (labels.length - 1)) * chartW;
      ctx.fillStyle = UI.getThemeColor('--text-muted');
      ctx.font = '10px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, h - 8);
    });

    if (options.title) {
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(options.title, w / 2, 18);
    }

    // ── Tooltip hover (desktop only) ──
    if (!('ontouchstart' in window)) {
      Charts._addLineTooltip(canvas, allPoints);
    }
  }
};

// ══════ Tooltip infrastructure (desktop only) ══════
Charts._tooltip = null;
Charts._getTooltip = function() {
  if (!Charts._tooltip) {
    const t = document.createElement('div');
    t.id = 'chart-tooltip';
    t.style.cssText = 'position:fixed;z-index:9999;background:rgba(9,26,50,0.92);color:#fff;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:600;pointer-events:none;opacity:0;transition:opacity 0.15s;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.2);font-family:Inter,system-ui,sans-serif;';
    document.body.appendChild(t);
    Charts._tooltip = t;
  }
  return Charts._tooltip;
};

Charts._addLineTooltip = function(canvas, points) {
  // Remove old listener
  if (canvas._chartMouseMove) canvas.removeEventListener('mousemove', canvas._chartMouseMove);
  if (canvas._chartMouseLeave) canvas.removeEventListener('mouseleave', canvas._chartMouseLeave);

  const scaleX = canvas.width / canvas.offsetWidth;
  const scaleY = canvas.height / canvas.offsetHeight;

  canvas._chartMouseMove = function(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    let closest = null, minDist = 20;
    for (const p of points) {
      const d = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2);
      if (d < minDist) { minDist = d; closest = p; }
    }
    const tip = Charts._getTooltip();
    if (closest) {
      tip.innerHTML = `<span style="color:#94a3b8">${closest.label}</span><br><strong>${UI.formatCurrency(closest.val)}</strong>`;
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top = (e.clientY - 40) + 'px';
      tip.style.opacity = '1';
      canvas.style.cursor = 'crosshair';
    } else {
      tip.style.opacity = '0';
      canvas.style.cursor = '';
    }
  };
  canvas._chartMouseLeave = function() {
    const tip = Charts._getTooltip();
    tip.style.opacity = '0';
    canvas.style.cursor = '';
  };
  canvas.addEventListener('mousemove', canvas._chartMouseMove);
  canvas.addEventListener('mouseleave', canvas._chartMouseLeave);
};

Charts._addDonutTooltip = function(canvas, slices, total) {
  if (canvas._chartMouseMove) canvas.removeEventListener('mousemove', canvas._chartMouseMove);
  if (canvas._chartMouseLeave) canvas.removeEventListener('mouseleave', canvas._chartMouseLeave);

  const scaleX = canvas.width / canvas.offsetWidth;
  const scaleY = canvas.height / canvas.offsetHeight;
  const w = canvas.width, h = canvas.height;
  const cx = w * 0.38, cy = h * 0.45;
  const R = Math.min(w, h) * 0.35;
  const r = R * 0.6;

  canvas._chartMouseMove = function(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const dx = mx - cx, dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const tip = Charts._getTooltip();
    if (dist >= r && dist <= R && total > 0) {
      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;
      let cumAngle = 0;
      for (const s of slices) {
        cumAngle += (s.val / total) * 2 * Math.PI;
        if (angle <= cumAngle) {
          const pct = ((s.val / total) * 100).toFixed(1);
          tip.innerHTML = `<span style="color:#94a3b8">${s.label}</span><br><strong>${UI.formatCurrency(s.val)}</strong> <span style="color:#64748b">(${pct}%)</span>`;
          tip.style.left = (e.clientX + 14) + 'px';
          tip.style.top = (e.clientY - 40) + 'px';
          tip.style.opacity = '1';
          canvas.style.cursor = 'pointer';
          return;
        }
      }
    }
    tip.style.opacity = '0';
    canvas.style.cursor = '';
  };
  canvas._chartMouseLeave = function() {
    Charts._getTooltip().style.opacity = '0';
    canvas.style.cursor = '';
  };
  canvas.addEventListener('mousemove', canvas._chartMouseMove);
  canvas.addEventListener('mouseleave', canvas._chartMouseLeave);
};

Charts._addBarTooltip = function(canvas, rects) {
  if (canvas._chartMouseMove) canvas.removeEventListener('mousemove', canvas._chartMouseMove);
  if (canvas._chartMouseLeave) canvas.removeEventListener('mouseleave', canvas._chartMouseLeave);

  const scaleX = canvas.width / canvas.offsetWidth;
  const scaleY = canvas.height / canvas.offsetHeight;

  canvas._chartMouseMove = function(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const tip = Charts._getTooltip();
    for (const r of rects) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        tip.innerHTML = `<span style="color:#94a3b8">${r.label}</span><br><strong>${UI.formatCurrency(r.val)}</strong>`;
        tip.style.left = (e.clientX + 14) + 'px';
        tip.style.top = (e.clientY - 40) + 'px';
        tip.style.opacity = '1';
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    tip.style.opacity = '0';
    canvas.style.cursor = '';
  };
  canvas._chartMouseLeave = function() {
    Charts._getTooltip().style.opacity = '0';
    canvas.style.cursor = '';
  };
  canvas.addEventListener('mousemove', canvas._chartMouseMove);
  canvas.addEventListener('mouseleave', canvas._chartMouseLeave);
};

window.UI = UI;
window.Charts = Charts;

// ═══════════════════════════════════════════════════════════════════
// PHASE 10 — AUTO-LOCK PIN SCREEN (Sécurité Caisse)
// Verrouille automatiquement l'app après inactivité
// L'utilisateur doit saisir son mot de passe pour déverrouiller
// ═══════════════════════════════════════════════════════════════════
(function() {
  let _isLocked = false;

  function _resetLockTimer() {
    // Désactivé : géré de manière configurable par SecurityLock dans security-lock.js
  }

  function _showLockScreen() {
    if (_isLocked) return;
    const user = window.DB?.AppState?.currentUser;
    if (!user) return;
    _isLocked = true;

    const firstName = (user.name || user.username || 'Utilisateur').split(' ')[0];
    const initials = firstName.charAt(0).toUpperCase();
    const overlay = document.createElement('div');
    overlay.id = 'pin-lock-overlay';
    overlay.innerHTML = `
      <div class="pin-lock-container">
        <div class="pin-lock-avatar">${initials}</div>
        <div class="pin-lock-name">${firstName}</div>
        <div class="pin-lock-subtitle">Session verrouillée par inactivité</div>
        <div class="pin-lock-input-wrap">
          <input type="password" id="pin-lock-input" class="pin-lock-input" placeholder="Mot de passe" autocomplete="off" />
        </div>
        <div id="pin-lock-error" class="pin-lock-error"></div>
        <button id="pin-lock-btn" class="pin-lock-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Déverrouiller
        </button>
        <button id="pin-lock-logout" class="pin-lock-logout">Changer d'utilisateur</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const inp = document.getElementById('pin-lock-input');
    const btn = document.getElementById('pin-lock-btn');
    const err = document.getElementById('pin-lock-error');
    const logoutBtn = document.getElementById('pin-lock-logout');

    setTimeout(() => inp?.focus(), 400);

    async function _tryUnlock() {
      const pwd = inp.value.trim();
      if (!pwd) { err.textContent = 'Veuillez saisir votre mot de passe'; return; }
      try {
        const users = await DB.dbGetAll('users');
        const match = users.find(u => u.id === user.id && u.password === pwd);
        if (match) {
          _isLocked = false;
          overlay.classList.remove('visible');
          setTimeout(() => overlay.remove(), 300);
          if (window.SecurityLock) window.SecurityLock.resetTimer();
          UI.toast('🔓 Session déverrouillée', 'success');
        } else {
          err.textContent = 'Mot de passe incorrect';
          inp.value = '';
          inp.focus();
          inp.classList.add('shake');
          setTimeout(() => inp.classList.remove('shake'), 500);
        }
      } catch (e) {
        err.textContent = 'Erreur : ' + e.message;
      }
    }

    btn.addEventListener('click', _tryUnlock);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') _tryUnlock(); });
    logoutBtn.addEventListener('click', () => {
      _isLocked = false;
      overlay.remove();
      if (window.Auth?.logout) window.Auth.logout();
      else window.location.reload();
    });
  }

  // Listen for activity
  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
    document.addEventListener(evt, _resetLockTimer, { passive: true });
  });

  // Start timer when login succeeds
  window.addEventListener('ordivex-login', _resetLockTimer);
  // Also reset on page navigation
  window.addEventListener('hashchange', _resetLockTimer);

  // Inject CSS
  const lockCSS = document.createElement('style');
  lockCSS.textContent = `
    #pin-lock-overlay {
      position: fixed; inset: 0; z-index: 99999;
      background: rgba(9,26,50,0.85);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.3s;
    }
    #pin-lock-overlay.visible { opacity: 1; }
    .pin-lock-container {
      text-align: center; padding: 48px 40px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 24px; width: 340px; max-width: 90vw;
    }
    .pin-lock-avatar {
      width: 72px; height: 72px; margin: 0 auto 16px;
      border-radius: 50%; font-size: 28px; font-weight: 800;
      background: linear-gradient(135deg, #2E86C1, #1a5276);
      color: #fff; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(46,134,193,0.3);
    }
    .pin-lock-name {
      color: #fff; font-size: 20px; font-weight: 700; margin-bottom: 4px;
    }
    .pin-lock-subtitle {
      color: rgba(255,255,255,0.5); font-size: 13px; margin-bottom: 28px;
    }
    .pin-lock-input-wrap { margin-bottom: 12px; }
    .pin-lock-input {
      width: 100%; padding: 14px 18px; border: 1.5px solid rgba(255,255,255,0.15);
      border-radius: 14px; background: rgba(255,255,255,0.08);
      color: #fff; font-size: 16px; text-align: center; outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      font-family: inherit; letter-spacing: 2px;
    }
    .pin-lock-input::placeholder { color: rgba(255,255,255,0.3); letter-spacing: 0; }
    .pin-lock-input:focus {
      border-color: #2E86C1; box-shadow: 0 0 0 3px rgba(46,134,193,0.2);
    }
    .pin-lock-input.shake {
      animation: pinShake 0.4s ease-in-out;
    }
    @keyframes pinShake {
      0%,100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      75% { transform: translateX(8px); }
    }
    .pin-lock-error {
      color: #f87171; font-size: 13px; min-height: 20px; margin-bottom: 8px;
    }
    .pin-lock-btn {
      width: 100%; padding: 14px; border: none; border-radius: 14px;
      background: linear-gradient(135deg, #2E86C1, #1a5276);
      color: #fff; font-size: 15px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      transition: transform 0.15s, box-shadow 0.2s;
      font-family: inherit;
    }
    .pin-lock-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(46,134,193,0.3); }
    .pin-lock-btn:active { transform: translateY(0); }
    .pin-lock-logout {
      background: none; border: none; color: rgba(255,255,255,0.4);
      font-size: 13px; cursor: pointer; margin-top: 20px; padding: 8px;
      transition: color 0.2s; font-family: inherit;
    }
    .pin-lock-logout:hover { color: rgba(255,255,255,0.7); }
  `;
  document.head.appendChild(lockCSS);

  // Expose for external trigger
  window._showLockScreen = _showLockScreen;
  window._resetLockTimer = _resetLockTimer;
})();
