/**
 * Support Widget Component — OrdiveX
 * Chatbot d'assistance intégré, intelligent et personnalisé
 * Ne s'affiche qu'APRÈS la connexion de l'utilisateur
 */

let supportChatOpen = false;
let _widgetInitialized = false;

function initSupportWidget() {
 if (_widgetInitialized) {
 // Widget déjà créé, juste le rendre visible
 const w = document.getElementById('support-widget-container');
 if (w) w.style.display = 'block';
 return;
 }

 // 1. Injecter le CSS
 const css = `
 #support-widget-container {
 position: fixed;
 bottom: 24px;
 right: 24px;
 z-index: 9999;
 font-family: 'Inter', 'Segoe UI', sans-serif;
 }

 .support-fab {
 width: 60px;
 height: 60px;
 border-radius: 50%;
 background: linear-gradient(135deg, #1B6FAE, #2980b9);
 color: #fff;
 display: flex;
 align-items: center;
 justify-content: center;
 cursor: pointer;
 box-shadow: 0 4px 15px rgba(27, 111, 174, 0.4);
 transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
 position: absolute;
 bottom: 0;
 right: 0;
 z-index: 2;
 }

 .support-fab:hover {
 transform: scale(1.1);
 }

 .support-fab svg {
 width: 28px;
 height: 28px;
 }
 
 .support-pulse {
 position: absolute;
 width: 60px;
 height: 60px;
 border-radius: 50%;
 background: #1B6FAE;
 z-index: 1;
 right: 0;
 bottom: 0;
 animation: supportPulseAnim 2s infinite;
 opacity: 0;
 }
 
 @keyframes supportPulseAnim {
 0% { transform: scale(1); opacity: 0.6; }
 100% { transform: scale(1.6); opacity: 0; }
 }

 .support-window {
 position: absolute;
 bottom: 80px;
 right: 0;
 width: 380px;
 height: 550px;
 background: #fdfdfd;
 border-radius: 20px;
 box-shadow: 0 12px 48px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.05);
 display: flex;
 flex-direction: column;
 overflow: hidden;
 transform: scale(0);
 transform-origin: bottom right;
 transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2), opacity 0.3s;
 opacity: 0;
 pointer-events: none;
 border: 1px solid rgba(0,0,0,0.06);
 }

 .support-window.open {
 transform: scale(1);
 opacity: 1;
 pointer-events: auto;
 }

 .support-header {
 background: linear-gradient(135deg, #091a32, #1b3d68);
 color: #fff;
 padding: 20px;
 display: flex;
 align-items: center;
 justify-content: space-between;
 border-bottom: 1px solid rgba(255,255,255,0.1);
 }

 .support-header-info {
 display: flex;
 align-items: center;
 gap: 14px;
 }
 
 .support-avatar {
 width: 44px;
 height: 44px;
 background: linear-gradient(135deg, #12c2e9, #c471ed, #f64f59);
 border-radius: 50%;
 display: flex;
 align-items: center;
 justify-content: center;
 box-shadow: 0 4px 10px rgba(0,0,0,0.2);
 position: relative;
 }
 
 .support-avatar-inner {
 width: 40px;
 height: 40px;
 background: #091a32;
 border-radius: 50%;
 display: flex;
 align-items: center;
 justify-content: center;
 font-weight: 800;
 font-size: 20px;
 letter-spacing: -1px;
 color: #fff;
 }

 .support-title {
 font-weight: 700;
 font-size: 16px;
 margin: 0;
 letter-spacing: 0.3px;
 }

 .support-subtitle {
 font-size: 12px;
 opacity: 0.85;
 margin: 2px 0 0 0;
 display: flex;
 align-items: center;
 gap: 6px;
 }
 
 .support-status-dot {
 width: 8px;
 height: 8px;
 background: #10b981;
 border-radius: 50%;
 box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
 }

 .support-close {
 background: none;
 border: none;
 color: #fff;
 cursor: pointer;
 opacity: 0.7;
 transition: opacity 0.2s;
 }

 .support-close:hover {
 opacity: 1;
 }

 .support-body {
 flex: 1;
 background: #f3f6f9;
 padding: 20px;
 overflow-y: auto;
 display: flex;
 flex-direction: column;
 gap: 16px;
 scroll-behavior: smooth;
 }

 .chat-bubble {
 max-width: 85%;
 padding: 12px 16px;
 border-radius: 18px;
 font-size: 13.5px;
 line-height: 1.5;
 animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.2);
 word-wrap: break-word;
 }
 
 @keyframes popIn {
 0% { transform: translateY(10px) scale(0.95); opacity: 0; }
 100% { transform: translateY(0) scale(1); opacity: 1; }
 }

 .chat-bot {
 background: #ffffff;
 color: #1e293b;
 align-self: flex-start;
 border-bottom-left-radius: 4px;
 box-shadow: 0 2px 8px rgba(0,0,0,0.04);
 border: 1px solid rgba(0,0,0,0.03);
 position: relative;
 }
 
 .chat-bot strong {
 color: #091a32;
 }

 .chat-user {
 background: linear-gradient(135deg, #091a32, #1b3d68);
 color: #ffffff;
 align-self: flex-end;
 border-bottom-right-radius: 4px;
 box-shadow: 0 4px 12px rgba(9, 26, 50, 0.15);
 }

 .support-actions {
 display: flex;
 flex-wrap: wrap;
 gap: 8px;
 margin-top: 6px;
 }

 .support-btn {
 background: #ffffff;
 border: 1px solid #e2e8f0;
 color: #334155;
 padding: 8px 14px;
 border-radius: 20px;
 font-size: 12px;
 font-weight: 500;
 cursor: pointer;
 transition: all 0.2s ease;
 box-shadow: 0 1px 2px rgba(0,0,0,0.02);
 display: flex;
 align-items: center;
 gap: 6px;
 }

 .support-btn:hover {
 background: #f8fafc;
 border-color: #cbd5e1;
 transform: translateY(-1px);
 box-shadow: 0 2px 4px rgba(0,0,0,0.05);
 }

 .support-footer {
 padding: 16px;
 background: #fff;
 border-top: 1px solid rgba(0,0,0,0.04);
 display: flex;
 flex-direction: column;
 gap: 12px;
 }

 .support-input-row {
 display: flex;
 gap: 10px;
 align-items: center;
 background: #f1f5f9;
 border-radius: 24px;
 padding: 4px 4px 4px 16px;
 border: 1px solid transparent;
 transition: border-color 0.2s;
 }
 
 .support-input-row:focus-within {
 border-color: #cbd5e1;
 background: #fff;
 box-shadow: 0 0 0 3px rgba(9, 26, 50, 0.05);
 }

 .support-input-row input {
 flex: 1;
 border: none;
 background: transparent;
 padding: 8px 0;
 font-size: 13.5px;
 outline: none;
 color: #1e293b;
 font-family: inherit;
 }
 
 .support-input-row input::placeholder {
 color: #94a3b8;
 }

 .support-send-btn {
 width: 38px;
 height: 38px;
 border-radius: 50%;
 background: #091a32;
 color: #fff;
 border: none;
 display: flex;
 align-items: center;
 justify-content: center;
 cursor: pointer;
 transition: all 0.2s;
 flex-shrink: 0;
 }

 .support-send-btn:hover {
 background: #1b3d68;
 transform: scale(1.05);
 }
 
 .whatsapp-btn {
 display: inline-flex;
 align-items: center;
 gap: 8px;
 background: #25D366;
 color: #fff;
 text-decoration: none;
 padding: 10px 16px;
 border-radius: 12px;
 font-size: 13px;
 font-weight: 600;
 transition: all 0.2s;
 width: 100%;
 justify-content: center;
 box-sizing: border-box;
 border: 1px solid rgba(0,0,0,0.05);
 }
 
 .whatsapp-btn:hover {
 background: #128C7E;
 transform: translateY(-1px);
 box-shadow: 0 4px 12px rgba(37, 211, 102, 0.2);
 }
 
 .typing-indicator {
 display: flex;
 gap: 4px;
 padding: 4px 8px;
 align-items: center;
 height: 20px;
 }
 
 .typing-dot {
 width: 6px;
 height: 6px;
 background: #94a3b8;
 border-radius: 50%;
 animation: typingBounce 1.4s infinite ease-in-out both;
 }
 
 .typing-dot:nth-child(1) { animation-delay: -0.32s; }
 .typing-dot:nth-child(2) { animation-delay: -0.16s; }
 
 @keyframes typingBounce {
 0%, 80%, 100% { transform: scale(0); }
 40% { transform: scale(1); }
 }
 
 @media (max-width: 600px) {
 #support-widget-container {
 bottom: 0;
 right: 0;
 left: 0;
 top: 0;
 width: 100%;
 height: 100%;
 pointer-events: none;
 z-index: 10000;
 }
 .support-window {
 position: fixed;
 top: calc(12px + env(safe-area-inset-top, 0px));
 bottom: calc(12px + env(safe-area-inset-bottom, 0px));
 left: 8px;
 right: 8px;
 width: auto !important;
 height: auto !important;
 max-height: calc(100dvh - 24px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
 border-radius: 20px;
 transform-origin: bottom center;
 overflow: hidden;
 }
 .support-window .support-body {
 flex: 1;
 overflow-y: auto;
 -webkit-overflow-scrolling: touch;
 }
 .support-fab {
 position: fixed;
 bottom: calc(20px + env(safe-area-inset-bottom, 0px));
 right: 20px;
 pointer-events: auto;
 z-index: 10001;
 }
 .support-window.open {
 pointer-events: auto;
 }
 .support-header {
 padding: 14px 16px;
 padding-top: calc(14px + env(safe-area-inset-top, 0px));
 }
 .support-close {
 width: 36px;
 height: 36px;
 min-width: 36px;
 display: flex;
 align-items: center;
 justify-content: center;
 background: rgba(255,255,255,0.2);
 border-radius: 50%;
 flex-shrink: 0;
 }
 .support-close svg {
 width: 18px;
 height: 18px;
 }
 .support-footer {
 padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
 }
 }

 #naomi-backdrop {
 display: none;
 position: fixed;
 inset: 0;
 background: rgba(0,0,0,0.5);
 z-index: 9998;
 backdrop-filter: blur(2px);
 -webkit-backdrop-filter: blur(2px);
 }

 #naomi-backdrop.active {
 display: block;
 }
 `;

 const styleEl = document.createElement('style');
 styleEl.innerHTML = css;
 document.head.appendChild(styleEl);

 // Récupérer le nom de l'utilisateur connecté
 const userName = (window.DB && DB.AppState && DB.AppState.currentUser) 
 ? DB.AppState.currentUser.name || DB.AppState.currentUser.username 
 : 'Pharmacien';
 const firstName = userName.split(' ')[0];

 // 2. Injecter le HTML
 const html = `
 <div id="support-widget-container">
 <div class="support-pulse" id="support-pulse"></div>
 <div class="support-window" id="support-window">
 <div class="support-header">
 <div class="support-header-info">
 <div class="support-avatar">
 <div class="support-avatar-inner">N</div>
 </div>
 <div>
 <div class="support-title">Naomie AI</div>
 <div class="support-subtitle"><div class="support-status-dot"></div> En ligne — Propulsé par OrdiveX</div>
 </div>
 </div>
 <button class="support-close" onclick="toggleSupportWindow()">
 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
 </button>
 </div>
 <div class="support-body" id="support-chat-body">
 <div class="chat-bubble chat-bot">
 Bonjour <strong>${firstName}</strong>. Je suis <strong>Naomie</strong>, l'intelligence artificielle dédiée d'OrdiveX. 
 <br><br>Comment puis-je optimiser la gestion de votre officine aujourd'hui ?
 </div>
 </div>
 <div class="support-footer">
 <div class="support-input-row">
 <input type="text" id="support-free-input" placeholder="Tapez votre question ici..." onkeydown="if(event.key==='Enter') submitFreeQuestion()">
 <button class="support-send-btn" onclick="submitFreeQuestion()" title="Envoyer">
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
 </button>
 </div>
 <a href="https://wa.me/224627171397?text=Bonjour%20TrillionX%2C%20j%27ai%20besoin%20d%27assistance%20avec%20OrdiveX." target="_blank" class="whatsapp-btn">
 <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
 Parler à un Humain (WhatsApp)
 </a>
 </div>
 </div>
 
 <div class="support-fab" onclick="toggleSupportWindow()">
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
 </div>
 </div>
 `;

 document.body.insertAdjacentHTML('beforeend', '<div id="naomi-backdrop" onclick="toggleSupportWindow()"></div>');
 document.body.insertAdjacentHTML('beforeend', html);
 _widgetInitialized = true;
 showQuickOptions();
 makeWidgetDraggable();

 // Bouton Retour Android (popstate)
 window.addEventListener('popstate', function(e) {
 if (supportChatOpen) {
 e.preventDefault();
 toggleSupportWindow();
 }
 });
}

