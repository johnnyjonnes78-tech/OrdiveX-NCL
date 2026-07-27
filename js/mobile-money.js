/**
 * OrdiveX v3 — Mobile Money Gateway & SMS
 * Orange Money Guinée · MTN MoMo Guinée · SMS AfricasTalking · ANSS
 * Chargé après db.js, auth.js, ui.js
 */

const MobileMoneyGateway = (() => {

  // ── CONFIG (remplacer par clés réelles en production) ──────────────────────
  const CFG = {
    orange_money: {
      name: 'Orange Money Guinée',
      apiBase: 'https://api.orange.com/orange-money-webpay/guinea/v1',
      merchantId: 'PHARMA_GN_001',
      // En prod: clé secrète orange fournie à la pharmacie
    },
    mtn_momo: {
      name: 'MTN Mobile Money Guinée',
      apiBase: 'https://sandbox.momodeveloper.mtn.com',
      subscriptionKey: 'demo-mtn-key-gn',
    },
    sms: {
      gateway: 'AfricasTalking',
      // En prod: username + apiKey fourni par AfricasTalking.com
      username: 'sandbox',
      apiKey: 'demo-africas-talking-key',
      endpoint: 'https://api.sandbox.africastalking.com/version1/messaging',
      senderId: 'PharmaGN',
    },
    anss: {
      // ANSS Guinée — Agence Nationale de Sécurité Sanitaire
      endpoint: 'https://anss.gov.gn/api/v1/declarations',
      token: 'demo-anss-pharmacie-token',
    },
  };

  // ── UTILITAIRES ───────────────────────────────────────────────────────────
  function normalizePhone(phone) {
    let p = (phone || '').replace(/[\s\-().]/g, '');
    if (p.startsWith('00')) p = '+' + p.slice(2);
    if (p.startsWith('0') && !p.startsWith('00')) p = '+224' + p.slice(1);
    if (!p.startsWith('+')) p = '+224' + p;
    return p;
  }

  async function getPharmacyInfo() {
    try {
      const settings = await DB.dbGetAll('settings');
      const g = k => settings.find(s => s.key === k)?.value;
      return {
        name: g('pharmacy_name') || 'Pharmacie Centrale de Conakry',
        address: g('pharmacy_address') || 'Conakry, Guinée',
        phone: g('pharmacy_phone') || '+224 620 000 000',
        dnpm: g('pharmacy_dnpm') || 'LIC-DNPM-2024-001',
        resp: g('pharmacy_resp') || 'Pharmacien Responsable',
      };
    } catch (e) {
      return { name: 'Pharmacie', dnpm: '—', resp: '—' };
    }
  }

  async function logToQueue(entry) {
    try { await DB.dbAdd('syncQueue', { ...entry, timestamp: Date.now() }); }
    catch (e) { console.warn('[Gateway] Log failed:', e.message); }
  }

  // ── SIMULATION API (remplacer par vraie intégration en prod) ───────────────
  async function simulatePaymentAPI(method, phone, amount) {
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
    if (Math.random() > 0.08) {
      return { success: true, transactionId: `TXN-${method.toUpperCase()}-${Date.now()}` };
    }
    const errors = ['Solde insuffisant', 'Numéro invalide', 'Timeout réseau', 'Compte suspendu'];
    return { success: false, error: errors[Math.floor(Math.random() * errors.length)] };
  }

  // ── PAIEMENT MOBILE MONEY ─────────────────────────────────────────────────
  async function initiatePayment({ method, phone, amount, description, onSuccess, onFailure }) {
    const cfg = CFG[method];
    if (!cfg) { onFailure?.('Méthode non supportée'); return; }

    const normalPhone = normalizePhone(phone);


    await logToQueue({ type: 'PAYMENT_INIT', method, phone: normalPhone, amount, description, status: 'pending' });

    // Mode hors ligne
    if (!navigator.onLine) {
      await logToQueue({ type: 'PAYMENT_OFFLINE', method, phone: normalPhone, amount, status: 'queued' });
      UI.toast(`Hors ligne — Paiement ${cfg.name} enregistré`, 'warning', 5000);
      onSuccess?.();
      return;
    }

    // En production : remplacer simulatePaymentAPI par l'appel API réel de l'opérateur
    try {
      const result = await simulatePaymentAPI(method, normalPhone, amount);
      if (result.success) {
        await logToQueue({ type: 'PAYMENT_SUCCESS', method, phone: normalPhone, amount, transactionId: result.transactionId, status: 'completed' });
        onSuccess?.();
      } else {
        await logToQueue({ type: 'PAYMENT_FAILED', method, phone: normalPhone, amount, error: result.error, status: 'failed' });
        onFailure?.(result.error);
      }
    } catch (err) {
      console.warn('[MobileMoney] Erreur API:', err.message);
      // Fallback : valider localement si API inaccessible
      onSuccess?.();
    }
  }

  // ── SMS ───────────────────────────────────────────────────────────────────
  async function sendSMS(phone, message) {
    const normalPhone = normalizePhone(phone);


    await logToQueue({ type: 'SMS', phone: normalPhone, message, status: navigator.onLine ? 'sending' : 'queued' });

    if (!navigator.onLine) return { queued: true };

    // En production — AfricasTalking API réelle
    // En mode démo (clé sandbox), on ne fait PAS l'appel pour éviter les erreurs CORS
    if (CFG.sms.apiKey.startsWith('demo-') || CFG.sms.username === 'sandbox') {
      // Mode démo : enregistrer en file d'attente sans appel réseau
      return { queued: true, demo: true };
    }

    try {
      const body = new URLSearchParams({
        username: CFG.sms.username,
        to: normalPhone,
        message,
        from: CFG.sms.senderId,
      });
      const resp = await fetch(CFG.sms.endpoint, {
        method: 'POST',
        headers: { 'apiKey': CFG.sms.apiKey, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        body,
      });
      const data = await resp.json();
      const recipient = data?.SMSMessageData?.Recipients?.[0];
      if (recipient?.status === 'Success') {
        return { success: true, messageId: recipient.messageId };
      } else {
        console.warn('[SMS] Échec:', recipient);
        return { success: false };
      }
    } catch (err) {
      // API non accessible — message enregistré en file
      console.warn('[SMS] API indisponible:', err.message);
      return { queued: true };
    }
  }

  async function sendSMSReceipt(phone, method, amount, saleId) {
    if (!phone) return;
    const pharma = await getPharmacyInfo();
    const payLabel = { orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', cash: 'Espèces', credit: 'Crédit' }[method] || method;
    const msg =
      `${pharma.name}\n` +
      `Reçu de vente N°${String(saleId).padStart(6, '0')}\n` +
      `Montant : ${amount.toLocaleString('fr-FR')} GNF\n` +
      `Mode : ${payLabel}\n` +
      `Merci pour votre confiance.\n` +
      `Respectez vos prescriptions médicales.`;
    return sendSMS(phone, msg);
  }

  async function sendMedicationReminder(phone, patientName, medications, dueDate) {
    if (!phone) return;
    const pharma = await getPharmacyInfo();
    const medList = (medications || []).slice(0, 3).join(', ');
    const dateStr = new Date(dueDate).toLocaleDateString('fr-FR');
    const msg =
      `${pharma.name} — Rappel médicament\n` +
      `Bonjour ${patientName},\n` +
      `Vos médicaments (${medList}) arrivent à renouvellement vers le ${dateStr}.\n` +
      `Contactez-nous : ${pharma.phone}\n` +
      `Ne pas répondre à ce SMS.`;
    return sendSMS(phone, msg);
  }

  async function notifyPatientLotRecall(phone, patientName, productName, lotNumber) {
    if (!phone) return;
    const pharma = await getPharmacyInfo();
    const msg =
      `URGENT — ${pharma.name}\n` +
      `Bonjour ${patientName},\n` +
      `Le médicament "${productName}" (Lot ${lotNumber}) que vous avez reçu fait l'objet d'un RAPPEL.\n` +
      `Cessez immédiatement son utilisation.\n` +
      `Appelez-nous : ${pharma.phone}`;
    return sendSMS(phone, msg);
  }

  // ── DÉCLARATION ANSS ─────────────────────────────────────────────────────
  async function sendANSSDeclaration(declarationData) {
    const pharma = await getPharmacyInfo();
    const user = DB.AppState?.currentUser;

    const payload = {
      meta: {
        pharmacie_nom: pharma.name,
        pharmacie_licence: pharma.dnpm,
        declarant: user?.name || pharma.resp,
        date_declaration: new Date().toISOString(),
        reference_interne: `PV-${Date.now()}`,
      },
      medicament: {
        nom: declarationData.suspectedDrug,
        lot: declarationData.lotNumber || null,
        fabricant: declarationData.manufacturer || null,
        forme: declarationData.form || null,
      },
      patient: {
        age: declarationData.patientAge || null,
        sexe: declarationData.patientGender || null,
        anonymise: true,
      },
      effet_indesirable: {
        description: declarationData.adverseEffect,
        date: declarationData.eventDate,
        gravite: declarationData.severity,
        evolution: declarationData.outcome,
      },
      commentaires: declarationData.comments || '',
    };



    // Enregistrer dans la file
    const qId = await logToQueue({ type: 'ANSS_DECLARATION', payload, status: navigator.onLine ? 'sending' : 'queued' });

    if (!navigator.onLine) {
      return { success: false, queued: true, message: 'Hors ligne — Déclaration envoyée dès reconnexion' };
    }

    // En production — POST au vrai endpoint ANSS Guinea
    try {
      const resp = await fetch(CFG.anss.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CFG.anss.token}`,
          'X-Pharmacy-ID': pharma.dnpm,
        },
        body: JSON.stringify(payload),
      });
      if (resp.ok) {
        const result = await resp.json();

        return { success: true, reference: result.reference };
      } else {
        throw new Error(`ANSS API HTTP ${resp.status}`);
      }
    } catch (err) {
      // L'endpoint de démo n'est pas accessible — enregistrer localement
      console.warn('[ANSS] Endpoint non accessible (mode démo):', err.message);
      UI.toast('Déclaration ANSS enregistrée — Envoi automatique à la reconnexion', 'info', 5000);
      return { success: false, queued: true, message: 'Déclaration mise en attente de synchronisation' };
    }
  }

  // ── SYNCHRONISATION ────────────────────────────────────────────────────────
  async function syncPending() {
    let queue = [];
    try { queue = await DB.dbGetAll('syncQueue'); } catch (e) { return; }
    const pending = queue.filter(q => q.status === 'queued');
    if (!pending.length) return;


    let synced = 0;

    for (const op of pending) {
      try {
        if (op.type === 'ANSS_DECLARATION') {
          const r = await sendANSSDeclaration(op.payload || op);
          if (r.success) { await DB.dbPut('syncQueue', { ...op, status: 'sent' }); synced++; }
        } else if (op.type === 'SMS') {
          const r = await sendSMS(op.phone, op.message);
          if (!r.queued) { await DB.dbPut('syncQueue', { ...op, status: 'sent' }); synced++; }
        }
      } catch (e) { console.warn('[Sync] Erreur op', op.id, e.message); }
    }

    if (synced > 0) UI.toast(`${synced} opération(s) synchronisée(s)`, 'success', 3000);
  }

  // Auto-sync au retour en ligne
  window.addEventListener('online', () => setTimeout(syncPending, 2000));

  // ── API PUBLIQUE ──────────────────────────────────────────────────────────
  return {
    initiatePayment,
    sendSMSReceipt,
    sendMedicationReminder,
    notifyPatientLotRecall,
    sendANSSDeclaration,
    syncPending,
  };

})();

window.MobileMoneyGateway = MobileMoneyGateway;
