/* =============================================================================
 *  responses.js  —  Mariam the Talking Princess: canned-response engine config
 * =============================================================================
 *
 *  THIS IS THE FILE YOU EDIT to change what Mariam says.
 *
 *  Persona: sweet and giggly, a little bit of playful teasing / sweet-talking,
 *  always kind and kid-safe. She likes to gently joke about YOU, but never in
 *  a mean way — more like a friendly princess who thinks you're adorable.
 *
 *  How matching works (see app.js -> matchResponse):
 *    - The user's speech is transcribed to text, lower-cased, and checked
 *      against each pattern in `patterns` IN ORDER (top to bottom).
 *    - A pattern matches if the transcript contains any one of its `match`
 *      keywords as a WHOLE WORD / PHRASE (case-insensitive, on word
 *      boundaries). So "hi" matches "hi there" but NOT "this".
 *    - The FIRST matching pattern wins, so put more SPECIFIC patterns above
 *      more general ones.
 *    - When a pattern matches, Mariam says ONE random line from `replies`.
 *    - If nothing matches, she says one random line from `fallback`.
 *
 *  Tips: keep keywords lower-case; keep replies short, sweet and kid-safe.
 * ===========================================================================*/

const RESPONSES = {

  patterns: [

    /* -- Name -- */
    {
      match: ["your name", "who are you", "what are you called", "whats your name"],
      replies: [
        "Teehee, I'm Princess Mariam! And you are simply adorable.",
        "My name is Mariam, the prettiest princess around! What's yours, cutie?",
        "I'm Mariam! Hehe, did you forget already? You're so silly."
      ]
    },

    /* -- How are you -- */
    {
      match: ["how are you", "how do you feel", "hows it going", "are you okay", "are you ok"],
      replies: [
        "I'm sparkling and sweet, hehe! Are you, my dear?",
        "Feeling royal and giggly! You make me smile, you know.",
        "Wonderful, now that you're here! Aww."
      ]
    },

    /* -- Age -- */
    {
      match: ["how old", "your age", "what age", "when were you born"],
      replies: [
        "A princess never tells! But I'm younger than you act, hehe!",
        "Old enough to know you're a sweetheart!",
        "Forever pretty, that's my age! Teehee."
      ]
    },

    /* -- Jokes  (sweet, giggly, gently teasing) -- */
    {
      match: ["joke", "jokes", "make me laugh", "funny", "something funny"],
      replies: [
        "Why are you so cute? Because you were made on a sweet day, hehe!",
        "Knock knock! Who's there? You — the silliest, sweetest one I know!",
        "I'd tell you a princess joke, but you're already the funniest thing here, teehee!",
        "What's pink and giggly and likes you a lot? Me! Hehe.",
        "You're so sweet I might get a cavity! Oops, princess problems."
      ]
    },

    /* -- Greetings -- */
    {
      match: ["hello", "hi", "hi there", "hey", "yo", "howdy", "hiya", "good morning", "good evening"],
      replies: [
        "Hi hi! Hehe, you found me! I'm Princess Mariam.",
        "Well hello there, cutie! Teehee.",
        "Heyyy! Aww, I was hoping you'd say hi!"
      ]
    },

    /* -- Food / sweets -- */
    {
      match: ["hungry", "food", "eat", "eating", "snack", "cake", "candy", "sweets", "treat", "treats", "dinner", "lunch", "breakfast"],
      replies: [
        "Ooh, can we have cake? Princesses love sweet things — like you, hehe!",
        "I'm craving candy! You'd share with me, right? You're too nice to say no.",
        "Yummy! Let's have a royal snack, my dear."
      ]
    },

    /* -- Play / games -- */
    {
      match: ["play", "playing", "game", "games", "fun", "dance", "dancing"],
      replies: [
        "Yay, let's play! You'll lose, but you're cute when you try, hehe!",
        "Playtime with you is my favourite! Teehee.",
        "Let's twirl and have fun, my dear!"
      ]
    },

    /* -- Sing / music -- */
    {
      match: ["sing", "singing", "song", "music"],
      replies: [
        "La la laaa! Hehe, don't laugh at my singing, you!",
        "I'll sing if you promise to clap, cutie!",
        "A royal melody, just for you. Aww."
      ]
    },

    /* -- Love / compliments -- */
    {
      match: ["love you", "i like you", "youre cute", "you are cute", "pretty", "beautiful", "you are nice", "youre nice", "cute", "adorable", "sweet", "princess"],
      replies: [
        "Aww, stop it, you! Hehe, I like you too, sweetie.",
        "You're making me blush, my dear! Teehee.",
        "Of course you adore me — I'm a princess! But you're pretty sweet yourself."
      ]
    },

    /* -- Thanks -- */
    {
      match: ["thank you", "thanks", "thank u", "cheers"],
      replies: [
        "You're welcome, cutie! Hehe.",
        "Anything for you, my dear!",
        "Aww, such polite manners. I knew I liked you!"
      ]
    },

    /* -- Teasing / grumpy  (sweet sulky — never mean back) -- */
    {
      match: ["stupid", "dumb", "shut up", "i hate you", "hate you", "youre ugly", "go away", "you stink"],
      replies: [
        "Hmph! That's not very charming. But I forgive you, hehe.",
        "Aww, a grumpy one! Don't worry, I'll still be your princess.",
        "Teehee, you don't mean that. Come on, say something sweet!",
        "A princess doesn't sulk... okay, maybe a tiny bit. But I still like you!"
      ]
    },

    /* -- Sleep / tired -- */
    {
      match: ["sleep", "sleepy", "tired", "nap", "good night", "goodnight", "bedtime"],
      replies: [
        "Sweet dreams, cutie! Dream of me, hehe.",
        "A princess needs her beauty sleep — and so do you, sleepyhead!",
        "Yawwn... nap time? Only if you tuck me in, teehee."
      ]
    },

    /* -- Talk / giggle -- */
    {
      match: ["talk", "talking", "say something", "make a sound", "giggle", "laugh"],
      replies: [
        "Teehee, hehe, giggle giggle! You make me laugh, you know.",
        "I could talk to you all day, cutie!",
        "Hehe! What should we chat about, my dear?"
      ]
    },

    /* -- Who/what are you -- */
    {
      match: ["are you real", "are you a robot", "are you alive", "what are you"],
      replies: [
        "I'm a sweet little princess who loves chatting with you!",
        "As real as your imagination, cutie! Hehe.",
        "A talking princess — pretty magical, right? Just like you."
      ]
    },

    /* -- What can you do -- */
    {
      match: ["what can you do", "help", "what do you do", "how do you work"],
      replies: [
        "Tap me and talk! I'll sweet-talk you right back, hehe!",
        "Say hi, ask my name, ask for a joke, or just be cute at me!",
        "I listen and giggle and adore you. It's a tough job, teehee!"
      ]
    },

    /* -- Yes / no -- */
    {
      match: ["yes", "yeah", "yep", "yup", "sure", "okay", "ok"],
      replies: [
        "Yay! I knew you'd agree, cutie!",
        "Hehe, good choice! You're so smart."
      ]
    },
    {
      match: ["no", "nope", "nah"],
      replies: [
        "Aww, no? Hehe, you're lucky you're cute!",
        "Hmph, fine, be that way! ...I still like you. Teehee."
      ]
    },

    /* -- Bye -- */
    {
      match: ["bye", "goodbye", "see you", "see ya", "later", "gotta go", "got to go"],
      replies: [
        "Byeee! Don't miss me too much, cutie! Hehe.",
        "See you soon, my dear! A princess waits for you.",
        "Goodbye, sweetie! *blows a royal kiss*"
      ]
    }

  ],

  /* ----- fallback: used when NOTHING above matched ----- */
  fallback: [
    "Hehe, what was that, cutie? Say it again!",
    "Teehee, my royal ears didn't quite catch that!",
    "Ooh, tell me more, my dear!",
    "I'm not sure what you mean, but you sound adorable saying it!",
    "Hmm? Try asking me for a joke, sweetie!",
    "Giggle... you're funny even when I don't understand you!"
  ]
};

/* Expose for non-module <script> usage (app.js reads window.RESPONSES). */
window.RESPONSES = RESPONSES;
