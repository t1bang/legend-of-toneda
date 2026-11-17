# Music and voices

Sound effects are made in code (`src/audio.js`) and need no files.
Music and voice lines are recordings that go in this folder and are named in `tracks.json`.

```json
{
  "music": "hyarule.mp3",
  "musicVolume": 0.5,
  "voices": { "niggy.listen": "niggy-listen.m4a" }
}
```

- `music` loops from the moment START GAME is pressed. `null` means no music yet.
- `voices` maps a cue to a file. A cue with no file falls back to its made-in-code sound.
  Cues the game asks for today: `niggy.listen` (the "Ayy, listen!" that opens the game).

This repository is public, so any recording placed here can be downloaded by anyone.
