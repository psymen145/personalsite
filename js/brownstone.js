// Page controller: the street scene (SVG) and routing into the 3D house.

var SVGNS = 'http://www.w3.org/2000/svg';
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var body = document.body;
var streetSvg = document.getElementById('street-svg');
var door = document.getElementById('front-door');
var panel = document.getElementById('panel');
var fade = document.getElementById('fade');
var hint = document.getElementById('inside-hint');

var STREET_VB = [0, 0, 1200, 900];
var DOOR_CENTER = [470, 615];

// The order you'd tour the house in: parlor floor, then down, then up.
var ORDER = ['about', 'education', 'experience', 'skills', 'projects'];
var ROOMS = {
  about:      { name: 'Parlor' },
  education:  { name: 'Library' },
  experience: { name: 'Study' },
  skills:     { name: 'Workshop' },
  projects:   { name: 'Rooftop' }
};

// ---------------------------------------------------------------- helpers

function el(tag, attrs, parent) {
  var node = document.createElementNS(SVGNS, tag);
  for (var k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
}

// Small seeded PRNG so the scenery looks the same on every visit.
function rng(seed) {
  return function () {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, reduceMotion ? 0 : ms); });
}

function getViewBox(svg) {
  var vb = svg.viewBox.baseVal;
  return [vb.x, vb.y, vb.width, vb.height];
}

function setViewBox(svg, vb) {
  svg._tween = (svg._tween || 0) + 1; // cancels any running tween
  svg.setAttribute('viewBox', vb.join(' '));
}

function tweenViewBox(svg, to, ms) {
  var from = getViewBox(svg);
  var token = (svg._tween || 0) + 1;
  svg._tween = token;
  if (reduceMotion || !ms) {
    svg.setAttribute('viewBox', to.join(' '));
    return Promise.resolve();
  }
  return new Promise(function (resolve) {
    var t0 = performance.now();
    function step(now) {
      if (svg._tween !== token) return resolve();
      var t = Math.min(1, (now - t0) / ms);
      var e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      svg.setAttribute('viewBox', from.map(function (v, i) { return v + (to[i] - v) * e; }).join(' '));
      if (t < 1) requestAnimationFrame(step); else resolve();
    }
    requestAnimationFrame(step);
  });
}

// ---------------------------------------------------------------- scenery

function addStars(parent, count, x0, x1, y0, y1, seed) {
  var r = rng(seed);
  for (var i = 0; i < count; i++) {
    el('circle', {
      cx: (x0 + r() * (x1 - x0)).toFixed(1),
      cy: (y0 + r() * (y1 - y0)).toFixed(1),
      r: (0.5 + r() * 1.1).toFixed(2),
      opacity: (0.3 + r() * 0.7).toFixed(2)
    }, parent);
  }
}

function facadeWindow(parent, x, y, w, h, opts) {
  opts = opts || {};
  var g = el('g', {}, parent);
  el('rect', { x: x - 6, y: y - 14, width: w + 12, height: 14, fill: opts.trim || '#4b2a1b' }, g);
  el('rect', { x: x, y: y, width: w, height: h, fill: '#2a1a12' }, g);
  el('rect', { x: x + 4, y: y + 4, width: w - 8, height: h - 8, fill: opts.lit ? 'url(#glow)' : '#1b2238', opacity: opts.dim ? 0.7 : 1 }, g);
  if (opts.lit && opts.curtains) {
    el('path', {
      d: 'M' + (x + 4) + ' ' + (y + 4) + 'h' + (w * 0.28) + 'q-' + (w * 0.18) + ' ' + (h * 0.4) + ' 0 ' + (h - 8) + 'h-' + (w * 0.28) + 'z' +
         'M' + (x + w - 4) + ' ' + (y + 4) + 'h-' + (w * 0.28) + 'q' + (w * 0.18) + ' ' + (h * 0.4) + ' 0 ' + (h - 8) + 'h' + (w * 0.28) + 'z',
      fill: '#a24a2a', opacity: 0.55
    }, g);
  }
  el('path', {
    d: 'M' + (x + w / 2) + ' ' + (y + 4) + 'V' + (y + h - 4) + 'M' + (x + 4) + ' ' + (y + h / 2) + 'H' + (x + w - 4),
    stroke: '#2a1a12', 'stroke-width': 3
  }, g);
  if (opts.bars) {
    for (var bx = x + 8; bx < x + w - 4; bx += 8) {
      el('path', { d: 'M' + bx + ' ' + y + 'V' + (y + h), stroke: '#141010', 'stroke-width': 2 }, g);
    }
  }
  el('rect', { x: x - 4, y: y + h, width: w + 8, height: 6, fill: opts.trim || '#4b2a1b' }, g);
}

