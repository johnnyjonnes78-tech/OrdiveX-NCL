/**
 * OrdiveX — Gestion des Equipes (Shifts)
 * v9.5.4 — Corrections critiques :
 *   - ID numérique pour users (autoIncrement) → parseInt()
 *   - settings keyPath = 'key' (pas 'id')
 *   - Affectation persistante et synchronisée Supabase
 *   - Tri par équipe, rôle, statut
 *   - Historique des ventes par équipe
 *   - Modales propres, centrées, avec bons boutons
 */

// ─── Config par défaut (modifiable) ──────────────────────────────────
let SHIFT_TYPES = {
  matin: { label: 'Equipe Matin', icon: 'sunrise', color: '#f59e0b', hours: '07h00 - 14h00', gradient: 'linear-gradient(135deg,#fbbf24,#f59e0b)' },
  soir:  { label: 'Equipe Soir',  icon: 'sunset',  color: '#6366f1', hours: '14h00 - 22h00', gradient: 'linear-gradient(135deg,#818cf8,#6366f1)' },
  nuit:  { label: 'Equipe Nuit',  icon: 'moon',    color: '#0ea5e9', hours: '22h00 - 07h00', gradient: 'linear-gradient(135deg,#38bdf8,#0ea5e9)' },
};

let _shiftsState = { tab: 'planning', sortField: 'name', sortDir: 'asc', filterTeam: '' };

