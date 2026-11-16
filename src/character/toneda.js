// ToneDa — rigged, skinned, low-poly hero model in two forms (YN and OG),
// with an animation controller that blends between clips.
//
// Convention: the character faces +Z, his left side is +X, feet at Y = 0.
import * as T from '../../vendor/three.module.min.js';
import { MeshKit, buildSkeleton } from './meshkit.js';
import { makeAtlas, UV } from './textures.js';
import { makeClips, ONE_SHOTS } from './anims.js';
import { loadArtVariant, loadShield } from './art.js';

const PAL = {
  skin: '#a85c2c', skinDark: '#7d441f', red: '#b3182c', redDark: '#7a0f1f', black: '#17171d', grey: '#30313b',
  tan: '#e0a030', tanDark: '#b27a1c', sole: '#4a3016', gold: '#f0c040', goldDark: '#a87a22',
  brown: '#6b4226', brownLight: '#8a5a34', hair: '#141016', lens: '#0b0b10',
};

// Proportions, taken from the approved turnarounds: both forms are stocky,
// with a big head, big fists, balloon pants and oversized boots.
export const SPECS = {
  yn: {
    og: false, pants: '#2a2a31', pantsLight: '#3e3e48',
    ankle: 0.3, knee: 0.62, hip: 1.0, hips: 1.06, spine: 1.26, chest: 1.5, neck: 1.82,
    head: 1.9, headC: 2.28, R: 0.46, hipX: 0.22, shX: 0.47, shY: 1.76, elbow: 1.4, wrist: 1.08, hand: 0.9,
    thigh: 0.26, armU: 0.12, armW: 0.1, hipsA: 0.38, hipsB: 0.28, waistA: 0.34, waistB: 0.25,
    chestA: 0.38, chestB: 0.27, shA: 0.35, shB: 0.23, shieldR: 0.44, capeB: 0.26, height: 2.9, stride: 1,
  },
  og: {
    og: true, pants: '#2c3854', pantsLight: '#44547e',
    ankle: 0.36, knee: 0.9, hip: 1.5, hips: 1.58, spine: 1.86, chest: 2.2, neck: 2.66,
    head: 2.75, headC: 3.1, R: 0.42, hipX: 0.28, shX: 0.74, shY: 2.56, elbow: 2.04, wrist: 1.58, hand: 1.34,
    thigh: 0.33, armU: 0.2, armW: 0.14, hipsA: 0.48, hipsB: 0.33, waistA: 0.43, waistB: 0.3,
    chestA: 0.6, chestB: 0.35, shA: 0.55, shB: 0.31, shieldR: 0.56, capeB: 0.36, height: 3.75, stride: 1.4,
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
  const P = PAL, { R, headC: hc } = s, pants = s.pants, pantsLight = s.pantsLight;
  const disc = (c, r, w, col, depth = 0.04) => k.loft([
    { c, r, n: [0, 0, 1], w, col }, { c: [c[0], c[1], c[2] + depth], r: r * 0.85, n: [0, 0, 1], w, col },
  ], { sides: 8, capB: true });

  // ---- torso: pants top, belt, red sash (YN), black tactical vest, bare shoulders, neck ----
  const beltCol = s.og ? P.brown : P.black;
  k.loft([
    { c: [0, s.hip - 0.12, 0], ra: s.hipsA * 0.55, rb: s.hipsB * 0.7, w: 'hips', col: pants },
    { c: [0, s.hips - 0.03, 0], ra: s.hipsA, rb: s.hipsB, w: 'hips', col: pants },
    { c: [0, s.hips + 0.06, 0], ra: s.hipsA, rb: s.hipsB, w: 'hips', col: pants },
    { c: [0, s.hips + 0.06, 0], ra: s.hipsA * 1.03, rb: s.hipsB * 1.04, w: 'hips', col: beltCol },
    { c: [0, s.hips + 0.13, 0], ra: s.waistA * 1.08, rb: s.waistB * 1.1, w: 'hips', col: beltCol },
    { c: [0, s.hips + 0.13, 0], ra: s.waistA * 1.07, rb: s.waistB * 1.09, w: { hips: 0.6, spine: 0.4 }, col: s.og ? P.black : P.red },
    { c: [0, s.hips + 0.2, 0], ra: s.waistA * 1.05, rb: s.waistB * 1.07, w: { hips: 0.5, spine: 0.5 }, col: s.og ? P.black : P.redDark },
    { c: [0, s.hips + 0.2, 0], ra: s.waistA * 1.05, rb: s.waistB * 1.07, w: { hips: 0.5, spine: 0.5 }, col: P.black },
    { c: [0, s.chest, 0.01], ra: s.chestA, rb: s.chestB, w: 'chest', col: P.black },
    { c: [0, s.shY - 0.04, 0], ra: s.shA, rb: s.shB, w: 'chest', col: P.grey },
    { c: [0, s.shY - 0.04, 0], ra: s.shA * 0.98, rb: s.shB * 0.98, w: 'chest', col: P.skin },
    { c: [0, s.neck, 0], r: R * 0.3, w: { chest: 0.5, neck: 0.5 }, col: P.skin },
    { c: [0, s.head + 0.08, 0], r: R * 0.27, w: 'neck', col: P.skin },
  ], { sides: 8, phase: Math.PI / 8, capA: true });
  // vest pouches: a row of three on the belly and two on the chest
  const belly = (s.hips + 0.2 + s.chest) / 2 - 0.03;
  for (const i of [-1, 0, 1]) k.box([i * s.chestA * 0.52, belly, (s.waistB + s.chestB) / 2 + 0.05], [s.chestA * 0.44, 0.17, 0.1], 'spine', P.grey);
  for (const sg of [1, -1]) k.box([sg * s.chestA * 0.45, s.chest + 0.07, s.chestB + 0.035], [s.chestA * 0.42, 0.13, 0.08], 'chest', P.grey);
  // gold T1 belt buckle
  k.box([0, s.hips + 0.095, s.hipsB + 0.03], [0.18, 0.13, 0.05], 'hips', P.goldDark);
  k.patch(1, 1, (u, v) => [(u - 0.5) * 0.16, s.hips + 0.095 + (v - 0.5) * 0.16, s.hipsB + 0.06], { uv: UV.logo, w: 'hips' });
  if (!s.og) { // red tabard with gold hem
    k.box([0, s.hips - 0.1, s.hipsB + 0.035], [s.hipsA * 0.8, 0.3, 0.04], 'hips', P.red);
    k.box([0, s.hips - 0.25, s.hipsB + 0.04], [s.hipsA * 0.82, 0.05, 0.045], 'hips', P.gold);
  }

  // ---- cape mantle with gold edge, shoulder medallions and a gold chain ----
  k.loft([
    { c: [0, s.shY - 0.1, 0], ra: s.shA * 1.22, rb: s.shB * 1.28, w: 'chest', col: P.gold },
    { c: [0, s.shY - 0.07, 0], ra: s.shA * 1.2, rb: s.shB * 1.26, w: 'chest', col: P.red },
    { c: [0, s.shY + 0.03, 0], ra: s.shA * 0.92, rb: s.shB * 1.12, w: 'chest', col: P.red },
    { c: [0, s.neck + 0.04, -0.01], ra: R * 0.4, rb: R * 0.42, w: 'chest', col: P.redDark },
  ], { sides: 8, phase: Math.PI / 8 });
  for (const sg of [1, -1]) disc([sg * s.shA * 0.72, s.shY - 0.03, s.shB * 1.1], 0.075 * (s.og ? 1.3 : 1), 'chest', P.gold);
  const cw = s.og ? 0.26 : 0.15, cd = s.og ? 0.36 : 0.2, cb = s.og ? 0.065 : 0.045;
  for (let i = 0; i <= 8; i++) {
    const a = (-80 + i * 20) * Math.PI / 180;
    k.box([Math.sin(a) * cw, s.neck - 0.02 - Math.cos(a) * cd, s.chestB + 0.07 - Math.abs(Math.sin(a)) * 0.07], [cb, cb, cb * 0.8], 'chest', P.gold);
  }
  k.box([0, s.neck - 0.06 - cd, s.chestB + 0.085], [cb * 2, cb * 2, 0.035], 'chest', P.gold, { rot: [0, 0, Math.PI / 4] });

  // ---- cape: red with a crisp gold border, weighted down a three-bone chain ----
  const capeTop = s.shY + 0.02, capeLen = capeTop - s.capeB;
  const uu = [0, 0.06, 0.085, 0.5, 0.915, 0.94, 1], vv = [0, 0.2, 0.4, 0.6, 0.8, 0.9, 0.93, 1];
  const capeW = ['chest', { chest: 0.5, cape1: 0.5 }, 'cape1', { cape1: 0.5, cape2: 0.5 }, { cape2: 0.5, cape3: 0.5 }, 'cape3', 'cape3', 'cape3'];
  k.patch(6, 7, (u, v) => {
    const x = uu[Math.round(u * 6)], t = vv[Math.round(v * 7)], e = Math.abs(x * 2 - 1);
    const half = lerp(s.shA * 1.02, s.shA * 1.5 + 0.18, t);
    return [(x * 2 - 1) * half, capeTop - capeLen * t, -(s.shB + 0.05) - t * 0.3 + e * e * 0.18 * (1 - t * 0.6)];
  }, {
    col: (u, v) => { const i = Math.round(u * 6), j = Math.round(v * 7); return (i <= 1 || i >= 5 || j >= 6) ? P.gold : (j === 0 ? P.redDark : P.red); },
    w: (u, v) => capeW[Math.round(v * 7)],
  });

  // ---- arms (bare), bracers, big fists ----
  for (const [n, sg] of [['L', 1], ['R', -1]]) {
    const A = 'arm' + n, F = 'fore' + n, H = 'hand' + n, x = sg * s.shX;
    const cuff = s.og ? P.gold : P.black;
    k.loft([
      { c: [x, s.shY + s.armU * 0.9, 0], r: s.armU * 0.55, w: A, col: P.skin },
      { c: [x, s.shY + 0.01, 0], r: s.armU * (s.og ? 1.28 : 1.12), w: A, col: P.skin },
      { c: [x, lerp(s.shY, s.elbow, 0.45), 0], r: s.armU * (s.og ? 1.2 : 1), w: A, col: P.skin },
      { c: [x, s.elbow + 0.05, 0], r: s.armW * 1.12, w: A, col: P.skin },
      { c: [x, s.elbow, 0], r: s.armW * 1.1, w: { [A]: 0.5, [F]: 0.5 }, col: P.skin },
      { c: [x, s.elbow - 0.07, 0], r: s.armW * 1.25, w: F, col: P.skin },
      { c: [x, s.wrist + 0.2, 0], r: s.armW * 1.05, w: F, col: P.skin },
      { c: [x, s.wrist + 0.2, 0], r: s.armW * 1.5, w: F, col: cuff },
      { c: [x, s.wrist + 0.03, 0], r: s.armW * 1.45, w: F, col: cuff },
      { c: [x, s.wrist + 0.03, 0], r: s.armW, w: H, col: P.skin },
      { c: [x, s.wrist - 0.07, 0.01], ra: s.armW * 1.35, rb: s.armW * 1.6, w: H, col: P.skin },
      { c: [x, s.hand + 0.04, 0.015], ra: s.armW * 1.3, rb: s.armW * 1.55, w: H, col: P.skin },
      { c: [x, s.hand, 0.015], r: s.armW * 0.7, w: H, col: P.skinDark },
    ], { sides: 6, capA: true, capB: true });
    if (!s.og) k.box([x - sg * s.armW * 1.5, s.wrist + 0.115, 0], [0.04, 0.11, 0.1], F, P.gold);
    k.box([sg * s.shA * 0.62, s.shY - 0.005, 0], [0.11, 0.07, s.shB * 2.15], 'chest', P.black, { rot: [0, 0, -sg * 0.45] });
  }

  // ---- baggy cargo pants and big tan boots ----
  const footLen = s.thigh * 2.6, fw = s.thigh * 0.86, fh = s.ankle * 0.52, cy = 0.06 + fh;
  for (const [n, sg] of [['L', 1], ['R', -1]]) {
    const L = 'leg' + n, S = 'shin' + n, Ft = 'foot' + n, x = sg * s.hipX;
    k.loft([
      { c: [x * 0.9, s.hip + 0.1, 0], r: s.thigh * 0.9, w: { hips: 0.6, [L]: 0.4 }, col: pants },
      { c: [x, s.hip - 0.05, 0], r: s.thigh * 1.08, w: L, col: pants },
      { c: [x, lerp(s.hip, s.knee, 0.55), 0], r: s.thigh * 1.12, w: L, col: pantsLight },
      { c: [x, s.knee, 0.01], r: s.thigh * 1.08, w: { [L]: 0.5, [S]: 0.5 }, col: pantsLight },
      { c: [x, lerp(s.knee, s.ankle, 0.45), 0], r: s.thigh * 1.13, w: S, col: pants },
      { c: [x, s.ankle + 0.15, 0], r: s.thigh * 1.02, w: S, col: pants },
      { c: [x, s.ankle + 0.1, 0], r: s.thigh * 0.72, w: S, col: pants },
      { c: [x, s.ankle + 0.12, 0], r: s.thigh * 0.82, w: { [S]: 0.5, [Ft]: 0.5 }, col: P.tanDark },
      { c: [x, s.ankle + 0.04, 0], r: s.thigh * 0.78, w: Ft, col: P.tan },
      { c: [x, s.ankle - 0.12, 0], r: s.thigh * 0.76, w: Ft, col: P.tan },
    ], { sides: 8, capA: true, capB: true });
    k.box([x + sg * s.thigh * 1.08, lerp(s.hip, s.knee, 0.62), 0], [0.08, (s.hip - s.knee) * 0.5, s.thigh * 1.15], L, pantsLight);
    k.loft([
      { c: [x, cy, -footLen * 0.3], ra: fw * 0.85, rb: fh * 0.9, n: [0, 0, 1], w: Ft, col: P.tan },
      { c: [x, cy, -footLen * 0.1], ra: fw, rb: fh, n: [0, 0, 1], w: Ft, col: P.tan },
      { c: [x, cy, footLen * 0.3], ra: fw * 1.03, rb: fh, n: [0, 0, 1], w: Ft, col: P.tan },
      { c: [x, cy - fh * 0.15, footLen * 0.55], ra: fw * 0.92, rb: fh * 0.82, n: [0, 0, 1], w: Ft, col: P.tan },
      { c: [x, cy - fh * 0.3, footLen * 0.68], ra: fw * 0.62, rb: fh * 0.58, n: [0, 0, 1], w: Ft, col: P.tanDark },
    ], { sides: 8, capA: true, capB: true });
    k.box([x, 0.035, footLen * 0.17], [fw * 1.95, 0.07, footLen * 0.96], Ft, P.sole);
    k.box([x, cy + fh * 0.75, footLen * 0.2], [fw * 0.7, 0.05, footLen * 0.4], Ft, P.tanDark);
  }

  // ---- head, face decal, elf ears with gold earrings ----
  k.loft(HEAD.map(([dy, a, b, z]) => ({ c: [0, hc + dy * R, z * R], ra: a * R, rb: b * R, w: 'head', col: P.skin })),
    { sides: 10, phase: Math.PI / 10, capA: true, capB: true });
  k.patch(6, 5, (u, v) => {
    const dy = -0.85 + v * 1.45, [a, b, z] = headProfile(dy), th = (u - 0.5) * 1.96;
    return [Math.sin(th) * a * R * 1.04, hc + dy * R, z * R + Math.cos(th) * b * R * 1.04];
  }, { uv: s.og ? UV.faceOG : UV.faceYN, w: 'head' });
  for (const sg of [1, -1]) {
    k.cone([sg * R * 0.9, hc + 0.05 * R, -0.05 * R], [sg * R * 1.85, hc + 0.5 * R, -0.35 * R], R * 0.22, 'head', P.skin, { sides: 4 });
    k.box([sg * R * 1.02, hc - 0.32 * R, 0.02 * R], [R * 0.13, R * 0.24, R * 0.13], 'head', P.gold);
  }

  // ---- black dreads with red tips and gold beads ----
  const dreadRoot = (deg, y) => {
    const th = deg * Math.PI / 180;
    return [Math.sin(th) * R * 0.95, hc + y * R, Math.cos(th) * R * 0.95, th];
  };
  if (!s.og) {
    for (let i = 0; i < 11; i++) {
      const [x, y, z, th] = dreadRoot(60 + i * 24, 0.25), len = R * (0.78 + (i % 3) * 0.12);
      const tip = [x + Math.sin(th) * len * 0.35, y - len, z + Math.cos(th) * len * 0.35];
      const at = t => [lerp(x, tip[0], t), lerp(y, tip[1], t), lerp(z, tip[2], t)];
      k.loft([
        { c: at(0), r: R * 0.15, w: 'head', col: P.hair }, { c: at(0.62), r: R * 0.14, w: 'head', col: P.hair },
        { c: at(0.7), r: R * 0.13, w: 'head', col: P.red }, { c: at(1), r: R * 0.06, w: 'head', col: P.red },
      ], { sides: 4, capA: true, capB: true });
      if (i % 2 === 0) k.box([lerp(x, tip[0], 0.6), lerp(y, tip[1], 0.6), lerp(z, tip[2], 0.6)], [R * 0.13, R * 0.1, R * 0.13], 'head', P.gold);
    }
    for (const deg of [-50, -25, 0, 25, 50]) {
      const [x, y, z, th] = dreadRoot(deg, 0.5), len = R * (deg === 0 ? 0.26 : 0.36);
      k.cone([x, y, z + 0.04 * R], [x + Math.sin(th) * R * 0.12, y - len, z + Math.cos(th) * R * 0.14], R * 0.13, 'head', P.hair, { colTip: P.redDark });
    }
  } else {
    const long = (deg, len, front) => {
      const [x, y, z, th] = dreadRoot(deg, 0.15), out = front ? 0.12 : 0.2;
      const pt = t => [x + Math.sin(th) * len * out * t, y - len * t, z + Math.cos(th) * len * out * t + (front ? 0.1 * len * t : 0)];
      k.loft([
        { c: pt(0), r: R * 0.14, w: 'head', col: P.hair },
        { c: pt(0.4), r: R * 0.13, w: { head: 0.4, dread1: 0.6 }, col: P.hair },
        { c: pt(0.75), r: R * 0.11, w: front ? 'dread1' : { dread1: 0.4, dread2: 0.6 }, col: P.redDark },
        { c: pt(1), r: R * 0.06, w: front ? 'dread1' : 'dread2', col: P.red },
      ], { sides: 4, capA: true, capB: true });
      k.box(pt(0.82), [R * 0.2, R * 0.12, R * 0.2], front ? 'dread1' : 'dread2', P.gold);
    };
    for (let i = 0; i < 7; i++) long(108 + i * 24, R * (2.9 + (i % 2) * 0.35), false);
    for (const deg of [-88, -66, 66, 88]) long(deg, R * 2.0, true);
    // black shades with gold frames, chin beard
    for (const sg of [1, -1]) k.box([sg * R * 0.42, hc + 0.12 * R, R * 0.97], [R * 0.68, R * 0.36, R * 0.12], 'head', P.lens, { rot: [0, sg * 0.3, 0] });
    k.box([0, hc + 0.29 * R, R * 1.03], [R * 1.55, R * 0.07, R * 0.1], 'head', P.gold);
    k.box([0, hc + 0.14 * R, R * 1.07], [R * 0.18, R * 0.1, R * 0.08], 'head', P.gold);
    k.cone([0, hc - 0.8 * R, 0.5 * R], [0, hc - 1.45 * R, 0.62 * R], R * 0.24, 'head', P.hair, { sides: 4 });
  }

  // ---- long red cap with a T1 band, tail draping back and to his right ----
  const tilt = [0, 1, -0.15];
  k.loft([
    { c: [0, hc + 0.38 * R, -0.02 * R], ra: 1.09 * R, rb: 1.13 * R, n: tilt, w: 'head', col: P.redDark },
    { c: [0, hc + 0.74 * R, -0.04 * R], ra: 1.08 * R, rb: 1.12 * R, n: tilt, w: 'head', col: P.red },
    { c: [-0.03 * R, hc + 1.18 * R, -0.25 * R], r: 0.84 * R, n: [0, 1, -0.5], w: 'head', col: P.red },
    { c: [-0.15 * R, hc + 1.5 * R, -0.7 * R], r: 0.58 * R, n: [0, 0.5, -1], w: { head: 0.5, cap1: 0.5 }, col: P.red },
    { c: [-0.4 * R, hc + 1.38 * R, -1.25 * R], r: 0.42 * R, n: [0, -0.3, -1], w: 'cap1', col: P.red },
    { c: [-0.65 * R, hc + 0.9 * R, -1.7 * R], r: 0.3 * R, n: [0, -1, -0.6], w: { cap1: 0.5, cap2: 0.5 }, col: P.redDark },
    { c: [-0.8 * R, hc + 0.15 * R, -1.9 * R], r: 0.18 * R, n: [0, -1, -0.1], w: 'cap2', col: P.red },
    { c: [-0.82 * R, hc - 0.55 * R, -1.85 * R], r: 0.07 * R, n: [0, -1, 0], w: 'cap2', col: P.redDark },
  ], { sides: 8, capB: true });
  k.patch(2, 1, (u, v) => {
    const x = (u - 0.5) * 0.66 * R;
    return [x, hc + (0.55 + 0.36 * v) * R, (1.135 - 0.055 * v) * R - Math.abs(x) * 0.12];
  }, { uv: UV.logo, w: 'head' });

  // ---- round T1 shield on the left forearm: black rim, gold studs, red centre ----
  const sr = s.shieldR, sx = s.shX + s.armU + 0.1, sy = (s.elbow + s.wrist) / 2, sz = 0.02;
  const ring = (dx, r, col) => ({ c: [sx + dx, sy, sz], r: sr * r, n: [1, 0, 0], w: 'foreL', col });
  k.loft([ring(-0.04, 0.88, P.black), ring(0, 1, P.black), ring(0.045, 0.98, P.grey), ring(0.05, 0.78, P.black),
    ring(0.05, 0.78, P.redDark), ring(0.095, 0.3, P.red)], { sides: 14, capA: true, capB: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    k.box([sx + 0.055, sy + Math.cos(a) * sr * 0.88, sz + Math.sin(a) * sr * 0.88], [0.035, sr * 0.13, sr * 0.13], 'foreL', P.gold);
  }
  k.patch(1, 1, (u, v) => [sx + 0.105, sy + (v - 0.5) * sr * 1.05, sz - (u - 0.5) * sr * 1.05], { uv: UV.logo, w: 'foreL' });
  k.box([sx - 0.07, sy, sz], [0.08, sr * 0.3, sr * 0.9], 'foreL', P.brown); // arm strap

  // ---- crossbody satchel (left hip) and holster (right hip) ----
  const dx = s.hipsA + 0.6 * s.shA, dy = s.hips + 0.05 - s.shY, len = Math.hypot(dx, dy);
  k.box([(s.hipsA - 0.6 * s.shA) / 2, (s.shY + s.hips + 0.05) / 2, (s.chestB + s.waistB) / 2 + 0.11], [0.09, len, 0.03], 'chest', P.brown,
    { rot: [0, 0, Math.atan2(dx, -dy)] });
  k.box([s.hipsA * 0.25, s.hips + 0.3, (s.chestB + s.waistB) / 2 + 0.125], [0.13, 0.1, 0.03], 'spine', P.gold, { rot: [0, 0, Math.atan2(dx, -dy)] });
  k.box([s.hipsA + 0.1, s.hips - 0.06, 0.1], [0.2, 0.32, 0.4], 'hips', P.brown);
  k.box([s.hipsA + 0.11, s.hips + 0.05, 0.1], [0.22, 0.15, 0.42], 'hips', P.brownLight);
  k.box([s.hipsA + 0.225, s.hips - 0.02, 0.1], [0.02, 0.08, 0.08], 'hips', P.gold);
  k.box([-(s.hipsA + 0.07), s.hips - 0.14, 0.02], [0.1, 0.3, 0.18], { hips: 0.6, legR: 0.4 }, P.black);
  k.box([-(s.hipsA + 0.125), s.hips - 0.14, 0.02], [0.02, 0.2, 0.1], { hips: 0.6, legR: 0.4 }, P.red);

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
      this._listen(m);
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

  _listen(m) {
    m.mixer.addEventListener('finished', e => { if (m === this.model && e.action === m.current) this.busy = false; });
  }

  // Swap one form's model for another (used when an art-built .glb finishes loading).
  adopt(name, variant) {
    const old = this.models[name], showing = this.variant === name;
    old.mixer.stopAllAction();
    this.root.remove(old.mesh);
    this.models[name] = variant;
    this.root.add(variant.mesh);
    variant.mesh.visible = showing;
    this._listen(variant);
    if (showing) { this.busy = false; this._fade(this.held || this.loco, 0); }
  }

  // Load the models built from the approved artwork. Any form whose file is missing or
  // broken keeps its code-built stand-in. Returns the names that loaded.
  async loadArt(base = 'assets/models/') {
    const loaded = [];
    let shield = null;
    try { shield = await loadShield(base + 't1-circular-shield.glb'); } catch (e) { console.warn('Shield model not loaded:', e.message); }
    for (const name of ['yn', 'og']) {
      try {
        const v = await loadArtVariant(name, base + name + '-toneda.glb', { shield, gunGeometry: buildGlockNina(name === 'og' ? 1.45 : 1.15), gunMaterial: material() });
        this.adopt(name, v);
        loaded.push(name);
      } catch (e) { console.warn('Art model for ' + name + ' not loaded, keeping the stand-in:', e.message); }
    }
    return loaded;
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
