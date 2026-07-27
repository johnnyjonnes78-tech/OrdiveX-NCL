/**
 * OrdiveX — Intelligent Command Palette (Cmd+K)
 */

const CommandPalette = {
    isOpen: false,
    actions: [
        { id: 'new-sale', label: 'Nouvelle Vente', icon: '🛒', shortcut: 'S', action: () => Router.navigate('pos') },
        { id: 'view-dashboard', label: 'Tableau de Bord', icon: '📊', shortcut: 'D', action: () => Router.navigate('dashboard') },
        { id: 'manage-stock', label: 'Gérer le Stock', icon: '📦', shortcut: 'G', action: () => Router.navigate('stock') },
        { id: 'view-products', label: 'Catalogue Médicaments', icon: '💊', shortcut: 'C', action: () => Router.navigate('products') },
        { id: 'view-sales', label: 'Historique des Ventes', icon: '🧾', shortcut: 'H', action: () => Router.navigate('sales') },
        { id: 'view-alerts', label: 'Alertes Système', icon: '🔔', shortcut: 'A', action: () => Router.navigate('alerts') },
        { id: 'toggle-theme', label: 'Changer le Thème', icon: '🌓', shortcut: 'T', action: () => UI.toggleTheme() },
        { id: 'app-settings', label: 'Paramètres', icon: '⚙️', shortcut: ',', action: () => Router.navigate('settings') },
    ],

    init() {
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Handle clicks outside
        document.addEventListener('mousedown', (e) => {
            const palette = document.getElementById('command-palette');
            if (this.isOpen && palette && !palette.contains(e.target)) {
                this.close();
            }
        });
    },

    toggle() {
        this.isOpen ? this.close() : this.open();
    },

    open() {
        this.isOpen = true;
        this.render();
        document.getElementById('cp-search-input').focus();
    },

    close() {
        this.isOpen = false;
        const el = document.getElementById('cp-overlay');
        if (el) el.remove();
    },

    render() {
        const existing = document.getElementById('cp-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'cp-overlay';
        overlay.className = 'cp-overlay';
        overlay.innerHTML = `
      <div class="cp-modal" id="command-palette">
        <div class="cp-header">
          <span class="cp-search-icon">🔍</span>
          <input type="text" id="cp-search-input" placeholder="Tapez une commande ou recherchez..." autocomplete="off">
          <div class="cp-esc-badge"><kbd>ESC</kbd></div>
        </div>
        <div class="cp-results" id="cp-results">
          ${this.renderActions(this.actions)}
        </div>
        <div class="cp-footer">
          <div class="cp-hint">
            <span><kbd>↑↓</kbd> Naviguer</span>
            <span><kbd>↵</kbd> Sélectionner</span>
          </div>
        </div>
      </div>
    `;
        document.body.appendChild(overlay);

        const input = document.getElementById('cp-search-input');
        input.oninput = (e) => this.filter(e.target.value);
        input.onkeydown = (e) => this.handleNav(e);
    },

    renderActions(actions) {
        if (actions.length === 0) return '<div class="cp-no-results">Aucun résultat trouvé</div>';
        return actions.map((a, i) => `
      <div class="cp-item ${i === 0 ? 'active' : ''}" data-id="${a.id}" onclick="CommandPalette.execute('${a.id}')">
        <span class="cp-item-icon">${a.icon}</span>
        <span class="cp-item-label">${a.label}</span>
        ${a.shortcut ? `<span class="cp-item-shortcut"><kbd>${a.shortcut}</kbd></span>` : ''}
      </div>
    `).join('');
    },

    filter(query) {
        const q = query.toLowerCase();
        const filtered = this.actions.filter(a =>
            a.label.toLowerCase().includes(q) ||
            a.id.toLowerCase().includes(q)
        );
        const results = document.getElementById('cp-results');
        results.innerHTML = this.renderActions(filtered);
    },

    execute(id) {
        const action = this.actions.find(a => a.id === id);
        if (action) {
            action.action();
            this.close();
        }
    },

    handleNav(e) {
        const results = document.getElementById('cp-results');
        const items = results.querySelectorAll('.cp-item');
        let activeIdx = Array.from(items).findIndex(el => el.classList.contains('active'));

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            items[activeIdx].classList.remove('active');
            activeIdx = (activeIdx + 1) % items.length;
            items[activeIdx].classList.add('active');
            items[activeIdx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            items[activeIdx].classList.remove('active');
            activeIdx = (activeIdx - 1 + items.length) % items.length;
            items[activeIdx].classList.add('active');
            items[activeIdx].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const active = results.querySelector('.cp-item.active');
            if (active) this.execute(active.dataset.id);
        }
    }
};

window.CommandPalette = CommandPalette;
