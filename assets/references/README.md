# Approved character reference upload checklist

## Status
The image references were generated in ChatGPT but have **not** been uploaded to this GitHub repository. GitHub's available text-file connector cannot directly transfer image binaries from the ChatGPT workspace.

## Upload destination
Upload the approved image files using GitHub **Add file → Upload files** into:
`assets/references/`

Suggested names:
- `yn-toneda-front.png`
- `yn-toneda-turnaround.png`
- `og-toneda-front.png`
- `og-toneda-turnaround.png`
- `niggy-turnaround.png`
- `yn-toneda-shield-revision.png` (latest revision: round red shield, **black** rim, gold T1; attached to arm)

## Instructions for Claude
Read this document and inspect the actual images in `assets/references/` once uploaded. The most recent shield revision supersedes the silver-edged shield in older references. Keep YN clean-shaven with short dreads, OG with long dreads and facial hair. Niggy is a glowing red ball with angry scribbled eyes, sharp teeth and two small black wings, no humanoid body.

Use reference renders to produce rigged 3D assets; don't treat them as 2D sprites or completed GLB files. Rig characters and retarget reusable clips; only make custom animations for signature actions. Do not replace the live code-built models until `assets/models/yn-toneda.glb` and `og-toneda.glb` exist and load successfully.
