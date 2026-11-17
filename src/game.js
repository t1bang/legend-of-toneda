// The Legend of ToneDa: GlockNina of Time — Trap Village prototype.
// ToneDa wakes up in his tree house. First mission: find the Switch (his gun) somewhere in the
// village, then see the Great Trap Tree, then deal with the Opps.
import * as T from '../vendor/three.module.min.js';
import { ToneDa, switchModel } from './character/toneda.js';
import { Niggy, EXPRESSIONS } from './character/niggy.js';
import { buildWorld } from './world.js';
import { Items } from './items.js';
import { makeStick } from './touch.js';

// ---------- renderer, camera, lights ----------
const scene = new T.Scene();
// a phone held upright gets a wider lens, or ToneDa would fill the whole narrow screen
const lens = () => (innerWidth < innerHeight ? 82 : 65);
const camera = new T.PerspectiveCamera(lens(), innerWidth / innerHeight, 0.1, 200);
const renderer = new T.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
document.body.prepend(renderer.domElement);

// ---------- safety net ----------
// When the browser's graphics process resets, three.js rebuilds every texture and shader the
// moment it comes back. If drawing the game is what knocked it over, that repeats until the
// browser gives up and closes. So stop drawing instead, and offer a reload.
let halted = false;
renderer.domElement.addEventListener('webglcontextlost', () => {
  halted = true;
  document.getElementById('oops').style.display = 'grid';
});
document.getElementById('reload').onclick = () => location.reload();

// ---------- placeholder-shape helpers (the Opps still use these) ----------
const mat = color => new T.MeshLambertMaterial({ color, flatShading: true });
const brown = mat('#70472f'), leaf = mat('#34763b');
function shape(geometry, material, x, y, z, parent = scene) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
const cube = (w, h, d, m, x, y, z, parent) => shape(new T.BoxGeometry(w, h, d), m, x, y, z, parent);
const ball = (r, m, x, y, z, parent) => shape(new T.SphereGeometry(r, 8, 6), m, x, y, z, parent);
const trunk = (r, h, m, x, y, z, parent) => shape(new T.CylinderGeometry(r * 0.8, r, h, 8), m, x, y, z, parent);

// ---------- Trap Village (see world.js) ----------
const world = buildWorld(scene);

// ---------- ToneDa (rigged model) ----------
const player = new T.Group();
scene.add(player);
const toneda = new ToneDa();
player.add(toneda.root);
// Show him only once the art-built models have arrived (or failed, leaving the code-built stand-in).
toneda.root.visible = false;
toneda.loadArt().finally(() => { toneda.root.visible = true; });
player.position.copy(world.spawn);

// ---------- Niggy (demon companion) ----------
const niggy = new Niggy({ faces: Object.fromEntries(EXPRESSIONS.map(n => [n, `assets/niggy/niggy-face-${n}.png`])) });
scene.add(niggy.root);
const niggyTarget = new T.Vector3();

// ---------- Opps (still placeholders) ----------
const enemies = [];
for (let i = 0; i < 3; i++) {
  const e = new T.Group();
  e.position.set(5 + i * 3, 0, 4 + i * 2);
  scene.add(e);
  trunk(0.4, 1.4, brown, 0, 0.8, 0, e);
  ball(0.75, i % 2 ? brown : leaf, 0, 1.8, 0, e);
  for (const x of [-0.35, 0.35]) cube(0.12, 0.7, 0.12, brown, x, 0.4, 0, e);
  enemies.push({ e, hp: 3, flinch: 0 });
}

// ---------- game state ----------
const keys = new Set();
const touch = matchMedia('(pointer: coarse)').matches, USE = touch ? 'USE' : 'E';
let active = false, og = false, velocity = 0, grounded = true, climbing = null, yaw = 0, facing = 0;
let attackCooldown = 0, rollTime = 0, ladderWait = 0, grab = null, inputLock = false, combo = 0, kills = 0;
let dialog = [], index = 0, open = false, timer, speaker = '', typing = false, after = null;
let quest = 'switch', rings = 0, carrying = null, snapCamera = false;
const gear = { vest: false, switch: false };
const panel = document.getElementById('box'), words = document.getElementById('words'), prompt = document.getElementById('prompt');
document.getElementById('next').textContent = touch ? 'Tap here to continue' : 'Press E to continue';