// ─── Rendu principal ──────────────────────────────────────────────────
async function renderShifts(container) {
  const user = DB.AppState.currentUser;
  const isAdmin = user && (user.role === 'admin' || Auth.can('shifts_manage_teams'));

  const [allUsers, allSales, allShifts, allSettings] = await Promise.all([
    DB.dbGetAll('users'),
    DB.dbGetAll('sales'),
    DB.dbGetAll('shifts').catch(() => []),
    DB.dbGetAll('settings'),
  ]);

  // Charger la config heures depuis settings (keyPath = 'key')
  const shiftCfg = allSettings.find(s => s.key === 'shift_config');
  if (shiftCfg && shiftCfg.data) {
    SHIFT_TYPES = Object.assign({}, SHIFT_TYPES, shiftCfg.data);
  }

  const activeUsers = allUsers.filter(u => u.active !== false);
  const today = new Date().toISOString().split('T')[0];
  const openShift = allShifts.find(s => s.status === 'open');
  const todayShifts = allShifts.filter(s => (s.date || '').startsWith(today));
  const weekAgo = Date.now() - 7 * 86400000;
  const recentShifts = allShifts.filter(s => (s.openedAt || 0) > weekAgo)
    .sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));

  function calcKPIs(shift) {
    if (!shift) return { sales: 0, total: 0, items: 0 };
    const ss = allSales.filter(s => {
      const d = new Date(s.createdAt || s.date || 0).getTime();
      return d >= (shift.openedAt || 0) && d <= (shift.closedAt || Date.now());
    });
    return {
      sales: ss.length,
      total: ss.reduce((a, s) => a + (s.total || 0), 0),
      items: ss.reduce((a, s) => a + (s.items?.length || 0), 0),
      list: ss,
    };
  }

  const tabs = [
    { id: 'planning', label: 'Planning du jour',  icon: 'calendar-days' },
    { id: 'teams',    label: 'Liste equipes',     icon: 'users-round' },
    { id: 'tasks',    label: 'Taches',            icon: 'list-checks' },
    { id: 'absences', label: 'Absences',          icon: 'user-x' },
    { id: 'history',  label: 'Historique ventes', icon: 'history' },
    { id: 'report',   label: 'Rapport rapide',    icon: 'bar-chart-3' },
  ];

  container.innerHTML = `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <h1 style="font-size:22px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:10px">
            <i data-lucide="clock-3" style="width:24px;height:24px;color:var(--primary)"></i>
            Gestion des Equipes
          </h1>
          <p style="color:var(--text-muted);font-size:13px;margin-top:4px">
            ${new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}
          </p>
        </div>
        ${isAdmin ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="openShiftDialog()" ${openShift ? 'disabled title="Une equipe est deja ouverte"' : ''} style="display:flex;align-items:center;gap:6px">
            <i data-lucide="play-circle"></i> Ouvrir une session
          </button>
          ${openShift ? `<button class="btn btn-danger" onclick="closeCurrentShift('${openShift.id}')" style="display:flex;align-items:center;gap:6px">
            <i data-lucide="square"></i> Cloturer
          </button>` : ''}
        </div>` : ''}
      </div>
    </div>

    ${openShift ? _renderActiveShift(openShift, calcKPIs(openShift)) : `
    <div style="background:var(--surface);border:2px dashed var(--border);border-radius:16px;padding:40px;margin-bottom:24px;text-align:center;color:var(--text-muted)">
      <i data-lucide="clock" style="width:44px;height:44px;margin:0 auto 12px;display:block;opacity:0.25"></i>
      <p style="font-size:15px;font-weight:600">Aucune equipe ouverte</p>
      <p style="font-size:13px;margin-top:4px">Cliquez sur <strong>"Ouvrir une session"</strong> pour demarrer.</p>
    </div>`}

    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px" id="shifts-tabs">
      ${tabs.map(t => `
        <button onclick="_switchShiftsTab('${t.id}')" id="shifts-tab-${t.id}"
          class="btn ${_shiftsState.tab === t.id ? 'btn-primary' : 'btn-ghost'}"
          style="display:flex;align-items:center;gap:5px;white-space:nowrap;font-size:12px;padding:8px 12px;border-radius:10px;flex-shrink:0">
          <i data-lucide="${t.icon}" style="width:14px;height:14px;flex-shrink:0"></i>
          <span class="shifts-tab-label">${t.label}</span>
        </button>`).join('')}
    </div>

    <div id="shifts-tab-content"></div>
  `;

  if (window.lucide) lucide.createIcons();

  window._shiftsData = {
    allUsers: activeUsers,
    allShifts, todayShifts, recentShifts,
    openShift, allSales, calcKPIs, isAdmin,
  };
  _renderShiftsTab(_shiftsState.tab);
}

function _renderActiveShift(shift, kpi) {
  const t = SHIFT_TYPES[shift.type] || { label: shift.type, color: '#888', icon: 'clock', gradient: 'var(--gradient-primary)' };
  return `
  <div style="background:${t.gradient};border-radius:16px;padding:20px 24px;margin-bottom:24px;color:#fff;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
    <div style="width:52px;height:52px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <i data-lucide="${t.icon}" style="width:28px;height:28px"></i>
    </div>
    <div style="flex:1;min-width:160px">
      <div style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Session en cours</div>
      <div style="font-size:18px;font-weight:800">${t.label}</div>
      <div style="font-size:13px;opacity:0.85;margin-top:2px">
        <strong>${shift.managerName || 'N/A'}</strong> &middot; ${t.hours} &middot; ${(shift.members||[]).length} membre(s)
      </div>
    </div>
    <div style="display:flex;gap:20px;align-items:center">
      <div style="text-align:center"><div style="font-size:24px;font-weight:900">${kpi.sales}</div><div style="font-size:11px;opacity:0.7">Ventes</div></div>
      <div style="text-align:center"><div style="font-size:24px;font-weight:900">${kpi.total.toLocaleString('fr-FR')}</div><div style="font-size:11px;opacity:0.7">CA (GNF)</div></div>
      <div style="text-align:center"><div style="font-size:24px;font-weight:900">${kpi.items}</div><div style="font-size:11px;opacity:0.7">Articles</div></div>
    </div>
  </div>`;
}

// ─── Tabs ─────────────────────────────────────────────────────────────
function _switchShiftsTab(tabId) {
  _shiftsState.tab = tabId;
  document.querySelectorAll('#shifts-tabs button').forEach(b => {
    const isActive = b.id === `shifts-tab-${tabId}`;
    b.className = `btn ${isActive ? 'btn-primary' : 'btn-ghost'}`;
    b.style.cssText = 'display:flex;align-items:center;gap:6px;white-space:nowrap;font-size:13px;padding:8px 16px;border-radius:10px';
  });
  _renderShiftsTab(tabId);
}

function _renderShiftsTab(tabId) {
  const ct = document.getElementById('shifts-tab-content');
  if (!ct) return;
  const d = window._shiftsData;
  if (!d) return;
  switch (tabId) {
    case 'planning': ct.innerHTML = _renderPlanningTab(d); break;
    case 'teams':    ct.innerHTML = _renderTeamsTab(d); break;
    case 'tasks':    ct.innerHTML = _renderTasksTab(d); break;
    case 'absences': ct.innerHTML = _renderAbsencesTab(d); break;
    case 'history':  ct.innerHTML = _renderHistoryTab(d); break;
    case 'report':   ct.innerHTML = _renderReportTab(d); break;
  }
  if (window.lucide) lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════
// TAB 1 — Planning du jour
// ═══════════════════════════════════════════════════════════
function _renderPlanningTab(d) {
  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">
    ${Object.entries(SHIFT_TYPES).map(([key, t]) => {
      const slot = d.todayShifts.find(s => s.type === key);
      const kpi  = slot ? d.calcKPIs(slot) : null;
      const members = slot?.members || [];
      const statusLabel = slot?.status === 'open' ? 'En cours' : slot ? 'Terminee' : 'Non planifiee';
      const statusCls   = slot?.status === 'open' ? 'badge-success' : slot ? 'badge-neutral' : 'badge-warning';
      return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden">
        <div style="background:${t.gradient};padding:16px 20px;color:#fff;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:10px">
            <i data-lucide="${t.icon}" style="width:22px;height:22px"></i>
            <div>
              <div style="font-weight:800;font-size:15px">${t.label}</div>
              <div style="font-size:12px;opacity:0.8">${t.hours}</div>
            </div>
          </div>
          <span class="badge ${statusCls}" style="font-size:11px">${statusLabel}</span>
        </div>
        <div style="padding:16px 20px">
          ${slot ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:12px">
              <div><span style="font-size:12px;color:var(--text-muted)">Responsable</span><br><strong style="font-size:13px">${slot.managerName || 'N/A'}</strong></div>
              ${kpi ? `<div style="text-align:right"><span style="font-size:12px;color:var(--text-muted)">CA</span><br><strong style="font-size:13px;color:var(--primary)">${kpi.total.toLocaleString('fr-FR')} GNF</strong></div>` : ''}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Membres (${members.length})</div>
            ${members.length > 0
              ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${members.map(m => `
                  <span style="background:var(--bg);border:1px solid var(--border);padding:4px 10px;border-radius:100px;font-size:12px;font-weight:500">${m}</span>
                `).join('')}</div>`
              : '<p style="font-size:12px;color:var(--text-light);font-style:italic">Aucun membre affecte</p>'}
          ` : `<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px 0">
            <i data-lucide="info" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px"></i>
            Pas de session prevue pour ce creneau
          </p>`}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// TAB 2 — Liste des équipes + tri + affectation
// ═══════════════════════════════════════════════════════════
function _renderTeamsTab(d) {
  const roleLabels = { admin: 'Admin', pharmacien: 'Pharmacien', caissier: 'Caissier', manager: 'Manager' };

  // Tri
  let users = [...d.allUsers];
  const { sortField, sortDir, filterTeam } = _shiftsState;
  if (filterTeam) users = users.filter(u => (u.shift || '') === filterTeam);
  users.sort((a, b) => {
    let va = sortField === 'team' ? (a.shift || 'zz') : sortField === 'role' ? (a.role || '') : (a.name || a.username || '');
    let vb = sortField === 'team' ? (b.shift || 'zz') : sortField === 'role' ? (b.role || '') : (b.name || b.username || '');
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  function sortBtn(field, label) {
    const active = sortField === field;
    const icon = active ? (sortDir === 'asc' ? 'arrow-up' : 'arrow-down') : 'arrow-up-down';
    return `<button onclick="_setShiftsSort('${field}')" style="display:inline-flex;align-items:center;gap:4px;background:none;border:none;cursor:pointer;font-weight:${active?700:500};color:${active?'var(--primary)':'var(--text-muted)'};font-size:12px">
      ${label} <i data-lucide="${icon}" style="width:12px;height:12px"></i>
    </button>`;
  }

  return `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px">
        <i data-lucide="users-round" style="width:18px;height:18px;color:var(--primary)"></i>
        Employes &amp; Affectations
      </h3>
      ${d.isAdmin ? `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select onchange="_setShiftsFilter(this.value)" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px;cursor:pointer">
          <option value="" ${!filterTeam?'selected':''}>Toutes les equipes</option>
          <option value="matin" ${filterTeam==='matin'?'selected':''}>Equipe Matin</option>
          <option value="soir"  ${filterTeam==='soir' ?'selected':''}>Equipe Soir</option>
          <option value="nuit"  ${filterTeam==='nuit' ?'selected':''}>Equipe Nuit</option>
          <option value=""      ${filterTeam===''&&filterTeam!==undefined?'':''}> </option>
        </select>
        <button class="btn btn-sm" style="border:1px solid var(--border);background:var(--bg);display:flex;align-items:center;gap:5px;font-size:12px" onclick="_configureShifts()">
          <i data-lucide="settings" style="width:13px;height:13px"></i> Heures
        </button>
      </div>` : ''}
    </div>

    <div style="overflow-x:auto">
      <table class="data-table" style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:8px 12px">${sortBtn('name','Employe')}</th>
            <th style="text-align:left;padding:8px 12px">${sortBtn('role','Role')}</th>
            <th style="text-align:center;padding:8px 12px">${sortBtn('team','Equipe')}</th>
            <th style="text-align:center;padding:8px 12px">Statut</th>
            ${d.isAdmin ? '<th style="text-align:center;padding:8px 12px">Affecter</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const team = u.shift || null;
            const t = team ? SHIFT_TYPES[team] : null;
            return `<tr style="border-bottom:1px solid var(--border);transition:background 0.15s" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
              <td style="padding:10px 12px">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:32px;height:32px;border-radius:50%;background:${t ? t.gradient : 'var(--gradient-primary)'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0">
                    ${(u.name || u.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <strong style="font-size:13px">${u.name || u.username}</strong>
                </div>
              </td>
              <td style="padding:10px 12px;font-size:13px">${roleLabels[u.role] || u.role || '—'}</td>
              <td style="padding:10px 12px;text-align:center">
                ${t ? `<span style="display:inline-flex;align-items:center;gap:4px;background:${t.color}20;color:${t.color};padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;border:1px solid ${t.color}30">
                  <i data-lucide="${t.icon}" style="width:12px;height:12px"></i> ${t.label}
                </span>` : '<span style="color:var(--text-light);font-size:12px;font-style:italic">Non affecte</span>'}
              </td>
              <td style="padding:10px 12px;text-align:center">
                <span class="badge ${u.absent ? 'badge-danger' : 'badge-success'}" style="font-size:11px">${u.absent ? 'Absent' : 'Present'}</span>
              </td>
              ${d.isAdmin ? `<td style="padding:10px 12px;text-align:center">
                <select onchange="_assignUserToTeam(${u.id}, this.value, this)" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px;cursor:pointer;min-width:120px">
                  <option value="" ${!team ? 'selected' : ''}>-- Non affecte --</option>
                  <option value="matin" ${team === 'matin' ? 'selected' : ''}>Equipe Matin</option>
                  <option value="soir"  ${team === 'soir'  ? 'selected' : ''}>Equipe Soir</option>
                  <option value="nuit"  ${team === 'nuit'  ? 'selected' : ''}>Equipe Nuit</option>
                </select>
              </td>` : ''}
            </tr>`;
          }).join('')}
          ${users.length === 0 ? `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text-muted)">Aucun employe trouve</td></tr>` : ''}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// TAB 3 — Taches
