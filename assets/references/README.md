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

## Corrections from the creator (override the images)
- **OG ToneDa has no tattoos.** Fixed in the current OG images.
- **The round shield carries the gold T1 logo** in its red center, with a black rim. Fixed in `yn-toneda-shield-revision.png`.

## Which image is the authority
- **YN body, face, outfit:** `yn-toneda-turnaround.png` (split views in `views/`).
- **OG body, face, outfit:** `og-toneda-turnaround.png` (split views in `views/`).
- **Shield only:** `yn-toneda-shield-revision.png`. Do not copy that image's face, hair, cape, or satchel; they differ from the YN turnaround.
- `og-toneda-front.png` is drawn in a realistic style with no elf ears, so it does not match the turnaround. Do not build the model from it.
- Use the plain brown satchel from the turnarounds, not the patterned ones.
