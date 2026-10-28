// First-person 3D interior of the brownstone.
// Everything is built from boxes and procedurally drawn canvas textures, so
// there are no model files to load. Units are metres; y is up and the front
// door is at +z, looking down the hall toward -z.

import * as THREE from '../vendor/three/three.module.min.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

const BASEMENT_Y = -20;
const ROOF_Y = 30;

// Where the camera stands in each room, and what it looks at.
const HOME = { p: V(-0.45, 1.65, 0.3), l: V(-0.25, 1.5, -10) };
const VIEWS = {
  about:      { area: 'main', p: V(-1.9, 1.6, -1.35), l: V(-7.3, 1.3, -2.9) },
  education:  { area: 'main', p: V(-2.0, 1.6, -6.75), l: V(-7.3, 1.35, -8.9) },
  experience: { area: 'main', p: V(2.05, 1.6, -8.35), l: V(6.3, 1.2, -8.75) },
  skills:     { area: 'basement', p: V(-0.2, BASEMENT_Y + 1.6, -1.6), l: V(0.3, BASEMENT_Y + 1.35, -7) },
  projects:   { area: 'roof', p: V(0.3, ROOF_Y + 1.65, 2.4), l: V(-2, ROOF_Y + 2.5, -40) }
};

// Walks from the hall into each room. The last point is the room view, except
// for skills/projects, which end at a door or the top of the stairs and then
// cut to another floor.
const WALKS = {
  about: {
    p: [HOME.p, V(-0.55, 1.65, -1.5), V(-1.3, 1.62, -1.9), VIEWS.about.p],
    l: [HOME.l, V(-3, 1.5, -6), V(-7.3, 1.4, -3.4), VIEWS.about.l]
  },
  education: {
    p: [HOME.p, V(-0.55, 1.65, -5.4), V(-1.2, 1.62, -6.6), VIEWS.education.p],
    l: [HOME.l, V(-1.5, 1.5, -12), V(-7.3, 1.4, -8.0), VIEWS.education.l]
  },
  experience: {
    p: [HOME.p, V(-0.5, 1.65, -6.8), V(-0.15, 1.64, -8.5), V(1.3, 1.62, -8.45), VIEWS.experience.p],
    l: [HOME.l, V(-0.2, 1.5, -12), V(4, 1.4, -10.5), V(6.3, 1.25, -8.8), VIEWS.experience.l]
  },
  skills: {
    p: [HOME.p, V(-0.5, 1.65, -3.8), V(-0.45, 1.6, -5.4), V(-0.02, 1.4, -5.4)],
    l: [HOME.l, V(-0.3, 1.4, -8), V(0.2, 1.1, -5.4), V(0.4, 1.0, -5.4)]
  },
  projects: {
    p: [HOME.p, V(-0.35, 1.65, -0.8), V(0.55, 1.75, -1.3), V(0.6, 2.4, -2.6), V(0.6, 3.8, -4.5), V(0.6, 5.0, -6.1)],
    l: [HOME.l, V(0.5, 2.0, -6), V(0.6, 3.0, -8), V(0.6, 5.2, -10), V(0.6, 6, -10), V(0.6, 6, -10)]
  }
};

const HOTSPOTS = [
  { id: 'about',      at: V(-1.2, 2.05, -2.4), label: 'Parlor', sub: 'About me' },
  { id: 'education',  at: V(-1.2, 2.05, -6.9), label: 'Library', sub: 'Education' },
  { id: 'experience', at: V(1.1, 2.3, -8.5),  label: 'Study', sub: 'Experience' },
  { id: 'skills',     at: V(0.05, 0.95, -5.4),  label: 'Workshop', sub: 'Downstairs · Skills' },
  { id: 'projects',   at: V(0.6, 2.35, -3.0),  label: 'Rooftop', sub: 'Upstairs · Projects' }
];

// ------------------------------------------------------------------ helpers

function rng(seed) {
  return function () {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}

function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.scale) t.repeat.set(1 / opts.scale, 1 / opts.scale); // metres per repeat
  return t;
}

// A box whose UVs are in world units, so textures keep a constant scale
// whatever the box size. tu/tv are metres per texture repeat.
function boxGeo(w, h, d, tu = 1, tv = tu) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / tu, uv.getY(k) * dims[f][1] / tv);
    }
  }
  return geo;
}

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: o.rough ?? 0.8,
    metalness: o.metal ?? 0,
    map: o.map || null,
    emissive: o.emissive || 0x000000,
    emissiveIntensity: o.ei ?? 1,
    emissiveMap: o.emissiveMap || null,
    envMapIntensity: o.env ?? 0.35,
    side: o.side ?? THREE.FrontSide,
    transparent: o.transparent || false,
    opacity: o.opacity ?? 1
  });
}

function basic(color, o = {}) {
  return new THREE.MeshBasicMaterial({ color, map: o.map || null, toneMapped: o.toneMapped ?? true, fog: o.fog ?? true, side: o.side ?? THREE.FrontSide });
}

// Box from bounds (any order). m is a material or an array of six
// [+x, -x, +y, -y, +z, -z].
function slab(parent, x0, x1, y0, y1, z0, z1, m, o = {}) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  const mesh = new THREE.Mesh(boxGeo(w, h, d, o.tu ?? o.tile ?? 1, o.tv ?? o.tile ?? 1), m);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.castShadow = o.cast ?? true;
  mesh.receiveShadow = o.receive ?? true;
  parent.add(mesh);
  return mesh;
}

// Box from size + centre, for furniture built in local coordinates.
function B(parent, size, pos, m, o = {}) {
  const mesh = new THREE.Mesh(boxGeo(size[0], size[1], size[2], o.tile ?? 1), m);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (o.rot) mesh.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  mesh.castShadow = o.cast ?? true;
  mesh.receiveShadow = o.receive ?? true;
  parent.add(mesh);
  return mesh;
}

function cyl(parent, rt, rb, h, pos, m, o = {}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg ?? 20, 1, o.open ?? false), m);
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (o.rot) mesh.rotation.set(o.rot[0], o.rot[1], o.rot[2]);
  mesh.castShadow = o.cast ?? true;
  mesh.receiveShadow = o.receive ?? true;
  parent.add(mesh);
  return mesh;
}

function group(parent, x = 0, y = 0, z = 0, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

function plane(parent, w, h, pos, rotY, m) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  mesh.position.set(pos[0], pos[1], pos[2]);
  mesh.rotation.y = rotY;
  parent.add(mesh);
  return mesh;
}

function pointLight(parent, color, intensity, pos, shadow) {
  const l = new THREE.PointLight(color, intensity, 0, 2);
  l.position.set(pos[0], pos[1], pos[2]);
  if (shadow) {
    l.castShadow = true;
    l.shadow.mapSize.set(512, 512);
    l.shadow.bias = -0.003;
    l.shadow.normalBias = 0.02;
    l.shadow.camera.near = 0.1;
    l.shadow.camera.far = 14;
  }
  parent.add(l);
  return l;
}

// ------------------------------------------------------------------ textures

function woodTexture(base, seed, plank = 64) {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = rng(seed);
    for (let y = 0; y < h; y += plank) {
      let x = -Math.floor(r() * 300);
      while (x < w) {
        const len = 180 + r() * 320;
        g.fillStyle = shade(base, 0.8 + r() * 0.35);
        g.fillRect(x, y, len, plank);
        for (let i = 0; i < 16; i++) {
          const gy = y + r() * plank, amp = r() * 2.5, ph = r() * 9;
          g.strokeStyle = `rgba(30,15,5,${0.05 + r() * 0.12})`;
          g.lineWidth = 0.6 + r() * 1.4;
          g.beginPath();
          g.moveTo(x, gy);
          for (let gx = x; gx <= x + len; gx += 16) g.lineTo(gx, gy + Math.sin(gx * 0.015 + ph) * amp);
          g.stroke();
        }
        g.fillStyle = 'rgba(20,10,4,.6)';
        g.fillRect(x, y, 2, plank);
        x += len;
      }
      g.fillStyle = 'rgba(20,10,4,.65)';
      g.fillRect(0, y, w, 2);
    }
  });
}

function damaskTexture(base, motif, seed) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.fillStyle = motif;
    g.strokeStyle = motif;
    const orn = (cx, cy, s) => {
      g.save();
      g.translate(cx, cy);
      g.scale(s, s);
      for (let k = 0; k < 4; k++) {
        g.rotate(Math.PI / 2);
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(14, -10, 20, -34, 0, -50);
        g.bezierCurveTo(-20, -34, -14, -10, 0, 0);
        g.fill();
      }
      g.beginPath();
      g.arc(0, 0, 9, 0, Math.PI * 2);
      g.fill();
      g.restore();
    };
    [[64, 64], [192, 192], [192, -64], [-64, 192], [320, 64], [64, 320], [-64, -64], [320, 320]].forEach(([x, y]) => orn(x, y, 0.85));
    g.globalAlpha = 0.6;
    [[192, 64], [64, 192], [-64, 64], [64, -64], [192, 320], [320, 192]].forEach(([x, y]) => orn(x, y, 0.32));
    g.globalAlpha = 1;
  }, { scale: 0.42 });
}

function paintTexture(base, seed) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.04})` : `rgba(255,255,255,${r() * 0.03})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

function wainscotTexture(base) {
  // One repeat is 0.8 m wide by 1.0 m tall: a raised panel above a baseboard.
  return canvasTexture(256, 320, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = shade(base, 0.7);
    g.fillRect(0, h - 48, w, 48);
    g.fillStyle = shade(base, 1.25);
    g.fillRect(0, h - 50, w, 3);
    const x = 26, y = 34, pw = w - 52, ph = h - 120;
    g.fillStyle = shade(base, 0.65);
    g.fillRect(x, y, pw, ph);
    g.fillStyle = shade(base, 1.08);
    g.fillRect(x + 6, y + 6, pw - 12, ph - 12);
    g.fillStyle = shade(base, 1.3);
    g.fillRect(x + 6, y + 6, pw - 12, 3);
    g.fillRect(x + 6, y + 6, 3, ph - 12);
    g.fillStyle = shade(base, 0.8);
    g.fillRect(x + 12, y + 14, pw - 24, ph - 28);
    g.fillStyle = shade(base, 0.95);
    g.fillRect(x + 16, y + 18, pw - 32, ph - 36);
  });
}

function rugTexture(field, border, accent, seed) {
  return canvasTexture(256, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = border;
    g.fillRect(0, 0, w, h);
    g.fillStyle = accent;
    g.fillRect(14, 14, w - 28, h - 28);
    g.fillStyle = border;
    g.fillRect(20, 20, w - 40, h - 40);
    for (let y = 30; y < h - 30; y += 16) {
      g.fillStyle = accent;
      g.fillRect(26, y, 6, 6);
      g.fillRect(w - 32, y, 6, 6);
    }
    g.fillStyle = field;
    g.fillRect(40, 40, w - 80, h - 80);
    g.strokeStyle = accent;
    g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      const cy = h * (0.25 + k * 0.25);
      g.beginPath();
      g.moveTo(w / 2, cy - 50);
      g.lineTo(w / 2 + 50, cy);
      g.lineTo(w / 2, cy + 50);
      g.lineTo(w / 2 - 50, cy);
      g.closePath();
      g.stroke();
      g.fillStyle = border;
      g.beginPath();
      g.arc(w / 2, cy, 16, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
      g.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  }, { repeat: false });
}

function brickTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = rng(17);
    g.fillStyle = '#8d877d';
    g.fillRect(0, 0, w, h);
    const bh = 32, bw = 96;
    for (let row = 0; row * bh < h; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -off; x < w; x += bw) {
        const c = new THREE.Color().setHSL(0.02 + r() * 0.03, 0.45 + r() * 0.15, 0.24 + r() * 0.1);
        g.fillStyle = '#' + c.getHexString();
        g.fillRect(x + 3, row * bh + 3, bw - 6, bh - 6);
      }
    }
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.15})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

