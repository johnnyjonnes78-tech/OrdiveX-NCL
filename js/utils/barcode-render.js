/**
 * OrdiveX - Generation de codes-barres Code 128 (Jeu B) v1.0
 * Encode localement, sans librairie externe ni appel reseau - fonctionne
 * hors-ligne comme le reste de l'app. Utilise pour imprimer des etiquettes
 * produit (code-barres relisable par le scan existant : il encode le meme
 * champ "code" que celui deja compare lors d'un scan).
 */

const BarcodeRender = {
  // Jeu B Code 128 : index 0-94 = caracteres ASCII 32-126, 96 = carre A,
  // 98 = carre C, 99 = FNC1..4/SHIFT (non utilises ici), START_B = 104,
  // STOP = 106. On encode uniquement les caracteres imprimables usuels
  // (lettres, chiffres, ponctuation courante) presents sur les codes
  // produit/EAN/CIP reels.
  _CHARSET_B: " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~",

  // Table des 107 motifs (valeurs 0 a 106), chacun = 6 largeurs successives
  // (barre,espace,barre,espace,barre,espace), en unites de module. Issue de
  // la specification Code 128 standard (ISO/IEC 15417).
  _PATTERNS: [
    '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
    '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
    '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
    '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
    '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
    '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
    '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
    '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
    '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
    '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
    '114131','311141','411131','211412','211214','211232','2331112'
  ],
  _START_B: 104,
  _STOP: 106,

  /**
   * Nettoie une chaine quelconque (code produit/EAN/CIP) pour n'y garder que
   * les caracteres encodables en Code 128 Jeu B. Les caracteres non supportes
   * (rare : accents...) sont simplement retires plutot que de faire echouer
   * tout l'etiquetage.
   */
  sanitize: function(text) {
    const charset = this._CHARSET_B;
    return String(text || '').split('').filter(function(ch) { return charset.indexOf(ch) !== -1; }).join('');
  },

  /**
   * Encode une chaine en une suite de valeurs symboliques Code 128
   * (start + donnees + checksum + stop). Fonction pure, sans DOM.
   * @returns {number[]|null} null si la chaine est vide apres nettoyage.
   */
  encode: function(text) {
    const clean = this.sanitize(text);
    if (!clean.length) return null;

    const charset = this._CHARSET_B;
    const values = clean.split('').map(function(ch) { return charset.indexOf(ch); });

    const symbols = [this._START_B].concat(values);

    // Checksum Code 128 : somme ponderee mod 103. START porte un poids de 1 ;
    // le premier caractere de donnees porte un poids de 2, le second 3, etc.
    // (le poids demarre a 2 pour les donnees, pas a 1 - erreur frequente).
    let sum = this._START_B;
    for (let i = 0; i < values.length; i++) {
      sum += values[i] * (i + 2);
    }
    const checksum = sum % 103;

    symbols.push(checksum);
    symbols.push(this._STOP);
    return symbols;
  },

  /**
   * Convertit une chaine en une liste alternee de largeurs de barres/espaces
   * (en unites de module), prete a etre dessinee. Commence toujours par une
   * barre. Fonction pure, testable sans DOM.
   * @returns {{widths: number[], totalModules: number}|null}
   */
  toBarWidths: function(text) {
    const symbols = this.encode(text);
    if (!symbols) return null;

    const widths = [];
    symbols.forEach(function(sym) {
      const pattern = BarcodeRender._PATTERNS[sym];
      pattern.split('').forEach(function(digit) { widths.push(parseInt(digit, 10)); });
    });

    const totalModules = widths.reduce(function(a, b) { return a + b; }, 0);
    return { widths: widths, totalModules: totalModules };
  },

  /**
   * Construit un SVG autonome (chaine de markup) representant le code-barres,
   * pret a etre insere dans une page d'impression.
   * @param {string} text
   * @param {Object} opts { moduleWidthPx, heightPx, showText }
   */
  toSvg: function(text, opts) {
    opts = opts || {};
    const moduleWidthPx = opts.moduleWidthPx || 2;
    const heightPx = opts.heightPx || 50;
    const showText = opts.showText !== false;

    const result = this.toBarWidths(text);
    if (!result) return '<svg></svg>';

    const totalWidthPx = result.totalModules * moduleWidthPx;
    const svgHeight = heightPx + (showText ? 14 : 0);

    let x = 0;
    let bar = true; // Code 128 commence toujours par une barre (noire)
    const rects = [];
    result.widths.forEach(function(moduleCount) {
      const widthPx = moduleCount * moduleWidthPx;
      if (bar) {
        rects.push('<rect x="' + x.toFixed(2) + '" y="0" width="' + widthPx.toFixed(2) + '" height="' + heightPx + '" fill="#000"/>');
      }
      x += widthPx;
      bar = !bar;
    });

    const textEl = showText
      ? '<text x="' + (totalWidthPx / 2).toFixed(2) + '" y="' + (heightPx + 11) + '" text-anchor="middle" font-size="10" font-family="monospace">' + this.sanitize(text) + '</text>'
      : '';

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalWidthPx.toFixed(2) + ' ' + svgHeight + '" width="' + totalWidthPx.toFixed(2) + '" height="' + svgHeight + '">' + rects.join('') + textEl + '</svg>';
  }
};

window.BarcodeRender = BarcodeRender;
