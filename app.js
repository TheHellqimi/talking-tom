/* =============================================================================
 *  app.js  —  Tom the Talking Cat
 * =============================================================================
 *  Browser-only. No backend, no API keys, no network calls.
 *    - Listening  : Web Speech API  (SpeechRecognition / webkitSpeechRecognition)
 *    - Speaking   : Web Speech API  (speechSynthesis)
 *    - Replies    : matched in responses.js (window.RESPONSES)
 *
 *  Tune the constants in the CONFIG block below.
 * ===========================================================================*/

(function () {
  "use strict";

  /* ===========================================================================
   *  CONFIG  —  the knobs you'll most likely want to change
   * =========================================================================*/

  // Voice character. Higher pitch = more cartoon/chipmunk cat.
  const TOM_PITCH  = 1.4;   // 0 (low) … 2 (high)
  const TOM_RATE   = 1.0;   // 0.1 (slow) … 10 (fast); ~1 is natural
  const TOM_VOLUME = 1.0;   // 0 … 1

  // Language used for BOTH recognition and the preferred speaking voice.
  const RECOGNITION_LANG = "en-US";
  const PREFERRED_VOICE_LANG = "en"; // first voice whose lang starts with this wins

  // Mouth animation: how often the mouth flaps open/closed while talking (ms).
  const MOUTH_FLAP_MS = 140;

  // When muted, Tom still "mouths" the words. This estimates how long for.
  const MUTED_MS_PER_CHAR = 55;
  const MUTED_MIN_MS = 900;
  const MUTED_MAX_MS = 4500;

  // Sound-effect + image asset paths (all OPTIONAL — missing files fail silently).
  // Drop real files in assets/ and they'll start playing. See assets/sfx/README.md.
  const ASSETS = {
    sfx: {
      start: "assets/sfx/start.mp3", // played when listening begins
      stop:  "assets/sfx/stop.mp3",  // played when listening ends
      idle:  "assets/sfx/purr.mp3"   // reserved: an idle purr loop (not auto-played)
    },
    img: {
      // Leave null to use the built-in SVG cat. Set to a path to override art later.
      cat: null
    }
  };

  /* ===========================================================================
   *  STATE  —  internal; you usually don't need to touch below here
   * =========================================================================*/

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const synth = window.speechSynthesis || null;

  let recognition = null;
  let voices = [];
  let chosenVoice = null;

  let state = "idle";        // idle | listening | talking | error | unsupported
  let isMuted = false;
  let recognizing = false;   // is a SpeechRecognition session currently live?
  let hadResult = false;     // did recognition return a transcript this round?
  let errorHandled = false;  // did onerror already set a message this round?
  let pendingReply = null;   // reply to speak once recognition fully ends (no echo)
  let mouthTimer = null;     // interval id for the mouth flap
  let mutedStopTimer = null;  // timeout id for ending a muted "mouth" run
  // Monotonic token: every new utterance bumps it. Async speech callbacks check
  // they still own the latest token before touching state — so a cancelled
  // utterance's late onstart/onend can't clobber a newer one. (Fixes the
  // "stale onend flips state back to idle" race.)
  let speakToken = 0;
  const sfxCache = {};       // name -> HTMLAudioElement (or false if unavailable)

  // DOM
  const els = {};

  /* ===========================================================================
   *  INIT
   * =========================================================================*/

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    els.body        = document.body;
    els.cat         = document.getElementById("cat");
    els.status      = document.getElementById("status");
    els.bubble      = document.getElementById("bubble");
    els.srLive      = document.getElementById("sr-live");
    els.mute        = document.getElementById("mute");
    els.unsupported = document.getElementById("unsupported");

    // Optional: swap the built-in SVG cat for a custom image asset.
    applyCatImageOverride();

    // The whole cat is the tap target. <button> already handles Enter/Space.
    els.cat.addEventListener("click", onCatActivate);
    els.mute.addEventListener("click", toggleMute);

    // Pre-load speech-synthesis voices (they arrive asynchronously).
    if (synth) {
      loadVoices();
      // Fired (sometimes more than once) once the voice list is ready.
      if (typeof synth.onvoiceschanged !== "undefined") {
        synth.onvoiceschanged = loadVoices;
      }
    }

    if (!SR) {
      // No speech recognition (e.g. Firefox, older Safari). Listening won't work.
      enterUnsupported();
      return;
    }

    setupRecognition();
    setState("idle");
    setStatus("Tap me to talk! 🐾");
  }

  function applyCatImageOverride() {
    if (!ASSETS.img.cat) return;
    const svg = els.cat.querySelector(".cat-svg");
    if (!svg) return;
    const img = new Image();
    img.src = ASSETS.img.cat;
    img.alt = "";
    img.className = "cat-svg";
    img.setAttribute("aria-hidden", "true");
    svg.replaceWith(img);
    // NOTE: with a custom image, the #cat-mouth / #cat-ear animations won't
    // apply. Provide your own animated art if you go this route.
  }

  /* ===========================================================================
   *  SPEECH RECOGNITION (listening)
   * =========================================================================*/

  function setupRecognition() {
    recognition = new SR();
    recognition.lang = RECOGNITION_LANG;
    recognition.continuous = false;     // stop automatically after one phrase
    recognition.interimResults = false; // we only want the final transcript
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
      recognizing = true;
      hadResult = false;
      errorHandled = false;
      pendingReply = null;
    };

    recognition.onresult = function (event) {
      const transcript = (event.results[0][0].transcript || "").trim();
      hadResult = true;
      // Decide the reply now, but DON'T speak yet — wait for onend so the mic
      // session is fully closed before synthesis starts (prevents Tom hearing
      // himself / echo on platforms that release the mic late).
      pendingReply = transcript ? matchResponse(transcript) : null;
    };

    recognition.onerror = function (event) {
      errorHandled = true;
      handleRecognitionError(event.error);
    };

    recognition.onend = function () {
      recognizing = false;
      playSfx("stop");

      if (pendingReply) {
        const reply = pendingReply;
        pendingReply = null;
        speak(reply);
        return;
      }
      // No reply this round.
      if (!errorHandled && state === "listening") {
        setState("idle");
        setStatus(hadResult
          ? "Hmm, I heard you but didn't catch the words — tap to try again! 🐾"
          : "I didn't catch that — tap to try again! 🐾");
      }
    };
  }

  function startListening() {
    if (!recognition || recognizing) return;
    // Invalidate any in-flight speech so its async callbacks can't fire after
    // we switch to listening, then silence Tom so he isn't talking into the mic.
    speakToken++;
    if (synth) synth.cancel();
    stopMouthFlap();
    hideBubble();

    try {
      setState("listening");
      setStatus("Listening… I'm all ears! 👂");
      playSfx("start");
      recognition.start();
    } catch (err) {
      // start() throws InvalidStateError if a session is already running.
      // If so, we ARE still listening — don't lie and say idle.
      if (recognizing) {
        setState("listening");
      } else {
        setState("idle");
        setStatus("Tap me to talk! 🐾");
      }
    }
  }

  function stopListening() {
    if (!recognition) return;
    try { recognition.abort(); } catch (e) { /* ignore */ }
    recognizing = false;
    setState("idle");
    setStatus("Tap me to talk! 🐾");
  }

  function handleRecognitionError(error) {
    setState("error");
    switch (error) {
      case "not-allowed":
      case "service-not-allowed":
        setStatus("I need permission to use the microphone. 🎤 Please allow it and tap me again!");
        break;
      case "no-speech":
        setState("idle");
        setStatus("I didn't hear anything! Tap me and speak up. 🐾");
        break;
      case "audio-capture":
        setStatus("I can't find a microphone. 🎤 Please plug one in!");
        break;
      case "network":
        setStatus("Hmm, the speech service needs the internet right now. 📶");
        break;
      case "aborted":
        // User tapped to cancel — stay quiet.
        setState("idle");
        setStatus("Tap me to talk! 🐾");
        break;
      default:
        setState("idle");
        setStatus("Oops, something went wrong. Tap me to try again! 🐾");
    }
    // Briefly show the shake, then relax to idle so the cat stays tappable.
    if (state === "error") {
      window.setTimeout(function () {
        if (state === "error") setState("idle");
      }, 600);
    }
  }

  /* ===========================================================================
   *  RESPONSE MATCHING
   * =========================================================================*/

  // Returns a single reply string for the given transcript.
  function matchResponse(text) {
    const cfg = window.RESPONSES || { patterns: [], fallback: ["Meow!"] };
    const hay = " " + text.toLowerCase().trim() + " ";

    for (let i = 0; i < cfg.patterns.length; i++) {
      const pattern = cfg.patterns[i];
      const keywords = pattern.match || [];
      for (let k = 0; k < keywords.length; k++) {
        if (keywordMatches(hay, keywords[k])) {
          return pickRandom(pattern.replies);
        }
      }
    }
    return pickRandom(cfg.fallback);
  }

  // Whole-word (boundary) matching: the keyword must appear bordered by a
  // non-letter/digit on each side. So "hi" matches "hi there" but not "this",
  // and "no" matches "no thanks" but not "know". Multi-word phrases match too.
  function keywordMatches(haystack, keyword) {
    const key = String(keyword).toLowerCase().trim();
    if (!key) return false;
    // Escape every regex metacharacter so keywords are always treated literally.
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      // ' is allowed inside a word (so "what's" stays one word); a word edge is
      // anything that isn't a letter, digit, or apostrophe.
      const re = new RegExp("(^|[^a-z0-9'])" + esc + "([^a-z0-9']|$)", "i");
      return re.test(haystack);
    } catch (e) {
      // Defensive fallback (should never hit, since we escape above).
      return haystack.indexOf(key) !== -1;
    }
  }

  function pickRandom(list) {
    if (!list || !list.length) return "Meow!";
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ===========================================================================
   *  SPEECH SYNTHESIS (talking) + mouth animation
   * =========================================================================*/

  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices() || [];
    if (voices.length) chosenVoice = pickVoice(voices);
  }

  function pickVoice(list) {
    if (!list || !list.length) return null;
    const lang = PREFERRED_VOICE_LANG.toLowerCase();
    // Prefer an exact RECOGNITION_LANG match, then any matching language,
    // then a voice flagged default, then the first voice.
    return (
      list.find(function (v) { return v.lang && v.lang.toLowerCase() === RECOGNITION_LANG.toLowerCase(); }) ||
      list.find(function (v) { return v.lang && v.lang.toLowerCase().indexOf(lang) === 0; }) ||
      list.find(function (v) { return v.default; }) ||
      list[0]
    );
  }

  function speak(text) {
    showBubble(text);   // visual speech bubble
    announce(text);     // screen-reader live region (carries the actual reply)

    const token = ++speakToken;

    if (isMuted || !synth) {
      mouthWithoutSound(text, token);
      return;
    }

    try {
      synth.cancel(); // clear anything queued/stuck (its stale callbacks are token-guarded)

      const utter = new SpeechSynthesisUtterance(text);
      if (!chosenVoice) chosenVoice = pickVoice(synth.getVoices() || []);
      if (chosenVoice) utter.voice = chosenVoice;
      utter.lang   = (chosenVoice && chosenVoice.lang) || RECOGNITION_LANG;
      utter.pitch  = TOM_PITCH;
      utter.rate   = TOM_RATE;
      utter.volume = TOM_VOLUME;

      utter.onstart = function () {
        if (token !== speakToken) return; // superseded — ignore
        setState("talking");
        setStatus("");
        startMouthFlap();
      };
      utter.onend = function () {
        if (token !== speakToken) return;
        stopMouthFlap();
        backToIdle();
      };
      utter.onerror = function () {
        if (token !== speakToken) return;
        stopMouthFlap();
        backToIdle();
      };

      synth.speak(utter);
    } catch (e) {
      mouthWithoutSound(text, token);
    }
  }

  // Muted (or no synth): flap the mouth for an estimated duration, no audio.
  function mouthWithoutSound(text, token) {
    setState("talking");
    setStatus("");
    startMouthFlap();
    const ms = Math.min(
      MUTED_MAX_MS,
      Math.max(MUTED_MIN_MS, (text ? text.length : 20) * MUTED_MS_PER_CHAR)
    );
    clearTimeout(mutedStopTimer);
    mutedStopTimer = window.setTimeout(function () {
      if (token !== speakToken) return; // superseded — ignore
      stopMouthFlap();
      backToIdle();
    }, ms);
  }

  function backToIdle() {
    setState("idle");
    setStatus("Tap me to talk again! 🐾");
  }

  // Toggle the .mouth-open class ~7x/second for a talking effect.
  function startMouthFlap() {
    stopMouthFlap();
    const mouth = document.getElementById("cat-mouth");
    if (!mouth) return;
    let open = false;
    mouthTimer = window.setInterval(function () {
      open = !open;
      mouth.classList.toggle("mouth-open", open);
    }, MOUTH_FLAP_MS);
  }

  function stopMouthFlap() {
    if (mouthTimer) { clearInterval(mouthTimer); mouthTimer = null; }
    if (mutedStopTimer) { clearTimeout(mutedStopTimer); mutedStopTimer = null; }
    const mouth = document.getElementById("cat-mouth");
    if (mouth) mouth.classList.remove("mouth-open");
  }

  /* ===========================================================================
   *  SOUND EFFECTS (optional placeholder hooks)
   * =========================================================================*/

  // playSfx("start" | "stop" | "idle"). Silently does nothing if the file is
  // missing or the user is muted. Drop real audio in assets/sfx/ to enable.
  function playSfx(name) {
    if (isMuted) return;
    const src = ASSETS.sfx[name];
    if (!src) return;

    // Cache an Audio element per name; remember failures so we don't retry.
    if (sfxCache[name] === false) return;
    if (!sfxCache[name]) {
      const audio = new Audio();
      audio.src = src;
      audio.preload = "auto";
      audio.addEventListener("error", function () { sfxCache[name] = false; });
      sfxCache[name] = audio;
    }
    try {
      const a = sfxCache[name];
      if (a && a !== false) {
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) p.catch(function () { /* autoplay/file issues: ignore */ });
      }
    } catch (e) { /* ignore */ }
  }

  /* ===========================================================================
   *  UI STATE HELPERS
   * =========================================================================*/

  function onCatActivate() {
    switch (state) {
      case "unsupported":
        // Listening isn't available — still give friendly spoken feedback.
        speakUnsupportedHint();
        break;
      case "listening":
        stopListening();      // tap again to cancel listening
        break;
      case "talking":
        speakToken++;         // invalidate the in-flight utterance's callbacks
        if (synth) synth.cancel();
        stopMouthFlap();
        backToIdle();
        break;
      default: // idle / error
        startListening();
    }
  }

  function speakUnsupportedHint() {
    const line = "Hi! I'm Tom. To talk with me, please open this in Chrome or Edge!";
    showBubble(line);
    announce(line);
    if (synth && !isMuted) {
      try {
        const token = ++speakToken;
        synth.cancel();
        const u = new SpeechSynthesisUtterance(line);
        if (!chosenVoice) chosenVoice = pickVoice(synth.getVoices() || []);
        if (chosenVoice) u.voice = chosenVoice;
        u.lang   = (chosenVoice && chosenVoice.lang) || RECOGNITION_LANG;
        u.pitch  = TOM_PITCH;
        u.rate   = TOM_RATE;
        u.volume = TOM_VOLUME;
        u.onstart = function () { if (token === speakToken) startMouthFlap(); };
        u.onend   = function () { if (token === speakToken) stopMouthFlap(); };
        u.onerror = function () { if (token === speakToken) stopMouthFlap(); };
        synth.speak(u);
      } catch (e) { /* ignore */ }
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    els.mute.setAttribute("aria-pressed", String(isMuted));
    els.mute.textContent = isMuted ? "🔇 Sound off" : "🔊 Sound on";
    if (isMuted && synth) {
      speakToken++;            // invalidate in-flight utterance callbacks
      synth.cancel();
      // Don't rely on a possibly-missing cancel->onend: clean up ourselves.
      if (state === "talking") {
        stopMouthFlap();
        backToIdle();
      }
    }
  }

  function enterUnsupported() {
    setState("unsupported");
    setStatus("Tap me to say hi! 👋");
    if (els.unsupported) els.unsupported.hidden = false;
  }

  function setState(next) {
    state = next;
    els.body.className = "state-" + next;
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

  // Visual speech bubble (decorative; aria-hidden in the HTML).
  function showBubble(text) {
    if (!els.bubble) return;
    els.bubble.textContent = text;
    els.bubble.hidden = false;
  }

  function hideBubble() {
    if (!els.bubble) return;
    els.bubble.hidden = true;
    els.bubble.textContent = "";
  }

  // Announce Tom's reply through a permanent screen-reader live region so it is
  // reliably read aloud (the visual bubble alone isn't a dependable live region).
  function announce(text) {
    if (!els.srLive) return;
    els.srLive.textContent = "";       // force re-announcement of repeated text
    els.srLive.textContent = "Tom says: " + text;
  }

})();
