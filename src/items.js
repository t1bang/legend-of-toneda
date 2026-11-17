// Things ToneDa can use: flower pots to lift and smash, gold rings to collect, treasure chests to open.
// This file builds them and moves them; game.js decides when (keys, quests, dialogue).
import * as T from '../vendor/three.module.min.js';

const lam = color => new T.MeshLambertMaterial({ color, flatShading: true });
const M = {
  pot: lam('#8a4b2a'), potRim: lam('#9c5a34'), soil: lam('#3b2616'), stem: lam('#3f8a36'), petal: lam('#e8443a'), seed: lam('#f5c95b'),
  wood: lam('#7a4a24'), woodDark: lam('#5a3418'), gold: lam('#e8b84a'), black: lam('#1c1c22'), plate: lam('#3a3a44'),
  ring: new T.MeshBasicMaterial({ color: '#ffd54a' }), shine: new T.MeshBasicMaterial({ color: '#fff3b0' }),
};
function part(geometry, material, x, y, z, parent) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
const box = (w, h, d, m, x, y, z, parent) => part(new T.BoxGeometry(w, h, d), m, x, y, z, parent);

// A little brown flower pot with one flower in it. Its origin is the middle of its base.
function makePot() {
  const g = new T.Group();
  part(new T.CylinderGeometry(0.34, 0.2, 0.46, 8), M.pot, 0, 0.23, 0, g);
  part(new T.CylinderGeometry(0.39, 0.36, 0.11, 8), M.potRim, 0, 0.5, 0, g);
  part(new T.CylinderGeometry(0.31, 0.31, 0.02, 8), M.soil, 0, 0.56, 0, g);
  part(new T.CylinderGeometry(0.025, 0.035, 0.4, 4), M.stem, 0, 0.76, 0, g);
  for (const s of [-1, 1]) {
    const leaf = part(new T.ConeGeometry(0.09, 0.3, 4), M.stem, s * 0.12, 0.72, 0, g);
    leaf.rotation.z = -s * 1.1;
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, petal = part(new T.SphereGeometry(0.085, 5, 4), M.petal, Math.cos(a) * 0.11, 0.98, Math.sin(a) * 0.11, g);
    petal.scale.y = 0.6;
  }
  part(new T.SphereGeometry(0.07, 5, 4), M.seed, 0, 1.0, 0, g);
  return g;
}

// A wooden treasure chest with gold bands. It faces +Z; the lid is hinged along the back.
function makeChest() {
  const root = new T.Group(), lid = new T.Group();
  box(1.3, 0.62, 0.9, M.wood, 0, 0.31, 0, root);
  for (const x of [-0.46, 0.46]) box(0.13, 0.64, 0.93, M.gold, x, 0.31, 0, root);
  box(1.32, 0.08, 0.92, M.woodDark, 0, 0.04, 0, root);
  lid.position.set(0, 0.62, -0.45);
  root.add(lid);
  const arch = part(new T.CylinderGeometry(0.45, 0.45, 1.3, 10, 1, false, -Math.PI / 2, Math.PI), M.wood, 0, 0, 0.45, lid);
  arch.rotation.z = Math.PI / 2;
  for (const x of [-0.46, 0.46]) {
    const band = part(new T.CylinderGeometry(0.47, 0.47, 0.13, 10, 1, false, -Math.PI / 2, Math.PI), M.gold, x, 0, 0.45, lid);
    band.rotation.z = Math.PI / 2;
  }
  box(0.24, 0.3, 0.08, M.gold, 0, 0.02, 0.91, lid);                 // the lock
  return { root, lid };
}

function makeRing() {
  const g = new T.Group();
  part(new T.TorusGeometry(0.26, 0.075, 6, 16), M.ring, 0, 0, 0, g);
  part(new T.SphereGeometry(0.05, 4, 3), M.shine, 0.2, 0.2, 0.06, g);
  return g;
}

// What comes out of a chest, shown floating above it.
function makeVest() {
  const g = new T.Group();
  box(0.66, 0.72, 0.3, M.black, 0, 0, 0, g);
  for (const x of [-0.22, 0.22]) box(0.16, 0.24, 0.3, M.black, x, 0.46, 0, g);        // shoulder straps
  box(0.5, 0.28, 0.06, M.plate, 0, 0.12, 0.17, g);                                    // chest plate
  for (const x of [-0.17, 0.17]) box(0.2, 0.2, 0.08, M.plate, x, -0.2, 0.17, g);      // pouches
  box(0.68, 0.07, 0.32, M.gold, 0, -0.33, 0, g);
  return g;
}