function noiseTexture(base, amount, seed, size = 256) {
  return canvasTexture(size, size, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let i = 0; i < w * h / 6; i++) {
      g.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * amount})` : `rgba(255,255,255,${r() * amount * 0.6})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

function marbleTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ece8e1';
    g.fillRect(0, 0, w, h);
    const r = rng(23);
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = `rgba(110,105,100,${0.1 + r() * 0.25})`;
      g.lineWidth = 0.5 + r() * 1.5;
      g.beginPath();
      let x = r() * w, y = 0;
      g.moveTo(x, y);
      while (y < h) {
        x += (r() - 0.5) * 30;
        y += 10 + r() * 20;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

function streetViewTexture() {
  return canvasTexture(256, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.45);
    sky.addColorStop(0, '#141a3c');
    sky.addColorStop(1, '#5b4466');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const r = rng(31);
    g.fillStyle = '#2b1a14';
    g.fillRect(0, h * 0.3, w, h);
    for (let y = h * 0.34; y < h * 0.95; y += 56) {
      for (let x = 14; x < w; x += 60) {
        g.fillStyle = r() < 0.45 ? '#f2b860' : '#151a2c';
        g.fillRect(x, y, 30, 40);
      }
    }
    const lamp = g.createRadialGradient(w * 0.7, h * 0.55, 2, w * 0.7, h * 0.55, 90);
    lamp.addColorStop(0, 'rgba(255,220,150,.9)');
    lamp.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = lamp;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d1410';
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.arc(30 + r() * 80, h * 0.5 + r() * 120, 30 + r() * 30, 0, Math.PI * 2);
      g.fill();
    }
  }, { repeat: false });
}

function skylineTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0e1430');
    sky.addColorStop(0.7, '#3c3260');
    sky.addColorStop(1, '#7a4d5c');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const r = rng(41);
    for (let i = 0; i < 26; i++) {
      const bw = 20 + r() * 50, bh = 80 + r() * 330, x = r() * w;
      g.fillStyle = `rgb(${12 + r() * 10},${14 + r() * 10},${28 + r() * 14})`;
      g.fillRect(x, h - bh, bw, bh);
      for (let wy = h - bh + 8; wy < h; wy += 12) {
        for (let wx = x + 4; wx < x + bw - 4; wx += 8) {
          if (r() < 0.3) {
            g.fillStyle = r() < 0.8 ? '#f3c674' : '#cfe3ff';
            g.fillRect(wx, wy, 3, 5);
          }
        }
      }
    }
  }, { repeat: false });
}

function textCanvas(w, h, bg, draw) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    draw(g, w, h);
  }, { repeat: false });
}

function codeTexture() {
  const lines = [
    [['#c792ea', 'class '], ['#ffcb6b', 'Simon'], ['#89ddff', '('], ['#ffcb6b', 'Developer'], ['#89ddff', '):']],
    [['#676e95', '    """Database analyst & Python developer."""']],
    [['#f07178', '    home'], ['#89ddff', ' = '], ['#c3e88d', '"Brooklyn, NY"']],
    [['#f07178', '    stack'], ['#89ddff', ' = ['], ['#c3e88d', '"Python"'], ['#89ddff', ', '], ['#c3e88d', '"Django"'], ['#89ddff', ', '], ['#c3e88d', '"SQL Server"'], ['#89ddff', ']']],
    [],
    [['#c792ea', '    def '], ['#82aaff', 'build'], ['#89ddff', '('], ['#f78c6c', 'self'], ['#89ddff', ', '], ['#eeffff', 'idea'], ['#89ddff', '):']],
    [['#eeffff', '        schema '], ['#89ddff', '= '], ['#82aaff', 'design'], ['#89ddff', '('], ['#eeffff', 'idea'], ['#89ddff', ')']],
    [['#eeffff', '        app '], ['#89ddff', '= '], ['#82aaff', 'django_front_end'], ['#89ddff', '('], ['#eeffff', 'schema'], ['#89ddff', ')']],
    [['#c792ea', '        return '], ['#82aaff', 'ship'], ['#89ddff', '('], ['#eeffff', 'app'], ['#89ddff', ')']],
    [],
    [['#676e95', '# >>> Simon().build("vital records system")']],
    [['#c3e88d', "# 'deployed ✓'"]]
  ];
  return textCanvas(1024, 600, '#0f1a2b', (g, w) => {
    g.fillStyle = '#16233a';
    g.fillRect(0, 0, w, 36);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(24 + i * 22, 18, 7, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = '#8796b0';
    g.font = '18px ui-monospace, Menlo, Consolas, monospace';
    g.fillText('simon.py', 110, 24);
    g.font = '26px ui-monospace, Menlo, Consolas, monospace';
    lines.forEach((segs, i) => {
      let x = 64;
      g.fillStyle = '#4a5878';
      g.fillText(String(i + 1).padStart(2, ' '), 14, 80 + i * 42);
      segs.forEach(([c, s]) => {
        g.fillStyle = c;
        g.fillText(s, x, 80 + i * 42);
        x += g.measureText(s).width;
      });
    });
  });
}

function terminalTexture() {
  return textCanvas(512, 320, '#0b0f0c', (g) => {
    g.font = '20px ui-monospace, Menlo, Consolas, monospace';
    const rows = [
      ['#7ee787', '$ python manage.py runserver'],
      ['#c9d1d9', 'Watching for file changes...'],
      ['#c9d1d9', 'System check identified no issues.'],
      ['#c9d1d9', 'Starting development server at'],
      ['#79c0ff', '  http://127.0.0.1:8000/'],
      ['#7ee787', '$ psql -c "select 1"'],
      ['#c9d1d9', ' ?column? = 1'],
      ['#7ee787', '$ █']
    ];
    rows.forEach(([c, s], i) => {
      g.fillStyle = c;
      g.fillText(s, 18, 36 + i * 36);
    });
  });
}

function chalkboardTexture() {
  return textCanvas(1024, 640, '#1f3229', (g, w, h) => {
    const r = rng(77);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
      g.fillRect(r() * w, r() * h, 80 + r() * 200, 20 + r() * 60);
    }
    g.fillStyle = 'rgba(245,245,235,.92)';
    g.font = 'italic 64px Georgia, serif';
    g.fillText('Skills', 56, 96);
    g.fillRect(56, 112, 220, 3);
    g.font = '38px Georgia, serif';
    const left = ['Python', 'Django', 'JavaScript', 'React', 'jQuery', 'Bootstrap'];
    const right = ['SQL Server', 'PostgreSQL', 'Linux', 'C++', 'C (systems)'];
    left.forEach((s, i) => g.fillText('· ' + s, 70, 180 + i * 72));
    right.forEach((s, i) => g.fillText('· ' + s, 540, 180 + i * 72));
  });
}

function diplomaTexture() {
  return textCanvas(512, 384, '#efe6cf', (g, w, h) => {
    g.strokeStyle = '#b08d57';
    g.lineWidth = 6;
    g.strokeRect(18, 18, w - 36, h - 36);
    g.lineWidth = 1.5;
    g.strokeRect(30, 30, w - 60, h - 60);
    g.fillStyle = '#3a2a1a';
    g.textAlign = 'center';
    g.font = '38px Georgia, serif';
    g.fillText('Brooklyn College', w / 2, 104);
    g.font = 'italic 22px Georgia, serif';
    g.fillText('The City University of New York', w / 2, 140);
    g.font = '26px Georgia, serif';
    g.fillText('Master of Arts', w / 2, 210);
    g.fillText('Computer Science', w / 2, 248);
    g.fillStyle = '#a8322d';
    g.beginPath();
    g.arc(w - 96, h - 84, 30, 0, Math.PI * 2);
    g.fill();
  });
}

function captionTexture(title, sub, bg, fg) {
  return textCanvas(400, 300, bg, (g, w, h) => {
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.font = 'bold 44px Georgia, serif';
    g.fillText(title, w / 2, h / 2 - 6);
    g.font = '24px Georgia, serif';
    g.fillText(sub, w / 2, h / 2 + 40);
  });
}

function paintingTexture(seed) {
  return textCanvas(300, 220, '#000', (g, w, h) => {
    const r = rng(seed);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, ['#f2c48d', '#9db7c9', '#d8a07a'][seed % 3]);
    sky.addColorStop(1, ['#c0614a', '#e8d9b8', '#6a4a6a'][seed % 3]);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 3; k++) {
      g.fillStyle = ['#4a5a3a', '#344430', '#22301f'][k];
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.55 + k * 0.12) - Math.sin(x * 0.02 + r() * 6) * 18);
      g.lineTo(w, h);
      g.fill();
    }
  });
}

function rackTexture() {
  return textCanvas(256, 512, '#16181d', (g, w, h) => {
    for (let u = 0; u < 12; u++) {
      const y = 16 + u * 40;
      g.fillStyle = '#23262d';
      g.fillRect(12, y, w - 24, 34);
      g.fillStyle = '#0d0e11';
      for (let x = 24; x < 150; x += 6) g.fillRect(x, y + 8, 3, 18);
    }
  });
}

function pegboardTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#b8955f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5e4728';
    for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) {
      g.beginPath();
      g.arc(x, y, 2.4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function windowLightsTexture(seed, density, warm) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    const r = rng(seed);
    for (let y = 6; y < h; y += 16) {
      for (let x = 6; x < w; x += 16) {
        if (r() < density) {
          const v = 0.4 + r() * 0.6;
          g.fillStyle = r() < warm ? `rgba(255,${190 + r() * 40},${110 + r() * 50},${v})` : `rgba(190,215,255,${v})`;
          g.fillRect(x, y, 8, 10);
        }
      }
    }
  });
}

function skyTexture() {
  return canvasTexture(16, 512, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h);
    s.addColorStop(0, '#04060f');
    s.addColorStop(0.3, '#0c1230');
    s.addColorStop(0.46, '#2a2550');
    s.addColorStop(0.5, '#7a4b62');
    s.addColorStop(0.505, '#1a1420');
    s.addColorStop(1, '#0a0a10');
    g.fillStyle = s;
    g.fillRect(0, 0, w, h);
  }, { repeat: false });
}

function glowTexture() {
  return canvasTexture(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,.35)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, w);
  }, { repeat: false });
}

// ------------------------------------------------------------------ props

function makeSofa(parent, x, z, rotY, width, fabric, wood) {
  const g = group(parent, x, 0, z, rotY);
  const w = width;
  [[-w / 2 + 0.08, 0.3], [w / 2 - 0.08, 0.3], [-w / 2 + 0.08, -0.32], [w / 2 - 0.08, -0.32]].forEach(([lx, lz]) => B(g, [0.06, 0.14, 0.06], [lx, 0.07, lz], wood));
  B(g, [w, 0.26, 0.86], [0, 0.27, 0], fabric);
  const n = Math.max(1, Math.round(w / 0.7));
  for (let i = 0; i < n; i++) B(g, [w / n - 0.03, 0.14, 0.7], [-w / 2 + (i + 0.5) * w / n, 0.47, 0.06], fabric);
  B(g, [w, 0.6, 0.2], [0, 0.66, -0.34], fabric);
  for (let i = 0; i < n; i++) B(g, [w / n - 0.05, 0.4, 0.14], [-w / 2 + (i + 0.5) * w / n, 0.72, -0.2], fabric, { rot: [-0.15, 0, 0] });
  B(g, [0.18, 0.66, 0.86], [-w / 2 - 0.09, 0.4, 0], fabric);
  B(g, [0.18, 0.66, 0.86], [w / 2 + 0.09, 0.4, 0], fabric);
  return g;
}

function makeArmchair(parent, x, z, rotY, fabric, wood) {
  return makeSofa(parent, x, z, rotY, 0.62, fabric, wood);
}

