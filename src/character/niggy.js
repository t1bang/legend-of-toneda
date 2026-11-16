// Niggy — the demon companion. A dark red orb with bat wings, a swappable face,
// a red glow and rising flames. Built from assets/references/niggy-character-sheet.png.
//
// Faces are drawn in code for now. To use painted faces instead, pass
// { faces: { idle: 'assets/niggy/niggy-face-idle.png', ... } } to the constructor.
import * as T from '../../vendor/three.module.min.js';

export const EXPRESSIONS = ['idle', 'talking', 'laughing', 'mad', 'surprised', 'confused', 'hurt'];
const RED = '#ff0000', UP = new T.Vector3(0, 1, 0);

// ---------- face drawing (128 x 128, transparent background) ----------
function eyeAngry(g, cx, side, tilt = 1) {
  // side: -1 for the eye on the left of the image, +1 for the right
  g.beginPath();
  g.moveTo(cx + side * 25, 28 - 6 * tilt);           // outer, high
  g.lineTo(cx - side * 19, 50 + 4 * tilt);           // inner, low
  g.quadraticCurveTo(cx - side * 4, 70, cx + side * 23, 56);
  g.closePath();
  g.fillStyle = '#fff'; g.fill();
  g.strokeStyle = RED; g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx + side * 16, 42); g.lineTo(cx - side * 8, 54);
  g.moveTo(cx + side * 17, 50); g.lineTo(cx - side * 2, 58);
  g.stroke();
}
function teeth(g, { open = 0, curve = 12, n = 8, top = 80 }) {
  // curve > 0 is a grin (corners up), curve < 0 is a scowl (corners down)
  const x0 = 26, x1 = 102, y = x => top - curve * (((x - 64) / 38) ** 2) + (curve > 0 ? curve * 0.3 : 0);
  const w = (x1 - x0) / n;
  if (open > 0) {
    g.beginPath();
    g.moveTo(x0, y(x0));
    for (let x = x0; x <= x1; x += 4) g.lineTo(x, y(x));
    for (let x = x1; x >= x0; x -= 4) g.lineTo(x, y(x) + open);
    g.closePath();
    g.fillStyle = '#1a0003'; g.fill();
  }
  g.fillStyle = '#fff';
  for (let i = 0; i < n; i++) {
    const a = x0 + i * w, m = a + w / 2, len = 11 + 7 * (1 - Math.abs((m - 64) / 38));
    g.beginPath(); g.moveTo(a, y(a)); g.lineTo(a + w, y(a + w)); g.lineTo(m, y(m) + len); g.closePath(); g.fill();
    if (open > 0) {
      g.beginPath(); g.moveTo(a, y(a) + open); g.lineTo(a + w, y(a + w) + open); g.lineTo(m, y(m) + open - len * 0.8); g.closePath(); g.fill();
    }
  }
}
const FACES = {
  idle(g) { eyeAngry(g, 40, -1); eyeAngry(g, 88, 1); teeth(g, {}); },
  talking(g) { eyeAngry(g, 40, -1); eyeAngry(g, 88, 1); teeth(g, { open: 26, top: 74, curve: 8 }); },
  laughing(g) {
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round';
    for (const cx of [40, 88]) { g.beginPath(); g.moveTo(cx - 15, 52); g.quadraticCurveTo(cx, 30, cx + 15, 52); g.stroke(); }
    teeth(g, { open: 22, top: 72, curve: 16 });
  },
  mad(g) { eyeAngry(g, 40, -1, 2); eyeAngry(g, 88, 1, 2); teeth(g, { curve: -12, top: 84, n: 7 }); },
  surprised(g) {
    g.fillStyle = '#fff';
    for (const cx of [40, 88]) { g.beginPath(); g.arc(cx, 46, 14, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.ellipse(64, 92, 9, 13, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1a0003'; g.beginPath(); g.ellipse(64, 92, 5, 9, 0, 0, Math.PI * 2); g.fill();
  },
  confused(g) {
    eyeAngry(g, 40, -1, 0.3);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(90, 44, 15, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(40, 98); g.quadraticCurveTo(62, 80, 88, 94); g.stroke();
  },
  hurt(g) {
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round';
    for (const cx of [40, 88]) {
      g.beginPath(); g.moveTo(cx - 12, 34); g.lineTo(cx + 12, 58); g.moveTo(cx + 12, 34); g.lineTo(cx - 12, 58); g.stroke();
    }
    g.beginPath(); g.moveTo(34, 90);
    for (let i = 0; i < 6; i++) g.lineTo(34 + (i + 1) * 10, 90 + (i % 2 ? 0 : 8));
    g.stroke();
  },
};
function faceTexture(name) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  FACES[name](c.getContext('2d'));
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,70,30,0.95)');
  grad.addColorStop(0.35, 'rgba(255,0,0,0.55)');
  grad.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
function wingGeometry() {
  const s = new T.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.13, 0.33);
  s.quadraticCurveTo(0.34, 0.37, 0.58, 0.17);
  s.quadraticCurveTo(0.47, 0.12, 0.43, -0.04);
  s.quadraticCurveTo(0.34, 0.03, 0.29, -0.13);
  s.quadraticCurveTo(0.21, -0.02, 0.13, -0.15);
  s.quadraticCurveTo(0.08, -0.05, 0, 0);
  return new T.ShapeGeometry(s, 3);
}

export class Niggy {
  constructor({ faces = null } = {}) {
    this.root = new T.Group();
    this.body = new T.Group();           // spins and tilts; root handles position and facing
    this.root.add(this.body);
    this.time = 0; this.spinLeft = 0; this.flash = 0; this.speaking = false;
    this.expression = 'idle'; this.temp = null; this.tempLeft = 0;
    this.velocity = new T.Vector3(); this.speed = 0;

    // orb: low-poly sphere, darker at the bottom, with a soft red rim
    const geo = new T.SphereGeometry(0.36, 12, 8), col = [], c = new T.Color();
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      c.set('#3a0004').lerp(new T.Color('#c80010'), Math.max(0, p.getY(i) / 0.36 * 0.5 + 0.45));
      col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    this.body.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true })));
    this.rim = new T.Mesh(new T.SphereGeometry(0.43, 12, 8),
      new T.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.3, side: T.BackSide, depthWrite: false }));
    this.body.add(this.rim);

    // face: a curved patch on the front of the orb, one texture per expression
    this.faceTextures = {};
    for (const name of EXPRESSIONS) this.faceTextures[name] = faceTexture(name);
    if (faces) {
      const loader = new T.TextureLoader();
      for (const [name, url] of Object.entries(faces)) {
        loader.load(url, t => { t.colorSpace = T.SRGBColorSpace; this.faceTextures[name] = t; this._applyFace(); });
      }
    }
    this.faceMat = new T.MeshBasicMaterial({ map: this.faceTextures.idle, transparent: true, depthWrite: false });
    this.face = new T.Mesh(new T.SphereGeometry(0.368, 8, 6, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.85, 1.7), this.faceMat);
    this.face.renderOrder = 2;
    this.body.add(this.face);

    // bat wings: the left one is a mirror of the right
    const wingMat = new T.MeshBasicMaterial({ color: '#14060a', side: T.DoubleSide });
    const wg = wingGeometry();
    this.wings = [];
    for (const side of [1, -1]) {
      const mirror = new T.Group();
      mirror.scale.x = side;
      const pivot = new T.Group();
      pivot.position.set(0.27, 0.13, -0.06);
      pivot.rotation.y = 0.35;
      pivot.add(new T.Mesh(wg, wingMat));
      mirror.add(pivot);
      this.body.add(mirror);
      this.wings.push(pivot);
    }

    // glow halo, flames and light
    const glow = glowTexture();
    const sprite = (opacity) => new T.Sprite(new T.SpriteMaterial({ map: glow, color: '#ffffff', transparent: true, opacity, depthWrite: false }));
    this.halo = sprite(0.5);
    this.halo.scale.setScalar(1.7);
    this.halo.renderOrder = 1;
    this.root.add(this.halo);
    this.flames = [];
    for (let i = 0; i < 8; i++) {
      const f = sprite(0.8);
      f.userData = { offset: i / 8, x: Math.sin(i * 2.4) * 0.16, z: Math.cos(i * 1.7) * 0.1, speed: 0.9 + (i % 3) * 0.25 };
      this.root.add(f);
      this.flames.push(f);
    }
    this.light = new T.PointLight('#ff182e', 1.8, 4);
    this.root.add(this.light);
  }

  _applyFace() {
    let name = this.tempLeft > 0 ? this.temp : this.expression;
    if (this.speaking && (name === 'idle' || name === 'talking')) name = Math.sin(this.time * 18) > 0 ? 'talking' : 'idle';
    const tex = this.faceTextures[name] || this.faceTextures.idle;
    if (this.faceMat.map !== tex) { this.faceMat.map = tex; this.faceMat.needsUpdate = true; }
  }

  // Standing mood. Use react() for a short one-off reaction.
  setExpression(name) { if (EXPRESSIONS.includes(name)) this.expression = name; }
  react(name, seconds = 1.2) { if (EXPRESSIONS.includes(name)) { this.temp = name; this.tempLeft = seconds; } }
  speak(on) { this.speaking = on; }
  spin() { this.spinLeft = 0.7; }
  warpTo(v) { this.root.position.copy(v); }

  // target: where he should hover; camera: so his face stays readable
  update(dt, target, camera) {
    this.time += dt;
    const t = this.time, before = this.root.position.clone();
    if (target) {
      const goal = target.clone();
      goal.y += Math.sin(t * 3.2) * 0.14;
      this.root.position.lerp(goal, 1 - Math.exp(-dt * 5.5));
    }
    this.velocity.copy(this.root.position).sub(before).divideScalar(Math.max(dt, 1e-4));
    this.speed += (Math.min(this.velocity.length(), 14) - this.speed) * Math.min(1, dt * 8);
    if (camera) this.root.rotation.y = Math.atan2(camera.position.x - this.root.position.x, camera.position.z - this.root.position.z);

    const excited = this.spinLeft > 0 || this.speed > 4;
    const flap = Math.sin(t * (excited ? 26 : 11));
    for (const w of this.wings) w.rotation.z = 0.12 + flap * (excited ? 0.6 : 0.42);
    if (this.spinLeft > 0) {
      this.spinLeft = Math.max(0, this.spinLeft - dt);
      this.body.rotation.y = (1 - this.spinLeft / 0.7) * Math.PI * 4;
    } else this.body.rotation.y = 0;
    this.body.rotation.z = Math.sin(t * 2.3) * 0.08;

    if (this.tempLeft > 0) this.tempLeft -= dt;
    this._applyFace();

    const pulse = 0.5 + Math.sin(t * 5) * 0.5;
    this.halo.scale.setScalar(1.65 + pulse * 0.18 + Math.min(this.speed, 10) * 0.03);
    this.rim.material.opacity = 0.26 + pulse * 0.12;
    this.light.intensity = 1.6 + pulse * 0.6;
    const lv = this.velocity.clone().applyAxisAngle(UP, -this.root.rotation.y); // velocity in his own frame
    for (const f of this.flames) {
      const u = f.userData, k = (t * u.speed + u.offset) % 1;
      // flames rise from the top and trail behind when he moves fast
      f.position.set(u.x * (1 - k * 0.5) - lv.x * 0.035 * k, 0.24 + k * 0.5 - lv.y * 0.03 * k, u.z - lv.z * 0.035 * k);
      f.scale.setScalar((1 - k) * 0.42 + 0.05);
      f.material.opacity = (1 - k) * 0.85;
    }
  }
}