export class Items {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.pots = []; this.chests = []; this.rings = []; this.bits = [];
    this.shard = new T.TetrahedronGeometry(0.15);
    this.time = 0;
  }

  // ---------- setting things out ----------
  addPot(pos, { ring = true } = {}) {
    const mesh = makePot();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    const solid = { x: pos.x, z: pos.z, r: 0.42, yMin: pos.y - 0.4, yMax: pos.y + 0.55 };
    this.world.colliders.push(solid);
    const pot = { mesh, solid, ring, state: 'rest', vel: new T.Vector3() };
    this.pots.push(pot);
    return pot;
  }
  // item: { id, name, model } where model is 'vest' or a ready-made Object3D
  addChest(pos, rotY, item) {
    const { root, lid } = makeChest();
    root.position.copy(pos); root.rotation.y = rotY;
    this.scene.add(root);
    this.world.colliders.push({ x: pos.x, z: pos.z, r: 0.8, yMin: pos.y - 0.4, yMax: pos.y + 0.95 });
    const prize = item.model === 'vest' ? makeVest() : item.model;
    prize.visible = false;
    prize.position.set(pos.x, pos.y + 0.5, pos.z);
    this.scene.add(prize);
    const chest = { root, lid, item, prize, state: 'closed', t: 0, pos: pos.clone() };
    this.chests.push(chest);
    return chest;
  }

  // ---------- what is within reach ----------
  near(p) {
    let best = null, bestD = Infinity;
    for (const pot of this.pots) {
      if (pot.state !== 'rest') continue;
      const d = Math.hypot(pot.mesh.position.x - p.x, pot.mesh.position.z - p.z);
      if (d < 1.5 && Math.abs(pot.mesh.position.y - p.y) < 1 && d < bestD) { best = { kind: 'pot', obj: pot }; bestD = d; }
    }
    for (const chest of this.chests) {
      if (chest.state !== 'closed') continue;
      const d = Math.hypot(chest.pos.x - p.x, chest.pos.z - p.z);
      if (d < 2.2 && Math.abs(chest.pos.y - p.y) < 1 && d < bestD) { best = { kind: 'chest', obj: chest }; bestD = d; }
    }
    return best;
  }

  // ---------- pots ----------
  lift(pot) {
    pot.state = 'held';
    const i = this.world.colliders.indexOf(pot.solid);
    if (i >= 0) this.world.colliders.splice(i, 1);
  }
  carry(pot, x, y, z, rotY) { pot.mesh.position.set(x, y, z); pot.mesh.rotation.y = rotY; }
  toss(pot, dirX, dirZ) {
    pot.state = 'flying';
    pot.vel.set(dirX * 6, 3, dirZ * 6);                              // a short lob, a few steps ahead of him
  }
  smash(pot) {
    if (pot.state === 'gone') return;
    if (pot.state === 'rest') this.lift(pot);                       // clears its collider
    pot.state = 'gone';
    this.scene.remove(pot.mesh);
    const at = pot.mesh.position;
    for (let i = 0; i < 9; i++) {
      const mesh = part(this.shard, i % 3 ? M.pot : M.potRim, at.x, at.y + 0.3, at.z, this.scene);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, 0);
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 2.5;
      this.bits.push({ mesh, vel: new T.Vector3(Math.cos(a) * v, 2.5 + Math.random() * 3, Math.sin(a) * v), life: 0.9 });
    }
    if (pot.ring) this.addRing(at);
  }
  addRing(at) {
    const mesh = makeRing();
    mesh.position.set(at.x, at.y + 0.4, at.z);
    this.scene.add(mesh);
    this.rings.push({ mesh, vy: 5, floor: null, age: 0 });
  }

  // ---------- chests ----------
  open(chest) { chest.state = 'opening'; chest.t = 0; chest.prize.visible = true; }
  dismiss(chest) { chest.state = 'open'; chest.prize.visible = false; }

  // ctx: { player: Vector3, onRing(), strike(position) -> true if the pot hit an Opp }
  update(dt, ctx) {
    this.time += dt;
    const w = this.world;
    for (const pot of this.pots) {
      if (pot.state !== 'flying') continue;
      const p = pot.mesh.position, before = p.clone();
      pot.vel.y -= 18 * dt;
      p.addScaledVector(pot.vel, dt);
      pot.mesh.rotation.x += dt * 7;
      const pushed = p.clone();
      w.resolve(pushed, 0.3);
      const hitWall = Math.hypot(pushed.x - p.x, pushed.z - p.z) > 0.01, floor = w.groundAt(p.x, p.z, before.y);
      if (hitWall) { p.copy(before); this.smash(pot); }
      else if (p.y <= floor) { p.y = floor; this.smash(pot); }
      else if (ctx.strike && ctx.strike(p)) this.smash(pot);
    }
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.life -= dt; b.vel.y -= 18 * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += dt * 9; b.mesh.rotation.z += dt * 6;
      b.mesh.scale.setScalar(Math.max(0.01, Math.min(1, b.life * 3)));
      if (b.life <= 0) { this.scene.remove(b.mesh); this.bits.splice(i, 1); }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i], p = r.mesh.position;
      r.age += dt;
      r.mesh.rotation.y += dt * 3.2;
      if (r.floor === null) {                                        // popping out of the pot
        r.vy -= 18 * dt; p.y += r.vy * dt;
        const floor = w.groundAt(p.x, p.z, p.y + 0.4) + 0.75;
        if (r.vy < 0 && p.y <= floor) { r.floor = floor; }
      } else p.y = r.floor + Math.sin(this.time * 3) * 0.08;         // then hovering, waiting to be picked up
      if (r.age > 0.35 && Math.hypot(p.x - ctx.player.x, p.z - ctx.player.z) < 1.1 && Math.abs(p.y - ctx.player.y - 1) < 2.2) {
        this.scene.remove(r.mesh); this.rings.splice(i, 1);
        ctx.onRing();
      }
    }
    for (const c of this.chests) {
      if (c.state !== 'opening' && c.state !== 'showing') continue;
      c.t += dt;
      const k = Math.min(1, c.t / 0.45);
      c.lid.rotation.x = -1.95 * (1 - (1 - k) * (1 - k));            // the lid swings back
      const rise = Math.min(1, Math.max(0, (c.t - 0.25) / 0.6));
      c.prize.position.y = c.pos.y + 0.5 + rise * 1.5 + Math.sin(this.time * 2.5) * 0.05;
      c.prize.rotation.y = this.time * 1.8;
      if (c.t > 0.9) c.state = 'showing';
    }
  }
}
