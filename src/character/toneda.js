// ToneDa — rigged, skinned, low-poly hero model in two forms (YN and OG),
// with an animation controller that blends between clips.
//
// Convention: the character faces +Z, his left side is +X, feet at Y = 0.
import * as T from '../../vendor/three.module.min.js';
import { MeshKit, buildSkeleton } from './meshkit.js';
import { makeAtlas, UV } from './textures.js';
import { makeClips, ONE_SHOTS } from './anims.js';

const PAL = {
  skin: '#7a4a30', red: '#b3182c', redDark: '#7a0f1f', black: '#17171d', grey: '#3a3b46',
  denim: '#262f4e', denimLight: '#3d4c7c', tan: '#c9994f', tanDark: '#916a35', sole: '#3a2a1c',
  gold: '#e8b84a', goldDark: '#a87a22', brown: '#6b4a2c', hair: '#141016',
};

// Proportions. YN is a kid (big head, short limbs); OG is taller and broader.
export const SPECS = {
  yn: {
    og: false, ankle: 0.2, knee: 0.64, hip: 1.1, hips: 1.16, spine: 1.36, chest: 1.62, neck: 1.94,
    head: 2.02, headC: 2.36, R: 0.4, hipX: 0.18, shX: 0.4, shY: 1.9, elbow: 1.52, wrist: 1.16, hand: 1.0,
    thigh: 0.19, armU: 0.095, armW: 0.075, hipsA: 0.31, hipsB: 0.23, waistA: 0.28, waistB: 0.2,
    chestA: 0.33, chestB: 0.23, shA: 0.3, shB: 0.2, shieldR: 0.4, capeB: 0.5, height: 2.8, stride: 1,
  },
  og: {
    og: true, ankle: 0.24, knee: 0.96, hip: 1.7, hips: 1.78, spine: 2.06, chest: 2.42, neck: 2.9,
    head: 2.99, headC: 3.27, R: 0.33, hipX: 0.23, shX: 0.63, shY: 2.82, elbow: 2.26, wrist: 1.76, hand: 1.56,
    thigh: 0.25, armU: 0.16, armW: 0.105, hipsA: 0.4, hipsB: 0.27, waistA: 0.36, waistB: 0.24,
    chestA: 0.5, chestB: 0.3, shA: 0.47, shB: 0.27, shieldR: 0.52, capeB: 0.55, height: 3.65, stride: 1.4,
  },
};

const lerp = (a, b, t) => a + (b - a) * t;

function skeletonFor(s) {
  const { R, headC: hc } = s;
  const capeTop = s.shY + 0.02, capeLen = capeTop - s.capeB, cz = -(s.shB + 0.05);
  const defs = [
    ['root', null, [0, 0, 0]],
    ['hips', 'root', [0, s.hips, 0]],
    ['spine', 'hips', [0, s.spine, 0]],
    ['chest', 'spine', [0, s.chest, 0]],
    ['neck', 'chest', [0, s.neck, 0]],
    ['head', 'neck', [0, s.head, 0]],
    ['cap1', 'head', [0, hc + 1.2 * R, -0.75 * R]],
    ['cap2', 'cap1', [0, hc + 0.6 * R, -1.7 * R]],
    ['dread1', 'head', [0, hc - 0.9 * R, -0.9 * R]],
    ['dread2', 'dread1', [0, hc - 2.2 * R, -1.0 * R]],
    ['cape1', 'chest', [0, capeTop, cz]],
    ['cape2', 'cape1', [0, capeTop - capeLen * 0.38, cz - 0.08]],
    ['cape3', 'cape2', [0, capeTop - capeLen * 0.7, cz - 0.15]],
  ];
  for (const [n, sg] of [['L', 1], ['R', -1]]) {
    defs.push(
      ['arm' + n, 'chest', [sg * s.shX, s.shY, 0]],
      ['fore' + n, 'arm' + n, [sg * s.shX, s.elbow, 0]],
      ['hand' + n, 'fore' + n, [sg * s.shX, s.wrist, 0]],
      ['leg' + n, 'hips', [sg * s.hipX, s.hip, 0]],
      ['shin' + n, 'leg' + n, [sg * s.hipX, s.knee, 0]],
      ['foot' + n, 'shin' + n, [sg * s.hipX, s.ankle, 0]],
    );
  }
  return buildSkeleton(defs);
}

