/**
 * OrdiveX - Utilitaire d'Export PDF Professionnel
 * Utilise jsPDF et jspdf-autotable pour des rendus optimisés (haute performance, pagination automatique)
 */

const PDFExport = {
  /**
   * Génère un fichier PDF paginé et formaté
   * @param {string} title Titre du document (ex: "Inventaire des Produits")
   * @param {Array} headers Tableau d'en-têtes (ex: ["Code", "Nom", "Prix"])
   * @param {Array<Array>} data Tableau de données correspondant aux en-têtes
   * @param {Object} options { orientation: 'p'|'l', summaryBlocks: [] }
   */
  async generate(title, headers, data, options = {}) {
    if (window.UI && window.UI.showLoader) window.UI.showLoader('Génération du PDF en cours...');
    await new Promise(r => setTimeout(r, 150));
    if (!window.jspdf || !window.jspdf.jsPDF) {
      if (window.UI) UI.toast("L'outil d'export PDF n'a pas pu être chargé", "error");
      return;
    }

    const { jsPDF } = window.jspdf;
    const settings = await DB.dbGetAll('settings') || [];
    const getSetting = (k) => { const s = settings.find(x => x.key === k); return s ? s.value : ''; };
    const defaultOrientation = getSetting('print_format_a4') || 'portrait';
    
    const doc = new jsPDF(options.orientation || defaultOrientation, 'mm', 'a4');
    
    const pharmacyName = getSetting('pharmacy_name') || 'OrdiveX Pharmacie';
    const pharmacyAddress = getSetting('pharmacy_address') || '';
    const pharmacyPhone = getSetting('pharmacy_phone') || '';
    const logoDataUrl = getSetting('pharmacy_logo');

    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = today.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const currentUser = AppState?.currentUser?.name || AppState?.currentUser?.username || 'Utilisateur';

    // ==========================================
    // 1. DESSINER L'EN-TÊTE SUR CHAQUE PAGE
    // ==========================================
    const drawHeader = (data) => {
      // Uniquement sur la première page ? Non, sur toutes les pages pour les PDF pros
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(27, 79, 114); // Bleu Primaire OrdiveX
      
      let textStartX = 14;
      let startY = 15;
      
      if (logoDataUrl && logoDataUrl.startsWith('data:image')) {
        try {
          doc.addImage(logoDataUrl, 'PNG', 14, 10, 20, 20);
          textStartX = 38;
        } catch(e) { }
      }
      
      doc.text(pharmacyName, textStartX, startY);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      if (pharmacyAddress) {
        startY += 5;
        doc.text(pharmacyAddress, textStartX, startY);
      }
      if (pharmacyPhone) {
        startY += 5;
        doc.text("Tél : " + pharmacyPhone, textStartX, startY);
      }
      
      // Ligne de séparation
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 32, pageWidth - 14, 32);

      // Titre du document (Centré)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(title.toUpperCase(), pageWidth / 2, 40, { align: 'center' });
      
      // Infos génériques à droite
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Imprimé le : ${dateStr} à ${timeStr}`, pageWidth - 14, 15, { align: 'right' });
      doc.text(`Par : ${currentUser}`, pageWidth - 14, 19, { align: 'right' });
    };

    // ==========================================
    // 2. DESSINER LE PIED DE PAGE SUR CHAQUE PAGE
    // ==========================================
    const drawFooter = (data) => {
      const str = 'Page ' + doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(str, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text("Généré par OrdiveX ERP", 14, pageHeight - 10);
    };

    // ==========================================
    // 3. GÉNÉRATION DU TABLEAU (AutoTable)
    // ==========================================
    let startYTable = 46;
    if (options.subHeader && options.subHeader.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      options.subHeader.forEach(line => {
        doc.text(line, 14, startYTable);
        startYTable += 6;
      });
      startYTable += 4;
    }

    doc.autoTable({
      head: [headers],
      body: data,
      startY: startYTable,
      margin: { top: 46, bottom: 20 },
      styles: {
        fontSize: 8,
        font: 'helvetica',
        cellPadding: 3,
        textColor: 40,
        lineColor: [220, 220, 220],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [27, 79, 114], // Bleu OrdiveX
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didDrawPage: function (data) {
        drawHeader(data);
        drawFooter(data);
      }
    });

    // ==========================================
    // 4. INJECTER LES BLOCS DE STATISTIQUES
    // ==========================================
    if (options.summaryBlocks && options.summaryBlocks.length > 0) {
      let finalY = doc.lastAutoTable.finalY + 15;
      
      // Vérifier s'il y a assez de place, sinon nouvelle page
      if (finalY + 40 > pageHeight - 20) {
        doc.addPage();
        finalY = 46;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(27, 79, 114);
      doc.text("RÉSUMÉ ET STATISTIQUES", 14, finalY);
      
      doc.setDrawColor(27, 79, 114);
      doc.line(14, finalY + 2, 70, finalY + 2);
      
      finalY += 8;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);

      const lineSpacing = 6;
      options.summaryBlocks.forEach(block => {
        if (finalY > pageHeight - 20) {
          doc.addPage();
          finalY = 46;
        }
        doc.setFont('helvetica', 'bold');
        doc.text(`${block.label} :`, 14, finalY);
        doc.setFont('helvetica', 'normal');
        doc.text(`${block.value}`, 80, finalY);
        finalY += lineSpacing;
      });
    }

    // ==========================================
    // 5. SAUVEGARDE ET TÉLÉCHARGEMENT
    // ==========================================
    const safeTitle = title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const filename = `${safeTitle}_${dateStr.replace(/\//g, '-')}.pdf`;
    
    doc.save(filename);
    
    if (window.UI && window.UI.hideLoader) window.UI.hideLoader();
    if (window.UI) UI.toast("Le PDF a été généré avec succès", "success");
    
    // Log audit
    DB.writeAudit('EXPORT_PDF', 'system', null, { title: title, rows: data.length });
  }
};

window.PDFExport = PDFExport;
