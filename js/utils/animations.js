/**
 * OrdiveX — Animations Utilitaires v9.4
 * Count-up KPIs (global) + Charts reveal CSS (lent et fluide)
 */

// ═══════════════════════════════════════════════════════════════════
// 1. COUNT-UP POUR KPIs
// ═══════════════════════════════════════════════════════════════════

function animateValue(element, start, end, duration, prefix, suffix) {
  if (!element) return;
  duration = duration || 800;
  prefix = prefix || '';
  suffix = suffix || '';
  if (isNaN(end) || end === null || end === undefined) {
    element.textContent = prefix + '0' + suffix;
    return;
  }
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
    element.textContent = prefix + Math.floor(end).toLocaleString('fr-FR') + suffix;
    return;
  }
  var range = end - start;
  if (range === 0) {
    element.textContent = prefix + Math.floor(end).toLocaleString('fr-FR') + suffix;
    return;
  }
  var startTime = performance.now();
  function step(currentTime) {
    var elapsed = currentTime - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    var current = Math.floor(start + range * eased);
    element.textContent = prefix + current.toLocaleString('fr-FR') + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function animateAllKPIs() {
  var kpis = document.querySelectorAll('[data-animate-value]:not([data-animated])');
  kpis.forEach(function(el, index) {
    el.setAttribute('data-animated', 'done');
    var end = parseFloat(el.getAttribute('data-animate-value'));
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 600 + (index * 100);
    setTimeout(function() {
      animateValue(el, 0, end, duration, prefix, suffix);
    }, 150 + (index * 80));
  });
}

function animateKPI(selector, value, suffix) {
  var el = document.querySelector(selector);
  if (el) animateValue(el, 0, value, 800, '', suffix || '');
}

// ═══════════════════════════════════════════════════════════════════
// 2. AUTO-DETECT : Anime les .kpi-value sans data-animate-value
// ═══════════════════════════════════════════════════════════════════

function _autoAnimateKPIValues() {
  // D'abord les explicites
  animateAllKPIs();

  // Ensuite auto-detect
  var kpis = document.querySelectorAll('.kpi-value:not([data-animate-value]):not([data-animated])');
  if (!kpis.length) return;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return;

  kpis.forEach(function(el, index) {
    var raw = el.textContent.trim();
    var numMatch = raw.replace(/\u00a0/g, ' ').match(/^([^\d-]*?)([\d\s,.]+)(.*)/);
    if (!numMatch) return;

    var prefix = numMatch[1] || '';
    var numStr = numMatch[2].replace(/\s/g, '').replace(/,/g, '.');
    var suffix = numMatch[3] || '';
    var numVal = parseFloat(numStr);

    if (isNaN(numVal) || numVal === 0) return;

    el.setAttribute('data-animated', 'done');
    el.textContent = prefix + '0' + suffix;
    var duration = 600 + (index * 100);
    setTimeout(function() {
      animateValue(el, 0, numVal, duration, prefix, suffix);
    }, 150 + (index * 80));
  });
}

// ═══════════════════════════════════════════════════════════════════
// 3. ANIMATION DES CHARTS — CSS reveal LENT
// ═══════════════════════════════════════════════════════════════════

(function() {
  if (document.getElementById('ordivex-chart-anim-css')) return;
  var style = document.createElement('style');
  style.id = 'ordivex-chart-anim-css';
  style.textContent = [
    '@keyframes chartRevealUp {',
    '  0%   { clip-path: inset(100% 0 0 0); opacity: 0.3; }',
    '  20%  { opacity: 1; }',
    '  100% { clip-path: inset(0 0 0 0); opacity: 1; }',
    '}',
    '@keyframes chartRevealRight {',
    '  0%   { clip-path: inset(0 100% 0 0); opacity: 0.3; }',
    '  20%  { opacity: 1; }',
    '  100% { clip-path: inset(0 0 0 0); opacity: 1; }',
    '}',
    '@keyframes chartDonutReveal {',
    '  0%   { opacity: 0; }',
    '  40%  { opacity: 1; }',
    '  100% { opacity: 1; }',
    '}',
    'canvas.chart-anim-bar {',
    '  animation: chartRevealUp 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;',
    '}',
    'canvas.chart-anim-line {',
    '  animation: chartRevealRight 4s cubic-bezier(0.16, 1, 0.3, 1) forwards;',
    '}',
    'canvas.chart-anim-donut {',
    '  animation: chartDonutReveal 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;',
    '}'
  ].join('\n');
  document.head.appendChild(style);
})();

function _animateCanvas(canvasId, type) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return;

  // Retirer les anciennes animations
  canvas.classList.remove('chart-anim-bar', 'chart-anim-line', 'chart-anim-donut');
  void canvas.offsetWidth; // Force reflow

  var cls = 'chart-anim-' + (type || 'bar');
  canvas.classList.add(cls);

  canvas.addEventListener('animationend', function handler() {
    canvas.classList.remove(cls);
    canvas.removeEventListener('animationend', handler);
  });
}

function _wrapChartAnimations() {
  if (!window.Charts) return;
  if (Charts._animWrapped) return;
  Charts._animWrapped = true;

  var _origBar = Charts.bar;
  var _origLine = Charts.line;
  var _origDonut = Charts.donut;

  Charts.bar = function(canvasId, labels, datasets, options) {
    _origBar.call(Charts, canvasId, labels, datasets, options);
    _animateCanvas(canvasId, 'bar');
  };

  Charts.line = function(canvasId, labels, datasets, options) {
    _origLine.call(Charts, canvasId, labels, datasets, options);
    _animateCanvas(canvasId, 'line');
  };

  Charts.donut = function(canvasId, labels, data, colors) {
    _origDonut.call(Charts, canvasId, labels, data, colors);
    _animateCanvas(canvasId, 'donut');
  };
}

// ═══════════════════════════════════════════════════════════════════
// 4. HOOK GLOBAL
// ═══════════════════════════════════════════════════════════════════

function _hookRouterForAnimations() {
  if (!window.Router || !Router.navigate) return;
  if (Router._animHooked) return;
  Router._animHooked = true;

  var _origNavigate = Router.navigate.bind(Router);
  Router.navigate = function(page) {
    _origNavigate(page);
    setTimeout(_autoAnimateKPIValues, 300);
  };
}

// ═══════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    _wrapChartAnimations();
    _hookRouterForAnimations();
  });
} else {
  setTimeout(function() {
    _wrapChartAnimations();
    _hookRouterForAnimations();
  }, 0);
}

window.animateValue = animateValue;
window.animateAllKPIs = animateAllKPIs;
window.animateKPI = animateKPI;
window._autoAnimateKPIValues = _autoAnimateKPIValues;
