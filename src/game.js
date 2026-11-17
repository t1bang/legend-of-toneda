// The Legend of ToneDa: GlockNina of Time — Trap Village prototype.
// World, enemies, dialogue and controls are the original prototype logic,
// unpacked into readable code. The hero is now the rigged model in ./character/.
import * as T from '../vendor/three.module.min.js';
import { ToneDa } from './character/toneda.js';
import { Niggy, EXPRESSIONS } from './character/niggy.js';
import { buildWorld } from './world.js';

// ---------- renderer, camera, lights ----------
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 200);
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
  enemies.push({ e, hp: 3 });
}

// ---------- game state ----------
const keys = new Set();
let active = false, og = false, velocity = 0, grounded = true, climbing = null, yaw = 0, facing = 0;
let attackCooldown = 0, rollTime = 0, ladderWait = 0, grab = null, inputLock = false, combo = 0, kills = 0;
let dialog = [], index = 0, open = false, timer, speaker = '', typing = false;
const panel = document.getElementById('box'), words = document.getElementById('words');

// ---------- dialogue ----------
function say(lines, who = 'NIGGY') {
  dialog = lines; index = 0; open = true; speaker = who;
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
const NIGGY_INTRO = ['Ayy, listen!', 'My name Niggy, and I’m a demon. Ain’t no fairy shit going on over here, gang. Type shit.'];
function talk() {
  if (open) {
    clearInterval(timer);
    typing = false;
    if (words.textContent.length < dialog[index].length) { words.textContent = dialog[index]; return; }
    if (++index < dialog.length) line();
    else { open = false; panel.style.display = 'none'; }
    return;
  }
  if (player.position.distanceTo(world.treePos) < 9) {
    say(['Young ToneDa, the rhythm of time is missing.', 'Defeat the Opps and protect Trap Village.'], 'GREAT TRAP TREE');
  } else say(NIGGY_INTRO);
}

// ---------- actions ----------
function hit(kind = 'melee') {
  if (attackCooldown > 0 || open || climbing) return;
  attackCooldown = 0.43;
  if (kind === 'fire') toneda.play('fire');
  else {
    combo = (combo + 1) % 3;
    toneda.play(combo === 1 ? 'punchR' : combo === 2 ? 'punchL' : 'kick');
  }
  for (const o of enemies) {
    if (o.hp > 0 && o.e.position.distanceTo(player.position) < 3) {
      if (--o.hp === 0) {
        scene.remove(o.e);
        kills++;
        document.getElementById('kills').textContent = 'Opps: ' + kills + '/3';
        niggy.react('laughing', 1.6);
        if (kills === 3) { niggy.spin(); say(['We got all the Opps, gang. Type shit.']); }
      }
    }
  }
}
function transform() {
  og = !og;
  toneda.transform(og);
  niggy.react('surprised', 1.1);
  niggy.spin();
  say([og ? 'From YN to OG! Type shit.' : 'Back to YN. Type shit.']);
}
function action(a) {
  if (a === 'talk') talk();
  if (a === 'hit') hit('melee');
  if (a === 'fire') hit('fire');
  if (a === 'jump' && climbing) { climbing = null; toneda.release(); velocity = 0; }   // let go of the ladder
  else if (a === 'jump' && grounded) { velocity = 7; grounded = false; }
  if (a === 'roll' && rollTime <= 0 && !open && !climbing) { rollTime = 0.6; toneda.play('roll'); }
}

// ---------- input ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if (e.code === 'Space') e.preventDefault();
  if (!active || e.repeat) return;
  if (k === 'e' || e.key === 'Enter') talk();
  if (k === 'j') action('hit');
  if (k === 'f') action('fire');
  if (k === 'q') action('roll');
  if (e.code === 'Space') action('jump');
  if (k === 't') transform();
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
for (const b of document.querySelectorAll('[data-k]')) {
  b.onpointerdown = () => keys.add(b.dataset.k);
  b.onpointerup = () => keys.delete(b.dataset.k);
}
for (const b of document.querySelectorAll('[data-a]')) b.onclick = () => action(b.dataset.a);
document.getElementById('play').onclick = () => {
  active = true;
  document.getElementById('start').remove();
  say(NIGGY_INTRO);
};
let drag = false, px = 0;
renderer.domElement.onpointerdown = e => { drag = true; px = e.clientX; };
addEventListener('pointerup', () => drag = false);
addEventListener('pointermove', e => { if (drag) { yaw += (e.clientX - px) * 0.006; px = e.clientX; } });

// Handy for debugging from the browser console.
window.game = { toneda, niggy, player, enemies, scene, world, camera, renderer, cam: null, get climbing() { return climbing; }, get grounded() { return grounded; }, get halted() { return halted; },
  get yaw() { return yaw; }, set yaw(v) { yaw = v; } };

// ---------- main loop ----------
niggy.warpTo(new T.Vector3(world.spawn.x + 1.1, toneda.spec.height - 0.2, world.spawn.z + 0.6));
const camFrom = new T.Vector3(), camWant = new T.Vector3(), camDir = new T.Vector3(), camRay = new T.Raycaster();
let camBack = 8, camUp = 4.5;
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
  let moving = false;

  if (active) {
    let ix = open ? 0 : Number(down('d', 'arrowright')) - Number(down('a', 'arrowleft'));
    let iz = open ? 0 : Number(down('s', 'arrowdown')) - Number(down('w', 'arrowup'));
    // after stepping off a ladder, wait for the keys to be let go so he does not walk straight back off
    if (inputLock) { if (ix || iz) ix = iz = 0; else inputLock = false; }
    const pos = player.position;

    if (climbing) {
      // on a ladder: forward goes up, back goes down
      const L = climbing;
      // Keep going the way he grabbed on for as long as the same keys are held (the camera
      // swings round during the climb, so their meaning would flip). After that: W up, S down.
      let dir;
      if (grab && grab.keys === ix + ',' + iz) dir = grab.dir;
      else { grab = null; dir = -iz; }
      pos.x = L.x; pos.z = L.z; facing = L.face;
      pos.y += dir * 2.6 * dt;
      toneda.model.actions.climb.timeScale = dir;
      if (pos.y >= L.top) { pos.set(L.exit[0], L.top, L.exit[1]); climbing = null; ladderWait = 0.7; inputLock = true; toneda.release(); }
      else if (pos.y <= 0) { pos.y = 0; climbing = null; ladderWait = 0.5; inputLock = true; toneda.release(); }
      velocity = 0; grounded = true;
    } else {
      if (ix || iz) {
        moving = true;
        // W runs away from the camera, D goes screen-right (the first prototype had both reversed)
        const a = Math.atan2(-ix, -iz) + yaw, speed = rollTime > 0 ? 12 : (sprint ? 9.5 : 5.5);
        pos.x += Math.sin(a) * dt * speed;
        pos.z += Math.cos(a) * dt * speed;
        facing = a;
        // grab a ladder: walk into its foot, or walk back onto it from the platform above
        if (grounded && rollTime <= 0 && ladderWait <= 0) for (const L of world.ladders) {
          const toward = Math.sin(a) * Math.sin(L.face) + Math.cos(a) * Math.cos(L.face);
          const atFoot = pos.y < 0.5 && Math.hypot(pos.x - L.x, pos.z - L.z) < 0.9 && toward > 0.4;
          const atTop = Math.abs(pos.y - L.top) < 0.3 && Math.hypot(pos.x - L.exit[0], pos.z - L.exit[1]) < 1.0 && toward < -0.4;
          if (atFoot || atTop) {
            climbing = L; moving = false;
            grab = { keys: ix + ',' + iz, dir: atTop ? -1 : 1 };
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

    const h = toneda.spec.height, inside = world.indoors(player.position.x, player.position.z, player.position.y);
    // Niggy hovers at ToneDa's right shoulder, a touch ahead of him, and tucks in closer in a room.
    // He never sits inside a wall or a trunk, and when ToneDa turns round he crosses over his head, not through it.
    const heading = player.rotation.y, out = inside ? 0.75 : 0.95, ahead = inside ? 0.1 : 0.25;
    niggyTarget.set(player.position.x - Math.cos(heading) * out + Math.sin(heading) * ahead, player.position.y + h - 0.2,
      player.position.z + Math.sin(heading) * out + Math.cos(heading) * ahead);
    world.resolve(niggyTarget, 0.45);
    const overhead = 1 - Math.hypot(niggy.root.position.x - player.position.x, niggy.root.position.z - player.position.z) / 0.7;
    if (overhead > 0) niggyTarget.y += overhead * 1.1;
    // while climbing, swing the camera round behind him so it looks at the ladder
    if (climbing) yaw += Math.atan2(Math.sin(climbing.face - yaw), Math.cos(climbing.face - yaw)) * Math.min(1, dt * 4);
    // the camera sits closer and lower indoors, so it stays in the room with him
    camBack += ((inside ? 5 : sprint ? 10 : 8) - camBack) * Math.min(1, dt * 4);
    camUp += ((inside ? Math.min(h * 1.1 + 0.2, 4.1) : sprint ? 5 : 4.5) - camUp) * Math.min(1, dt * 4);
    camFrom.set(player.position.x, player.position.y + h * 0.75, player.position.z);
    camWant.set(player.position.x - Math.sin(yaw) * camBack, player.position.y + camUp, player.position.z - Math.cos(yaw) * camBack);
    // pull the camera in when a wall, trunk or roof is in the way
    camDir.copy(camWant).sub(camFrom);
    const reach = camDir.length();
    camRay.set(camFrom, camDir.normalize());
    camRay.far = reach;
    const hit = camRay.intersectObjects(world.solids, false)[0];
    if (hit) camWant.copy(camFrom).addScaledVector(camDir, Math.max(1.0, hit.distance - 0.5));
    camera.position.lerp(camWant, Math.min(1, dt * (hit ? 14 : 6)));
    camera.lookAt(player.position.x, player.position.y + h * 0.55, player.position.z);
  } else {
    const t = clock.elapsedTime * 0.08;           // slow fly-around behind the title screen
    camera.position.set(Math.cos(t) * 24, 12, Math.sin(t) * 24);
    camera.lookAt(0, 4, -2);
  }

  if (window.game.cam) {                          // debug: window.game.cam = [x, y, z, lookX, lookY, lookZ]
    camera.position.set(...window.game.cam.slice(0, 3));
    camera.lookAt(...window.game.cam.slice(3));
  }
  toneda.update(dt, { moving, sprint, grounded, vy: velocity });

  // Niggy: talks while his line types out, scowls when an Opp is close.
  // He looks where he is going, at a nearby Opp, or at whoever is speaking,
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
    at: open ? world.treePos : threat ? threat.e.position : null,
    heading: player.rotation.y,
  });
  world.update(dt);
  renderer.render(scene, camera);
}
frame();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

