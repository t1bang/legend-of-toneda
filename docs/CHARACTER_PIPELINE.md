# Character pipeline

ToneDa is a real rigged model: one skinned mesh per form (YN and OG), a 25-bone
skeleton, and keyframed animation clips blended by an `AnimationMixer`.
It is built in code, so there are no model files to download or lose.

| File | What it does |
| --- | --- |
| `src/character/meshkit.js` | Low-poly modelling helpers (lofted tubes, boxes, cones, patches) that write bone weights per vertex |
| `src/character/textures.js` | 128x128 pixel-art atlas drawn in code: both faces and the T1 logo |
| `src/character/toneda.js` | Proportions for YN and OG, the model itself, the GlockNina prop, and the `ToneDa` controller |
| `src/character/anims.js` | Every animation clip, written as bone poses |
| `viewer.html` | Model viewer: spin either form and play any clip |

## Clips
idle, walk, run, sprint, jump, fall, land, roll, punchR, punchL, kick, fire, block, hurt, transform, song.

`block`, `walk`, `hurt` and `song` exist and play in the viewer but are not wired to gameplay yet.

## Using it
```js
const toneda = new ToneDa();
scene.add(toneda.root);
toneda.update(dt, { moving, sprint, grounded, vy }); // every frame
toneda.play('punchR');      // one-shot
toneda.transform(true);     // YN -> OG
```

## Changing the look
- Colours: `PAL` at the top of `toneda.js`.
- Body proportions: `SPECS` in `toneda.js`.
- Faces: `drawFaceYN` / `drawFaceOG` in `textures.js`.

## Swapping in a sculpted model later
If a `.glb` model is made in Blender or a 3D generator, it can replace the
code-built mesh as long as its bones use the same names (`hips`, `spine`,
`chest`, `armL`, `foreL`, ...). The clips in `anims.js` target bones by name.

## Third-party code
`vendor/three.module.min.js` is three.js r170 (MIT, see `vendor/THREE-LICENSE.txt`),
stored in the repo so the game does not depend on an outside CDN.
