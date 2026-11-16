// Animation clips for ToneDa, authored as keyframed bone poses.
// A pose is { boneName: [rx, ry, rz] } in radians (bones not listed stay at rest),
// plus an optional `y` for how far the hips move up or down.
//
// Sign guide (character faces +Z, left is +X):
//   leg/arm rx < 0 swings it forward, shin rx > 0 bends the knee, fore rx < 0 bends the elbow,
//   armL rz > 0 / armR rz < 0 lifts the arm out to the side, spine rx > 0 leans forward.
import * as T from '../../vendor/three.module.min.js';

export const BODY_BONES = ['hips', 'spine', 'chest', 'neck', 'head',
  'armL', 'foreL', 'handL', 'armR', 'foreR', 'handR',
  'legL', 'shinL', 'footL', 'legR', 'shinR', 'footR'];

export const ONE_SHOTS = new Set(['punchR', 'punchL', 'kick', 'fire', 'roll', 'land', 'hurt', 'transform']);

const merge = (...poses) => Object.assign({}, ...poses);
function mix(a, b, t) {
  const out = { y: (a.y || 0) + ((b.y || 0) - (a.y || 0)) * t };
  for (const bone of BODY_BONES) {
    const p = a[bone] || [0, 0, 0], q = b[bone] || [0, 0, 0];
    out[bone] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  }
  return out;
}
function mirror(pose) {
  const out = { y: pose.y || 0 };
  for (const [bone, v] of Object.entries(pose)) {
    if (bone === 'y') continue;
    const name = bone.endsWith('L') ? bone.slice(0, -1) + 'R' : bone.endsWith('R') ? bone.slice(0, -1) + 'L' : bone;
    out[name] = [v[0], -v[1], -v[2]];
  }
  return out;
}

// Relaxed standing pose that everything returns to.
const B = {
  armL: [0.06, 0, 0.16], foreL: [-0.45, 0, 0], armR: [0.06, 0, -0.16], foreR: [-0.3, 0, 0],
  legL: [0, 0, 0.07], legR: [0, 0, -0.07], footL: [0, 0, -0.07], footR: [0, 0, 0.07],
};
// Fighting stance.
const G = merge(B, {
  armL: [-0.7, 0, 0.1], foreL: [-1.7, 0, 0], armR: [-0.5, 0, -0.1], foreR: [-1.9, 0, 0],
  legL: [-0.3, 0, 0.08], shinL: [0.35, 0, 0], legR: [0.3, 0, -0.08], shinR: [0.2, 0, 0], spine: [0.08, 0, 0], y: -0.04,
});

function locomotion(dur, A, K, arm, F, tw, bob, lean) {
  const keys = [], N = 12;
  for (let i = 0; i <= N; i++) {
    const ph = (i / N) * Math.PI * 2, sL = Math.sin(ph), cL = Math.cos(ph);
    const legL = -A * sL, legR = A * sL;
    const shinL = K * Math.max(0, cL) + 0.12, shinR = K * Math.max(0, -cL) + 0.12;
    keys.push([dur * i / N, {
      hips: [0, -tw * 0.6 * sL, 0], spine: [lean * 0.5, tw * 0.6 * sL, 0], chest: [lean * 0.5, tw * sL, 0],
      head: [-lean * 0.6, -tw * sL, 0],
      legL: [legL, 0, 0.04], shinL: [shinL, 0, 0], footL: [-(legL + shinL) * 0.6, 0, 0],
      legR: [legR, 0, -0.04], shinR: [shinR, 0, 0], footR: [-(legR + shinR) * 0.6, 0, 0],
      armL: [arm * sL, 0, 0.13], foreL: [-F * (1 - 0.35 * sL), 0, 0],
      armR: [-arm * sL, 0, -0.13], foreR: [-F * (1 + 0.35 * sL), 0, 0],
      y: bob * (0.5 * Math.cos(2 * ph) - 0.5),
    }]);
  }
  return keys;
}