// ---------- quest and HUD ----------
const QUESTS = {
  switch: 'Find the Switch somewhere in the village',
  tree: 'Speak to the Great Trap Tree',
  opps: 'Defeat the Opps in the training clearing',
  done: 'Trap Village is safe. More to come',
};
function setQuest(q) {
  quest = q;
  document.getElementById('quest').textContent = 'QUEST: ' + QUESTS[q];
}
function hud() {
  document.getElementById('armor').textContent = gear.vest ? ' ◆ ◆' : '';
  document.getElementById('kills').textContent = 'Opps: ' + kills + '/3';
  document.getElementById('rings').textContent = 'Rings: ' + rings;
  const owned = [gear.vest && 'Bulletproof Vest', gear.switch && 'The Switch'].filter(Boolean);
  document.getElementById('gear').textContent = owned.length ? 'Gear: ' + owned.join(' • ') : '';
}

// ---------- dialogue ----------
// then: something to do once the last line has been read
function say(lines, who = 'NIGGY', then = null) {
  dialog = lines; index = 0; open = true; speaker = who; after = then;
  panel.style.display = 'block';
  document.getElementById('who').textContent = who;
  line();
}
function line() {
  clearInterval(timer);
  words.textContent = '';
  let n = 0;
  typing = true;
  timer = setInterval(() => {
    words.textContent = dialog[index].slice(0, ++n);
    if (n >= dialog[index].length) { clearInterval(timer); typing = false; }
  }, 25);
}
function advance() {
  clearInterval(timer);
  typing = false;
  if (words.textContent.length < dialog[index].length) { words.textContent = dialog[index]; return; }
  if (++index < dialog.length) { line(); return; }
  open = false; panel.style.display = 'none';
  const next = after;
  after = null;
  if (next) next();
}
const NIGGY_INTRO = [
  'Ayy, listen!',
  'My name Niggy, and I’m a demon. Ain’t no fairy shit going on over here, gang. Type shit.',
  'The Great Trap Tree been calling for you. But you can’t pull up on him with empty hands. Type shit.',
  'Your Switch is stashed somewhere in the village. Go find it, gang. Type shit.',
];
// What Niggy says when there is nothing else to use: a nudge toward the current mission.
const NUDGE = {
  switch: ['Your Switch ain’t gon’ find itself. Check them stump houses round the village. Type shit.'],
  tree: ['You strapped now. Go holla at the Great Trap Tree. Type shit.'],
  opps: ['Them Opps posted up in the training clearing. Handle that. Type shit.'],
  done: ['We got all the Opps, gang. Type shit.'],
};
function treeTalk() {
  if (!gear.switch) {
    say(['Young ToneDa. You stand before me with empty hands.', 'Find your Switch, then return to me.'], 'GREAT TRAP TREE');
    return;
  }
  say(['Young ToneDa, the rhythm of time is missing.', 'Defeat the Opps and protect Trap Village.'], 'GREAT TRAP TREE',
    () => { if (quest === 'tree') setQuest(kills >= 3 ? 'done' : 'opps'); });
}

// ---------- things to use: the flower pot, the chests ----------
const items = new Items(scene, world);
items.addPot(world.spots.pot.pos);
items.addChest(world.spots.vestChest.pos, world.spots.vestChest.rotY, {
  name: 'BULLETPROOF VEST', model: 'vest',
  lines: ['You got the Bulletproof Vest!', 'ToneDa straps it on under his cloak.'],
  got() { gear.vest = true; hud(); say(['Now you strapped up proper, gang. Type shit.']); },
});
items.addChest(world.spots.switchChest.pos, world.spots.switchChest.rotY, {
  name: 'THE SWITCH', model: switchModel(),
  lines: ['You found the Switch!', touch ? 'Hold SHOOT to let it ring.' : 'Hold F to let it ring.'],
  got() { gear.switch = true; hud(); setQuest('tree'); say(['Now we talking. Go holla at the Great Trap Tree. Type shit.']); },
});
const nearTree = () => player.position.distanceTo(world.treePos) < 9;

