# Rigged model drop folder

Upload:
- `yn-toneda.glb` — YN hero, rigged and with embedded animations
- `og-toneda.glb` — OG hero, rigged and with embedded animations
- `niggy.glb` — optional orb model; can use simple bob/wing animations

**Do not replace the procedural prototype until the actual GLBs are present and verified.**

Suggested clips: Idle, Walk, Run, Jump, Land, Roll, Punch, Kick, Aim, Fire, Block, Hit, Transform.

Coordinate contract: Y-up, meters, forward = -Z, feet at y=0, neutral A-pose, consistent origin and scale. Verify exporter conventions and adjust loader if needed.

Use animation clip name aliases or inspect the actual `gltf.animations` names; never assume Mixamo names match exactly.

## Present now
- `yn-toneda.glb`, `og-toneda.glb`: built from the approved turnarounds by `tools/artmodel/`. Exact from the front and back, approximate from the sides. They use the game's own bone names and carry no animation clips; the game supplies the clips.
- `t1-circular-shield.glb`: round T1 shield (black rim, gold studs, red centre, raised gold T1).

A sculpted model from a 3D tool can replace either character file later, as long as it is rigged with the same bone names.