// Head silhouette: [height, half-width, half-depth, forward offset] in head radii.
const HEAD = [
  [-0.98, 0.3, 0.34, 0.1], [-0.72, 0.66, 0.74, 0.06], [-0.3, 0.92, 0.98, 0.02],
  [0.1, 1.0, 1.02, 0], [0.45, 0.95, 0.98, 0], [0.78, 0.7, 0.74, 0], [1.0, 0.25, 0.26, 0],
];
function headProfile(dy) {
  for (let i = 0; i < HEAD.length - 1; i++) {
    const a = HEAD[i], b = HEAD[i + 1];
    if (dy <= b[0]) {
      const t = Math.max(0, (dy - a[0]) / (b[0] - a[0]));
      return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    }
  }
  return HEAD[HEAD.length - 1].slice(1);
}

function buildGeometry(s, sk) {
  const k = new MeshKit(sk.index);
  const P = PAL, { R, headC: hc } = s;

  // ---- torso: jeans top, gold belt, black vest, bare shoulders, neck ----
  k.loft([
    { c: [0, s.hip - 0.1, 0], ra: s.hipsA * 0.55, rb: s.hipsB * 0.7, w: 'hips', col: P.denim },
    { c: [0, s.hips - 0.02, 0], ra: s.hipsA, rb: s.hipsB, w: 'hips', col: P.denim },
    { c: [0, s.hips + 0.1, 0], ra: s.hipsA * 0.98, rb: s.hipsB * 0.98, w: 'hips', col: P.denim },
    { c: [0, s.hips + 0.1, 0], ra: s.hipsA, rb: s.hipsB * 1.02, w: 'hips', col: P.gold },
    { c: [0, s.hips + 0.17, 0], ra: s.waistA * 1.06, rb: s.waistB * 1.08, w: { hips: 0.6, spine: 0.4 }, col: P.goldDark },
    { c: [0, s.hips + 0.17, 0], ra: s.waistA * 1.05, rb: s.waistB * 1.06, w: { hips: 0.6, spine: 0.4 }, col: P.redDark },
    { c: [0, s.spine, 0], ra: s.waistA, rb: s.waistB, w: 'spine', col: P.black },
    { c: [0, s.chest, 0.01], ra: s.chestA, rb: s.chestB, w: 'chest', col: P.black },
    { c: [0, s.shY - 0.04, 0], ra: s.shA, rb: s.shB, w: 'chest', col: P.grey },
    { c: [0, s.shY - 0.04, 0], ra: s.shA * 0.98, rb: s.shB * 0.98, w: 'chest', col: P.skin },
    { c: [0, s.neck, 0], r: R * 0.32, w: { chest: 0.5, neck: 0.5 }, col: P.skin },
    { c: [0, s.head + 0.08, 0], r: R * 0.28, w: 'neck', col: P.skin },
  ], { sides: 8, phase: Math.PI / 8, capA: true });
  // vest pouches and red chest stripe
  for (const sg of [1, -1]) k.box([sg * s.chestA * 0.42, s.spine + 0.07, s.waistB + 0.035], [s.chestA * 0.5, 0.15, 0.07], 'spine', P.grey);
  k.box([0, s.chest + 0.04, s.chestB + 0.02], [s.chestA * 1.25, 0.06, 0.04], 'chest', P.red);
  // T1 belt buckle
  k.box([0, s.hips + 0.135, s.hipsB + 0.02], [0.17, 0.13, 0.05], 'hips', P.redDark);
  k.patch(1, 1, (u, v) => [(u - 0.5) * 0.15, s.hips + 0.135 + (v - 0.5) * 0.15, s.hipsB + 0.05], { uv: UV.logo, w: 'hips' });

  // ---- cape mantle over the shoulders with a gold brooch ----
  k.loft([
    { c: [0, s.shY - 0.07, 0], ra: s.shA * 1.12, rb: s.shB * 1.2, w: 'chest', col: P.red },
    { c: [0, s.shY + 0.03, 0], ra: s.shA * 0.9, rb: s.shB * 1.12, w: 'chest', col: P.red },
    { c: [0, s.neck + 0.04, -0.01], ra: R * 0.46, rb: R * 0.5, w: 'chest', col: P.redDark },
  ], { sides: 8, phase: Math.PI / 8 });
  k.box([0, s.shY - 0.01, s.shB * 1.15 + 0.01], [0.1, 0.1, 0.05], 'chest', P.gold, { rot: [0, 0, Math.PI / 4] });

  // ---- cape: weighted down a three-bone chain so it can flow ----
  const capeTop = s.shY + 0.02, capeLen = capeTop - s.capeB;
  const capeW = [['chest', 1], ['chest', 'cape1'], ['cape1', 1], ['cape1', 'cape2'], ['cape2', 'cape3'], ['cape3', 1]];
  k.patch(4, 5, (u, v) => {
    const e = Math.abs(u * 2 - 1);
    const half = lerp(s.shA * 0.98, s.shA * 1.45 + 0.12, v);
    return [(u * 2 - 1) * half, capeTop - capeLen * v, -(s.shB + 0.04) - v * 0.26 + e * e * 0.16 * (1 - v * 0.6)];
  }, {
    col: (u, v) => v > 0.9 ? (s.og ? P.gold : P.redDark) : (v < 0.1 ? P.redDark : P.red),
    w: (u, v) => { const [a, b] = capeW[Math.round(v * 5)]; return b === 1 ? a : { [a]: 0.5, [b]: 0.5 }; },
  });

  // ---- arms (bare), wristbands, fists ----
  for (const [n, sg] of [['L', 1], ['R', -1]]) {
    const A = 'arm' + n, F = 'fore' + n, H = 'hand' + n, x = sg * s.shX;
    const band = s.og ? P.gold : (sg > 0 ? P.black : P.red);
    k.loft([
      { c: [x, s.shY + s.armU * 0.9, 0], r: s.armU * 0.55, w: A, col: P.skin },
      { c: [x, s.shY + 0.02, 0], r: s.armU * 1.1, w: A, col: P.skin },
      { c: [x, lerp(s.shY, s.elbow, 0.45), 0], r: s.armU * (s.og ? 1.12 : 1), w: A, col: P.skin },
      { c: [x, s.elbow + 0.05, 0], r: s.armW * 1.12, w: A, col: P.skin },
      { c: [x, s.elbow, 0], r: s.armW * 1.1, w: { [A]: 0.5, [F]: 0.5 }, col: P.skin },
      { c: [x, s.elbow - 0.06, 0], r: s.armW * 1.2, w: F, col: P.skin },
      { c: [x, s.wrist + 0.1, 0], r: s.armW, w: F, col: P.skin },
      { c: [x, s.wrist + 0.1, 0], r: s.armW * 1.3, w: F, col: band },
      { c: [x, s.wrist + 0.02, 0], r: s.armW * 1.3, w: F, col: band },
      { c: [x, s.wrist + 0.02, 0], r: s.armW * 0.95, w: H, col: P.skin },
      { c: [x, s.wrist - 0.06, 0.01], ra: s.armW * 1.05, rb: s.armW * 1.4, w: H, col: P.skin },
      { c: [x, s.hand + 0.03, 0.015], ra: s.armW * 0.95, rb: s.armW * 1.3, w: H, col: P.skin },
      { c: [x, s.hand, 0.015], r: s.armW * 0.5, w: H, col: P.skin },
    ], { sides: 6, capA: true, capB: true });
    // vest shoulder strap
    k.box([sg * s.shA * 0.62, s.shY - 0.005, 0], [0.11, 0.07, s.shB * 2.15], 'chest', P.black, { rot: [0, 0, -sg * 0.45] });
  }

  // ---- baggy jeans and tan boots ----
  const footLen = s.thigh * 2.3;
  for (const [n, sg] of [['L', 1], ['R', -1]]) {
    const L = 'leg' + n, S = 'shin' + n, Ft = 'foot' + n, x = sg * s.hipX;
    k.loft([
      { c: [x * 0.9, s.hip + 0.1, 0], r: s.thigh * 0.9, w: { hips: 0.6, [L]: 0.4 }, col: P.denim },
      { c: [x, s.hip - 0.06, 0], r: s.thigh * 1.05, w: L, col: P.denim },
      { c: [x, lerp(s.hip, s.knee, 0.6), 0], r: s.thigh, w: L, col: P.denimLight },
      { c: [x, s.knee, 0.01], r: s.thigh * 0.96, w: { [L]: 0.5, [S]: 0.5 }, col: P.denimLight },
      { c: [x, lerp(s.knee, s.ankle, 0.5), 0], r: s.thigh * 0.93, w: S, col: P.denim },
      { c: [x, s.ankle + 0.13, 0], r: s.thigh * 1.04, w: S, col: P.denim },
      { c: [x, s.ankle + 0.07, 0], r: s.thigh * 0.72, w: S, col: P.denim },
      { c: [x, s.ankle + 0.07, 0], r: s.thigh * 0.7, w: Ft, col: P.tan },
      { c: [x, s.ankle - 0.06, 0], r: s.thigh * 0.66, w: Ft, col: P.tanDark },
    ], { sides: 6, capA: true, capB: true });
    const fh = s.ankle * 0.8;
    k.box([x, 0.06 + fh / 2, footLen * 0.26], [s.thigh * 1.3, fh, footLen], Ft, P.tan, { taper: 0.84, colTop: P.tanDark });
    k.box([x, 0.03, footLen * 0.26], [s.thigh * 1.42, 0.06, footLen * 1.06], Ft, P.sole);
  }

  // ---- head, face decal, elf ears ----
  k.loft(HEAD.map(([dy, a, b, z]) => ({ c: [0, hc + dy * R, z * R], ra: a * R, rb: b * R, w: 'head', col: P.skin })),
    { sides: 10, phase: Math.PI / 10, capA: true, capB: true });
  k.patch(6, 5, (u, v) => {
    const dy = -0.85 + v * 1.45, [a, b, z] = headProfile(dy), th = (u - 0.5) * 1.96;
    return [Math.sin(th) * a * R * 1.04, hc + dy * R, z * R + Math.cos(th) * b * R * 1.04];
  }, { uv: s.og ? UV.faceOG : UV.faceYN, w: 'head' });
  for (const sg of [1, -1]) {
    k.cone([sg * R * 0.9, hc + 0.05 * R, -0.05 * R], [sg * R * 1.8, hc + 0.62 * R, -0.4 * R], R * 0.2, 'head', P.skin, { sides: 4 });
  }

  // ---- red-and-black dreads ----
  const dreadRoot = (deg, y) => {
    const th = deg * Math.PI / 180;
    return [Math.sin(th) * R * 0.93, hc + y * R, Math.cos(th) * R * 0.93, th];
  };
  if (!s.og) {
    for (let i = 0; i < 9; i++) {
      const [x, y, z, th] = dreadRoot(72 + i * 27, 0.2), len = R * (0.62 + (i % 3) * 0.1);
      k.cone([x, y, z], [x + Math.sin(th) * len * 0.42, y - len, z + Math.cos(th) * len * 0.42], R * 0.13, 'head', P.hair, { colTip: P.red });
    }
    for (const deg of [-42, 42]) {
      const [x, y, z, th] = dreadRoot(deg, 0.5);
      k.cone([x, y, z], [x + Math.sin(th) * R * 0.2, y - R * 0.34, z + Math.cos(th) * R * 0.14], R * 0.1, 'head', P.hair, { colTip: P.red });
    }
  } else {
    const long = (deg, len, front) => {
      const [x, y, z, th] = dreadRoot(deg, 0.15), out = front ? 0.12 : 0.2;
      const pt = t => [x + Math.sin(th) * len * out * t, y - len * t, z + Math.cos(th) * len * out * t + (front ? 0.1 * len * t : 0)];
      k.loft([
        { c: pt(0), r: R * 0.13, w: 'head', col: P.hair },
        { c: pt(0.4), r: R * 0.12, w: { head: 0.4, dread1: 0.6 }, col: P.hair },
        { c: pt(0.75), r: R * 0.1, w: front ? 'dread1' : { dread1: 0.4, dread2: 0.6 }, col: P.redDark },
        { c: pt(1), r: R * 0.05, w: front ? 'dread1' : 'dread2', col: P.red },
      ], { sides: 4, capA: true, capB: true });
    };
    for (let i = 0; i < 7; i++) long(108 + i * 24, R * (3.3 + (i % 2) * 0.35), false);
    for (const deg of [-88, -66, 66, 88]) long(deg, R * 2.3, true);
    // shades, chin beard, gold chain with pendant
    for (const sg of [1, -1]) k.box([sg * R * 0.42, hc + 0.12 * R, R * 0.97], [R * 0.66, R * 0.36, R * 0.12], 'head', P.black, { rot: [0, sg * 0.3, 0] });
    k.box([0, hc + 0.27 * R, R * 1.03], [R * 1.5, R * 0.07, R * 0.1], 'head', P.red);
    k.cone([0, hc - 0.8 * R, 0.5 * R], [0, hc - 1.5 * R, 0.62 * R], R * 0.24, 'head', P.hair, { sides: 4 });
    for (let i = 0; i <= 8; i++) {
      const a = (-80 + i * 20) * Math.PI / 180;
      k.box([Math.sin(a) * 0.25, s.shY - 0.1 - Math.cos(a) * 0.36, s.chestB + 0.04 - Math.abs(Math.sin(a)) * 0.05], [0.06, 0.06, 0.05], 'chest', P.gold);
    }
    k.box([0, s.shY - 0.55, s.chestB + 0.06], [0.15, 0.15, 0.04], 'chest', P.gold, { rot: [0, 0, Math.PI / 4] });
  }

  // ---- long draping red cap ----
  k.loft([
    { c: [0, hc + 0.38 * R, -0.02 * R], ra: 1.07 * R, rb: 1.11 * R, n: [0, 1, -0.15], w: 'head', col: P.redDark },
    { c: [0, hc + 0.52 * R, -0.04 * R], ra: 1.05 * R, rb: 1.08 * R, n: [0, 1, -0.15], w: 'head', col: P.red },
    { c: [0, hc + 0.95 * R, -0.25 * R], r: 0.8 * R, n: [0, 1, -0.5], w: 'head', col: P.red },
    { c: [0, hc + 1.22 * R, -0.7 * R], r: 0.55 * R, n: [0, 0.5, -1], w: { head: 0.5, cap1: 0.5 }, col: P.red },
    { c: [0, hc + 1.1 * R, -1.25 * R], r: 0.4 * R, n: [0, -0.3, -1], w: 'cap1', col: P.red },
    { c: [0, hc + 0.65 * R, -1.7 * R], r: 0.28 * R, n: [0, -1, -0.6], w: { cap1: 0.5, cap2: 0.5 }, col: P.redDark },
    { c: [0, hc - 0.05 * R, -1.9 * R], r: 0.17 * R, n: [0, -1, -0.1], w: 'cap2', col: P.red },
    { c: [0, hc - 0.7 * R, -1.85 * R], r: 0.06 * R, n: [0, -1, 0], w: 'cap2', col: P.gold },
  ], { sides: 8, capB: true });

  // ---- round T1 shield on the left forearm ----
  const sr = s.shieldR, sx = s.shX + s.armU + 0.08, sy = (s.elbow + s.wrist) / 2, sz = 0.02;
  const ring = (dx, r, col) => ({ c: [sx + dx, sy, sz], r: sr * r, n: [1, 0, 0], w: 'foreL', col });
  k.loft([ring(-0.035, 0.88, P.goldDark), ring(0, 1, P.gold), ring(0.035, 0.97, P.gold), ring(0.04, 0.8, P.goldDark),
    ring(0.04, 0.8, P.redDark), ring(0.075, 0.3, P.red)], { sides: 12, capA: true, capB: true });
  if (s.og) k.loft([ring(0.035, 0.97, P.gold), ring(0.07, 0.9, P.gold), ring(0.045, 0.8, P.goldDark)], { sides: 12 });
  k.patch(1, 1, (u, v) => [sx + 0.085, sy + (v - 0.5) * sr * 1.15, sz - (u - 0.5) * sr * 1.15], { uv: UV.logo, w: 'foreL' });

  // ---- crossbody satchel (left hip) and holster (right hip) ----
  const dx = s.hipsA + 0.6 * s.shA, dy = s.hips + 0.05 - s.shY, len = Math.hypot(dx, dy);
  k.box([(s.hipsA - 0.6 * s.shA) / 2, (s.shY + s.hips + 0.05) / 2, (s.chestB + s.waistB) / 2 + 0.035], [0.07, len, 0.03], 'chest', P.brown,
    { rot: [0, 0, Math.atan2(dx, -dy)] });
  k.box([s.hipsA + 0.09, s.hips - 0.04, -0.02], [0.14, 0.26, 0.32], 'hips', P.brown);
  k.box([s.hipsA + 0.1, s.hips + 0.06, -0.02], [0.15, 0.1, 0.33], 'hips', P.tan);
  k.box([s.hipsA + 0.175, s.hips + 0.02, -0.02], [0.02, 0.05, 0.06], 'hips', P.gold);
  k.box([-(s.hipsA + 0.06), s.hips - 0.12, 0.02], [0.09, 0.26, 0.16], { hips: 0.6, legR: 0.4 }, P.sole);

  return k.build();
}