// While a chest opens the camera leaves ToneDa's shoulder and stands off to one side of the chest's
// front: the side he is not on, and wherever a wall leaves it the most room.
const cine = { on: false, pos: new T.Vector3(), look: new T.Vector3() }, cineDir = new T.Vector3(), cineRay = new T.Raycaster();
function watchChest(chest) {
  const c = chest.pos, front = chest.root.rotation.y, p = player.position;
  const side = Math.sign(Math.sin(Math.atan2(p.x - c.x, p.z - c.z) - front)) || 1;
  cine.look.set(c.x, c.y + 1.5, c.z);
  let best = 0;
  for (const turn of [-0.8 * side, 0.8 * side, -1.3 * side, 1.3 * side]) {
    cineDir.set(Math.sin(front + turn) * 4.4, 1.5, Math.cos(front + turn) * 4.4);
    const want = cineDir.length();
    cineRay.far = want;
    cineRay.set(cine.look, cineDir.normalize());
    const wall = cineRay.intersectObjects(world.solids, false)[0], free = wall ? wall.distance - 0.4 : want;
    if (free > best) { best = free; cine.pos.copy(cine.look).addScaledVector(cineDir, free); }
    if (!wall) break;
  }
  cine.on = true;
}

// E (or USE): read on, throw what he is carrying, pick up, open, or talk
function use() {
  if (open) { advance(); return; }
  if (carrying) { throwPot(); return; }
  if (climbing) return;
  const n = items.near(player.position);
  if (n && n.kind === 'pot' && grounded) {
    carrying = n.obj;
    items.lift(carrying);
    toneda.carrying = true;
  } else if (n && n.kind === 'chest') {
    const chest = n.obj;
    facing = Math.atan2(chest.pos.x - player.position.x, chest.pos.z - player.position.z);
    items.open(chest);
    watchChest(chest);
    say(chest.item.lines, chest.item.name, () => { cine.on = false; items.dismiss(chest); chest.item.got(); });
  } else if (nearTree()) treeTalk();
  else say(NUDGE[quest]);
}
function throwPot() {
  const r = player.rotation.y;
  items.toss(carrying, Math.sin(r), Math.cos(r));
  carrying = null;
  toneda.carrying = false;
  attackCooldown = 0.3;
}