function makeWidgetDraggable() {
  const container = document.getElementById('support-widget-container');
  const fab = container ? container.querySelector('.support-fab') : null;
  if (!container || !fab) return;

  let isDragging = false;
  let startX = 0, startY = 0;
  let initLeft = 0, initTop = 0;
  const dragThreshold = 6;
  let hasMoved = false;

  // Mémoriser/Restaurer la position mémorisée
  const savedX = localStorage.getItem('naomi_pos_x');
  const savedY = localStorage.getItem('naomi_pos_y');
  if (savedX !== null && savedY !== null) {
    container.style.bottom = 'auto';
    container.style.right = 'auto';
    container.style.left = savedX;
    container.style.top = savedY;
    
    // Ajuster l'alignement de la fenêtre selon la position restaurée
    const rect = container.getBoundingClientRect();
    const sw = document.getElementById('support-window');
    if (sw) {
      if (rect.left < window.innerWidth / 2) {
        sw.style.right = 'auto';
        sw.style.left = '70px';
        sw.style.transformOrigin = 'bottom left';
      } else {
        sw.style.left = 'auto';
        sw.style.right = '0';
        sw.style.transformOrigin = 'bottom right';
      }
    }
  }

  // Événements Souris
  fab.addEventListener('mousedown', onDragStart);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);

  // Événements Tactiles
  fab.addEventListener('touchstart', onDragStart, { passive: false });
  window.addEventListener('touchmove', onDragMove, { passive: false });
  window.addEventListener('touchend', onDragEnd);

  function onDragStart(e) {
    isDragging = true;
    hasMoved = false;
    
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    
    startX = clientX;
    startY = clientY;
    
    const rect = container.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;
    
    if (e.type !== 'touchstart') {
      e.preventDefault();
    }
  }

  function onDragMove(e) {
    if (!isDragging) return;
    
    const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
    
    const dx = clientX - startX;
    const dy = clientY - startY;
    
    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
      hasMoved = true;
    }
    
    if (hasMoved) {
      let newLeft = initLeft + dx;
      let newTop = initTop + dy;
      
      const pad = 12;
      const maxLeft = window.innerWidth - container.offsetWidth - pad;
      const maxTop = window.innerHeight - container.offsetHeight - pad;
      
      newLeft = Math.max(pad, Math.min(newLeft, maxLeft));
      newTop = Math.max(pad, Math.min(newTop, maxTop));
      
      container.style.bottom = 'auto';
      container.style.right = 'auto';
      container.style.left = newLeft + 'px';
      container.style.top = newTop + 'px';
      
      // Ajuster le positionnement de la boîte de chat Naomi en fonction de la position du FAB
      const sw = document.getElementById('support-window');
      if (sw) {
        if (newLeft < window.innerWidth / 2) {
          sw.style.right = 'auto';
          sw.style.left = '70px';
          sw.style.transformOrigin = 'bottom left';
        } else {
          sw.style.left = 'auto';
          sw.style.right = '0';
          sw.style.transformOrigin = 'bottom right';
        }
      }
    }
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    
    if (hasMoved) {
      localStorage.setItem('naomi_pos_x', container.style.left);
      localStorage.setItem('naomi_pos_y', container.style.top);
      
      // Bloquer le clic d'ouverture instantané après un glissement
      fab.style.pointerEvents = 'none';
      setTimeout(() => { fab.style.pointerEvents = 'auto'; }, 80);
    }
  }
}

function hideSupportWidget() {
 const w = document.getElementById('support-widget-container');
 if (w) w.style.display = 'none';
 supportChatOpen = false;
 const sw = document.getElementById('support-window');
 if (sw) sw.classList.remove('open');
}

window.toggleSupportWindow = function() {
 const w = document.getElementById('support-window');
 const p = document.getElementById('support-pulse');
 const backdrop = document.getElementById('naomi-backdrop');
 if (supportChatOpen) {
 w.classList.remove('open');
 if (p) p.style.display = 'block';
 if (backdrop) backdrop.classList.remove('active');
 // Retour Android : ne pas empiler l'historique à la fermeture
 } else {
 w.classList.add('open');
 if (p) p.style.display = 'none';
 if (backdrop) backdrop.classList.add('active');
 const oldFab = document.getElementById('support-chat-fab');
 if(oldFab) oldFab.style.display = 'none';
 // Push history pour capturer le bouton Retour Android
 history.pushState({ naomiOpen: true }, '');
 // Focus sur l'input
 setTimeout(() => {
 const inp = document.getElementById('support-free-input');
 if (inp) inp.focus();

 }, 350);
 }
 supportChatOpen =!supportChatOpen;
};

