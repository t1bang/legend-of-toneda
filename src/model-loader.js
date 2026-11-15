// Optional GLB model-loader module. Not wired into index.html until actual models exist.
// Uses the same Three.js version as the current prototype.
import * as THREE from 'https://esm.sh/three@0.170.0';
import { GLTFLoader } from 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const load = (url) => new Promise((resolve,reject)=>loader.load(url,resolve,undefined,reject));

export async function loadToneDaModel(kind='yn') {
  const url = kind === 'og' ? '/assets/models/og-toneda.glb' : '/assets/models/yn-toneda.glb';
  const gltf = await load(url);
  const root = gltf.scene;
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();
  for (const clip of gltf.animations) actions.set(clip.name.toLowerCase(),mixer.clipAction(clip));
  let current = null;
  const play = (name,fade=.18) => {
    const action = actions.get(name.toLowerCase()) || [...actions].find(([key])=>key.includes(name.toLowerCase()))?.[1];
    if (!action || current===action) return false;
    action.reset().fadeIn(fade).play();
    if(current) current.fadeOut(fade);
    current=action;return true;
  };
  return {root,mixer,actions,play,update:(dt)=>mixer.update(dt),clips:gltf.animations.map(c=>c.name)};
}