// ---------- fighting ----------
function damage(o, amount) {
  if (o.hp <= 0) return;
  o.hp -= amount;
  o.flinch = 0.16;
  if (o.hp > 0) return;
  scene.remove(o.e);
  kills++;
  hud();
  niggy.react('laughing', 1.6);
  if (kills === 3) {
    niggy.spin();
    if (quest === 'opps') setQuest('done');
    say(['We got all the Opps, gang. Type shit.']);
  }
}
// The Switch: a shot flies straight to the nearest Opp in front of him, unless something solid is in the way.
const tracer = shape(new T.BoxGeometry(0.14, 0.14, 1), new T.MeshBasicMaterial({ color: '#ffe27a' }), 0, 0, 0);
const flash = shape(new T.SphereGeometry(0.22, 6, 4), new T.MeshBasicMaterial({ color: '#fff1a8' }), 0, 0, 0);
const spark = shape(new T.OctahedronGeometry(0.45), new T.MeshBasicMaterial({ color: '#ffb347' }), 0, 0, 0);
tracer.visible = flash.visible = spark.visible = false;
let tracerTime = 0;
const muzzle = new T.Vector3(), shotEnd = new T.Vector3(), aim = new T.Vector3(), shotRay = new T.Raycaster(), RANGE = 26;
function shoot() {
  const p = player.position, fx = Math.sin(player.rotation.y), fz = Math.cos(player.rotation.y);
  let target = null, best = RANGE;
  for (const o of enemies) {
    if (o.hp <= 0) continue;
    const dx = o.e.position.x - p.x, dz = o.e.position.z - p.z, d = Math.hypot(dx, dz);
    if (d < best && (d < 1.5 || (dx * fx + dz * fz) / d > 0.78)) { best = d; target = o; }
  }
  let dirX = fx, dirZ = fz;
  if (target) {                                   // he turns to aim
    dirX = (target.e.position.x - p.x) / best; dirZ = (target.e.position.z - p.z) / best;
    facing = Math.atan2(dirX, dirZ);
  }
  // The shot is traced from ToneDa himself, not from the muzzle: with his back to a wall the
  // muzzle can already be inside it, and the shot would slip through.
  const gunY = p.y + toneda.spec.height * 0.62;
  muzzle.set(p.x, gunY, p.z);
  if (target) shotEnd.set(target.e.position.x - dirX * 0.7, target.e.position.y + 1.5, target.e.position.z - dirZ * 0.7);   // the near side of the Opp
  else shotEnd.set(p.x + dirX * RANGE, gunY, p.z + dirZ * RANGE);
  aim.copy(shotEnd).sub(muzzle);
  let reach = aim.length();
  shotRay.far = reach;
  shotRay.set(muzzle, aim.normalize());
  const wall = shotRay.intersectObjects(world.solids, false)[0];
  if (wall) { shotEnd.copy(wall.point); reach = wall.distance; target = null; }
  // the streak is drawn from the gun in his right hand, so it shows from behind him too
  const out = Math.min(0.9, reach * 0.8);
  muzzle.set(p.x + dirX * out - dirZ * 0.42, gunY, p.z + dirZ * out + dirX * 0.42);
  tracer.position.copy(muzzle).lerp(shotEnd, 0.5);
  tracer.lookAt(shotEnd);
  tracer.scale.z = muzzle.distanceTo(shotEnd);
  flash.position.copy(muzzle);
  spark.position.copy(shotEnd);
  spark.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  tracer.visible = flash.visible = spark.visible = true;
  tracerTime = 0.09;
  if (target) damage(target, 1);
}
function hit(kind = 'melee') {
  if (open || climbing) return;
  if (carrying) { if (kind === 'melee') throwPot(); return; }
  if (kind === 'fire') {
    if (!gear.switch) { say(['You ain’t got your Switch yet. Type shit.']); return; }
    if (attackCooldown > 0) return;
    attackCooldown = 0.17;
    toneda.play('fire');
    shoot();
    return;
  }
  if (attackCooldown > 0) return;
  attackCooldown = 0.43;
  combo = (combo + 1) % 3;
  toneda.play(combo === 1 ? 'punchR' : combo === 2 ? 'punchL' : 'kick');
  for (const o of enemies) if (o.hp > 0 && o.e.position.distanceTo(player.position) < 3) damage(o, 1);
  // a pot in front of him breaks
  const fx = Math.sin(player.rotation.y), fz = Math.cos(player.rotation.y);
  for (const pot of items.pots) {
    if (pot.state !== 'rest') continue;
    const dx = pot.mesh.position.x - player.position.x, dz = pot.mesh.position.z - player.position.z, d = Math.hypot(dx, dz);
    if (d < 2.2 && Math.abs(pot.mesh.position.y - player.position.y) < 1 && (dx * fx + dz * fz) / (d || 1) > 0.2) items.smash(pot);
  }
}
function transform() {
  if (open || carrying) return;
  og = !og;
  toneda.transform(og);
  niggy.react('surprised', 1.1);
  niggy.spin();
  say([og ? 'From YN to OG! Type shit.' : 'Back to YN. Type shit.']);
}
function action(a) {
  if (a === 'use') use();
  if (a === 'hit') hit('melee');
  if (a === 'fire') hit('fire');
  if (a === 'form') transform();
  if (a === 'jump' && climbing) { climbing = null; toneda.release(); velocity = 0; }   // let go of the ladder
  else if (a === 'jump' && grounded && !open) { velocity = 7; grounded = false; }
  if (a === 'roll' && rollTime <= 0 && !open && !climbing && !carrying) { rollTime = 0.6; toneda.play('roll'); }
}