function makePlant(parent, x, y, z, s, seed) {
  const g = group(parent, x, y, z);
  g.scale.setScalar(s);
  const r = rng(seed);
  cyl(g, 0.2, 0.15, 0.36, [0, 0.18, 0], mat(0x9c5a3a, { rough: 0.9 }));
  cyl(g, 0.185, 0.185, 0.02, [0, 0.35, 0], mat(0x2a1a10));
  const leaf = mat(0x3f6b3d, { rough: 0.6 });
  const leaf2 = mat(0x2f5a2e, { rough: 0.6 });
  const geo = new THREE.SphereGeometry(1, 10, 6);
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(geo, r() < 0.5 ? leaf : leaf2);
    const a = r() * Math.PI * 2, rad = 0.05 + r() * 0.22, hgt = 0.45 + r() * 0.75;
    m.position.set(Math.cos(a) * rad, hgt, Math.sin(a) * rad);
    m.scale.set(0.08, 0.02, 0.17);
    m.rotation.set(r() * 0.8 - 0.4, a, r() * 0.8 - 0.4);
    m.castShadow = true;
    g.add(m);
  }
  cyl(g, 0.012, 0.015, 0.9, [0, 0.75, 0], mat(0x4a3a20));
  return g;
}

function makeFrame(parent, pos, rotY, w, h, picture, frameMat, depth = 0.04) {
  const g = group(parent, pos[0], pos[1], pos[2], rotY);
  const t = 0.06;
  B(g, [w, t, depth], [0, h / 2 - t / 2, 0], frameMat);
  B(g, [w, t, depth], [0, -h / 2 + t / 2, 0], frameMat);
  B(g, [t, h, depth], [-w / 2 + t / 2, 0, 0], frameMat);
  B(g, [t, h, depth], [w / 2 - t / 2, 0, 0], frameMat);
  const pic = plane(g, w - t * 2, h - t * 2, [0, 0, -depth / 4], 0, picture);
  pic.receiveShadow = true;
  return g;
}

function makeLampShade(parent, pos, rTop, rBot, h, color) {
  const shadeMat = new THREE.MeshStandardMaterial({ color, emissive: 0xffc777, emissiveIntensity: 0.9, roughness: 0.9, side: THREE.DoubleSide });
  const m = cyl(parent, rTop, rBot, h, pos, shadeMat, { open: true, seg: 28, cast: false });
  return m;
}

function bulb(parent, pos, r, color = 0xffe3a6) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), basic(color, { toneMapped: false }));
  m.position.set(pos[0], pos[1], pos[2]);
  parent.add(m);
  return m;
}

function bookcase(parent, x, z, rotY, width, height, seed, wood) {
  // Local frame: back against z = 0, front facing +z.
  const g = group(parent, x, 0, z, rotY);
  const D = 0.36, t = 0.03;
  B(g, [width, height, 0.02], [0, height / 2, 0.01], mat(0x2a180d));
  const bays = Math.max(1, Math.round(width / 0.9));
  const bw = width / bays;
  for (let i = 0; i <= bays; i++) B(g, [t, height, D], [-width / 2 + i * bw, height / 2, D / 2], wood);
  B(g, [width + 0.06, 0.08, D + 0.04], [0, height + 0.04, D / 2], wood);
  const rows = Math.floor((height - 0.2) / 0.38);
  const shelfY = [];
  for (let j = 0; j <= rows; j++) {
    const y = 0.1 + j * ((height - 0.15) / rows);
    shelfY.push(y);
    B(g, [width, t, D], [0, y, D / 2], wood);
  }
  const r = rng(seed);
  const colors = [0x7a2626, 0x23476e, 0x9c7a3a, 0x2f5530, 0x553a72, 0xcfc2a5, 0x8a4a22, 0x1d3445, 0xa04040, 0x3a3a3a, 0xd8c79a];
  const mats = [];
  const tmp = new THREE.Object3D();
  for (let b = 0; b < bays; b++) {
    for (let j = 0; j < rows; j++) {
      const y0 = shelfY[j] + t / 2, room = shelfY[j + 1] - shelfY[j] - t;
      let bx = -width / 2 + b * bw + t / 2 + 0.01;
      const end = -width / 2 + (b + 1) * bw - t / 2 - 0.01;
      while (bx < end - 0.03) {
        if (r() < 0.05) { bx += 0.08; continue; }
        const bwid = Math.min(0.022 + r() * 0.035, end - bx);
        const bh = Math.min(room - 0.02, room * (0.62 + r() * 0.33));
        const bd = 0.17 + r() * 0.08;
        tmp.position.set(bx + bwid / 2, y0 + bh / 2, 0.04 + bd / 2);
        tmp.rotation.set(0, 0, 0);
        tmp.scale.set(bwid, bh, bd);
        tmp.updateMatrix();
        mats.push([tmp.matrix.clone(), colors[Math.floor(r() * colors.length)] * 1]);
        bx += bwid + 0.002;
      }
    }
  }
  const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat(0xffffff, { rough: 0.75 }), mats.length);
  const c = new THREE.Color();
  mats.forEach(([m, col], i) => {
    books.setMatrixAt(i, m);
    c.setHex(col).multiplyScalar(0.75 + r() * 0.35);
    books.setColorAt(i, c);
  });
  books.castShadow = true;
  books.receiveShadow = true;
  g.add(books);
  return g;
}

// ------------------------------------------------------------------ house