// ═══════════════════════════════════════════════════════════════════
// BASE DE CONNAISSANCES FAQ — 20+ topics couvrant TOUT OrdiveX
// ═══════════════════════════════════════════════════════════════════
const FAQ_DATABASE = [
 {
 keywords: ['dette', 'crédit', 'ardoise', 'impayé', 'doit'],
 question: 'Comment gérer les crédits / dettes ?',
 answer:"Pour créer une vente à crédit, allez dans le **Point de Vente**, choisissez le mode de paiement **« Crédit »**, puis sélectionnez une date d'échéance. Le patient doit être identifié.\n\nPour encaisser une dette, rendez-vous dans **Historique des Ventes** et cliquez sur le bouton **« Encaisser la dette »** à côté de la vente concernée."
 },
 {
 keywords: ['vente', 'annuler', 'supprimer', 'historique', 'facture', 'reçu'],
 question: 'Comment annuler ou voir une vente ?',
 answer:"Allez dans **Historique des Ventes** depuis le menu. Chaque vente a un bouton 👁️ pour voir le détail complet (reçu, articles, patient).\n\nPour annuler, cliquez sur la vente puis utilisez le bouton d'annulation. Le stock sera automatiquement réajusté."
 },
 {
 keywords: ['assurance', 'mutuelle', 'tiers', 'payant', 'prise en charge', 'couverture'],
 question: 'Comment fonctionne la prise en charge Assurance ?',
 answer:"Au **Point de Vente**, choisissez le paiement **« Assurance »**. Renseignez :\n• Le nom de l'organisme (ex: CNSS, ASCOMA)\n• La référence de prise en charge\n• Le montant couvert par l'entreprise\n\nLe système calcule automatiquement le **ticket modérateur** (part patient) et l'encaisse immédiatement. La part entreprise reste en attente de règlement. ️"
 },
 {
 keywords: ['péremption', 'expiration', 'périmé', 'fefo', 'lot', 'date'],
 question: 'Comment gérer les dates de péremption ?',
 answer:"OrdiveX utilise la méthode **FEFO** (First Expired, First Out) automatiquement! Lors d'une vente, le lot avec la date d'expiration la plus proche est déstocké en priorité.\n\nLes alertes de péremption apparaissent dans le **Centre d'Alertes** quand un lot arrive à moins de 3 mois de sa date limite."
 },
 {
 keywords: ['imprimante', 'bluetooth', 'ticket', 'impression', 'xprinter'],
 question: 'Comment connecter mon imprimante ?',
 answer:"Utilisez une imprimante thermique Bluetooth (ex: Xprinter). Allez dans les **paramètres Bluetooth** de votre appareil pour l'appairer.\n\nPour imprimer un reçu, validez une vente puis cliquez sur **« Imprimer »** dans la fenêtre de confirmation. Le format est optimisé pour les rouleaux de 58mm et 80mm. ️"
 },
 {
 keywords: ['stock', 'inventaire', 'quantité', 'rupture', 'disponible'],
 question: 'Comment consulter et gérer le stock ?',
 answer:"Allez dans **Gestion des Stocks** pour voir tous vos produits avec leurs quantités en temps réel.\n\nVous pouvez :\n• Faire un **inventaire** pour corriger les écarts\n• Voir les **mouvements** (entrées/sorties) de chaque produit\n• Identifier les **ruptures** et **stocks bas** d'un coup d'œil\n\nLes produits en rupture sont signalés avec une pastille rouge."
 },
 {
 keywords: ['commande', 'fournisseur', 'commander', 'achat', 'réception', 'bon'],
 question: 'Comment passer une commande fournisseur ?',
 answer:"Allez dans **Fournisseurs & Achats** :\n1. Créez d'abord un fournisseur si ce n'est pas fait\n2. Cliquez sur **« Nouvelle Commande »**\n3. Ajoutez les produits et quantités\n4. Envoyez la commande\n\nÀ la livraison, cliquez **« Réceptionner »** pour valider les quantités reçues, les lots et les dates de péremption. Le stock est mis à jour automatiquement! ➡️"
 },
 {
 keywords: ['déconditionnement', 'unité', 'plaquette', 'fractionner', 'comprimé', 'boîte'],
 question: 'Comment vendre à l\'unité (déconditionnement) ?',
 answer:"Dans le **Catalogue Produits**, modifiez le produit et activez **« Autoriser la vente à l'unité »**.\n\nConfigurez :\n• Nombre de sous-unités par boîte (ex: 2 plaquettes)\n• Nombre d'unités par sous-unité (ex: 10 gélules/plaquette)\n• Prix de vente par plaquette et par unité\n\nAu POS, des boutons **Boîte / Plaq. / Unité** apparaîtront automatiquement!"
 },
 {
 keywords: ['patient', 'client', 'fiche', 'dossier', 'allergie'],
 question: 'Comment gérer les dossiers patients ?',
 answer:"Allez dans **Dossiers Patients** pour créer ou consulter une fiche :\n• Nom, téléphone, adresse, sexe\n• **Allergies** — le POS vous alertera si vous ajoutez un médicament allergène!\n• Statut : Souscripteur principal ou Ayant Droit\n• Historique complet des achats et ordonnances\n\nVous pouvez aussi créer un patient **directement depuis le POS** avec le bouton '+'."
 },
 {
 keywords: ['ordonnance', 'prescription', 'médecin', 'docteur'],
 question: 'Comment créer et lier une ordonnance ?',
 answer:"Au **Point de Vente**, activez le toggle **« Ordonnance »** puis :\n1. Cliquez **« Lier une ordonnance »** pour en sélectionner une existante\n2. Ou **créez-en une nouvelle** avec le médecin prescripteur et les médicaments\n\nLes produits de l'ordonnance sont automatiquement ajoutés au panier. Le pharmacien dispose d'un bouton de **validation pharmaceutique**. 📄"
 },
 {
 keywords: ['statistique', 'tableau', 'bord', 'chiffre', 'affaire', 'marge', 'panier', 'moyen', 'pilotage'],
 question: 'Comment accéder aux statistiques ?',
 answer:"Deux vues disponibles :\n\n **Tableau de Bord** : Vue globale avec les KPIs du jour (CA, nombre de ventes, top produits, graphiques)\n\n **Pilotage** : Analyses détaillées avec le **Panier Moyen**, la **Marge Nette**, le **CA par période**, les **tendances de ventes** et la **répartition financière**.\n\nExportez vos rapports en un clic!"
 },
 {
 keywords: ['sauvegarde', 'backup', 'restaurer', 'données', 'json'],
 question: 'Comment sauvegarder mes données ?',
 answer:"Allez dans **Paramètres > Synchronisation** :\n\n **Sauvegarde locale** : Cliquez « Sauvegarder maintenant » pour télécharger un fichier JSON contenant toutes vos données.\n\n️ **Cloud (Supabase)** : Si configuré, vos données se synchronisent automatiquement. Pensez à faire un **PULL** régulièrement pour récupérer les données des autres appareils!"
 },
 {
 keywords: ['synchronisation', 'sync', 'cloud', 'supabase', 'pull', 'push', 'appareil', 'mobile'],
 question: 'Comment synchroniser entre plusieurs appareils ?',
 answer:"OrdiveX fonctionne en mode **offline-first** :\n\n1. Configurez Supabase dans **Paramètres > Appareil & Cloud**\n2. Les données se **PUSH** (envoient) automatiquement\n3. Faites un **PULL** (dans Paramètres) pour récupérer les données d'un autre appareil\n\n️ Pensez à faire un PULL chaque semaine si vous travaillez hors-ligne depuis longtemps!"
 },
 {
 keywords: ['caisse', 'clôture', 'journée', 'encaissement', 'espèce', 'orange money'],
 question: 'Comment fonctionne la caisse ?',
 answer:"La **Caisse** affiche en temps réel :\n• Le total des ventes du jour\n• La répartition par mode de paiement (Espèces, Orange Money, MTN MoMo)\n• Les ventes à crédit et les couvertures assurance\n• Le montant total en attente de règlement\n\nChaque vente du jour est listée avec ses détails. C'est votre tableau de bord financier quotidien! 💵"
 },
 {
 keywords: ['alerte', 'notification', 'rupture', 'stock bas', 'centre'],
 question: 'Comment fonctionnent les alertes ?',
 answer:"Le **Centre d'Alertes** détecte automatiquement :\n\n **Ruptures de stock** : Produits à 0 unité\n **Stock bas** : En dessous du seuil configuré\n **Péremptions proches** : Lots expirant dans les 3 prochains mois\n\nLes alertes sont triées par priorité et vous pouvez les filtrer. Le badge rouge dans le menu indique le nombre d'alertes non lues."
 },
 {
 keywords: ['interaction', 'médicament', 'contre-indication', 'allergie', 'combinaison'],
 question: 'Comment sont gérées les interactions médicamenteuses ?',
 answer:"OrdiveX vérifie automatiquement les **30 interactions critiques** les plus courantes à chaque ajout au panier!\n\n **Grave** : Alerte rouge (ex: Warfarine + Aspirine = Hémorragie)\n️ **Modéré** : Alerte orange (ex: Fer + Ciprofloxacine = Absorption réduite)\n\nDe plus, si le patient a des **allergies** renseignées, le POS vous alertera immédiatement."
 },
 {
 keywords: ['sms', 'message', 'envoi', 'africastalking', 'rappel'],
 question: 'Comment envoyer des SMS aux patients ?',
 answer:"Configurez le service SMS dans **Paramètres > Configuration SMS** :\n1. Choisissez le fournisseur (AfricasTalking recommandé)\n2. Entrez votre clé API et l'expéditeur\n3. Testez avec le bouton « Tester l'envoi »\n\nVous pouvez ensuite envoyer des rappels de dette, des notifications de commande prête, etc."
 },
 {
 keywords: ['notice', 'rcp', 'posologie', 'effet', 'indésirable', 'précaution'],
 question: 'Comment consulter la notice d\'un médicament ?',
 answer:"Deux façons d'accéder à la notice :\n\n1. **Au POS** : Cliquez le bouton **ℹ️** sur la carte du produit ou dans le panier\n2. **Au Catalogue** : Ouvrez la fiche du produit\n\nLa notice affiche : Posologie, Précautions d'emploi, Contre-indications, Effets indésirables et le RCP complet. Vous pouvez aussi télécharger le PDF du laboratoire si disponible. 📖"
 },
 {
 keywords: ['menu', 'navigation', 'accès', 'section', 'module', 'page', 'aller', 'trouver', 'ouvrir'],
 question: 'Comment naviguer dans le menu ?',
 answer:"Le menu principal contient toutes les sections de OrdiveX :\n\n **Point de Vente (POS)** — Faire une vente\n **Gestion des Stocks** — Consulter et ajuster les stocks\n **Catalogue Produits** — Gérer le catalogue médicaments\n **Dossiers Patients** — Fiches et historiques patients\n **Historique des Ventes** — Toutes les ventes effectuées\n🚚 **Fournisseurs & Achats** — Commandes et réceptions\n **Caisse** — Encaissements du jour\n **Tableau de Bord** — KPIs en temps réel\n **Pilotage** — Analyses avancées\n **Alertes** — Ruptures et péremptions\n️ **Paramètres** — Configuration complète"
 },
 {
 keywords: ['retour', 'remboursement', 'échange', 'renvoyer', 'rendre', 'retourné'],
 question: 'Comment gérer un retour de médicament ?',
 answer:"Allez dans **Historique des Ventes** et trouvez la vente concernée.\n\nCliquez sur le bouton **« Retour »** . Vous pouvez :\n• Retourner **tout** ou **une partie** des articles\n• Choisir le **motif** du retour (erreur, péremption, contre-indication)\n• Choisir le **mode de remboursement** (Espèces, Mobile Money, Avoir)\n\nLe stock est automatiquement réajusté à la hausse après validation."
 },
 {
 keywords: ['produit', 'médicament', 'ajouter', 'créer', 'catalogue', 'référence', 'nouveau'],
 question: 'Comment ajouter un nouveau médicament ?',
 answer:"Allez dans **Catalogue Produits** et cliquez **« + Nouveau Produit »** :\n\n Renseignez :\n• Nom commercial, DCI (molécule), Marque\n• Forme (comprimé, sirop, injection...)\n• **Prix d'achat** et **prix de vente**\n• Stock minimum de sécurité\n• Doses, précautions, notice médicale (optionnels)\n\nN'oubliez pas de configurer les **lots et dates de péremption** dans la section stock après!"
 },
 {
 keywords: ['utilisateur', 'employé', 'rôle', 'pharmacien', 'caissier', 'accès', 'compte', 'mot de passe'],
 question: 'Comment gérer les accès utilisateurs ?',
 answer:"Allez dans **Paramètres > Utilisateurs** (accès réservé au Manager/Admin) :\n\n Vous pouvez créer des comptes avec différents rôles :\n• **Manager** — Accès complet (ventes, stocks, rapports, paramètres)\n• **Pharmacien** — Ventes, consultation stocks, patients\n• **Caissier** — Point de vente uniquement\n\nChaque connexion est **tracée dans l'audit** : qui a fait quoi et quand. 🔐"
 },
 {
 keywords: ['paramètre', 'configuration', 'pharmacie', 'nom', 'logo', 'adresse', 'devise', 'monnaie'],
 question: 'Comment configurer les paramètres de la pharmacie ?',
 answer:"Allez dans **️ Paramètres** puis :\n\n **Informations Pharmacie** : Nom, adresse, téléphone, numéro d'agrément, logo (affiché sur les reçus)\n **Devise** : Choisissez votre monnaie locale (GNF, XOF, MAD...)\n️ **Impression** : Format du reçu, texte de pied de page\n **SMS** : Configuration du service d'envoi SMS\n️ **Cloud** : Clés Supabase pour la synchro multi-appareils\n\nTous les changements s'enregistrent et se synchronisent automatiquement. ️"
 },
 {
 keywords: ['mouvement', 'entrée', 'sortie', 'tracabilité', 'historique stock', 'journal'],
 question: 'Comment voir les mouvements de stock ?',
 answer:"Dans **Gestion des Stocks**, cliquez sur un produit puis sur **« Mouvements »** :\n\nVous verrez toutes les entrées et sorties :\n **Entrée** — Réception fournisseur, ajustement inventaire\n **Sortie** — Vente, perte, destruction\n **Ajustement** — Correction manuelle après inventaire\n\nChaque mouvement indique la date, l'utilisateur et la raison. C'est votre traçabilité complète pour les contrôles!"
 },
 {
 keywords: ['impression', 'imprimer', 'rapport', 'centre', 'pdf', 'document', 'inventaire'],
 question: 'Comment utiliser le Centre d\'Impression ?',
 answer:"Accédez au **Centre d'Impression** depuis le menu. Vous disposez de plusieurs types de documents :\\n\\n▪ **Inventaire de Stock** — Rapport complet paginé avec valeurs d'achat/vente, synthèse des ruptures et stocks bas\\n▪ **Rapport de Caisse** — Récapitulatif des encaissements journaliers par mode de paiement\\n▪ **Facture / Ticket** — Accessible depuis l'Historique des Ventes pour chaque transaction\\n▪ **PV de Destruction** — Procès-verbal réglementaire DNPM depuis le module Traçabilité\\n▪ **Ordonnance** — Impression officielle avec posologie et prescripteur\\n\\nLes rapports de stock sont **paginés automatiquement** (500 produits par page) pour garantir la fluidité même avec 100 000+ références."
 },
 {
 keywords: ['traçabilité', 'pharmacovigilance', 'audit', 'journal', 'destruction', 'dnpm', 'contrôle'],
 question: 'Comment fonctionne la traçabilité ?',
 answer:"Le module **Traçabilité & Pharmacovigilance** assure la conformité réglementaire :\\n\\n▪ **Journal d'Audit** — Chaque action (vente, modification, suppression) est horodatée avec l'utilisateur responsable\\n▪ **Destruction de lots** — Procédure officielle avec PV imprimable : motif, méthode, témoins, date\\n▪ **Déclarations de pharmacovigilance** — Signalement d'effets indésirables avec rapport DNPM\\n▪ **Suivi des lots** — Traçabilité complète lot par lot depuis la réception jusqu'à la dispensation\\n\\nTous les PV sont imprimables et conformes aux exigences de l'Inspection Pharmaceutique."
 },
 {
 keywords: ['kpi', 'pilotage', 'business', 'intelligence', 'bénéfice', 'chiffre', 'affaires', 'ca net', 'rotation'],
 question: 'Comment analyser mes KPIs Business Intelligence ?',
 answer:"Le module **Business Intelligence** offre une consolidation financière complète :\\n\\n▪ **Bénéfice Brut Total** — Vue instantanée de votre rentabilité\\n▪ **CA Net Cumulé** — Chiffre d'affaires après retours\\n▪ **Marge Globale** — Pourcentage de marge sur coût d'achat\\n▪ **Panier Moyen** — Dépense moyenne par transaction\\n▪ **Rotation Stock** — Vitesse d'écoulement de vos produits\\n▪ **Santé Stock** — Pourcentage de références disponibles\\n▪ **Taux de Recouvrement** — Suivi des créances\\n\\nAccessible via le menu **Pilotage** ou **Métriques Business**. Export CSV disponible pour la comptabilité."
 },
 {
 keywords: ['mobile', 'téléphone', 'smartphone', 'tablette', 'responsive', 'tactile'],
 question: 'Comment utiliser OrdiveX sur mobile ?',
 answer:"OrdiveX est une **Progressive Web App** (PWA) installable :\\n\\n▪ **Installation** — Ouvrez l'app dans Chrome, puis touchez « Ajouter à l'écran d'accueil »\\n▪ **Interface tactile** — Tous les boutons font 44px minimum, optimisés pour le tactile\\n▪ **Menu mobile** — Accessible via l'icône ☰ en haut à gauche\\n▪ **POS mobile** — Scan code-barres via la caméra du téléphone\\n▪ **Mode hors-ligne** — Fonctionne à 100% sans internet\\n\\nLa synchronisation avec le PC se fait automatiquement via le cloud quand internet est disponible."
 },
 {
 keywords: ['thème', 'sombre', 'dark', 'clair', 'mode', 'nuit', 'couleur', 'apparence'],
 question: 'Comment activer le thème sombre ?',
 answer:"Cliquez sur l'icône **lune** dans la barre supérieure de l'application.\\n\\n▪ **Mode clair** — Fond blanc, texte sombre (idéal en journée)\\n▪ **Mode sombre** — Fond bleu nuit, texte clair (confort visuel la nuit)\\n\\nLe choix est sauvegardé automatiquement. La prochaine fois que vous ouvrez l'application, votre préférence sera conservée."
 },
 {
 keywords: ['fefo', 'fifo', 'premier', 'périmé', 'sort', 'lot', 'priorité', 'expiration', 'protocole'],
 question: 'Comment fonctionne le protocole FEFO ?',
 answer:"Le protocole **FEFO** (First Expired, First Out) est appliqué **automatiquement** par OrdiveX :\\n\\n▪ À chaque vente, le système sélectionne le lot dont la **date d'expiration est la plus proche**\\n▪ Cela réduit le gaspillage et les pertes liées aux péremptions\\n▪ Différent du FIFO (First In, First Out) qui se base sur la date d'entrée\\n\\nVous n'avez rien à configurer : le FEFO est activé par défaut sur tous les produits avec gestion de lots."
 },
];

const GREETINGS = [
"Bien sûr, voici les informations demandées :",
"Voici la procédure à suivre :",
"Je vous accompagne sur ce point :",
"Voici la réponse à votre question :",
"Permettez-moi de vous expliquer :",
"Voici ce que je peux vous indiquer :",
];

function getGreeting() {
 return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}

function getUserName() {
 if (window.DB && DB.AppState && DB.AppState.currentUser) {
 return DB.AppState.currentUser.name || DB.AppState.currentUser.username || 'Pharmacien';
 }
 return 'Pharmacien';
}

function matchFAQ(input) {
 const q = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
 let bestMatch = null;
 let bestScore = 0;

 for (const entry of FAQ_DATABASE) {
 let score = 0;
 for (const kw of entry.keywords) {
 const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
 if (q.includes(kwNorm)) {
 score += kwNorm.length; // Weight by keyword length (more specific = higher score)
 }
 }
 if (score > bestScore) {
 bestScore = score;
 bestMatch = entry;
 }
 }

 return bestScore >= 3 ? bestMatch : null;
}

