/* =============================================================================
 *  responses.js  —  Tom the Talking Cat: canned-response engine config
 * =============================================================================
 *
 *  THIS IS THE FILE YOU EDIT to change what Tom says.
 *
 *  How matching works (see app.js -> matchResponse):
 *    - The user's speech is transcribed to text, lower-cased, and checked
 *      against each pattern in `patterns` IN ORDER (top to bottom).
 *    - A pattern matches if the transcript contains any one of its `match`
 *      keywords as a WHOLE WORD / PHRASE (case-insensitive, on word
 *      boundaries). So the keyword "hi" matches "hi there" but NOT "this",
 *      and "no" matches "no thanks" but NOT "know". Multi-word phrases like
 *      "tell me a joke" match when those words appear together.
 *    - The FIRST matching pattern wins, so put more SPECIFIC patterns
 *      (e.g. "what's your name") ABOVE more general ones.
 *    - When a pattern matches, Tom says ONE randomly-chosen line from `replies`.
 *    - If nothing matches, Tom says one random line from `fallback`.
 *
 *  Tips:
 *    - Keep all `match` keywords lower-case.
 *    - Because matching is whole-word, short keywords like "no"/"ok"/"hi" are
 *      safe to use — they won't fire inside longer words.
 *    - Keep replies short, friendly and KID-SAFE.
 *    - Add as many patterns / replies as you like.
 * ===========================================================================*/

