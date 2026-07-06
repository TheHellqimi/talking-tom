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

  // Estimated reply length (ms), used to PLAN the talking animation so it fits
  // the voice: play a whole number of loop repetitions and nudge the loop speed
  // so the whole talk (intro + loops + outro) lasts about this long, and the loop
  // is never cut mid-way. This is a rough estimate from the text for now (TTS
  // gives no duration up front); it becomes exact when you attach per-reply audio.
  const VOICE_MS_PER_CHAR = 60;
  const VOICE_MIN_MS = 1200;
  const VOICE_MAX_MS = 9000;
  // The talk loop's playback speed is nudged within these bounds to fit.
  const LOOP_MIN_RATE = 0.6;
  const LOOP_MAX_RATE = 1.8;

  // The character uses stacked <video> layers in index.html:
  //   #char-video  — idle loop, always playing (base layer)
  //   #v-intro     — idle -> talking transition (plays once)
  //   #v-loop      — seamless talking loop (repeats while she speaks)
  //   #v-outro     — talking -> idle transition (plays once)
  // The talk sequence (intro -> loop×N -> outro -> idle) is planned from the
  // reply length in startTalkAnim() below (N whole loops + a small speed tweak).

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
  // Monotonic token: every new utterance bumps it. Async speech callbacks check
  // they still own the latest token before touching state, so a cancelled
  // utterance's late onstart/onend can't clobber a newer one.
  let speakToken = 0;
  // Talk-animation phase machine (idle -> intro -> loop -> outro -> idle).
  let talkPhase = "idle";     // idle | intro | loop | outro
  let talkGen = 0;            // bumped per sequence to invalidate stale clip callbacks
  let talkReps = 1;           // planned whole loop repetitions for this reply
  let talkRate = 1;           // planned loop playback speed (to fit the reply length)
  let loopKeepAlive = null;   // interval id that keeps the talk loop repeating
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
    els.vIntro      = document.getElementById("v-intro");
    els.vLoop       = document.getElementById("v-loop");
    els.vOutro      = document.getElementById("v-outro");
    els.status      = document.getElementById("status");
    els.bubble      = document.getElementById("bubble");
    els.srLive      = document.getElementById("sr-live");
    els.mute        = document.getElementById("mute");
    els.textForm    = document.getElementById("text-form");
    els.textInput   = document.getElementById("text-input");
    els.unsupported = document.getElementById("unsupported");

    // Some browsers pause muted autoplay until interaction; nudge the idle clip.
    if (els.video && els.video.play) {
      const p = els.video.play();
      if (p && p.catch) p.catch(function () { /* will play on first tap */ });
    }

    els.tap.addEventListener("click", onActivate);
    els.mute.addEventListener("click", toggleMute);
    // Texting works in every browser (no mic needed) — wire it before the
    // SpeechRecognition support check below.
    if (els.textForm) els.textForm.addEventListener("submit", onTextSubmit);

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
   *  TALK ANIMATION  (idle -> intro -> loop×N -> outro -> idle)
   *  Three stacked layers over the idle base; exactly one is shown at a time.
   *  startTalkAnim(voiceMs) plans a whole number of loop reps + a speed tweak so
   *  the sequence fits the reply length without ever cutting the loop mid-way.
   * =========================================================================*/

  function safePlay(v) {
    try { const p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
  }

  // A clip's duration in ms (with a fallback if it isn't loaded/known yet).
  function clipDurationMs(v, fallbackSec) {
    const d = v && v.duration;
    return ((d && isFinite(d) && d > 0) ? d : fallbackSec) * 1000;
  }

  // Cross-fade duration for the idle<->talk boundaries (kept subtle).
  const TALK_FADE_MS = 160;
  let fadeTimer = null;

  function clearFade() { if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; } }

  // Ramp one layer's opacity from->to over ms with a timer. (setInterval keeps
  // running where CSS opacity transitions get throttled, e.g. headless render.)
  function rampOpacity(el, from, to, ms) {
    clearFade();
    if (!el) return;
    el.style.transition = "none";
    el.style.opacity = String(from);
    const steps = 8;
    let i = 0;
    fadeTimer = window.setInterval(function () {
      i++;
      el.style.opacity = String(from + (to - from) * (i / steps));
      if (i >= steps) { el.style.opacity = String(to); clearFade(); }
    }, Math.max(18, Math.round(ms / steps)));
  }

  // Instant swap between talk layers. Used for the pose-matched intro->loop and
  // loop->outro boundaries, where a hard cut is seamless and a fade would let the
  // idle base bleed through. (null = hide all instantly.)
  function hardLayer(name) {
    clearFade();
    if (els.vIntro) { els.vIntro.style.transition = "none"; els.vIntro.style.opacity = (name === "intro") ? "1" : "0"; }
    if (els.vLoop)  { els.vLoop.style.transition  = "none"; els.vLoop.style.opacity  = (name === "loop")  ? "1" : "0"; }
    if (els.vOutro) { els.vOutro.style.transition = "none"; els.vOutro.style.opacity = (name === "outro") ? "1" : "0"; }
  }

  // Cross-dissolve idle -> intro at the start of talking (smooths the snap
  // between the looping idle and the transition clip).
  function fadeInIntro() {
    if (els.vLoop)  { els.vLoop.style.transition  = "none"; els.vLoop.style.opacity  = "0"; }
    if (els.vOutro) { els.vOutro.style.transition = "none"; els.vOutro.style.opacity = "0"; }
    rampOpacity(els.vIntro, 0, 1, TALK_FADE_MS);
  }

  // Cross-dissolve outro -> idle at the end of talking.
  function fadeOutToIdle() {
    if (els.vIntro) { els.vIntro.style.transition = "none"; els.vIntro.style.opacity = "0"; }
    if (els.vLoop)  { els.vLoop.style.transition  = "none"; els.vLoop.style.opacity  = "0"; }
    rampOpacity(els.vOutro, 1, 0, TALK_FADE_MS);
  }

  function startTalkAnim(voiceMs) {
    if (!els.vIntro || !els.vLoop || !els.vOutro) return; // no clips -> idle stays
    const gen = ++talkGen;
    talkPhase = "intro";
    if (loopKeepAlive) { clearInterval(loopKeepAlive); loopKeepAlive = null; }

    // Plan the loop: pick a WHOLE number of repetitions plus a small speed tweak
    // so the whole talk (intro + loops + outro) lasts about as long as the reply,
    // and the loop is never cut mid-way. e.g. a 4s reply with a 1.67s loop and
    // ~1s intro/outro -> ~2s of middle -> 1 loop slowed to fit; a longer reply
    // -> more whole loops. Exact once you attach per-reply audio durations.
    const introMs = clipDurationMs(els.vIntro, 1.0);
    const outroMs = clipDurationMs(els.vOutro, 1.0);
    const loopMs  = clipDurationMs(els.vLoop, 1.67);
    const middleMs = Math.max(loopMs * 0.5, (voiceMs || 2500) - introMs - outroMs);
    talkReps = Math.max(1, Math.round(middleMs / loopMs));
    talkRate = Math.max(LOOP_MIN_RATE, Math.min(LOOP_MAX_RATE, (talkReps * loopMs) / middleMs));

    try { els.vLoop.pause(); els.vOutro.pause(); } catch (e) {}
    els.vIntro.playbackRate = 1;
    els.vIntro.onended = function () { advanceFromIntro(gen); };
    try { els.vIntro.currentTime = 0; } catch (e) {}
    fadeInIntro(); // cross-dissolve idle -> intro
    safePlay(els.vIntro);
    // Watchdog: if 'ended' never fires (throttling / dropped event), advance anyway.
    window.setTimeout(function () { advanceFromIntro(gen); }, introMs + 300);
  }

  function advanceFromIntro(gen) {
    if (gen !== talkGen || talkPhase !== "intro") return; // already advanced / stale
    playTalkLoop(gen);
  }

  // Play exactly talkReps WHOLE loops at talkRate, then the outro. Advancing only
  // on a completed iteration means the loop is never cut mid-way.
  function playTalkLoop(gen) {
    if (gen !== talkGen) return;
    talkPhase = "loop";
    hardLayer("loop"); // instant, pose-matched cut from the intro
    const loopMs = clipDurationMs(els.vLoop, 1.67);
    let done = 0;
    const restart = function () {
      try { els.vLoop.currentTime = 0; } catch (e) {}
      els.vLoop.playbackRate = talkRate;
      safePlay(els.vLoop);
    };
    els.vLoop.onended = function () {
      if (gen !== talkGen || talkPhase !== "loop") return;
      done++;
      if (done >= talkReps) playTalkOutro(gen); else restart();
    };
    restart();
    // Keep-alive: if a loop stalls mid-iteration (paused, no 'ended'), nudge it back.
    if (loopKeepAlive) clearInterval(loopKeepAlive);
    loopKeepAlive = window.setInterval(function () {
      if (gen !== talkGen || talkPhase !== "loop") { clearInterval(loopKeepAlive); loopKeepAlive = null; return; }
      if (els.vLoop.paused && !els.vLoop.ended) safePlay(els.vLoop);
    }, 200);
    // Watchdog: if 'ended' events get dropped and the count stalls, force the outro
    // after the planned total loop time (+ margin).
    const perLoopMs = loopMs / talkRate;
    window.setTimeout(function () {
      if (gen === talkGen && talkPhase === "loop") playTalkOutro(gen);
    }, talkReps * perLoopMs + perLoopMs + 700);
  }

  function playTalkOutro(gen) {
    if (gen !== talkGen) return;
    talkPhase = "outro";
    if (loopKeepAlive) { clearInterval(loopKeepAlive); loopKeepAlive = null; }
    try { els.vLoop.pause(); } catch (e) {}
    els.vOutro.playbackRate = 1;
    els.vOutro.onended = function () { finishTalkAnim(gen); };
    try { els.vOutro.currentTime = 0; } catch (e) {}
    hardLayer("outro"); // instant, pose-matched cut from the loop
    safePlay(els.vOutro);
    window.setTimeout(function () {
      if (gen === talkGen && talkPhase === "outro") finishTalkAnim(gen);
    }, clipDurationMs(els.vOutro, 1.1) + 300);
  }

  function finishTalkAnim(gen) {
    if (gen !== talkGen) return;
    talkPhase = "idle";
    if (loopKeepAlive) { clearInterval(loopKeepAlive); loopKeepAlive = null; }
    // Reset idle to its rest pose (frame 0 = the outro's last frame) so the
    // reveal lines up; it was hidden, so the reset itself isn't visible.
    try { els.video.currentTime = 0; } catch (e) {}
    fadeOutToIdle(); // cross-dissolve outro -> idle
    // Pause the transition clips after the fade finishes (leave them showing
    // their last frame while it dissolves).
    window.setTimeout(function () {
      try { els.vIntro.pause(); els.vLoop.pause(); els.vOutro.pause(); } catch (e) {}
    }, TALK_FADE_MS + 40);
    backToIdle();
  }

  // Hard cancel (an interrupt) -> jump straight back to the idle base.
  function stopTalkAnim() {
    talkGen++; // invalidate any pending phase callbacks
    talkPhase = "idle";
    if (loopKeepAlive) { clearInterval(loopKeepAlive); loopKeepAlive = null; }
    hardLayer(null); // interrupts hide instantly (no fade)
    if (els.vIntro) try { els.vIntro.pause(); } catch (e) {}
    if (els.vLoop)  try { els.vLoop.pause(); } catch (e) {}
    if (els.vOutro) try { els.vOutro.pause(); } catch (e) {}
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
    stopTalkAnim();
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
   *  TEXT INPUT  (type instead of talking; she still replies with voice)
   * =========================================================================*/

  function onTextSubmit(event) {
    event.preventDefault();
    const text = ((els.textInput && els.textInput.value) || "").trim();
    if (!text) return;
    els.textInput.value = "";
    els.textInput.blur(); // dismiss the on-screen keyboard on mobile
    handleTextInput(text);
  }

  function handleTextInput(text) {
    // If the mic is currently listening, stop it — the typed message wins.
    if (recognizing) { try { recognition.abort(); } catch (e) { /* ignore */ } }
    pendingReply = null;
    const reply = matchResponse(text);
    speak(reply); // shows the bubble, speaks aloud, and plays the talking animation
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
    speakToken++;
    if (synth) synth.cancel();       // stop any current speech
    showBubble(text);                // visual reply bubble
    announce(text);                  // screen-reader live region

    const voiceMs = estimateVoiceMs(text);
    setState("talking");
    setStatus("");
    startTalkAnim(voiceMs);          // plan + run the animation (self-contained)

    // Speak aloud unless muted / unsupported. The animation runs independently of
    // the audio, so nothing breaks if TTS is unavailable or has no 'end' event.
    if (!isMuted && synth) {
      try {
        const utter = new SpeechSynthesisUtterance(text);
        if (!chosenVoice) chosenVoice = pickVoice(synth.getVoices() || []);
        if (chosenVoice) utter.voice = chosenVoice;
        utter.lang   = (chosenVoice && chosenVoice.lang) || RECOGNITION_LANG;
        utter.pitch  = VOICE_PITCH;
        utter.rate   = VOICE_RATE;
        utter.volume = VOICE_VOLUME;
        synth.speak(utter);
      } catch (e) { /* animation already running */ }
    }
  }

  // Rough guess at how long a reply takes to say, to plan the animation length.
  // Becomes exact once per-reply audio clips (with real durations) are attached.
  function estimateVoiceMs(text) {
    const len = (text ? text.length : 20);
    return Math.min(VOICE_MAX_MS, Math.max(VOICE_MIN_MS, VOICE_MS_PER_CHAR * len + 250));
  }

  function backToIdle() {
    setState("idle");
    setStatus("Tap me to talk again! 👑");
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
        if (els.textInput) els.textInput.focus(); // no mic — nudge them to type
        speakUnsupportedHint();
        break;
      case "listening":
        stopListening();
        break;
      case "talking":
        speakToken++;
        if (synth) synth.cancel();
        stopTalkAnim();
        backToIdle();
        break;
      default: // idle / error
        startListening();
    }
  }

  function speakUnsupportedHint() {
    const line = "Hi! I'm Princess Mariam. Your browser can't hear you, but type to me below and I'll talk right back, cutie!";
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
      if (state === "talking") { stopTalkAnim(); backToIdle(); }
    }
  }

  function enterUnsupported() {
    setState("unsupported");
    setStatus("No mic? Type to me below, cutie! 👑");
    if (els.unsupported) els.unsupported.hidden = false;
  }

  function setState(next) {
    state = next;
    els.body.className = "state-" + next;
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