function showQuickOptions() {
 const body = document.getElementById('support-chat-body');
 if (!body) return;
 const acts = document.createElement('div');
 acts.className = 'support-actions';
 // Afficher les 6 sujets les plus fréquents
 const quickTopics = [
 { label: '<i data-lucide="compass" style="width:14px;height:14px"></i> Navigation', idx: 18 },
 { label: '<i data-lucide="credit-card" style="width:14px;height:14px"></i> Crédits', idx: 0 },
 { label: '<i data-lucide="truck" style="width:14px;height:14px"></i> Commandes', idx: 6 },
 { label: '<i data-lucide="package" style="width:14px;height:14px"></i> Stocks', idx: 5 },
 { label: '<i data-lucide="printer" style="width:14px;height:14px"></i> Impression', idx: 22 },
 { label: '<i data-lucide="bar-chart-2" style="width:14px;height:14px"></i> KPIs', idx: 24 },
 { label: '<i data-lucide="shield" style="width:14px;height:14px"></i> Assurance', idx: 2 },
 { label: '<i data-lucide="cloud" style="width:14px;height:14px"></i> Synchro', idx: 12 },
 ];
 acts.innerHTML = quickTopics.map(t => 
 `<button class="support-btn" onclick="askByIndex(${t.idx})">${t.label}</button>`
 ).join('');
 body.appendChild(acts);
 body.scrollTop = body.scrollHeight;
 if (window.lucide) {
 setTimeout(() => lucide.createIcons(), 50);
 }
}

window.askByIndex = function(idx) {
 const entry = FAQ_DATABASE[idx];
 if (!entry) return;
 askQuestion(entry.question, entry);
};

