/**
 * OrdiveX — diagnostic.js
 * Diagnostic du poste — Hardening Lot 6, etendu Fiabilisation Lots 9-10
 *
 * Page reservee aux administrateurs, verrouillee sur le role (pas sur une
 * permission delegable via les Parametres — un diagnostic technique donne
 * une vue sur l'infrastructure interne, pas sur un module metier).
 * Chaque valeur affichee est mesuree en direct a l'ouverture de la page —
 * aucune valeur "supposee" ou en cache silencieux.
 *
 * Trois notions de version distinctes (Lot 9) : appVersion (executee par
 * cette page), swVersion (rapportee par le Service Worker actif lui-meme
 * via postMessage), serverVersion (derniere version disponible, lue en
 * direct depuis version.json). Ne jamais les confondre.
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

  const [supabaseCheck, storage, storeCounts, pending, failed, serverVersion, swStatus, swVersion, salesProblems] = await Promise.all([
    _diagCheckSupabase(),
    (DB.checkStorageHealth ? DB.checkStorageHealth() : Promise.resolve({ available: false })),
    _diagStoreCounts(),
    (window.OperationQueue ? window.OperationQueue.getPending().catch(() => []) : Promise.resolve([])),
    (window.OperationQueue ? window.OperationQueue.getFailed().catch(() => []) : Promise.resolve([])),
    _diagCheckServerVersion(),
    _diagSwStatus(),
    _diagGetSwVersion(),
    _diagSalesProblems(),
  ]);

  const missingTables = _diagSafeJSON(localStorage.getItem('pharma_missing_tables'));
  const badColumns = _diagSafeJSON(localStorage.getItem('pharma_bad_columns'));
  const nm = window.NM || null;
  const lastIDBError = window.DB && DB._lastIDBError;
  const jsErrors = window.OrdiveXDiag ? window.OrdiveXDiag.errors() : [];
  const lastPullTs = localStorage.getItem('pharma_last_pull_ts');
  const browser = _diagBrowserInfo();
  const idbOperational = storeCounts.length > 0 && storeCounts.every(r => r.error === null);
  const elapsedMs = Math.round(performance.now() - t0);

  const snapshot = {
    // Fiabilisation post-hardening (Lot 9) — trois notions de version
    // explicitement distinctes (Objectif 1), jamais confondues entre elles :
    appVersion: window.APP_VERSION || 'inconnue',        // version RÉELLEMENT EXÉCUTÉE par cette page (window.APP_VERSION, source unique — voir index.html)
    swVersion,                                            // version RAPPORTÉE PAR le Service Worker actif lui-même (peut différer transitoirement de appVersion pendant une mise à jour)
    serverVersion,                                        // dernière version DISPONIBLE sur le serveur (fetch live de version.json, jamais depuis un cache)
    supabaseCheck, storage, storeCounts, pending, failed, salesProblems,
    swStatus, missingTables, badColumns, idbOperational, browser,
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

// Fiabilisation post-hardening (Lot 10, Objectif 4) : remonte les ventes
// méritant une investigation — fantômes (Lot 1, DB.detectOrphanSales, lecture
// seule) et non synchronisées depuis un délai anormal (champ _synced réel,
// même source que UI.syncBadge — Lot 7). N'affirme JAMAIS qu'une vente
// précise a échoué à synchroniser : la file (OperationQueue) ne trace les
// échecs qu'au niveau du STORE entier, pas par enregistrement — on le
// signale honnêtement via storeSyncFailing plutôt que d'inventer une
// causalité qu'on ne peut pas prouver au niveau de chaque vente.
const SALE_STALE_UNSYNCED_MS = 30 * 60 * 1000; // 30 min : au-delà, ce n'est plus une latence normale de sync
async function _diagSalesProblems() {
  try {
    const [orphans, sales, failedOps] = await Promise.all([
      (DB.detectOrphanSales ? DB.detectOrphanSales().catch(() => []) : Promise.resolve([])),
      DB.dbGetAll('sales').catch(() => []),
      (window.OperationQueue ? window.OperationQueue.getFailed().catch(() => []) : Promise.resolve([])),
    ]);
    const now = Date.now();
    const orphanIds = new Set(orphans.map(s => s.id));
    const staleUnsynced = sales.filter(s => {
      if (orphanIds.has(s.id)) return false; // déjà couvert par "fantôme", éviter le doublon
      if (s._synced !== false) return false;
      const createdAt = s._createdAt || Date.parse(s.date) || 0;
      return (now - createdAt) > SALE_STALE_UNSYNCED_MS;
    });
    const storeSyncFailing = failedOps.some(op => op.payload && op.payload.store === 'sales');
    const items = [
      ...orphans.map(s => ({ id: s.id, date: s.date, total: s.total, kind: 'orphan' })),
      ...staleUnsynced.map(s => ({ id: s.id, date: s.date, total: s.total, kind: 'stale_unsynced' })),
    ].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    return { items, storeSyncFailing };
  } catch (e) {
    return { items: [], storeSyncFailing: false, error: e && e.message ? e.message : String(e) };
  }
}

// Fiabilisation post-hardening (Lot 9) : lecture LIVE de version.json,
// systématiquement — contrairement à checkForUpdates() (stability.js), qui
// ne renvoie une valeur que lorsqu'elle diffère de la version locale (utile
// pour une notification, inadapté à un diagnostic qui doit pouvoir AFFICHER
// "9.10.7 = 9.10.7" explicitement, pas juste "à jour").
async function _diagCheckServerVersion() {
  if (!navigator.onLine) return { checked: false, reason: 'offline', version: null };
  try {
    const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return { checked: false, reason: 'HTTP ' + res.status, version: null };
    const data = await res.json();
    if (!data || !data.version) return { checked: false, reason: 'version.json invalide', version: null };
    return { checked: true, reason: null, version: data.version, changelog: data.changelog || '' };
  } catch (e) {
    return { checked: false, reason: e && e.message ? e.message : String(e), version: null };
  }
}

// Fiabilisation post-hardening (Lot 9) : interroge le Service Worker
// RÉELLEMENT actif pour sa propre version (CACHE_NAME) via MessageChannel,
// plutôt que de supposer qu'elle correspond à window.APP_VERSION — les deux
// peuvent diverger transitoirement pendant une mise à jour (voir Lot 8).
// Timeout court : un SW plus ancien qui ne connaît pas encore ce type de
// message (déployé juste avant ce lot) ne doit jamais bloquer le diagnostic.
function _diagGetSwVersion() {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      resolve(null);
      return;
    }
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 2000);
    try {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(event.data && event.data.type === 'VERSION_INFO' ? event.data : null);
      };
      navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    } catch (e) {
      if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
    }
  });
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

// Fiabilisation post-hardening (Lot 9) : détection de navigateur — usage
// AFFICHAGE UNIQUEMENT (jamais pour brancher un comportement, le reste du
// code fait toujours du feature-detection). Les booléens de support d'API
// ci-dessous, eux, sont des vérifications RÉELLES (`in`/typeof), pas du
// sniffing par nom de navigateur.
function _diagBrowserInfo() {
  const ua = navigator.userAgent;
  let name = 'Navigateur inconnu', version = '';
  const patterns = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ];
  for (const [re, label] of patterns) {
    const m = ua.match(re);
    if (m) { name = label; version = m[1].split('.')[0]; break; }
  }
  return {
    label: version ? (name + ' ' + version) : name,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    indexedDBSupported: 'indexedDB' in window,
    webLocksSupported: !!(navigator.locks && typeof navigator.locks.request === 'function'),
    storageEstimateSupported: !!(navigator.storage && typeof navigator.storage.estimate === 'function'),
  };
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

// Même logique de parsing que _checkAndShowUpdateBanner (index.html) — un
// segment manquant/non-numérique retourne null plutôt que de fausser la
// comparaison. Dupliqué intentionnellement (fonctions isolées par script,
// pas de module partagé dans cette codebase) plutôt que de créer un couplage
// entre index.html et diagnostic.js pour trois lignes de logique.
function _diagParseVer(v) {
  if (typeof v !== 'string') return null;
  const parts = v.split('.').map(s => parseInt(s, 10));
  if (parts.length < 3 || parts.some(n => !Number.isFinite(n) || n < 0)) return null;
  return parts;
}
function _diagIsNewer(remote, local) {
  const r = _diagParseVer(remote), l = _diagParseVer(local);
  if (!r || !l) return null; // inconnu — ne jamais affirmer "obsolète" sans preuve
  return r[0] > l[0] || (r[0] === l[0] && r[1] > l[1]) || (r[0] === l[0] && r[1] === l[1] && r[2] > l[2]);
}

function _diagRenderHTML(s) {
  const totalRecords = s.storeCounts.reduce((a, r) => a + (r.count || 0), 0);
  const missingTableNames = Object.keys(s.missingTables || {});
  const badColumnEntries = Object.entries(s.badColumns || {});
  const schemaOk = missingTableNames.length === 0 && badColumnEntries.length === 0;

  // Fiabilisation post-hardening (Lot 9, Objectif 8) — tous les états sont
  // dérivés de valeurs RÉELLEMENT mesurées ci-dessus, jamais supposés.
  const isOffline = s.supabaseCheck.reason === 'offline';
  const versionNewer = s.serverVersion.checked ? _diagIsNewer(s.serverVersion.version, s.appVersion) : null;
  const versionOutdated = versionNewer === true;
  const serverDown = !isOffline && !s.supabaseCheck.ok && s.supabaseCheck.reason !== 'not_configured';
  const storageAlmostFull = s.storage.available && s.storage.percentUsed >= 85;
  const swWaiting = !!s.swStatus.waiting;
  const idbProblem = !s.idbOperational;

  const salesOrphanCount = s.salesProblems.items.filter(i => i.kind === 'orphan').length;
  const salesStaleCount = s.salesProblems.items.filter(i => i.kind === 'stale_unsynced').length;

  const critical = [];
  const warnings = [];
  if (s.failed.length > 0) critical.push(s.failed.length + ' opération(s) en échec définitif');
  if (serverDown) critical.push('Serveur inaccessible');
  if (idbProblem) critical.push('Base locale — erreur détectée');
  if (!schemaOk) critical.push('Schéma serveur non conforme');
  if (salesOrphanCount > 0) critical.push(salesOrphanCount + ' vente(s) fantôme(s) détectée(s)');
  if (isOffline) warnings.push('Poste hors ligne');
  if (versionOutdated) warnings.push('Nouvelle version disponible');
  if (s.pending.length > 0) warnings.push(s.pending.length + ' opération(s) en attente');
  if (storageAlmostFull) warnings.push('Stockage local presque plein');
  if (swWaiting) warnings.push('Mise à jour prête à appliquer');
  if (salesStaleCount > 0) warnings.push(salesStaleCount + ' vente(s) non synchronisée(s) depuis longtemps');

  const globalStatus = critical.length > 0 ? { dot: '🔴', label: critical.length + ' problème(s) détecté(s)' }
    : warnings.length > 0 ? { dot: '🟡', label: warnings.length + ' avertissement(s)' }
    : { dot: '🟢', label: 'Poste opérationnel' };

  // Objectif 9 : UNE action appropriée par problème détecté, jamais
  // "Effacer les données" en premier recours. Ordre : critique puis
  // avertissement.
  // NOTE : ces chaînes onclick sont injectées dans un attribut HTML
  // délimité par des guillemets DOUBLES (`onclick="${a.onclick}"` plus bas)
  // — n'utiliser QUE des guillemets simples à l'intérieur, jamais de
  // guillemets doubles échappés (ils casseraient l'attribut HTML).
  const actions = [];
  if (salesOrphanCount > 0) actions.push({ label: salesOrphanCount + ' vente(s) fantôme(s)', action: 'Voir les ventes', onclick: "document.getElementById('diag-sales-problems')?.scrollIntoView({behavior:'smooth'})" });
  if (s.failed.length > 0) actions.push({ label: s.failed.length + ' synchronisation(s) en échec', action: 'Voir les opérations', onclick: "document.getElementById('diag-failed-ops')?.scrollIntoView({behavior:'smooth'})" });
  if (serverDown) actions.push({ label: 'Serveur inaccessible', action: 'Voir le détail', onclick: "document.getElementById('diag-server-card')?.scrollIntoView({behavior:'smooth'})" });
  if (!schemaOk) actions.push({ label: 'Schéma serveur non conforme', action: 'Réparer la synchro', onclick: "if (typeof repairSync === 'function') repairSync(); else UI.toast('Ouvrez Paramètres > Cloud', 'info')" });
  if (versionOutdated) actions.push({ label: 'Version v' + s.serverVersion.version + ' disponible', action: 'Vérifier et mettre à jour', onclick: '_diagTriggerUpdate()' });
  if (swWaiting) actions.push({ label: 'Mise à jour déjà téléchargée', action: 'Appliquer la mise à jour', onclick: "if (typeof window._applyUpdate === 'function') window._applyUpdate()" });
  if (s.pending.length > 0) actions.push({ label: s.pending.length + ' opération(s) en attente', action: 'Synchroniser maintenant', onclick: "if (window.NM) window.NM.requestSync(true); UI.toast('Synchronisation lancée', 'info')" });
  if (storageAlmostFull) actions.push({ label: 'Stockage à ' + s.storage.percentUsed + '%', action: 'Voir le stockage', onclick: "document.getElementById('diag-storage-kpi')?.scrollIntoView({behavior:'smooth'})" });

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

    <div class="card" style="padding:16px 20px; margin-bottom:16px; display:flex; align-items:center; gap:12px; font-size:1.05rem; font-weight:700">
      <span style="font-size:1.4rem; line-height:1">${globalStatus.dot}</span> ${globalStatus.label}
    </div>

    ${actions.length > 0 ? `
    <div class="card" style="padding:16px 20px; margin-bottom:16px">
      <h3 style="margin:0 0 12px 0; font-size:0.95rem">Actions recommandées</h3>
      <div style="display:flex; flex-direction:column; gap:8px">
        ${actions.map(a => `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:8px 12px; background:var(--bg); border-radius:8px; border:1px solid var(--border)">
            <span style="font-size:0.85rem">${a.label}</span>
            <button class="btn btn-sm btn-secondary" onclick="${a.onclick}">${a.action}</button>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="kpi-grid">
      <div class="kpi-card ${versionOutdated ? 'kpi-orange kpi-alert' : 'kpi-blue'}">
        <div class="kpi-icon"><i data-lucide="tag"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">v${s.appVersion}</div>
          <div class="kpi-label">Version exécutée</div>
          <div class="kpi-sub">Disponible : ${
            !s.serverVersion.checked ? 'inconnue (' + (s.serverVersion.reason === 'offline' ? 'hors ligne' : s.serverVersion.reason) + ')'
            : 'v' + s.serverVersion.version + (versionOutdated ? ' — mise à jour disponible' : versionNewer === false ? ' — à jour' : '')
          }</div>
        </div>
      </div>
      <div id="diag-server-card" class="kpi-card ${s.supabaseCheck.ok ? 'kpi-green' : 'kpi-red kpi-alert'}">
        <div class="kpi-icon"><i data-lucide="cloud"></i></div>
        <div class="kpi-content">
          <div class="kpi-value">${s.supabaseCheck.ok ? s.supabaseCheck.latencyMs + ' ms' : '—'}</div>
          <div class="kpi-label">Connectivité serveur</div>
          <div class="kpi-sub">${s.supabaseCheck.ok ? 'Réponse OK' : (isOffline ? 'Poste hors ligne' : s.supabaseCheck.reason === 'not_configured' ? 'Non configuré' : 'Échec : ' + s.supabaseCheck.reason)}</div>
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
      <div id="diag-storage-kpi" class="kpi-card ${storageAlmostFull ? 'kpi-red kpi-alert' : 'kpi-blue'}">
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
          <tr><td>Version rapportée par le Service Worker</td><td>${s.swVersion ? '<code>' + s.swVersion.swAssetVersion + '</code>' : '<span style="color:var(--text-muted)">Non disponible (SW inactif ou pas encore mis à jour)</span>'}</td></tr>
          <tr><td>Mise à jour SW en attente</td><td>${_diagPill(!s.swStatus.waiting, s.swStatus.waiting ? 'Oui — en attente d\'activation' : 'Non')}</td></tr>
          <tr><td>Dernière communication serveur</td><td>${_diagFmtTime(s.nmLastCommunicationTime)}</td></tr>
          <tr><td>Dernier pull réussi</td><td>${_diagFmtTime(s.lastPullTs ? parseInt(s.lastPullTs, 10) : 0)}</td></tr>
          <tr><td>Dernière erreur réseau</td><td>${s.nmLastError ? '<span style="color:var(--danger)">' + s.nmLastError.slice(0, 140) + '</span>' : '<span style="color:var(--text-muted)">Aucune</span>'}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="padding:20px; margin-bottom:16px">
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="database" style="width:18px;height:18px"></i> Conformité schéma serveur</h3>
      ${schemaOk ? `<p style="color:var(--text-muted); margin:0">${_diagPill(true, 'OK')} Aucune table ni colonne manquante détectée.</p>` : `
        ${missingTableNames.length ? `<p style="margin:0 0 8px 0"><strong>Tables absentes côté serveur :</strong> ${missingTableNames.join(', ')}</p>` : ''}
        ${badColumnEntries.length ? `<p style="margin:0"><strong>Colonnes non conformes :</strong> ${badColumnEntries.map(([k]) => k).join(', ')}</p>` : ''}
        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px">La synchronisation Cloud de ces tables est suspendue jusqu'à correction du schéma côté serveur.</p>
      `}
      ${lastIDBErrorHtml(s.lastIDBError)}
    </div>

    <div class="card" style="padding:20px; margin-bottom:16px; overflow:auto">
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="hard-drive-download" style="width:18px;height:18px"></i> Base locale — IndexedDB</h3>
      <p style="margin:0 0 14px 0">${_diagPill(s.idbOperational, s.idbOperational ? 'Opérationnelle' : 'Erreur détectée')} ${s.storeCounts.length} stores, ${totalRecords.toLocaleString('fr-FR')} enregistrements</p>
      <table class="data-table">
        <thead><tr><th>Store</th><th>Enregistrements</th></tr></thead>
        <tbody>
          ${s.storeCounts.map(r => `<tr><td>${r.name}</td><td>${r.error ? '<span style="color:var(--danger)">Erreur : ' + r.error + '</span>' : r.count.toLocaleString('fr-FR')}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div id="diag-sales-problems" class="card" style="padding:20px; margin-bottom:16px">
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="shopping-bag" style="width:18px;height:18px"></i> Problèmes de ventes (${s.salesProblems.items.length})</h3>
      ${s.salesProblems.error ? `<p style="color:var(--danger); margin:0">Vérification impossible : ${s.salesProblems.error}</p>` : s.salesProblems.items.length === 0 ? '<p style="color:var(--text-muted); margin:0">Aucune vente fantôme ni non synchronisée de manière anormale.</p>' : `
        ${s.salesProblems.storeSyncFailing ? `<p style="font-size:0.8rem; color:var(--warning); margin:0 0 12px 0">⚠ La synchronisation du store « ventes » a échoué au moins une fois récemment — certaines des ventes en attente ci-dessous en sont probablement la cause, sans certitude au niveau de chaque vente individuelle.</p>` : ''}
        <table class="data-table">
          <thead><tr><th>Vente</th><th>Date</th><th>Montant</th><th>État</th><th></th></tr></thead>
          <tbody>
            ${s.salesProblems.items.map(it => `<tr>
              <td><code class="code-tag">#${String(it.id).padStart(6, '0')}</code></td>
              <td>${_diagFmtTime(Date.parse(it.date) || 0)}</td>
              <td>${UI.formatCurrency(it.total || 0)}</td>
              <td>${it.kind === 'orphan' ? _diagPill(false, 'Vente fantôme — sans articles liés') : _diagPill(null, 'Non synchronisée depuis longtemps')}</td>
              <td><button class="btn btn-secondary" style="padding:4px 10px;font-size:0.78rem" onclick="_diagOpenSale(${it.id})">Voir la vente</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      `}
    </div>

    <div id="diag-failed-ops" class="card" style="padding:20px; margin-bottom:16px">
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
      <h3 style="margin:0 0 14px 0; font-size:1rem; display:flex; align-items:center; gap:8px"><i data-lucide="monitor" style="width:18px;height:18px"></i> Navigateur & appareil</h3>
      <table class="data-table">
        <tbody>
          <tr><td>Navigateur détecté</td><td>${s.browser.label}</td></tr>
          <tr><td>Service Worker</td><td>${_diagPill(s.browser.serviceWorkerSupported, s.browser.serviceWorkerSupported ? 'Supporté' : 'Non supporté')}</td></tr>
          <tr><td>IndexedDB</td><td>${_diagPill(s.browser.indexedDBSupported, s.browser.indexedDBSupported ? 'Supporté' : 'Non supporté')}</td></tr>
          <tr><td>Verrous multi-onglets (Web Locks)</td><td>${_diagPill(s.browser.webLocksSupported, s.browser.webLocksSupported ? 'Supporté' : 'Non supporté — coordination dégradée en best-effort')}</td></tr>
          <tr><td>Estimation du stockage</td><td>${_diagPill(s.browser.storageEstimateSupported, s.browser.storageEstimateSupported ? 'Supporté' : 'Non supporté')}</td></tr>
          <tr><td>Nom de l'appareil</td><td>${s.deviceName || '—'}</td></tr>
          <tr><td>Identifiant appareil</td><td><code>${s.deviceId || '—'}</code></td></tr>
          <tr><td>Résolution écran</td><td>${s.screen}</td></tr>
          <tr><td>Langue</td><td>${s.language}</td></tr>
          <tr><td>User-Agent complet</td><td style="max-width:520px; overflow-wrap:break-word; font-size:0.75rem; color:var(--text-muted)">${s.userAgent}</td></tr>
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

// Fiabilisation post-hardening (Lot 10, Objectif 4) : réutilise le mécanisme
// EXISTANT (viewSaleDetail, js/pages/sales.js) plutôt que d'inventer un
// routage par URL/query string — OrdiveX est une SPA en mémoire sans
// historique d'URL, un tel mécanisme n'existe nulle part ailleurs dans le
// code. viewSaleDetail() récupère la vente directement par ID depuis
// IndexedDB (pas depuis une liste filtrée/paginée) et ouvre un UI.modal()
// attaché à document.body — indépendant du rendu de #app-content, donc pas
// de condition de course avec le chargement de la page Ventes.
function _diagOpenSale(saleId) {
  Router.navigate('sales');
  if (typeof viewSaleDetail === 'function') {
    viewSaleDetail(saleId);
  } else {
    UI.toast('Impossible d\'ouvrir le détail de la vente #' + saleId, 'error', 4000);
  }
}
window._diagOpenSale = _diagOpenSale;

// Correctif (signalé par l'utilisateur après le Lot 9) : le bouton "Recharger
// pour mettre à jour" appelait un simple window.location.reload(). OrdiveX
// est servi en cache-first par le Service Worker (sw.js) — un reload seul
// ne fait que re-servir la MÊME page déjà en cache tant que le SW n'a pas
// lui-même détecté, installé et activé la nouvelle version. version.json
// peut annoncer une version plus récente AVANT que le SW ait fini son propre
// cycle de mise à jour (déclenché par reg.update(), pas par ce bouton) — le
// clic ne produisait donc visiblement rien. Corrigé en déclenchant
// explicitement une vérification du Service Worker (reg.update()) plutôt
// qu'un reload aveugle : self.skipWaiting() est inconditionnel (sw.js,
// Lot 5) — si une mise à jour est trouvée, elle s'installe et s'active
// automatiquement, ce qui déclenche controllerchange -> _reloadWhenSafe
// (index.html) -> le vrai rechargement sûr, sans action supplémentaire.
// S'il n'y a en réalité rien de nouveau à installer côté Service Worker
// (ex. version.json déployé légèrement en avance sur sw.js — propagation
// CDN), le message reste honnête plutôt que de prétendre à un succès qui
// n'a pas eu lieu (règle absolue du hardening : pas de faux "succès").
function _diagTriggerUpdate() {
  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }
  UI.toast('Vérification de la mise à jour en cours…', 'info', 4000);
  navigator.serviceWorker.getRegistration()
    .then(function (reg) {
      if (!reg) throw new Error('no_registration');
      return reg.update();
    })
    .then(function () {
      setTimeout(function () {
        UI.toast('Si une nouvelle version a été trouvée, elle s\'installe et s\'appliquera automatiquement dans les prochaines secondes.', 'info', 7000);
      }, 1200);
    })
    .catch(function () {
      // Aucun Service Worker enregistré ou vérification impossible : le
      // seul recours honnête reste un reload direct (repli, pas une
      // affirmation de succès).
      window.location.reload();
    });
}
window._diagTriggerUpdate = _diagTriggerUpdate;

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
