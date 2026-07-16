// ═══════════════════════════════════════════════════════════════════════════
//  OrdiveX — Module Ressources Humaines v9.7.75
//  js/pages/hr.js
//  7 onglets : dashboard, employes, paie, avances, conges, presence, comptabilite
// ═══════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── Helpers ────────────────────────────────────────────────────────────
  const fmt = (n) => UI.formatCurrency(n);
  const fmtN = (n) => Number(n || 0).toLocaleString('fr-GN');
  const today = () => new Date().toISOString().slice(0, 10);
  const ym = () => new Date().toISOString().slice(0, 7);
  const initials = (s) => (s || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const dateLabel = (d) => d ? UI.formatDate(d) : '—';

  // ─── Pagination helper ─────────────────────────────────────────────────
  function paginateData(data, page, pageSize = 25) {
    const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    return { items: data.slice(start, start + pageSize), page: safePage, totalPages, total: data.length };
  }

  function renderPaginationBar(containerId, currentPage, totalPages, total, onPageChange) {
    if (totalPages <= 1) return '';
    const prevDisabled = currentPage <= 1 ? 'disabled' : '';
    const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
    // Store callback globally for onclick
    window['_hrPaginate_' + containerId] = onPageChange;
    return `<div class="pagination-bar" style="display:flex;align-items:center;justify-content:center;gap:10px;margin:12px 0;font-size:13px;">
      <button class="btn btn-xs btn-secondary" ${prevDisabled} onclick="_hrPaginate_${containerId}(${currentPage - 1})"><i data-lucide="chevron-left"></i></button>
      <span>Page <strong>${currentPage}</strong> / ${totalPages} — ${total} éléments</span>
      <button class="btn btn-xs btn-secondary" ${nextDisabled} onclick="_hrPaginate_${containerId}(${currentPage + 1})"><i data-lucide="chevron-right"></i></button>
    </div>`;
  }

  function gs(key) {
    return window._appSettings ? (window._appSettings[key] || '') : '';
  }

  // ─── Enregistrement de la route ─────────────────────────────────────────
  if (window.Router) {
    Router.register('hr', (container) => renderHR(container));
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  RENDER PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════
  async function renderHR(container) {
    container.innerHTML = `
      <div class="page-header" style="margin-bottom:20px">
        <div>
          <h1 class="page-title">Ressources Humaines</h1>
          <p class="page-subtitle" style="color:var(--text-muted);font-size:.85rem;margin-top:4px">
            Gestion du personnel, paie, congés et présence
          </p>
        </div>
      </div>

      <div class="hr-tabs" id="hr-tabs">
        <button class="hr-tab-btn active" onclick="hrSwitchTab('dashboard',this)" id="hr-btn-dashboard">
          <i data-lucide="layout-dashboard"></i> Tableau de Bord
        </button>
        <button class="hr-tab-btn" onclick="hrSwitchTab('employes',this)" id="hr-btn-employes">
          <i data-lucide="users"></i> Employés
        </button>
        <button class="hr-tab-btn" onclick="hrSwitchTab('paie',this)" id="hr-btn-paie">
          <i data-lucide="banknote"></i> Paie
        </button>
        <button class="hr-tab-btn" onclick="hrSwitchTab('avances',this)" id="hr-btn-avances">
          <i data-lucide="wallet"></i> Avances
        </button>
        <button class="hr-tab-btn" onclick="hrSwitchTab('conges',this)" id="hr-btn-conges">
          <i data-lucide="calendar-days"></i> Congés
        </button>
        <button class="hr-tab-btn" onclick="hrSwitchTab('presence',this)" id="hr-btn-presence">
          <i data-lucide="clock"></i> Présence
        </button>
        <button class="hr-tab-btn" onclick="hrSwitchTab('comptabilite',this)" id="hr-btn-comptabilite">
          <i data-lucide="line-chart"></i> Comptabilité RH
        </button>
      </div>

      <div id="hr-tab-content"></div>
    `;
    if (window.lucide) lucide.createIcons({ node: container });
    await hrRenderTab('dashboard');
  }

  window.hrSwitchTab = async function (tab, btn) {
    document.querySelectorAll('.hr-tab-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    await hrRenderTab(tab);
  };

  async function hrRenderTab(tab) {
    const c = document.getElementById('hr-tab-content');
    if (!c) return;
    c.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    try {
      switch (tab) {
        case 'dashboard':    await renderHRDashboard(c); break;
        case 'employes':     await renderEmployes(c); break;
        case 'paie':         await renderPaie(c); break;
        case 'avances':      await renderAvances(c); break;
        case 'conges':       await renderConges(c); break;
        case 'presence':     await renderPresence(c); break;
        case 'comptabilite': await renderComptabilite(c); break;
        default: c.innerHTML = '<p>Onglet inconnu</p>';
      }
    } catch (e) {
      c.innerHTML = `<div class="empty-state"><p style="color:var(--danger)">Erreur : ${e.message}</p></div>`;
      console.error('[HR]', e);
    }
    if (window.lucide) lucide.createIcons({ node: c });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 1 — TABLEAU DE BORD
  // ═══════════════════════════════════════════════════════════════════════
  async function renderHRDashboard(c) {
    const [rawEmployees, payroll, advances, leaves, attendance] = await Promise.all([
      DB.dbGetAll('users'),
      DB.dbGetAll('hr_payroll'),
      DB.dbGetAll('hr_advances'),
      DB.dbGetAll('hr_leaves'),
      DB.dbGetAll('hr_attendance'),
    ]);
    const employees = rawEmployees.map(e => ({
      ...e,
      nom: e.nom || e.name || e.username || '',
      status: e.status || (e.active !== false ? 'actif' : 'inactif')
    }));

    const actifs = employees.filter(e => e.status === 'actif');
    const periode = ym();
    const payMois = payroll.filter(p => p.period === periode);
    const masseSalariale = payMois.reduce((s, p) => s + (p.netAPayer || 0), 0);
    const avancesEnCours = advances.filter(a => a.status === 'approuvee' && a.solde > 0)
      .reduce((s, a) => s + (a.solde || 0), 0);
    const absencesMois = leaves.filter(l => {
      const d = l.dateDebut ? l.dateDebut.slice(0, 7) : '';
      return d === periode && (l.type === 'absence' || l.type === 'maladie');
    }).length;
    const congesMois = leaves.filter(l => l.dateDebut && l.dateDebut.slice(0, 7) === periode && l.type === 'conge').length;

    // Anniversaires ce mois
    const moisActuel = new Date().getMonth() + 1;
    const anniversaires = employees.filter(e => {
      if (!e.dateNaissance) return false;
      return parseInt(e.dateNaissance.slice(5, 7)) === moisActuel;
    });

    // Contrats expirant dans 30 jours
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const contratsExp = employees.filter(e => {
      if (!e.dateFinContrat) return false;
      const d = new Date(e.dateFinContrat);
      return d >= new Date() && d <= in30;
    });

    c.innerHTML = `
      <div class="hr-kpi-grid">
        <div class="hr-kpi-card blue">
          <div class="hr-kpi-icon blue"><i data-lucide="users" style="width:20px;height:20px"></i></div>
          <div class="hr-kpi-value">${actifs.length}</div>
          <div class="hr-kpi-label">Employés Actifs</div>
          <div class="hr-kpi-sub">${employees.length} au total</div>
        </div>
        <div class="hr-kpi-card green">
          <div class="hr-kpi-icon green"><i data-lucide="banknote" style="width:20px;height:20px"></i></div>
          <div class="hr-kpi-value" style="font-size:1.2rem">${fmt(masseSalariale)}</div>
          <div class="hr-kpi-label">Masse Salariale</div>
          <div class="hr-kpi-sub">${payMois.length} fiches ce mois</div>
        </div>
        <div class="hr-kpi-card orange">
          <div class="hr-kpi-icon orange"><i data-lucide="wallet" style="width:20px;height:20px"></i></div>
          <div class="hr-kpi-value" style="font-size:1.2rem">${fmt(avancesEnCours)}</div>
          <div class="hr-kpi-label">Avances en Cours</div>
          <div class="hr-kpi-sub">${advances.filter(a=>a.status==='approuvee'&&a.solde>0).length} dossiers</div>
        </div>
        <div class="hr-kpi-card red">
          <div class="hr-kpi-icon red"><i data-lucide="alert-circle" style="width:20px;height:20px"></i></div>
          <div class="hr-kpi-value">${absencesMois}</div>
          <div class="hr-kpi-label">Absences ce Mois</div>
          <div class="hr-kpi-sub">${congesMois} congés en cours</div>
        </div>
        <div class="hr-kpi-card purple">
          <div class="hr-kpi-icon purple"><i data-lucide="cake" style="width:20px;height:20px"></i></div>
          <div class="hr-kpi-value">${anniversaires.length}</div>
          <div class="hr-kpi-label">Anniversaires</div>
          <div class="hr-kpi-sub">Ce mois-ci</div>
        </div>
        <div class="hr-kpi-card teal">
          <div class="hr-kpi-icon teal"><i data-lucide="file-warning" style="width:20px;height:20px"></i></div>
          <div class="hr-kpi-value">${contratsExp.length}</div>
          <div class="hr-kpi-label">Contrats Expirant</div>
          <div class="hr-kpi-sub">Dans les 30 jours</div>
        </div>
      </div>

      ${anniversaires.length > 0 ? `
      <div class="card" style="margin-bottom:20px;padding:20px">
        <h3 style="font-size:.9rem;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px">
          <i data-lucide="cake"></i> Anniversaires ce mois
        </h3>
        <div style="display:flex;flex-wrap:wrap;gap:10px">
          ${anniversaires.map(e => `
            <div style="display:flex;align-items:center;gap:10px;background:var(--surface-alt);padding:8px 14px;border-radius:10px">
              <div class="hr-emp-avatar" style="width:36px;height:36px;font-size:.9rem">${initials(e.nom)}</div>
              <div>
                <div style="font-weight:600;font-size:.85rem">${e.nom}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${e.dateNaissance ? new Date(e.dateNaissance).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}) : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      ${contratsExp.length > 0 ? `
      <div class="card" style="padding:20px">
        <h3 style="font-size:.9rem;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px;color:#f59e0b">
          <i data-lucide="file-warning"></i> Contrats expirant bientôt
        </h3>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${contratsExp.map(e => {
            const jours = Math.ceil((new Date(e.dateFinContrat) - new Date()) / 86400000);
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:rgba(245,158,11,.05);border-radius:8px;border:1px solid rgba(245,158,11,.2)">
              <div>
                <div style="font-weight:600;font-size:.85rem">${e.nom}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${e.poste || '—'}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:.78rem;font-weight:700;color:#f59e0b">Expire dans ${jours} jours</div>
                <div style="font-size:.72rem;color:var(--text-muted)">${dateLabel(e.dateFinContrat)}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      ${employees.length === 0 ? `
      <div class="empty-state" style="margin-top:40px">
        <i data-lucide="users" style="width:48px;height:48px;color:var(--text-muted);margin-bottom:16px"></i>
        <h3>Aucun employé enregistré</h3>
        <p style="color:var(--text-muted);margin-bottom:16px">Commencez par ajouter vos employés dans l'onglet Employés</p>
        <button class="btn btn-primary" onclick="hrSwitchTab('employes',document.getElementById('hr-btn-employes'))">
          <i data-lucide="plus"></i> Ajouter un Employé
        </button>
      </div>` : ''}
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 2 — EMPLOYÉS
  // ═══════════════════════════════════════════════════════════════════════
  async function renderEmployes(c) {
    const [rawEmployees, leaves] = await Promise.all([
      DB.dbGetAll('users'),
      DB.dbGetAll('hr_leaves').catch(() => [])
    ]);

    const todayStr = new Date().toISOString().split('T')[0];
    const activeLeaves = leaves.filter(l => l.status === 'approuve' && l.dateDebut && l.dateFin && todayStr >= l.dateDebut && todayStr <= l.dateFin);
    const congeEmpIds = new Set(activeLeaves.map(l => Number(l.employeeId)));

    const employees = rawEmployees.map(e => {
      let st = e.status || (e.active !== false ? 'actif' : 'inactif');
      if (st === 'actif' && congeEmpIds.has(e.id)) {
        st = 'conge';
      }
      return {
        ...e,
        nom: e.nom || e.name || e.username || '',
        status: st
      };
    });
    let search = '';
    let filterStatus = '';
    let empPage = 1;

    function render() {
      let list = employees.filter(e => {
        const q = search.toLowerCase();
        const match = !q || (e.nom||'').toLowerCase().includes(q) || (e.poste||'').toLowerCase().includes(q) || (e.department||'').toLowerCase().includes(q);
        const stMatch = !filterStatus || e.status === filterStatus;
        return match && stMatch;
      });

      const pg = paginateData(list, empPage, 20);
      const pageItems = pg.items;

      const badgeClass = { actif:'emp-badge-actif', inactif:'emp-badge-inactif', conge:'emp-badge-conge', suspendu:'emp-badge-suspendu' };
      const badgeLabel = { actif:'Actif', inactif:'Inactif', conge:'En Congé', suspendu:'Suspendu' };

      c.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <div style="position:relative">
              <i data-lucide="search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--text-muted)"></i>
              <input id="emp-search" type="text" class="form-control" placeholder="Rechercher un employé..." style="padding-left:34px;min-width:220px" value="${search}" oninput="hrEmpSearch(this.value)">
            </div>
            <select class="form-control" onchange="hrEmpFilter(this.value)" style="min-width:140px">
              <option value="">Tous les statuts</option>
              <option value="actif" ${filterStatus==='actif'?'selected':''}>Actif</option>
              <option value="inactif" ${filterStatus==='inactif'?'selected':''}>Inactif</option>
              <option value="conge" ${filterStatus==='conge'?'selected':''}>En Congé</option>
              <option value="suspendu" ${filterStatus==='suspendu'?'selected':''}>Suspendu</option>
            </select>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" onclick="hrExportEmployesPDF()">
              <i data-lucide="file-text"></i> Exporter PDF
            </button>
            <button class="btn btn-primary" onclick="hrOpenEmployeForm()">
              <i data-lucide="user-plus"></i> Nouvel Employé
            </button>
          </div>
        </div>

        ${list.length === 0 ? `
          <div class="empty-state">
            <i data-lucide="users" style="width:40px;height:40px;color:var(--text-muted)"></i>
            <p style="margin-top:12px;color:var(--text-muted)">Aucun employé trouvé</p>
          </div>
        ` : `
          <div class="hr-employee-grid">
            ${pageItems.map(e => `
              <div class="hr-employee-card" onclick="hrOpenEmployeDetail(${e.id})">
                <div class="hr-emp-avatar">${e.photo ? `<img src="${e.photo}" alt="">` : initials(e.nom)}</div>
                <div class="hr-emp-info">
                  <div class="hr-emp-name">${e.nom}</div>
                  <div class="hr-emp-post">${e.poste || '—'} ${e.department ? '· '+e.department : ''}</div>
                  <div class="hr-emp-meta">
                    <span class="emp-badge ${badgeClass[e.status]||'emp-badge-inactif'}">${badgeLabel[e.status]||e.status}</span>
                    ${e.salaire ? `<span style="font-size:.72rem;color:var(--text-muted)">${fmt(e.salaire)}/mois</span>` : ''}
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px">
                  <button class="btn btn-icon btn-sm" title="Modifier" onclick="event.stopPropagation();hrOpenEmployeForm(${e.id})" style="width:32px;height:32px;padding:0">
                    <i data-lucide="pencil" style="width:14px;height:14px"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
          ${renderPaginationBar('emp', pg.page, pg.totalPages, pg.total, (p) => { empPage = p; render(); })}
        `}
      `;
      if (window.lucide) lucide.createIcons({ node: c });
    }

    window.hrEmpSearch = (v) => { search = v; empPage = 1; render(); };
    window.hrEmpFilter = (v) => { filterStatus = v; empPage = 1; render(); };
    render();
  }

  // ─── Formulaire Employé ─────────────────────────────────────────────────
  window.hrOpenEmployeForm = async function (id) {
    let emp = id ? await DB.dbGet('users', id) : {};
    if (emp) {
      emp = {
        ...emp,
        nom: emp.nom || emp.name || emp.username || '',
        status: emp.status || (emp.active !== false ? 'actif' : 'inactif')
      };
    }
    const e = emp || {};
    UI.openModal({
      title: id ? 'Modifier Employé / Utilisateur' : 'Nouvel Employé / Utilisateur',
      size: 'large',
      body: `
        <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group" style="grid-column:1/-1">
            <label>Nom complet <span style="color:var(--danger)">*</span></label>
            <input id="hr-emp-nom" class="form-control" type="text" value="${e.nom||''}" placeholder="Prénom NOM">
          </div>
          <div class="form-group">
            <label>Identifiant ERP (connexion) <span style="color:var(--danger)">*</span></label>
            <input id="hr-emp-username" class="form-control" type="text" value="${e.username||''}" ${id ? 'disabled' : ''} placeholder="Ex: jean.dupont">
          </div>
          <div class="form-group">
            <label>Rôle ERP <span style="color:var(--danger)">*</span></label>
            <select id="hr-emp-role" class="form-control" required>
              <option value="admin" ${e.role === 'admin' ? 'selected' : ''}>Administrateur</option>
              <option value="pharmacien" ${e.role === 'pharmacien' ? 'selected' : ''}>Pharmacien</option>
              <option value="caissier" ${e.role === 'caissier' ? 'selected' : ''}>Caissier</option>
            </select>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Mot de passe ERP ${id ? '(laisser vide pour ne pas modifier)' : '<span style="color:var(--danger)">*</span>'}</label>
            <input id="hr-emp-password" class="form-control" type="password" placeholder="${id ? '••••••••' : 'Saisir le mot de passe'}">
          </div>
          <div class="form-group">
            <label>Poste / Fonction</label>
            <input id="hr-emp-poste" class="form-control" type="text" value="${e.poste||''}" placeholder="Ex: Pharmacien, Caissier">
          </div>
          <div class="form-group">
            <label>Service / Département</label>
            <input id="hr-emp-dept" class="form-control" type="text" value="${e.department||''}" placeholder="Ex: Ventes, Administration">
          </div>
          <div class="form-group">
            <label>Date d'embauche</label>
            <input id="hr-emp-embauche" class="form-control" type="date" value="${e.dateEmbauche||''}">
          </div>
          <div class="form-group">
            <label>Date de naissance</label>
            <input id="hr-emp-naissance" class="form-control" type="date" value="${e.dateNaissance||''}">
          </div>
          <div class="form-group">
            <label>Salaire de base (GNF)</label>
            <input id="hr-emp-salaire" class="form-control" type="number" value="${e.salaire||''}" placeholder="0">
          </div>
          <div class="form-group">
            <label>Type de contrat</label>
            <select id="hr-emp-contrat" class="form-control">
              <option value="CDI" ${e.typeContrat==='CDI'?'selected':''}>CDI</option>
              <option value="CDD" ${e.typeContrat==='CDD'?'selected':''}>CDD</option>
              <option value="Stagiaire" ${e.typeContrat==='Stagiaire'?'selected':''}>Stagiaire</option>
              <option value="Freelance" ${e.typeContrat==='Freelance'?'selected':''}>Freelance</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date fin de contrat</label>
            <input id="hr-emp-fincontrat" class="form-control" type="date" value="${e.dateFinContrat||''}">
          </div>
          <div class="form-group">
            <label>Téléphone</label>
            <input id="hr-emp-tel" class="form-control" type="tel" value="${e.telephone||''}" placeholder="+224...">
          </div>
          <div class="form-group">
            <label>N° CNI / Pièce</label>
            <input id="hr-emp-cni" class="form-control" type="text" value="${e.cni||''}">
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Adresse</label>
            <input id="hr-emp-adresse" class="form-control" type="text" value="${e.adresse||''}">
          </div>
          <div class="form-group">
            <label>Personne à contacter</label>
            <input id="hr-emp-contact" class="form-control" type="text" value="${e.contactUrgence||''}">
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select id="hr-emp-status" class="form-control">
              <option value="actif" ${(e.status||'actif')==='actif'?'selected':''}>Actif</option>
              <option value="inactif" ${e.status==='inactif'?'selected':''}>Inactif</option>
              <option value="conge" ${e.status==='conge'?'selected':''}>En Congé</option>
              <option value="suspendu" ${e.status==='suspendu'?'selected':''}>Suspendu</option>
            </select>
          </div>
          <div class="form-group" style="grid-column:1/-1">
            <label>Notes / Observations</label>
            <textarea id="hr-emp-notes" class="form-control" rows="2">${e.notes||''}</textarea>
          </div>
        </div>
      `,
      buttons: [
        { label: 'Annuler', class: 'btn-secondary', action: 'close' },
        { label: id ? 'Enregistrer' : 'Créer', class: 'btn-primary', action: () => hrSaveEmploye(id) }
      ]
    });
  };

  window.hrSaveEmploye = async function (id) {
    const nom = document.getElementById('hr-emp-nom')?.value?.trim();
    if (!nom) { UI.toast('Le nom est obligatoire', 'error'); return; }

    let username = '';
    let role = document.getElementById('hr-emp-role')?.value || 'caissier';
    let password = document.getElementById('hr-emp-password')?.value;

    if (!id) {
      username = document.getElementById('hr-emp-username')?.value?.trim();
      if (!username) { UI.toast('L\'identifiant ERP est obligatoire', 'error'); return; }
      if (!password) { UI.toast('Le mot de passe ERP est obligatoire', 'error'); return; }
    }

    const normalizedNom = UI.normalizeText(nom);
    const data = {
      nom: normalizedNom,
      name: normalizedNom,
      poste: UI.normalizeText(document.getElementById('hr-emp-poste')?.value),
      department: UI.normalizeText(document.getElementById('hr-emp-dept')?.value),
      dateEmbauche: document.getElementById('hr-emp-embauche')?.value || '',
      dateNaissance: document.getElementById('hr-emp-naissance')?.value || '',
      salaire: parseFloat(document.getElementById('hr-emp-salaire')?.value) || 0,
      typeContrat: document.getElementById('hr-emp-contrat')?.value || 'CDI',
      dateFinContrat: document.getElementById('hr-emp-fincontrat')?.value || '',
      telephone: document.getElementById('hr-emp-tel')?.value?.trim() || '',
      cni: document.getElementById('hr-emp-cni')?.value?.trim() || '',
      adresse: UI.normalizeText(document.getElementById('hr-emp-adresse')?.value),
      contactUrgence: UI.normalizeText(document.getElementById('hr-emp-contact')?.value),
      status: document.getElementById('hr-emp-status')?.value || 'actif',
      active: (document.getElementById('hr-emp-status')?.value || 'actif') === 'actif',
      notes: document.getElementById('hr-emp-notes')?.value?.trim() || '',
      role,
      updatedAt: new Date().toISOString(),
    };

    if (id) {
      const existing = await DB.dbGet('users', id);
      if (!existing) { UI.toast('Utilisateur introuvable', 'error'); return; }
      data.id = id;
      data.username = existing.username;
      data.createdAt = existing.createdAt || data.updatedAt;
      if (password) {
        data.password = password;
      } else {
        data.password = existing.password;
      }
    } else {
      data.username = username;
      data.password = password;
      data.createdAt = data.updatedAt;
    }

    try {
      await DB.dbPut('users', data);
      await DB.writeAudit(id ? 'EDIT_USER' : 'ADD_USER', 'users', id || null, { name: data.name, username: data.username, role: data.role });
      UI.closeModal();
      UI.toast(id ? 'Personnel & Accès mis à jour' : 'Personnel créé avec succès', 'success');
      hrRenderTab('employes');
    } catch(err) {
      UI.toast('Erreur : ' + (err.message.includes('unique') ? 'Cet identifiant existe déjà' : err.message), 'error');
    }
  };

  // Helper pour lire les données RH du champ notes
  function getHRData(notesStr) {
    try {
      if (notesStr && notesStr.trim().startsWith('{')) {
        const data = JSON.parse(notesStr);
        return {
          textNotes: data.textNotes || '',
          contracts: data.contracts || [],
          evaluations: data.evaluations || [],
          sanctions: data.sanctions || [],
          documents: data.documents || []
        };
      }
    } catch(e) {}
    return {
      textNotes: notesStr || '',
      contracts: [],
      evaluations: [],
      sanctions: [],
      documents: []
    };
  }

  // Helper pour sauvegarder les données RH
  function saveHRData(oldNotesStr, updates) {
    const current = getHRData(oldNotesStr);
    const updated = { ...current, ...updates };
    return JSON.stringify(updated);
  }

  window.hrOpenEmployeDetail = async function (id, activeTab = 'general') {
    let rawE = await DB.dbGet('users', id);
    if (!rawE) return;
    const e = {
      ...rawE,
      nom: rawE.nom || rawE.name || rawE.username || '',
      status: rawE.status || (rawE.active !== false ? 'actif' : 'inactif')
    };

    const hrData = getHRData(e.notes);

    // Charger les avances et historique de paie
    const advances = (await DB.dbGetAll('hr_advances')).filter(a => a.employeeId === id);
    const payroll = (await DB.dbGetAll('hr_payroll')).filter(p => p.employeeId === id).slice(-6).reverse();
    const badgeClass = { actif:'emp-badge-actif', inactif:'emp-badge-inactif', conge:'emp-badge-conge', suspendu:'emp-badge-suspendu' };
    const badgeLabel = { actif:'Actif', inactif:'Inactif', conge:'En Congé', suspendu:'Suspendu' };

    // HTML des onglets
    const tabsHtml = `
      <div class="hr-tabs" style="margin-bottom:15px; border-bottom:1px solid var(--border)">
        <button class="hr-tab-btn ${activeTab==='general'?'active':''}" onclick="hrSwitchDetailTab(${id}, 'general')">Général</button>
        <button class="hr-tab-btn ${activeTab==='contracts'?'active':''}" onclick="hrSwitchDetailTab(${id}, 'contracts')">Contrats (${hrData.contracts.length})</button>
        <button class="hr-tab-btn ${activeTab==='evaluations'?'active':''}" onclick="hrSwitchDetailTab(${id}, 'evaluations')">Évaluations (${hrData.evaluations.length})</button>
        <button class="hr-tab-btn ${activeTab==='sanctions'?'active':''}" onclick="hrSwitchDetailTab(${id}, 'sanctions')">Sanctions (${hrData.sanctions.length})</button>
        <button class="hr-tab-btn ${activeTab==='documents'?'active':''}" onclick="hrSwitchDetailTab(${id}, 'documents')">Documents (${hrData.documents.length})</button>
      </div>
    `;

    let bodyHtml = tabsHtml;

    if (activeTab === 'general') {
      bodyHtml += `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
          <div><div class="payslip-emp-label">Poste</div><div class="payslip-emp-value">${e.poste||'—'}</div></div>
          <div><div class="payslip-emp-label">Service</div><div class="payslip-emp-value">${e.department||'—'}</div></div>
          <div><div class="payslip-emp-label">Date embauche</div><div class="payslip-emp-value">${dateLabel(e.dateEmbauche)}</div></div>
          <div><div class="payslip-emp-label">Contrat Actuel</div><div class="payslip-emp-value">${e.typeContrat||'—'} ${e.dateFinContrat ? '(jusqu\'au '+dateLabel(e.dateFinContrat)+')' : ''}</div></div>
          <div><div class="payslip-emp-label">Salaire de base</div><div class="payslip-emp-value">${fmt(e.salaire)}</div></div>
          <div><div class="payslip-emp-label">Statut</div><div class="payslip-emp-value"><span class="emp-badge ${badgeClass[e.status]||''}">${badgeLabel[e.status]||e.status}</span></div></div>
          <div><div class="payslip-emp-label">Téléphone</div><div class="payslip-emp-value">${e.telephone||'—'}</div></div>
          <div><div class="payslip-emp-label">CNI</div><div class="payslip-emp-value">${e.cni||'—'}</div></div>
        </div>
        ${advances.filter(a=>a.status==='approuvee'&&a.solde>0).length > 0 ? `
          <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:12px;margin-bottom:16px">
            <div style="font-weight:600;font-size:.85rem;color:#f59e0b;margin-bottom:4px">⚠ Avances en cours : ${fmt(advances.filter(a=>a.status==='approuvee'&&a.solde>0).reduce((s,a)=>s+(a.solde||0),0))}</div>
          </div>
        ` : ''}
        ${payroll.length > 0 ? `
          <h4 style="font-size:.85rem;font-weight:700;margin-bottom:8px">Derniers bulletins de paie</h4>
          <table class="hr-payroll-table" style="font-size:.8rem; margin-bottom:15px">
            <thead><tr><th>Période</th><th>Net à Payer</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              ${payroll.map(p => `
                <tr>
                  <td>${p.period||'—'}</td>
                  <td class="amount">${fmt(p.netAPayer)}</td>
                  <td><span class="emp-badge ${p.status==='paye'?'emp-badge-actif':'emp-badge-inactif'}">${p.status==='paye'?'Payé':'En attente'}</span></td>
                  <td><button class="btn btn-xs btn-secondary" onclick="hrPrintPayslip(${p.id})">PDF</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="color:var(--text-muted);font-size:.83rem;margin-bottom:15px">Aucun bulletin de paie enregistré.</p>'}
        ${hrData.textNotes ? `
          <div style="margin-top:16px;">
            <div class="payslip-emp-label">Notes de suivi</div>
            <div style="padding:12px;background:var(--surface-alt);border-radius:8px;font-size:.83rem;white-space:pre-line;">${hrData.textNotes}</div>
          </div>
        ` : ''}
      `;
    } else if (activeTab === 'contracts') {
      bodyHtml += `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h4 style="margin:0;font-size:.9rem;font-weight:700">Historique des Contrats</h4>
          <button class="btn btn-xs btn-primary" onclick="hrAddContractModal(${id})"><i data-lucide="plus"></i> Ajouter un contrat</button>
        </div>
        <table class="hr-payroll-table" style="font-size:.8rem">
          <thead><tr><th>Type</th><th>Début</th><th>Fin</th><th>Salaire de base</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            ${hrData.contracts.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Aucun contrat enregistré.</td></tr>' : ''}
            ${hrData.contracts.map(c => `
              <tr>
                <td><strong>${c.type}</strong></td>
                <td>${dateLabel(c.dateDebut)}</td>
                <td>${c.dateFin ? dateLabel(c.dateFin) : 'Indéterminé'}</td>
                <td class="amount">${fmt(c.salaire)}</td>
                <td><span class="emp-badge ${c.status==='actif'?'emp-badge-actif':'emp-badge-inactif'}">${c.status==='actif'?'Actif':'Terminé'}</span></td>
                <td>
                  <button class="btn btn-xs btn-danger" onclick="hrDeleteContract(${id}, ${c.id})"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'evaluations') {
      bodyHtml += `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h4 style="margin:0;font-size:.9rem;font-weight:700">Évaluations de performance</h4>
          <button class="btn btn-xs btn-primary" onclick="hrAddEvaluationModal(${id})"><i data-lucide="plus"></i> Nouvelle évaluation</button>
        </div>
        <table class="hr-payroll-table" style="font-size:.8rem">
          <thead><tr><th>Date</th><th>Note / Évaluation</th><th>Commentaires</th><th>Évaluateur</th><th>Actions</th></tr></thead>
          <tbody>
            ${hrData.evaluations.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Aucune évaluation enregistrée.</td></tr>' : ''}
            ${hrData.evaluations.map(ev => `
              <tr>
                <td>${dateLabel(ev.date)}</td>
                <td><span class="badge badge-success">${ev.rating}</span></td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis">${ev.comment || '—'}</td>
                <td>${ev.evaluator}</td>
                <td>
                  <button class="btn btn-xs btn-danger" onclick="hrDeleteEvaluation(${id}, ${ev.id})"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'sanctions') {
      bodyHtml += `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h4 style="margin:0;font-size:.9rem;font-weight:700">Mesures & Sanctions Disciplinaires</h4>
          <button class="btn btn-xs btn-primary" onclick="hrAddSanctionModal(${id})"><i data-lucide="plus"></i> Ajouter une sanction</button>
        </div>
        <table class="hr-payroll-table" style="font-size:.8rem">
          <thead><tr><th>Date</th><th>Type</th><th>Motif</th><th>Statut/Décision</th><th>Actions</th></tr></thead>
          <tbody>
            ${hrData.sanctions.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Aucune sanction disciplinaire.</td></tr>' : ''}
            ${hrData.sanctions.map(s => `
              <tr>
                <td>${dateLabel(s.date)}</td>
                <td><span class="badge badge-danger">${s.type}</span></td>
                <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis">${s.reason}</td>
                <td>${s.status || 'Appliquée'}</td>
                <td>
                  <button class="btn btn-xs btn-danger" onclick="hrDeleteSanction(${id}, ${s.id})"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'documents') {
      bodyHtml += `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <h4 style="margin:0;font-size:.9rem;font-weight:700">Documents numériques de l'employé</h4>
          <button class="btn btn-xs btn-primary" onclick="hrAddDocumentModal(${id})"><i data-lucide="plus"></i> Ajouter un document</button>
        </div>
        <table class="hr-payroll-table" style="font-size:.8rem">
          <thead><tr><th>Nom du document</th><th>Lien / Fichier</th><th>Ajouté le</th><th>Actions</th></tr></thead>
          <tbody>
            ${hrData.documents.length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Aucun document enregistré.</td></tr>' : ''}
            ${hrData.documents.map(d => `
              <tr>
                <td><strong>${d.name}</strong></td>
                <td><a href="${d.url}" target="_blank" class="text-primary" style="text-decoration:underline"><i data-lucide="external-link" style="width:12px;height:12px"></i> Consulter</a></td>
                <td>${dateLabel(d.dateAdded)}</td>
                <td>
                  <button class="btn btn-xs btn-danger" onclick="hrDeleteDocument(${id}, ${d.id})"><i data-lucide="trash-2" style="width:12px;height:12px"></i></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    UI.openModal({
      title: `Dossier Individuel — ${e.nom}`,
      size: 'large',
      body: bodyHtml,
      buttons: [
        { label: 'Fermer', class: 'btn-secondary', action: 'close' },
        { label: 'Modifier Fiche', class: 'btn-primary', action: () => { UI.closeModal(); hrOpenEmployeForm(id); } }
      ]
    });
    if (window.lucide) lucide.createIconsGlobal ? lucide.createIconsGlobal() : lucide.createIcons();
  };

  // Switch d'onglets dans le détail
  window.hrSwitchDetailTab = function (id, tab) {
    UI.closeModal();
    hrOpenEmployeDetail(id, tab);
  };

  // Modals d'ajout de données RH complexes
  window.hrAddContractModal = function (employeeId) {
    UI.openModal({
      title: 'Nouveau Contrat',
      body: `
        <div class="form-grid">
          <div class="form-group">
            <label>Type de contrat</label>
            <select id="new-c-type" class="form-control">
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="Stagiaire">Stagiaire</option>
              <option value="Freelance">Freelance</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date de début</label>
            <input type="date" id="new-c-debut" class="form-control" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="form-group">
            <label>Date de fin (CDD)</label>
            <input type="date" id="new-c-fin" class="form-control">
          </div>
          <div class="form-group">
            <label>Salaire de base (GNF)</label>
            <input type="number" id="new-c-salaire" class="form-control" placeholder="0">
          </div>
          <div class="form-group">
            <label>Statut</label>
            <select id="new-c-status" class="form-control">
              <option value="actif">Actif</option>
              <option value="termine">Terminé</option>
            </select>
          </div>
        </div>
      `,
      buttons: [
        { label: 'Annuler', class: 'btn-secondary', action: () => hrOpenEmployeDetail(employeeId, 'contracts') },
        { label: 'Ajouter', class: 'btn-primary', action: () => hrSaveNewContract(employeeId) }
      ]
    });
  };

  window.hrSaveNewContract = async function (employeeId) {
    const type = document.getElementById('new-c-type').value;
    const dateDebut = document.getElementById('new-c-debut').value;
    const dateFin = document.getElementById('new-c-fin').value;
    const salaire = parseFloat(document.getElementById('new-c-salaire').value) || 0;
    const status = document.getElementById('new-c-status').value;

    if (!dateDebut) { UI.toast('La date de début est obligatoire', 'error'); return; }

    const rawE = await DB.dbGet('users', employeeId);
    if (!rawE) return;

    const hrData = getHRData(rawE.notes);
    const newId = Date.now();
    hrData.contracts.push({ id: newId, type, dateDebut, dateFin, salaire, status });

    rawE.notes = JSON.stringify(hrData);
    await DB.dbPut('users', rawE);
    UI.toast('Contrat ajouté avec succès', 'success');
    hrOpenEmployeDetail(employeeId, 'contracts');
  };

  window.hrDeleteContract = async function (employeeId, contractId) {
    if (!confirm('Supprimer ce contrat de l\'historique ?')) return;
    const rawE = await DB.dbGet('users', employeeId);
    if (!rawE) return;
    const hrData = getHRData(rawE.notes);
    hrData.contracts = hrData.contracts.filter(c => c.id !== contractId);
    rawE.notes = JSON.stringify(hrData);
    await DB.dbPut('users', rawE);
    UI.toast('Contrat supprimé', 'success');
    hrOpenEmployeDetail(employeeId, 'contracts');
  };

  // Évaluations
  window.hrAddEvaluationModal = function (employeeId) {
    UI.openModal({
      title: 'Nouvelle Évaluation',
      body: `
        <div class="form-grid">
          <div class="form-group">
            <label>Date de l'évaluation</label>
            <input type="date" id="new-ev-date" class="form-control" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="form-group">
            <label>Note / Évaluation globale</label>
            <select id="new-ev-rating" class="form-control">
              <option value="Excellent (A)">Excellent (A)</option>
              <option value="Très Bon (B)">Très Bon (B)</option>
              <option value="Satisfaisant (C)">Satisfaisant (C)</option>
              <option value="Insuffisant (D)">Insuffisant (D)</option>
            </select>
          </div>
          <div class="form-group" style="grid-column: 1/-1">
            <label>Commentaires détaillés</label>
            <textarea id="new-ev-comment" class="form-control" rows="3" placeholder="Points forts, axes d'amélioration..."></textarea>
          </div>
          <div class="form-group">
            <label>Évaluateur</label>
            <input type="text" id="new-ev-evaluator" class="form-control" placeholder="Nom de l'évaluateur">
          </div>
        </div>
      `,
      buttons: [
        { label: 'Annuler', class: 'btn-secondary', action: () => hrOpenEmployeDetail(employeeId, 'evaluations') },
        { label: 'Enregistrer', class: 'btn-primary', action: () => hrSaveNewEvaluation(employeeId) }
      ]
    });
  };

  window.hrSaveNewEvaluation = async function (employeeId) {
    const date = document.getElementById('new-ev-date').value;
    const rating = document.getElementById('new-ev-rating').value;
    const comment = document.getElementById('new-ev-comment').value.trim();
    const evaluator = document.getElementById('new-ev-evaluator').value.trim() || 'Directeur';

    if (!date) { UI.toast('La date est obligatoire', 'error'); return; }

    const rawE = await DB.dbGet('users', employeeId);
    if (!rawE) return;

    const hrData = getHRData(rawE.notes);
    hrData.evaluations.push({ id: Date.now(), date, rating, comment, evaluator });

    rawE.notes = JSON.stringify(hrData);
    await DB.dbPut('users', rawE);
    UI.toast('Évaluation enregistrée', 'success');
    hrOpenEmployeDetail(employeeId, 'evaluations');
  };

  window.hrDeleteEvaluation = async function (employeeId, evId) {
    if (!confirm('Supprimer cette évaluation ?')) return;
    const rawE = await DB.dbGet('users', employeeId);
    if (!rawE) return;
    const hrData = getHRData(rawE.notes);
    hrData.evaluations = hrData.evaluations.filter(e => e.id !== evId);
    rawE.notes = JSON.stringify(hrData);
    await DB.dbPut('users', rawE);
    UI.toast('Évaluation supprimée', 'success');
    hrOpenEmployeDetail(employeeId, 'evaluations');
  };

  // Sanctions
  window.hrAddSanctionModal = function (employeeId) {
    UI.openModal({
      title: 'Déclarer une mesure disciplinaire',
      body: `
        <div class="form-grid">
          <div class="form-group">
            <label>Date de l'incident / décision</label>
            <input type="date" id="new-s-date" class="form-control" value="${new Date().toISOString().slice(0,10)}">
          </div>
          <div class="form-group">
            <label>Type de sanction</label>
            <select id="new-s-type" class="form-control">
              <option value="Avertissement verbal">Avertissement verbal</option>
              <option value="Avertissement écrit">Avertissement écrit</option>
              <option value="Blâme">Blâme</option>
              <option value="Mise à pied temporaire">Mise à pied temporaire</option>
              <option value="Licenciement">Licenciement</option>
            </select>
          </div>
          <div class="form-group" style="grid-column: 1/-1">
            <label>Motif de la sanction</label>
            <textarea id="new-s-reason" class="form-control" rows="3" placeholder="Détaillez les faits reprochés..."></textarea>
          </div>
          <div class="form-group">
            <label>Statut / Mesure prise</label>
            <input type="text" id="new-s-status" class="form-control" placeholder="Ex: Appliquée, En attente de signature">
          </div>
        </div>
      `,
      buttons: [
        { label: 'Annuler', class: 'btn-secondary', action: () => hrOpenEmployeDetail(employeeId, 'sanctions') },
        { label: 'Appliquer', class: 'btn-primary', action: () => hrSaveNewSanction(employeeId) }
      ]
    });
  };

  window.hrSaveNewSanction = async function (employeeId) {
    const date = document.getElementById('new-s-date').value;
    const type = document.getElementById('new-s-type').value;
    const reason = document.getElementById('new-s-reason').value.trim();
    const status = document.getElementById('new-s-status').value.trim() || 'Appliquée';

    if (!date || !reason) { UI.toast('La date et le motif sont obligatoires', 'error'); return; }

    const rawE = await DB.dbGet('users', employeeId);
    if (!rawE) return;

    const hrData = getHRData(rawE.notes);
    hrData.sanctions.push({ id: Date.now(), date, type, reason, status });

    rawE.notes = JSON.stringify(hrData);
    await DB.dbPut('users', rawE);
    UI.toast('Mesure disciplinaire enregistrée', 'success');
    hrOpenEmployeDetail(employeeId, 'sanctions');
  };

  window.hrDeleteSanction = async function (employeeId, sId) {
    if (!confirm('Supprimer cette sanction ?')) return;
    const rawE = await DB.dbGet('users', employeeId);
    if (!rawE) return;
    const hrData = getHRData(rawE.notes);
    hrData.sanctions = hrData.sanctions.filter(s => s.id !== sId);
    rawE.notes = JSON.stringify(hrData);
    await DB.dbPut('users', rawE);
    UI.toast('Sanction supprimée', 'success');
    hrOpenEmployeDetail(employeeId, 'sanctions');
  };

  // Documents
  window.hrAddDocumentModal = function (employeeId) {
    UI.openModal({
      title: 'Attacher un Document',
      body: `
        <div class="form-grid">
          <div class="form-group" style="grid-column: 1/-1">
            <label>Nom du document</label>
            <input type="text" id="new-d-name" class="form-control" placeholder="Ex: Copie de la CNI, Contrat signé, Diplôme">
          </div>
          <div class="form-group" style="grid-column: 1/-1">
            <label>Lien ou URL du document (Google Drive, Dropbox, Cloud...)</label>
            <input type="url" id="new-d-url" class="form-control" placeholder="https://drive.google.com/...">
          </div>
        </div>
      `,
      buttons: [
        { label: 'Annuler', class: 'btn-secondary', action: () => hrOpenEmployeDetail(employeeId, 'documents') },
        { label: 'Ajouter', class: 'btn-primary', action: () => hrSaveNewDocument(employeeId) }
      ]
    });
  };

  window.hrSaveNewDocument = async function (employeeId) {
    const name = document.getElementById('new-d-name').value.trim();
    const url = document.getElementById('new-d-url').value.trim();

    if (!name || !url) { UI.toast('Tous les champs sont obligatoires', 'error'); return; }

    const rawE = await DB.dbGet('users', employeeId);
    if (!rawE) return;

    const hrData = getHRData(rawE.notes);
    hrData.documents.push({ id: Date.now(), name, url, dateAdded: new Date().toISOString().slice(0,10) });

    rawE.notes = JSON.stringify(hrData);
    await DB.dbPut('users', rawE);
    UI.toast('Document enregistré', 'success');
    hrOpenEmployeDetail(employeeId, 'documents');
  };

  window.hrDeleteDocument = async function (employeeId, dId) {
    if (!confirm('Supprimer ce document ?')) return;
    const rawE = await DB.dbGet('users', employeeId);
    if (!rawE) return;
    const hrData = getHRData(rawE.notes);
    hrData.documents = hrData.documents.filter(d => d.id !== dId);
    rawE.notes = JSON.stringify(hrData);
    await DB.dbPut('users', rawE);
    UI.toast('Document supprimé', 'success');
    hrOpenEmployeDetail(employeeId, 'documents');
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 3 — PAIE
  // ═══════════════════════════════════════════════════════════════════════
  async function renderPaie(c) {
    const [rawEmployees, payroll, leaves] = await Promise.all([
      DB.dbGetAll('users'),
      DB.dbGetAll('hr_payroll'),
      DB.dbGetAll('hr_leaves').catch(() => [])
    ]);
    const todayStr = new Date().toISOString().split('T')[0];
    const activeLeaves = leaves.filter(l => l.status === 'approuve' && l.dateDebut && l.dateFin && todayStr >= l.dateDebut && todayStr <= l.dateFin);
    const congeEmpIds = new Set(activeLeaves.map(l => Number(l.employeeId)));

    const employees = rawEmployees.map(e => {
      let st = e.status || (e.active !== false ? 'actif' : 'inactif');
      if (st === 'actif' && congeEmpIds.has(e.id)) {
        st = 'conge';
      }
      return {
        ...e,
        nom: e.nom || e.name || e.username || '',
        status: st
      };
    });
    const actifs = employees.filter(e => e.status === 'actif' || e.status === 'conge');
    let selectedPeriod = ym();
    let paiePage = 1;

    function render() {
      const fiches = payroll.filter(p => p.period === selectedPeriod);
      const ficheMap = new Map(fiches.map(f => [f.employeeId, f]));
      const totalNet = fiches.reduce((s, f) => s + (f.netAPayer || 0), 0);
      const totalPaye = fiches.filter(f => f.status === 'paye').reduce((s, f) => s + (f.netAPayer || 0), 0);

      c.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:10px">
            <label style="font-weight:600;font-size:.9rem">Période :</label>
            <input type="month" class="form-control" style="width:180px" value="${selectedPeriod}" onchange="hrPayPeriod(this.value)">
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" onclick="hrGenerateFiches('${selectedPeriod}')">
              <i data-lucide="refresh-cw"></i> Générer les fiches
            </button>
            <button class="btn btn-primary" onclick="hrPayerTout('${selectedPeriod}')">
              <i data-lucide="check-circle"></i> Payer tout le monde
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
          <div class="card" style="padding:16px;text-align:center">
            <div style="font-size:1.3rem;font-weight:800;color:var(--primary)">${fmt(totalNet)}</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:4px">Masse salariale totale</div>
          </div>
          <div class="card" style="padding:16px;text-align:center">
            <div style="font-size:1.3rem;font-weight:800;color:#10b981">${fmt(totalPaye)}</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:4px">Déjà payé</div>
          </div>
          <div class="card" style="padding:16px;text-align:center">
            <div style="font-size:1.3rem;font-weight:800;color:#ef4444">${fmt(totalNet - totalPaye)}</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:4px">Reste à payer</div>
          </div>
        </div>

        <div class="card" style="overflow:auto">
          <table class="hr-payroll-table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Salaire Base</th>
                <th>Primes</th>
                <th>H.Sup</th>
                <th>Retenues</th>
                <th>Avances</th>
                <th>Net à Payer</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${actifs.length === 0 ? `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">Aucun employé actif</td></tr>` : ''}
              ${(() => { const pgP = paginateData(actifs, paiePage, 25); return pgP.items.map(emp => {
                const fiche = ficheMap.get(emp.id) || {};
                const base = fiche.salaire ?? emp.salaire ?? 0;
                const primes = fiche.primes || 0;
                const hsup = fiche.heuresSup || 0;
                const retenues = fiche.retenues || 0;
                const avances = fiche.avancesDed || 0;
                const net = fiche.netAPayer ?? Math.max(0, base + primes + hsup - retenues - avances);
                const paye = fiche.status === 'paye';
                return `
                  <tr>
                    <td><div style="font-weight:600;font-size:.85rem">${emp.nom}</div><div style="font-size:.72rem;color:var(--text-muted)">${emp.poste||'—'}</div></td>
                    <td class="amount">${fmtN(base)}</td>
                    <td class="amount amount-positive">${fmtN(primes)}</td>
                    <td class="amount amount-positive">${fmtN(hsup)}</td>
                    <td class="amount amount-negative">-${fmtN(retenues)}</td>
                    <td class="amount amount-negative">-${fmtN(avances)}</td>
                    <td class="amount amount-net">${fmt(net)}</td>
                    <td><span class="emp-badge ${paye?'emp-badge-actif':'emp-badge-inactif'}">${paye?'Payé':'En attente'}</span></td>
                    <td style="white-space:nowrap;display:flex;gap:4px">
                      <button class="btn btn-sm btn-secondary" onclick="hrEditFiche(${emp.id},'${selectedPeriod}')" title="Modifier"><i data-lucide="pencil" style="width:13px;height:13px"></i></button>
                      ${!paye ? `<button class="btn btn-sm btn-primary" onclick="hrPayerEmploye(${emp.id},'${selectedPeriod}',${net})" title="Marquer payé"><i data-lucide="check" style="width:13px;height:13px"></i></button>` : ''}
                      ${fiche.id ? `<button class="btn btn-sm btn-secondary" onclick="hrPrintPayslip(${fiche.id})" title="PDF"><i data-lucide="download" style="width:13px;height:13px"></i></button>` : ''}
                    </td>
                  </tr>
                `;
              }).join('') + '</tbody></table>' + renderPaginationBar('paie', pgP.page, pgP.totalPages, pgP.total, (p) => { paiePage = p; render(); }) + '</div>'; })()}

        <!-- Historique des salaires payés -->
        <div class="card" style="margin-top:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <h3 style="font-size:.92rem;font-weight:700;display:flex;align-items:center;gap:8px;">
              <i data-lucide="history" style="width:18px;height:18px"></i> Historique des salaires payés
            </h3>
            <input type="month" id="hr-history-month" class="form-control" style="width:180px" value="${window._hrHistoryMonth || ''}" onchange="window._hrHistoryMonth=this.value;hrPayPeriod(document.querySelector('input[type=month]')?.value || '${selectedPeriod}')">
          </div>
          ${(() => {
            const histMonth = window._hrHistoryMonth || '';
            const allPaid = payroll.filter(f => f.status === 'paye');
            const filtered = histMonth ? allPaid.filter(f => f.period === histMonth) : allPaid;
            const sorted = filtered.sort((a, b) => (b.payedAt || b.createdAt || '').localeCompare(a.payedAt || a.createdAt || ''));
            if (sorted.length === 0) return '<div style="text-align:center;padding:20px;color:var(--text-muted);">Aucun salaire payé' + (histMonth ? ' pour ce mois' : '') + '.</div>';
            const empById = new Map(employees.map(e => [e.id, e]));
            return '<table class="hr-payroll-table"><thead><tr><th>Employé</th><th>Période</th><th>Net payé</th><th>Avances déduites</th><th>Date de paiement</th></tr></thead><tbody>' +
              sorted.slice(0, 50).map(f => {
                const e = empById.get(f.employeeId);
                return '<tr>' +
                  '<td><strong>' + (e?.nom || 'Emp. #' + f.employeeId) + '</strong><div style="font-size:.72rem;color:var(--text-muted)">' + (e?.poste || '') + '</div></td>' +
                  '<td>' + f.period + '</td>' +
                  '<td class="amount amount-net">' + fmt(f.netAPayer || 0) + '</td>' +
                  '<td class="amount amount-negative">' + (f.avancesDed > 0 ? '-' + fmtN(f.avancesDed) : '—') + '</td>' +
                  '<td style="font-size:.8rem;color:var(--text-muted)">' + (f.payedAt ? new Date(f.payedAt).toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'}) : '—') + '</td>' +
                '</tr>';
              }).join('') + '</tbody></table>';
          })()}
        </div>
      `;
      if (window.lucide) lucide.createIcons({ node: c });
    }

    window.hrPayPeriod = (v) => { selectedPeriod = v; render(); };
    window.hrGenerateFiches = async (period) => {
      const rawEmp = await DB.dbGetAll('users');
      const empList = rawEmp.map(e => ({
        ...e,
        nom: e.nom || e.name || e.username || '',
        status: e.status || (e.active !== false ? 'actif' : 'inactif')
      })).filter(e => e.status === 'actif' || e.status === 'conge');
      const existing = (await DB.dbGetAll('hr_payroll')).filter(p => p.period === period);
      const existMap = new Map(existing.map(f => [f.employeeId, f]));
      const allAdv = await DB.dbGetAll('hr_advances');
      for (const emp of empList) {
        if (existMap.has(emp.id)) continue;
        const advDed = allAdv.filter(a => a.employeeId === emp.id && a.status === 'approuvee' && a.solde > 0)
          .reduce((s, a) => s + Math.min(a.mensualite || a.solde, a.solde), 0);
        const net = Math.max(0, (emp.salaire || 0) - advDed);
        await DB.dbPut('hr_payroll', {
          employeeId: emp.id, period,
          salaire: emp.salaire || 0, primes: 0, heuresSup: 0, retenues: 0,
          avancesDed: advDed, netAPayer: net,
          status: 'en_attente', createdAt: new Date().toISOString()
        });
      }
      UI.toast('Fiches de paie générées', 'success');
      payroll.length = 0;
      (await DB.dbGetAll('hr_payroll')).forEach(p => payroll.push(p));
      render();
    };
    window.hrPayerTout = async (period) => {
      const fiches = (await DB.dbGetAll('hr_payroll')).filter(p => p.period === period && p.status !== 'paye');
      const allAdv = await DB.dbGetAll('hr_advances');
      for (const f of fiches) {
        // Recalculer les avances si elles sont à 0 dans la fiche
        let advDed = f.avancesDed || 0;
        if (advDed === 0) {
          const empAdvs = allAdv.filter(a => a.employeeId === f.employeeId && a.status === 'approuvee' && a.solde > 0);
          advDed = empAdvs.reduce((s, a) => s + Math.min(a.mensualite || a.solde, a.solde), 0);
          if (advDed > 0) {
            f.avancesDed = advDed;
            f.netAPayer = Math.max(0, (f.salaire || 0) + (f.primes || 0) + (f.heuresSup || 0) - (f.retenues || 0) - advDed);
          }
        }
        await DB.dbPut('hr_payroll', { ...f, status: 'paye', payedAt: new Date().toISOString() });
        await DB.dbPut('cashRegister', {
          type: 'sortie', category: 'RH', subCategory: 'salaire',
          amount: f.netAPayer || 0, description: `Salaire ${period}`,
          employeeId: f.employeeId, date: today(), createdAt: new Date().toISOString()
        });
        // Déduire les avances de la table hr_advances
        const empAdvs = allAdv.filter(a => a.employeeId === f.employeeId && a.status === 'approuvee' && a.solde > 0);
        for (const adv of empAdvs) {
          const ded = Math.min(adv.mensualite || adv.solde, adv.solde);
          const newSolde = Math.max(0, (adv.solde || 0) - ded);
          await DB.dbPut('hr_advances', { ...adv, solde: newSolde, status: newSolde <= 0 ? 'remboursee' : 'approuvee' });
        }
      }
      UI.toast(`${fiches.length} salaires payés`, 'success');
      payroll.length = 0;
      (await DB.dbGetAll('hr_payroll')).forEach(p => payroll.push(p));
      render();
    };
    window.hrPayerEmploye = async (empId, period, net) => {
      const fiches = await DB.dbGetAll('hr_payroll');
      let fiche = fiches.find(f => f.employeeId === empId && f.period === period);
      if (!fiche) {
        let rawEmp = await DB.dbGet('users', empId);
        const emp = rawEmp ? { ...rawEmp, nom: rawEmp.nom || rawEmp.name || rawEmp.username || '' } : null;
        // Calculer les avances automatiquement
        const empAdvs = (await DB.dbGetAll('hr_advances')).filter(a => a.employeeId === empId && a.status === 'approuvee' && a.solde > 0);
        const advDed = empAdvs.reduce((s, a) => s + Math.min(a.mensualite || a.solde, a.solde), 0);
        const calcNet = Math.max(0, (emp?.salaire || 0) - advDed);
        fiche = { employeeId: empId, period, salaire: emp?.salaire||0, primes:0, heuresSup:0, retenues:0, avancesDed: advDed, netAPayer: calcNet, status:'en_attente', createdAt: new Date().toISOString() };
      }
      await DB.dbPut('hr_payroll', { ...fiche, status: 'paye', payedAt: new Date().toISOString() });
      let rawEmp2 = await DB.dbGet('users', empId);
      const emp2 = rawEmp2 ? { ...rawEmp2, nom: rawEmp2.nom || rawEmp2.name || rawEmp2.username || '' } : null;
      await DB.dbPut('cashRegister', {
        type: 'sortie', category: 'RH', subCategory: 'salaire',
        amount: net, description: `Salaire ${period} — ${emp2?.nom||''}`,
        employeeId: empId, date: today(), createdAt: new Date().toISOString()
      });
      // Déduire les avances
      const advs = (await DB.dbGetAll('hr_advances')).filter(a => a.employeeId === empId && a.status === 'approuvee' && a.solde > 0);
      for (const adv of advs) {
        const ded = Math.min(adv.mensualite || adv.solde, adv.solde);
        const newSolde = Math.max(0, (adv.solde || 0) - ded);
        await DB.dbPut('hr_advances', { ...adv, solde: newSolde, status: newSolde <= 0 ? 'remboursee' : 'approuvee' });
      }
      UI.toast('Salaire marqué payé', 'success');
      payroll.length = 0;
      (await DB.dbGetAll('hr_payroll')).forEach(p => payroll.push(p));
      render();
    };
    window.hrEditFiche = async (empId, period) => {
      let rawEmp = await DB.dbGet('users', empId);
      const emp = rawEmp ? { ...rawEmp, nom: rawEmp.nom || rawEmp.name || rawEmp.username || '' } : null;
      const fiches = await DB.dbGetAll('hr_payroll');
      const fiche = fiches.find(f => f.employeeId === empId && f.period === period) || { salaire: emp?.salaire||0, primes:0, heuresSup:0, retenues:0, avancesDed:0 };
      UI.openModal({
        title: `Fiche de paie — ${emp?.nom||''} (${period})`,
        body: `
          <div class="form-grid" style="gap:12px">
            <div class="form-group"><label>Salaire de base</label><input id="fp-base" class="form-control" type="number" value="${fiche.salaire||emp?.salaire||0}"></div>
            <div class="form-group"><label>Primes</label><input id="fp-primes" class="form-control" type="number" value="${fiche.primes||0}"></div>
            <div class="form-group"><label>Heures supplémentaires</label><input id="fp-hsup" class="form-control" type="number" value="${fiche.heuresSup||0}"></div>
            <div class="form-group"><label>Retenues</label><input id="fp-retenues" class="form-control" type="number" value="${fiche.retenues||0}"></div>
            <div class="form-group"><label>Déduction avances</label><input id="fp-avances" class="form-control" type="number" value="${fiche.avancesDed||0}"></div>
          </div>
        `,
        buttons: [
          { label: 'Annuler', class: 'btn-secondary', action: 'close' },
          { label: 'Enregistrer', class: 'btn-primary', action: async () => {
            const base = parseFloat(document.getElementById('fp-base')?.value) || 0;
            const primes = parseFloat(document.getElementById('fp-primes')?.value) || 0;
            const hsup = parseFloat(document.getElementById('fp-hsup')?.value) || 0;
            const retenues = parseFloat(document.getElementById('fp-retenues')?.value) || 0;
            const avancesDed = parseFloat(document.getElementById('fp-avances')?.value) || 0;
            const net = Math.max(0, base + primes + hsup - retenues - avancesDed);
            await DB.dbPut('hr_payroll', { ...fiche, employeeId: empId, period, salaire: base, primes, heuresSup: hsup, retenues, avancesDed, netAPayer: net, status: fiche.status||'en_attente', createdAt: fiche.createdAt||new Date().toISOString() });
            UI.closeModal();
            UI.toast('Fiche mise à jour', 'success');
            payroll.length = 0;
            (await DB.dbGetAll('hr_payroll')).forEach(p => payroll.push(p));
            render();
          }}
        ]
      });
    };
    render();
  }

  // ─── Impression Bulletin PDF ─────────────────────────────────────────────
  window.hrPrintPayslip = async function (payrollId) {
    const fiche = await DB.dbGet('hr_payroll', payrollId);
    if (!fiche) { UI.toast('Fiche introuvable', 'error'); return; }
    let rawEmp = await DB.dbGet('users', fiche.employeeId);
    const emp = rawEmp ? { ...rawEmp, nom: rawEmp.nom || rawEmp.name || rawEmp.username || '' } : null;
    const pharmacyName = gs('pharmacy_name') || 'Pharmacie';
    const pharmacyAddr = gs('pharmacy_address') || '';
    const pharmacyTel = gs('pharmacy_phone') || '';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; const M = 15;

    // En-tête
    doc.setFillColor(27, 79, 114);
    doc.rect(0, 0, W, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(pharmacyName, M, 12);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`${pharmacyAddr} • Tél: ${pharmacyTel}`, M, 19);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('BULLETIN DE PAIE', W - M, 12, { align: 'right' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(`Période : ${fiche.period || '—'}`, W - M, 19, { align: 'right' });

    // Info employé
    let y = 38;
    doc.setTextColor(30, 41, 59);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(M, y, W - 2 * M, 28, 3, 3, 'F');
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('Employé :', M + 4, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(emp?.nom || '—', M + 30, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.text('Poste :', M + 4, y + 14);
    doc.setFont('helvetica', 'normal');
    doc.text(emp?.poste || '—', M + 30, y + 14);
    doc.setFont('helvetica', 'bold');
    doc.text('Contrat :', M + 4, y + 21);
    doc.setFont('helvetica', 'normal');
    doc.text(emp?.typeContrat || '—', M + 30, y + 21);
    doc.setFont('helvetica', 'bold');
    doc.text('Date paiement :', M + 90, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.text(fiche.payedAt ? new Date(fiche.payedAt).toLocaleDateString('fr-FR') : '—', M + 125, y + 7);

    y += 36;
    // Tableau composantes
    doc.autoTable({
      startY: y,
      head: [['Libellé', 'Montant (GNF)']],
      body: [
        ['Salaire de base', fmtN(fiche.salaire)],
        ['Primes', '+' + fmtN(fiche.primes || 0)],
        ['Heures supplémentaires', '+' + fmtN(fiche.heuresSup || 0)],
        ['Retenues', '-' + fmtN(fiche.retenues || 0)],
        ['Déduction avances', '-' + fmtN(fiche.avancesDed || 0)],
      ],
      headStyles: { fillColor: [27, 79, 114], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: M, right: M },
    });

    y = doc.lastAutoTable.finalY + 8;
    // Net à payer
    doc.setFillColor(27, 79, 114);
    doc.roundedRect(M, y, W - 2 * M, 16, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('NET À PAYER :', M + 6, y + 10);
    doc.text(fmt(fiche.netAPayer), W - M - 6, y + 10, { align: 'right' });

    // Signatures
    y += 30;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text('Signature du responsable', M + 20, y, { align: 'center' });
    doc.text('Signature de l\'employé', W - M - 20, y, { align: 'center' });
    doc.line(M + 4, y - 6, M + 46, y - 6);
    doc.line(W - M - 46, y - 6, W - M - 4, y - 6);

    doc.save(`Bulletin_${emp?.nom?.replace(/\s/g,'_')||'employe'}_${fiche.period||'paie'}.pdf`);
    UI.toast('Bulletin PDF généré', 'success');
  };

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 4 — AVANCES
  // ═══════════════════════════════════════════════════════════════════════
  async function renderAvances(c) {
    const [rawEmployees, advances] = await Promise.all([DB.dbGetAll('users'), DB.dbGetAll('hr_advances')]);
    const employees = rawEmployees.map(e => ({ ...e, nom: e.nom || e.name || e.username || '', status: e.status || (e.active !== false ? 'actif' : 'inactif') }));
    const empMap = new Map(employees.map(e => [e.id, e]));

    let enCoursPage = 1;
    let rembPage = 1;

    function render() {
      const enCours = advances.filter(a => a.status === 'approuvee' && a.solde > 0);
      const remb = advances.filter(a => a.status === 'remboursee').sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      const pgEnCours = paginateData(enCours, enCoursPage, 20);
      const pgRemb = paginateData(remb, rembPage, 20);

      c.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
          <h3 style="font-size:.95rem;font-weight:700">Avances sur Salaire</h3>
          <button class="btn btn-primary" onclick="hrNewAvance()"><i data-lucide="plus"></i> Nouvelle Avance</button>
        </div>

        ${enCours.length === 0 && remb.length === 0 ? `<div class="empty-state"><p style="color:var(--text-muted)">Aucune avance enregistrée</p></div>` : ''}

        ${enCours.length > 0 ? `
          <h4 style="font-size:.85rem;font-weight:700;margin-bottom:12px;color:#f59e0b">⏳ En cours (${enCours.length})</h4>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
            ${pgEnCours.items.map(a => {
              const emp = empMap.get(a.employeeId);
              const pct = a.montant > 0 ? Math.round(((a.montant - (a.solde||0)) / a.montant) * 100) : 0;
              return `
                <div class="advance-card">
                  <div class="hr-emp-avatar" style="width:40px;height:40px;font-size:.9rem;flex-shrink:0">${initials(emp?.nom)}</div>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:.88rem">${emp?.nom||'—'}</div>
                    <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px">${a.motif||'Sans motif'} • Accordée le ${dateLabel(a.date)}</div>
                    <div class="advance-progress" style="margin-top:8px">
                      <div class="advance-progress-bar" style="width:${pct}%"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:.72rem;color:var(--text-muted)">
                      <span>Remboursé : ${fmt(a.montant - (a.solde||0))}</span>
                      <span>Reste : <strong style="color:#f59e0b">${fmt(a.solde)}</strong></span>
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0">
                    <button class="btn btn-sm btn-secondary" onclick="hrRemboursManuel(${a.id})">Rembourser</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
          ${renderPaginationBar('adv_encours', pgEnCours.page, pgEnCours.totalPages, pgEnCours.total, (p) => { enCoursPage = p; render(); })}
        ` : ''}

        ${remb.length > 0 ? `
          <h4 style="font-size:.85rem;font-weight:700;margin-top:20px;margin-bottom:12px;color:#10b981">✅ Remboursées (${remb.length})</h4>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
            ${pgRemb.items.map(a => {
              const emp = empMap.get(a.employeeId);
              return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--surface-alt);border-radius:8px;font-size:.82rem">
                  <span style="font-weight:600">${emp?.nom||'—'}</span>
                  <span>${fmt(a.montant)}</span>
                  <span style="color:var(--text-muted)">${dateLabel(a.date)}</span>
                  <span class="emp-badge emp-badge-actif">Remboursée</span>
                </div>
              `;
            }).join('')}
          </div>
          ${renderPaginationBar('adv_remb', pgRemb.page, pgRemb.totalPages, pgRemb.total, (p) => { rembPage = p; render(); })}
        ` : ''}
      `;
      if (window.lucide) lucide.createIcons({ node: c });
    }

    window.hrNewAvance = () => {
      UI.openModal({
        title: 'Nouvelle Avance sur Salaire',
        body: `
          <div class="form-grid" style="gap:12px">
            <div class="form-group">
              <label>Employé <span style="color:var(--danger)">*</span></label>
              <select id="adv-emp" class="form-control">
                <option value="">-- Sélectionner --</option>
                ${employees.filter(e=>e.status==='actif').map(e=>`<option value="${e.id}">${e.nom}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Montant (GNF) <span style="color:var(--danger)">*</span></label>
              <input id="adv-montant" class="form-control" type="number" placeholder="0" min="0">
            </div>
            <div class="form-group">
              <label>Mensualité de remboursement (GNF)</label>
              <input id="adv-mens" class="form-control" type="number" placeholder="Déduit en totalité si vide">
            </div>
            <div class="form-group">
              <label>Date</label>
              <input id="adv-date" class="form-control" type="date" value="${today()}">
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label>Motif</label>
              <input id="adv-motif" class="form-control" type="text" placeholder="Raison de l'avance">
            </div>
          </div>
        `,
        buttons: [
          { label: 'Annuler', class: 'btn-secondary', action: 'close' },
          { label: 'Accorder', class: 'btn-primary', action: async () => {
            const empId = parseInt(document.getElementById('adv-emp')?.value);
            const montant = parseFloat(document.getElementById('adv-montant')?.value) || 0;
            if (!empId || !montant) { UI.toast('Employé et montant obligatoires', 'error'); return; }
            const mens = parseFloat(document.getElementById('adv-mens')?.value) || montant;
            await DB.dbPut('hr_advances', {
              employeeId: empId,
              montant, solde: montant, mensualite: mens,
              date: document.getElementById('adv-date')?.value || today(),
              motif: document.getElementById('adv-motif')?.value?.trim() || '',
              status: 'approuvee', createdAt: new Date().toISOString()
            });
            await DB.dbPut('cashRegister', {
              type: 'sortie', category: 'RH', subCategory: 'avance',
              amount: montant, description: `Avance — ${employees.find(e=>e.id===empId)?.nom||''}`,
              date: today(), createdAt: new Date().toISOString()
            });
            UI.closeModal(); UI.toast('Avance accordée et enregistrée', 'success');
            advances.length = 0;
            (await DB.dbGetAll('hr_advances')).forEach(a => advances.push(a));
            render();
          }}
        ]
      });
    };

    window.hrRemboursManuel = async (advId) => {
      const adv = await DB.dbGet('hr_advances', advId);
      if (!adv) return;
      const montant = parseFloat(prompt(`Montant à rembourser (solde actuel : ${fmt(adv.solde)})`, adv.mensualite || adv.solde)) || 0;
      if (!montant) return;
      const newSolde = Math.max(0, (adv.solde || 0) - montant);
      await DB.dbPut('hr_advances', { ...adv, solde: newSolde, status: newSolde <= 0 ? 'remboursee' : 'approuvee' });
      
      const empName = empMap.get(adv.employeeId)?.nom || '';
      await DB.dbPut('cashRegister', {
        type: 'entree', category: 'RH', subCategory: 'remboursement_avance',
        amount: montant, description: `Remboursement avance — ${empName}`,
        employeeId: adv.employeeId, date: today(), createdAt: new Date().toISOString()
      });

      UI.toast('Remboursement enregistré', 'success');
      advances.length = 0;
      (await DB.dbGetAll('hr_advances')).forEach(a => advances.push(a));
      render();
    };
    render();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 5 — CONGÉS & ABSENCES
  // ═══════════════════════════════════════════════════════════════════════
  async function renderConges(c) {
    const [rawEmployees, leaves] = await Promise.all([DB.dbGetAll('users'), DB.dbGetAll('hr_leaves')]);
    const employees = rawEmployees.map(e => ({ ...e, nom: e.nom || e.name || e.username || '', status: e.status || (e.active !== false ? 'actif' : 'inactif') }));
    const empMap = new Map(employees.map(e => [e.id, e]));
    const typeLabel = { conge:'Congé Payé', maladie:'Maladie', maternite:'Maternité', absence:'Absence Injustifiée', retard:'Retard', permission:'Permission' };
    const typeColor = { conge:'#3b82f6', maladie:'#f59e0b', maternite:'#ec4899', absence:'#ef4444', retard:'#f97316', permission:'#8b5cf6' };
    let viewMonth = today().slice(0, 7);
    let congesPage = 1;

    function render() {
      const [yr, mo] = viewMonth.split('-').map(Number);
      const daysInMonth = new Date(yr, mo, 0).getDate();
      const firstDow = new Date(yr, mo - 1, 1).getDay();
      const monthLeaves = leaves.filter(l => {
        const d = l.dateDebut || '';
        return d.slice(0, 7) === viewMonth || (l.dateFin && l.dateFin.slice(0, 7) === viewMonth);
      }).sort((a, b) => new Date(b.dateDebut || 0) - new Date(a.dateDebut || 0));

      const pgConges = paginateData(monthLeaves, congesPage, 10);

      const byDay = new Map();
      for (const l of monthLeaves) {
        const start = new Date(l.dateDebut);
        const end = l.dateFin ? new Date(l.dateFin) : start;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getFullYear() === yr && d.getMonth() + 1 === mo) {
            const day = d.getDate();
            if (!byDay.has(day)) byDay.set(day, []);
            byDay.get(day).push(l);
          }
        }
      }

      const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
      let calCells = '';
      const blanks = (firstDow + 6) % 7;
      for (let i = 0; i < blanks; i++) calCells += `<div></div>`;
      for (let d = 1; d <= daysInMonth; d++) {
        const isToday = d === new Date().getDate() && viewMonth === today().slice(0, 7);
        const dayLeaves = byDay.get(d) || [];
        const cls = [isToday ? 'today' : '', dayLeaves.length ? (dayLeaves[0].type === 'absence' ? 'has-leave absent' : 'has-leave') : ''].join(' ').trim();
        const dots = dayLeaves.slice(0, 2).map(l => `<span class="leave-type-dot" style="background:${typeColor[l.type]||'#64748b'}"></span>`).join('');
        calCells += `<div class="leave-cal-day ${cls}" title="${dayLeaves.map(l=>empMap.get(l.employeeId)?.nom+': '+typeLabel[l.type]).join(', ')}">${d}${dots}</div>`;
      }

      c.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px">
          <h3 style="font-size:.95rem;font-weight:700">Congés & Absences</h3>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" onclick="hrExportCongesPDF('${viewMonth}')">
              <i data-lucide="file-text"></i> Exporter PDF
            </button>
            <button class="btn btn-primary" onclick="hrNewLeave()"><i data-lucide="plus"></i> Nouveau</button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:20px;align-items:start">
          <div class="card" style="padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <button class="btn btn-icon btn-sm" onclick="hrLeaveMonth(-1)"><i data-lucide="chevron-left"></i></button>
              <span style="font-weight:700;font-size:.9rem">${new Date(yr,mo-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</span>
              <button class="btn btn-icon btn-sm" onclick="hrLeaveMonth(1)"><i data-lucide="chevron-right"></i></button>
            </div>
            <div class="leave-cal-header">
              ${['Lu','Ma','Me','Je','Ve','Sa','Di'].map(d=>`<div class="leave-cal-dow">${d}</div>`).join('')}
            </div>
            <div class="leave-calendar-grid">${calCells}</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
              ${Object.entries(typeColor).map(([t,col])=>`
                <span style="display:flex;align-items:center;gap:4px;font-size:.72rem">
                  <span style="width:8px;height:8px;border-radius:50%;background:${col};display:inline-block"></span> ${typeLabel[t]}
                </span>`).join('')}
            </div>
          </div>

          <div>
            <h4 style="font-size:.85rem;font-weight:700;margin-bottom:12px">Ce mois-ci (${monthLeaves.length})</h4>
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
              ${monthLeaves.length === 0 ? '<p style="color:var(--text-muted);font-size:.83rem">Aucune absence ou congé ce mois-ci</p>' : ''}
              ${pgConges.items.map(l => {
                const emp = empMap.get(l.employeeId);
                const days = l.dateFin ? Math.ceil((new Date(l.dateFin)-new Date(l.dateDebut))/86400000)+1 : 1;
                return `
                  <div style="display:flex;gap:10px;align-items:flex-start;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;border-left:3px solid ${typeColor[l.type]||'#64748b'}">
                    <div style="flex:1;min-width:0">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <div style="font-weight:600;font-size:.85rem">${emp?.nom||'—'}</div>
                        <span class="emp-badge" style="background:${typeColor[l.type]||'#64748b'}22;color:${typeColor[l.type]||'#64748b'}">${typeLabel[l.type]||l.type}</span>
                      </div>
                      <div style="font-size:.75rem;color:var(--text-muted)">${dateLabel(l.dateDebut)} ${l.dateFin&&l.dateFin!==l.dateDebut?'→ '+dateLabel(l.dateFin):''} • ${days} jour${days>1?'s':''}</div>
                      ${l.justificatif?`<div style="font-size:.72rem;color:var(--text-muted);margin-top:4px;font-style:italic">${l.justificatif}</div>`:''}
                    </div>
                    <button class="btn btn-icon btn-sm" onclick="hrDelLeave(${l.id})" title="Supprimer" style="flex-shrink:0">
                      <i data-lucide="trash-2" style="width:13px;height:13px;color:var(--danger)"></i>
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
            ${renderPaginationBar('conges', pgConges.page, pgConges.totalPages, pgConges.total, (p) => { congesPage = p; render(); })}
          </div>
        </div>
      `;
      if (window.lucide) lucide.createIcons({ node: c });
    }

    window.hrLeaveMonth = (delta) => {
      const d = new Date(viewMonth + '-01');
      d.setMonth(d.getMonth() + delta);
      viewMonth = d.toISOString().slice(0, 7);
      congesPage = 1;
      render();
    };
    window.hrNewLeave = () => {
      UI.openModal({
        title: 'Congé / Absence',
        body: `
          <div class="form-grid" style="gap:12px">
            <div class="form-group">
              <label>Employé <span style="color:var(--danger)">*</span></label>
              <select id="lv-emp" class="form-control">
                <option value="">-- Sélectionner --</option>
                ${employees.map(e=>`<option value="${e.id}">${e.nom}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Type</label>
              <select id="lv-type" class="form-control">
                ${Object.entries(typeLabel).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Date début <span style="color:var(--danger)">*</span></label>
              <input id="lv-debut" class="form-control" type="date" value="${today()}">
            </div>
            <div class="form-group">
              <label>Date fin</label>
              <input id="lv-fin" class="form-control" type="date" value="${today()}">
            </div>
            <div class="form-group" style="grid-column:1/-1">
              <label>Justificatif / Commentaire</label>
              <textarea id="lv-just" class="form-control" rows="2"></textarea>
            </div>
          </div>
        `,
        buttons: [
          { label: 'Annuler', class: 'btn-secondary', action: 'close' },
          { label: 'Enregistrer', class: 'btn-primary', action: async () => {
            const empId = parseInt(document.getElementById('lv-emp')?.value);
            const debut = document.getElementById('lv-debut')?.value;
            if (!empId || !debut) { UI.toast('Employé et date de début obligatoires', 'error'); return; }
            await DB.dbPut('hr_leaves', {
              employeeId: empId,
              type: document.getElementById('lv-type')?.value || 'conge',
              dateDebut: debut,
              dateFin: document.getElementById('lv-fin')?.value || debut,
              justificatif: document.getElementById('lv-just')?.value?.trim() || '',
              status: 'approuve', createdAt: new Date().toISOString()
            });
            UI.closeModal(); UI.toast('Congé enregistré', 'success');
            leaves.length = 0;
            (await DB.dbGetAll('hr_leaves')).forEach(l => leaves.push(l));
            render();
          }}
        ]
      });
    };
    window.hrDelLeave = async (id) => {
      if (!confirm('Supprimer ce congé / cette absence ?')) return;
      try {
        await DB.dbDelete('hr_leaves', id);
        const idx = leaves.findIndex(x => x.id === id);
        if (idx !== -1) leaves.splice(idx, 1);
        UI.toast('Congé/absence supprimé', 'success');
        render();
      } catch (e) {
        UI.toast('Erreur lors de la suppression', 'error');
      }
    };
    render();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 6 — PRÉSENCE
  // ═══════════════════════════════════════════════════════════════════════
  async function renderPresence(c) {
    const [rawEmployees, attendance] = await Promise.all([DB.dbGetAll('users'), DB.dbGetAll('hr_attendance')]);
    const employees = rawEmployees.map(e => ({ ...e, nom: e.nom || e.name || e.username || '', status: e.status || (e.active !== false ? 'actif' : 'inactif') }));
    const empMap = new Map(employees.map(e => [e.id, e]));
    let selectedDate = today();
    let presencePage = 1;
    window._tempAttendance = {};

    window._hrRecordTempAttendance = (empId, field, val) => {
      if (!window._tempAttendance[empId]) window._tempAttendance[empId] = {};
      window._tempAttendance[empId][field] = val;
    };

    function render() {
      const dayRecords = attendance.filter(a => a.date === selectedDate);
      const recMap = new Map(dayRecords.map(r => [r.employeeId, r]));
      const actifs = employees.filter(e => e.status === 'actif');

      const pgPresence = paginateData(actifs, presencePage, 20);

      function calcH(a, d) {
        if (!a || !d) return 0;
        const [ah, am] = a.split(':').map(Number);
        const [dh, dm] = d.split(':').map(Number);
        return Math.max(0, (dh * 60 + dm - ah * 60 - am) / 60);
      }

      c.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px">
          <div style="display:flex;align-items:center;gap:10px">
            <label style="font-weight:600;font-size:.9rem">Date :</label>
            <input type="date" class="form-control" style="width:180px" value="${selectedDate}" onchange="hrPresDate(this.value)">
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-secondary" onclick="hrExportPresencePDF('${selectedDate}')">
              <i data-lucide="file-text"></i> Exporter PDF
            </button>
            <button class="btn btn-primary" onclick="hrSavePresence('${selectedDate}')">
              <i data-lucide="save"></i> Enregistrer le pointage
            </button>
          </div>
        </div>

        <div class="card" style="overflow:auto;margin-bottom:12px">
          <div class="attendance-row header" style="border-bottom:2px solid var(--border);margin-bottom:4px">
            <div>Employé</div><div>Arrivée</div><div>Départ</div><div>Heures</div><div>Statut</div>
          </div>
          ${actifs.length === 0 ? '<p style="padding:16px;color:var(--text-muted)">Aucun employé actif</p>' : ''}
          ${pgPresence.items.map(emp => {
            const rec = recMap.get(emp.id) || {};
            const tempArr = window._tempAttendance[emp.id]?.arrivee;
            const tempDep = window._tempAttendance[emp.id]?.depart;
            const arrVal = tempArr !== undefined ? tempArr : (rec.arrivee || '');
            const depVal = tempDep !== undefined ? tempDep : (rec.depart || '');
            const h = calcH(arrVal, depVal);
            const present = !!arrVal;
            return `
              <div class="attendance-row">
                <div>
                  <div style="font-weight:600;font-size:.85rem">${emp.nom}</div>
                  <div style="font-size:.72rem;color:var(--text-muted)">${emp.poste||'—'}</div>
                </div>
                <div><input type="time" class="form-control" style="width:100px;font-size:.82rem" id="arr-${emp.id}" value="${arrVal}" onchange="window._hrRecordTempAttendance(${emp.id}, 'arrivee', this.value); hrUpdateRowHours(${emp.id})"></div>
                <div><input type="time" class="form-control" style="width:100px;font-size:.82rem" id="dep-${emp.id}" value="${depVal}" onchange="window._hrRecordTempAttendance(${emp.id}, 'depart', this.value); hrUpdateRowHours(${emp.id})"></div>
                <div style="font-weight:600;font-size:.85rem" id="hours-${emp.id}">${h > 0 ? h.toFixed(1) + 'h' : '—'}</div>
                <div><span class="emp-badge ${present?'emp-badge-actif':'emp-badge-inactif'}" id="badge-${emp.id}">${present?'Présent':'Absent'}</span></div>
              </div>
            `;
          }).join('')}
        </div>
        ${renderPaginationBar('presence', pgPresence.page, pgPresence.totalPages, pgPresence.total, (p) => { presencePage = p; render(); })}
      `;
      if (window.lucide) lucide.createIcons({ node: c });
    }

    window.hrUpdateRowHours = (empId) => {
      const arrVal = document.getElementById(`arr-${empId}`)?.value || '';
      const depVal = document.getElementById(`dep-${empId}`)?.value || '';
      const hoursEl = document.getElementById(`hours-${empId}`);
      const badgeEl = document.getElementById(`badge-${empId}`);
      const [ah, am] = arrVal.split(':').map(Number);
      const [dh, dm] = depVal.split(':').map(Number);
      const h = (arrVal && depVal) ? Math.max(0, (dh * 60 + dm - ah * 60 - am) / 60) : 0;
      if (hoursEl) hoursEl.textContent = h > 0 ? h.toFixed(1) + 'h' : '—';
      if (badgeEl) {
        const present = !!arrVal;
        badgeEl.className = `emp-badge ${present ? 'emp-badge-actif' : 'emp-badge-inactif'}`;
        badgeEl.textContent = present ? 'Présent' : 'Absent';
      }
    };

    window.hrPresDate = (v) => { selectedDate = v; presencePage = 1; window._tempAttendance = {}; render(); };
    window.hrSavePresence = async (date) => {
      const actifs = employees.filter(e => e.status === 'actif');
      let saved = 0;
      for (const emp of actifs) {
        const arrInput = document.getElementById(`arr-${emp.id}`);
        const depInput = document.getElementById(`dep-${emp.id}`);
        const arrivee = arrInput ? arrInput.value : (window._tempAttendance[emp.id]?.arrivee || '');
        const depart  = depInput ? depInput.value : (window._tempAttendance[emp.id]?.depart  || '');
        if (!arrivee && !depart) continue;
        const existing = attendance.find(a => a.employeeId === emp.id && a.date === date);
        await DB.dbPut('hr_attendance', { ...(existing || {}), employeeId: emp.id, date, arrivee, depart, updatedAt: new Date().toISOString() });
        saved++;
      }
      UI.toast(`${saved} pointages enregistrés`, 'success');
      window._tempAttendance = {};
      attendance.length = 0;
      (await DB.dbGetAll('hr_attendance')).forEach(a => attendance.push(a));
      render();
    };
    render();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ONGLET 7 — COMPTABILITÉ & HISTORIQUE FINANCIER
  // ═══════════════════════════════════════════════════════════════════════
  async function renderComptabilite(c) {
    const [rawEmployees, payroll, advances, cashReg] = await Promise.all([
      DB.dbGetAll('users'),
      DB.dbGetAll('hr_payroll'),
      DB.dbGetAll('hr_advances'),
      DB.dbGetAll('cashRegister')
    ]);
    const employees = rawEmployees.map(e => ({
      ...e,
      nom: e.nom || e.name || e.username || '',
      status: e.status || (e.active !== false ? 'actif' : 'inactif')
    }));

    let selectedEmpId = employees[0]?.id || '';
    let _compSortOrder = 'desc';
    let comptaPage = 1;
    let _compDateFrom = '';
    let _compDateTo = '';

    function render() {
      const emp = employees.find(e => e.id === Number(selectedEmpId));
      
      // Filtrer les opérations pour cet employé
      const empPayroll = payroll.filter(p => p.employeeId === Number(selectedEmpId) && p.status === 'paye');
      const empAdvances = advances.filter(a => a.employeeId === Number(selectedEmpId));
      const empRepayments = cashReg.filter(cr => cr.employeeId === Number(selectedEmpId) && cr.subCategory === 'remboursement_avance');

      // Rassembler toutes les transactions chronologiquement
      const txs = [];
      
      // 1. Salaires payés
      empPayroll.forEach(p => {
        txs.push({
          date: p.payedAt || p.createdAt || today(),
          type: 'Salaire',
          details: `Période ${p.period} (Base: ${fmt(p.salaire)}, Primes: ${fmt(p.primes)}, Retenues: -${fmt(p.retenues)})`,
          debit: p.netAPayer,
          credit: 0
        });
      });

      // 2. Avances accordées
      empAdvances.forEach(a => {
        txs.push({
          date: a.date || a.createdAt || today(),
          type: 'Avance',
          details: `Avance accordée (Motif: ${a.motif || 'Aucun'})`,
          debit: a.montant,
          credit: 0
        });
      });

      // 3. Remboursements (automatiques lors de la paie, ou manuels)
      empPayroll.forEach(p => {
        if (p.avancesDed > 0) {
          txs.push({
            date: p.payedAt || p.createdAt || today(),
            type: 'Remboursement (Paie)',
            details: `Déduction automatique sur salaire période ${p.period}`,
            debit: 0,
            credit: p.avancesDed
          });
        }
      });

      empRepayments.forEach(r => {
        txs.push({
          date: r.date || r.createdAt || today(),
          type: 'Remboursement (Manuel)',
          details: r.description || 'Remboursement manuel d\'avance',
          debit: 0,
          credit: r.amount
        });
      });

      // Filtrer par période de date
      let filteredTxs = txs;
      if (_compDateFrom) {
        filteredTxs = filteredTxs.filter(t => t.date.split('T')[0] >= _compDateFrom);
      }
      if (_compDateTo) {
        filteredTxs = filteredTxs.filter(t => t.date.split('T')[0] <= _compDateTo);
      }

      // Trier chronologiquement selon le choix de l'utilisateur
      filteredTxs.sort((a, b) => _compSortOrder === 'asc'
        ? new Date(a.date) - new Date(b.date)
        : new Date(b.date) - new Date(a.date));

      const pgCompta = paginateData(filteredTxs, comptaPage, 20);

      const totalSalaires = empPayroll.reduce((s, p) => s + (p.netAPayer || 0), 0);
      const totalAvances  = empAdvances.reduce((s, a) => s + (a.montant || 0), 0);
      const totalRembourses = txs.filter(t => t.credit > 0).reduce((s, t) => s + t.credit, 0);
      const soldeAvances = Math.max(0, totalAvances - totalRembourses);

      c.innerHTML = `
        <div style="background:var(--surface);padding:20px;border-radius:12px;border:1px solid var(--border);margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:6px">
                <label style="font-weight:700;color:var(--text-primary)">Employé :</label>
                <select id="comp-emp-select" class="form-control" style="width:200px" onchange="hrChangeCompEmp(this.value)">
                  ${employees.map(e => `<option value="${e.id}" ${e.id === Number(selectedEmpId) ? 'selected' : ''}>${e.nom} (${e.poste || '—'})</option>`).join('')}
                </select>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <label style="font-weight:600;font-size:13px;color:var(--text-muted)">Du :</label>
                <input type="date" class="form-control" style="width:135px;padding:4px 8px;font-size:12px" value="${_compDateFrom}" onchange="hrChangeCompDateFrom(this.value)">
                <label style="font-weight:600;font-size:13px;color:var(--text-muted)">au :</label>
                <input type="date" class="form-control" style="width:135px;padding:4px 8px;font-size:12px" value="${_compDateTo}" onchange="hrChangeCompDateTo(this.value)">
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <label style="font-weight:600;font-size:13px;color:var(--text-muted)">Trier :</label>
              <select id="comp-sort-select" class="form-control" style="width:170px" onchange="hrChangeCompSort(this.value)">
                <option value="desc" ${_compSortOrder === 'desc' ? 'selected' : ''}>Plus récent d'abord</option>
                <option value="asc" ${_compSortOrder === 'asc' ? 'selected' : ''}>Plus ancien d'abord</option>
              </select>
              ${emp ? `<button class="btn btn-secondary" onclick="hrExportComptaPDF('${selectedEmpId}')">
                <i data-lucide="file-text"></i> Exporter PDF
              </button>` : ''}
            </div>
          </div>
        </div>

        ${!emp ? `
          <div class="empty-state">
            <i data-lucide="line-chart" style="width:48px;height:48px;color:var(--text-muted)"></i>
            <h3>Aucun employé sélectionné</h3>
          </div>` : `
          <div class="hr-kpi-grid" style="margin-bottom:20px">
            <div class="hr-kpi-card blue">
              <div class="hr-kpi-icon blue"><i data-lucide="wallet"></i></div>
              <div class="hr-kpi-value">${fmt(emp.salaire || 0)}</div>
              <div class="hr-kpi-label">Salaire de Base</div>
              <div class="hr-kpi-sub">Configuré sur la fiche</div>
            </div>
            <div class="hr-kpi-card green">
              <div class="hr-kpi-icon green"><i data-lucide="banknote"></i></div>
              <div class="hr-kpi-value">${fmt(totalSalaires)}</div>
              <div class="hr-kpi-label">Salaires Versés</div>
              <div class="hr-kpi-sub">Total net à payer payé</div>
            </div>
            <div class="hr-kpi-card orange">
              <div class="hr-kpi-icon orange"><i data-lucide="landmark"></i></div>
              <div class="hr-kpi-value">${fmt(totalAvances)}</div>
              <div class="hr-kpi-label">Avances Accordées</div>
              <div class="hr-kpi-sub">Cumul de tous les prêts</div>
            </div>
            <div class="hr-kpi-card red">
              <div class="hr-kpi-icon red"><i data-lucide="coins"></i></div>
              <div class="hr-kpi-value">${fmt(soldeAvances)}</div>
              <div class="hr-kpi-label">Solde Avances Dû</div>
              <div class="hr-kpi-sub">Remboursé : ${fmt(totalRembourses)}</div>
            </div>
          </div>

          <div class="card" style="padding:20px">
            <h3 style="font-size:1rem;font-weight:700;margin-bottom:16px">Historique Financier de ${emp.nom}</h3>
            
            ${filteredTxs.length === 0 ? `
              <div class="empty-state">
                <p>Aucune transaction financière enregistrée pour cet employé sur cette période.</p>
              </div>` : `
              <div style="overflow-x:auto;margin-bottom:12px">
                <table class="table" style="width:100%;border-collapse:collapse;font-size:13px">
                  <thead>
                    <tr style="border-bottom:2px solid var(--border);text-align:left">
                      <th style="padding:10px">Date</th>
                      <th style="padding:10px">Type d'opération</th>
                      <th style="padding:10px">Description / Détails</th>
                      <th style="padding:10px;text-align:right">Débit (Sortie)</th>
                      <th style="padding:10px;text-align:right">Crédit (Entrée)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pgCompta.items.map(t => `
                      <tr style="border-bottom:1px solid var(--border)">
                        <td style="padding:10px">${dateLabel(t.date)}</td>
                        <td style="padding:10px">
                          <span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;
                            background:${t.debit > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'};
                            color:${t.debit > 0 ? 'var(--danger)' : 'var(--success)'}">
                            ${t.type}
                          </span>
                        </td>
                        <td style="padding:10px;color:var(--text-muted)">${t.details}</td>
                        <td style="padding:10px;text-align:right;font-weight:700;color:var(--danger)">
                          ${t.debit > 0 ? fmt(t.debit) : '—'}
                        </td>
                        <td style="padding:10px;text-align:right;font-weight:700;color:var(--success)">
                          ${t.credit > 0 ? fmt(t.credit) : '—'}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ${renderPaginationBar('compta', pgCompta.page, pgCompta.totalPages, pgCompta.total, (p) => { comptaPage = p; render(); })}
            `}
          </div>
        `}
      `;
      if (window.lucide) lucide.createIcons({ node: c });
    }

    window.hrChangeCompEmp = (id) => {
      selectedEmpId = id;
      comptaPage = 1;
      render();
    };

    window.hrChangeCompSort = (order) => {
      _compSortOrder = order;
      comptaPage = 1;
      render();
    };

    window.hrChangeCompDateFrom = (val) => {
      _compDateFrom = val;
      comptaPage = 1;
      render();
    };

    window.hrChangeCompDateTo = (val) => {
      _compDateTo = val;
      comptaPage = 1;
      render();
    };


window.hrExportComptaPDF = async (empId) => {
      const emp = employees.find(e => e.id === Number(empId));
      if (!emp) return;
      
      const empPayroll = payroll.filter(p => p.employeeId === Number(empId) && p.status === 'paye');
      const empAdvances = advances.filter(a => a.employeeId === Number(empId));
      const empRepayments = cashReg.filter(cr => cr.employeeId === Number(empId) && cr.subCategory === 'remboursement_avance');

      const txs = [];
      empPayroll.forEach(p => txs.push({ date: p.payedAt || p.createdAt || today(), type: 'Salaire', details: `Période ${p.period}`, debit: p.netAPayer, credit: 0 }));
      empAdvances.forEach(a => txs.push({ date: a.date || a.createdAt || today(), type: 'Avance', details: a.motif || '—', debit: a.montant, credit: 0 }));
      empPayroll.forEach(p => { if (p.avancesDed > 0) txs.push({ date: p.payedAt || p.createdAt || today(), type: 'Remb. (Paie)', details: `Déduction période ${p.period}`, debit: 0, credit: p.avancesDed }); });
      empRepayments.forEach(r => txs.push({ date: r.date || r.createdAt || today(), type: 'Remb. (Manuel)', details: r.description, debit: 0, credit: r.amount }));

      // Filtrer par date
      let filteredTxs = txs;
      if (_compDateFrom) {
        filteredTxs = filteredTxs.filter(t => t.date.split('T')[0] >= _compDateFrom);
      }
      if (_compDateTo) {
        filteredTxs = filteredTxs.filter(t => t.date.split('T')[0] <= _compDateTo);
      }

      filteredTxs.sort((a, b) => new Date(b.date) - new Date(a.date));

      const totalSalaires = empPayroll.reduce((s, p) => s + (p.netAPayer || 0), 0);
      const totalAvances  = empAdvances.reduce((s, a) => s + (a.montant || 0), 0);
      const totalRembourses = txs.filter(t => t.credit > 0).reduce((s, t) => s + t.credit, 0);
      const soldeAvances = Math.max(0, totalAvances - totalRembourses);

      const headers = ['Date', 'Type d\'opération', 'Détails', 'Débit (Sortie)', 'Crédit (Entrée)'];
      const data = filteredTxs.map(t => [
        dateLabel(t.date),
        t.type,
        t.details,
        t.debit > 0 ? fmtN(t.debit) + ' GNF' : '—',
        t.credit > 0 ? fmtN(t.credit) + ' GNF' : '—'
      ]);

      const subHeader = [
        `Employé : ${emp.nom} (${emp.poste || '—'})`,
        `Période du : ${_compDateFrom || 'Début'} au ${_compDateTo || 'Fin'}`,
        `Date d'export : ${new Date().toLocaleDateString('fr-FR')}`,
        `Salaire de base : ${fmt(emp.salaire || 0)} | Total versé : ${fmt(totalSalaires)}`,
        `Total avances accordées : ${fmt(totalAvances)} | Solde avances dû : ${fmt(soldeAvances)}`
      ];

      if (window.PDFExport && typeof window.PDFExport.generate === 'function') {
        await window.PDFExport.generate(
          `Relevé Financier — ${emp.nom}`,
          headers,
          data,
          { subHeader }
        );
      } else {
        UI.toast('Export PDF non disponible. Utilisez l\'impression.', 'error');
      }
    };

    render();
  }

  // Helper pour l'export des employés en PDF
  window.hrExportEmployesPDF = async () => {
    const rawEmployees = await DB.dbGetAll('users');
    const employees = rawEmployees.map(e => ({
      ...e,
      nom: e.nom || e.name || e.username || '',
      status: e.status || (e.active !== false ? 'actif' : 'inactif')
    }));

    const headers = ['Nom', 'Poste', 'Département', 'Téléphone', 'Salaire', 'Date Embauche', 'Statut'];
    const data = employees.map(e => [
      e.nom,
      e.poste || '—',
      e.department || '—',
      e.phone || e.telephone || '—',
      e.salaire ? fmtN(e.salaire) + ' GNF' : '—',
      dateLabel(e.dateEmbauche || e.hireDate),
      e.status
    ]);

    if (window.PDFExport && typeof window.PDFExport.generate === 'function') {
      await window.PDFExport.generate(
        `Liste du Personnel — ${new Date().toLocaleDateString('fr-FR')}`,
        headers,
        data,
        { subHeader: [`Nombre d'employés : ${employees.length}`] }
      );
    } else {
      UI.toast('Export PDF non disponible', 'error');
    }
  };

  // Helper pour l'export des congés en PDF
  window.hrExportCongesPDF = async (monthStr) => {
    const [rawEmployees, leaves] = await Promise.all([DB.dbGetAll('users'), DB.dbGetAll('hr_leaves')]);
    const employees = rawEmployees.map(e => ({ ...e, nom: e.nom || e.name || e.username || '', status: e.status || (e.active !== false ? 'actif' : 'inactif') }));
    const empMap = new Map(employees.map(e => [e.id, e]));
    const typeLabel = { conge:'Congé Payé', maladie:'Maladie', maternite:'Maternité', absence:'Absence Injustifiée', retard:'Retard', permission:'Permission' };

    const monthLeaves = leaves.filter(l => {
      const d = l.dateDebut || '';
      return d.slice(0, 7) === monthStr || (l.dateFin && l.dateFin.slice(0, 7) === monthStr);
    });

    const headers = ['Employé', 'Type', 'Début', 'Fin', 'Commentaire / Justificatif'];
    const data = monthLeaves.map(l => [
      empMap.get(l.employeeId)?.nom || '—',
      typeLabel[l.type] || l.type,
      dateLabel(l.dateDebut),
      l.dateFin ? dateLabel(l.dateFin) : dateLabel(l.dateDebut),
      l.justificatif || '—'
    ]);

    if (window.PDFExport && typeof window.PDFExport.generate === 'function') {
      await window.PDFExport.generate(
        `Registre des Congés & Absences — ${monthStr}`,
        headers,
        data,
        { subHeader: [`Période : ${monthStr}`, `Nombre de dossiers : ${monthLeaves.length}`] }
      );
    } else {
      UI.toast('Export PDF non disponible', 'error');
    }
  };

  // Helper pour l'export de la présence en PDF
  window.hrExportPresencePDF = async (dateStr) => {
    const [rawEmployees, attendance] = await Promise.all([DB.dbGetAll('users'), DB.dbGetAll('hr_attendance')]);
    const employees = rawEmployees.map(e => ({ ...e, nom: e.nom || e.name || e.username || '', status: e.status || (e.active !== false ? 'actif' : 'inactif') }));
    const empMap = new Map(employees.map(e => [e.id, e]));

    const dayRecords = attendance.filter(a => a.date === dateStr);
    const recMap = new Map(dayRecords.map(r => [r.employeeId, r]));
    const actifs = employees.filter(e => e.status === 'actif');

    function calcH(a, d) {
      if (!a || !d) return 0;
      const [ah, am] = a.split(':').map(Number);
      const [dh, dm] = d.split(':').map(Number);
      return Math.max(0, (dh * 60 + dm - ah * 60 - am) / 60);
    }

    const headers = ['Employé', 'Poste', 'Heure Arrivée', 'Heure Départ', 'Heures de présence', 'Statut'];
    const data = actifs.map(emp => {
      const rec = recMap.get(emp.id) || {};
      const h = calcH(rec.arrivee, rec.depart);
      return [
        emp.nom,
        emp.poste || '—',
        rec.arrivee || '—',
        rec.depart || '—',
        h > 0 ? h.toFixed(2) + ' h' : '—',
        rec.arrivee ? 'Présent' : 'Absent'
      ];
    });

    if (window.PDFExport && typeof window.PDFExport.generate === 'function') {
      await window.PDFExport.generate(
        `Registre de Présence du ${new Date(dateStr).toLocaleDateString('fr-FR')}`,
        headers,
        data,
        { subHeader: [`Date du rapport : ${dateStr}`, `Employés actifs : ${actifs.length}`] }
      );
    } else {
      UI.toast('Export PDF non disponible', 'error');
    }
  };

})();
