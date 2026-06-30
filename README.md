# 🐱 Tom the Talking Cat

A tiny, browser-only "Talking Tom"-style web toy. Tap the cat, talk to it, and
it talks back with pre-written kid-safe replies — all running **100% in the
browser**.

- **No backend. No API keys. No paid services. No build step.**
- Listening uses the **Web Speech API** (`SpeechRecognition`).
- Talking uses the browser's built-in **`speechSynthesis`**.
- Replies are simple keyword matches you can edit in one file.
- Deploys as static files to **GitHub Pages** (free HTTPS).

---

## How it works

1. You tap the cat (the whole cat is one big button).
2. The browser listens and transcribes your speech (`SpeechRecognition`).
3. When you stop talking, your words are matched against keyword patterns in
   [`responses.js`](responses.js).
4. Tom speaks back a **pre-written** reply (he never repeats or translates what
   you said) using `speechSynthesis`, and his mouth animates while he talks.

```
index.html     → page structure + the inline SVG cat
styles.css     → looks + idle/listening/talking animations
responses.js   → ⭐ the replies (edit this to change what Tom says)
app.js         → ⭐ the logic + tuning knobs (pitch, rate, timings, assets)
assets/        → optional sound-effect / image slots (works empty)
```

The parts you'll most likely edit are clearly commented:
**responses** (`responses.js`), and the **CONFIG block** at the top of
`app.js` (voice pitch/rate, mouth-flap speed, asset paths).

---

## ⚠️ Browser requirement (important)

Speech **recognition** (the listening part) only works in **Chromium-based
browsers**:

- ✅ **Chrome**, **Edge**, **Opera** (desktop, and Chrome on **Android**) — fully supported.
- ⚠️ **Firefox** — no `SpeechRecognition`; the app shows a friendly
  "use Chrome/Edge" message instead of failing silently.
- ⚠️ **Safari/iOS** — exposes `SpeechRecognition` (since ~14.1) but the
  experience is less reliable than Chrome/Edge; results may vary.

For the most consistent results, use **Chrome or Edge**.

Two more rules the browser enforces (the app already respects them):

- The mic only works over **HTTPS** (or `http://localhost` while developing).
  GitHub Pages gives you HTTPS for free.
- The mic only starts after a **user tap** — which is exactly when Tom listens.

If the mic is blocked or denied, Tom shows a kid-friendly message asking for
permission.

---

## Run it locally

**Easiest:** just double-click `index.html`.
> Caveat: opening with `file://` works for talking, but some browsers restrict
> the **microphone** on `file://`. If listening won't start, use the local
> server below (it serves over `http://localhost`, which the mic allows).

**Local server (recommended for the mic):**

```bash
# Python 3
python -m http.server 8000
# then open http://localhost:8000 in Chrome or Edge
```

```bash
# or with Node
npx serve .
```

---

## Deploy to GitHub Pages (free HTTPS)

1. Create a new GitHub repository and push these files to the **`main`** branch
   (the files must be in the repo **root**, where `index.html` is):
   ```bash
   git init
   git add .
   git commit -m "Tom the Talking Cat"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Set **Branch** to **`main`** and folder to **`/ (root)`**, then **Save**.
5. Wait ~1 minute. GitHub gives you an **HTTPS** URL like
   `https://<you>.github.io/<repo>/`.
6. Open that URL in **Chrome or Edge** and tap the cat. 🎉

> HTTPS is **mandatory** for the microphone — and GitHub Pages provides it
> automatically, so you're covered.

---

## Customizing

| Want to change…              | Edit…                                                   |
|------------------------------|---------------------------------------------------------|
| What Tom says                | `responses.js` (`patterns` + `fallback`)                |
| Voice pitch / speed          | `TOM_PITCH`, `TOM_RATE` at the top of `app.js`          |
| How fast the mouth flaps     | `MOUTH_FLAP_MS` in `app.js`                             |
| Listening language           | `RECOGNITION_LANG` in `app.js`                          |
| Sound effects                | drop files in `assets/sfx/` (see its README)            |
| Cat artwork                  | edit the inline SVG in `index.html`, or set `ASSETS.img.cat` |
| Colors / size                | `:root` variables in `styles.css`                       |

### Adding a new reply
In `responses.js`, add an entry to `patterns` (more specific patterns go
higher — first match wins):

```js
{ match: ["weather", "is it sunny"], replies: ["I love sunny days for napping!"] }
```

---

## Privacy

Everything runs locally in your browser. There are **no analytics**, no network
requests, and no data leaves the device — except that Chromium's speech
recognition may send audio to the browser vendor's speech service to transcribe
it (that's the browser's own behavior, not this app). The app itself stores and
sends nothing.

---

## Notes & limitations

- Voices differ per device/OS; the app prefers an `en-US` voice, then any
  English voice, then the system default.
- `SpeechRecognition` needs an internet connection in some browsers (the engine
  is cloud-based); the app shows a friendly message if the network is the issue.
- No copyrighted/branded characters are used — the cat is a generic SVG you're
  free to replace.
