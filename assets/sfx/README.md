# Sound effects (optional)

These are **placeholder slots**. The app works fine with this folder empty —
`playSfx()` in `app.js` fails silently if a file is missing.

Drop audio files here with these exact names to enable sounds:

| File         | Plays when…                | Suggested sound        |
|--------------|----------------------------|------------------------|
| `start.mp3`  | listening begins (you tap) | a soft "blip" / chime  |
| `stop.mp3`   | listening ends             | a short "boop"         |
| `purr.mp3`   | reserved for an idle purr  | a looping cat purr     |

You can change these filenames/paths in the `ASSETS` block near the top of
`app.js`. Use short, royalty-free clips (`.mp3`, `.ogg`, or `.wav`).

> Note: `purr.mp3` is reserved and not auto-played yet — wire it up in
> `app.js` if you want an idle purr loop.