// ═══════════════════════════════════════════════════════════════════
// CONVERSATION NATURELLE — Réponses sans API IA
// ═══════════════════════════════════════════════════════════════════
const CONVERSATIONS = [
 {
 triggers: ['bonjour', 'bonsoir', 'salut', 'hello', 'hi', 'hey', 'coucou', 'yo'],
 responses: [
"Bonjour {name}. Comment puis-je vous assister dans l'utilisation d'OrdiveX aujourd'hui ?",
"Ravi de vous retrouver, {name}. Que puis-je analyser ou expliquer pour vous ?",
"Bonjour {name}. Je suis Naomie. Indiquez-moi le module ou l'action pour lequel vous avez besoin d'aide.",
 ]
 },
 {
 triggers: ['merci', 'remercie', 'thanks', 'thank', 'top', 'parfait', 'genial', 'super', 'excellent', 'bravo', 'nickel'],
 responses: [
"Avec plaisir, {name}! N'hésitez pas si vous avez d'autres questions!",
"Je suis ravie d'avoir pu vous aider, {name}! À votre service!",
"De rien! C'est mon rôle de vous accompagner, {name}! 🌟 Autre chose ?",
 ]
 },
 {
 triggers: ['au revoir', 'bye', 'a bientot', 'a plus', 'bonne journee', 'bonne soiree', 'adieu'],
 responses: [
"À bientôt {name}! Bonne continuation et n'hésitez pas à revenir!",
"Au revoir {name}! Passez une excellente journée! À très vite!",
"À la prochaine {name}! Je suis toujours là si besoin!",
 ]
 },
 {
 triggers: ['ca va', 'comment vas', 'comment tu vas', 'comment ca', 'la forme', 'quoi de neuf', 'comment allez'],
 responses: [
"Je vais très bien, merci {name}! Et vous ? Prêt(e) à conquérir la journée ? Dites-moi comment je peux vous aider!",
"Toujours au top, {name}! Je suis disponible 24h/24 pour vous. Que puis-je faire ?",
"Je suis en pleine forme! 🌟 Merci de demander, {name}. Comment puis-je vous assister aujourd'hui ?",
 ]
 },
 {
 triggers: ['qui es tu', 'c est quoi', 'tu es qui', 'ton nom', 'tu fais quoi', 'tu sers a quoi', 'quel est ton role'],
 responses: [
"Je suis <strong>Naomie</strong>, votre assistante virtuelle OrdiveX! <br><br>Je suis conçue par l'entreprise technologique <strong>TrillionX</strong> pour vous guider dans l'utilisation complète de l'application : ventes, stocks, patients, fournisseurs, analyses financières...<br><br>Je connais <strong>plus de 25 sujets</strong> à fond! Posez-moi n'importe quelle question, et si je ne sais pas répondre, je vous oriente vers le support humain via WhatsApp.",
 ]
 },
 {
 triggers: ['createur', 'trillionx', 'qui t a cree', 'qui t as cree', 'developpeur', 'entreprise', 'societe', 'qui a developpe'],
 responses: [
"J'ai été conçue et développée par <strong>TrillionX</strong>! <br><br>TrillionX est une entreprise technologique innovante spécialisée dans le développement de solutions logicielles de pointe, comme le puissant ERP <strong>OrdiveX</strong>.<br><br>Leur mission : moderniser et sécuriser la gestion des pharmacies en Afrique avec des outils hors-ligne, rapides et ultra-sécurisés! ️"
 ]
 },
 {
 triggers: ['fonctionnalite', 'ce que tu peux faire', 'tes capacites', 'ce que l appli peut faire', 'avantage', 'pourquoi OrdiveX', 'pourquoi choisir', 'que faire'],
 responses: [
"<strong>OrdiveX</strong> est le logiciel de gestion de pharmacie le plus complet et adapté à notre marché! <br><br>Voici ses super-pouvoirs :<br><i data-lucide='shopping-cart' style='width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;color:#1B6FAE'></i> <strong>Point de Vente (POS)</strong> ultra-rapide avec scan code-barres<br><i data-lucide='box' style='width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;color:#1B6FAE'></i> <strong>Stock intelligent (FEFO)</strong> qui gère automatiquement les péremptions<br><i data-lucide='smartphone' style='width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;color:#1B6FAE'></i> <strong>Paiements locaux</strong> : Support natif de Orange Money & MTN MoMo<br><i data-lucide='wifi-off' style='width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;color:#1B6FAE'></i> <strong>100% Hors-ligne</strong> : Fonctionne parfaitement même sans connexion internet!<br><i data-lucide='cloud-lightning' style='width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;color:#1B6FAE'></i> <strong>Cloud Sync</strong> : Synchronisation des données entre plusieurs appareils<br><i data-lucide='pills' style='width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;color:#1B6FAE'></i> <strong>Vente au détail</strong> : Gestion fluide des boîtes, plaquettes et unités<br><i data-lucide='shield-alert' style='width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px;color:#e74c3c'></i> <strong>Sécurité Patient</strong> : Alertes sur 30+ interactions médicamenteuses et allergies!<br><br>Et moi, Naomie, je suis là pour vous former sur tout ça!"
 ]
 },
 {
 triggers: ['aide', 'help', 'besoin d aide', 'aider', 'comment faire', 'je ne sais pas', 'je comprends pas'],
 responses: [
"Bien sûr {name}, je suis là pour ça! <br><br>Dites-moi ce que vous cherchez à faire, ou cliquez sur l'un des sujets ci-dessous pour obtenir une réponse détaillée :",
 ]
 },
 {
 triggers: ['oui', 'ok', 'daccord', 'd accord', 'entendu', 'compris', 'je vois', 'ah ok', 'bien'],
 responses: [
"Parfait {name}! 👍 Autre chose que je peux faire pour vous ?",
"Super! N'hésitez pas si une autre question vous vient à l'esprit!",
 ]
 },
 {
 triggers: ['non', 'pas besoin', 'rien', 'c est bon', 'c est tout', 'rien d autre'],
 responses: [
"D'accord {name}! Je reste ici si jamais vous avez besoin. Bonne continuation!",
"Très bien! N'hésitez pas à revenir quand vous voulez, {name}. Je suis toujours disponible! 🌟",
 ]
 },
 {
 triggers: ['blague', 'rire', 'drole', 'humour', 'joke', 'raconte moi', 'amuse moi', 'ennui', 'je m ennuie'],
 responses: [
" Pourquoi le pharmacien est-il toujours calme ? Parce qu'il a toujours la bonne <strong>dose</strong> de patience! <br><br>Bon, trêve de plaisanterie, {name}, je suis prête à travailler!",
" Un patient demande au pharmacien : « Avez-vous quelque chose contre le stress ? » — « Oui, ma démission! » <br><br>Allez {name}, je suis là pour vous faciliter la vie!",
" Quelle est la différence entre un pharmacien et un magicien ? Le pharmacien fait disparaître votre argent, le magicien fait disparaître un lapin! <br><br>Plus sérieusement, {name}, comment puis-je vous aider ?",
 ]
 },
 {
 triggers: ['prix', 'combien coute', 'tarif', 'cout', 'abonnement', 'gratuit', 'licence', 'payer'],
 responses: [
"OrdiveX fonctionne sur modèle <strong>SaaS</strong> (Software as a Service). 💼<br><br>Pour les détails de tarification et les plans disponibles, contactez directement l'équipe <strong>TrillionX</strong> via WhatsApp ci-dessous. Ils vous feront une offre adaptée à votre pharmacie! 📞",
 ]
 },
 {
 triggers: ['probleme', 'bug', 'erreur', 'marche pas', 'fonctionne pas', 'plante', 'crash', 'bloque', 'lent'],
 responses: [
"Oh non, {name}! Essayons de résoudre ça ensemble :<br><br> <strong>Étape 1</strong> : Rafraîchissez la page (Ctrl+Shift+R)<br> <strong>Étape 2</strong> : Si c'est sur mobile, fermez et rouvrez l'app<br> <strong>Étape 3</strong> : Allez dans Paramètres > Sauvegarde pour vérifier vos données<br><br>Si le problème persiste, contactez le <strong>support TrillionX</strong> via WhatsApp avec une capture d'écran de l'erreur. ️",
 ]
 },
 {
 triggers: ['heure', 'quelle heure', 'date', 'quel jour', 'aujourd hui'],
 responses: [
"Il est <strong>{time}</strong>, {name}! <br>Nous sommes le <strong>{date}</strong>.<br><br>Bonne continuation dans votre journée de travail!",
 ]
 },
 {
 triggers: ['tu es belle', 'je t aime', 'jolie', 'mignonne', 'intelligente', 'geniale', 'formidable'],
 responses: [
"Oh merci {name}, vous êtes trop gentil(le)! Je suis juste un programme, mais ça me fait quand même plaisir! Allez, revenons au travail — comment puis-je vous aider ?",
"Aww, {name}! C'est adorable! Mais ma vraie beauté, c'est mes <strong>25+ sujets de connaissance</strong> sur la gestion de pharmacie! Posez-moi une question, vous allez voir!",
 ]
 },
 {
 triggers: ['motivation', 'courage', 'fatigue', 'stress', 'dur', 'difficile', 'epuise'],
 responses: [
"Courage {name}! 🌟<br><br>Rappelez-vous : chaque ordonnance que vous servez, chaque patient que vous conseillez, <strong>vous changez des vies</strong>. Le métier de pharmacien est noble et essentiel.<br><br>Prenez une pause si nécessaire, et je serai là quand vous reviendrez!",
"Hey {name}, chaque grande pharmacie a été construite jour après jour! ️<br><br>Vous faites un travail remarquable. Et avec OrdiveX, tout est automatisé pour vous libérer du temps. Utilisez-le pour vous reposer!",
 ]
 },
 {
 triggers: ['conseil', 'astuce', 'tips', 'recommandation', 'suggestion', 'ameliorer'],
 responses: [
"Voici mes <strong>top astuces</strong> pour optimiser votre pharmacie, {name}! <br><br>1️⃣ <strong>Scannez les codes-barres</strong> au POS — c'est 3x plus rapide<br>2️⃣ <strong>Configurez les alertes de stock</strong> pour ne jamais être en rupture<br>3️⃣ <strong>Utilisez les statistiques</strong> (Pilotage) pour identifier vos best-sellers<br>4️⃣ <strong>Faites un PULL cloud</strong> chaque semaine pour sécuriser vos données<br>5️⃣ <strong>Créez des fiches patients</strong> — les allergies sauvent des vies!",
 ]
 },
 {
 triggers: ['concurrent', 'meditect', 'comparaison', 'autre logiciel', 'alternative', 'mieux'],
 responses: [
"OrdiveX se distingue sur plusieurs points clés, {name}! <br><br> <strong>Offline-first</strong> — Fonctionne sans internet (essentiel en Afrique)<br> <strong>FEFO automatique</strong> — Gestion des lots et péremptions en temps réel<br> <strong>Multi-appareils</strong> — Synchronisation cloud entre PC et mobile<br> <strong>Interactions médicamenteuses</strong> — 30+ alertes critiques intégrées<br> <strong>Mobile Money</strong> — Orange Money, MTN MoMo natifs<br><br>Peu de solutions offrent tout ça sur le marché africain!",
 ]
 },
 {
 triggers: ['je suis ou', 'ou suis je', 'quelle page', 'ou je suis', 'page actuelle', 'je me trouve', 'c est quoi cette page'],
 dynamic: true,
 getResponse: function() {
 const page = (window.Router && window.Router.currentPage) ? window.Router.currentPage : 'dashboard';
 const pageNames = {
 'pos': '<i data-lucide="shopping-cart" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Point de Vente (POS)',
 'products': '<i data-lucide="pill" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Catalogue Produits',
 'stock': '<i data-lucide="box" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Gestion des Stocks',
 'patients': '<i data-lucide="users" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Dossiers Patients',
 'suppliers': '<i data-lucide="truck" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Fournisseurs & Achats',
 'purchase-orders': '<i data-lucide="clipboard-list" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Bons de Commande',
 'sales': '<i data-lucide="history" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Historique des Ventes',
 'dashboard': '<i data-lucide="layout-dashboard" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Tableau de Bord',
 'metrics': '<i data-lucide="bar-chart-3" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Pilotage & Analyses',
 'caisse': '<i data-lucide="calculator" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Caisse',
 'alerts': '<i data-lucide="bell" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Centre d\'Alertes',
 'reorder': '<i data-lucide="shopping-bag" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Réapprovisionnement',
 'prescriptions': '<i data-lucide="file-text" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Ordonnances',
 'settings': '<i data-lucide="settings" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Paramètres',
 'print': '<i data-lucide="printer" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Centre d\'Impression',
 'returns': '<i data-lucide="rotate-ccw" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Retours',
 'traceability': '<i data-lucide="search" style="width:16px;height:16px;vertical-align:-3px;margin-right:4px;"></i> Traçabilité',
 };
 const pageName = pageNames[page] || ' Tableau de Bord';
 return `Vous êtes actuellement sur la page <strong>${pageName}</strong>, {name}! <br><br>Besoin d'aide pour utiliser cette section ? Demandez-moi! `;
 }
 },
 {
 triggers: ['combien de produit', 'combien de medicament', 'nombre de produit', 'combien j ai', 'nombre de patient', 'combien de patient'],
 dynamic: true,
 getResponse: async function() {
 try {
 const products = await DB.dbGetAll('products');
 const patients = await DB.dbGetAll('patients');
 const stock = await DB.dbGetAll('stock');
 const totalStock = stock.reduce((s, e) => s + (e.quantity || 0), 0);
 return `Voici vos chiffres actuels, {name}! <br><br> <strong>${products.length.toLocaleString()}</strong> produits dans le catalogue<br> <strong>${patients.length.toLocaleString()}</strong> patients enregistrés<br> <strong>${totalStock.toLocaleString()}</strong> unités en stock<br><br>Besoin d'autres informations ? `;
 } catch(e) { return"Je n'ai pas pu accéder aux données pour l'instant, {name}. Réessayez dans quelques instants!"; }
 }
 },
 {
 triggers: ['raccourci', 'touche', 'clavier', 'shortcut', 'rapide'],
 responses: [
"Voici les <strong>raccourcis clavier</strong> du POS, {name}! ️<br><br> <strong>F2</strong> — Focus sur la barre de recherche<br> <strong>F4</strong> — Valider la vente<br>️ <strong>F8</strong> — Vider le panier<br> <strong>F9</strong> — Scanner un code-barres<br><br>Ces raccourcis fonctionnent uniquement sur la page Point de Vente!",
 ]
 },
 {
 triggers: ['version', 'mise a jour', 'update', 'changelog', 'nouveaute'],
 responses: [
"Vous utilisez <strong>OrdiveX v9.4</strong>, {name}! <br><br>Dernières améliorations :<br> Gestion Pro des Factures (PDF, CSV, Traçabilité)<br> Multi-onglets POS (ventes parallèles)<br> Vue 360° Patient et Employé<br> Double traçabilité Vendeur/Caissier<br> Dashboard Inventaire avec KPIs financiers<br> 55+ catégories dynamiques avec saisie libre<br> Moi-même : Naomie v4 avec requêtes live! <br><br>Les mises à jour sont automatiques via GitHub Pages!",
 ]
 },
 // ── Nouvelles conversations v9.2.1 (Bonnes pratiques guide) ──
 {
 triggers: ['tiers payant', 'ticket moderateur', 'part patient', 'part entreprise', 'couverture assurance'],
 responses: [
"Le <strong>tiers-payant</strong> fonctionne ainsi, {name}! <br><br>Au <strong>POS</strong>, sélectionnez le paiement « <strong>Assurance</strong> » :<br>1️⃣ Saisissez l'organisme (ex: CNSS, ASCOMA)<br>2️⃣ Entrez le numéro de <strong>prise en charge</strong><br>3️⃣ Indiquez le <strong>taux de couverture</strong><br><br>Le système sépare automatiquement :<br>• Le <strong>ticket modérateur</strong> (part patient) → encaissé immédiatement<br>• La <strong>créance assurance</strong> (part entreprise) → en attente de règlement<br><br>Tout est tracé dans l'historique des ventes!",
 ]
 },
 {
  triggers: ['import', 'csv', 'excel', 'importer', 'catalogue en masse', 'bulk', 'fichier'],
  responses: [
  "L'<strong>import CSV</strong> est ultra-puissant, {name}! <br><br> <strong>Import de Catalogue :</strong> Allez dans Catalogue Produits > « Importer CSV » pour ajouter des milliers de références.<br> <strong>Import de Facture :</strong> Dans Factures Professionnelles, cliquez sur « Importer Facture (CSV) » pour créer un brouillon depuis un Excel fournisseur.<br><br> OrdiveX va matcher automatiquement les noms de produits avec votre base de données!",
  ]
  },
  {
  triggers: ['facture', 'facturation', 'bon de livraison', 'facture pro', 'entree stock facture'],
  responses: [
  "La gestion des <strong>Factures Professionnelles</strong> est complète, {name}! <br><br>1️⃣ <strong>Saisie Intelligente</strong> : À la saisie manuelle d'une entrée stock, entrez un N° de facture et je la crée automatiquement.<br>2️⃣ <strong>Import CSV</strong> : Vous pouvez importer le fichier Excel de votre grossiste.<br>3️⃣ <strong>Traçabilité</strong> : L'onglet « Tracer Facture » montre tous les lots liés et leur stock restant.<br>4️⃣ <strong>PDF Premium</strong> : Imprimez un magnifique récapitulatif pour votre comptabilité!",
  ]
  },
 {
 triggers: ['cloture', 'cloturer', 'fermer la caisse', 'fin de journee', 'fermeture caisse'],
 responses: [
"Pour <strong>clôturer la caisse</strong>, {name}! <br><br>1️⃣ Allez dans <strong>Caisse Journalière</strong><br>2️⃣ Vérifiez le total des encaissements par mode de paiement<br>3️⃣ Cliquez <strong>« Clôturer la Caisse »</strong><br>4️⃣ Entrez le <strong>montant physique compté</strong><br>5️⃣ Le système calcule l'<strong>écart de caisse</strong> automatiquement<br><br> Vous pouvez ensuite imprimer le <strong>Rapport de Caisse</strong> depuis le Centre d'Impression! ️",
 ]
 },
 {
 triggers: ['destruction', 'detruire', 'pv destruction', 'lot perime', 'eliminer', 'incineration'],
 responses: [
"La <strong>destruction de médicaments périmés</strong> suit un protocole strict, {name}! ️<br><br>1️⃣ Allez dans <strong>Traçabilité & Pharmacovigilance</strong><br>2️⃣ Sélectionnez le lot à détruire<br>3️⃣ Renseignez le <strong>motif</strong>, la <strong>méthode</strong> (incinération, broyage...) et les <strong>témoins</strong><br>4️⃣ Validez — un <strong>PV de destruction</strong> est généré automatiquement<br><br>Le PV est conforme aux exigences de l'<strong>Inspection Pharmaceutique DNPM</strong> et peut être imprimé! 📄",
 ]
 },
 {
 triggers: ['import', 'csv', 'excel', 'importer', 'catalogue en masse', 'bulk', 'fichier'],
 responses: [
"L'<strong>import massif CSV</strong> est ultra-puissant, {name}! <br><br>1️⃣ Allez dans <strong>Catalogue Produits</strong><br>2️⃣ Cliquez <strong>« Importer CSV »</strong><br>3️⃣ Sélectionnez votre fichier (colonnes : name, dci, brand, form, buyPrice, sellPrice, minStock...)<br>4️⃣ OrdiveX traite les produits par <strong>lots de 100</strong> pour éviter tout blocage<br><br> Supporte jusqu'à <strong>50 000+ produits</strong> en une seule importation!<br> Un rapport d'import détaillé s'affiche à la fin.",
 ]
 },
 {
 triggers: ['scan', 'scanner', 'code barre', 'barcode', 'camera', 'lecteur'],
 responses: [
"Le <strong>scan de code-barres</strong> fonctionne de 2 façons, {name}! <br><br> <strong>Sur PC</strong> :<br>• Branchez un lecteur USB — il tape le code directement<br>• Ou appuyez sur <strong>F9</strong> au POS pour activer la caméra<br><br> <strong>Sur mobile</strong> :<br>• Cliquez l'icône dans la barre de recherche du POS<br>• La <strong>caméra arrière</strong> s'active automatiquement<br>• Pointez le code-barres — le produit s'ajoute au panier instantanément!<br><br>Assurez-vous que vos produits ont un <strong>code-barres renseigné</strong> dans le Catalogue. 🏷️",
 ]
 },
 {
 triggers: ['hors ligne', 'offline', 'sans internet', 'pas de connexion', 'deconnecte', 'wi-fi', 'wifi'],
 responses: [
"OrdiveX est conçu <strong>Offline-First</strong>, {name}! <br><br> <strong>TOUT fonctionne sans internet</strong> :<br>• Ventes au POS <br>• Gestion des stocks <br>• Ordonnances et patients <br>• Impressions et rapports <br>• Alertes et traçabilité <br><br> Internet n'est utilisé QUE pour la <strong>synchronisation cloud</strong> entre plusieurs appareils.<br><br>Vos données sont stockées localement dans <strong>IndexedDB</strong> — elles ne disparaissent jamais même si vous fermez l'app!",
 ]
 },
 {
 triggers: ['export', 'telecharger', 'download', 'exporter', 'comptabilite', 'rapport csv'],
 responses: [
"Plusieurs options d'<strong>export</strong> sont disponibles, {name}! <br><br> <strong>Historique des Ventes</strong> → Export CSV avec tous les détails<br> <strong>Ordonnances</strong> → Export CSV pour archivage<br>️ <strong>Centre d'Impression</strong> → Rapports imprimables (stock, caisse, PV)<br> <strong>Paramètres > Sauvegarde</strong> → Export JSON complet de toute la base<br><br>Les exports CSV sont compatibles avec <strong>Excel</strong> et tout logiciel comptable!",
 ]
 },
 {
 triggers: ['naomie', 'assistante', 'chatbot', 'ia', 'intelligence artificielle', 'tu peux m aider'],
 responses: [
"Je suis <strong>Naomie v4</strong>, votre assistante IA pharmaceutique, {name}! <br><br>Je maîtrise <strong>30+ sujets</strong> et j'interroge <strong>vos données en temps réel</strong> :<br> Ventes, crédits, assurances<br> Stocks, inventaires, commandes<br> Ordonnances, interactions, allergies<br> KPIs, analyses, statistiques<br>️ Impressions, PV, rapports<br>️ Paramètres, utilisateurs, sync cloud<br><br>Essayez : <strong>« CA du jour »</strong>, <strong>« combien de produits »</strong> ou <strong>« ruptures »</strong> pour voir mes capacités live!",
 ]
 },
 // ═══════════════════════════════════════════════════════════════
 // NAOMIE v4 — REQUÊTES DYNAMIQUES LIVE (IndexedDB)
 // ═══════════════════════════════════════════════════════════════
 {
 triggers: ['ca du jour', 'chiffre du jour', 'vente du jour', 'combien vendu', 'recette du jour', 'total vente'],
 dynamic: true,
 responses: [],
 getResponse: async function() {
 const sales = await DB.dbGetAll('sales');
 const today = new Date().toISOString().substring(0, 10);
 const todaySales = sales.filter(s => s.date && s.date.substring(0, 10) === today);
 const totalCA = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
 return ` <strong>Bilan du jour</strong> (${new Date().toLocaleDateString('fr-FR')}) :<br><br>` +
 ` <strong>CA Total</strong> : ${UI.formatCurrency(totalCA)}<br>` +
 ` <strong>Nombre de ventes</strong> : ${todaySales.length}<br>` +
 ` <strong>Panier moyen</strong> : ${todaySales.length > 0 ? UI.formatCurrency(Math.round(totalCA / todaySales.length)) : '—'}<br><br>` +
 `Ces données sont extraites <strong>en direct</strong> de votre base locale! 🔥`;
 }
 },
 {
 triggers: ['combien de produit', 'nombre de produit', 'total produit', 'catalogue', 'combien de reference'],
 dynamic: true,
 responses: [],
 getResponse: async function() {
 const products = await DB.dbGetAll('products');
 const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
 return ` Votre catalogue contient <strong>${products.length.toLocaleString()} produits</strong> répartis dans <strong>${cats.length} catégories</strong>.<br><br>` +
 `Top catégories : ${cats.slice(0, 5).map(c => `<strong>${c}</strong>`).join(', ')}${cats.length > 5 ? '...' : ''}<br><br>` +
 `Allez dans le <strong>Catalogue Produits</strong> pour les gérer! `;
 }
 },
 {
 triggers: ['rupture', 'en rupture', 'stock zero', 'produit manquant', 'epuise'],
 dynamic: true,
 responses: [],
 getResponse: async function() {
 const [products, stock] = await Promise.all([DB.dbGetAll('products'), DB.dbGetAll('stock')]);
 const stockMap = {};
 stock.forEach(s => { stockMap[s.productId] = s.quantity || 0; });
 const rupt = products.filter(p => (stockMap[p.id] || 0) <= 0);
 if (rupt.length === 0) return ' <strong>Excellente nouvelle</strong> : Aucun produit en rupture de stock! Votre inventaire est complet. ';
 const top5 = rupt.slice(0, 5).map(p => `• ${p.name}`).join('<br>');
 return `️ <strong>${rupt.length} produit(s) en rupture</strong> :<br><br>${top5}${rupt.length > 5 ? `<br>... et ${rupt.length - 5} autres` : ''}<br><br>` +
 `Consultez les <strong>Alertes</strong> ou le <strong>Stock</strong> pour agir rapidement! `;
 }
 },
 {
 triggers: ['credit en cours', 'dette totale', 'combien de credit', 'impaye total', 'encours credit'],
 dynamic: true,
 responses: [],
 getResponse: async function() {
 const sales = await DB.dbGetAll('sales');
 const credits = sales.filter(s => s.paymentMethod === 'credit' && s.status === 'pending');
 const totalDebt = credits.reduce((sum, s) => sum + (s.total || 0), 0);
 return ` <strong>Crédits en cours</strong> :<br><br>` +
 ` <strong>${credits.length}</strong> vente(s) à crédit non réglée(s)<br>` +
 ` <strong>Encours total</strong> : ${UI.formatCurrency(totalDebt)}<br><br>` +
 `Allez dans l'<strong>Historique des Ventes</strong> pour encaisser les dettes. 💵`;
 }
 },
 {
 triggers: ['multi onglet', 'onglet', 'plusieurs ventes', 'vente parallele', 'tab', 'session'],
 responses: [
"Les <strong>multi-onglets POS</strong> sont une nouveauté de la v9.4! <br><br>" +
"En haut du panneau panier, vous voyez une <strong>barre bleue</strong> avec vos onglets de vente :<br>" +
"• Cliquez <strong>+</strong> pour ouvrir un nouvel onglet<br>" +
"• Basculez entre onglets en un clic<br>" +
"• Le panier, le patient et l'ordonnance sont <strong>sauvegardés par onglet</strong><br>" +
"• Fermez un onglet avec le bouton ×<br><br>" +
"Parfait pour gérer plusieurs clients en même temps à la caisse!"
 ]
 },
 {
 triggers: ['verrouillage', 'verrou', 'lock', 'pin', 'inactivite', 'securite caisse', 'ecran verrouille'],
 responses: [
"🔐 <strong>Verrouillage automatique</strong> (v9.4) :<br><br>" +
"Après <strong>5 minutes d'inactivité</strong>, l'écran se verrouille automatiquement pour protéger vos données financières.<br><br>" +
"Pour déverrouiller :<br>" +
"• Saisissez votre <strong>mot de passe</strong><br>" +
"• Ou cliquez « Changer d'utilisateur » pour revenir à l'écran de connexion<br><br>" +
"Le verrouillage s'active dès qu'il n'y a plus d'activité (souris, clavier, écran tactile). C'est une mesure de sécurité essentielle en officine!"
 ]
 },
 {
 triggers: ['__deprecated_old_bilan_trigger__'],
 dynamic: true,
 responses: [],
 getResponse: async function() {
 try {
 const [products, patients, stock, sales, settings] = await Promise.all([
 DB.dbGetAll('products'),
 DB.dbGetAll('patients'),
 DB.dbGetAll('stock'),
 DB.dbGetAll('sales'),
 DB.dbGetAll('settings'),
 ]);
 const stockMap = {};
 stock.forEach(s => { stockMap[s.productId] = s.quantity || 0; });
 const totalUnits = stock.reduce((s, e) => s + (e.quantity || 0), 0);
 let valAchat = 0, valVente = 0, ruptures = 0;
 products.forEach(p => {
 const qty = stockMap[p.id] || 0;
 valAchat += (parseFloat(p.purchasePrice || 0)) * qty;
 valVente += (parseFloat(p.salePrice || 0)) * qty;
 if (qty <= 0) ruptures++;
 });
 const today = new Date().toISOString().substring(0, 10);
 const todaySales = sales.filter(s => s.date && s.date.substring(0, 10) === today);
 const todayCA = todaySales.reduce((a, s) => a + (s.total || 0), 0);
 const totalCA = sales.filter(s => ['completed','paid'].includes(s.status)).reduce((a, s) => a + (s.total || 0), 0);
 const credits = sales.filter(s => s.paymentMethod === 'credit' && s.status === 'pending');
 const totalDebt = credits.reduce((a, s) => a + (s.total || 0), 0);
 const pName = settings.find(s => s.key === 'pharmacy_name')?.value || 'Votre pharmacie';

 return `<strong>Synthese ${pName}</strong> <br><br>` +
 ` <strong>${products.length.toLocaleString()}</strong> medicaments au catalogue<br>` +
 ` <strong>${patients.length.toLocaleString()}</strong> patients enregistres<br>` +
 ` <strong>${totalUnits.toLocaleString()}</strong> unites en stock<br>` +
 ` Valeur stock (achat) : <strong>${UI.formatCurrency(valAchat)}</strong><br>` +
 `💵 Valeur stock (vente) : <strong>${UI.formatCurrency(valVente)}</strong><br>` +
 `${ruptures > 0 ? '' : ''} <strong>${ruptures}</strong> produit(s) en rupture<br><br>` +
 ` <strong>Aujourd'hui</strong> :<br>` +
 ` ${todaySales.length} vente(s) — CA : <strong>${UI.formatCurrency(todayCA)}</strong><br>` +
 ` CA cumule total : <strong>${UI.formatCurrency(totalCA)}</strong><br>` +
 `${credits.length > 0 ? ' ' + credits.length + ' credit(s) en cours : <strong>' + UI.formatCurrency(totalDebt) + '</strong><br>' : ''}` +
 `<br>Donnees extraites <strong>en direct</strong> de votre base! 🔥`;
 } catch(e) { return"Erreur lors de la lecture des donnees. Reessayez!"; }
 }
 },
];



