// The Legend of ToneDa: GlockNina of Time — Trap Village prototype.
// World, enemies, dialogue and controls are the original prototype logic,
// unpacked into readable code. The hero is now the rigged model in ./character/.
import * as T from '../vendor/three.module.min.js';
import { ToneDa } from './character/toneda.js';
import { Niggy } from './character/niggy.js';

// ---------- renderer, camera, lights ----------
const scene = new T.Scene();
scene.background = new T.Color('#7cb5d6');
scene.fog = new T.Fog('#7cb5d6', 35, 85);
const camera = new T.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 200);
const renderer = new T.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.4));
document.body.prepend(renderer.domElement);
scene.add(new T.HemisphereLight(0xffffff, 0x455d40, 2.7));
const sun = new T.DirectionalLight(0xffe2b2, 2);
sun.position.set(12, 25, 9);
scene.add(sun);

// ---------- placeholder-shape helpers (the world and the Opps still use these) ----------
const mat = color => new T.MeshLambertMaterial({ color, flatShading: true });
const brown = mat('#70472f'), leaf = mat('#34763b'), red = mat('#9e182b'), black = mat('#1a1b24');
function shape(geometry, material, x, y, z, parent = scene) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
const cube = (w, h, d, m, x, y, z, parent) => shape(new T.BoxGeometry(w, h, d), m, x, y, z, parent);
const ball = (r, m, x, y, z, parent) => shape(new T.SphereGeometry(r, 8, 6), m, x, y, z, parent);
const trunk = (r, h, m, x, y, z, parent) => shape(new T.CylinderGeometry(r * 0.8, r, h, 8), m, x, y, z, parent);

// ---------- Trap Village ----------
const floor = shape(new T.PlaneGeometry(160, 160), mat('#568b44'), 0, 0, 0);
floor.rotation.x = -Math.PI / 2;
for (let i = 0; i < 65; i++) {
  const a = i * 2.4, d = 15 + Math.sqrt(i) * 4, x = Math.cos(a) * d, z = Math.sin(a) * d;
  trunk(0.45, 4, brown, x, 2, z);
  ball(2.6, leaf, x, 5, z);
}

// The Trap House
const house = new T.Group();
house.position.set(-8, 0, -7);
scene.add(house);
for (const x of [-2, 2]) for (const z of [-2, 2]) trunk(0.3, 5, brown, x, 2.5, z, house);
cube(6, 0.4, 6, brown, 0, 5, 0, house);
cube(5, 3, 4, mat('#ad7949'), 0, 6.7, 0, house);
const roof = shape(new T.ConeGeometry(4.2, 2.5, 4), red, 0, 9.3, 0, house);
roof.rotation.y = Math.PI / 4;
const sign = document.createElement('canvas');
sign.width = 256; sign.height = 80;
const signCtx = sign.getContext('2d');
signCtx.fillStyle = '#ff2525';
signCtx.font = 'bold 70px monospace';
signCtx.fillText('TRAP', 25, 65);
shape(new T.PlaneGeometry(3.5, 1), new T.MeshBasicMaterial({ map: new T.CanvasTexture(sign), transparent: true }), 0, 7, 2.05, house);

// The Great Trap Tree
const tree = new T.Group();
tree.position.set(10, 0, -10);
scene.add(tree);
trunk(3, 13, brown, 0, 6.5, 0, tree);
for (let i = 0; i < 6; i++) ball(4, leaf, Math.sin(i * 2.4) * 3, 13, Math.cos(i * 2.4) * 3, tree);
ball(0.5, black, -0.9, 7, 2.5, tree);
ball(0.5, black, 0.9, 7, 2.5, tree);
cube(1.8, 0.25, 0.4, black, 0, 5.5, 2.7, tree);

// ---------- ToneDa (rigged model) ----------
const player = new T.Group();
scene.add(player);
const toneda = new ToneDa();
player.add(toneda.root);

// ---------- Niggy (demon companion) ----------
const niggy = new Niggy();
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
let active = false, og = false, jump = 0, velocity = 0, yaw = 0, facing = 0;
let attackCooldown = 0, rollTime = 0, combo = 0, kills = 0;
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
  if (player.position.distanceTo(tree.position) < 8) {
    say(['Young ToneDa, the rhythm of time is missing.', 'Defeat the Opps and protect Trap Village.'], 'GREAT TRAP TREE');
  } else say(NIGGY_INTRO);
}

// ---------- actions ----------
function hit(kind = 'melee') {
  if (attackCooldown > 0 || open) return;
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
  if (a === 'jump' && jump === 0) velocity = 7;
  if (a === 'roll' && rollTime <= 0 && !open) { rollTime = 0.6; toneda.play('roll'); }
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

// ---------- main loop ----------
niggy.warpTo(new T.Vector3(1.1, toneda.spec.height - 0.2, 0.6));
const clock = new T.Clock();
const down = (...names) => names.some(n => keys.has(n));
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  attackCooldown = Math.max(0, attackCooldown - dt);
  rollTime = Math.max(0, rollTime - dt);
  const sprint = keys.has('shift');
  let moving = false;

  if (active) {
    if (!open) {
      const x = Number(down('d', 'arrowright')) - Number(down('a', 'arrowleft'));
      const z = Number(down('s', 'arrowdown')) - Number(down('w', 'arrowup'));
      if (x || z) {
        moving = true;
        // W runs away from the camera, D goes screen-right (the first prototype had both reversed)
        const a = Math.atan2(-x, -z) + yaw, speed = rollTime > 0 ? 12 : (sprint ? 9.5 : 5.5);
        player.position.x += Math.sin(a) * dt * speed;
        player.position.z += Math.cos(a) * dt * speed;
        facing = a;
      }
    }
    // turn smoothly toward the direction of travel
    const turn = Math.atan2(Math.sin(facing - player.rotation.y), Math.cos(facing - player.rotation.y));
    player.rotation.y += turn * Math.min(1, dt * 16);

    velocity -= 18 * dt;
    jump = Math.max(0, jump + velocity * dt);
    if (jump === 0) velocity = 0;
    player.position.y = jump;

    const h = toneda.spec.height;
    niggyTarget.set(player.position.x + 1.1, player.position.y + h - 0.2, player.position.z + 0.6);
    const back = sprint ? 10 : 8;
    camera.position.lerp(new T.Vector3(player.position.x - Math.sin(yaw) * back, player.position.y + (sprint ? 5 : 4.5), player.position.z - Math.cos(yaw) * back), Math.min(1, dt * 6));
    camera.lookAt(player.position.x, player.position.y + h * 0.55, player.position.z);
  } else {
    camera.position.set(16, 12, 18);
    camera.lookAt(0, 3, 0);
  }

  toneda.update(dt, { moving, sprint, grounded: jump === 0, vy: velocity });

  // Niggy: talks while his line types out, scowls when an Opp is close
  niggy.speak(open && typing && speaker === 'NIGGY');
  niggy.setExpression(enemies.some(o => o.hp > 0 && o.e.position.distanceTo(player.position) < 5.5) ? 'mad' : 'idle');
  niggy.update(dt, active ? niggyTarget : null, camera);
  renderer.render(scene, camera);
}
frame();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Handy for debugging from the browser console.
window.game = { toneda, niggy, player, enemies, scene };