// ---------- input ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (e.code === 'Space') e.preventDefault();
  if (!active || e.repeat) return;
  if (k === 'e' || e.key === 'Enter') action('use');
  if (k === 'j') action('hit');
  if (k === 'f') action('fire');
  if (k === 'q') action('roll');
  if (e.code === 'Space') action('jump');
  if (k === 't') action('form');
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
// touch: a joystick to move, buttons to act (SHOOT can be held down)
const stick = makeStick(document.getElementById('stick'), document.getElementById('knob'));
for (const b of document.querySelectorAll('#pad button')) {
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (!active) return;
    if (b.dataset.hold) keys.add(b.dataset.hold);
    action(b.dataset.a);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(type, () => { if (b.dataset.hold) keys.delete(b.dataset.hold); });
}
panel.addEventListener('pointerdown', () => { if (active && open) advance(); });
document.getElementById('play').onclick = () => {
  active = true;
  snapCamera = true;
  document.getElementById('start').remove();
  say(NIGGY_INTRO);
};
// drag anywhere on the view to turn the camera (one finger or the mouse; the joystick has its own)
let dragId = null, px = 0;
renderer.domElement.addEventListener('pointerdown', e => { if (dragId === null) { dragId = e.pointerId; px = e.clientX; } });
addEventListener('pointermove', e => { if (e.pointerId === dragId) { yaw += (e.clientX - px) * 0.006; px = e.clientX; } });
for (const type of ['pointerup', 'pointercancel']) addEventListener(type, e => { if (e.pointerId === dragId) dragId = null; });

// Handy for debugging from the browser console.
window.game = { toneda, niggy, player, enemies, scene, world, camera, renderer, items, gear, stick, fx: { tracer, flash, spark }, cam: null,
  get climbing() { return climbing; }, get grounded() { return grounded; }, get halted() { return halted; },
  get quest() { return quest; }, get rings() { return rings; }, get carrying() { return carrying; }, get open() { return open; },
  get yaw() { return yaw; }, set yaw(v) { yaw = v; } };

