// Trap Village — an original forest village in the style of late-90s 3D adventures:
// a sheltered clearing ringed by cliffs and giant trees, dirt paths, stump homes,
// treetop huts joined by rope bridges, a pond, a market stall, the Trap House and
// the Great Trap Tree. Every home is built to ToneDa's scale, with a real doorway
// and a furnished room inside. Everything is built in code with small, soft-filtered textures.
import * as T from '../vendor/three.module.min.js';

// ---------- deterministic randomness, so the village is the same every visit ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- small procedural textures ----------
function tex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}
function speckle(base, shades, density, seed, extra) {
  return (g, n) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, n, n);
    for (let i = 0; i < n * n * density; i++) {
      g.fillStyle = shades[Math.floor(r() * shades.length)];
      g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2));
    }
    if (extra) extra(g, n, r);
  };
}
const TEX = {};
function textures() {
  if (TEX.grass) return TEX;
  TEX.grass = tex(64, speckle('#5a9a40', ['#4c8a36', '#6aac4a', '#437c30', '#74b552'], 0.5, 1, (g, n, r) => {
    g.strokeStyle = '#3d742c';
    for (let i = 0; i < 40; i++) { const x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y - 3); g.stroke(); }
  }), 30);
  TEX.dirt = tex(64, speckle('#9a7a4e', ['#8a6a42', '#a98a5c', '#7d5f3a', '#b3956a'], 0.5, 2), 1);
  TEX.bark = tex(64, (g, n) => {
    const r = rng(3);
    g.fillStyle = '#6a4630'; g.fillRect(0, 0, n, n);
    for (let x = 0; x < n; x += 2) {
      g.fillStyle = ['#5a3a26', '#7a5238', '#4e3020', '#83593c'][Math.floor(r() * 4)];
      g.fillRect(x, 0, 1 + Math.floor(r() * 3), n);
    }
    g.fillStyle = '#3e2618';
    for (let i = 0; i < 30; i++) g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1, 3 + Math.floor(r() * 8));
  });
  TEX.planks = tex(64, (g, n) => {
    const r = rng(4);
    for (let y = 0; y < n; y += 8) {
      g.fillStyle = ['#b07a48', '#a36f40', '#bb8551', '#9a683b'][Math.floor(r() * 4)];
      g.fillRect(0, y, n, 8);
      g.fillStyle = '#6e4826'; g.fillRect(0, y + 7, n, 1);
      g.fillRect(Math.floor(r() * n), y, 1, 7);
      g.fillStyle = '#8c5d33';
      for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * n), y + 1 + Math.floor(r() * 5), 3 + Math.floor(r() * 6), 1);
    }
  });
  TEX.leaves = tex(64, speckle('#3a7a38', ['#2e6a30', '#4a8e40', '#266028', '#58a048', '#33733a'], 0.9, 5), 2);
  TEX.rock = tex(64, speckle('#77705f', ['#6a6353', '#857d6b', '#5c5648', '#8f8876'], 0.6, 6, (g, n, r) => {
    g.strokeStyle = '#4a4539';
    for (let i = 0; i < 9; i++) { const x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 14 - 7, y + r() * 12); g.stroke(); }
    g.fillStyle = '#5f7d45';
    for (let i = 0; i < 50; i++) g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 2, 2);
  }), 1);
  TEX.roof = tex(64, (g, n) => {
    const r = rng(7);
    for (let y = 0; y < n; y += 8) for (let x = -4; x < n; x += 8) {
      g.fillStyle = ['#a8242e', '#931c27', '#b52e36', '#8a1822'][Math.floor(r() * 4)];
      g.fillRect(x + ((y / 8) % 2) * 4, y, 8, 8);
      g.fillStyle = '#5e0f18'; g.fillRect(x + ((y / 8) % 2) * 4, y + 7, 8, 1); g.fillRect(x + ((y / 8) % 2) * 4, y, 1, 8);
    }
  }, 2);
  TEX.thatch = tex(64, speckle('#b89a4e', ['#a88a42', '#c8aa5c', '#96783a', '#d4b868'], 0.8, 8, (g, n, r) => {
    g.strokeStyle = '#7d6430';
    for (let i = 0; i < 60; i++) { const x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1, y + 6); g.stroke(); }
  }), 2);
  TEX.water = tex(64, speckle('#3d8fb8', ['#4a9cc6', '#357fa6', '#5fb0d6'], 0.35, 9, (g, n, r) => {
    g.strokeStyle = '#a8dcf0';
    for (let i = 0; i < 14; i++) { const x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 5, y - 2, x + 10, y); g.stroke(); }
  }), 3);
  TEX.awning = tex(32, (g, n) => { for (let x = 0; x < n; x += 8) { g.fillStyle = (x / 8) % 2 ? '#e8b84a' : '#b3182c'; g.fillRect(x, 0, 8, n); } }, 3);
  TEX.tuft = tex(32, (g, n) => {
    const r = rng(10);
    g.clearRect(0, 0, n, n);
    for (let i = 0; i < 16; i++) {
      const x = 3 + r() * (n - 6), h = 12 + r() * 18, lean = r() * 8 - 4;
      g.strokeStyle = ['#4c8a36', '#6aac4a', '#3d742c', '#7cc058'][Math.floor(r() * 4)];
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, n); g.quadraticCurveTo(x, n - h * 0.6, x + lean, n - h); g.stroke();
    }
  });
  TEX.tuft.wrapS = TEX.tuft.wrapT = T.ClampToEdgeWrapping;
  TEX.flower = tex(32, (g, n) => {
    const r = rng(11);
    g.clearRect(0, 0, n, n);
    for (let i = 0; i < 7; i++) {
      const x = 4 + r() * (n - 8), h = 10 + r() * 14;
      g.strokeStyle = '#3d742c'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, n); g.lineTo(x, n - h); g.stroke();
      g.fillStyle = ['#ffe45c', '#ff6a6a', '#ffffff', '#ffb0e0'][Math.floor(r() * 4)];
      g.fillRect(x - 2, n - h - 3, 5, 5);
      g.fillStyle = '#e8902c'; g.fillRect(x - 0.5, n - h - 1.5, 2, 2);
    }
  });
  TEX.flower.wrapS = TEX.flower.wrapT = T.ClampToEdgeWrapping;
  return TEX;
}

