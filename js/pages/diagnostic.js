/**
 * OrdiveX — diagnostic.js
 * Diagnostic du poste — Hardening Lot 6
 *
 * Page reservee aux administrateurs, verrouillee sur le role (pas sur une
 * permission delegable via les Parametres — un diagnostic technique donne
 * une vue sur l'infrastructure interne, pas sur un module metier).
 * Chaque valeur affichee est mesuree en direct a l'ouverture de la page —
 * aucune valeur "supposee" ou en cache silencieux.
 */

async function renderDiagnostic(container) {
  const user = DB.AppState.currentUser;
  if (!user || user.role !== 'admin') {
    container.innerHTML = `
      <div style="padding:60px; text-align:center; color:var(--text-muted)">
        <i data-lucide="lock" style="width:56px; height:56px; margin:0 auto 16px; opacity:0.3; display:block"></i>
        <h3>Accès refusé</h3>
        <p>Le diagnostic du poste est réservé aux administrateurs.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons({ root: container });
    return;
  }

  UI.loading(container, 'Diagnostic du poste en cours...');
  await _diagRenderAll(container);
}

async function _diagRenderAll(container) {
  const t0 = performance.now();

  const [supabaseCheck, storage, storeCounts, pending, failed, updateCheck, swStatus] = await Promise.all([
    _diagCheckSupabase(),
    (DB.checkStorageHealth ? DB.checkStorageHealth() : Promise.resolve({ available: false })),
    _diagStoreCounts(),
    (window.OperationQueue ? window.OperationQueue.getPending().catch(() => []) : Promise.resolve([])),
    (window.OperationQueue ? window.OperationQueue.getFailed().catch(() => []) : Promise.resolve([])),
    _diagCheckUpdate(),
    _diagSwStatus(),
  ]);

  const missingTables = _diagSafeJSON(localStorage.getItem('pharma_missing_tables'));
  const badColumns = _diagSafeJSON(localStorage.getItem('pharma_bad_columns'));
  const nm = window.NM || null;
  const lastIDBError = window.DB && DB._lastIDBError;
  const jsErrors = window.OrdiveXDiag ? window.OrdiveXDiag.errors() : [];
  const lastPullTs = localStorage.getItem('pharma_last_pull_ts');
  const elapsedMs = Math.round(performance.now() - t0);

  const snapshot = {
    appVersion: window.APP_VERSION || 'inconnue',
    updateCheck, supabaseCheck, storage, storeCounts, pending, failed,
    swStatus, missingTables, badColumns,
    nmState: nm ? nm.state : 'indisponible',
    nmLastSuccessTime: nm ? nm.lastSuccessTime : 0,
    nmLastCommunicationTime: nm ? nm.lastCommunicationTime : 0,
    nmLastError: nm ? nm.lastError : '',
    lastIDBError, jsErrors, lastPullTs,
    deviceId: DB.AppState.deviceId, deviceName: DB.AppState.deviceName,
    userAgent: navigator.userAgent, language: navigator.language,
    screen: screen.width + 'x' + screen.height,
    generatedAt: new Date().toISOString(),
    measuredInMs: elapsedMs,
  };
  window._lastDiagnosticSnapshot = snapshot;

  container.innerHTML = _diagRenderHTML(snapshot);
  if (window.lucide) lucide.createIcons({ root: container });
}

// ── Sondes ────────────────────────────────────────────────────────────────

async function _diagCheckSupabase() {
  if (!navigator.onLine) return { ok: false, reason: 'offline', latencyMs: null };
  try {
    const sb = await DB.getSupabaseClient();
    if (!sb) return { ok: false, reason: 'not_configured', latencyMs: null };
    const start = performance.now();
    const res = await sb.from('settings').select('key').limit(1);
    const latencyMs = Math.round(performance.now() - start);
    if (res.error) return { ok: false, reason: res.error.message || 'erreur inconnue', latencyMs };
    return { ok: true, reason: null, latencyMs };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : String(e), latencyMs: null };
  }
}

async function _diagStoreCounts() {
  const names = Object.values(DB.STORES || {});
  const results = await Promise.all(names.map(async (name) => {
    try {
      const count = await DB.dbCount(name);
      return { name, count, error: null };
    } catch (e) {
      return { name, count: null, error: e && e.message ? e.message : String(e) };
    }
  }));
  return results;
}

async function _diagCheckUpdate() {
  if (!navigator.onLine) return { checked: false, reason: 'offline' };
  try {
    const remote = window.OrdiveXDiag ? await window.OrdiveXDiag.checkUpdate() : null;
    if (remote && remote.version) {
      return { checked: true, upToDate: false, remoteVersion: remote.version, changelog: remote.changelog || '' };
    }
    return { checked: true, upToDate: true };
  } catch (e) {
    return { checked: false, reason: e && e.message ? e.message : String(e) };
  }
}

async function _diagSwStatus() {
  if (!('serviceWorker' in navigator)) return { supported: false };
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return { supported: true, registered: false };
    return {
      supported: true,
      registered: true,
      scope: reg.scope,
      active: !!reg.active,
      waiting: !!reg.waiting,
      installing: !!reg.installing,
      controller: !!navigator.serviceWorker.controller,
    };
  } catch (e) {
    return { supported: true, registered: false, error: e && e.message ? e.message : String(e) };
  }
}

function _diagSafeJSON(str) {
  try { return JSON.parse(str || '{}'); } catch (e) { return {}; }
}

// ── Rendu ─────────────────────────────────────────────────────────────────

function _diagFmtTime(ts) {
  if (!ts) return 'Jamais';
  const diff = Date.now() - ts;
  const d = new Date(ts);
  const abs = d.toLocaleString('fr-FR');
  if (diff < 0) return abs;
  if (diff < 60000) return "À l'instant";
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min (' + abs + ')';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h (' + abs + ')';
  return Math.floor(diff / 86400000) + 'j (' + abs + ')';
}

function _diagPill(ok, label) {
  const cls = ok === true ? 'badge-success' : ok === false ? 'badge-danger' : 'badge-warning';
  return `<span class="badge ${cls}">${label}</span>`;
}

function _diagRenderHTML(s) {
  const totalRecords = s.storeCounts.reduce((a, r) => a + (r.count || 0), 0);
  const storesInError = s.storeCounts.filter(r => r.error);
  const missingTableNames = Object.keys(s.missingTables || {});
  const badColumnEntries = Object.entries(s.badColumns || {});
  const schemaOk = missingTableNames.length === 0 && badColumnEntries.length === 0;

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Diagnostic du Poste</h1>
        <p class="page-subtitle">État technique mesuré en direct — ${new Date(s.generatedAt).toLocaleString('fr-FR')} (${s.measuredInMs} ms)</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" onclick="_diagCopyReport()"><i data-lucide="clipboard"></i> Copier le rapport</button>
        <button class="btn btn-primary" onclick="Router.navigate('diagnostic')"><i data-lucide="refresh-cw"></i> Rafraîchir</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card ${s.updateCheck.checked && !s.updateCheck.upToDate ? 'kpi-orange kpi-alert' : 'kpi-blue'}">
        <div class="kpi-icon"><i data-lucide="tag"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">v${s.appVersion}</div>
          <div class="kpi-label">Version installée</div>
          <div class="kpi-sub">${
            !s.updateCheck.checked ? 'Vérification impossible (' + (s.updateCheck.reason === 'offline' ? 'hors ligne' : s.updateCheck.reason) + ')'
            : s.updateCheck.upToDate ? 'À jour' : 'Nouvelle version v' + s.updateCheck.remoteVersion + ' disponible'
          }</div>
        </div>
      </div>
      <div class="kpi-card ${s.supabaseCheck.ok ? 'kpi-green' : 'kpi-red kpi-alert'}">
        <div class="kpi-icon"><i data-lucide="cloud"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${s.supabaseCheck.ok ? s.supabaseCheck.latencyMs + ' ms' : '—'}</div>
          <div class="kpi-label">Connectivité Supabase</div>
          <div class="kpi-sub">${s.supabaseCheck.ok ? 'Réponse OK' : (s.supabaseCheck.reason === 'offline' ? 'Poste hors ligne' : s.supabaseCheck.reason === 'not_configured' ? 'Non configuré' : 'Échec : ' + s.supabaseCheck.reason)}</div>
        </div>
      </div>
      <div class="kpi-card ${s.failed.length > 0 ? 'kpi-red kpi-alert' : s.pending.length > 0 ? 'kpi-orange' : 'kpi-green'}">
        <div class="kpi-icon"><i data-lucide="list-todo"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${s.pending.length} / ${s.failed.length}</div>
          <div class="kpi-label">File de synchro (attente / échec)</div>
          <div class="kpi-sub">Dernier envoi réussi : ${_diagFmtTime(s.nmLastSuccessTime)}</div>
        </div>
      </div>
      <div class="kpi-card ${s.storage.available && s.storage.percentUsed >= 85 ? 'kpi-red kpi-alert' : 'kpi-blue'}">
        <div class="kpi-icon"><i data-lucide="hard-drive"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${s.storage.available ? s.storage.percentUsed + '%' : 'Inconnu'}</div>
          <div class="kpi-label">Stockage local utilisé</div>
          <div class="kpi-sub">${s.storage.available ? s.storage.usageMB + ' Mo / ' + s.storage.quotaMB + ' Mo' : 'Non supporté par ce navigateur'}</div>
        </div>
      </div>
    </div>

    <div class="card" style="padding:20px; margin-bottom:16px">
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="server-cog" style="width:18px;height:18px"></i> Service Worker & réseau</h3>
      <table class="data-table">
        <tbody>
          <tr><td>État réseau (NetworkManager)</td><td>${_diagPill(s.nmState === 'ONLINE' || s.nmState === 'SYNCING', s.nmState)}</td></tr>
          <tr><td>Service Worker enregistré</td><td>${_diagPill(s.swStatus.registered, s.swStatus.registered ? 'Oui — ' + (s.swStatus.active ? 'actif' : 'inactif') : 'Non')}</td></tr>
          <tr><td>Mise à jour SW en attente</td><td>${_diagPill(!s.swStatus.waiting, s.swStatus.waiting ? 'Oui — en attente d\'activation' : 'Non')}</td></tr>
          <tr><td>Dernière communication serveur</td><td>${_diagFmtTime(s.nmLastCommunicationTime)}</td></tr>
          <tr><td>Dernier pull réussi</td><td>${_diagFmtTime(s.lastPullTs ? parseInt(s.lastPullTs, 10) : 0)}</td></tr>
          <tr><td>Dernière erreur réseau</td><td>${s.nmLastError ? '<span style="color:var(--danger)">' + s.nmLastError.slice(0, 140) + '</span>' : '<span style="color:var(--text-muted)">Aucune</span>'}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="padding:20px; margin-bottom:16px">
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="database" style="width:18px;height:18px"></i> Conformité schéma Supabase</h3>
      ${schemaOk ? `<p style="color:var(--text-muted); margin:0">${_diagPill(true, 'OK')} Aucune table ni colonne manquante détectée.</p>` : `
        ${missingTableNames.length ? `<p style="margin:0 0 8px 0"><strong>Tables absentes côté Supabase :</strong> ${missingTableNames.join(', ')}</p>` : ''}
        ${badColumnEntries.length ? `<p style="margin:0"><strong>Colonnes non conformes :</strong> ${badColumnEntries.map(([k]) => k).join(', ')}</p>` : ''}
        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px">La synchronisation Cloud de ces tables est suspendue jusqu'à correction du schéma côté Supabase.</p>
      `}
      ${lastIDBErrorHtml(s.lastIDBError)}
    </div>

    <div class="card" style="padding:20px; margin-bottom:16px; overflow:auto">
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="hard-drive-download" style="width:18px;height:18px"></i> Stores IndexedDB (${s.storeCounts.length} stores, ${totalRecords.toLocaleString('fr-FR')} enregistrements)</h3>
      <table class="data-table">
        <thead><tr><th>Store</th><th>Enregistrements</th></tr></thead>
        <tbody>
          ${s.storeCounts.map(r => `<tr><td>${r.name}</td><td>${r.error ? '<span style="color:var(--danger)">Erreur : ' + r.error + '</span>' : r.count.toLocaleString('fr-FR')}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="card" style="padding:20px; margin-bottom:16px">
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="alert-triangle" style="width:18px;height:18px"></i> Opérations en échec définitif (${s.failed.length})</h3>
      ${s.failed.length === 0 ? '<p style="color:var(--text-muted); margin:0">Aucune — toutes les opérations ont fini par être synchronisées.</p>' : `
        <table class="data-table">
          <thead><tr><th>Type</th><th>Tentatives</th><th>Dernière erreur</th><th>Échec le</th><th></th></tr></thead>
          <tbody>
            ${s.failed.map(op => `<tr>
              <td>${op.type}</td>
              <td>${op.retries}</td>
              <td>${(op.lastError || '—').slice(0, 100)}</td>
              <td>${_diagFmtTime(op.failedAt)}</td>
              <td><button class="btn btn-secondary" style="padding:4px 10px;font-size:0.78rem" onclick="_diagRetryOp('${op.id}')">Réessayer</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
    </div>

    <div class="card" style="padding:20px; margin-bottom:16px">
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="bug" style="width:18px;height:18px"></i> Erreurs JavaScript récentes (${s.jsErrors.length})</h3>
      ${s.jsErrors.length === 0 ? '<p style="color:var(--text-muted); margin:0">Aucune erreur JavaScript capturée depuis le chargement de la page.</p>' : `
        <table class="data-table">
          <thead><tr><th>Heure</th><th>Message</th></tr></thead>
          <tbody>
            ${s.jsErrors.slice().reverse().map(e => `<tr><td>${_diagFmtTime(e.time)}</td><td style="max-width:520px; overflow-wrap:break-word">${String(e.msg || '').slice(0, 200)}</td></tr>`).join('')}
          </tbody>
        </table>
      `}
    </div>

    <div class="card" style="padding:20px">
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="monitor" style="width:18px;height:18px"></i> Informations appareil</h3>
      <table class="data-table">
        <tbody>
          <tr><td>Nom de l'appareil</td><td>${s.deviceName || '—'}</td></tr>
          <tr><td>Identifiant appareil</td><td><code>${s.deviceId || '—'}</code></td></tr>
          <tr><td>Résolution écran</td><td>${s.screen}</td></tr>
          <tr><td>Langue</td><td>${s.language}</td></tr>
          <tr><td>Navigateur</td><td style="max-width:520px; overflow-wrap:break-word">${s.userAgent}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function lastIDBErrorHtml(err) {
  if (!err) return '';
  return `<p style="font-size:0.8rem; color:var(--danger); margin-top:12px; padding-top:12px; border-top:1px solid var(--border)">
    Dernière erreur IndexedDB : <strong>${err.type}</strong> sur <code>${err.store}</code> (${err.operation}) — ${_diagFmtTime(err.timestamp)}
  </p>`;
}

// ── Actions ───────────────────────────────────────────────────────────────

async function _diagRetryOp(id) {
  if (!window.OperationQueue) return;
  const ok = await window.OperationQueue.retryFailed(id).catch(() => false);
  if (ok) {
    UI.toast('Opération remise en file — nouvelle tentative en cours.', 'info', 3000);
    if (window.NM) window.NM.requestSync(true);
    Router.navigate('diagnostic');
  } else {
    UI.toast('Impossible de relancer cette opération.', 'error', 3000);
  }
}
window._diagRetryOp = _diagRetryOp;

function _diagCopyReport() {
  const snap = window._lastDiagnosticSnapshot;
  if (!snap) return;
  const text = JSON.stringify(snap, null, 2);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => UI.toast('Rapport de diagnostic copié dans le presse-papiers.', 'success', 3000))
      .catch(() => UI.toast('Impossible de copier automatiquement — voir la console.', 'warning', 4000));
  } else {
    console.log('[Diagnostic] Rapport :', text);
    UI.toast('Copie automatique indisponible — rapport affiché dans la console.', 'info', 4000);
  }
}
window._diagCopyReport = _diagCopyReport;
