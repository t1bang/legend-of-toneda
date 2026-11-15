# Rigged model drop folder

Upload:
- `yn-toneda.glb` — YN hero, rigged and with embedded animations
- `og-toneda.glb` — OG hero, rigged and with embedded animations
- `niggy.glb` — optional orb model; can use simple bob/wing animations

**Do not replace the procedural prototype until the actual GLBs are present and verified.**

Suggested clips: Idle, Walk, Run, Jump, Land, Roll, Punch, Kick, Aim, Fire, Block, Hit, Transform.

Coordinate contract: Y-up, meters, forward = -Z, feet at y=0, neutral A-pose, consistent origin and scale. Verify exporter conventions and adjust loader if needed.

Use animation clip name aliases or inspect the actual `gltf.animations` names; never assume Mixamo names match exactly.