const RESPONSES = {

  /* ----- patterns: checked top-to-bottom, first match wins ----- */
  patterns: [

    /* -- Name (specific phrasing first) -- */
    {
      match: ["your name", "who are you", "what are you called", "whats your name"],
      replies: [
        "I'm Tom the cat! Nice to meet you!",
        "My name is Tom! What's yours?",
        "They call me Tom! Meow!"
      ]
    },

    /* -- How are you -- */
    {
      match: ["how are you", "how do you feel", "hows it going", "are you okay", "are you ok"],
      replies: [
        "I'm purr-fectly happy! How are you?",
        "I feel great! Ready to play!",
        "Meow-velous, thanks for asking!"
      ]
    },

    /* -- Age -- */
    {
      match: ["how old", "your age", "what age", "when were you born"],
      replies: [
        "I'm forever young — about three in cat years!",
        "Old enough to nap a lot! Meow.",
        "I stopped counting after my last birthday!"
      ]
    },

    /* -- Jokes -- */
    {
      match: ["joke", "jokes", "make me laugh", "funny", "something funny"],
      replies: [
        "Why was the cat sitting on the computer? To keep an eye on the mouse!",
        "What do you call a pile of kittens? A meow-ntain!",
        "Why don't cats play cards in the jungle? Too many cheetahs!",
        "What's a cat's favorite color? Purr-ple!",
        "Why did the cat run from the tree? It was afraid of the bark!"
      ]
    },

    /* -- Greetings -- (whole-word matching keeps "hi" out of "this"/"history") */
    {
      match: ["hello", "hi", "hi there", "hey", "yo", "howdy", "hiya", "good morning", "good evening"],
      replies: [
        "Hello there! I'm Tom!",
        "Hi hi! So happy to see you! Meow!",
        "Hey friend! Let's talk!"
      ]
    },

    /* -- Food / hungry -- */
    {
      match: ["hungry", "food", "eat", "eating", "snack", "fish", "treat", "treats", "milk", "yummy", "dinner", "lunch", "breakfast"],
      replies: [
        "Mmm, did someone say fish? I'm so hungry!",
        "I could eat a whole bowl of treats right now!",
        "Yum yum! I love snacks! Do you have any?"
      ]
    },

    /* -- Play / games -- */
    {
      match: ["play", "playing", "game", "games", "fun", "chase", "ball", "toy", "yarn"],
      replies: [
        "Yay, let's play! I love chasing things!",
        "Playtime is the best time! Wheee!",
        "Throw me a ball of yarn! Meow!"
      ]
    },

    /* -- Sing / music -- */
    {
      match: ["sing", "singing", "song", "music", "dance", "dancing"],
      replies: [
        "La la la... meow meow meow! That's my song!",
        "I'm not a great singer, but I purr in tune!",
        "Let's dance! Wiggle those whiskers!"
      ]
    },

    /* -- Love / like / nice  (note: "silly cat" lives here — it's affectionate) -- */
    {
      match: ["love you", "i like you", "youre cute", "you are cute", "good boy", "good cat", "you are nice", "youre nice", "cute", "adorable", "sweet", "silly cat"],
      replies: [
        "Aww, I love you too! Purr purr.",
        "You're the best! *happy cat noises*",
        "That makes my whiskers wiggle with joy!"
      ]
    },

    /* -- Thanks -- */
    {
      match: ["thank you", "thanks", "thank u", "cheers"],
      replies: [
        "You're welcome! Anytime, friend!",
        "No problem! Meow!",
        "Happy to help! Purr."
      ]
    },

    /* -- Insults / angry  (KID-SAFE sulky replies, never mean back) --
       Keep these keywords narrow so friendly/neutral talk (like "I hate
       broccoli" or an affectionate "silly cat") does NOT land here. */
    {
      match: ["stupid", "dumb", "shut up", "i hate you", "hate you", "youre ugly", "bad cat", "go away", "you stink"],
      replies: [
        "Aww, that's not very nice. I'll just go nap.",
        "Hmph! Now my whiskers are droopy.",
        "That made me a little sad... but I still like you.",
        "Meow? Let's be friends instead!"
      ]
    },

    /* -- Sleep / tired -- */
    {
      match: ["sleep", "sleepy", "tired", "nap", "good night", "goodnight", "bedtime"],
      replies: [
        "A nap sounds purr-fect right now. Zzz...",
        "I love sleeping in warm sunny spots!",
        "Yawwwn... is it nap time already?"
      ]
    },

    /* -- Animal sounds / meow -- */
    {
      match: ["meow", "purr", "bark", "moo", "make a sound", "say something", "talk", "talking"],
      replies: [
        "Meow meow! Purrrrr!",
        "Meeeoooow! Did I sound like a real cat?",
        "Purr purr purr... that's my favorite sound!"
      ]
    },

    /* -- Who made you / what are you -- */
    {
      match: ["who made you", "are you real", "are you a robot", "are you alive", "what kind of cat"],
      replies: [
        "I'm a friendly cartoon cat who loves to chat!",
        "I'm as real as your imagination! Meow!",
        "I'm a talking cat — pretty cool, right?"
      ]
    },

    /* -- What can you do -- */
    {
      match: ["what can you do", "help", "what do you do", "how do you work"],
      replies: [
        "Tap me and talk! I'll chat right back! Try saying hello, or ask for a joke!",
        "Say hi, ask my name, ask for a joke, or tell me you're hungry!",
        "I love to listen and reply! Go on, say something fun!"
      ]
    },

    /* -- Yes / no small talk -- */
    {
      match: ["yes", "yeah", "yep", "yup", "sure", "okay", "ok"],
      replies: [
        "Yay! I like the sound of that!",
        "Awesome! Meow!"
      ]
    },
    {
      match: ["no", "nope", "nah"],
      replies: [
        "Aww, okay. Maybe next time!",
        "No worries! Meow."
      ]
    },

    /* -- Bye -- */
    {
      match: ["bye", "goodbye", "see you", "see ya", "later", "gotta go", "got to go"],
      replies: [
        "Bye bye! Come back and play soon!",
        "See you later! I'll miss you! Meow!",
        "Goodbye, friend! *waves paw*"
      ]
    }

  ],

  /* ----- fallback: used when NOTHING above matched ----- */
  fallback: [
    "Hmm, I didn't quite catch that!",
    "Say that again? My ears are fuzzy!",
    "Meow? I'm not sure what you mean, but I like talking to you!",
    "Ooh, tell me more!",
    "Purr... try asking me for a joke!",
    "I didn't understand, but you sound nice!"
  ]
};

/* Expose for non-module <script> usage (app.js reads window.RESPONSES). */
window.RESPONSES = RESPONSES;