export function makeClips(s) {
  const f = s.hips / 1.16;          // scale vertical offsets to the character's size
  const pace = Math.sqrt(s.stride); // longer legs take slower steps
  const euler = new T.Euler(), quat = new T.Quaternion();

  function clip(name, keys) {
    const times = keys.map(k => k[0]), tracks = [];
    for (const bone of BODY_BONES) {
      const values = [];
      for (const [, pose] of keys) {
        const r = pose[bone] || [0, 0, 0];
        quat.setFromEuler(euler.set(r[0], r[1], r[2], 'XYZ'));
        values.push(quat.x, quat.y, quat.z, quat.w);
      }
      tracks.push(new T.QuaternionKeyframeTrack(bone + '.quaternion', times, values));
    }
    const ys = [];
    for (const [, pose] of keys) ys.push(0, s.hips + (pose.y || 0) * f, 0);
    tracks.push(new T.VectorKeyframeTrack('hips.position', times, ys));
    return new T.AnimationClip(name, times[times.length - 1], tracks);
  }

  const clips = {};
  const add = (name, keys) => { clips[name] = clip(name, keys); };

  add('idle', [
    [0, B],
    [1.2, merge(B, { chest: [0.04, 0, 0], spine: [0.012, 0, 0], head: [-0.03, 0.05, 0], armL: [0.06, 0, 0.2], armR: [0.06, 0, -0.2], y: -0.012 })],
    [2.4, B],
  ]);

  add('walk', locomotion(0.85 * pace, 0.5, 0.9, 0.4, 0.3, 0.08, 0.03, 0.06));
  add('run', locomotion(0.56 * pace, 0.85, 1.5, 0.8, 1.1, 0.14, 0.07, 0.2));
  add('sprint', locomotion(0.44 * pace, 1.05, 1.8, 1.1, 1.3, 0.18, 0.08, 0.36));

  const J = {
    legL: [-1.0, 0, 0.05], shinL: [1.5, 0, 0], footL: [0.3, 0, 0], legR: [0.25, 0, -0.05], shinR: [0.5, 0, 0], footR: [0.5, 0, 0],
    armL: [-0.5, 0, 0.9], foreL: [-0.5, 0, 0], armR: [0.5, 0, -0.7], foreR: [-0.6, 0, 0],
    spine: [0.1, 0, 0], chest: [0.08, 0, 0], head: [-0.15, 0, 0],
  };
  add('jump', [[0, J], [0.3, merge(J, { armL: [-0.6, 0, 1.0], armR: [0.55, 0, -0.8] })], [0.6, J]]);

  const Fa = {
    legL: [-0.45, 0, 0.12], shinL: [0.7, 0, 0], footL: [0.4, 0, 0], legR: [-0.1, 0, -0.12], shinR: [0.9, 0, 0], footR: [0.4, 0, 0],
    armL: [-0.2, 0, 1.25], foreL: [-0.4, 0, 0], armR: [-0.2, 0, -1.25], foreR: [-0.4, 0, 0], spine: [0.12, 0, 0], head: [0.12, 0, 0],
  };
  add('fall', [[0, Fa], [0.25, merge(Fa, { armL: [-0.1, 0, 1.45], armR: [-0.3, 0, -1.1], legL: [-0.55, 0, 0.12] })], [0.5, Fa]]);

  const C = {
    legL: [-0.85, 0, 0.1], shinL: [1.5, 0, 0], footL: [-0.65, 0, 0], legR: [-0.85, 0, -0.1], shinR: [1.5, 0, 0], footR: [-0.65, 0, 0],
    spine: [0.45, 0, 0], chest: [0.15, 0, 0], head: [-0.3, 0, 0],
    armL: [0.3, 0, 0.5], foreL: [-0.6, 0, 0], armR: [0.3, 0, -0.5], foreR: [-0.6, 0, 0], y: -0.24,
  };
  add('land', [[0, mix(B, C, 0.55)], [0.07, C], [0.24, B]]);

  const Tk = {
    legL: [-1.9, 0, 0.1], shinL: [2.2, 0, 0], legR: [-1.9, 0, -0.1], shinR: [2.2, 0, 0],
    spine: [0.6, 0, 0], chest: [0.5, 0, 0], head: [0.5, 0, 0],
    armL: [-1.2, 0, 0.2], foreL: [-1.7, 0, 0], armR: [-1.2, 0, -0.2], foreR: [-1.7, 0, 0],
  };
  const spin = (pose, turns, y) => merge(pose, { hips: [turns * Math.PI * 2, 0, 0], y });
  add('roll', [
    [0, spin(mix(B, Tk, 0.5), 0, -0.2)],
    [0.1, spin(Tk, 0.2, -0.52)],
    [0.22, spin(Tk, 0.47, -0.62)],
    [0.34, spin(Tk, 0.75, -0.62)],
    [0.46, spin(mix(B, Tk, 0.6), 1, -0.36)],
    [0.56, spin(B, 1, 0)],
  ]);

  const punchKeys = [
    [0, mix(B, G, 0.5)],
    [0.07, merge(G, { chest: [0.05, -0.4, 0], spine: [0.05, -0.2, 0], head: [0, 0.4, 0], armR: [0.5, 0, -0.3], foreR: [-2.1, 0, 0] })],
    [0.15, merge(G, { chest: [0.12, 0.35, 0], spine: [0.1, 0.15, 0], head: [0, -0.35, 0], armR: [-1.5, 0, -0.45], foreR: [-0.05, 0, 0],
      legL: [-0.5, 0, 0.08], shinL: [0.5, 0, 0], y: -0.07 })],
    [0.23, merge(G, { chest: [0.12, 0.3, 0], spine: [0.1, 0.13, 0], head: [0, -0.3, 0], armR: [-1.45, 0, -0.45], foreR: [-0.15, 0, 0],
      legL: [-0.5, 0, 0.08], shinL: [0.5, 0, 0], y: -0.07 })],
    [0.36, mix(B, G, 0.6)],
  ];
  add('punchR', punchKeys);
  add('punchL', punchKeys.map(([t, p]) => [t, mirror(p)]));

  add('kick', [
    [0, mix(B, G, 0.5)],
    [0.1, merge(G, { hips: [0, 0.25, 0], spine: [-0.1, 0, 0], legR: [-0.9, 0, -0.1], shinR: [1.9, 0, 0] })],
    [0.2, merge(G, { hips: [-0.12, 0.3, 0], spine: [-0.3, 0, 0], chest: [-0.1, 0, 0], head: [0.3, -0.2, 0],
      legR: [-1.5, 0, -0.1], shinR: [0.1, 0, 0], footR: [0.3, 0, 0], legL: [0.12, 0, 0.05], shinL: [0.15, 0, 0],
      armL: [-0.3, 0, 0.6], armR: [0.4, 0, -0.5] })],
    [0.29, merge(G, { hips: [-0.12, 0.3, 0], spine: [-0.28, 0, 0], chest: [-0.1, 0, 0], head: [0.3, -0.2, 0],
      legR: [-1.42, 0, -0.1], shinR: [0.2, 0, 0], footR: [0.3, 0, 0], legL: [0.12, 0, 0.05], shinL: [0.15, 0, 0],
      armL: [-0.3, 0, 0.6], armR: [0.4, 0, -0.5] })],
    [0.46, mix(B, G, 0.5)],
  ]);

  const aim = merge(B, {
    armR: [-1.5, 0, -0.3], foreR: [-0.05, 0, 0], chest: [0.03, 0.3, 0], spine: [0, 0.1, 0], head: [0, -0.3, 0],
    armL: [-0.9, 0, -0.1], foreL: [-1.5, 0, 0], legL: [-0.25, 0, 0.1], shinL: [0.25, 0, 0], legR: [0.25, 0, -0.1], shinR: [0.15, 0, 0],
  });
  add('fire', [
    [0, mix(B, aim, 0.4)], [0.07, aim],
    [0.11, merge(aim, { armR: [-1.8, 0, -0.3], foreR: [-0.32, 0, 0], chest: [-0.05, 0.22, 0] })],
    [0.2, aim], [0.3, aim], [0.42, mix(B, aim, 0.3)],
  ]);

  const Bl = merge(B, {
    armL: [-0.6, -1.2, 0], foreL: [-1.5, 0, 0], armR: [0.3, 0, -0.3], foreR: [-1.2, 0, 0],
    legL: [-0.5, 0, 0.12], shinL: [0.8, 0, 0], footL: [-0.3, 0, 0], legR: [-0.15, 0, -0.15], shinR: [0.7, 0, 0], footR: [-0.5, 0, 0],
    spine: [0.2, 0, 0], chest: [0.05, -0.3, 0], head: [-0.1, 0.3, 0], y: -0.13,
  });
  add('block', [[0, Bl], [0.6, merge(Bl, { spine: [0.23, 0, 0], y: -0.15 })], [1.2, Bl]]);

  add('hurt', [
    [0, B],
    [0.08, merge(B, { spine: [-0.35, 0, 0], chest: [-0.2, 0.2, 0], head: [-0.35, 0, 0], armL: [-0.3, 0, 0.9], armR: [0.2, 0, -0.9],
      legL: [0.2, 0, 0.1], shinL: [0.3, 0, 0], legR: [-0.25, 0, -0.1], shinR: [0.4, 0, 0], y: -0.05 })],
    [0.34, B],
  ]);

  const gather = {
    spine: [0.4, 0, 0], chest: [0.25, 0, 0], head: [0.35, 0, 0],
    armL: [-1.0, 0, -0.5], foreL: [-1.7, 0, 0], armR: [-1.0, 0, 0.5], foreR: [-1.7, 0, 0],
    legL: [-0.6, 0, 0.15], shinL: [1.1, 0, 0], footL: [-0.5, 0, 0], legR: [-0.6, 0, -0.15], shinR: [1.1, 0, 0], footR: [-0.5, 0, 0], y: -0.14,
  };
  const burst = {
    spine: [-0.25, 0, 0], chest: [-0.25, 0, 0], head: [-0.4, 0, 0],
    armL: [0.2, 0, 2.1], foreL: [-0.3, 0, 0], armR: [0.2, 0, -2.1], foreR: [-0.3, 0, 0],
    legL: [0, 0, 0.3], legR: [0, 0, -0.3], footL: [0, 0, -0.3], footR: [0, 0, 0.3],
  };
  add('transform', [[0, B], [0.3, gather], [0.5, burst], [0.8, merge(burst, { head: [-0.3, 0, 0] })], [1.0, B]]);

  const So = merge(B, { armR: [-1.0, 0, 0.55], foreR: [-2.0, 0, 0], armL: [-1.0, 0, -0.5], foreL: [-1.9, 0, 0], head: [0.12, 0, 0] });
  add('song', [
    [0, merge(So, { chest: [0.05, 0.12, 0], hips: [0, 0, 0.04] })],
    [0.8, merge(So, { chest: [0.05, -0.12, 0], hips: [0, 0, -0.04], y: -0.03 })],
    [1.6, merge(So, { chest: [0.05, 0.12, 0], hips: [0, 0, 0.04] })],
  ]);

  // climbing a ladder: opposite arm and leg reach up together
  const Cl = { spine: [0.1, 0, 0], head: [-0.25, 0, 0],
    armL: [-2.5, 0, 0.1], foreL: [-0.5, 0, 0], armR: [-1.3, 0, -0.1], foreR: [-1.5, 0, 0],
    legL: [-0.2, 0, 0.05], shinL: [0.4, 0, 0], footL: [-0.2, 0, 0], legR: [-1.1, 0, -0.05], shinR: [1.5, 0, 0], footR: [-0.4, 0, 0] };
  add('climb', [[0, Cl], [0.35, mirror(Cl)], [0.7, Cl]]);

  return clips;
}