// ---------- main loop ----------
hud();
niggy.warpTo(new T.Vector3(world.spawn.x - 0.95, world.spawn.y + toneda.spec.height - 0.2, world.spawn.z + 0.25));
const camFrom = new T.Vector3(), camWant = new T.Vector3(), camDir = new T.Vector3(), camRay = new T.Raycaster();
let camBack = 5, camUp = 3.4, tip = '';
const clock = new T.Clock();
const down = (...names) => names.some(n => keys.has(n));
function frame() {
  if (halted) return;                             // graphics were lost: stop for good (see the safety net above)
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  attackCooldown = Math.max(0, attackCooldown - dt);
  rollTime = Math.max(0, rollTime - dt);
  ladderWait = Math.max(0, ladderWait - dt);
  const sprint = keys.has('shift');
  let moving = false, push = 0;

  if (active) {
    // keys count as a full push; the joystick can also be pushed part of the way for a walk
    let ix = open ? 0 : Number(down('d', 'arrowright')) - Number(down('a', 'arrowleft')) + stick.x;
    let iz = open ? 0 : Number(down('s', 'arrowdown')) - Number(down('w', 'arrowup')) + stick.y;
    // after stepping off a ladder, wait for the keys to be let go so he does not walk straight back off
    if (inputLock) { if (ix || iz) ix = iz = 0; else inputLock = false; }
    push = Math.min(1, Math.hypot(ix, iz));
    const held = Math.round(ix) + ',' + Math.round(iz), pos = player.position;
    if (keys.has('f') && gear.switch) hit('fire');                // hold to keep firing

    if (climbing) {
      // on a ladder: forward goes up, back goes down
      const L = climbing;
      // Keep going the way he grabbed on for as long as the same keys are held (the camera
      // swings round during the climb, so their meaning would flip). After that: W up, S down.
      let dir;
      if (grab && grab.keys === held) dir = grab.dir;
      else { grab = null; dir = -Math.max(-1, Math.min(1, iz)); }
      pos.x = L.x; pos.z = L.z; facing = L.face;
      pos.y += dir * 2.6 * dt;
      toneda.model.actions.climb.timeScale = dir;
      if (pos.y >= L.top) { pos.set(L.exit[0], L.top, L.exit[1]); climbing = null; ladderWait = 0.7; inputLock = true; toneda.release(); }
      else if (pos.y <= 0) { pos.y = 0; climbing = null; ladderWait = 0.5; inputLock = true; toneda.release(); }
      velocity = 0; grounded = true;
    } else {
      if (push > 0) {
        moving = true;
        // W runs away from the camera, D goes screen-right (the first prototype had both reversed)
        const a = Math.atan2(-ix, -iz) + yaw, speed = rollTime > 0 ? 12 : (sprint ? 9.5 : 5.5) * push;
        pos.x += Math.sin(a) * dt * speed;
        pos.z += Math.cos(a) * dt * speed;
        facing = a;
        // grab a ladder: walk into its foot, or walk back onto it from the platform above
        if (grounded && rollTime <= 0 && ladderWait <= 0 && !carrying) for (const L of world.ladders) {
          const toward = Math.sin(a) * Math.sin(L.face) + Math.cos(a) * Math.cos(L.face);
          const atFoot = pos.y < 0.5 && Math.hypot(pos.x - L.x, pos.z - L.z) < 0.9 && toward > 0.4;
          const atTop = Math.abs(pos.y - L.top) < 0.3 && Math.hypot(pos.x - L.exit[0], pos.z - L.exit[1]) < 1.0 && toward < -0.4;
          if (atFoot || atTop) {
            climbing = L; moving = false;
            grab = { keys: held, dir: atTop ? -1 : 1 };
            pos.set(L.x, atTop ? L.top - 0.15 : 0.05, L.z);
            toneda.hold('climb');
            break;
          }
        }
      }
      if (!climbing) {
        world.resolve(pos);
        const floor = world.groundAt(pos.x, pos.z, pos.y);
        velocity -= 18 * dt;
        pos.y += velocity * dt;
        // land, or stay glued to the floor on gentle slopes like the bridges
        if (pos.y <= floor || (grounded && velocity <= 0 && pos.y - floor < 0.35)) { pos.y = floor; velocity = 0; grounded = true; }
        else grounded = false;
      }
    }
    // turn smoothly toward the direction of travel
    const turn = Math.atan2(Math.sin(facing - player.rotation.y), Math.cos(facing - player.rotation.y));
    player.rotation.y += turn * Math.min(1, dt * 16);

    const h = toneda.spec.height, inside = world.indoors(pos.x, pos.z, pos.y), heading = player.rotation.y;
    // whatever he is carrying rides above his head
    if (carrying) items.carry(carrying, pos.x + Math.sin(heading) * 0.2, pos.y + h + 0.02, pos.z + Math.cos(heading) * 0.2, heading);
    // Niggy hovers at ToneDa's right shoulder, a touch ahead of him, and tucks in closer in a room.
    // He never sits inside a wall or a trunk, and when ToneDa turns round he crosses over his head, not through it.
    const out = inside ? 0.75 : 0.95, ahead = inside ? 0.1 : 0.25;
    niggyTarget.set(pos.x - Math.cos(heading) * out + Math.sin(heading) * ahead, pos.y + h - 0.2, pos.z + Math.sin(heading) * out + Math.cos(heading) * ahead);
    world.resolve(niggyTarget, 0.45);
    const overhead = 1 - Math.hypot(niggy.root.position.x - pos.x, niggy.root.position.z - pos.z) / 0.7;
    if (overhead > 0) niggyTarget.y += overhead * 1.1;
    // while climbing, swing the camera round behind him so it looks at the ladder
    if (climbing) yaw += Math.atan2(Math.sin(climbing.face - yaw), Math.cos(climbing.face - yaw)) * Math.min(1, dt * 4);
    // the camera sits closer and lower indoors, so it stays in the room with him
    camBack += ((inside ? 5 : sprint ? 10 : 8) - camBack) * Math.min(1, dt * 4);
    camUp += ((inside ? Math.min(h * 1.1 + 0.2, 4.1) : sprint ? 5 : 4.5) - camUp) * Math.min(1, dt * 4);
    camFrom.set(pos.x, pos.y + h * 0.75, pos.z);
    camWant.set(pos.x - Math.sin(yaw) * camBack, pos.y + camUp, pos.z - Math.cos(yaw) * camBack);
    // pull the camera in when a wall, trunk or roof is in the way
    camDir.copy(camWant).sub(camFrom);
    const reach = camDir.length();
    camRay.set(camFrom, camDir.normalize());
    camRay.far = reach;
    const blocked = camRay.intersectObjects(world.solids, false)[0];
    if (blocked) camWant.copy(camFrom).addScaledVector(camDir, Math.max(1.0, blocked.distance - 0.5));
    if (cine.on) {                                // a chest is opening: watch it from the side
      camera.position.lerp(cine.pos, Math.min(1, dt * 5));
      camera.lookAt(cine.look);
    } else {
      if (snapCamera) { camera.position.copy(camWant); snapCamera = false; }    // the game opens already inside the house
      else camera.position.lerp(camWant, Math.min(1, dt * (blocked ? 14 : 6)));
      camera.lookAt(pos.x, pos.y + h * 0.55, pos.z);
    }
  } else {
    const t = clock.elapsedTime * 0.08;           // slow fly-around behind the title screen
    camera.position.set(Math.cos(t) * 24, 12, Math.sin(t) * 24);
    camera.lookAt(0, 4, -2);
  }

  if (window.game.cam) {                          // debug: window.game.cam = [x, y, z, lookX, lookY, lookZ]
    camera.position.set(...window.game.cam.slice(0, 3));
    camera.lookAt(...window.game.cam.slice(3));
  }
  toneda.update(dt, { moving, sprint, grounded, vy: velocity, walk: push < 0.6 });

  // pots in flight, rings waiting to be picked up, chest lids
  items.update(dt, {
    player: player.position,
    onRing() {
      rings++;
      hud();
      if (rings === 1 && !open) say(['A gold ring! Keep stacking them, gang. Type shit.']);
    },
    strike(p) {                                   // a thrown pot that reaches an Opp hurts it
      const o = enemies.find(o => o.hp > 0 && Math.hypot(o.e.position.x - p.x, o.e.position.z - p.z) < 1.2 && p.y - o.e.position.y < 2.8);
      if (o) damage(o, 2);
      return !!o;
    },
  });
  for (const o of enemies) { o.flinch = Math.max(0, o.flinch - dt); o.e.scale.setScalar(1 + o.flinch * 1.4); }
  if (tracerTime > 0 && (tracerTime -= dt) <= 0) tracer.visible = flash.visible = spark.visible = false;

  // what E would do right now
  let want = '';
  if (active && !open && !climbing) {
    const n = carrying ? null : items.near(player.position);
    want = carrying ? 'Throw' : n ? (n.kind === 'pot' ? 'Pick up' : 'Open') : nearTree() ? 'Talk' : '';
  }
  if (want !== tip) {
    tip = want;
    prompt.textContent = USE + ' · ' + tip;
    prompt.style.display = tip ? 'block' : 'none';
  }

  // Niggy: talks while his line types out, scowls when an Opp is close.
  // He looks where he is going, at a nearby Opp, or at the Great Trap Tree while it speaks,
  // and turns to the player only while he is the one talking.
  let threat = null, near = 5.5;
  for (const o of enemies) {
    const d = o.hp > 0 ? o.e.position.distanceTo(player.position) : Infinity;
    if (d < near) { near = d; threat = o; }
  }
  niggy.speak(open && typing && speaker === 'NIGGY');
  niggy.setExpression(threat ? 'mad' : 'idle');
  niggy.update(dt, active ? niggyTarget : null, camera, {
    talking: open && speaker === 'NIGGY',
    at: open && speaker === 'GREAT TRAP TREE' ? world.treePos : threat ? threat.e.position : null,
    heading: player.rotation.y,
  });
  world.update(dt);
  renderer.render(scene, camera);
}
frame();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = lens();
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