function matchConversation(input) {
 const q = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['']/g, ' ');
 let bestMatch = null;
 let bestScore = 0;

 for (const conv of CONVERSATIONS) {
  for (const trigger of conv.triggers) {
   const trigNorm = trigger.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
   if (q.includes(trigNorm)) {
    // Plus le trigger est long, plus il est spécifique — il gagne sur les triggers génériques
    const score = trigNorm.length;
    if (score > bestScore) {
     bestScore = score;
     bestMatch = conv;
    }
   }
  }
 }

 if (!bestMatch) return null;
 if (bestMatch.dynamic && bestMatch.getResponse) {
  return { dynamic: true, getResponse: bestMatch.getResponse };
 }
 return { dynamic: false, text: bestMatch.responses[Math.floor(Math.random() * bestMatch.responses.length)] };
}

window.submitFreeQuestion = function() {
 const input = document.getElementById('support-free-input');
 if (!input ||!input.value.trim()) return;
 const rawText = input.value.trim();
 input.value = '';

 // Sanitize user input to prevent XSS (security rule: never innerHTML with user content)
 const safeText = rawText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

 const body = document.getElementById('support-chat-body');
 if (!body) return;
 const oldActs = body.querySelectorAll('.support-actions');
 oldActs.forEach(e => e.remove());
 body.innerHTML += `<div class="chat-bubble chat-user">${safeText}</div>`;
 body.scrollTop = body.scrollHeight;

 // 1. Chercher d'abord dans la conversation naturelle (Intents précis et CFO)
 const convReply = matchConversation(rawText);

 // 2. Si aucune intention précise, chercher dans la FAQ
 const matchFAQResult = matchFAQ(rawText);

 if (!convReply && matchFAQResult) {
 askQuestion(safeText, matchFAQResult);
 return;
 }
 const typingId = 'typing-' + Date.now();

 setTimeout(() => {
 body.innerHTML += `<div id="${typingId}" class="chat-bubble chat-bot"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
 body.scrollTop = body.scrollHeight;
 const delay = 600 + Math.random() * 500;
 setTimeout(() => {
 const t = document.getElementById(typingId);
 if(t) t.remove();
 const name = getUserName().split(' ')[0];

 if (convReply) {
 // Variables dynamiques communes
 const now = new Date();
 const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
 const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

 const applyVars = (str) => str.replace(/\{name\}/g, name).replace(/\{time\}/g, timeStr).replace(/\{date\}/g, dateStr);

 if (convReply.dynamic && convReply.getResponse) {
 // Réponse dynamique (peut être async)
 Promise.resolve(convReply.getResponse()).then(dynText => {
 const reply = applyVars(dynText);
 body.innerHTML += `<div class="chat-bubble chat-bot">${reply}</div>`;
 setTimeout(() => showQuickOptions(), 400);
 body.scrollTop = body.scrollHeight;
 });
 } else {
 // Réponse statique
 const reply = applyVars(convReply.text);
 body.innerHTML += `<div class="chat-bubble chat-bot">${reply}</div>`;
 setTimeout(() => showQuickOptions(), 400);
 }
 } else {
 // Aucun match — réponse intelligente contextuelle ultra-pro
 const page = (window.Router && window.Router.currentPage) ? window.Router.currentPage : 'dashboard';
 const pageHints = {
 'pos': 'Je vois que vous êtes au <strong>Point de Vente</strong>. Essayez des mots-clés comme : <strong>vente</strong>, <strong>crédit</strong>, <strong>assurance</strong>, <strong>scan</strong>, <strong>déconditionnement</strong>, <strong>ordonnance</strong>',
 'products': 'Vous êtes dans le <strong>Catalogue Produits</strong>. Essayez : <strong>ajouter</strong>, <strong>import CSV</strong>, <strong>déconditionnement</strong>, <strong>notice</strong>, <strong>DCI</strong>',
 'stock': 'Vous êtes dans la <strong>Gestion des Stocks</strong>. Essayez : <strong>inventaire</strong>, <strong>mouvement</strong>, <strong>FEFO</strong>, <strong>rupture</strong>, <strong>lot</strong>',
 'patients': 'Vous êtes dans les <strong>Dossiers Patients</strong>. Essayez : <strong>allergie</strong>, <strong>fiche patient</strong>, <strong>historique</strong>',
 'suppliers': 'Vous êtes dans <strong>Fournisseurs</strong>. Essayez : <strong>commande</strong>, <strong>réception</strong>, <strong>score</strong>, <strong>bon de commande</strong>',
 'sales': 'Vous êtes dans l\'<strong>Historique des Ventes</strong>. Essayez : <strong>dette</strong>, <strong>retour</strong>, <strong>facture</strong>, <strong>export</strong>',
 'prescriptions': 'Vous êtes dans les <strong>Ordonnances</strong>. Essayez : <strong>ordonnance</strong>, <strong>interaction</strong>, <strong>dispenser</strong>, <strong>patient</strong>',
 'dashboard': 'Vous êtes sur le <strong>Tableau de Bord</strong>. Essayez : <strong>statistique</strong>, <strong>KPI</strong>, <strong>chiffre d\'affaires</strong>, <strong>marge</strong>',
 'metrics': 'Vous êtes dans <strong>Pilotage & Analyses</strong>. Essayez : <strong>KPI</strong>, <strong>rotation</strong>, <strong>bénéfice</strong>, <strong>panier moyen</strong>',
 'caisse': 'Vous êtes à la <strong>Caisse</strong>. Essayez : <strong>clôture</strong>, <strong>encaissement</strong>, <strong>espèce</strong>, <strong>Orange Money</strong>',
 'settings': 'Vous êtes dans les <strong>Paramètres</strong>. Essayez : <strong>sauvegarde</strong>, <strong>synchronisation</strong>, <strong>utilisateur</strong>, <strong>devise</strong>',
 'traceability': 'Vous êtes dans <strong>Traçabilité</strong>. Essayez : <strong>destruction</strong>, <strong>audit</strong>, <strong>pharmacovigilance</strong>, <strong>PV</strong>',
 'alerts': 'Vous êtes dans le <strong>Centre d\'Alertes</strong>. Essayez : <strong>rupture</strong>, <strong>péremption</strong>, <strong>stock bas</strong>',
 'print': 'Vous êtes dans le <strong>Centre d\'Impression</strong>. Essayez : <strong>imprimer</strong>, <strong>inventaire</strong>, <strong>rapport</strong>, <strong>ticket</strong>',
 'returns': 'Vous êtes dans les <strong>Retours</strong>. Essayez : <strong>retour</strong>, <strong>remboursement</strong>, <strong>échange</strong>',
 };
 const hint = pageHints[page] || 'Essayez des mots-clés comme : <strong>vente</strong>, <strong>stock</strong>, <strong>commande</strong>, <strong>ordonnance</strong>, <strong>patient</strong>';
 body.innerHTML += `<div class="chat-bubble chat-bot">Je n'ai pas trouvé de correspondance exacte pour"<strong>${safeText}</strong>", ${name}. 🤔<br><br>${hint}<br><br> <strong>Astuce</strong> : J'utilise la reconnaissance de mots-clés. Plus votre question contient un terme métier précis, plus ma réponse sera pertinente!<br><br>Si votre question est très spécifique, contactez le <strong>support TrillionX</strong> via WhatsApp ci-dessous. 👇</div>`;
 setTimeout(() => showQuickOptions(), 400);
 }
 body.scrollTop = body.scrollHeight;
 }, delay);
 }, 300);
};

function askQuestion(text, faqEntry) {
 const body = document.getElementById('support-chat-body');
 if (!body) return;

 const oldActs = body.querySelectorAll('.support-actions');
 oldActs.forEach(e => e.remove());

 body.innerHTML += `<div class="chat-bubble chat-user">${text}</div>`;
 body.scrollTop = body.scrollHeight;

 const typingId = 'typing-' + Date.now();
 setTimeout(() => {
 body.innerHTML += `<div id="${typingId}" class="chat-bubble chat-bot"><div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
 body.scrollTop = body.scrollHeight;
 
 // Délai réaliste variant entre 800ms et 1500ms
 const delay = 800 + Math.random() * 700;
 setTimeout(() => {
 const t = document.getElementById(typingId);
 if(t) t.remove();

 const greeting = getGreeting();
 // Convertir le markdown simple en HTML
 const htmlAnswer = faqEntry.answer
 .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
 .replace(/\n/g, '<br>');

 body.innerHTML += `<div class="chat-bubble chat-bot">${greeting}<br><br>${htmlAnswer}</div>`;
 
 setTimeout(() => {
 showQuickOptions();
 }, 500);
 
 body.scrollTop = body.scrollHeight;
 }, delay);

 }, 300);
}