// The GlockNina: part sidearm, part ocarina. Barrel along +Z, grip along -Y.
function buildGlockNina(scale) {
  const k = new MeshKit(null), P = PAL;
  k.box([0, 0.05, 0.1], [0.07, 0.08, 0.36], null, P.black);
  k.box([0, 0.095, 0.1], [0.035, 0.016, 0.3], null, P.gold);
  for (const z of [0.0, 0.08, 0.16]) k.box([0, 0.105, z], [0.024, 0.012, 0.024], null, P.red);
  k.box([0, 0.075, -0.11], [0.045, 0.045, 0.07], null, P.gold);
  k.box([0, 0.05, 0.3], [0.04, 0.04, 0.05], null, P.gold);
  k.box([0, -0.06, -0.02], [0.06, 0.17, 0.09], null, P.redDark, { rot: [0.25, 0, 0] });
  const g = k.build();
  g.scale(scale, scale, scale);
  return g;
}

let sharedMaterial = null;
function material() {
  if (!sharedMaterial) {
    sharedMaterial = new T.MeshLambertMaterial({ vertexColors: true, map: makeAtlas(), alphaTest: 0.5, side: T.DoubleSide });
  }
  return sharedMaterial;
}

function buildVariant(name) {
  const s = SPECS[name], sk = skeletonFor(s);
  const mesh = new T.SkinnedMesh(buildGeometry(s, sk), material());
  mesh.name = 'ToneDa-' + name;
  mesh.add(sk.root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(sk.bones));
  mesh.frustumCulled = false;

  const gs = s.og ? 1.3 : 1, gunGeo = buildGlockNina(gs);
  const gunHand = new T.Mesh(gunGeo, material());
  gunHand.rotation.x = Math.PI / 2;
  gunHand.position.set(0, -(s.wrist - s.hand) * 0.55 - 0.02 * gs, 0.075 * gs);
  gunHand.visible = false;
  sk.byName.handR.add(gunHand);
  const gunHip = new T.Mesh(gunGeo, material());
  gunHip.rotation.x = Math.PI / 2;
  gunHip.position.set(-(s.hipsA + 0.06), -0.02, 0.02);
  sk.byName.hips.add(gunHip);

  const mixer = new T.AnimationMixer(mesh), actions = {};
  for (const [clipName, clip] of Object.entries(makeClips(s))) {
    const a = mixer.clipAction(clip);
    if (ONE_SHOTS.has(clipName)) { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[clipName] = a;
  }
  return { name, spec: s, mesh, bones: sk.byName, mixer, actions, gunHand, gunHip, current: null };
}

export class ToneDa {
  constructor() {
    this.root = new T.Group();
    this.models = { yn: buildVariant('yn'), og: buildVariant('og') };
    for (const m of Object.values(this.models)) {
      this.root.add(m.mesh);
      m.mesh.visible = false;
      m.mixer.addEventListener('finished', e => { if (m === this.model && e.action === m.current) this.busy = false; });
    }
    this.variant = 'yn';
    this.busy = false;      // true while a one-shot (attack, roll, ...) is playing
    this.loco = 'idle';
    this.time = 0;
    this.swapAt = -1;
    this.sway = { cape: 0, speed: 0 };
    this.model.mesh.visible = true;
    this._fade('idle', 0);
  }

  get model() { return this.models[this.variant]; }
  get spec() { return this.model.spec; }
  get clipNames() { return Object.keys(this.model.actions); }

  _fade(name, time = 0.14) {
    const m = this.model, next = m.actions[name];
    if (!next) return;
    if (m.current === next && !ONE_SHOTS.has(name)) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    if (m.current && m.current !== next && time > 0) { next.crossFadeFrom(m.current, time, false); }
    else if (m.current && m.current !== next) m.current.stop();
    next.play();
    m.current = next;
    m.gunHand.visible = name === 'fire' || name === 'song';
    m.gunHip.visible = !m.gunHand.visible;
  }

  // Play a one-shot clip (punchR, punchL, kick, fire, roll, land, hurt, transform).
  play(name, fade = 0.07) {
    if (!this.model.actions[name]) return;
    this.busy = true;
    this._fade(name, fade);
  }

  // Hold a looping clip until release() (used for block and song).
  hold(name) { this.held = name; }
  release() { this.held = null; }

  setVariant(v) {
    if (v === this.variant) return;
    const old = this.model;
    old.mesh.visible = false;
    old.mixer.stopAllAction();
    old.current = null;
    this.variant = v;
    this.model.mesh.visible = true;
    this.busy = false;
    this._fade(this.loco, 0);
  }

  // Plays the transformation and swaps YN <-> OG at the peak of the pose.
  transform(toOG) {
    this.play('transform');
    this.swapTo = toOG ? 'og' : 'yn';
    this.swapAt = 0.5;
  }

  // state: { moving, sprint, grounded, vy }
  update(dt, state = {}) {
    this.time += dt;
    if (this.swapAt >= 0) {
      this.swapAt -= dt;
      if (this.swapAt < 0) {
        const t = this.model.current ? this.model.current.time : 0.5;
        this.setVariant(this.swapTo);
        this.play('transform', 0);
        this.model.current.time = t;
      }
    }
    const grounded = state.grounded !== false;
    let want = 'idle';
    if (!grounded) want = (state.vy || 0) > 0 ? 'jump' : 'fall';
    else if (this.held) want = this.held;
    else if (state.moving) want = state.sprint ? 'sprint' : (state.walk ? 'walk' : 'run');
    if (grounded && this.wasAir && !this.busy) this.play('land', 0.05);
    this.wasAir = !grounded;
    this.loco = want;
    if (!this.busy) this._fade(want, want === 'jump' ? 0.08 : 0.16);
    this.model.mixer.update(dt);
    this._secondary(dt, state, grounded);
  }

  // Cape, cap tail and dreads trail behind based on speed, with a little flutter.
  _secondary(dt, state, grounded) {
    const b = this.model.bones, t = this.time;
    const target = !grounded ? 0.75 - (state.vy || 0) * 0.05 : state.moving ? (state.sprint ? 1 : 0.6) : 0;
    this.sway.speed += (target - this.sway.speed) * Math.min(1, dt * 5);
    const v = this.sway.speed, flutter = 0.035 + v * 0.07;
    b.cape1.rotation.x = 0.05 + v * 0.5 + Math.sin(t * 5.2) * flutter;
    b.cape2.rotation.x = 0.04 + v * 0.3 + Math.sin(t * 5.2 - 0.9) * flutter * 1.4;
    b.cape3.rotation.x = 0.03 + v * 0.22 + Math.sin(t * 5.2 - 1.8) * flutter * 1.8;
    b.cape2.rotation.z = Math.sin(t * 3.1) * 0.04 * (1 + v);
    b.cap1.rotation.x = v * 0.35 + Math.sin(t * 4.3) * (0.03 + v * 0.05);
    b.cap2.rotation.x = v * 0.4 + Math.sin(t * 4.3 - 1) * (0.05 + v * 0.08);
    b.dread1.rotation.x = v * 0.4 + Math.sin(t * 4.7) * (0.02 + v * 0.05);
    b.dread2.rotation.x = v * 0.3 + Math.sin(t * 4.7 - 1.1) * (0.03 + v * 0.07);
  }
}