// ═══════════════════════════════════════════════════════════
function _renderTasksTab(d) {
  const tasks = JSON.parse(localStorage.getItem('ordivex_shift_tasks') || '[]');
  const done = tasks.filter(t => t.done).length;
  return `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px">
        <i data-lucide="list-checks" style="width:18px;height:18px;color:var(--primary)"></i>
        Taches de l'equipe
        ${tasks.length > 0 ? `<span style="background:var(--primary);color:#fff;padding:2px 8px;border-radius:100px;font-size:11px">${done}/${tasks.length}</span>` : ''}
      </h3>
      <button class="btn btn-primary btn-sm" onclick="_addShiftTask()" style="display:flex;align-items:center;gap:6px">
        <i data-lucide="plus" style="width:14px;height:14px"></i> Ajouter
      </button>
    </div>
    ${tasks.length === 0 ? `
    <div style="text-align:center;padding:32px 0;color:var(--text-muted)">
      <i data-lucide="clipboard-list" style="width:40px;height:40px;margin:0 auto 12px;display:block;opacity:0.25"></i>
      <p style="font-size:14px;font-weight:600">Aucune tache</p>
    </div>` : `
    <div style="display:flex;flex-direction:column;gap:8px">
      ${tasks.map((t, i) => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:12px;${t.done?'opacity:0.5':''}">
        <button onclick="_toggleShiftTask(${i})" style="flex-shrink:0;width:22px;height:22px;border-radius:6px;border:2px solid ${t.done?'var(--success)':'var(--border)'};background:${t.done?'var(--success)':'transparent'};cursor:pointer;display:flex;align-items:center;justify-content:center">
          ${t.done ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;${t.done?'text-decoration:line-through':''}">${t.text}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
            ${SHIFT_TYPES[t.shift]?.label || 'General'} &middot;
            <span style="color:${t.priority==='high'?'var(--danger)':t.priority==='medium'?'var(--warning)':'var(--success)'}">
              ${t.priority==='high'?'Haute':t.priority==='medium'?'Moyenne':'Basse'}
            </span>
          </div>
        </div>
        <button onclick="_removeShiftTask(${i})" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px">
          <i data-lucide="trash-2" style="width:14px;height:14px"></i>
        </button>
      </div>`).join('')}
    </div>`}
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// TAB 4 — Absences
// ═══════════════════════════════════════════════════════════
function _renderAbsencesTab(d) {
  const today = new Date().toISOString().split('T')[0];
  const allAbs = JSON.parse(localStorage.getItem('ordivex_absences') || '[]');
  const todayAbs = allAbs.filter(a => a.date === today);
  return `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px">
        <i data-lucide="user-x" style="width:18px;height:18px;color:var(--danger)"></i>
        Absences &amp; Remplacements
      </h3>
      ${d.isAdmin ? `<button class="btn btn-primary btn-sm" onclick="_declareAbsence()" style="display:flex;align-items:center;gap:6px">
        <i data-lucide="user-minus" style="width:14px;height:14px"></i> Declarer
      </button>` : ''}
    </div>
    ${todayAbs.length === 0 ? `
    <div style="text-align:center;padding:32px 0;color:var(--text-muted)">
      <i data-lucide="smile" style="width:40px;height:40px;margin:0 auto 12px;display:block;opacity:0.25"></i>
      <p style="font-size:14px;font-weight:600">Aucune absence aujourd'hui</p>
    </div>` : `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${todayAbs.map((a, i) => `
      <div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:12px">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--danger);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0">
          ${(a.name||'?').charAt(0).toUpperCase()}
        </div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:14px">${a.name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${a.reason || 'Motif non precise'}</div>
        </div>
        ${a.replacement ? `<div style="text-align:right;flex-shrink:0">
          <div style="font-size:11px;color:var(--text-muted)">Remplacant</div>
          <div style="font-weight:600;font-size:13px;color:var(--success)">${a.replacement}</div>
        </div>` : `<span class="badge badge-warning" style="font-size:11px;flex-shrink:0">Pas de remplacant</span>`}
        ${d.isAdmin ? `<button onclick="_removeAbsence(${i})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);padding:4px;flex-shrink:0">
          <i data-lucide="x" style="width:14px;height:14px"></i>
        </button>` : ''}
      </div>`).join('')}
    </div>`}
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// TAB 5 — Historique des ventes par équipe
// ═══════════════════════════════════════════════════════════
function _renderHistoryTab(d) {
  const filter = _shiftsState.filterTeam || '';
  const allShifts = filter
    ? d.allShifts.filter(s => s.type === filter)
    : d.allShifts;
  const sorted = [...allShifts].sort((a, b) => (b.openedAt||0) - (a.openedAt||0)).slice(0, 30);

  return `
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700;display:flex;align-items:center;gap:8px">
        <i data-lucide="history" style="width:18px;height:18px;color:var(--primary)"></i>
        Historique des Sessions &amp; Ventes
      </h3>
      <select onchange="_setShiftsFilter(this.value)" style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);font-size:12px">
        <option value="" ${!filter?'selected':''}>Toutes les equipes</option>
        <option value="matin" ${filter==='matin'?'selected':''}>Equipe Matin</option>
        <option value="soir"  ${filter==='soir' ?'selected':''}>Equipe Soir</option>
        <option value="nuit"  ${filter==='nuit' ?'selected':''}>Equipe Nuit</option>
      </select>
    </div>

    ${sorted.length === 0 ? `<p style="text-align:center;color:var(--text-muted);padding:32px">Aucune session trouvee.</p>` : `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${sorted.map(shift => {
        const t = SHIFT_TYPES[shift.type] || { label: shift.type, color: '#888', icon: 'clock', gradient: 'var(--gradient-primary)' };
        const kpi = d.calcKPIs(shift);
        const opened = shift.openedAt ? new Date(shift.openedAt).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
        const dur = shift.closedAt ? Math.round((shift.closedAt - shift.openedAt)/60000) + ' min' : 'En cours';
        return `
        <div style="border:1px solid var(--border);border-radius:12px;overflow:hidden">
          <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:${t.color}10;border-bottom:1px solid ${t.color}20;flex-wrap:wrap;gap:10px">
            <div style="width:36px;height:36px;background:${t.gradient};border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i data-lucide="${t.icon}" style="width:18px;height:18px;color:#fff"></i>
            </div>
            <div style="flex:1;min-width:120px">
              <div style="font-weight:700;font-size:13px">${t.label}</div>
              <div style="font-size:11px;color:var(--text-muted)">${opened} &middot; ${dur} &middot; Resp: ${shift.managerName||'N/A'}</div>
            </div>
            <div style="display:flex;gap:16px;align-items:center">
              <div style="text-align:right"><div style="font-size:16px;font-weight:800;color:var(--primary)">${kpi.total.toLocaleString('fr-FR')} GNF</div><div style="font-size:11px;color:var(--text-muted)">${kpi.sales} vente(s)</div></div>
              <span class="badge ${shift.status==='open'?'badge-success':'badge-neutral'}" style="font-size:11px">${shift.status==='open'?'Ouverte':'Cloturee'}</span>
              ${kpi.sales > 0 ? `<button onclick="_toggleShiftSales('${shift.id}')" style="background:none;border:1px solid var(--border);border-radius:8px;padding:4px 10px;cursor:pointer;font-size:11px;display:flex;align-items:center;gap:4px;color:var(--text-muted)">
                <i data-lucide="chevron-down" style="width:12px;height:12px"></i> Ventes
              </button>` : ''}
            </div>
          </div>
          <div id="shift-sales-${shift.id}" style="display:none;padding:12px 16px">
            ${kpi.list.slice(0,15).map(s => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
              <div>
                <span style="color:var(--text-muted)">Ref:</span> <strong>${s.receiptNumber||s.id}</strong>
                <span style="color:var(--text-muted);margin-left:8px">${s.sellerName||'—'}</span>
              </div>
              <div style="font-weight:700;color:var(--primary)">${(s.total||0).toLocaleString('fr-FR')} GNF</div>
            </div>`).join('')}
            ${kpi.list.length > 15 ? `<p style="font-size:11px;color:var(--text-muted);margin-top:8px">+${kpi.list.length-15} autres ventes...</p>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`}
  </div>`;
}

function _toggleShiftSales(shiftId) {
  const el = document.getElementById(`shift-sales-${shiftId}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════
// TAB 6 — Rapport rapide
// ═══════════════════════════════════════════════════════════
function _renderReportTab(d) {
  const totalSessions = d.recentShifts.length;
  const totalCA = d.recentShifts.reduce((a, s) => a + d.calcKPIs(s).total, 0);
  const totalVentes = d.recentShifts.reduce((a, s) => a + d.calcKPIs(s).sales, 0);
  const closed = d.recentShifts.filter(s => s.closedAt);
  const avgDuration = closed.length ? closed.reduce((a, s) => a + (s.closedAt - s.openedAt), 0) / closed.length : 0;

  const byType = {};
  for (const s of d.recentShifts) {
    if (!byType[s.type]) byType[s.type] = { sessions: 0, ca: 0, ventes: 0 };
    const k = d.calcKPIs(s);
    byType[s.type].sessions++;
    byType[s.type].ca += k.total;
    byType[s.type].ventes += k.sales;
  }

  return `
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
    ${[
      ['Sessions (7j)', totalSessions, 'var(--text)', ''],
      ['CA total (7j)', totalCA.toLocaleString('fr-FR'), 'var(--primary)', 'GNF'],
      ['Ventes (7j)', totalVentes, 'var(--success)', ''],
      ['Duree moy.', avgDuration > 0 ? Math.round(avgDuration/60000)+'min' : 'N/A', 'var(--warning)', ''],
    ].map(([lbl, val, col, sub]) => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:18px 20px">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px">${lbl}</div>
      <div style="font-size:26px;font-weight:900;color:${col}">${val}</div>
      ${sub ? `<div style="font-size:11px;color:var(--text-muted)">${sub}</div>` : ''}
    </div>`).join('')}
  </div>
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px">
    <h3 style="font-size:15px;font-weight:700;margin-bottom:16px;display:flex;align-items:center;gap:8px">
      <i data-lucide="pie-chart" style="width:16px;height:16px;color:var(--primary)"></i>
      Performance par equipe (7 derniers jours)
    </h3>
    ${Object.keys(byType).length === 0
      ? '<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px">Aucune donnee.</p>'
      : `<div style="display:flex;flex-direction:column;gap:14px">
        ${Object.entries(byType).map(([key, data]) => {
          const t = SHIFT_TYPES[key] || { label: key, color: '#888', icon: 'clock' };
          const pct = totalCA > 0 ? Math.round(data.ca / totalCA * 100) : 0;
          return `
          <div style="display:flex;align-items:center;gap:14px">
            <div style="width:36px;height:36px;background:${t.color}15;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i data-lucide="${t.icon}" style="width:18px;height:18px;color:${t.color}"></i>
            </div>
            <div style="flex:1">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-weight:600;font-size:13px">${t.label}</span>
                <span style="font-size:12px;color:var(--text-muted)">${data.sessions} sessions &middot; ${data.ventes} ventes</span>
              </div>
              <div style="background:var(--bg);border-radius:100px;height:8px;overflow:hidden">
                <div style="background:${t.color};height:100%;width:${pct}%;border-radius:100px;transition:width 0.5s"></div>
              </div>
            </div>
            <div style="font-weight:800;font-size:13px;min-width:90px;text-align:right;color:${t.color}">${data.ca.toLocaleString('fr-FR')} GNF</div>
          </div>`;
        }).join('')}
      </div>`}
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// Actions principales
// ═══════════════════════════════════════════════════════════
function openShiftDialog() {
  DB.dbGetAll('users').then(allUsers => {
    const managers = allUsers.filter(u => u.active !== false && ['admin','pharmacien','caissier','manager'].includes(u.role));
    UI.modal('Ouvrir une session equipe', `
      <div style="display:flex;flex-direction:column;gap:16px;padding:4px 0">
        <div class="form-group">
          <label style="font-weight:600;font-size:13px;margin-bottom:6px;display:block">Type d'equipe</label>
          <select id="shift-type-sel" class="form-control">
            <option value="matin">Equipe Matin (${SHIFT_TYPES.matin.hours})</option>
            <option value="soir">Equipe Soir (${SHIFT_TYPES.soir.hours})</option>
            <option value="nuit">Equipe Nuit (${SHIFT_TYPES.nuit.hours})</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight:600;font-size:13px;margin-bottom:6px;display:block">Responsable</label>
          <select id="shift-manager-sel" class="form-control">
            ${managers.map(u => `<option value="${u.id}" data-name="${u.name || u.username}">${u.name || u.username} (${u.role})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight:600;font-size:13px;margin-bottom:6px;display:block">Membres (${managers.length})</label>
          <input type="text" id="shift-user-search" class="form-control" placeholder="Rechercher un employe..." style="margin-bottom:8px"
            onkeyup="const q=this.value.toLowerCase();document.querySelectorAll('.smb-lbl').forEach(l=>{l.style.display=l.dataset.name.includes(q)?'flex':'none'})">
          <div style="display:flex;flex-wrap:wrap;gap:6px;max-height:180px;overflow-y:auto;padding:8px;background:var(--bg);border-radius:10px;border:1px solid var(--border)">
            ${managers.map(u => `
            <label class="smb-lbl" data-name="${(u.name||u.username).toLowerCase()}" style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:var(--surface);border:1px solid var(--border);border-radius:100px;cursor:pointer;font-size:12px;font-weight:500">
              <input type="checkbox" class="shift-member-cb" value="${u.name || u.username}"> ${u.name || u.username}
            </label>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label style="font-weight:600;font-size:13px;margin-bottom:6px;display:block">Note (optionnel)</label>
          <input type="text" id="shift-note" class="form-control" placeholder="Ex: Effectif reduit, formation...">
        </div>
      </div>
    `, {
      footer: `
        <button class="btn btn-ghost" onclick="UI.closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="saveOpenShift()">Ouvrir la session</button>
      `
    });
  });
}

async function saveOpenShift() {
  const type = document.getElementById('shift-type-sel')?.value;
  const managerId = document.getElementById('shift-manager-sel')?.value;
  const managerName = document.getElementById('shift-manager-sel')?.selectedOptions[0]?.dataset?.name;
  const note = document.getElementById('shift-note')?.value;
  const members = [...document.querySelectorAll('.shift-member-cb:checked')].map(cb => cb.value);
  if (!type || !managerId) { UI.toast('Selectionnez un type et un responsable', 'warning'); return; }

  const shift = {
    id: 'shift_' + Date.now(),
    type, managerName, managerId, members,
    note: note || '',
    status: 'open',
    openedAt: Date.now(),
    closedAt: null,
    date: new Date().toISOString(),
  };

  try {
    await DB.dbPut('shifts', shift);
    await DB.writeAudit('SHIFT_OPEN', 'shifts', shift.id, { type, managerName, members: members.length }, DB.AppState.currentUser?.id);
    UI.closeModal();
    UI.toast(`${SHIFT_TYPES[type]?.label} ouverte avec ${members.length} membre(s). Bonne session !`, 'success', 4000);
    Router.navigate('shifts');
  } catch(e) {
    UI.toast('Erreur ouverture: ' + e.message, 'error');
  }
}

async function closeCurrentShift(shiftId) {
  const ok = await UI.confirm('Cloturer cette session ?', 'Les ventes seront comptabilisees. Action irreversible.');
  if (!ok) return;
  try {
    const shift = await DB.dbGet('shifts', shiftId);
    if (!shift) return;
    shift.status = 'closed';
    shift.closedAt = Date.now();
    await DB.dbPut('shifts', shift);
    const dur = Math.round((shift.closedAt - shift.openedAt) / 60000);
    await DB.writeAudit('SHIFT_CLOSE', 'shifts', shiftId, { type: shift.type, duration: dur + ' min' }, DB.AppState.currentUser?.id);
    UI.toast('Session cloturee. Duree : ' + dur + ' min.', 'success');
    Router.navigate('shifts');
  } catch(e) {
    UI.toast('Erreur cloture: ' + e.message, 'error');
  }
}

// ─── Affectation (avec parseInt pour clé numérique) ──────────────────
async function _assignUserToTeam(userId, team, selectEl) {
  const numId = parseInt(userId, 10);
  if (isNaN(numId)) { UI.toast('ID utilisateur invalide', 'error'); return; }
  try {
    const user = await DB.dbGet('users', numId);
    if (!user) { UI.toast('Utilisateur introuvable (ID: ' + numId + ')', 'error'); return; }
    user.shift = team || null;
    await DB.dbPut('users', user);
    UI.toast(
      `${user.name || user.username} ${team ? 'affecte a ' + (SHIFT_TYPES[team]?.label || team) : 'retire de toute equipe'}`,
      'success'
    );
    // Mettre à jour visuellement la cellule equipe sans recharger tout le tableau
    if (selectEl) {
      const row = selectEl.closest('tr');
      if (row) {
        const t = team ? SHIFT_TYPES[team] : null;
        const teamCell = row.cells[2];
        if (teamCell) {
          teamCell.innerHTML = t
            ? `<span style="display:inline-flex;align-items:center;gap:4px;background:${t.color}20;color:${t.color};padding:4px 12px;border-radius:100px;font-size:12px;font-weight:700;border:1px solid ${t.color}30">
                <i data-lucide="${t.icon}" style="width:12px;height:12px"></i> ${t.label}
              </span>`
            : '<span style="color:var(--text-light);font-size:12px;font-style:italic">Non affecte</span>';
          if (window.lucide) lucide.createIcons();
        }
      }
    }
  } catch(e) {
    UI.toast('Erreur affectation: ' + e.message, 'error');
  }
}

// ─── Tri & Filtre ─────────────────────────────────────────────────────
function _setShiftsSort(field) {
  if (_shiftsState.sortField === field) {
    _shiftsState.sortDir = _shiftsState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    _shiftsState.sortField = field;
    _shiftsState.sortDir = 'asc';
  }
  _renderShiftsTab(_shiftsState.tab);
}

function _setShiftsFilter(val) {
  _shiftsState.filterTeam = val;
  _renderShiftsTab(_shiftsState.tab);
}

// ─── Configuration des heures ─────────────────────────────────────────
function _configureShifts() {
  UI.modal('Configuration des Horaires', `
    <div style="display:flex;flex-direction:column;gap:14px">
      ${Object.entries(SHIFT_TYPES).map(([key, t]) => `
      <div class="form-group">
        <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <span style="width:10px;height:10px;border-radius:50%;background:${t.color};display:inline-block"></span>
          ${t.label}
        </label>
        <input type="text" id="conf-hours-${key}" class="form-control" value="${t.hours}" placeholder="Ex: 07h00 - 14h00">
      </div>`).join('')}
    </div>
  `, {
    footer: `
      <button class="btn btn-ghost" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="_saveShiftConfig()">Enregistrer</button>
    `
  });
}

async function _saveShiftConfig() {
  const newConfig = JSON.parse(JSON.stringify(SHIFT_TYPES));
  Object.keys(newConfig).forEach(key => {
    const val = document.getElementById(`conf-hours-${key}`)?.value?.trim();
    if (val) newConfig[key].hours = val;
  });
  try {
    // settings a keyPath = 'key' (pas 'id')
    await DB.dbPut('settings', { key: 'shift_config', data: newConfig });
    SHIFT_TYPES = newConfig;
    UI.closeModal();
    UI.toast('Horaires mis a jour et synchronises.', 'success');
    _renderShiftsTab(_shiftsState.tab);
  } catch(e) {
    UI.toast('Erreur config: ' + e.message, 'error');
  }
}

// ─── Tâches ───────────────────────────────────────────────────────────
function _addShiftTask() {
  UI.modal('Ajouter une tache', `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px">Description</label>
        <input type="text" id="task-text" class="form-control" placeholder="Ex: Verifier les perimes, nettoyer le comptoir...">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="form-group">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px">Equipe</label>
          <select id="task-shift" class="form-control">
            <option value="matin">Matin</option><option value="soir">Soir</option><option value="nuit">Nuit</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px">Priorite</label>
          <select id="task-priority" class="form-control">
            <option value="low">Basse</option><option value="medium" selected>Moyenne</option><option value="high">Haute</option>
          </select>
        </div>
      </div>
    </div>
  `, {
    footer: `
      <button class="btn btn-ghost" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="_confirmAddShiftTask()">Ajouter</button>
    `
  });
}

function _confirmAddShiftTask() {
  const text = document.getElementById('task-text')?.value?.trim();
  if (!text) { UI.toast('Description requise', 'warning'); return; }
  const tasks = JSON.parse(localStorage.getItem('ordivex_shift_tasks') || '[]');
  tasks.push({
    text,
    shift: document.getElementById('task-shift')?.value || 'matin',
    priority: document.getElementById('task-priority')?.value || 'medium',
    done: false,
    date: new Date().toISOString(),
  });
  localStorage.setItem('ordivex_shift_tasks', JSON.stringify(tasks));
  UI.closeModal();
  UI.toast('Tache ajoutee', 'success');
  _renderShiftsTab('tasks');
}

function _toggleShiftTask(idx) {
  const tasks = JSON.parse(localStorage.getItem('ordivex_shift_tasks') || '[]');
  if (tasks[idx]) tasks[idx].done = !tasks[idx].done;
  localStorage.setItem('ordivex_shift_tasks', JSON.stringify(tasks));
  _renderShiftsTab('tasks');
}

function _removeShiftTask(idx) {
  const tasks = JSON.parse(localStorage.getItem('ordivex_shift_tasks') || '[]');
  tasks.splice(idx, 1);
  localStorage.setItem('ordivex_shift_tasks', JSON.stringify(tasks));
  _renderShiftsTab('tasks');
}

// ─── Absences ─────────────────────────────────────────────────────────
function _declareAbsence() {
  const d = window._shiftsData;
  UI.modal('Declarer une absence', `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px">Employe absent</label>
        <select id="abs-user" class="form-control">
          ${d.allUsers.map(u => `<option value="${u.name||u.username}">${u.name||u.username} (${u.role})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px">Motif</label>
        <input type="text" id="abs-reason" class="form-control" placeholder="Ex: Maladie, conge, formation...">
      </div>
      <div class="form-group">
        <label style="font-weight:600;font-size:13px;display:block;margin-bottom:6px">Remplacant (optionnel)</label>
        <select id="abs-replacement" class="form-control">
          <option value="">-- Aucun --</option>
          ${d.allUsers.map(u => `<option value="${u.name||u.username}">${u.name||u.username}</option>`).join('')}
        </select>
      </div>
    </div>
  `, {
    footer: `
      <button class="btn btn-ghost" onclick="UI.closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="_confirmDeclareAbsence()">Confirmer</button>
    `
  });
}

function _confirmDeclareAbsence() {
  const name = document.getElementById('abs-user')?.value;
  const reason = document.getElementById('abs-reason')?.value;
  const replacement = document.getElementById('abs-replacement')?.value;
  if (!name) { UI.toast('Selectionnez un employe', 'warning'); return; }
  const absences = JSON.parse(localStorage.getItem('ordivex_absences') || '[]');
  absences.push({ name, reason, replacement, date: new Date().toISOString().split('T')[0] });
  localStorage.setItem('ordivex_absences', JSON.stringify(absences));
  UI.closeModal();
  UI.toast(`Absence declaree pour ${name}`, 'success');
  _renderShiftsTab('absences');
}

function _removeAbsence(idx) {
  const absences = JSON.parse(localStorage.getItem('ordivex_absences') || '[]');
  absences.splice(idx, 1);
  localStorage.setItem('ordivex_absences', JSON.stringify(absences));
  _renderShiftsTab('absences');
}

// ─── Exports globaux ──────────────────────────────────────────────────
window.openShiftDialog       = openShiftDialog;
window.saveOpenShift         = saveOpenShift;
window.closeCurrentShift     = closeCurrentShift;
window._switchShiftsTab      = _switchShiftsTab;
window._assignUserToTeam     = _assignUserToTeam;
window._setShiftsSort        = _setShiftsSort;
window._setShiftsFilter      = _setShiftsFilter;
window._configureShifts      = _configureShifts;
window._saveShiftConfig      = _saveShiftConfig;
window._addShiftTask         = _addShiftTask;
window._confirmAddShiftTask  = _confirmAddShiftTask;
window._toggleShiftTask      = _toggleShiftTask;
window._removeShiftTask      = _removeShiftTask;
window._declareAbsence       = _declareAbsence;
window._confirmDeclareAbsence= _confirmDeclareAbsence;
window._removeAbsence        = _removeAbsence;
window._toggleShiftSales     = _toggleShiftSales;

Router.register('shifts', renderShifts);

// ─── DÉMON : Fin automatique de session d'équipe ──────────────────────────────
// Vérifie toutes les 60 secondes si une session ouverte a dépassé son horaire de fin.
// Affiche une modale d'alerte, représentée toutes les 12 minutes si refusée.
(function _initShiftExpiryDaemon() {
  let _lastWarnedShiftId = null;
  let _lastWarnTime = 0;
  const REMIND_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes

  async function _checkShiftExpiry() {
    if (!DB.AppState.currentUser) return;
    try {
      const allShifts = await DB.dbGetAll('shifts');
      const openShift = allShifts.find(s => s.status === 'open');
      if (!openShift) { _lastWarnedShiftId = null; return; }

      const t = SHIFT_TYPES[openShift.type];
      if (!t || !t.hours) return;

      // Extraire l'heure de fin : "07h00 - 14h00" => "14h00"
      const parts = t.hours.split('-');
      if (parts.length < 2) return;
      const endStr = parts[1].trim().replace('h', ':');
      const [endH, endM] = endStr.split(':').map(Number);
      if (isNaN(endH) || isNaN(endM)) return;

      const startStr = parts[0].trim().replace('h', ':');
      const [startH] = startStr.split(':').map(Number);
      const now = new Date();
      const curH = now.getHours();
      const curM = now.getMinutes();

      // Calcul d'expiration (gère le shift de nuit)
      let expired = false;
      if (startH > endH) {
        // Shift de nuit : expire le lendemain matin
        if (curH >= endH && curH < startH) expired = true;
      } else {
        if (curH > endH || (curH === endH && curM >= endM)) expired = true;
      }

      if (!expired) return;

      const now_ms = Date.now();
      const alreadyWarned = (_lastWarnedShiftId === openShift.id);
      const cooldownPassed = (now_ms - _lastWarnTime) >= REMIND_INTERVAL_MS;

      if (alreadyWarned && !cooldownPassed) return;

      _lastWarnedShiftId = openShift.id;
      _lastWarnTime = now_ms;

      // Afficher la modale d'alerte de fin de session
      const endTime = t.hours.split('-')[1].trim();
      const overlay = document.createElement('div');
      overlay.id = 'shift-expiry-alert';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
      overlay.innerHTML = `
        <div style="background:var(--surface,#fff);border-radius:20px;padding:32px 36px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">
          <div style="font-size:54px;margin-bottom:12px">⏰</div>
          <h2 style="font-size:18px;font-weight:800;margin-bottom:8px;color:var(--text,#000)">Session terminée</h2>
          <p style="font-size:13px;color:var(--text-muted,#666);line-height:1.5;margin-bottom:20px">
            L'horaire de l'<strong>${t.label}</strong> s'est terminé à <strong>${endTime}</strong>.<br>
            Veuillez clôturer la session pour enregistrer les données et laisser la place à l'équipe suivante.
          </p>
          <div style="display:flex;gap:10px;justify-content:center">
            <button id="shift-expiry-close-btn" style="flex:1;padding:11px 16px;border-radius:10px;background:#c0392b;color:#fff;border:none;font-size:14px;font-weight:700;cursor:pointer">
              ✅ Clôturer maintenant
            </button>
            <button id="shift-expiry-later-btn" style="flex:1;padding:11px 16px;border-radius:10px;background:var(--surface-2,#f0f0f0);color:var(--text,#333);border:none;font-size:14px;cursor:pointer">
              Continuer (rappel dans 12 min)
            </button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      document.getElementById('shift-expiry-close-btn').onclick = async () => {
        overlay.remove();
        await closeCurrentShift(openShift.id);
      };
      document.getElementById('shift-expiry-later-btn').onclick = () => {
        overlay.remove();
      };
    } catch(e) { /* silencieux */ }
  }

  // Lancement immédiat puis toutes les 60 secondes
  setTimeout(_checkShiftExpiry, 5000);
  setInterval(_checkShiftExpiry, 60000);
})();