window.askQuestion = askQuestion;

// Exposer les fonctions globales
window.initSupportWidget = initSupportWidget;
window.hideSupportWidget = hideSupportWidget;
window.CONVERSATIONS = CONVERSATIONS;

// ═══════════════════════════════════════════════════════════════════
// AMÉLIORATION 2 — CONSEILLER SUPPLY CHAIN INTÉGRÉ DANS NAOMIE
// Moteur de recommandation transparent, explicatif et non-bloquant.
// Calcule : vélocité, couverture stock, ruptures, produits dormants,
// valeur stock, recommandation commande chiffrée et justifiée.
// ═══════════════════════════════════════════════════════════════════

/**
 * Moteur d'analyse Supply Chain
 * Calcule toutes les métriques financières et logistiques nécessaires
 * pour conseiller le pharmacien sur sa prochaine commande fournisseur.
 */
async function _analyzeSupplyChain() {
  const [products, stockAll, lots, salesRaw, movements, purchaseOrders, saleItems] = await Promise.all([
    DB.dbGetAll('products'),
    DB.dbGetAll('stock'),
    DB.dbGetAll('lots').catch(() => []),
    DB.dbGetAll('sales'),
    DB.dbGetAll('movements').catch(() => []),
    DB.dbGetAll('purchaseOrders').catch(() => []),
    DB.dbGetAll('saleItems').catch(() => []),
  ]);

  const sales = salesRaw.filter(s => ['completed', 'paid', 'credit'].includes(s.status));

  const now = Date.now();
  const MS_1D  = 86400000;
  const MS_7D  = 7  * MS_1D;
  const MS_30D = 30 * MS_1D;
  const MS_60D = 60 * MS_1D;

  const since7  = now - MS_7D;
  const since30 = now - MS_30D;
  const since60 = now - MS_60D;
  
  // ── Index stock ──
  const stockMap = {};
  stockAll.forEach(s => { stockMap[s.productId] = (stockMap[s.productId] || 0) + (s.quantity || 0); });

  // ── CA par periode ──
  const sales7     = sales.filter(s => new Date(s.createdAt || s.date || 0).getTime() >= since7);
  const sales30    = sales.filter(s => new Date(s.createdAt || s.date || 0).getTime() >= since30);
  const sales30_60 = sales.filter(s => { const t = new Date(s.createdAt || s.date || 0).getTime(); return t >= since60 && t < since30; });

  const ca7     = sales7.reduce((a, s) => a + (s.total || 0), 0);
  const ca30    = sales30.reduce((a, s) => a + (s.total || 0), 0);
  const caPrev30 = sales30_60.reduce((a, s) => a + (s.total || 0), 0);

  const evolutionMoM = caPrev30 > 0 ? ((ca30 - caPrev30) / caPrev30 * 100) : null;

  // ── Fiabilite des couts ──
  const saleIds30 = new Set(sales30.map(s => s.id));
  const items30 = saleItems.filter(si => saleIds30.has(si.saleId));
  
  let validCogsItems = 0;
  let totalCogsItems = 0;
  let cogs30 = 0;
  items30.forEach(si => {
    totalCogsItems++;
    if (si.purchasePrice > 0) {
      validCogsItems++;
      cogs30 += (si.purchasePrice * (si.qty || si.quantity || 0));
    }
  });

  // Si moins de 80% des ventes ont un prix d'achat, on considere que la marge est incalculable
  const isDataReliable = (totalCogsItems === 0) || (validCogsItems / totalCogsItems) >= 0.8;

  const grossProfit30 = isDataReliable ? ca30 - cogs30 : null;
  const marginPct = (isDataReliable && ca30 > 0) ? (grossProfit30 / ca30 * 100) : null;

  // ── Valeur du stock ──
  let totalStockValue = 0;
  products.forEach(p => {
    const qty = stockMap[p.id] || 0;
    totalStockValue += qty * (p.purchasePrice || 0);
  });

  // ── Rotation du stock ──
  const stockRotation = (isDataReliable && totalStockValue > 0) ? (cogs30 * 12 / totalStockValue) : null; 

  // ── Ventes par produit ──
  const salesMap30 = {};
  const salesMap7 = {};
  items30.forEach(item => {
    const pid = item.productId;
    if (!pid) return;
    const qty = item.qty || item.quantity || 0;
    salesMap30[pid] = (salesMap30[pid] || 0) + qty;
    
    // sale item date isn't directly available without joining sale, but we can do a quick check via sale
    const sale = sales30.find(s => s.id === item.saleId);
    if(sale && new Date(sale.createdAt || sale.date || 0).getTime() >= since7) {
      salesMap7[pid] = (salesMap7[pid] || 0) + qty;
    }
  });

  const COUVERTURE_CIBLE = 30; // 30 jours
  const LEAD_TIME = 3; // 3 jours par defaut

  let healthScore = 100;
  let doNotRestockIds = new Set();
  
  let budgetPrudent = 0;
  let budgetReco = 0;
  let budgetMax = 0;
  
  let highPriority = [];
  let mediumPriority = [];
  let lowPriority = [];
  let doNotRestock = [];
  
  let productStats = [];
  
  // Indices Sante
  let nbRuptures = 0, nbSurstocks = 0, nbDormants = 0, nbPerimes = 0;

  products.forEach(p => {
    const qty = stockMap[p.id] || 0;
    const vente30 = salesMap30[p.id] || 0;
    const vmr = vente30 / 30; // Vitesse moyenne de rotation (jours)
    const joursStock = vmr > 0 ? qty / vmr : 999;
    
    const profit = (p.salePrice || 0) - (p.purchasePrice || 0);
    const totalProfit = profit * vente30;
    
    productStats.push({ id: p.id, name: p.name, qty, vente30, vmr, joursStock, profit, totalProfit, pp: p.purchasePrice || 0 });

    // Analyse Sante Stock
    if (qty === 0 && vente30 > 0) {
      nbRuptures++;
      healthScore -= 2;
    }
    if (joursStock > 90 && qty > 0 && vente30 > 0) {
      nbSurstocks++;
      healthScore -= 0.5;
    }
    if (qty > 0 && vente30 === 0) {
      nbDormants++;
      healthScore -= 0.5;
      doNotRestockIds.add(p.id);
      doNotRestock.push({ name: p.name, reason: 'Produit dormant (0 vente/30j)' });
    }
    
    // Peremptions (approximation simple car on n'a pas forcement iteré les lots, mais on enlevera qq points si le lot est proche)
  });
  
  // Analyse Lots pour peremption
  lots.forEach(l => {
    if(l.quantity > 0 && l.expiryDate) {
      const exp = new Date(l.expiryDate).getTime();
      if(exp < now + MS_30D) {
        nbPerimes++;
        healthScore -= 1;
        doNotRestockIds.add(l.productId);
      }
    }
  });

  healthScore = Math.max(0, healthScore);

  // Categorisation & Budget
  productStats.forEach(p => {
    if (doNotRestockIds.has(p.id)) return;
    
    // Besoin = (VMR * Couverture) + (VMR * LeadTime) - Stock Actuel
    const besoinStrict = Math.max(0, (p.vmr * LEAD_TIME) - p.qty); // Juste pour survivre
    const besoinOptimal = Math.max(0, (p.vmr * COUVERTURE_CIBLE) - p.qty);
    const besoinMax = Math.max(0, (p.vmr * (COUVERTURE_CIBLE + 15)) - p.qty); // 45 jours
    
    const pp = p.pp || 0;

    if (p.qty === 0 && p.vente30 > 0) {
      highPriority.push({ name: p.name, type: 'Rupture', qty: 0, vmr: p.vmr, reco: Math.ceil(besoinOptimal) });
      budgetPrudent += Math.ceil(besoinOptimal * 0.5) * pp;
      budgetReco += Math.ceil(besoinOptimal) * pp;
      budgetMax += Math.ceil(besoinMax) * pp;
    } else if (p.qty > 0 && p.joursStock <= LEAD_TIME + 2) {
      highPriority.push({ name: p.name, type: 'Stock critique', qty: p.qty, vmr: p.vmr, reco: Math.ceil(besoinOptimal) });
      budgetPrudent += Math.ceil(besoinOptimal * 0.5) * pp;
      budgetReco += Math.ceil(besoinOptimal) * pp;
      budgetMax += Math.ceil(besoinMax) * pp;
    } else if (p.joursStock <= COUVERTURE_CIBLE) {
      mediumPriority.push({ name: p.name, type: 'Renouvellement normal', qty: p.qty, vmr: p.vmr, reco: Math.ceil(besoinOptimal) });
      budgetReco += Math.ceil(besoinOptimal) * pp;
      budgetMax += Math.ceil(besoinMax) * pp;
    } else if (p.joursStock <= COUVERTURE_CIBLE + 30) {
      lowPriority.push({ name: p.name, type: 'Stock confortable', qty: p.qty, vmr: p.vmr, reco: 0 });
      budgetMax += Math.ceil(besoinOptimal) * pp; // Seulement si max
    }
  });

  // Tris Top 10
  const topVentes = [...productStats].sort((a,b) => b.vente30 - a.vente30).slice(0, 10);
  const topRentabilite = [...productStats].sort((a,b) => b.totalProfit - a.totalProfit).slice(0, 10);
  const trendingUp = [...productStats].map(p => {
    const v7 = salesMap7[p.id] || 0;
    const prev7 = (p.vente30 - v7)/3.28; 
    const trend = prev7 > 0 ? (v7 - prev7)/prev7 : 0;
    return { ...p, trend, v7 };
  }).filter(p => p.trend > 0.1).sort((a,b) => b.trend - a.trend).slice(0,10);
  
  const trendingDown = [...productStats].map(p => {
    const v7 = salesMap7[p.id] || 0;
    const prev7 = (p.vente30 - v7)/3.28; 
    const trend = prev7 > 0 ? (v7 - prev7)/prev7 : 0;
    return { ...p, trend, v7 };
  }).filter(p => p.trend < -0.1).sort((a,b) => a.trend - b.trend).slice(0,10);

  // Alertes
  const alerts = [];
  if (nbRuptures > 0) alerts.push({ level: 'critique', text: `${nbRuptures} produits sont actuellement en rupture.` });
  if (healthScore < 70) alerts.push({ level: 'attention', text: `Santé globale du stock faible (${healthScore}/100).` });
  if (nbSurstocks > 20) alerts.push({ level: 'attention', text: `${nbSurstocks} produits en surstock (immobilisation inutile).` });
  if (marginPct && marginPct < 20) alerts.push({ level: 'critique', text: `Marge brute très faible (${marginPct.toFixed(1)}%). Verifiez vos prix.` });
  if (!isDataReliable) alerts.push({ level: 'info', text: `Marge et Rotation masquées : Prix d'achat manquants.` });

  return {
    isDataReliable,
    ca30, evolutionMoM, marginPct, stockRotation,
    healthScore, nbRuptures, nbSurstocks, nbDormants,
    budgetPrudent, budgetReco, budgetMax,
    highPriority: highPriority.sort((a,b)=>b.vmr - a.vmr).slice(0,10),
    mediumPriority: mediumPriority.sort((a,b)=>b.vmr - a.vmr).slice(0,10),
    doNotRestock: doNotRestock.slice(0,10),
    topVentes, topRentabilite, trendingUp, trendingDown,
    alerts,
    nbVentes30: sales30.length
  };
}