function buildStreet() {
  addStars(document.getElementById('stars'), 70, 0, 1200, 0, 300, 3);

  // neighbours
  var r = rng(42);
  var nb = document.getElementById('neighbour-windows');
  [
    { x: 0, w: 200, top: 290 },
    { x: 200, w: 210, top: 320 },
    { x: 790, w: 220, top: 300 },
    { x: 1010, w: 190, top: 268 }
  ].forEach(function (b) {
    var ww = 40, wh = 64, gap = (b.w - 3 * ww) / 4;
    for (var y = b.top + 48; y + wh < 810; y += 108) {
      for (var c = 0; c < 3; c++) {
        facadeWindow(nb, b.x + gap + c * (ww + gap), y, ww, wh, { lit: r() < 0.42, curtains: r() < 0.5, trim: '#2f1c13' });
      }
    }
  });

  // the brownstone
  var fw = document.getElementById('facade-windows');
  [448, 568, 688].forEach(function (x, i) {
    facadeWindow(fw, x, 300, 64, 80, { lit: true, curtains: i !== 1 });
    facadeWindow(fw, x, 425, 64, 95, { lit: true, curtains: i === 1 });
  });
  [568, 688].forEach(function (x) {
    facadeWindow(fw, x, 556, 64, 119, { lit: true, curtains: true });
    facadeWindow(fw, x, 716, 64, 60, { lit: true, dim: true, bars: true });
  });

  var dentils = document.getElementById('dentils');
  for (var dx = 406; dx < 794; dx += 12) el('rect', { x: dx, y: 254, width: 6, height: 7 }, dentils);

  // stoop: eight steps that flare slightly toward the sidewalk
  var stoop = document.getElementById('stoop');
  for (var s = 0; s < 8; s++) {
    var sy = 676 + s * 19.5;
    el('rect', { x: 424 - s * 2, y: sy, width: 92 + s * 4, height: 19.5, fill: s % 2 ? '#6e4330' : '#774833' }, stoop);
    el('rect', { x: 424 - s * 2, y: sy, width: 92 + s * 4, height: 3, fill: '#8f5c41' }, stoop);
  }

  var bal = document.getElementById('balusters');
  for (var t = 0.05; t < 1; t += 0.1) {
    var y = 650 + 156 * t;
    el('path', { d: 'M' + (424 - 16 * t) + ' ' + y + 'v26' }, bal);
    el('path', { d: 'M' + (516 + 16 * t) + ' ' + y + 'v26' }, bal);
  }

  var fence = document.getElementById('fence');
  el('path', { d: 'M540 802H790M540 826H790' }, fence);
  for (var fx = 544; fx < 790; fx += 10) {
    el('path', { d: 'M' + fx + ' 794V832' }, fence);
    el('path', { d: 'M' + (fx - 3) + ' 796L' + fx + ' 789L' + (fx + 3) + ' 796', fill: '#141010', 'stroke-width': 1 }, fence);
  }

  var seams = document.getElementById('sidewalk-seams');
  for (var sx = 40; sx < 1200; sx += 80) el('path', { d: 'M' + sx + ' 832V872' }, seams);
}


// ---------------------------------------------------------------- scenes

var scene = 'street';
var current = null; // room whose panel is open
var house = null;
var hintTimer = 0;

var canvas = document.getElementById('house-canvas');
var loading = document.getElementById('loading');
var articles = Array.prototype.slice.call(panel.querySelectorAll('article'));
var navButtons = Array.prototype.slice.call(document.querySelectorAll('[data-go]'));
var prevBtn = panel.querySelector('[data-stairs="up"]');
var nextBtn = panel.querySelector('[data-stairs="down"]');

// Start building the 3D house straight away so it's ready by the time the
// front door has swung open.
var houseReady = import('./house3d.js')
  .then(function (m) {
    return m.createHouse({
      canvas: canvas,
      hotspotLayer: document.getElementById('hotspots'),
      fadeEl: fade,
      onSelect: function (id) { go(id); }
    });
  })
  .then(function (h) {
    house = h;
    loading.hidden = true;
    return h;
  })
  .catch(function (err) {
    console.error(err);
    loading.textContent = 'The 3D house couldn’t load on this device. Use the room buttons below.';
    return null;
  });

