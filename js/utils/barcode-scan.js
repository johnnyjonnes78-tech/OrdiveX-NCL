/**
 * OrdiveX - Moteur de Scan Code-Barres / QR v1.0
 * Centralise 2 methodes de scan independantes du materiel :
 *  - scanWithCamera() : scan camera (BarcodeDetector), avec detection des
 *    navigateurs non supportes (Safari/Firefox) et un timeout de securite.
 *  - watchKeyboardWedge() : detection d un scanner physique USB/Bluetooth
 *    qui "tape" le code comme un clavier (douchette), quelle que soit la marque.
 */

const BarcodeScan = {

  hasBarcodeDetectorAPI: function() {
    return (typeof window !== 'undefined') && ('BarcodeDetector' in window);
  },

  hasCameraAPI: function() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  },

  /**
   * Scan via camera. Gere elle-meme le flux video, le timeout et l absence
   * de support navigateur (ne reste jamais bloque en silence).
   * @param {HTMLVideoElement} videoEl
   * @param {Object} opts
   *   formats: string[] (par defaut ean_13, ean_8, code_128, qr_code)
   *   intervalMs: nombre ms entre 2 tentatives de detection (defaut 400)
   *   timeoutMs: duree max avant abandon automatique (defaut 20000)
   *   onDetect: function(code, format)
   *   onError: function(reason) - reason: 'unsupported' | 'no-camera' | 'timeout' | 'camera-error'
   * @returns {{ stop: function }}
   */
  scanWithCamera: function(videoEl, opts) {
    opts = opts || {};
    var formats = opts.formats || ['ean_13', 'ean_8', 'code_128', 'qr_code'];
    var intervalMs = opts.intervalMs || 400;
    var timeoutMs = opts.timeoutMs || 20000;
    var onDetect = opts.onDetect || function() {};
    var onError = opts.onError || function() {};

    var stream = null;
    var detectTimer = null;
    var timeoutTimer = null;
    var stopped = false;

    function stop() {
      if (stopped) return;
      stopped = true;
      if (detectTimer) { clearInterval(detectTimer); detectTimer = null; }
      if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
      if (stream) {
        stream.getTracks().forEach(function(track) { track.stop(); });
        stream = null;
      }
    }

    if (!BarcodeScan.hasBarcodeDetectorAPI()) {
      onError('unsupported');
      return { stop: stop };
    }

    if (!BarcodeScan.hasCameraAPI()) {
      onError('no-camera');
      return { stop: stop };
    }

    var detector;
    try {
      detector = new window.BarcodeDetector({ formats: formats });
    } catch (e) {
      onError('unsupported');
      return { stop: stop };
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then(function(mediaStream) {
        if (stopped) {
          mediaStream.getTracks().forEach(function(t) { t.stop(); });
          return;
        }
        stream = mediaStream;
        videoEl.srcObject = mediaStream;
        videoEl.play().catch(function() {});

        timeoutTimer = setTimeout(function() {
          stop();
          onError('timeout');
        }, timeoutMs);

        detectTimer = setInterval(function() {
          if (stopped) return;
          detector.detect(videoEl).then(function(codes) {
            if (stopped) return;
            if (codes && codes.length > 0) {
              var result = codes[0];
              stop();
              onDetect(result.rawValue, result.format);
            }
          }).catch(function() {});
        }, intervalMs);
      })
      .catch(function() {
        stop();
        onError('camera-error');
      });

    return { stop: stop };
  },

  /**
   * Detecte une "douchette" clavier (USB ou Bluetooth, toute marque) : elle
   * tape le code scanne comme une rafale de frappes bien plus rapide qu une
   * saisie humaine, suivie de la touche Entree.
   * @param {Object} opts
   *   target: EventTarget a ecouter (defaut document)
   *   minLength: longueur min du code pour etre considere comme un scan (defaut 4)
   *   maxIntervalMs: intervalle max moyen entre frappes pour etre un scan (defaut 30)
   *   resetTimeoutMs: au-dela de ce delai entre 2 frappes, on recommence une sequence (defaut 500)
   *   ignoreEditable: si true (defaut), ignore les frappes dans un champ de saisie ou l on tape normalement
   *   preventDefaultOnScan: si true (defaut), bloque la propagation de la touche Entree
   *     UNIQUEMENT quand une rafale est reconnue comme un scan (evite qu un gestionnaire
   *     existant sur le champ focus - recherche, formulaire... - traite aussi cet Entree).
   *     Une frappe humaine normale n est jamais affectee.
   *   onScan: function(code)
   * @returns {{ stop: function }}
   */
  watchKeyboardWedge: function(opts) {
    opts = opts || {};
    var target = opts.target || document;
    var minLength = opts.minLength || 4;
    var maxIntervalMs = opts.maxIntervalMs || 30;
    var resetTimeoutMs = opts.resetTimeoutMs || 500;
    var ignoreEditable = opts.ignoreEditable !== false;
    var preventDefaultOnScan = opts.preventDefaultOnScan !== false;
    var onScan = opts.onScan || function() {};

    var buffer = '';
    var intervals = [];
    var lastTime = 0;

    function reset() {
      buffer = '';
      intervals = [];
      lastTime = 0;
    }

    function isEditableTarget(el) {
      if (!el) return false;
      var tag = el.tagName ? el.tagName.toUpperCase() : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function onKeyDown(e) {
      if (ignoreEditable && isEditableTarget(e.target)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) { reset(); return; }

      var now = performance.now();

      if (buffer.length > 0 && (now - lastTime) > resetTimeoutMs) {
        reset();
      }

      if (e.key === 'Enter') {
        var isFastEnough = intervals.length > 0 &&
          (intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length) <= maxIntervalMs;

        if (buffer.length >= minLength && isFastEnough) {
          var code = buffer;
          reset();
          if (preventDefaultOnScan) {
            e.preventDefault();
            e.stopPropagation();
          }
          onScan(code);
        } else {
          reset();
        }
        return;
      }

      if (e.key && e.key.length === 1) {
        if (buffer.length > 0) {
          intervals.push(now - lastTime);
        }
        buffer += e.key;
        lastTime = now;
      }
    }

    target.addEventListener('keydown', onKeyDown, true);

    return {
      stop: function() {
        target.removeEventListener('keydown', onKeyDown, true);
        reset();
      }
    };
  }
};

window.BarcodeScan = BarcodeScan;