function _fmtGNF(n) {
  if (n == null || isNaN(n)) return "0 GNF";
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " GNF";
}

CONVERSATIONS.push({
  triggers: [
    'commande fournisseur', 'combien commander', 'conseil commande', 'reapprovisionner',
    'recommandation achat', 'conseil achat', 'budget commande', 'que commander',
    'rupture a venir', 'stock optimal', 'analyser mon stock', 'analyse supply',
    'gestionnaire achats', 'conseiller achat', 'plan de commande', 'bilan stock',
    'analyse financiere', 'rapport financier', 'analyse complete', 'bilan complet',
    'tresorerie', 'marge', 'rotation', 'prevision', 'forecast',
    'etat', 'resume', 'bilan', 'info pharmacie', 'donnees pharmacie', 'tout savoir', 
    'situation', 'recap', 'synthese', 'chiffre d affaires', 'ca',
  ],
  dynamic: true,
  getResponse: async function() {
    try {
      const d = await _analyzeSupplyChain();
      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

      // Sante
      let healthText = "Critique";
      let healthColor = "#dc2626";
      if (d.healthScore >= 80) { healthText = "Bon"; healthColor = "#16a34a"; }
      else if (d.healthScore >= 60) { healthText = "Passable"; healthColor = "#d97706"; }
      
      const healthReason = d.healthScore >= 80 ? "Votre stock est globalement équilibré. Une bonne rotation limite l'immobilisation de trésorerie." 
        : d.healthScore >= 60 ? "Quelques déséquilibres constatés (surstocks ou dormants) nécessitent votre attention." 
        : "Nombreuses anomalies : risques de ruptures ou fort capital immobilisé.";

      // Synthèse Exécutive
      const dataRelMsg = d.isDataReliable ? "" : " Les données de coûts d'achat étant incomplètes, les marges ne sont pas affichées.";
      const recoMsg = d.highPriority.length > 0 ? `Des réapprovisionnements urgents sont recommandés pour ${d.highPriority.length} produits prioritaires.` : "Aucun réapprovisionnement urgent n'est nécessaire à ce jour.";
      const execSummary = `Au cours des 30 derniers jours, la pharmacie a réalisé un chiffre d'affaires de ${_fmtGNF(d.ca30)} réparti sur ${d.nbVentes30} ventes. ${recoMsg} L'indice de santé du stock est évalué à ${d.healthScore}/100.${dataRelMsg}`;

      // Alertes HTML
      const alertsHtml = d.alerts.map(a => {
        const bg = a.level === 'critique' ? '#fef2f2' : a.level === 'attention' ? '#fff7ed' : '#f0f9ff';
        const cl = a.level === 'critique' ? '#dc2626' : a.level === 'attention' ? '#ea580c' : '#0284c7';
        return `<div style="background:${bg};color:${cl};border-left:3px solid ${cl};padding:6px 10px;margin-bottom:6px;font-size:11px;border-radius:4px">
          <strong>${a.level.toUpperCase()} :</strong> ${a.text}
        </div>`;
      }).join('');

      // Priorites HTML
      const highHtml = d.highPriority.map(p => `<div style="font-size:11px;padding:4px 0;border-bottom:1px solid #eee">🔴 <strong>${p.name}</strong> - ${p.type} (Recommandé: ${p.reco} u.)</div>`).join('');
      const medHtml = d.mediumPriority.map(p => `<div style="font-size:11px;padding:4px 0;border-bottom:1px solid #eee">🟠 <strong>${p.name}</strong> - ${p.type} (Recommandé: ${p.reco} u.)</div>`).join('');
      const doNotHtml = d.doNotRestock.map(p => `<div style="font-size:11px;padding:4px 0;border-bottom:1px solid #eee">⛔ <strong>${p.name}</strong> - ${p.reason}</div>`).join('');

      // Top 10 HTML
      const topVentesHtml = d.topVentes.slice(0,5).map((p,i) => `<div style="font-size:11px">${i+1}. ${p.name} (${p.vente30} u.)</div>`).join('');
      const topMargeHtml = d.isDataReliable ? d.topRentabilite.slice(0,5).map((p,i) => `<div style="font-size:11px">${i+1}. ${p.name} (${_fmtGNF(p.totalProfit)})</div>`).join('') : '<div style="font-size:11px;color:#999">Données insuffisantes</div>';

      return `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
          <div style="font-weight:800;font-size:14px;margin-bottom:10px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:6px">
            📊 Rapport Supply Chain & Finances
            <div style="font-weight:normal;font-size:10px;color:#64748b">${dateStr}</div>
          </div>

          <!-- Synthèse -->
          <div style="font-size:11.5px;color:#334155;line-height:1.5;margin-bottom:12px;background:#f8fafc;padding:10px;border-radius:8px">
            ${execSummary}
          </div>

          <!-- Alertes -->
          ${alertsHtml ? `<div style="margin-bottom:12px">${alertsHtml}</div>` : ''}

          <!-- Santé du Stock -->
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:12px;display:flex;align-items:center;gap:12px">
            <div style="background:${healthColor};color:#fff;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px">
              ${Math.round(d.healthScore)}
            </div>
            <div>
              <div style="font-size:12px;font-weight:bold;color:#1e293b">Indice de Santé : ${healthText}</div>
              <div style="font-size:10.5px;color:#64748b">${healthReason}</div>
            </div>
          </div>

          <!-- KPIs -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <div style="background:#f0fdf4;padding:8px;border-radius:6px;border:1px solid #bbf7d0">
              <div style="font-size:10px;color:#166534;font-weight:bold">MARGE BRUTE (30j)</div>
              <div style="font-size:13px;font-weight:bold;color:#14532d">${d.isDataReliable ? d.marginPct.toFixed(1) + '%' : 'N/A'}</div>
            </div>
            <div style="background:#eff6ff;padding:8px;border-radius:6px;border:1px solid #bfdbfe">
              <div style="font-size:10px;color:#1d4ed8;font-weight:bold">ROTATION STOCK</div>
              <div style="font-size:13px;font-weight:bold;color:#1e3a8a">${d.isDataReliable ? d.stockRotation.toFixed(1) + 'x/an' : 'N/A'}</div>
            </div>
          </div>

          <!-- Budgets Fournisseurs -->
          <div style="background:#f1f5f9;border-radius:8px;padding:10px;margin-bottom:12px">
            <div style="font-size:11px;font-weight:bold;color:#475569;margin-bottom:8px;text-transform:uppercase">💰 Recommandation Budgétaire</div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px">
                <span style="color:#64748b">Prudent (Ruptures strictes) :</span>
                <strong style="color:#0f172a">${_fmtGNF(d.budgetPrudent)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;background:#e0e7ff;padding:4px 6px;border-radius:4px">
                <span style="color:#4338ca;font-weight:bold">Recommandé (30 jours) :</span>
                <strong style="color:#3730a3">${_fmtGNF(d.budgetReco)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px">
                <span style="color:#64748b">Maximal (Stock Optimal) :</span>
                <strong style="color:#0f172a">${_fmtGNF(d.budgetMax)}</strong>
              </div>
            </div>
          </div>

          <!-- Priorités -->
          <div style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:bold;color:#475569;margin-bottom:4px;text-transform:uppercase">⚠️ Priorité Élevée</div>
            ${highHtml || '<div style="font-size:11px;color:#999;font-style:italic">Aucun produit</div>'}
          </div>
          
          <div style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:bold;color:#475569;margin-bottom:4px;text-transform:uppercase">📉 Ne pas réapprovisionner</div>
            ${doNotHtml || '<div style="font-size:11px;color:#999;font-style:italic">Aucun produit dormant détecté</div>'}
          </div>

          <!-- Opportunités -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <div style="font-size:11px;font-weight:bold;color:#475569;margin-bottom:4px">🔝 Top 5 Ventes</div>
              ${topVentesHtml}
            </div>
            <div>
              <div style="font-size:11px;font-weight:bold;color:#475569;margin-bottom:4px">💎 Top 5 Rentabilité</div>
              ${topMargeHtml}
            </div>
          </div>

          <div style="font-size:9.5px;color:#94a3b8;margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:6px;text-align:center">
            Les conseils sont générés par intelligence artificielle selon les données disponibles. Vérifiez avant de commander.
          </div>
        </div>
      `;
    } catch(e) {
      console.error(e);
      return 'Je n\'ai pas pu générer l\'analyse financière en raison de données insuffisantes ou corrompues.';
    }
  }
});
const _origShowQuickOptions = showQuickOptions;
function showQuickOptions() {
  const body = document.getElementById('support-chat-body');
  if (!body) return;
  const acts = document.createElement('div');
  acts.className = 'support-actions';
  const quickTopics = [
    { label: '<i data-lucide="compass" style="width:14px;height:14px"></i> Navigation', idx: 18 },
    { label: '<i data-lucide="credit-card" style="width:14px;height:14px"></i> Crédits', idx: 0 },
    { label: '<i data-lucide="truck" style="width:14px;height:14px"></i> Commandes', idx: 6 },
    { label: '<i data-lucide="package" style="width:14px;height:14px"></i> Stocks', idx: 5 },
    { label: '<i data-lucide="printer" style="width:14px;height:14px"></i> Impression', idx: 22 },
    { label: '<i data-lucide="bar-chart-2" style="width:14px;height:14px"></i> KPIs', idx: 24 },
    { label: '<i data-lucide="shield" style="width:14px;height:14px"></i> Assurance', idx: 2 },
    { label: '<i data-lucide="cloud" style="width:14px;height:14px"></i> Synchro', idx: 12 },
  ];
  acts.innerHTML = quickTopics.map(t =>
    `<button class="support-btn" onclick="askByIndex(${t.idx})">${t.label}</button>`
  ).join('') +
  `<button class="support-btn" onclick="window.submitFreeQuestion && document.getElementById('support-free-input') && (document.getElementById('support-free-input').value = 'conseil commande fournisseur', submitFreeQuestion())" style="background:linear-gradient(135deg,#0f4c81,#1a7bc4);color:#fff;border:none;font-weight:700;display:flex;align-items:center;gap:6px;justify-content:center">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>
    Conseil Commande IA
  </button>`;
  body.appendChild(acts);
  body.scrollTop = body.scrollHeight;
  if (window.lucide) {
    setTimeout(() => lucide.createIcons(), 50);
  }
}
window.showQuickOptions = showQuickOptions;