function doorViewBox() {
  var w = 80;
  var h = w * window.innerHeight / window.innerWidth;
  return [DOOR_CENTER[0] - w / 2, DOOR_CENTER[1] - h / 2, w, h];
}

function parseHash() {
  var h = window.location.hash.slice(1);
  if (ROOMS[h]) return { scene: 'inside', room: h };
  if (h === 'inside') return { scene: 'inside', room: null };
  return { scene: 'street', room: null };
}

function showHint() {
  hint.classList.remove('is-hidden');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(hideHint, 7000);
}

function hideHint() {
  hint.classList.add('is-hidden');
}

async function enterHouse(instant) {
  body.classList.add('entering');
  if (!instant) {
    door.classList.add('is-open');
    await wait(600);
    var zoom = tweenViewBox(streetSvg, doorViewBox(), 1000);
    await wait(500);
    fade.classList.add('is-on');
    await zoom;
  }
  await houseReady;
  if (house) {
    await house.goHome({ instant: true });
    house.start();
  }
  body.setAttribute('data-scene', 'inside');
  scene = 'inside';
  await wait(120);
  fade.classList.remove('is-on');
  body.classList.remove('entering');
  if (!parseHash().room) showHint();
}

async function leaveHouse() {
  closePanel();
  current = null;
  hideHint();
  door.classList.add('is-open');
  setViewBox(streetSvg, doorViewBox());
  body.setAttribute('data-scene', 'street');
  scene = 'street';
  await wait(250);
  door.classList.remove('is-open');
  await tweenViewBox(streetSvg, STREET_VB, 1100);
  if (house) {
    house.stop();
    await house.goHome({ instant: true });
  }
  door.focus({ preventScroll: true });
}

function closePanel() {
  body.classList.remove('panel-open');
  navButtons.forEach(function (b) { b.setAttribute('aria-current', 'false'); });
}

function neighbourLabel(button, id, before, after) {
  button.textContent = id ? before + ROOMS[id].name + after : '';
  button.setAttribute('data-target', id || '');
}

async function openRoom(id) {
  if (current === id) return;
  hideHint();
  closePanel();
  current = id;
  navButtons.forEach(function (b) { b.setAttribute('aria-current', String(b.getAttribute('data-go') === id)); });
  if (house) await house.goRoom(id);

  articles.forEach(function (a) { a.hidden = a.getAttribute('data-room') !== id; });
  var i = ORDER.indexOf(id);
  neighbourLabel(prevBtn, ORDER[i - 1], '← ', '');
  neighbourLabel(nextBtn, ORDER[i + 1], '', ' →');
  panel.scrollTop = 0;
  body.classList.add('panel-open');
  var heading = panel.querySelector('article[data-room="' + id + '"] h2');
  setTimeout(function () { heading.focus({ preventScroll: true }); }, 50);
}

async function closeRoom() {
  if (!current) return;
  current = null;
  closePanel();
  if (house) await house.goHome();
  canvas.focus({ preventScroll: true });
}

async function route(opts) {
  var want = parseHash();
  if (want.scene === 'street') {
    if (scene !== 'street') await leaveHouse();
    return;
  }
  if (scene === 'street') await enterHouse(opts && opts.instant);
  if (want.room) await openRoom(want.room);
  else await closeRoom();
}

// Serialise transitions so rapid clicks never interleave animations.
var queue = Promise.resolve();
function schedule(opts) {
  queue = queue.then(function () { return route(opts); }).catch(function (err) { console.error(err); });
}

function go(hash) {
  if (window.location.hash.slice(1) === hash) return;
  history.pushState(null, '', hash ? '#' + hash : window.location.pathname + window.location.search);
  schedule();
}

// ---------------------------------------------------------------- events

function activate(handler) {
  return function (e) {
    if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handler();
    }
  };
}

var enter = activate(function () { go('inside'); });
door.addEventListener('click', enter);
door.addEventListener('keydown', enter);
document.getElementById('enter-hint').addEventListener('click', function () { go('inside'); });
document.getElementById('exit-btn').addEventListener('click', function () { go(''); });
document.getElementById('panel-close').addEventListener('click', function () { go('inside'); });

navButtons.forEach(function (b) {
  b.addEventListener('click', function () { go(b.getAttribute('data-go')); });
});

[prevBtn, nextBtn].forEach(function (b) {
  b.addEventListener('click', function () {
    var target = b.getAttribute('data-target');
    if (target) go(target);
  });
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && current) go('inside');
});

window.addEventListener('popstate', function () { schedule(); });

// ---------------------------------------------------------------- start

buildStreet();
schedule({ instant: true });