export async function createHouse({ canvas, hotspotLayer, fadeEl, onSelect }) {
  try { await document.fonts.ready; } catch (e) { /* fonts are a nicety */ }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // the house is static; re-render shadows on demand

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080d);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 4000);

  // A small warm "room" baked into an environment map gives metals and
  // varnish something to reflect.
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ color: 0x2a1c14, side: THREE.BackSide })));
    const panel = (x, y, z, w, h, c) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(0, 2.9, 0, 3, 3, 0xffd9a0);
    panel(4.9, 1, 0, 2, 2, 0x9a6a40);
    panel(-4.9, 1, 1, 2, 3, 0x6a4a80);
    scene.environment = pmrem.fromScene(env, 0.04).texture;
    pmrem.dispose();
  }

  const T = {
    oak: woodTexture('#a8743f', 3),
    walnut: woodTexture('#5a3520', 5, 40),
    stair: woodTexture('#6a3e22', 9, 48),
    hallPaper: damaskTexture('#6b5236', 'rgba(255,225,180,.10)', 2),
    parlorPaper: damaskTexture('#4f2433', 'rgba(230,180,140,.12)', 4),
    libraryPaper: damaskTexture('#22382c', 'rgba(210,200,150,.10)', 6),
    studyPaint: paintTexture('#4a6075', 8),
    cream: paintTexture('#e6dcc8', 10),
    wainscot: wainscotTexture('#4b2817'),
    marble: marbleTexture(),
    brick: brickTexture(),
    concrete: noiseTexture('#77736c', 0.25, 12, 256),
    tar: noiseTexture('#34322f', 0.35, 13, 256),
    street: streetViewTexture(),
    skyline: skylineTexture(),
    glow: glowTexture()
  };

  const M = {
    oak: mat(0xffffff, { map: T.oak, rough: 0.45, env: 0.6 }),
    walnut: mat(0xffffff, { map: T.walnut, rough: 0.5, env: 0.5 }),
    stair: mat(0xffffff, { map: T.stair, rough: 0.4, env: 0.6 }),
    mahogany: mat(0x4a2414, { rough: 0.45, env: 0.6 }),
    hallPaper: mat(0xffffff, { map: T.hallPaper, rough: 0.85 }),
    parlorPaper: mat(0xffffff, { map: T.parlorPaper, rough: 0.85 }),
    libraryPaper: mat(0xffffff, { map: T.libraryPaper, rough: 0.85 }),
    studyPaint: mat(0xffffff, { map: T.studyPaint, rough: 0.9 }),
    cream: mat(0xffffff, { map: T.cream, rough: 0.8 }),
    ceiling: mat(0xefe6d6, { rough: 0.95 }),
    wainscot: mat(0xffffff, { map: T.wainscot, rough: 0.5, env: 0.5 }),
    marble: mat(0xffffff, { map: T.marble, rough: 0.2, env: 0.8 }),
    gold: mat(0xc9a24a, { rough: 0.3, metal: 0.9, env: 1.2 }),
    brass: mat(0xb08a3a, { rough: 0.35, metal: 0.85, env: 1.1 }),
    iron: mat(0x1d1d1f, { rough: 0.5, metal: 0.6, env: 0.6 }),
    black: mat(0x0b0807, { rough: 0.9 }),
    white: mat(0xf1ece2, { rough: 0.7 }),
    brick: mat(0xffffff, { map: T.brick, rough: 0.95 }),
    concrete: mat(0xffffff, { map: T.concrete, rough: 0.95 }),
    tar: mat(0xffffff, { map: T.tar, rough: 1 }),
    velvet: mat(0x6e1d22, { rough: 0.95 }),
    teal: mat(0x2c5a5e, { rough: 0.95 }),
    leather: mat(0x7a2a1e, { rough: 0.55, env: 0.6 }),
    hidden: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  };

  const areas = {
    main: new THREE.Group(),
    basement: new THREE.Group(),
    roof: new THREE.Group()
  };
  Object.values(areas).forEach((g) => scene.add(g));
  areas.basement.position.y = BASEMENT_Y;
  areas.roof.position.y = ROOF_Y;

  const animated = { flames: [], fireLight: null, leds: [], bulbs: [] };
  const doors = {};

  buildMain(areas.main);
  buildBasement(areas.basement);
  buildRoof(areas.roof);

  // ---------------------------------------------------------------- main floor

  function buildMain(g) {
    const H = 3.6;

    g.add(new THREE.HemisphereLight(0xffe2c0, 0x2a1408, 0.35));

    // floor + ceilings
    slab(g, -7.5, 6.5, -0.06, 0, 0.8, -10.2, M.oak, { tile: 1.2, cast: false });
    slab(g, -1.1, 0.1, H, H + 0.15, 0.6, -10, M.ceiling, { cast: false });
    slab(g, 0.1, 1.1, H, H + 0.15, 0.6, -2.6, M.ceiling, { cast: false });
    slab(g, 0.1, 1.1, H, H + 0.15, -6.6, -10, M.ceiling, { cast: false });
    slab(g, -7.3, -1.3, H, H + 0.15, 0.6, -5.6, M.ceiling, { cast: false });
    slab(g, -7.3, -1.3, H, H + 0.15, -5.8, -10, M.ceiling, { cast: false });
    slab(g, 1.3, 6.3, H, H + 0.15, -7.4, -10, M.ceiling, { cast: false });

    // ---- hall walls. Face order: [+x, -x, +y, -y, +z, -z]
    const hallL = (room) => [M.hallPaper, room, M.mahogany, M.mahogany, M.mahogany, M.mahogany];
    slab(g, -1.3, -1.1, 0, H, 0.8, -1.3, hallL(M.parlorPaper));
    slab(g, -1.3, -1.1, 3.0, H, -1.3, -3.5, hallL(M.parlorPaper));
    slab(g, -1.3, -1.1, 0, H, -3.5, -5.7, hallL(M.parlorPaper));
    slab(g, -1.3, -1.1, 0, H, -5.7, -6.0, hallL(M.libraryPaper));
    slab(g, -1.3, -1.1, 3.0, H, -6.0, -7.8, hallL(M.libraryPaper));
    slab(g, -1.3, -1.1, 0, H, -7.8, -10.2, hallL(M.libraryPaper));

    const hallR = (room) => [room, M.hallPaper, M.mahogany, M.mahogany, M.mahogany, M.mahogany];
    slab(g, 1.1, 1.3, 0, 7.2, 0.8, -7.4, hallR(M.hallPaper));
    slab(g, 1.1, 1.3, 0, 7.2, -7.4, -8.0, hallR(M.studyPaint));
    slab(g, 1.1, 1.3, 2.4, 7.2, -8.0, -9.0, hallR(M.studyPaint));
    slab(g, 1.1, 1.3, 0, 7.2, -9.0, -10.2, hallR(M.studyPaint));

    // front wall with the door we came through
    const front = [M.hallPaper, M.hallPaper, M.mahogany, M.mahogany, M.hallPaper, M.hallPaper];
    slab(g, -1.3, -0.6, 0, H, 0.6, 0.8, front);
    slab(g, 0.6, 1.3, 0, H, 0.6, 0.8, front);
    slab(g, -0.6, 0.6, 2.7, H, 0.6, 0.8, front);
    slab(g, -0.58, 0, 0, 2.68, 0.56, 0.62, M.mahogany);
    slab(g, 0, 0.58, 0, 2.68, 0.56, 0.62, M.mahogany);
    plane(g, 0.36, 0.9, [-0.29, 1.85, 0.555], Math.PI, basic(0x2a3050));
    plane(g, 0.36, 0.9, [0.29, 1.85, 0.555], Math.PI, basic(0x2a3050));
    plane(g, 1.1, 0.5, [0, 3.05, 0.65], Math.PI, basic(0xffcf88, { toneMapped: false }));
    B(g, [0.05, 0.05, 0.05], [-0.06, 1.1, 0.53], M.brass);
    B(g, [0.05, 0.05, 0.05], [0.06, 1.1, 0.53], M.brass);

    // back wall with a glazed garden door
    const back = [M.hallPaper, M.hallPaper, M.mahogany, M.mahogany, M.hallPaper, M.hallPaper];
    slab(g, -1.3, -0.5, 0, H, -10.2, -10.0, back);
    slab(g, 0.5, 1.3, 0, H, -10.2, -10.0, back);
    slab(g, -0.5, 0.5, 2.5, H, -10.2, -10.0, back);
    plane(g, 1.0, 2.5, [0, 1.25, -10.1], 0, basic(0x0c1a26));
    slab(g, -0.5, 0.5, 1.2, 1.26, -10.1, -10.05, M.mahogany);
    slab(g, -0.03, 0.03, 0, 2.5, -10.1, -10.05, M.mahogany);

    // wainscot + chair rail
    const wain = (x0, x1, z0, z1) => {
      slab(g, x0, x1, 0, 1.0, z0, z1, M.wainscot, { tu: 0.8, tv: 1.0, cast: false });
    };
    wain(-1.1, -1.08, 0.6, -1.3); wain(-1.1, -1.08, -3.5, -6.0); wain(-1.1, -1.08, -7.8, -10);
    wain(1.08, 1.1, 0.6, -1.6); wain(1.08, 1.1, -6.6, -8.0); wain(1.08, 1.1, -9.0, -10);
    [[-1.1, -1.06, 0.6, -1.3], [-1.1, -1.06, -3.5, -6.0], [-1.1, -1.06, -7.8, -10], [1.06, 1.1, 0.6, -1.6], [1.06, 1.1, -6.6, -8.0], [1.06, 1.1, -9.0, -10]]
      .forEach(([a, b, c, d]) => slab(g, a, b, 1.0, 1.05, c, d, M.mahogany, { cast: false }));

    // crown moulding
    slab(g, -1.1, -0.98, H - 0.14, H, 0.6, -10, M.white, { cast: false });
    slab(g, 0.98, 1.1, H - 0.14, H, 0.6, -2.6, M.white, { cast: false });
    slab(g, 0.98, 1.1, H - 0.14, H, -6.6, -10, M.white, { cast: false });

    // casings around the openings (hall side and room side)
    const casing = (x0, x1, z0, z1, top) => {
      slab(g, x0, x1, 0, top + 0.16, z0 + 0.16, z0, M.mahogany);
      slab(g, x0, x1, 0, top + 0.16, z1, z1 - 0.16, M.mahogany);
      slab(g, x0, x1, top, top + 0.16, z0 + 0.16, z1 - 0.16, M.mahogany);
    };
    casing(-1.1, -1.05, -1.3, -3.5, 3.0); casing(-1.35, -1.3, -1.3, -3.5, 3.0);
    casing(-1.1, -1.05, -6.0, -7.8, 3.0); casing(-1.35, -1.3, -6.0, -7.8, 3.0);
    casing(1.05, 1.1, -8.0, -9.0, 2.4); casing(1.3, 1.35, -8.0, -9.0, 2.4);

    // study door, swung open into the study
    const sd = group(g, 1.22, 0, -8.02, -1.7);
    B(sd, [0.05, 2.38, 0.96], [0, 1.19, -0.48], M.mahogany);
    B(sd, [0.07, 0.8, 0.7], [0, 1.75, -0.48], mat(0x5a2c18, { rough: 0.5 }));
    B(sd, [0.07, 0.8, 0.7], [0, 0.65, -0.48], mat(0x5a2c18, { rough: 0.5 }));
    cyl(sd, 0.03, 0.03, 0.14, [0, 1.05, -0.88], M.brass, { rot: [0, 0, Math.PI / 2] });

    // runner
    const runner = slab(g, -0.88, -0.12, 0, 0.012, 0.25, -9.6, mat(0xffffff, { map: rugTexture('#6e1f1f', '#1f2a44', '#c9a24a', 3), rough: 0.95 }), { cast: false });
    runner.geometry = new THREE.BoxGeometry(0.76, 0.012, 9.85);

    // ---- staircase along the right wall, rising toward -z
    const stairs = new THREE.Group();
    g.add(stairs);
    const RISE = 0.2, RUN = 0.27, N = 18, Z0 = -1.6;
    const stepMats = [M.cream, M.cream, M.cream, M.cream, M.cream, M.cream];
    for (let i = 0; i < N; i++) {
      const zf = Z0 - i * RUN, top = (i + 1) * RISE;
      slab(stairs, 0.1, 1.1, 0, top, zf, zf - RUN, stepMats);
      slab(stairs, 0.08, 1.1, top - 0.035, top, zf + 0.03, zf - RUN, M.stair, { tile: 0.8 });
    }
    // stringer
    const len = Math.hypot(N * RUN, N * RISE), ang = Math.atan2(N * RISE, N * RUN);
    const stringer = B(stairs, [0.05, 0.3, len], [0.075, N * RISE / 2 + 0.05, Z0 - N * RUN / 2], M.mahogany);
    stringer.rotation.x = ang;
    // handrail + balusters + newel
    const railLen = Math.hypot((N - 1) * RUN, (N - 1) * RISE);
    const rail = B(stairs, [0.07, 0.07, railLen + 0.1], [0.15, 0.2 + 0.92 + (N - 1) * RISE / 2, Z0 - (N - 1) * RUN / 2], M.mahogany);
    rail.rotation.x = ang;
    const balGeo = new THREE.CylinderGeometry(0.016, 0.02, 1, 10);
    for (let i = 0; i < N; i++) {
      const top = (i + 1) * RISE;
      for (let k = 0; k < 2; k++) {
        const z = Z0 - i * RUN - 0.07 - k * 0.13;
        const railY = 0.2 + 0.92 + ((Z0 - z) / RUN) * RISE - 0.04;
        const h = railY - top;
        const b = new THREE.Mesh(balGeo, M.white);
        b.scale.y = h;
        b.position.set(0.15, top + h / 2, z);
        b.castShadow = true;
        stairs.add(b);
      }
    }
    B(stairs, [0.16, 1.2, 0.16], [0.15, 0.6, -1.45], M.mahogany);
    B(stairs, [0.2, 0.06, 0.2], [0.15, 1.23, -1.45], M.mahogany);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), M.mahogany);
    knob.position.set(0.15, 1.32, -1.45);
    stairs.add(knob);
    stairs.traverse((o) => { if (o.isMesh) { o.userData.room = 'projects'; } });

    // stairwell above the opening
    slab(g, -0.1, 0.1, H, 7.2, -2.6, -6.6, M.hallPaper);
    slab(g, -0.1, 1.1, H, 7.2, -6.6, -6.8, M.hallPaper);
    slab(g, -0.1, 1.1, 7.2, 7.3, -2.6, -6.8, M.ceiling, { cast: false });
    pointLight(g, 0xffc98a, 2.5, [0.6, 6.6, -5.2]);

    // door under the stairs, down to the workshop
    plane(g, 0.78, 1.98, [0.098, 0.99, -5.4], -Math.PI / 2, basic(0x050403));
    // hinged on the far side so it swings open away from the approaching camera
    const bd = group(g, 0.08, 0, -5.79, 0);
    B(bd, [0.04, 1.96, 0.78], [0, 0.98, 0.39], M.mahogany);
    B(bd, [0.05, 0.7, 0.55], [-0.01, 1.4, 0.39], mat(0x5a2c18, { rough: 0.5 }));
    B(bd, [0.05, 0.7, 0.55], [-0.01, 0.5, 0.39], mat(0x5a2c18, { rough: 0.5 }));
    cyl(bd, 0.025, 0.025, 0.1, [-0.05, 1.0, 0.7], M.brass, { rot: [0, 0, Math.PI / 2] });
    bd.traverse((o) => { if (o.isMesh) { o.userData.room = 'skills'; } });
    doors.basement = bd;
    slab(g, 0.06, 0.1, 1.98, 2.08, -4.95, -5.85, M.mahogany);
    slab(g, 0.06, 0.1, 0, 2.08, -4.95, -5.01, M.mahogany);
    slab(g, 0.06, 0.1, 0, 2.08, -5.79, -5.85, M.mahogany);

    // invisible click targets for the open doorways
    [['about', -1.3, -1.1, 3.0, -1.3, -3.5], ['education', -1.3, -1.1, 3.0, -6.0, -7.8], ['experience', 1.1, 1.3, 2.4, -8.0, -9.0]].forEach(([id, x0, x1, top, z0, z1]) => {
      const m = slab(g, x0, x1, 0, top, z0, z1, M.hidden, { cast: false, receive: false });
      m.userData.room = id;
    });

    // hall lanterns
    [[-0.5, -1.4, true], [-0.5, -8.4, false]].forEach(([x, z, sh]) => {
      cyl(g, 0.008, 0.008, 0.5, [x, H - 0.25, z], M.iron, { cast: false });
      cyl(g, 0.11, 0.08, 0.32, [x, H - 0.66, z], new THREE.MeshStandardMaterial({ color: 0xffe6b0, emissive: 0xffc070, emissiveIntensity: 1.4, transparent: true, opacity: 0.9 }), { cast: false });
      cyl(g, 0.13, 0.13, 0.04, [x, H - 0.5, z], M.brass, { cast: false });
      pointLight(g, 0xffc27a, 5, [x, H - 0.85, z], sh);
    });
    cyl(g, 0.22, 0.22, 0.03, [-0.5, H - 0.015, -1.4], M.white, { cast: false });

    // console table + mirror between the doorways
    const ct = group(g, -1.08, 0, -4.75, Math.PI / 2);
    B(ct, [1.0, 0.04, 0.34], [0, 0.82, 0.2], M.walnut);
    [[-0.45, 0.06], [0.45, 0.06], [-0.45, 0.34], [0.45, 0.34]].forEach(([x, z]) => B(ct, [0.04, 0.8, 0.04], [x, 0.4, z], M.walnut));
    makeFrame(ct, [0, 1.75, 0.03], 0, 0.8, 1.05, mat(0x404850, { rough: 0.05, metal: 1, env: 1.5 }), M.gold, 0.05);
    cyl(ct, 0.06, 0.05, 0.26, [0.3, 0.97, 0.2], mat(0x2a4a6a, { rough: 0.2, env: 1 }));
    makePlant(ct, -0.3, 0.84, 0.2, 0.45, 5);
    makePlant(g, -0.75, 0, -9.6, 0.9, 9);

    // stair-wall art
    makeFrame(g, [1.08, 2.4, -2.9], -Math.PI / 2, 0.55, 0.45, mat(0xffffff, { map: paintingTexture(1) }), M.gold);
    makeFrame(g, [1.08, 3.2, -4.4], -Math.PI / 2, 0.6, 0.5, mat(0xffffff, { map: paintingTexture(2) }), M.gold);
    makeFrame(g, [-1.08, 2.1, -9.0], Math.PI / 2, 0.55, 0.7, mat(0xffffff, { map: paintingTexture(3) }), M.gold);

    // radiator near the door
    const rad = group(g, -1.0, 0, -0.2, 0);
    for (let i = 0; i < 10; i++) B(rad, [0.12, 0.7, 0.05], [0, 0.45, 0.25 - i * 0.06], mat(0xd8d2c4, { rough: 0.4, env: 0.6 }));

    buildParlor(g);
    buildLibrary(g);
    buildStudy(g);
  }

  function buildParlor(g) {
    const H = 3.6;
    const paper = [M.parlorPaper, M.parlorPaper, M.mahogany, M.mahogany, M.parlorPaper, M.parlorPaper];
    // far wall + chimney breast with the fireplace opening
    slab(g, -7.5, -7.3, 0, H, 0.8, -5.8, paper);
    slab(g, -7.3, -6.9, 0, H, -3.4, -2.8, paper);
    slab(g, -7.3, -6.9, 0, H, -2.0, -1.4, paper);
    slab(g, -7.3, -6.9, 0.95, H, -2.8, -2.0, paper);
    slab(g, -7.3, -7.26, 0, 0.95, -2.8, -2.0, M.black);
    slab(g, -7.3, -6.9, 0, 0.95, -2.8, -2.76, M.black, { cast: false });
    slab(g, -7.3, -6.9, 0, 0.95, -2.04, -2.0, M.black, { cast: false });
    slab(g, -7.3, -6.9, 0.91, 0.95, -2.8, -2.0, M.black, { cast: false });
    // marble surround + mantel + hearth
    slab(g, -6.9, -6.84, 0, 1.3, -3.15, -2.8, M.marble);
    slab(g, -6.9, -6.84, 0, 1.3, -2.0, -1.65, M.marble);
    slab(g, -6.9, -6.84, 0.95, 1.3, -2.8, -2.0, M.marble);
    slab(g, -6.96, -6.7, 1.3, 1.38, -3.28, -1.52, M.marble);
    slab(g, -6.9, -6.35, 0, 0.03, -3.15, -1.65, mat(0x2a2624, { rough: 0.3, env: 0.8 }));
    // fire
    cyl(g, 0.05, 0.05, 0.6, [-7.05, 0.1, -2.4], mat(0x2a160c), { rot: [Math.PI / 2, 0, 0.2] });
    cyl(g, 0.045, 0.045, 0.55, [-7.1, 0.15, -2.4], mat(0x2a160c), { rot: [Math.PI / 2, 0.4, 0] });
    const flameGeo = new THREE.ConeGeometry(1, 1, 14, 1, true);
    [[0xff7a1a, 0.16, 0.5, -2.5], [0xffa437, 0.13, 0.42, -2.3], [0xffd36b, 0.08, 0.28, -2.42], [0xff8a2a, 0.1, 0.34, -2.62], [0xffb347, 0.09, 0.3, -2.18]].forEach(([c, r, h, z], i) => {
      const f = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      f.position.set(-7.06, 0.18 + h / 2, z);
      f.scale.set(r, h, r);
      f.userData = { h, r, phase: i * 1.7 };
      g.add(f);
      animated.flames.push(f);
    });
    animated.fireLight = pointLight(g, 0xff7a2a, 3.2, [-6.75, 0.5, -2.4]);

    // portrait over the mantel
    const portrait = new THREE.TextureLoader().load('img/profile.png');
    portrait.colorSpace = THREE.SRGBColorSpace;
    makeFrame(g, [-6.88, 2.25, -2.4], Math.PI / 2, 0.9, 0.95, mat(0xffffff, { map: portrait, rough: 0.6 }), M.gold, 0.06);
    [-3.0, -1.8].forEach((z) => {
      B(g, [0.06, 0.2, 0.06], [-6.86, 2.3, z], M.brass);
      makeLampShade(g, [-6.78, 2.48, z], 0.04, 0.07, 0.12, 0xf3e1b8);
    });

    // front windows onto the street
    const front = [M.parlorPaper, M.parlorPaper, M.mahogany, M.mahogany, M.parlorPaper, M.parlorPaper];
    slab(g, -7.5, -6.1, 0, H, 0.6, 0.8, front);
    slab(g, -5.0, -3.6, 0, H, 0.6, 0.8, front);
    slab(g, -2.5, -1.3, 0, H, 0.6, 0.8, front);
    [-5.55, -3.05].forEach((cx) => {
      slab(g, cx - 0.55, cx + 0.55, 0, 0.55, 0.6, 0.8, front);
      slab(g, cx - 0.55, cx + 0.55, 3.1, H, 0.6, 0.8, front);
      plane(g, 1.1, 2.55, [cx, 1.825, 0.72], Math.PI, basic(0xffffff, { map: T.street }));
      slab(g, cx - 0.03, cx + 0.03, 0.55, 3.1, 0.64, 0.68, M.white);
      slab(g, cx - 0.55, cx + 0.55, 1.8, 1.86, 0.64, 0.68, M.white);
      slab(g, cx - 0.65, cx + 0.65, 0.5, 0.56, 0.5, 0.7, M.white);
      cyl(g, 0.02, 0.02, 1.7, [cx, 3.3, 0.48], M.brass, { rot: [0, 0, Math.PI / 2], cast: false });
      [-1, 1].forEach((s) => {
        const c = group(g, cx + s * 0.62, 0, 0.45);
        for (let k = 0; k < 4; k++) cyl(c, 0.06, 0.07, 3.28, [s * (k * 0.07 - 0.1), 1.64, (k % 2) * 0.03], M.velvet, { seg: 10 });
      });
    });
    // shared wall with the library
    slab(g, -7.3, -1.3, 0, H, -5.6, -5.8, [M.parlorPaper, M.parlorPaper, M.mahogany, M.mahogany, M.parlorPaper, M.libraryPaper]);

    // baseboards + picture rail
    [[-7.3, -7.26, 0.6, -5.6], [-7.3, -1.3, -5.56, -5.6], [-7.3, -1.3, 0.56, 0.6]].forEach(([a, b, c, d]) => slab(g, a, b, 0, 0.2, c, d, M.white, { cast: false }));
    slab(g, -7.3, -7.27, 2.95, 3.0, 0.6, -5.6, M.gold, { cast: false });
    slab(g, -7.3, -1.3, H - 0.16, H, -5.46, -5.6, M.white, { cast: false });
    slab(g, -7.3, -1.3, H - 0.16, H, 0.46, 0.6, M.white, { cast: false });

    // rug, sofa, armchairs, coffee table
    const rug = slab(g, -6.3, -2.4, 0, 0.012, -0.8, -4.4, mat(0xffffff, { map: rugTexture('#7a2a2a', '#20263d', '#d1a95a', 8), rough: 0.95 }), { cast: false });
    rug.geometry = new THREE.BoxGeometry(3.9, 0.012, 3.6);
    rug.rotation.y = Math.PI / 2;
    makeSofa(g, -4.4, -5.05, 0, 2.0, M.teal, M.walnut);
    makeArmchair(g, -5.8, -0.6, Math.PI * 0.85, M.velvet, M.walnut);
    makeArmchair(g, -3.0, -0.6, -Math.PI * 0.85, M.velvet, M.walnut);
    const tbl = group(g, -4.4, 0, -2.6);
    B(tbl, [1.1, 0.05, 0.6], [0, 0.44, 0], M.walnut);
    [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([x, z]) => B(tbl, [0.05, 0.42, 0.05], [x, 0.21, z], M.walnut));
    B(tbl, [0.32, 0.05, 0.24], [-0.2, 0.49, 0.05], mat(0x2d5b8a, { rough: 0.6 }));
    B(tbl, [0.28, 0.04, 0.22], [-0.21, 0.535, 0.05], mat(0x8a2f2f, { rough: 0.6 }), { rot: [0, 0.2, 0] });
    cyl(tbl, 0.06, 0.05, 0.1, [0.25, 0.52, -0.05], M.white);
    makePlant(g, -6.85, 0, -5.15, 1.6, 2);
    makePlant(g, -1.75, 0, 0.2, 1.1, 4);

    // side table + lamp by the sofa
    const st = group(g, -2.85, 0, -5.2);
    B(st, [0.45, 0.04, 0.45], [0, 0.6, 0], M.walnut);
    B(st, [0.05, 0.58, 0.05], [0, 0.3, 0], M.walnut);
    cyl(st, 0.07, 0.1, 0.32, [0, 0.78, 0], mat(0x2a4a6a, { rough: 0.3, env: 1 }));
    makeLampShade(st, [0, 1.06, 0], 0.13, 0.2, 0.24, 0xf3e1b8);
    pointLight(g, 0xffc27a, 2.2, [-2.85, 1.05, -5.2]);

    // art above the sofa
    makeFrame(g, [-4.4, 2.2, -5.55], 0, 1.2, 0.8, mat(0xffffff, { map: paintingTexture(4) }), M.gold);

    // chandelier
    const ch = group(g, -4.3, 0, -2.6);
    cyl(ch, 0.012, 0.012, 0.55, [0, H - 0.28, 0], M.gold, { cast: false });
    cyl(ch, 0.12, 0.05, 0.16, [0, H - 0.62, 0], M.gold, { cast: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.015, 8, 40), M.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = H - 0.75;
    ch.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      cyl(ch, 0.014, 0.014, 0.1, [Math.cos(a) * 0.38, H - 0.69, Math.sin(a) * 0.38], M.white, { cast: false });
      bulb(ch, [Math.cos(a) * 0.38, H - 0.62, Math.sin(a) * 0.38], 0.025);
    }
    cyl(g, 0.3, 0.3, 0.03, [-4.3, H - 0.015, -2.6], M.white, { cast: false });
    pointLight(g, 0xffcf8a, 9, [-4.3, H - 0.95, -2.6], true);
  }

  function buildLibrary(g) {
    const H = 3.6;
    const paper = [M.libraryPaper, M.libraryPaper, M.mahogany, M.mahogany, M.libraryPaper, M.libraryPaper];
    slab(g, -7.5, -7.3, 0, H, -5.8, -10.2, paper);
    slab(g, -7.5, -1.3, 0, H, -10.2, -10.0, paper);
    slab(g, -7.3, -1.3, H - 0.16, H, -9.86, -10.0, M.white, { cast: false });

    bookcase(g, -7.3, -7.9, Math.PI / 2, 3.9, 3.3, 7, M.walnut);
    bookcase(g, -5.5, -10.0, 0, 3.4, 3.3, 21, M.walnut);
    // rolling ladder
    const lad = group(g, -6.75, 0, -7.2, 0);
    lad.rotation.z = -0.2;
    B(lad, [0.04, 3.2, 0.04], [0, 1.6, -0.22], M.walnut);
    B(lad, [0.04, 3.2, 0.04], [0, 1.6, 0.22], M.walnut);
    for (let i = 0; i < 10; i++) B(lad, [0.04, 0.03, 0.44], [0, 0.3 + i * 0.3, 0], M.walnut);

    // writing desk with the diploma above it
    const dk = group(g, -2.6, 0, -9.7);
    B(dk, [1.4, 0.05, 0.6], [0, 0.76, 0], M.walnut);
    B(dk, [0.4, 0.74, 0.56], [-0.48, 0.37, 0], M.walnut);
    B(dk, [0.05, 0.74, 0.56], [0.66, 0.37, 0], M.walnut);
    B(dk, [0.34, 0.05, 0.24], [0.1, 0.8, 0.05], mat(0x2f5530, { rough: 0.6 }), { rot: [0, 0.3, 0] });
    cyl(dk, 0.01, 0.06, 0.03, [-0.45, 0.8, -0.05], M.brass);
    cyl(dk, 0.008, 0.008, 0.36, [-0.45, 0.98, -0.05], M.brass);
    const dshade = makeLampShade(dk, [-0.45, 1.18, 0.02], 0.05, 0.11, 0.1, 0x2f6a3a);
    dshade.material.emissive.setHex(0x3a8a4a);
    dshade.material.emissiveIntensity = 0.4;
    pointLight(g, 0xffd28a, 1.6, [-3.05, 1.0, -9.6]);
    makeFrame(g, [-2.6, 2.0, -9.98], 0, 0.9, 0.7, mat(0xffffff, { map: diplomaTexture(), rough: 0.7 }), M.gold, 0.05);

    // reading chair + floor lamp + globe
    makeArmchair(g, -4.8, -7.3, Math.PI / 2 + 0.5, M.leather, M.walnut);
    cyl(g, 0.18, 0.2, 0.03, [-4.6, 0.015, -8.3], M.brass);
    cyl(g, 0.015, 0.015, 1.5, [-4.6, 0.77, -8.3], M.brass);
    makeLampShade(g, [-4.6, 1.6, -8.3], 0.14, 0.24, 0.28, 0xf3e1b8);
    pointLight(g, 0xffc983, 5, [-4.6, 1.45, -8.3], true);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), mat(0x5d7f8f, { rough: 0.4, env: 0.8 }));
    globe.position.set(-6.3, 1.02, -6.35);
    g.add(globe);
    cyl(g, 0.03, 0.12, 0.8, [-6.3, 0.4, -6.35], M.walnut);
    const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.01, 6, 32), M.brass);
    meridian.position.copy(globe.position);
    g.add(meridian);
    const rug = slab(g, -6.4, -2.6, 0, 0.012, -6.3, -9.4, mat(0xffffff, { map: rugTexture('#1e3a2e', '#5a2020', '#c9a24a', 12), rough: 0.95 }), { cast: false });
    rug.geometry = new THREE.BoxGeometry(3.1, 0.012, 3.8);
    rug.rotation.y = Math.PI / 2;
    cyl(g, 0.25, 0.25, 0.03, [-4.3, H - 0.015, -7.9], M.white, { cast: false });
    pointLight(g, 0xffd9a0, 1.5, [-4.3, H - 0.4, -7.9]);
  }

  function buildStudy(g) {
    const H = 3.6;
    const paint = [M.studyPaint, M.studyPaint, M.mahogany, M.mahogany, M.studyPaint, M.studyPaint];
    slab(g, 1.3, 6.5, 0, H, -7.4, -7.2, paint);
    slab(g, 6.3, 6.5, 0, H, -7.2, -10.2, paint);
    slab(g, 1.3, 3.9, 0, H, -10.2, -10.0, paint);
    slab(g, 5.1, 6.5, 0, H, -10.2, -10.0, paint);
    slab(g, 3.9, 5.1, 0, 0.9, -10.2, -10.0, paint);
    slab(g, 3.9, 5.1, 2.8, H, -10.2, -10.0, paint);
    plane(g, 1.2, 1.9, [4.5, 1.85, -10.1], 0, basic(0xffffff, { map: T.skyline }));
    slab(g, 4.47, 4.53, 0.9, 2.8, -10.08, -10.04, M.white);
    slab(g, 3.9, 5.1, 1.82, 1.88, -10.08, -10.04, M.white);
    slab(g, 3.8, 5.2, 0.86, 0.92, -10.1, -9.92, M.white);
    [[1.3, 6.3, -7.4, -7.44], [1.3, 6.3, -9.96, -10.0], [6.26, 6.3, -7.4, -10]].forEach(([a, b, c, d]) => slab(g, a, b, 0, 0.18, c, d, M.white, { cast: false }));
    slab(g, 1.3, 6.3, H - 0.14, H, -7.4, -7.52, M.white, { cast: false });
    slab(g, 6.18, 6.3, H - 0.14, H, -7.4, -10, M.white, { cast: false });

    // desk against the far wall
    const dk = group(g, 5.95, 0, -8.7, -Math.PI / 2);
    B(dk, [1.6, 0.05, 0.7], [0, 0.76, 0], M.walnut);
    B(dk, [0.45, 0.73, 0.66], [0.55, 0.365, 0], M.walnut);
    B(dk, [0.05, 0.73, 0.66], [-0.76, 0.365, 0], M.walnut);
    [0.2, 0.45, 0.65].forEach((y) => B(dk, [0.38, 0.015, 0.01], [0.55, y, 0.335], mat(0x2a180d)));
    // monitor
    B(dk, [0.95, 0.56, 0.035], [0, 1.2, -0.18], mat(0x111214, { rough: 0.3 }));
    const screen = plane(dk, 0.91, 0.52, [0, 1.2, -0.16], 0, basic(0xffffff, { map: codeTexture(), toneMapped: false }));
    screen.material.color.setScalar(0.85);
    B(dk, [0.06, 0.3, 0.06], [0, 0.93, -0.2], mat(0x222222));
    B(dk, [0.3, 0.015, 0.2], [0, 0.79, -0.2], mat(0x222222));
    B(dk, [0.46, 0.02, 0.15], [-0.02, 0.795, 0.12], mat(0x2b2d31, { rough: 0.5 }));
    B(dk, [0.07, 0.02, 0.1], [0.32, 0.795, 0.13], mat(0x2b2d31, { rough: 0.5 }));
    cyl(dk, 0.045, 0.04, 0.1, [-0.6, 0.83, 0.05], M.white);
    pointLight(g, 0x9fc0ff, 1.2, [5.6, 1.25, -8.7]);
    // desk lamp
    cyl(dk, 0.07, 0.08, 0.02, [0.6, 0.79, -0.15], M.iron);
    B(dk, [0.02, 0.4, 0.02], [0.6, 0.98, -0.15], M.iron, { rot: [0, 0, 0.3] });
    const ls = makeLampShade(dk, [0.5, 1.2, -0.05], 0.03, 0.09, 0.12, 0x1b4d3a);
    ls.rotation.x = 0.6;
    pointLight(g, 0xffd28a, 2.5, [5.75, 1.1, -9.25]);

    // office chair
    const oc = group(g, 5.05, 0, -8.6, -Math.PI / 2 + 0.25);
    const fabric = mat(0x1f2a36, { rough: 0.85 });
    B(oc, [0.5, 0.08, 0.48], [0, 0.48, 0], fabric);
    B(oc, [0.46, 0.6, 0.07], [0, 0.85, 0.24], fabric, { rot: [-0.12, 0, 0] });
    cyl(oc, 0.025, 0.025, 0.36, [0, 0.27, 0], M.iron);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      B(oc, [0.3, 0.03, 0.04], [Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15], M.iron, { rot: [0, -a, 0] });
    }

    // "career wall" of framed places
    const jobs = [['NYC DOHMH', '2017 – present', '#f1ebe0', '#2a3a4a'], ['NYC H+H', '2016', '#2a3a4a', '#f1ebe0'], ['ECS', '2015', '#c9a24a', '#1d1d1d']];
    jobs.forEach(([t, s, bg, fg], i) => {
      makeFrame(g, [2.6 + i * 1.05, 1.9 + (i % 2) * 0.15, -7.42], Math.PI, 0.7, 0.55, mat(0xffffff, { map: captionTexture(t, s, bg, fg), rough: 0.7 }), mat(0x111111, { rough: 0.4 }));
    });

    // filing cabinet + bookshelf + plant
    const fc = group(g, 3.2, 0, -9.7);
    B(fc, [0.5, 1.3, 0.55], [0, 0.65, 0], mat(0x6f7882, { rough: 0.35, metal: 0.4 }));
    [0.3, 0.72, 1.12].forEach((y) => B(fc, [0.2, 0.03, 0.02], [0, y, 0.285], M.iron));
    makePlant(fc, 0, 1.3, 0, 0.6, 11);
    bookcase(g, 1.95, -9.98, 0, 1.0, 2.2, 33, M.walnut);
    const rug = slab(g, 2.6, 5.4, 0, 0.012, -7.8, -9.7, mat(0xffffff, { map: rugTexture('#28394a', '#a8854a', '#e8dcc0', 15), rough: 0.95 }), { cast: false });
    rug.geometry = new THREE.BoxGeometry(1.9, 0.012, 2.8);
    rug.rotation.y = Math.PI / 2;

    // ceiling pendant
    cyl(g, 0.006, 0.006, 0.7, [3.8, H - 0.35, -8.7], M.iron, { cast: false });
    cyl(g, 0.05, 0.25, 0.18, [3.8, H - 0.79, -8.7], mat(0x1d1d1f, { rough: 0.4, metal: 0.5, side: THREE.DoubleSide }), { open: true, cast: false });
    bulb(g, [3.8, H - 0.86, -8.7], 0.05);
    pointLight(g, 0xffd09a, 8, [3.8, H - 1.0, -8.7], true);
  }

  // ---------------------------------------------------------------- basement

  function buildBasement(g) {
    const H = 2.7;
    g.add(new THREE.HemisphereLight(0xffe0b8, 0x1a120a, 0.3));
    slab(g, -3.2, 3.2, -0.1, 0, 0.4, -7.2, M.concrete, { tile: 2, cast: false });
    slab(g, -3.2, -3.0, 0, H, 0.4, -7.2, M.brick, { tile: 1.2 });
    slab(g, 3.0, 3.2, 0, H, 0.4, -7.2, M.brick, { tile: 1.2 });
    slab(g, -3.2, 3.2, 0, H, -7.2, -7.0, M.brick, { tile: 1.2 });
    slab(g, -3.2, 3.2, 0, H, 0.4, 0.6, M.brick, { tile: 1.2 });
    slab(g, -3.2, 3.2, H, H + 0.1, 0.6, -7.2, mat(0x3a2a1c, { rough: 0.9 }), { cast: false });
    for (let z = 0.2; z > -7; z -= 0.45) slab(g, -3, 3, H - 0.2, H, z, z - 0.07, mat(0x5a3e24, { rough: 0.85 }));
    cyl(g, 0.05, 0.05, 6.0, [-2.6, H - 0.35, -3.3], mat(0x8a5a30, { rough: 0.35, metal: 0.8, env: 1 }), { rot: [Math.PI / 2, 0, 0] });
    cyl(g, 0.035, 0.035, 6.0, [-2.4, H - 0.32, -3.3], M.iron, { rot: [Math.PI / 2, 0, 0] });

    // pegboard + tools
    const pb = mat(0xffffff, { map: pegboardTexture(), rough: 0.9 });
    slab(g, -2.7, -0.2, 1.15, 2.25, -6.99, -6.96, pb, { tu: 0.4, tv: 0.4 });
    const tool = mat(0x3b3f46, { rough: 0.4, metal: 0.7, env: 1 });
    const handle = mat(0xb03a2a, { rough: 0.6 });
    B(g, [0.04, 0.4, 0.02], [-2.4, 1.6, -6.94], tool); B(g, [0.12, 0.08, 0.02], [-2.4, 1.82, -6.94], tool);
    B(g, [0.035, 0.36, 0.025], [-2.1, 1.55, -6.94], mat(0x8a5a30)); B(g, [0.16, 0.06, 0.03], [-2.1, 1.75, -6.94], tool);
    B(g, [0.025, 0.2, 0.02], [-1.8, 1.7, -6.94], tool); B(g, [0.04, 0.14, 0.03], [-1.8, 1.53, -6.94], handle);
    B(g, [0.5, 0.18, 0.01], [-1.3, 1.8, -6.945], mat(0xb8bcc2, { rough: 0.3, metal: 0.9, env: 1 })); B(g, [0.12, 0.14, 0.03], [-1.0, 1.8, -6.94], mat(0x6a3a1a));
    B(g, [0.025, 0.24, 0.02], [-0.6, 1.62, -6.94], tool); B(g, [0.025, 0.24, 0.02], [-0.5, 1.62, -6.94], tool, { rot: [0, 0, 0.3] });
    const wrench = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16, Math.PI * 1.5), tool);
    wrench.position.set(-0.6, 1.92, -6.94);
    g.add(wrench);

    // workbench
    const wb = group(g, -1.45, 0, -6.6);
    B(wb, [2.6, 0.08, 0.75], [0, 0.9, 0], mat(0x9a6a38, { rough: 0.7 }));
    [[-1.2, -0.3], [1.2, -0.3], [-1.2, 0.3], [1.2, 0.3]].forEach(([x, z]) => B(wb, [0.08, 0.86, 0.08], [x, 0.43, z], mat(0x6b4422)));
    B(wb, [2.4, 0.04, 0.6], [0, 0.25, 0], mat(0x6b4422));
    B(wb, [0.5, 0.25, 0.3], [-0.7, 0.4, 0], mat(0xa8322d, { rough: 0.4, metal: 0.3 }));
    B(wb, [0.16, 0.1, 0.14], [1.1, 0.99, 0.2], M.iron);
    // laptop
    const lt = group(g, -1.1, 0.94, -6.55, 0.15);
    B(lt, [0.42, 0.02, 0.3], [0, 0.01, 0.05], mat(0x9aa0a8, { rough: 0.3, metal: 0.7, env: 1 }));
    const lid = group(lt, 0, 0.02, -0.1);
    lid.rotation.x = -0.25;
    B(lid, [0.42, 0.28, 0.012], [0, 0.14, 0], mat(0x9aa0a8, { rough: 0.3, metal: 0.7, env: 1 }));
    plane(lid, 0.39, 0.25, [0, 0.14, 0.007], 0, basic(0xffffff, { map: terminalTexture(), toneMapped: false }));

    // chalkboard of skills
    const cb = group(g, 1.25, 1.6, -6.97, 0);
    B(cb, [2.2, 1.4, 0.04], [0, 0, 0], mat(0x6b4422, { rough: 0.6 }));
    plane(cb, 2.08, 1.3, [0, 0, 0.022], 0, mat(0xffffff, { map: chalkboardTexture(), rough: 0.95, env: 0.1 }));
    B(cb, [2.0, 0.04, 0.08], [0, -0.7, 0.05], mat(0x6b4422));

    // server rack with blinking LEDs
    const rk = group(g, 2.6, 0, -3.6, -Math.PI / 2);
    B(rk, [0.62, 2.0, 0.7], [0, 1.0, 0], mat(0x15171b, { rough: 0.5, metal: 0.3 }));
    plane(rk, 0.56, 1.9, [0, 1.0, 0.352], 0, mat(0xffffff, { map: rackTexture(), rough: 0.6 }));
    const ledGeo = new THREE.SphereGeometry(0.008, 6, 4);
    const r = rng(9);
    for (let u = 0; u < 12; u++) {
      for (let k = 0; k < 3; k++) {
        const green = r() < 0.72;
        const led = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: green ? 0x5be37d : 0xf2b33d, toneMapped: false }));
        led.position.set(0.12 + k * 0.035, 1.9 - 0.0375 - u * 0.15 + 0.05, 0.36);
        led.userData = { speed: 1 + r() * 3, phase: r() * 10, base: led.material.color.clone() };
        rk.add(led);
        animated.leds.push(led);
      }
    }
    pointLight(g, 0x6aff9a, 0.25, [2.2, 1.2, -3.6]);

    // bike on the wall
    const bike = group(g, -2.85, 1.2, -3.4, Math.PI / 2);
    const tire = mat(0x151515, { rough: 0.8 });
    [-0.5, 0.5].forEach((x) => {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 32), tire);
      w.position.set(x, 0, 0);
      w.castShadow = true;
      bike.add(w);
    });
    const frameM = mat(0x2a6a8a, { rough: 0.35, metal: 0.4, env: 1 });
    B(bike, [0.75, 0.035, 0.035], [0, 0.32, 0], frameM, { rot: [0, 0, -0.05] });
    B(bike, [0.65, 0.035, 0.035], [-0.15, 0.08, 0], frameM, { rot: [0, 0, 0.7] });
    B(bike, [0.5, 0.035, 0.035], [0.3, 0.12, 0], frameM, { rot: [0, 0, -1.0] });
    B(bike, [0.2, 0.04, 0.08], [-0.25, 0.45, 0], mat(0x111111));

    // shelving with jars + boxes
    const sh = group(g, -2.82, 0, -1.4, Math.PI / 2);
    [0.5, 1.1, 1.7].forEach((y) => B(sh, [1.4, 0.03, 0.35], [0, y, 0], mat(0x7a5a36)));
    const rr = rng(4);
    for (let i = 0; i < 12; i++) {
      const y = [0.5, 1.1, 1.7][i % 3];
      if (rr() < 0.5) B(sh, [0.2 + rr() * 0.15, 0.15 + rr() * 0.12, 0.25], [-0.55 + Math.floor(i / 3) * 0.36, y + 0.1, 0], mat([0xb8925a, 0x8a6a40, 0x5a6a7a][i % 3]));
      else cyl(sh, 0.06, 0.06, 0.16, [-0.55 + Math.floor(i / 3) * 0.36, y + 0.095, 0], mat(0x9ab0a0, { rough: 0.1, transparent: true, opacity: 0.7, env: 1 }));
    }

    // bare bulb
    cyl(g, 0.004, 0.004, 0.55, [0.1, H - 0.28, -3.8], M.iron, { cast: false });
    bulb(g, [0.1, H - 0.62, -3.8], 0.045, 0xfff0c8);
    pointLight(g, 0xffd59a, 6, [0.1, H - 0.72, -3.8], true);
    pointLight(g, 0xffc27a, 1.2, [-1.3, 1.8, -6.0]);
  }

  // ---------------------------------------------------------------- roof

  function buildRoof(g) {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1900, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1;
    g.add(sky);

    const r = rng(101);
    const starPos = [];
    for (let i = 0; i < 1600; i++) {
      const a = r() * Math.PI * 2, e = 0.08 + Math.pow(r(), 0.7) * 1.45;
      starPos.push(Math.cos(a) * Math.cos(e) * 1800, Math.sin(e) * 1800, Math.sin(a) * Math.cos(e) * 1800);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));

    const moonDir = V(-0.45, 0.32, -1).normalize();
    const moon = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf6efd9, fog: false, toneMapped: false }));
    moon.position.copy(moonDir).multiplyScalar(1700);
    g.add(moon);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xbfd0ff, transparent: true, opacity: 0.5, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(380);
    halo.position.copy(moon.position);
    g.add(halo);

    g.add(new THREE.HemisphereLight(0x6a78b8, 0x1a1418, 0.6));
    const moonLight = new THREE.DirectionalLight(0xbfd0ff, 0.9);
    moonLight.position.copy(moonDir).multiplyScalar(30);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    Object.assign(moonLight.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 80 });
    moonLight.shadow.bias = -0.001;
    g.add(moonLight);
    g.add(moonLight.target);

    // the roof itself
    slab(g, -6, 6, -0.2, 0, 6, -6, M.tar, { tile: 3, cast: false });
    const coping = mat(0x9a8f80, { rough: 0.8 });
    [[-6, 6, 5.8, 6], [-6, 6, -6, -5.8], [-6, -5.8, -6, 6], [5.8, 6, -6, 6]].forEach(([a, b, c, d]) => {
      slab(g, a, b, 0, 0.9, c, d, M.brick, { tile: 1 });
      slab(g, a - 0.04, b + 0.04, 0.9, 0.98, c - 0.04, d + 0.04, coping);
    });
    // deck
    slab(g, -3.4, 2.4, 0, 0.08, 1.4, -3.2, mat(0xffffff, { map: woodTexture('#8a6a4a', 14, 80), rough: 0.8 }), { tile: 1.6 });
    // stair bulkhead behind us
    slab(g, -1.6, 0.8, 0, 2.6, 3.6, 5.8, M.brick, { tile: 1 });
    slab(g, -1.7, 0.9, 2.6, 2.7, 3.5, 5.9, coping);
    slab(g, -0.8, 0.0, 0, 2.1, 3.56, 3.6, mat(0x3a4a3a, { rough: 0.6 }));
    bulb(g, [-0.4, 2.3, 3.5], 0.04);
    pointLight(g, 0xffd59a, 2, [-0.4, 2.25, 3.3]);

    // water tower
    const wt = group(g, 3.6, 0, -3.4);
    [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(([x, z]) => B(wt, [0.14, 2.6, 0.14], [x, 1.3, z], M.iron));
    B(wt, [2.2, 0.08, 2.2], [0, 2.6, 0], M.iron);
    const staves = mat(0xffffff, { map: woodTexture('#7a5536', 19, 32), rough: 0.85 });
    staves.map = staves.map.clone();
    staves.map.rotation = Math.PI / 2;
    cyl(wt, 1.25, 1.25, 2.4, [0, 3.85, 0], staves, { seg: 32 });
    for (let i = 0; i < 4; i++) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.025, 6, 40), M.iron);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = 2.9 + i * 0.6;
      wt.add(hoop);
    }
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.9, 32), mat(0x4a3a2a, { rough: 0.8 }));
    cone.position.y = 5.5;
    cone.castShadow = true;
    wt.add(cone);
    for (let i = 0; i < 9; i++) B(wt, [0.04, 0.03, 0.4], [-1.32, 0.3 + i * 0.3, 0], M.iron);

    // string lights between four poles
    const poles = [V(-3.2, 0, 1.2), V(2.2, 0, 1.2), V(2.2, 0, -3.0), V(-3.2, 0, -3.0)];
    poles.forEach((p) => cyl(g, 0.04, 0.04, 2.6, [p.x, 1.3, p.z], mat(0x3a2a1a)));
    const bulbGeo = new THREE.SphereGeometry(0.035, 10, 8);
    for (let i = 1; i < 4; i++) {
      const a = poles[i], b = poles[(i + 1) % 4];
      const n = Math.round(a.distanceTo(b) / 0.4);
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const p = a.clone().lerp(b, t);
        p.y = 2.55 - Math.sin(t * Math.PI) * 0.45;
        pts.push(p);
        if (k > 0 && k < n) {
          const bm = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false }));
          bm.position.set(p.x, p.y - 0.06, p.z);
          bm.userData = { phase: r() * 10 };
          g.add(bm);
          animated.bulbs.push(bm);
        }
      }
      const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x111111 }));
      g.add(wire);
    }
    pointLight(g, 0xffc27a, 4, [-0.5, 2.0, -0.9]);
    pointLight(g, 0xffc27a, 2.5, [-2.2, 2.0, -2.6]);

    // Adirondack chairs + table
    const wood = mat(0xd8cbb0, { rough: 0.7 });
    [[-1.7, -1.6, 0.25], [0.3, -1.6, -0.25]].forEach(([x, z, rot]) => {
      const c = group(g, x, 0.08, z, Math.PI + rot);
      B(c, [0.7, 0.05, 0.6], [0, 0.35, 0], wood, { rot: [-0.12, 0, 0] });
      B(c, [0.7, 0.75, 0.05], [0, 0.7, -0.38], wood, { rot: [-0.35, 0, 0] });
      [-0.38, 0.38].forEach((sx) => {
        B(c, [0.1, 0.03, 0.75], [sx, 0.55, 0.05], wood);
        B(c, [0.05, 0.55, 0.05], [sx, 0.27, 0.32], wood);
        B(c, [0.05, 0.35, 0.05], [sx, 0.17, -0.28], wood);
      });
    });
    const tb = group(g, -0.7, 0.08, -1.9);
    cyl(tb, 0.3, 0.3, 0.04, [0, 0.5, 0], wood);
    cyl(tb, 0.03, 0.03, 0.5, [0, 0.25, 0], M.iron);
    cyl(tb, 0.035, 0.03, 0.12, [0.1, 0.58, 0], mat(0x9ab0a0, { rough: 0.05, transparent: true, opacity: 0.6, env: 1 }));
    cyl(tb, 0.03, 0.03, 0.06, [-0.1, 0.55, 0.05], M.white);
    bulb(tb, [-0.1, 0.6, 0.05], 0.012, 0xffb050);

    // telescope pointing at the moon
    const ts = group(g, -4.6, 0.08, -2.4);
    [0, 2.1, 4.2].forEach((a) => B(ts, [0.025, 1.1, 0.025], [Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2], M.iron, { rot: [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2] }));
    cyl(ts, 0.07, 0.09, 1.0, [0, 1.15, 0], M.white, { rot: [-1.0, 0, 0.35] });

    // planters
    [[-5.4, -5.4], [-5.4, 0], [5.3, 3.0], [-3.8, -5.4]].forEach(([x, z], i) => {
      B(g, [0.9, 0.45, 0.45], [x, 0.225, z], mat(0x7a4a32));
      makePlant(g, x, 0.3, z, 1.0 + (i % 2) * 0.3, 40 + i);
    });

    // the city
    const winMats = [
      [windowLightsTexture(1, 0.35, 0.85), 1.0],
      [windowLightsTexture(2, 0.18, 0.7), 1.0],
      [windowLightsTexture(3, 0.55, 0.5), 1.2]
    ].map(([tex]) => mat(0x14161f, { rough: 0.9, emissive: 0xffffff, emissiveMap: tex, ei: 1.2, map: null, env: 0.2 }));
    const roofTop = mat(0x111219, { rough: 1 });
    const cr = rng(303);
    let placed = 0;
    while (placed < 230) {
      // Brooklyn rowhouses all around, Manhattan's towers far off to the north (-z).
      const manhattan = placed < 70;
      const a = manhattan ? -Math.PI / 2 + (cr() - 0.5) * 1.3 : cr() * Math.PI * 2;
      const dist = manhattan ? 1000 + cr() * 450 : 18 + Math.pow(cr(), 0.9) * 300;
      const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
      const hgt = manhattan ? 50 + Math.pow(cr(), 2.4) * 280 : 6 + cr() * (dist < 80 ? 9 : 22);
      const w = (8 + cr() * 14) * (manhattan ? 2.2 : 1), d = (8 + cr() * 14) * (manhattan ? 2.2 : 1);
      const wm = winMats[Math.floor(cr() * 3)];
      const geo = boxGeo(w, hgt, d, manhattan ? 14 : 6, manhattan ? 14 : 6);
      const bm = new THREE.Mesh(geo, [wm, wm, roofTop, roofTop, wm, wm]);
      bm.position.set(x, hgt / 2 - 14, z);
      g.add(bm);
      if (manhattan && hgt > 220) {
        const tip = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030, toneMapped: false }));
        tip.position.set(x, hgt - 13, z);
        g.add(tip);
      }
      placed++;
    }
    g.userData.fog = new THREE.FogExp2(0x241c38, 0.0007);
  }

  // ---------------------------------------------------------------- camera

  const cam = { p: HOME.p.clone(), l: HOME.l.clone(), yaw: 0, pitch: 0, area: 'main', room: null };
  let walk = null;
  let running = false;

  function setArea(area) {
    cam.area = area;
    Object.entries(areas).forEach(([k, g]) => { g.visible = k === area; });
    scene.fog = area === 'roof' ? areas.roof.userData.fog : null;
    scene.background.setHex(area === 'roof' ? 0x0a0a14 : 0x07080d);
    renderer.shadowMap.needsUpdate = true;
  }

  function place(view) {
    cam.p.copy(view.p);
    cam.l.copy(view.l);
    cam.yaw = cam.pitch = 0;
    drag.yaw = drag.pitch = 0;
  }

  function walkTo(points, looks, opts = {}) {
    const P = new THREE.CatmullRomCurve3(points.map((v) => v.clone()), false, 'centripetal');
    const L = new THREE.CatmullRomCurve3(looks.map((v) => v.clone()), false, 'centripetal');
    const dist = P.getLength();
    const dur = opts.duration ?? Math.min(3.4, Math.max(1.3, dist * 0.5));
    return new Promise((resolve) => {
      walk = { P, L, t0: performance.now(), dur: dur * 1000, resolve, startYaw: drag.yaw, startPitch: drag.pitch, bob: opts.bob ?? 1 };
    });
  }

  function reverse(w) {
    return { p: w.p.slice().reverse(), l: w.l.slice().reverse() };
  }

  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function fadeOut() {
    fadeEl.classList.add('is-dark', 'is-on');
    await wait(450);
  }

  async function fadeIn() {
    fadeEl.classList.remove('is-on');
    await wait(450);
    fadeEl.classList.remove('is-dark');
  }

  async function swingDoor(door, to, ms) {
    const from = door.rotation.y, t0 = performance.now();
    return new Promise((resolve) => {
      function step(now) {
        const t = Math.min(1, (now - t0) / ms);
        door.rotation.y = from + (to - from) * (1 - Math.pow(1 - t, 3));
        if (t < 1) requestAnimationFrame(step); else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  async function cutTo(area, view) {
    await fadeOut();
    setArea(area);
    place(view);
    doors.basement.rotation.y = 0;
    await wait(60);
    await fadeIn();
  }

  // ---------------------------------------------------------------- public API

  async function goRoom(id, opts = {}) {
    const view = VIEWS[id];
    if (cam.room === id) return;
    hideHotspots();
    if (opts.instant) {
      setArea(view.area);
      place(view);
    } else if (cam.room === null && cam.area === 'main') {
      cam.room = 'walking';
      const w = WALKS[id];
      if (id === 'skills') {
        swingDoor(doors.basement, -1.45, 900);
      }
      await walkTo(w.p, w.l);
      if (view.area !== 'main') await cutTo(view.area, view);
    } else {
      await cutTo(view.area, view);
    }
    cam.room = id;
  }

  async function goHome(opts = {}) {
    const from = cam.room;
    if (from === null) return;
    if (opts.instant || !from || from === 'walking') {
      setArea('main');
      place(HOME);
    } else if (VIEWS[from].area === 'main') {
      cam.room = 'walking';
      const w = reverse(WALKS[from]);
      await walkTo(w.p, w.l, { bob: 0.5 });
    } else {
      cam.room = 'walking';
      await cutTo('main', HOME);
    }
    cam.room = null;
  }

  // ---------------------------------------------------------------- input

  const drag = { yaw: 0, pitch: 0, down: false, moved: false, x: 0, y: 0 };
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null;

  function pick(clientX, clientY) {
    if (cam.room !== null || walk) return null;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    // Test against the whole floor so walls block what's behind them.
    const hit = raycaster.intersectObject(areas.main, true)[0];
    return hit && hit.distance < 12 ? hit.object.userData.room || null : null;
  }

  function setHovered(id) {
    if (hovered === id) return;
    hovered = id;
    canvas.style.cursor = id ? 'pointer' : 'grab';
    hotspotEls.forEach((el) => el.classList.toggle('is-hot', el.dataset.room === id));
  }

  canvas.addEventListener('pointerdown', (e) => {
    drag.down = true;
    drag.moved = false;
    drag.x = e.clientX;
    drag.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag.down) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        drag.moved = true;
        canvas.style.cursor = 'grabbing';
      }
      if (drag.moved) {
        const lim = cam.room === null ? 1.5 : 0.9;
        drag.yaw = THREE.MathUtils.clamp(drag.yaw + dx * 0.0045, -lim, lim);
        drag.pitch = THREE.MathUtils.clamp(drag.pitch + dy * 0.0035, -0.6, 0.6);
        drag.x = e.clientX;
        drag.y = e.clientY;
      }
    } else if (e.pointerType === 'mouse') {
      setHovered(pick(e.clientX, e.clientY));
    }
  });
  const release = (e) => {
    if (!drag.down) return;
    drag.down = false;
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
    if (!drag.moved && e.type === 'pointerup') {
      const id = pick(e.clientX, e.clientY);
      if (id) onSelect(id);
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ---------------------------------------------------------------- hotspots

  const hotspotEls = HOTSPOTS.map((h) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hotspot';
    b.dataset.room = h.id;
    b.innerHTML = `<span class="hotspot-dot" aria-hidden="true"></span><span class="hotspot-text"><strong>${h.label}</strong><small>${h.sub}</small></span>`;
    b.setAttribute('aria-label', `${h.label}: ${h.sub}`);
    b.addEventListener('click', () => onSelect(h.id));
    b.addEventListener('mouseenter', () => setHovered(h.id));
    b.addEventListener('mouseleave', () => setHovered(null));
    hotspotLayer.appendChild(b);
    return b;
  });

  function hideHotspots() {
    hotspotLayer.classList.remove('is-visible');
  }

  const proj = new THREE.Vector3();
  function updateHotspots() {
    const show = cam.room === null && !walk && cam.area === 'main';
    hotspotLayer.classList.toggle('is-visible', show);
    if (!show) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    HOTSPOTS.forEach((hs, i) => {
      proj.copy(hs.at).project(camera);
      const el = hotspotEls[i];
      const off = proj.z > 1 || Math.abs(proj.x) > 1.05 || Math.abs(proj.y) > 1.05;
      el.classList.toggle('is-off', off);
      el.tabIndex = off ? -1 : 0;
      if (!off) {
        // keep the whole label on screen
        const x = THREE.MathUtils.clamp(((proj.x + 1) / 2) * w, 22, Math.max(22, w - el.offsetWidth - 4));
        const y = THREE.MathUtils.clamp(((1 - proj.y) / 2) * h, 70, h - 90);
        el.style.transform = `translate(${x}px, ${y}px)`;
      }
    });
  }

  // ---------------------------------------------------------------- loop

  const look = new THREE.Vector3();
  function tick(now) {
    const t = now / 1000;
    let bob = 0;

    if (walk) {
      const u = Math.min(1, (now - walk.t0) / walk.dur);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      cam.p.copy(walk.P.getPointAt(e));
      cam.l.copy(walk.L.getPoint(e));
      drag.yaw = walk.startYaw * (1 - e);
      drag.pitch = walk.startPitch * (1 - e);
      bob = Math.sin(e * walk.P.getLength() * 5.5) * 0.018 * Math.sin(u * Math.PI) * walk.bob;
      if (u >= 1) {
        const done = walk.resolve;
        walk = null;
        done();
      }
    }

    // gentle breathing sway so the view never feels frozen
    const sway = walk ? 0 : 1;
    cam.yaw += (drag.yaw + Math.sin(t * 0.35) * 0.01 * sway - cam.yaw) * 0.12;
    cam.pitch += (drag.pitch + Math.sin(t * 0.5) * 0.006 * sway - cam.pitch) * 0.12;

    camera.position.copy(cam.p);
    camera.position.y += bob;
    look.copy(cam.l);
    camera.lookAt(look);
    camera.rotateOnWorldAxis(UP, cam.yaw);
    camera.rotateX(cam.pitch);

    if (cam.area === 'main') {
      animated.flames.forEach((f) => {
        const { h, r, phase } = f.userData;
        const n = Math.sin(t * 9 + phase) * 0.5 + Math.sin(t * 13.7 + phase * 2) * 0.3;
        f.scale.set(r * (1 + n * 0.1), h * (1 + n * 0.22), r * (1 - n * 0.1));
        f.position.y = 0.18 + f.scale.y / 2;
      });
      animated.fireLight.intensity = 3.0 + Math.sin(t * 11) * 0.5 + Math.sin(t * 17.3) * 0.4;
    } else if (cam.area === 'basement') {
      animated.leds.forEach((l) => {
        const on = Math.sin(t * l.userData.speed + l.userData.phase) > -0.3;
        l.material.color.copy(l.userData.base).multiplyScalar(on ? 1 : 0.15);
      });
    } else {
      animated.bulbs.forEach((b) => b.material.color.setRGB(1, 0.82, 0.48).multiplyScalar(0.85 + Math.sin(t * 1.3 + b.userData.phase) * 0.15));
    }

    updateHotspots();
    renderer.render(scene, camera);
  }

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    tick(now);
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 72 : camera.aspect < 1.2 ? 64 : 56;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  setArea('main');
  place(HOME);
  // Compile each area's shaders up front so the first visit doesn't stutter.
  ['roof', 'basement', 'main'].forEach((a) => { setArea(a); renderer.compile(scene, camera); });

  return {
    start() {
      if (running) return;
      running = true;
      resize();
      requestAnimationFrame(loop);
    },
    stop() { running = false; },
    goRoom,
    goHome,
    get room() { return cam.room; }
  };
}