function signTexture(text, { w = 256, h = 80, color = '#ff2525', font = 'bold 64px monospace', bg = null, outline = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (outline) { g.strokeStyle = outline; g.lineWidth = 8; g.lineJoin = 'round'; g.strokeText(text, w / 2, h / 2 + 2); }
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}

export function buildWorld(scene) {
  const X = textures(), r = rng(2026);
  const colliders = [];                         // circles (and a few boxes) the player cannot enter
  const block = (x, z, radius, yMin = -Infinity, yMax = Infinity) => colliders.push({ x, z, r: radius, yMin, yMax });
  const surfaces = [];                          // things you can stand on above the ground
  const ladders = [];                           // { x, z, face, top, exit: [x, z] }
  const interiors = [];                         // rooms, so the game can tell when ToneDa is indoors
  const lam = (map, color = '#ffffff', extra = {}) => new T.MeshLambertMaterial({ map, color, ...extra });
  const flat = color => new T.MeshLambertMaterial({ color, flatShading: true });
  const M = {
    bark: lam(X.bark), planks: lam(X.planks), leaves: lam(X.leaves, '#ffffff', { flatShading: true }),
    rock: lam(X.rock, '#ffffff', { flatShading: true }), roof: lam(X.roof), thatch: lam(X.thatch),
    dark: new T.MeshBasicMaterial({ color: '#120b08' }), rope: flat('#8a6a3c'),
  };
  const bigBark = X.bark.clone(); bigBark.repeat.set(4, 3); bigBark.needsUpdate = true;
  const floorBoards = X.planks.clone(); floorBoards.repeat.set(3, 3); floorBoards.needsUpdate = true;
  const roundBoards = X.planks.clone(); roundBoards.repeat.set(5, 1.5); roundBoards.needsUpdate = true;   // planks wrapped round a hut
  const laid = depth => ({ polygonOffset: true, polygonOffsetFactor: -depth, polygonOffsetUnits: -depth });
  Object.assign(M, {
    stump: lam(bigBark),                                              // outside of a stump home
    carved: lam(bigBark, '#dcb88e', { side: T.BackSide }),            // its hollowed-out inside
    boardsOut: lam(roundBoards), boardsIn: lam(roundBoards, '#e6c89c', { side: T.BackSide }),   // a plank hut, outside and in
    cabin: lam(X.planks, '#e8c9a0'), ceiling: lam(X.planks, '#a88a66'),
    floor: lam(floorBoards, '#ffffff', laid(2)),
    glow: new T.MeshBasicMaterial({ color: '#ffd978' }), daylight: new T.MeshBasicMaterial({ color: '#d4f0f6' }),
    fire: new T.MeshBasicMaterial({ color: '#ff8a2c' }),
    black: flat('#1c1c22'), red: flat('#b3182c'), cream: flat('#efe6d0'), white: flat('#ffffff'), gold: flat('#e8b84a'),
  });
  const rug = (color, depth = 4) => new T.MeshLambertMaterial({ color, ...laid(depth) });
  const lay = (geo, mat, x, y, z, parent) => { const m = add(geo, mat, x, y, z, parent); m.rotation.x = -Math.PI / 2; return m; };
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent) => add(new T.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const cyl = (rt, rb, h, mat, x, y, z, parent, seg = 8) => add(new T.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, parent);

  // ---------- sky, haze, light ----------
  scene.background = new T.Color('#a9d9e6');
  scene.fog = new T.Fog('#b4dccb', 28, 95);
  scene.add(new T.HemisphereLight(0xfff6e0, 0x4f7a48, 2.3));
  const sun = new T.DirectionalLight(0xffe6b8, 2.2);
  sun.position.set(14, 26, 10);
  scene.add(sun);

  // ---------- ground with patchy colour ----------
  const RADIUS = 42;
  const groundGeo = new T.PlaneGeometry(150, 150, 30, 30);
  groundGeo.rotateX(-Math.PI / 2);
  const gc = [], gp = groundGeo.attributes.position, tmp = new T.Color();
  for (let i = 0; i < gp.count; i++) {
    const n = Math.sin(gp.getX(i) * 0.21) * Math.cos(gp.getZ(i) * 0.17) * 0.5 + r() * 0.3;
    tmp.set('#ffffff').lerp(new T.Color('#b9d98a'), Math.max(0, n)).lerp(new T.Color('#7fae6a'), Math.max(0, -n));
    gc.push(tmp.r, tmp.g, tmp.b);
  }
  groundGeo.setAttribute('color', new T.Float32BufferAttribute(gc, 3));
  scene.add(new T.Mesh(groundGeo, new T.MeshLambertMaterial({ map: X.grass, vertexColors: true })));

  // ---------- dirt paths ----------
  const pathMat = new T.MeshLambertMaterial({ map: X.dirt, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const trail = [];                             // points along every path, so boulders stay off them
  function path(points, width) {
    const curve = new T.CatmullRomCurve3(points.map(([x, z]) => new T.Vector3(x, 0.02, z)));
    trail.push(...curve.getSpacedPoints(Math.ceil(curve.getLength())));
    const n = Math.max(8, Math.round(curve.getLength() * 1.2)), pos = [], uv = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n), t = curve.getTangent(i / n), w = width * (0.85 + 0.15 * Math.sin(i * 1.7)) / 2;
      pos.push(p.x - t.z * w, 0.02, p.z + t.x * w, p.x + t.z * w, 0.02, p.z - t.x * w);
      uv.push(0, i * 0.35, 1, i * 0.35);
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    scene.add(new T.Mesh(g, pathMat));
  }
  path([[-9, -1.2], [-6.5, 0.2], [-2, 1.5], [1, 1]], 2.6);                   // Trap House to the plaza
  path([[1, 1], [4, -2], [6.5, -5.5], [7.8, -7.6]], 2.8);                    // plaza to the Great Trap Tree
  path([[1, 1], [4, 3.5], [7, 5.5]], 2.4);                                   // plaza to the training clearing
  path([[1, 1], [-3, 5], [-8, 9], [-13, 8.5], [-19.6, 6.2]], 2.2);           // plaza past the pond to the west home
  path([[-3, 5], [-4, 11], [-4.9, 16], [-4.7, 19.4]], 2);                    // spur to the north home
  path([[1, 1], [1.2, -6], [2, -12.6]], 2.2);                                // plaza to the market stall
  path([[7, 5.5], [14, 6], [22, 4], [30, 2.6], [38, 2.3]], 2.6);             // clearing to the way out
  path([[14, 6], [16.2, 11], [15.6, 16.6]], 2);                              // spur to the east home
  path([[-9, -1.2], [-14.5, -1.4], [-18.5, -5.4], [-21.6, -9.6]], 2);        // Trap House to the treetop ladder
  const plaza = add(new T.CircleGeometry(3.4, 14), pathMat, 1, 0.025, 1);
  plaza.rotation.x = -Math.PI / 2;

  // ---------- cliff wall around the village, with a grassy lip ----------
  const wallGeo = new T.CylinderGeometry(RADIUS + 3, RADIUS + 1.2, 15, 44, 5, true);
  const wp = wallGeo.attributes.position, wc = [];
  for (let i = 0; i < wp.count; i++) {
    const x = wp.getX(i), y = wp.getY(i), z = wp.getZ(i), a = Math.atan2(z, x);
    const bulge = 1 + (Math.sin(a * 9 + y * 0.6) * 0.018 + Math.sin(a * 23) * 0.01) + (r() - 0.5) * 0.01;
    wp.setXYZ(i, x * bulge, y, z * bulge);
    const shade = 0.72 + (y + 7.5) / 15 * 0.4 + (r() - 0.5) * 0.12;
    wc.push(shade, shade, shade * 0.96);
  }
  wallGeo.setAttribute('color', new T.Float32BufferAttribute(wc, 3));
  wallGeo.computeVertexNormals();
  const rock = X.rock.clone(); rock.repeat.set(26, 3); rock.needsUpdate = true;
  add(wallGeo, new T.MeshLambertMaterial({ map: rock, vertexColors: true, side: T.DoubleSide, flatShading: true }), 0, 7.5, 0);
  const lip = add(new T.RingGeometry(RADIUS + 2, RADIUS + 26, 44, 1), new T.MeshLambertMaterial({ map: X.grass, color: '#9fc77f' }), 0, 15, 0);
  lip.rotation.x = -Math.PI / 2;

  // ---------- trees ----------
  const canopyGeo = new T.IcosahedronGeometry(1, 1);
  function tree(x, z, h, tr, cr, tint = '#ffffff') {
    const g = new T.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    cyl(tr * 0.7, tr, h, M.bark, 0, h / 2, 0, g, 8);
    for (let i = 0; i < 5; i++) {                  // root flares
      // a cone leaning out and down from the trunk, so its tip runs into the ground
      const a = i * 1.257 + r(), len = tr * 2.6, d = tr * 0.6 + 0.91 * len / 2;
      const root = add(new T.ConeGeometry(tr * 0.5, len, 5), M.bark, Math.cos(a) * d, tr * 1.1 - 0.42 * len / 2, Math.sin(a) * d, g);
      root.rotation.set(Math.sin(a) * 2.0, 0, -Math.cos(a) * 2.0);
    }
    const mat = lam(X.leaves, tint, { flatShading: true });
    const blobs = 3 + Math.floor(r() * 2);
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + r(), d = i === 0 ? 0 : cr * 0.6;
      const c = add(canopyGeo, mat, Math.cos(a) * d, h + cr * (0.25 + r() * 0.35), Math.sin(a) * d, g);
      c.scale.set(cr * (0.9 + r() * 0.3), cr * (0.7 + r() * 0.25), cr * (0.9 + r() * 0.3));
      c.rotation.y = r() * 6;
    }
    block(x, z, tr + 0.35);
    return g;
  }
  const tints = ['#ffffff', '#e2f0c8', '#cfe8d0', '#f0ffd8'];
  for (let i = 0; i < 32; i++) {                   // giants standing against the cliff
    const a = (i / 32) * Math.PI * 2 + (r() - 0.5) * 0.1, d = RADIUS - 2.2 - r() * 2.6;
    if (Math.abs(a - 0.055) < 0.14 || Math.abs(a - 0.055 - Math.PI * 2) < 0.14) continue;   // leave the way out open
    tree(Math.cos(a) * d, Math.sin(a) * d, 10 + r() * 5, 1.1 + r() * 0.6, 4.2 + r() * 1.6, tints[i % 4]);
  }
  for (let i = 0; i < 40; i++) {                   // forest canopy on top of the cliff
    const a = (i / 40) * Math.PI * 2 + r() * 0.1, d = RADIUS + 5 + r() * 9;
    const c = add(canopyGeo, M.leaves, Math.cos(a) * d, 17 + r() * 4, Math.sin(a) * d);
    c.scale.set(5 + r() * 3, 4 + r() * 2.5, 5 + r() * 3);
  }
  for (const [x, z, h] of [[-17.5, 0.5, 7], [16, -1, 8], [3.5, 28, 8], [19, 12, 7.5], [-22, -5.5, 8.5], [7.5, -23, 8], [-15, 22.5, 7.5], [22, -14, 9],
    [-31, -4, 9], [30, -9, 8.5], [-18, 29, 9], [27, 13, 8], [9, 31, 8.5], [-33, 9, 8], [18, -27, 9]]) {
    tree(x, z, h, 0.7, 3.1, tints[Math.floor(r() * 4)]);
  }

  // ---------- reusable village pieces ----------
  function ladder(x, z, height, rotY, parent = scene, climb = null) {
    if (climb) ladders.push(climb);
    const g = new T.Group();
    g.position.set(x, 0, z); g.rotation.y = rotY;
    parent.add(g);
    for (const sx of [-0.4, 0.4]) { const rail = box(0.1, height + 0.6, 0.1, M.planks, sx, height / 2, 0, g); rail.rotation.x = 0.12; }
    for (let y = 0.45; y < height; y += 0.55) box(0.8, 0.08, 0.1, M.planks, 0, y, y * 0.12 - height * 0.06, g);
    return g;
  }
  function ropeBridge(a, b, y) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz), n = Math.round(len / 0.75);
    for (let i = 0; i <= n; i++) {
      const t = i / n, sag = Math.sin(t * Math.PI) * 0.7;
      if (i === 0) surfaces.push({ type: 'bridge', a, b, y: y + 0.05, sag: 0.7, half: 0.8 });
      const plank = box(1.5, 0.1, 0.55, M.planks, a[0] + dx * t, y - sag, a[1] + dz * t);
      plank.rotation.y = ang;
      if (i % 2 === 0) for (const side of [-0.75, 0.75]) {
        const px = a[0] + dx * t + Math.cos(ang) * side, pz = a[1] + dz * t - Math.sin(ang) * side;
        box(0.07, 0.9, 0.07, M.rope, px, y - sag + 0.45, pz);
      }
    }
    for (const side of [-0.75, 0.75]) for (let i = 0; i < n; i++) {     // hand ropes
      const t = (i + 0.5) / n, sag = Math.sin(t * Math.PI) * 0.7;
      const rope = box(0.05, 0.05, len / n + 0.05, M.rope, a[0] + dx * t + Math.cos(ang) * side, y - sag + 0.88, a[1] + dz * t - Math.sin(ang) * side);
      rope.rotation.y = ang;
    }
  }
  function lantern(x, y, z, parent = scene) {
    box(0.08, 0.5, 0.08, M.rope, x, y + 0.25, z, parent);
    add(new T.BoxGeometry(0.28, 0.34, 0.28), new T.MeshBasicMaterial({ color: '#ffd978' }), x, y - 0.1, z, parent);
    box(0.36, 0.06, 0.36, M.dark, x, y + 0.09, z, parent);
  }
  // ---------- round walls with a real doorway (the door faces the group's +Z) ----------
  // Two shells: one seen from outside, one from inside. The door frame closes the gap between them.
  function roundWalls(g, { rB, rT, rIn, h, y = 0, half, doorH, outer, inner }) {
    const TAU = Math.PI * 2, rAt = t => rB + (rT - rB) * t;       // outer radius at a fraction of the height
    const gOut = Math.asin(half / rAt(doorH / h / 2)), gIn = Math.asin(half / rIn), over = h - doorH;
    const shell = (rt, rb, hh, yy, from, len, mat, seg) => add(new T.CylinderGeometry(rt, rb, hh, seg, 1, true, from, len), mat, 0, yy, 0, g);
    shell(rT, rB, h, y + h / 2, gOut, TAU - 2 * gOut, outer, 18);
    shell(rIn, rIn, h, y + h / 2, gIn, TAU - 2 * gIn, inner, 18);
    shell(rT, rAt(doorH / h), over, y + doorH + over / 2, -gOut, 2 * gOut, outer, 3);     // the strip above the door
    shell(rIn, rIn, over, y + doorH + over / 2, -gIn, 2 * gIn, inner, 3);
    const zIn = Math.sqrt(rIn * rIn - half * half) - 0.1, zOut = Math.sqrt(rB * rB - half * half) + 0.1, zMid = (zIn + zOut) / 2;
    for (const sx of [-1, 1]) box(0.3, doorH, zOut - zIn, M.planks, sx * (half + 0.15), y + doorH / 2, zMid, g);
    box(half * 2 + 0.6, 0.34, zOut - zIn, M.planks, 0, y + doorH + 0.15, zMid, g);
    return zOut;                                                  // how far out the doorway reaches
  }
  // a cone roof whose flat underside is the ceiling of the room below
  function coneRoof(g, radius, height, y, roofMat, seg = 12) {
    const roof = add(new T.ConeGeometry(radius, height, seg), [roofMat, roofMat, M.ceiling], 0, y + height / 2, 0, g);
    roof.rotation.y = 0.3;
    return roof;
  }
  // a round window: glowing from outside, daylight from inside (th is measured from the door)
  function roundWindow(g, th, y, rOutside, rInside, rad = 0.75) {
    const sx = Math.sin(th), cz = Math.cos(th);
    add(new T.CircleGeometry(rad, 10), M.glow, sx * rOutside, y, cz * rOutside, g).rotation.y = th;
    add(new T.TorusGeometry(rad, 0.09, 5, 12), M.planks, sx * rOutside, y, cz * rOutside, g).rotation.y = th;
    add(new T.CircleGeometry(rad, 10), M.daylight, sx * rInside, y, cz * rInside, g).rotation.y = th + Math.PI;
    add(new T.TorusGeometry(rad, 0.08, 5, 12), M.planks, sx * rInside, y, cz * rInside, g).rotation.y = th;
  }
  function bed(g, x, y, z, blanket, rotY = 0) {
    const b = new T.Group();
    b.position.set(x, y, z); b.rotation.y = rotY;
    g.add(b);
    box(1.5, 0.5, 3.0, M.planks, 0, 0.25, 0, b);
    box(1.5, 1.3, 0.16, M.planks, 0, 0.65, -1.5, b);              // headboard
    box(1.36, 0.3, 2.86, M.cream, 0, 0.62, 0, b);
    box(1.0, 0.22, 0.6, M.white, 0, 0.86, -1.0, b);               // pillow
    box(1.42, 0.34, 1.9, flat(blanket), 0, 0.64, 0.5, b);
  }

  // a villager home grown out of a giant stump: walk in through the doorway
  function stumpHome(x, z, faceAngle, roofMat, s = 1, look = {}) {
    const g = new T.Group();
    g.position.set(x, 0, z); g.rotation.y = faceAngle; g.scale.setScalar(s);
    scene.add(g);
    const W = { rB: 5.0, rT: 4.5, rIn: 4.15, h: 5.4, half: 1.3, doorH: 4.4 }, flip = look.flip || 1;
    const front = roundWalls(g, { ...W, outer: M.stump, inner: M.carved });
    coneRoof(g, 6.3, 4.0, W.h - 0.15, roofMat);
    cyl(0.5, 0.6, 2.6, M.rock, 0, 7.9, -3.3, g, 6);                // chimney, above the hearth
    for (let i = 0; i < 6; i++) {                                  // roots, leaving the doorway clear
      const a = Math.PI / 2 + 1.0 + i * (Math.PI * 2 - 2.0) / 5;
      const root = add(new T.ConeGeometry(0.9, 3.4, 5), M.bark, Math.cos(a) * 6.2, 0.5, Math.sin(a) * 6.2, g);
      root.rotation.set(Math.sin(a) * 2.0, 0, -Math.cos(a) * 2.0);
    }
    box(2.6, 0.12, 1.1, M.planks, 0, 0.06, front + 0.45, g);       // doorstep
    lantern(-(W.half + 0.85), 3.7, front + 0.2, g);
    for (const th of [1.05, -1.05]) roundWindow(g, th, 3.0, 4.84, W.rIn * 0.972);

    // ---- the room ----
    lay(new T.CircleGeometry(W.rIn + 0.5, 18), M.floor, 0, 0.04, 0, g);
    lay(new T.CircleGeometry(1.8, 14), rug(look.rug || '#8a1422'), 0, 0.06, 0.3, g);
    lay(new T.RingGeometry(1.4, 1.56, 14), rug('#e8b84a', 6), 0, 0.08, 0.3, g);
    lantern(0, W.h - 0.9, 0, g);
    const bx = -1.85 * flip, tx = 2.05 * flip, tz = 0.3, th = 2.5 * flip;
    bed(g, bx, 0, -1.35, look.blanket || '#b3182c');
    cyl(0.95, 0.95, 0.12, M.planks, tx, 1.08, tz, g, 10);          // table, a candle, two stools
    cyl(0.18, 0.26, 1.02, M.bark, tx, 0.51, tz, g, 6);
    box(0.14, 0.3, 0.14, M.glow, tx, 1.29, tz, g);
    const stools = [[tx + 1.3 * flip, tz + 0.2], [tx - 0.2 * flip, tz - 1.35]];
    for (const [sx, sz] of stools) cyl(0.34, 0.3, 0.6, M.planks, sx, 0.3, sz, g, 8);
    box(1.7, 1.4, 0.9, M.rock, 0, 0.7, -3.5, g);                   // hearth with a fire in it
    box(1.0, 0.8, 0.2, M.dark, 0, 0.5, -3.06, g);
    add(new T.ConeGeometry(0.26, 0.6, 5), M.fire, 0, 0.42, -2.98, g);
    box(1.1, W.h - 1.4, 0.6, M.rock, 0, 1.4 + (W.h - 1.4) / 2, -3.62, g);
    const shelf = new T.Group();                                   // shelves of jars against the wall
    shelf.position.set(Math.sin(th) * 3.45, 0, Math.cos(th) * 3.45); shelf.rotation.y = th + Math.PI;
    g.add(shelf);
    box(1.7, 2.9, 0.5, M.planks, 0, 1.45, 0, shelf);
    const jars = ['#b3182c', '#e8b84a', '#3f7fa6', '#4c8a36'];
    [1.0, 1.85, 2.65].forEach((y, i) => { for (let j = -1; j <= 1; j++) box(0.36, 0.42, 0.3, flat(jars[(i + j + 3) % 4]), j * 0.5, y, 0.18, shelf); });

    // ---- what the player cannot walk through ----
    const sinF = Math.sin(faceAngle), cosF = Math.cos(faceAngle);
    const at = (lx, lz) => [x + s * (lx * cosF + lz * sinF), z + s * (-lx * sinF + lz * cosF)];
    const solid = (lx, lz, rad, top) => block(...at(lx, lz), rad * s, -Infinity, top * s);
    colliders.push({ ring: true, x, z, rIn: W.rIn * s, rOut: W.rB * s, door: faceAngle, half: W.half * s, yMin: -Infinity, yMax: Infinity });
    interiors.push({ x, z, r: W.rIn * s, yMin: -1, yMax: W.h * s });
    solid(bx, -2.0, 0.85, 0.9); solid(bx, -0.7, 0.85, 0.9);
    solid(tx, tz, 1.0, 1.1);
    for (const [sx, sz] of stools) solid(sx, sz, 0.4, 0.6);
    solid(0, -3.4, 1.0, W.h);
    solid(Math.sin(th) * 3.45, Math.cos(th) * 3.45, 0.85, 2.9);
    return g;
  }

  // a round hut on a platform at the top of a tree trunk, reached by ladder or rope bridge
  // gaps: directions [dx, dz] in which the railing is left open
  function stiltHut(x, z, y, roofMat, gaps = [], look = {}) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    const fy = y + 0.15, W = { rB: 4.3, rT: 4.3, rIn: 3.85, h: 4.6, half: 1.2, doorH: 4.2 }, PR = 6;
    cyl(1.5, 2.2, y, M.bark, 0, y / 2, 0, g, 9);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.257 + 0.4, root = add(new T.ConeGeometry(0.9, 4.4, 5), M.bark, Math.cos(a) * 3.2, 1.3, Math.sin(a) * 3.2, g);
      root.rotation.set(Math.sin(a) * 2.0, 0, -Math.cos(a) * 2.0);
    }
    cyl(PR, PR, 0.3, M.planks, 0, y, 0, g, 16);
    for (let i = 0; i < 6; i++) {                                  // struts under the platform
      const a = (i / 6) * Math.PI * 2 + 0.3, strut = box(0.26, 4.6, 0.26, M.bark, Math.cos(a) * 3.0, y - 1.95, Math.sin(a) * 3.0, g);
      strut.rotation.set(Math.sin(a) * 0.72, 0, -Math.cos(a) * 0.72);
    }
    const open = gaps.map(([dx, dz]) => Math.atan2(dz, dx));
    for (let i = 0; i < 20; i++) {                                 // railing posts, open at the ladder and the bridges
      const a = (i / 20) * Math.PI * 2;
      if (open.some(o => Math.abs(Math.atan2(Math.sin(a - o), Math.cos(a - o))) < 0.3)) continue;
      box(0.12, 1.0, 0.12, M.planks, Math.cos(a) * (PR - 0.15), fy + 0.5, Math.sin(a) * (PR - 0.15), g);
    }
    roundWalls(g, { ...W, y: fy, outer: M.boardsOut, inner: M.boardsIn });
    coneRoof(g, 5.5, 3.3, fy + W.h - 0.15, roofMat, 10);
    for (const [lx, ly, lz, sc] of [[-3.4, 8.0, -2.4, 3.4], [3.4, 7.8, -2.6, 3.3], [0.2, 9.4, -1.6, 3.6], [0.3, 7.4, -4.6, 3.2]]) {
      const c = add(canopyGeo, M.leaves, lx, fy + ly, lz, g);      // the tree's crown, grown round the roof
      c.scale.set(sc, sc * 0.75, sc);
    }
    for (const th of [1.15, -1.15]) roundWindow(g, th, fy + 2.7, W.rB + 0.04, W.rIn * 0.972, 0.65);
    lantern(-(W.half + 0.8), fy + 3.6, W.rB + 0.25, g);

    // ---- the room ----
    lay(new T.CircleGeometry(1.5, 12), rug(look.rug || '#3f7fa6'), 0, fy + 0.03, 0.2, g);
    lantern(0, fy + W.h - 0.38, 0, g);                             // high enough for OG ToneDa to walk under
    box(1.3, 0.3, 2.7, flat(look.blanket || '#e8b84a'), -2.0, fy + 0.15, -1.1, g);     // bedroll and pillow
    box(0.9, 0.24, 0.55, M.white, -2.0, fy + 0.36, -2.1, g);
    box(1.0, 1.0, 1.0, M.planks, 2.2, fy + 0.5, -1.4, g).rotation.y = 0.3;             // crates and a barrel
    box(0.7, 0.7, 0.7, M.planks, 2.25, fy + 1.35, -1.4, g).rotation.y = -0.2;
    cyl(0.5, 0.5, 1.1, M.planks, 0.9, fy + 0.55, -2.9, g, 8);

    block(x, z, 2.4, -Infinity, y - 0.5);                          // the trunk below
    colliders.push({ ring: true, x, z, rIn: W.rIn, rOut: W.rB, door: 0, half: W.half, yMin: y - 0.5, yMax: Infinity });
    interiors.push({ x, z, r: W.rIn, yMin: y - 0.5, yMax: fy + W.h });
    block(x - 2.0, z - 1.6, 0.75, y - 0.5, fy + 0.3); block(x - 2.0, z - 0.5, 0.75, y - 0.5, fy + 0.3);
    block(x + 2.2, z - 1.4, 0.8, y - 0.5, fy + 2);
    block(x + 0.9, z - 2.9, 0.6, y - 0.5, fy + 1.1);
    surfaces.push({ type: 'disc', x, z, r: PR, y: fy });
    return g;
  }

  // ---------- the Trap House: a big cabin on stilts, open to walk into ----------
  // Platform 12 x 12 with its floor at y = 5.2. The cabin sits toward the back, leaving a porch in front.
  const TH = { x: -9, z: -8.5 }, FY = 5.2;
  const house = new T.Group();
  house.position.set(TH.x, 0, TH.z);
  scene.add(house);
  for (const px of [-5.2, 0, 5.2]) for (const pz of [-5.2, 0, 5.2]) {
    if (!px && !pz) continue;
    cyl(0.4, 0.5, 5, M.bark, px, 2.5, pz, house, 7);
    block(TH.x + px, TH.z + pz, 0.7, -Infinity, 4.5);
  }
  box(12, 0.4, 12, M.planks, 0, 5, 0, house);
  for (let i = -5; i <= 5; i++) for (const [px, pz, edge] of [[i * 1.17, -5.85, 'back'], [-5.85, i * 1.17, ''], [5.85, i * 1.17, ''], [i * 1.17, 5.85, 'front']]) {
    if (edge === 'front' && Math.abs(px) < 1) continue;                   // gap at the top of the ladder
    if (edge === 'back' && Math.abs(px - 2) < 1) continue;                // gap where the rope bridge lands
    box(0.12, 1.0, 0.12, M.planks, px, 5.7, pz, house);
  }
  for (const [w, d, px, pz] of [[6.85, 0.1, -2.42, -5.85], [2.85, 0.1, 4.42, -5.85], [0.1, 11.7, -5.85, 0], [0.1, 11.7, 5.85, 0], [4.85, 0.1, -3.42, 5.85], [4.85, 0.1, 3.42, 5.85]]) {
    box(w, 0.1, d, M.planks, px, 6.2, pz, house);
  }
  // the cabin: 9 wide, 7 deep, walls 4.8 high, centred at z = -1 on the platform
  const CW = 4.5, CZ0 = -4.5, CZ1 = 2.5, WH = 4.8, DOOR = 1.3, DOORH = 4.4, wy = FY + WH / 2;
  box(CW * 2, WH, 0.3, M.cabin, 0, wy, CZ0 + 0.15, house);                                   // back wall
  for (const sx of [-1, 1]) box(0.3, WH, CZ1 - CZ0, M.cabin, sx * (CW - 0.15), wy, -1, house);   // side walls
  for (const sx of [-1, 1]) box(CW - DOOR, WH, 0.3, M.cabin, sx * (CW + DOOR) / 2, wy, CZ1 - 0.15, house);   // front, either side of the door
  box(DOOR * 2, WH - DOORH, 0.3, M.cabin, 0, FY + DOORH + (WH - DOORH) / 2, CZ1 - 0.15, house);
  for (const sx of [-1, 1]) box(0.3, DOORH, 0.56, M.planks, sx * (DOOR + 0.15), FY + DOORH / 2, CZ1 - 0.15, house);   // door frame
  box(DOOR * 2 + 0.6, 0.34, 0.56, M.planks, 0, FY + DOORH + 0.15, CZ1 - 0.15, house);
  const rise = 3.0, over = 0.7, top = FY + WH, slopeLen = Math.hypot(CW + over, (CW + over) * rise / CW);
  for (const sx of [-1, 1]) {                                             // pitched red roof, ridge running front to back
    const slope = box(slopeLen, 0.25, CZ1 - CZ0 + 1.2, M.roof, sx * (CW + over) / 2, top + rise - (CW + over) / 2 * rise / CW, -1, house);
    slope.rotation.z = -sx * Math.atan2(rise, CW);
  }
  box(0.36, 0.36, CZ1 - CZ0 + 1.4, flat('#7a0f1f'), 0, top + rise + 0.08, -1, house);
  for (const gz of [CZ1, CZ0]) {                                          // gable ends
    const tri = new T.BufferGeometry();
    tri.setAttribute('position', new T.Float32BufferAttribute([-CW, 0, 0, CW, 0, 0, 0, rise, 0], 3));
    tri.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 0.62], 2));
    tri.setAttribute('normal', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    add(tri, lam(X.planks, '#d4b088', { side: T.DoubleSide }), 0, top, gz, house);
  }
  const trapSign = add(new T.PlaneGeometry(3.6, 1.15), new T.MeshBasicMaterial({ map: signTexture('TRAP', { color: '#ff1f1f', outline: '#3a0508' }), transparent: true }), 0, top + 0.95, CZ1 + 0.03, house);
  trapSign.renderOrder = 1;
  box(CW * 2 - 0.3, 0.3, 0.3, M.planks, 0, top - 0.15, -1, house);          // tie beam, with a lantern hung from it
  lantern(0, top - 0.45, -1, house);
  lantern(-(DOOR + 0.9), FY + 3.7, CZ1 + 0.25, house);
  for (const sx of [-1, 1]) {                                             // side windows
    const out = add(new T.PlaneGeometry(1.7, 1.7), M.glow, sx * (CW + 0.01), FY + 2.9, -1, house); out.rotation.y = sx * Math.PI / 2;
    const inn = add(new T.PlaneGeometry(1.7, 1.7), M.daylight, sx * (CW - 0.31), FY + 2.9, -1, house); inn.rotation.y = -sx * Math.PI / 2;
  }

  // ---- inside the Trap House ----
  lay(new T.PlaneGeometry(4.6, 3.4), rug('#e8b84a', 3), 0, FY + 0.02, -0.7, house);
  lay(new T.PlaneGeometry(4.2, 3.0), rug('#8a1422', 5), 0, FY + 0.03, -0.7, house);
  box(1.3, 0.75, 3.6, M.black, -3.5, FY + 0.375, -0.6, house);              // couch along the left wall
  box(0.4, 1.7, 3.6, M.black, -3.98, FY + 0.85, -0.6, house);
  for (const dz of [-1.9, 1.9]) box(1.3, 1.1, 0.4, M.black, -3.5, FY + 0.55, -0.6 + dz, house);
  for (const dz of [-0.85, 0.85]) box(0.95, 0.3, 1.5, M.red, -3.4, FY + 0.9, -0.6 + dz, house);
  box(1.7, 0.6, 1.0, lam(X.planks, '#8a6a48'), -1.5, FY + 0.3, -0.6, house);                 // low table
  const desk = lam(X.planks, '#7a5a3a');
  box(3.4, 1.25, 1.0, desk, 0, FY + 0.625, -3.6, house);                    // the decks: two platters and a mixer
  for (const sx of [-1, 1]) {
    cyl(0.45, 0.45, 0.06, M.black, sx * 0.95, FY + 1.28, -3.6, house, 12);
    cyl(0.15, 0.15, 0.07, M.red, sx * 0.95, FY + 1.285, -3.6, house, 8);
  }
  box(0.7, 0.12, 0.62, flat('#30313b'), 0, FY + 1.31, -3.6, house);
  for (const sx of [-1, 1]) {                                             // speaker stacks in the back corners
    box(1.2, 2.8, 1.0, M.black, sx * 3.4, FY + 1.4, -3.6, house);
    add(new T.CircleGeometry(0.42, 12), new T.MeshBasicMaterial({ color: '#3a3a44' }), sx * 3.4, FY + 0.85, -3.09, house);
    add(new T.RingGeometry(0.42, 0.5, 12), M.gold, sx * 3.4, FY + 0.85, -3.085, house);
    add(new T.CircleGeometry(0.2, 10), new T.MeshBasicMaterial({ color: '#3a3a44' }), sx * 3.4, FY + 2.05, -3.09, house);
  }
  const banner = add(new T.PlaneGeometry(2.6, 1.3), new T.MeshBasicMaterial({ map: signTexture('T1', { w: 128, h: 64, color: '#f5c95b', font: 'bold 54px Georgia', bg: '#7a0f1f' }) }), 0, FY + 3.3, CZ0 + 0.31, house);
  banner.renderOrder = 1;
  bed(house, 3.4, FY, -0.2, '#b3182c');                                    // bed along the right wall
  box(0.9, 0.9, 0.9, M.planks, 3.6, FY + 0.45, 1.75, house).rotation.y = 0.2;                // crates and a barrel by the door
  box(0.7, 0.7, 0.7, M.planks, 2.75, FY + 0.35, 1.9, house).rotation.y = -0.3;
  cyl(0.5, 0.5, 1.1, M.planks, -3.7, FY + 0.55, 1.75, house, 8);
  cyl(0.04, 0.04, 2.3, flat('#30313b'), 1.9, FY + 1.15, -2.5, house, 5);    // mic stand
  cyl(0.3, 0.3, 0.06, flat('#30313b'), 1.9, FY + 0.03, -2.5, house, 8);
  add(new T.SphereGeometry(0.13, 6, 5), M.black, 1.9, FY + 2.35, -2.5, house);

  ladder(0, 6.4, FY, Math.PI, house, { x: TH.x, z: TH.z + 6.75, face: Math.PI, top: FY, exit: [TH.x, TH.z + 5] });
  surfaces.push({ type: 'rect', x0: TH.x - 6, x1: TH.x + 6, z0: TH.z - 6, z1: TH.z + 6, y: FY });
  // walls, then furniture (each can be stood on if you jump up)
  const wall = (x0, x1, z0, z1, yMax = Infinity) => colliders.push({ box: true, x0: TH.x + x0, x1: TH.x + x1, z0: TH.z + z0, z1: TH.z + z1, yMin: 4.5, yMax });
  wall(-CW, CW, CZ0, CZ0 + 0.3); wall(-CW, -CW + 0.3, CZ0, CZ1); wall(CW - 0.3, CW, CZ0, CZ1);
  wall(-CW, -DOOR, CZ1 - 0.3, CZ1); wall(DOOR, CW, CZ1 - 0.3, CZ1);
  const piece = (x0, x1, z0, z1, h) => {
    wall(x0, x1, z0, z1, FY + h - 0.05);
    surfaces.push({ type: 'rect', x0: TH.x + x0, x1: TH.x + x1, z0: TH.z + z0, z1: TH.z + z1, y: FY + h });
  };
  piece(-4.2, -2.85, -2.7, 1.5, 0.75);                                    // couch
  piece(-2.35, -0.65, -1.1, -0.1, 0.6);                                   // low table
  piece(-1.7, 1.7, -4.2, -3.1, 1.25);                                     // decks
  piece(2.65, 4.2, -1.7, 1.3, 0.92);                                      // bed
  wall(-4.0, -2.8, -4.2, -3.1); wall(2.8, 4.0, -4.2, -3.1);               // speakers
  block(TH.x + 3.6, TH.z + 1.75, 0.65, 4.5, FY + 0.9); block(TH.x + 2.75, TH.z + 1.9, 0.5, 4.5, FY + 0.7);
  block(TH.x - 3.7, TH.z + 1.75, 0.6, 4.5, FY + 1.1); block(TH.x + 1.9, TH.z - 2.5, 0.3, 4.5, FY + 2.3);
  interiors.push({ x0: TH.x - CW + 0.3, x1: TH.x + CW - 0.3, z0: TH.z + CZ0 + 0.3, z1: TH.z + CZ1 - 0.3, yMin: 4.5, yMax: top + rise });

  // ---------- treetop huts and rope bridges ----------
  const redRoof = M.roof, greenRoof = lam(X.leaves, '#b8d890'), strawRoof = M.thatch;
  const H1 = [-22, -17], H2 = [-7, -26], toward = (a, b, d) => { const k = d / Math.hypot(b[0] - a[0], b[1] - a[1]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  const landing = [TH.x + 2, TH.z - 5.9];                                 // where the bridge meets the Trap House platform
  stiltHut(...H1, 5, strawRoof, [[0, 1], [H2[0] - H1[0], H2[1] - H1[1]]], { rug: '#3f7fa6', blanket: '#e8b84a' });
  stiltHut(...H2, 5, greenRoof, [[0, 1], [H1[0] - H2[0], H1[1] - H2[1]]], { rug: '#8a1422', blanket: '#4c8a36' });
  ropeBridge(toward(H1, H2, 5.85), toward(H2, H1, 5.85), 5.1);
  ropeBridge([H2[0], H2[1] + 5.85], landing, 5.1);
  ladder(H1[0], H1[1] + 6.4, 5.1, Math.PI, scene, { x: H1[0], z: H1[1] + 6.75, face: Math.PI, top: 5.15, exit: [H1[0], H1[1] + 5] });

  // ---------- stump homes, each with its door turned toward the plaza ----------
  const facing = (x, z) => Math.atan2(1 - x, 1 - z);
  stumpHome(-25, 7, facing(-25, 7), strawRoof, 1, { rug: '#3f7fa6', blanket: '#e8b84a' });
  stumpHome(-6, 24.5, facing(-6, 24.5), redRoof, 0.92, { rug: '#8a1422', blanket: '#b3182c', flip: -1 });
  stumpHome(18, 21, facing(18, 21), greenRoof, 1.05, { rug: '#4c8a36', blanket: '#3f7fa6' });

  // ---------- the Great Trap Tree ----------
  const elder = new T.Group();
  elder.position.set(10, 0, -10);
  elder.rotation.y = Math.atan2(1 - 10, 1 + 10);                          // faces the plaza
  scene.add(elder);
  const trunkGeo = new T.CylinderGeometry(2.6, 3.7, 15, 12, 6);
  const tp = trunkGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const a = Math.atan2(tp.getZ(i), tp.getX(i)), k = 1 + Math.sin(a * 5 + tp.getY(i) * 0.5) * 0.07;
    tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k);
  }
  trunkGeo.computeVertexNormals();
  add(trunkGeo, lam(bigBark), 0, 7.5, 0, elder);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2, root = add(new T.ConeGeometry(1.2, 5, 6), M.bark, Math.cos(a) * 4.9, 1.35, Math.sin(a) * 4.9, elder);
    root.rotation.set(Math.sin(a) * 2.0, 0, -Math.cos(a) * 2.0);
  }
  const eyeGlow = new T.MeshBasicMaterial({ color: '#ffd24a' });
  for (const sx of [-1, 1]) {                                             // an old, heavy-browed face
    const socket = add(new T.SphereGeometry(0.62, 8, 6), M.dark, sx * 1.05, 7.4, 2.75, elder);
    socket.scale.set(1, 0.8, 0.45);
    add(new T.SphereGeometry(0.2, 6, 5), eyeGlow, sx * 1.05, 7.35, 3.0, elder);
    const brow = box(1.7, 0.42, 0.7, M.bark, sx * 1.1, 8.15, 2.85, elder);
    brow.rotation.z = -sx * 0.28;
  }
  const nose = add(new T.ConeGeometry(0.55, 1.9, 6), M.bark, 0, 6.6, 3.35, elder);
  nose.rotation.x = 0.5;
  const mouth = add(new T.SphereGeometry(1, 10, 6), M.dark, 0, 5.2, 3.0, elder);
  mouth.scale.set(1.25, 0.34, 0.4);
  for (const sx of [-1, 1]) {
    const whisker = add(new T.ConeGeometry(0.34, 2.2, 5), M.bark, sx * 1.25, 5.75, 3.2, elder);
    whisker.rotation.z = sx * 2.0;
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, d = i === 0 ? 0 : 4.6;
    const c = add(canopyGeo, lam(X.leaves, i % 2 ? '#dff0c0' : '#ffffff', { flatShading: true }), Math.cos(a) * d, 16 + (i % 3) * 1.3, Math.sin(a) * d, elder);
    c.scale.set(5.6, 4.3, 5.6);
  }
  block(10, -10, 4.0);

  // ---------- pond ----------
  const pond = { x: -11.5, z: 14, r: 4.6 };
  const bank = add(new T.CircleGeometry(pond.r + 0.9, 18), pathMat, pond.x, 0.03, pond.z);
  bank.rotation.x = -Math.PI / 2;
  const waterMat = new T.MeshLambertMaterial({ map: X.water, transparent: true, opacity: 0.86, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const water = add(new T.CircleGeometry(pond.r, 18), waterMat, pond.x, 0.05, pond.z);
  water.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 6; i++) {
    const a = r() * 6.28, d = r() * (pond.r - 0.8);
    const pad = add(new T.CircleGeometry(0.34 + r() * 0.2, 7, 0.4, 5.6), new T.MeshLambertMaterial({ color: '#3f9a4a', polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }), pond.x + Math.cos(a) * d, 0.07, pond.z + Math.sin(a) * d);
    pad.rotation.x = -Math.PI / 2; pad.rotation.z = r() * 6;
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.4;
    const stone = add(new T.DodecahedronGeometry(0.45 + r() * 0.35, 0), M.rock, pond.x + Math.cos(a) * (pond.r + 0.5), 0.2, pond.z + Math.sin(a) * (pond.r + 0.5));
    stone.rotation.set(r() * 3, r() * 3, r() * 3);
  }

  // ---------- market stall ----------
  const stall = new T.Group();
  stall.position.set(2, 0, -16);
  scene.add(stall);
  box(4, 1, 1.4, M.planks, 0, 0.5, 0, stall);
  for (const x of [-2, 2]) for (const z of [-0.9, 0.9]) box(0.16, 3, 0.16, M.planks, x, 1.5, z, stall);
  const awn = box(4.6, 0.12, 2.6, lam(X.awning), 0, 3.05, 0.2, stall);
  awn.rotation.x = 0.2;
  const t1 = add(new T.PlaneGeometry(1.5, 0.75), new T.MeshBasicMaterial({ map: signTexture('T1', { w: 128, h: 64, color: '#f5c95b', font: 'bold 54px Georgia', bg: '#7a0f1f' }) }), 0, 2.2, 0.95, stall);
  t1.renderOrder = 1;
  for (const [x, z, s] of [[2.9, 0.5, 0.9], [3.2, -0.5, 0.7], [-2.9, 0.3, 0.8]]) box(s, s, s, M.planks, x, s / 2, z, stall).rotation.y = r();
  cyl(0.45, 0.45, 1, M.planks, -3.1, 0.5, -0.8, stall, 8);
  block(2, -16, 2.3); block(5, -15.9, 0.9); block(-1, -16.1, 0.9);

  // ---------- training clearing: a fence arc and a signpost ----------
  const ring = { x: 8, z: 6, r: 7.5 };
  let prev = null;
  for (let i = 0; i <= 16; i++) {
    const a = 0.55 + (i / 16) * 2.85, x = ring.x + Math.cos(a) * ring.r, z = ring.z + Math.sin(a) * ring.r;
    cyl(0.12, 0.14, 1.1, M.planks, x, 0.55, z, scene, 6);
    block(x, z, 0.28);
    if (prev) for (const y of [0.45, 0.85]) {
      const rail = box(0.07, 0.07, Math.hypot(x - prev[0], z - prev[1]), M.planks, (x + prev[0]) / 2, y, (z + prev[1]) / 2);
      rail.rotation.y = Math.atan2(x - prev[0], z - prev[1]);
    }
    prev = [x, z];
  }
  function signpost(x, z, text, rotY) {
    cyl(0.09, 0.11, 1.7, M.planks, x, 0.85, z, scene, 6);
    const board = box(1.7, 0.6, 0.08, M.planks, x, 1.55, z);
    board.rotation.y = rotY;
    const label = add(new T.PlaneGeometry(1.6, 0.5), new T.MeshBasicMaterial({ map: signTexture(text, { w: 256, h: 80, color: '#3a2412', font: 'bold 30px Georgia' }), transparent: true }), x + Math.sin(rotY) * 0.05, 1.55, z + Math.cos(rotY) * 0.05);
    label.rotation.y = rotY;
    block(x, z, 0.3);
  }
  signpost(4.2, 4.6, 'TRAINING', -0.6);
  signpost(5.2, -3.2, 'GREAT TREE', 0.5);
  signpost(34, 4.8, 'WOODS', -1.5);

  // ---------- the way out: a hollow log through the cliff ----------
  const log = add(new T.CylinderGeometry(3.2, 3.4, 9, 12, 1, true), lam(bigBark, '#ffffff', { side: T.DoubleSide }), RADIUS + 2, 2.6, 2.2);
  log.rotation.z = Math.PI / 2;
  const hole = add(new T.CircleGeometry(3.1, 12), M.dark, RADIUS - 1.6, 2.6, 2.2);
  hole.rotation.y = -Math.PI / 2;

  // ---------- scattered grass tufts, flowers and rocks ----------
  // nothing grows inside a home, on its doorstep, or in the pond
  const clear = (x, z) => colliders.every(c => c.box || (c.ring ? c.yMin > 0 || Math.hypot(c.x - x, c.z - z) > c.rOut + 1.6 : Math.hypot(c.x - x, c.z - z) > c.r + 0.4))
    && Math.hypot(x - pond.x, z - pond.z) > pond.r + 0.3;
  function scatter(count, map, w, h) {
    const quad = new T.PlaneGeometry(w, h); quad.translate(0, h / 2, 0);
    const other = quad.clone(); other.rotateY(Math.PI / 2);
    const merged = new T.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      merged.setAttribute(name, new T.BufferAttribute(new Float32Array([...quad.attributes[name].array, ...other.attributes[name].array]), quad.attributes[name].itemSize));
    }
    merged.setIndex([...quad.index.array, ...Array.from(other.index.array, i => i + 4)]);
    const mesh = new T.InstancedMesh(merged, new T.MeshLambertMaterial({ map, alphaTest: 0.5, side: T.DoubleSide }), count);
    const m = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
    let placed = 0;
    while (placed < count) {
      const a = r() * 6.28, d = Math.sqrt(r()) * (RADIUS - 2), x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!clear(x, z)) continue;
      const s = 0.7 + r() * 0.7;
      m.compose(new T.Vector3(x, 0, z), q.setFromAxisAngle(up, r() * 3.14), new T.Vector3(s, s, s));
      mesh.setMatrixAt(placed++, m);
    }
    scene.add(mesh);
  }
  scatter(620, X.tuft, 0.9, 0.7);
  scatter(160, X.flower, 0.8, 0.6);
  for (let i = 0; i < 24; i++) {
    const a = r() * 6.28, d = 8 + r() * (RADIUS - 11), x = Math.cos(a) * d, z = Math.sin(a) * d, s = 0.5 + r() * 0.8;
    if (!clear(x, z) || Math.hypot(x - ring.x, z - ring.z) < ring.r || trail.some(p => Math.hypot(p.x - x, p.z - z) < s + 2)) continue;
    const stone = add(new T.DodecahedronGeometry(s, 0), M.rock, x, s * 0.45, z);
    stone.rotation.set(r() * 3, r() * 3, r() * 3);
    block(x, z, s * 0.85);
  }

  // ---------- drifting forest lights ----------
  const flyCount = 70, fp = new Float32Array(flyCount * 3), seeds = [];
  for (let i = 0; i < flyCount; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * (RADIUS - 3);
    seeds.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 1 + r() * 6, p: r() * 6.28, s: 0.3 + r() * 0.5 });
  }
  const dot = tex(16, (g, n) => {
    const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.7)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, n, n);
  });
  const flyGeo = new T.BufferGeometry();
  flyGeo.setAttribute('position', new T.BufferAttribute(fp, 3));
  const flies = new T.Points(flyGeo, new T.PointsMaterial({ color: '#f4ffb0', size: 0.34, map: dot, transparent: true, opacity: 0.9, depthWrite: false }));
  flies.frustumCulled = false;
  scene.add(flies);

  // Solid meshes the camera should not pass through (flat decals and the ground are skipped).
  const solids = [];
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || ['PlaneGeometry', 'CircleGeometry', 'RingGeometry', 'ShapeGeometry', 'BufferGeometry'].includes(o.geometry.type)) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    // posts, rails, planks and ropes are too thin to bother the camera
    if (o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) > 1.2) solids.push(o);
  });

  // Nothing in the village moves, so its transforms are worked out once here, not every frame.
  // (Anything added to the scene later, like ToneDa, Niggy and the Opps, still moves as normal.)
  scene.updateMatrixWorld(true);
  scene.traverse(o => { if (o !== scene) o.matrixAutoUpdate = false; });

  let time = 0;
  function update(dt) {
    time += dt;
    X.water.offset.set(time * 0.012, Math.sin(time * 0.3) * 0.02);
    for (let i = 0; i < flyCount; i++) {
      const f = seeds[i];
      fp[i * 3] = f.x + Math.sin(time * f.s + f.p) * 1.6;
      fp[i * 3 + 1] = f.y + Math.sin(time * f.s * 1.7 + f.p * 2) * 0.8;
      fp[i * 3 + 2] = f.z + Math.cos(time * f.s * 0.8 + f.p) * 1.6;
    }
    flyGeo.attributes.position.needsUpdate = true;
  }

  // Push a point out of every obstacle at its height and keep it inside the village.
  function resolve(pos, radius = 0.45) {
    for (const c of colliders) {
      if (pos.y < c.yMin || pos.y > c.yMax) continue;
      if (c.ring) {                               // a round wall with a doorway
        const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz);
        if (d >= c.rOut + radius || d <= c.rIn - radius) continue;
        const ax = Math.sin(c.door), az = Math.cos(c.door);                 // which way the door faces
        const along = dx * ax + dz * az, side = dx * az - dz * ax;
        if (along > 0 && Math.abs(side) < c.half) {                         // in the doorway: only the door posts push back
          const k = Math.sign(side) * Math.min(Math.abs(side), Math.max(0, c.half - radius)) - side;
          pos.x += az * k; pos.z -= ax * k;
          continue;
        }
        const to = d > (c.rIn + c.rOut) / 2 ? c.rOut + radius : c.rIn - radius;
        if (d > 1e-4) { pos.x = c.x + dx / d * to; pos.z = c.z + dz / d * to; }
        continue;
      }
      if (c.box) {
        const x0 = c.x0 - radius, x1 = c.x1 + radius, z0 = c.z0 - radius, z1 = c.z1 + radius;
        if (pos.x <= x0 || pos.x >= x1 || pos.z <= z0 || pos.z >= z1) continue;
        const out = [[pos.x - x0, 'x', x0], [x1 - pos.x, 'x', x1], [pos.z - z0, 'z', z0], [z1 - pos.z, 'z', z1]].sort((p, q) => p[0] - q[0])[0];
        pos[out[1]] = out[2];
        continue;
      }
      const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 1e-4) { pos.x = c.x + dx / d * min; pos.z = c.z + dz / d * min; }
    }
    const d = Math.hypot(pos.x, pos.z), max = RADIUS - 2.1;
    if (d > max) { pos.x *= max / d; pos.z *= max / d; }
  }

  // Height of the floor under a point: the highest surface that is not above knee height.
  function groundAt(x, z, y) {
    let best = 0;
    for (const f of surfaces) {
      let h = null;
      if (f.type === 'rect') { if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) h = f.y; }
      else if (f.type === 'disc') { if (Math.hypot(x - f.x, z - f.z) <= f.r) h = f.y; }
      else {
        const dx = f.b[0] - f.a[0], dz = f.b[1] - f.a[1], len2 = dx * dx + dz * dz;
        const t = ((x - f.a[0]) * dx + (z - f.a[1]) * dz) / len2;
        if (t >= 0 && t <= 1 && Math.hypot(x - (f.a[0] + dx * t), z - (f.a[1] + dz * t)) <= f.half) h = f.y - Math.sin(t * Math.PI) * f.sag;
      }
      if (h !== null && h <= y + 0.6 && h > best) best = h;
    }
    return best;
  }

  // Is this point inside one of the rooms?
  function indoors(x, z, y) {
    return interiors.some(i => y >= i.yMin && y <= i.yMax
      && (i.r !== undefined ? Math.hypot(x - i.x, z - i.z) < i.r : x > i.x0 && x < i.x1 && z > i.z0 && z < i.z1));
  }

  return { update, resolve, groundAt, indoors, ladders, surfaces, solids, colliders, interiors, radius: RADIUS, treePos: new T.Vector3(10, 0, -10), spawn: new T.Vector3(1, 0, 1) };
}
