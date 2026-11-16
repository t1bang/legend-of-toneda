// Loads the art-built character models (.glb) and the T1 shield, and wraps them in the
// same shape the code-built variants use, so the ToneDa controller can drive either.
//
// The .glb files are made by tools/artmodel from the approved turnaround art: the game
// shows that artwork itself, wrapped onto rounded body parts and skinned to the skeleton.
import * as T from '../../vendor/three.module.min.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { makeClips, ONE_SHOTS } from './anims.js';

const loader = new GLTFLoader();

// The shield file is 42 small vertex-coloured pieces; merge them into one mesh.
export async function loadShield(url) {
  const gltf = await loader.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const parts = [];
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const src = g.attributes.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
    const c = new T.Color();
    for (let i = 0; i < n; i++) {
      // the file stores its colours as ordinary screen (sRGB) values
      if (src) c.setRGB(src.getX(i), src.getY(i), src.getZ(i), T.SRGBColorSpace); else c.setRGB(1, 1, 1);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const clean = new T.BufferGeometry();
    clean.setAttribute('position', g.attributes.position);
    clean.setAttribute('color', new T.BufferAttribute(col, 3));
    parts.push(clean);
  });
  const geometry = mergeGeometries(parts);
  geometry.computeVertexNormals();
  return new T.Mesh(geometry, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
}

export async function loadArtVariant(name, url, { shield = null, gunGeometry = null, gunMaterial = null } = {}) {
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene, spec = Object.assign({ og: name === 'og', stride: 1 }, scene.userData.spec || {});
  const bones = {};
  scene.traverse(o => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) o.frustumCulled = false;
  });
  for (const need of ['hips', 'chest', 'head', 'handR', 'foreL', 'cape1', 'cape2', 'cape3', 'cap1', 'cap2', 'dread1', 'dread2']) {
    if (!bones[need]) throw new Error(url + ' is missing the bone "' + need + '"');
  }
  scene.name = 'ToneDa-' + name + '-art';

  // GlockNina in the right hand (shown while firing or playing a song)
  const gunHand = gunGeometry ? new T.Mesh(gunGeometry, gunMaterial) : new T.Object3D();
  gunHand.rotation.x = Math.PI / 2;
  gunHand.position.set(0, -(spec.wrist - spec.hand) * 0.5, 0.09);
  gunHand.visible = false;
  bones.handR.add(gunHand);
  const gunHip = new T.Object3D();                 // the holstered pistol is painted on his thigh

  // T1 shield strapped to the outside of the left forearm
  if (shield) {
    const s = shield.clone();
    s.rotation.set(1.05, Math.PI / 2, 0);        // faces outward; rolled so the T1 reads upright when the forearm is raised
    s.position.set(spec.armRadius + 0.12, -(spec.elbow - spec.wrist) * 0.55, 0.02);
    s.scale.setScalar(spec.shieldScale || 1);
    bones.foreL.add(s);
  }

  const mixer = new T.AnimationMixer(scene), actions = {};
  for (const [clipName, clip] of Object.entries(makeClips(spec))) {
    const a = mixer.clipAction(clip);
    if (ONE_SHOTS.has(clipName)) { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; }
    actions[clipName] = a;
  }
  return { name, spec, mesh: scene, bones, mixer, actions, gunHand, gunHip, current: null, art: true };
}
