// ═══════════════════════════════════════════════════════════════
// SMS MODULE — OrdiveX
// Notifications & Rappels automatisés
// Providers supportés : AfricasTalking, Twilio, Orange SMS API
// ═══════════════════════════════════════════════════════════════

const SMS = (() => {
  // ─── Configuration par défaut ───
  const defaultConfig = {
    provider: 'africastalking', // africastalking | twilio | orange
    apiKey: '',
    username: '', // AfricasTalking username
    senderId: 'OrdiveX',
    countryCode: '+224', // Guinée
    enabled: false,
  };

  // ─── Templates SMS ───
  const templates = {
    debtReminder: (patientName, amount, pharmacyName) =>
      `Bonjour ${patientName}, vous avez un solde impayé de ${amount} GNF auprès de ${pharmacyName}. Merci de régulariser votre situation. Cordialement.`,

    prescriptionRenewal: (patientName, productName, pharmacyName) =>
      `Bonjour ${patientName}, votre traitement (${productName}) arrive à renouvellement. Passez à ${pharmacyName} pour votre ordonnance. Santé!`,

    appointmentReminder: (patientName, date, pharmacyName) =>
      `Rappel : ${patientName}, vous avez un rendez-vous le ${date} à ${pharmacyName}. À bientôt!`,

    custom: (patientName, message) =>
      `Bonjour ${patientName}, ${message}`,
  };

  // ─── Charger la configuration SMS ───
  async function getConfig() {
    try {
      const settings = await DB.dbGetAll('settings');
      const smsSettings = settings.find(s => s.key === 'sms_config');
      return smsSettings ? { ...defaultConfig, ...JSON.parse(smsSettings.value) } : defaultConfig;
    } catch {
      return defaultConfig;
    }
  }

  // ─── Sauvegarder la configuration ───
  async function saveConfig(config) {
    const setting = {
      id: Date.now(),
      key: 'sms_config',
      value: JSON.stringify(config),
      updatedAt: Date.now(),
    };
    // Chercher si la clé existe déjà
    const all = await DB.dbGetAll('settings');
    const existing = all.find(s => s.key === 'sms_config');
    if (existing) setting.id = existing.id;
    await DB.dbPut('settings', setting);
  }

  // ─── Formater le numéro ───
  function formatPhone(phone, countryCode = '+224') {
    if (!phone) return null;
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
    if (!cleaned.startsWith('+')) cleaned = countryCode + cleaned;
    return cleaned;
  }

  // ─── Envoyer un SMS via le provider configuré ───
  async function send(phone, message) {
    const config = await getConfig();

    if (!config.enabled || !config.apiKey) {
      console.warn('[SMS] Module non configuré. Message non envoyé.');
      return { success: false, error: 'SMS non configuré. Allez dans Paramètres → SMS.' };
    }

    const formattedPhone = formatPhone(phone, config.countryCode);
    if (!formattedPhone) {
      return { success: false, error: 'Numéro de téléphone invalide.' };
    }

    try {
      let result;
      switch (config.provider) {
        case 'africastalking':
          result = await sendAfricasTalking(config, formattedPhone, message);
          break;
        case 'twilio':
          result = await sendTwilio(config, formattedPhone, message);
          break;
        case 'orange':
          result = await sendOrange(config, formattedPhone, message);
          break;
        default:
          result = { success: false, error: `Provider inconnu: ${config.provider}` };
      }

      // Enregistrer dans l'historique
      await logSMS(formattedPhone, message, result);
      return result;

    } catch (err) {
      const errorResult = { success: false, error: err.message || 'Erreur réseau' };
      await logSMS(formattedPhone, message, errorResult);
      return errorResult;
    }
  }

  // ─── AfricasTalking API ───
  async function sendAfricasTalking(config, phone, message) {
    const url = 'https://api.africastalking.com/version1/messaging';
    const body = new URLSearchParams({
      username: config.username,
      to: phone,
      message: message,
      from: config.senderId || undefined,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'apiKey': config.apiKey,
      },
      body: body.toString(),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const recipient = data.SMSMessageData?.Recipients?.[0];

    return {
      success: recipient?.statusCode === 101,
      messageId: recipient?.messageId,
      cost: recipient?.cost,
      status: recipient?.status,
    };
  }

  // ─── Twilio API ───
  async function sendTwilio(config, phone, message) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: phone,
      From: config.senderId,
      Body: message,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(config.accountSid + ':' + config.apiKey),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return { success: true, messageId: data.sid, status: data.status };
  }

  // ─── Orange SMS API ───
  async function sendOrange(config, phone, message) {
    const url = 'https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B' +
      encodeURIComponent(config.senderId) + '/requests';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        outboundSMSMessageRequest: {
          address: `tel:${phone}`,
          senderAddress: `tel:+${config.senderId}`,
          outboundSMSTextMessage: { message },
        },
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { success: true };
  }

  // ─── Historique des SMS envoyés ───
  async function logSMS(phone, message, result) {
    try {
      await DB.writeAudit('SMS_SENT', 'sms', null, {
        phone,
        message: message.substring(0, 100),
        success: result.success,
        error: result.error || null,
        provider: (await getConfig()).provider,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error('[SMS] Erreur log:', e);
    }
  }

  // ─── Vérifier les dettes et envoyer des rappels ───
  async function checkDebts(daysThreshold = 7) {
    const config = await getConfig();
    if (!config.enabled) return { sent: 0, errors: [] };

    const sales = await DB.dbGetAll('sales');
    const patients = await DB.dbGetAll('patients');
    const settings = await DB.dbGetAll('settings');
    const pharmacyName = settings.find(s => s.key === 'pharmacyName')?.value || 'Votre pharmacie';

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysThreshold);

    // Trouver les ventes à crédit impayées
    const debtSales = sales.filter(s =>
      s.paymentMethod === 'credit' &&
      s.debtStatus !== 'paid' &&
      new Date(s.date) < cutoff
    );

    // Regrouper par patient
    const debtsByPatient = {};
    debtSales.forEach(sale => {
      if (!sale.patientId) return;
      if (!debtsByPatient[sale.patientId]) debtsByPatient[sale.patientId] = 0;
      debtsByPatient[sale.patientId] += (sale.remainingDebt || sale.total || 0);
    });

    let sent = 0;
    const errors = [];

    for (const [patientId, amount] of Object.entries(debtsByPatient)) {
      const patient = patients.find(p => p.id == patientId);
      if (!patient?.phone) continue;

      const message = templates.debtReminder(
        patient.name || 'Cher(e) client(e)',
        UI.formatCurrency ? UI.formatCurrency(amount).replace(/\s/g, ' ') : amount,
        pharmacyName
      );

      const result = await send(patient.phone, message);
      if (result.success) sent++;
      else errors.push({ patient: patient.name, error: result.error });
    }

    return { sent, errors, total: Object.keys(debtsByPatient).length };
  }

  // ─── Envoi rapide SMS à un patient ───
  async function quickSend(patientId, type, customMessage) {
    const patient = await DB.dbGet('patients', patientId);
    if (!patient?.phone) {
      return { success: false, error: 'Ce patient n\'a pas de numéro de téléphone.' };
    }

    const settings = await DB.dbGetAll('settings');
    const pharmacyName = settings.find(s => s.key === 'pharmacyName')?.value || 'Votre pharmacie';

    let message;
    switch (type) {
      case 'debt': {
        const sales = await DB.dbGetAll('sales');
        const debt = sales
          .filter(s => s.patientId == patientId && s.paymentMethod === 'credit' && s.debtStatus !== 'paid')
          .reduce((sum, s) => sum + (s.remainingDebt || s.total || 0), 0);
        message = templates.debtReminder(patient.name, UI.formatCurrency(debt), pharmacyName);
        break;
      }
      case 'renewal':
        message = templates.prescriptionRenewal(patient.name, customMessage || 'votre traitement', pharmacyName);
        break;
      case 'appointment':
        message = templates.appointmentReminder(patient.name, customMessage || 'prochainement', pharmacyName);
        break;
      case 'custom':
        message = templates.custom(patient.name, customMessage || '');
        break;
      default:
        message = customMessage;
    }

    return send(patient.phone, message);
  }

  // ─── Test de connexion ───
  async function testConnection() {
    const config = await getConfig();
    if (!config.apiKey) return { success: false, error: 'Clé API non configurée' };

    try {
      // Envoyer un SMS de test au numéro de support
      const result = await send('627171397', `[TEST] OrdiveX SMS - ${new Date().toLocaleString()}`);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // ─── Interface publique ───
  return {
    getConfig,
    saveConfig,
    send,
    quickSend,
    checkDebts,
    testConnection,
    templates,
    formatPhone,
  };
})();

// Exposer globalement
window.SMS = SMS;
