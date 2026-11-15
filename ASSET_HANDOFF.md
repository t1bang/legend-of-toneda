# Asset handoff for Claude

## Existing demo
The playable source is at [index.html](./index.html). Vercel production: https://legend-of-toneda.vercel.app . This is a rough Three.js prototype, not the approved character quality.

## Files to upload manually
Download the two ZIP packages supplied in the ChatGPT conversation, unzip them locally, then upload the contents into this repository's `assets/` folder using GitHub's **Add file → Upload files**. GitHub accepts the ~47 MB WAV as an individual file, but warns about files over 50 MB. Alternatively store large music masters privately and upload compressed game-ready audio.

**Main asset package**
- `Hyarule.mp3` — vocal song
- `Ayyy Listen.m4a`, `Get attention.m4a`, `Combat and danger.m4a`, `Funny reaction.m4a`, `Music and transformation.m4a` — Niggy dialogue cues
- `ToneDa Combat yells(1).m4a`, `Funny Reactions(1).m4a`, `Signature Lines(1).m4a`, `Taking damage(1).m4a`, `Transformation(1).m4a`, `Victory(1).m4a`, `ToneDa Explora(1).m4a` — ToneDa voice pack
- `a_highly_detailed_n64_64_bit_polygon_3d_model_shee.png` — approved N64-style character sheet (visual reference, **not** a rigged 3D asset)
- `3879dc53-ff9b-46f4-8b9d-0e86d4c8f871(1).png` — cover reference

**Instrumental package**
- `hyrule_instrumental.wav` — uncompressed music master

## Asset handling
Do not assume the files are in GitHub until they are uploaded. Keep source masters and original recordings backed up. The repo is currently public, so uploading these files would make them publicly downloadable. Prefer making the repository private before uploading original music and voice recordings, and use compressed runtime audio for the web build.

## Claude task
Inspect the actual repository, verify assets are present, then improve the N64-inspired 3D character and animation quality. Use the reference sheet as art direction; do not pretend it is a usable sprite atlas or 3D rig. Integrate recorded audio only after checking actual filenames and playback.
