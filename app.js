/* =============================================================================
 *  app.js  —  Mariam the Talking Princess
 * =============================================================================
 *  Browser-only. No backend, no API keys, no network calls.
 *    - Listening  : Web Speech API  (SpeechRecognition / webkitSpeechRecognition)
 *    - Speaking   : Web Speech API  (speechSynthesis)
 *    - Replies    : matched in responses.js (window.RESPONSES)
 *    - Character  : a transparent (alpha) video, swapped per state via CLIPS
 *
 *  Tune the constants in the CONFIG block below.
 * ===========================================================================*/

(function () {
  "use strict";

  /* ===========================================================================
   *  CONFIG  —  the knobs you'll most likely want to change
   * =========================================================================*/

  // Voice character. ~1.0 pitch = natural; nudge up slightly for a sweeter tone.
  const VOICE_PITCH  = 1.12;  // 0 (low) … 2 (high)
  const VOICE_RATE   = 1.0;   // 0.1 (slow) … 10 (fast); ~1 is natural
  const VOICE_VOLUME = 1.0;   // 0 … 1
  const PREFER_FEMALE_VOICE = true; // pick a female browser voice when available

  // Language used for BOTH recognition and the preferred speaking voice.
  const RECOGNITION_LANG = "en-US";
  const PREFERRED_VOICE_LANG = "en";

  // When muted, Mariam still "talks" (animated) for an estimated duration.
  const MUTED_MS_PER_CHAR = 55;
  const MUTED_MIN_MS = 1000;
  const MUTED_MAX_MS = 5000;

  // The character uses two stacked <video> layers in index.html:
  //   #char-video          — idle loop, always playing (base layer)
  //   #char-video-talking  — talking loop, faded in only while she speaks
  // To add more states (e.g. listening), add another stacked <video> + a
  // .state-<name> rule in styles.css, and drive it from updateCharacterVideo().

  // Optional sound-effect paths (all OPTIONAL — missing files fail silently).
  const ASSETS = {
    sfx: {
      start: "assets/sfx/start.mp3",
      stop:  "assets/sfx/stop.mp3"
    }
  };

  // Female-voice name hints (varies wildly by OS/browser).
  const FEMALE_HINTS = /(female|woman|girl|zira|hazel|susan|linda|heera|catherine|samantha|victoria|karen|tessa|fiona|moira|serena|allison|ava|amelie|amélie|google uk english female|google us english)/i;

  /* ===========================================================================
   *  STATE  —  internal
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
  let mutedStopTimer = null; // timeout id for ending a muted "talking" run
  // Monotonic token: every new utterance bumps it. Async speech callbacks check
  // they still own the latest token before touching state, so a cancelled
  // utterance's late onstart/onend can't clobber a newer one.
  let speakToken = 0;
  const sfxCache = {};

  const els = {};

  /* ===========================================================================
   *  INIT
   * =========================================================================*/

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    els.body        = document.body;
    els.tap         = document.getElementById("tap");
    els.video       = document.getElementById("char-video");
    els.videoTalking = document.getElementById("char-video-talking");
    els.status      = document.getElementById("status");
    els.bubble      = document.getElementById("bubble");
    els.srLive      = document.getElementById("sr-live");
    els.mute        = document.getElementById("mute");
    els.unsupported = document.getElementById("unsupported");

    // Some browsers pause muted autoplay until interaction; nudge the idle clip.
    if (els.video && els.video.play) {
      const p = els.video.play();
      if (p && p.catch) p.catch(function () { /* will play on first tap */ });
    }

    els.tap.addEventListener("click", onActivate);
    els.mute.addEventListener("click", toggleMute);

    if (synth) {
      loadVoices();
      if (typeof synth.onvoiceschanged !== "undefined") {
        synth.onvoiceschanged = loadVoices;
      }
    }

    if (!SR) {
      enterUnsupported();
      return;
    }

    setupRecognition();
    setState("idle");
    setStatus("Tap me to talk! 👑");
  }

  /* ===========================================================================
   *  CHARACTER VIDEO  (idle base layer + talking layer faded in while speaking)
   * =========================================================================*/

  // The talking clip is a separate stacked <video>. CSS fades it in whenever the
  // body has .state-talking; here we start/stop its playback to match.
  function updateCharacterVideo(forState) {
    if (!els.videoTalking) return;
    if (forState === "talking") {
      try { els.videoTalking.currentTime = 0; } catch (e) { /* not seekable yet */ }
      const p = els.videoTalking.play();
      if (p && p.catch) p.catch(function () { /* ignore */ });
    } else {
      try { els.videoTalking.pause(); } catch (e) { /* ignore */ }
    }
  }

  /* ===========================================================================
   *  SPEECH RECOGNITION (listening)
   * =========================================================================*/

  function setupRecognition() {
    recognition = new SR();
    recognition.lang = RECOGNITION_LANG;
    recognition.continuous = false;
    recognition.interimResults = false;
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
      // Decide the reply now, but speak it in onend (after the mic closes) so
      // Mariam never talks into a still-open microphone.
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
      if (!errorHandled && state === "listening") {
        setState("idle");
        setStatus(hadResult
          ? "Hehe, I heard you but didn't catch the words — tap to try again! 👑"
          : "I didn't catch that — tap to try again, cutie! 👑");
      }
    };
  }

  function startListening() {
    if (!recognition || recognizing) return;
    speakToken++;            // invalidate any in-flight speech callbacks
    if (synth) synth.cancel();
    clearMutedTimer();
    hideBubble();

    try {
      setState("listening");
      setStatus("Listening… I'm all ears, cutie! 👂");
      playSfx("start");
      recognition.start();
    } catch (err) {
      if (recognizing) {
        setState("listening");
      } else {
        setState("idle");
        setStatus("Tap me to talk! 👑");
      }
    }
  }

  function stopListening() {
    if (!recognition) return;
    try { recognition.abort(); } catch (e) { /* ignore */ }
    recognizing = false;
    setState("idle");
    setStatus("Tap me to talk! 👑");
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
        setStatus("I didn't hear anything! Tap me and speak up, sweetie. 👑");
        break;
      case "audio-capture":
        setStatus("I can't find a microphone. 🎤 Please plug one in!");
        break;
      case "network":
        setStatus("Hmm, the speech service needs the internet right now. 📶");
        break;
      case "aborted":
        setState("idle");
        setStatus("Tap me to talk! 👑");
        break;
      default:
        setState("idle");
        setStatus("Oops, something went wrong. Tap me to try again! 👑");
    }
    if (state === "error") {
      window.setTimeout(function () {
        if (state === "error") setState("idle");
      }, 600);
    }
  }

  /* ===========================================================================
   *  RESPONSE MATCHING  (whole-word, case-insensitive)
   * =========================================================================*/

  function matchResponse(text) {
    const cfg = window.RESPONSES || { patterns: [], fallback: ["Hehe!"] };
    const hay = " " + text.toLowerCase().trim() + " ";

    for (let i = 0; i < cfg.patterns.length; i++) {
      const keywords = cfg.patterns[i].match || [];
      for (let k = 0; k < keywords.length; k++) {
        if (keywordMatches(hay, keywords[k])) {
          return pickRandom(cfg.patterns[i].replies);
        }
      }
    }
    return pickRandom(cfg.fallback);
  }

  function keywordMatches(haystack, keyword) {
    const key = String(keyword).toLowerCase().trim();
    if (!key) return false;
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      const re = new RegExp("(^|[^a-z0-9'])" + esc + "([^a-z0-9']|$)", "i");
      return re.test(haystack);
    } catch (e) {
      return haystack.indexOf(key) !== -1;
    }
  }

  function pickRandom(list) {
    if (!list || !list.length) return "Hehe!";
    return list[Math.floor(Math.random() * list.length)];
  }

  /* ===========================================================================
   *  SPEECH SYNTHESIS (talking)
   * =========================================================================*/

  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices() || [];
    if (voices.length) chosenVoice = pickVoice(voices);
  }

  function pickVoice(list) {
    if (!list || !list.length) return null;
    const en = list.filter(function (v) {
      return v.lang && v.lang.toLowerCase().indexOf(PREFERRED_VOICE_LANG.toLowerCase()) === 0;
    });
    const pool = en.length ? en : list;
    if (PREFER_FEMALE_VOICE) {
      const f = pool.find(function (v) { return FEMALE_HINTS.test(v.name || ""); });
      if (f) return f;
    }
    return (
      pool.find(function (v) { return v.lang && v.lang.toLowerCase() === RECOGNITION_LANG.toLowerCase(); }) ||
      pool.find(function (v) { return v.default; }) ||
      pool[0]
    );
  }

  function speak(text) {
    showBubble(text);   // visual reply bubble
    announce(text);     // screen-reader live region

    const token = ++speakToken;

    if (isMuted || !synth) {
      speakMuted(text, token);
      return;
    }

    try {
      synth.cancel(); // its stale callbacks are token-guarded

      const utter = new SpeechSynthesisUtterance(text);
      if (!chosenVoice) chosenVoice = pickVoice(synth.getVoices() || []);
      if (chosenVoice) utter.voice = chosenVoice;
      utter.lang   = (chosenVoice && chosenVoice.lang) || RECOGNITION_LANG;
      utter.pitch  = VOICE_PITCH;
      utter.rate   = VOICE_RATE;
      utter.volume = VOICE_VOLUME;

      utter.onstart = function () {
        if (token !== speakToken) return;
        setState("talking");
        setStatus("");
      };
      utter.onend = function () {
        if (token !== speakToken) return;
        backToIdle();
      };
      utter.onerror = function () {
        if (token !== speakToken) return;
        backToIdle();
      };

      synth.speak(utter);
    } catch (e) {
      speakMuted(text, token);
    }
  }

  // Muted (or no synth): hold the "talking" cue for an estimated duration.
  function speakMuted(text, token) {
    setState("talking");
    setStatus("");
    const ms = Math.min(
      MUTED_MAX_MS,
      Math.max(MUTED_MIN_MS, (text ? text.length : 20) * MUTED_MS_PER_CHAR)
    );
    clearMutedTimer();
    mutedStopTimer = window.setTimeout(function () {
      if (token !== speakToken) return;
      backToIdle();
    }, ms);
  }

  function backToIdle() {
    clearMutedTimer();
    setState("idle");
    setStatus("Tap me to talk again! 👑");
  }

  function clearMutedTimer() {
    if (mutedStopTimer) { clearTimeout(mutedStopTimer); mutedStopTimer = null; }
  }

  /* ===========================================================================
   *  SOUND EFFECTS (optional placeholder hooks)
   * =========================================================================*/

  function playSfx(name) {
    if (isMuted) return;
    const src = ASSETS.sfx[name];
    if (!src) return;
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
        if (p && p.catch) p.catch(function () { /* ignore */ });
      }
    } catch (e) { /* ignore */ }
  }

  /* ===========================================================================
   *  UI STATE HELPERS
   * =========================================================================*/

  function onActivate() {
    switch (state) {
      case "unsupported":
        speakUnsupportedHint();
        break;
      case "listening":
        stopListening();
        break;
      case "talking":
        speakToken++;
        if (synth) synth.cancel();
        backToIdle();
        break;
      default: // idle / error
        startListening();
    }
  }

  function speakUnsupportedHint() {
    const line = "Hi! I'm Princess Mariam. To chat with me, please open this in Chrome or Edge, cutie!";
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
        u.pitch  = VOICE_PITCH;
        u.rate   = VOICE_RATE;
        u.volume = VOICE_VOLUME;
        synth.speak(u);
      } catch (e) { /* ignore */ }
    }
  }

  function toggleMute() {
    isMuted = !isMuted;
    els.mute.setAttribute("aria-pressed", String(isMuted));
    els.mute.textContent = isMuted ? "🔇 Sound off" : "🔊 Sound on";
    if (isMuted && synth) {
      speakToken++;
      synth.cancel();
      if (state === "talking") backToIdle();
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
    updateCharacterVideo(next);
  }

  function setStatus(text) {
    if (els.status) els.status.textContent = text;
  }

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

  function announce(text) {
    if (!els.srLive) return;
    els.srLive.textContent = "";
    els.srLive.textContent = "Mariam says: " + text;
  }

})();
