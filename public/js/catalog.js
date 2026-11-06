/* The content engine for envelopes.
   Shared by the server (require) and the browser (window.LW_CATALOG).
   relationship + intent decide the theme, wording, questions, sections, ambience and ending.
   Placeholders filled when shown: {name} {from} {they} {them} {their} {They} {Their}. Gender only ever changes pronouns. */
(function (root) {
  const RELATIONSHIPS = {
    partner: { label: "My Partner", noun: "partner", theme: "partner", line: "Say the thing your heart keeps rehearsing." },
    bestie: { label: "My Bestie", noun: "bestie", theme: "bestie", line: "Loud, unhinged and completely sincere." },
    friend: { label: "My Friend", noun: "friend", theme: "friend", line: "A small, bright thank-you for being around." },
    mom: { label: "My Mom", noun: "mom", theme: "mom", line: "For everything that never got thanked out loud." },
    dad: { label: "My Dad", noun: "dad", theme: "dad", line: "For the quiet kind of love that showed up anyway." },
  };

  const THEMES = {
    partner: { label: "Candlelit burgundy", ambience: "fireflies", flower: "redrose", wrap: "blush", ribbon: "satin", og: "/img/og-partner.png" },
    bestie: { label: "Loud scrapbook", ambience: "confetti", flower: "mixed", wrap: "kraft", ribbon: "twine", og: "/img/og-bestie.png" },
    friend: { label: "Fresh pastel garden", ambience: "pollen", flower: "daisy", wrap: "sage", ribbon: "gingham", og: "/img/og-friend.png" },
    mom: { label: "Warm peach letterpress", ambience: "petals", flower: "pinkrose", wrap: "ivory", ribbon: "lace", og: "/img/og-mom.png" },
    dad: { label: "Blue classic stationery", ambience: "stars", flower: "sunflower", wrap: "ivory", ribbon: "velvet", og: "/img/og-dad.png" },
  };

  /* -------------------------------------------------- question banks */
  const BANKS = {
    romantic: [
      "What was the first thing you noticed about me?",
      "What little thing I do makes you smile?",
      "When do you feel most loved?",
      "What would your perfect date look like?",
      "What's one memory of us you wish you could relive?",
      "What is something you have always wanted us to experience together?",
      "What makes you feel emotionally safe?",
      "What's one thing about our connection you never want to change?",
      "What is your favourite little thing about us?",
      "What does a forever kind of connection mean to you?",
    ],
    proposal: [
      "What does a lifetime of happiness look like to you?",
      "What is one dream you would love to build with someone?",
      "What makes a relationship feel like home?",
      "What is one promise that matters more than expensive gifts?",
      "What would your dream future together look like?",
      "What is your favourite thing about choosing someone every day?",
      "What makes you believe two people can grow together?",
      "If you could design a perfect memory together, what would it be?",
    ],
    bestie: [
      "What was your first impression of me?",
      "What is my most annoying habit?",
      "If we had a reality show, what would it be called?",
      "What is the most ridiculous thing we could do together?",
      "Which one of us would survive longer on a deserted island?",
      "What's a secret talent you have?",
      "What is one thing I should never stop doing?",
      "What would our friendship look like in another universe?",
      "What's one memory you want to create together?",
      "What is something you can tell me without hesitation?",
      "If we opened a business together, what disaster would happen first?",
      "What nickname would you give our friendship?",
      "What's one thing you secretly appreciate about me?",
      "If our friendship had a soundtrack, which song would be on it?",
      "What is the funniest memory we share?",
    ],
    friend: [
      "What's something that instantly makes you happy?",
      "What is one thing people misunderstand about you?",
      "What's your dream spontaneous adventure?",
      "What is something you are secretly proud of?",
      "If you could learn one new skill instantly, what would it be?",
      "What's your funniest unpopular opinion?",
      "What is one thing you want to achieve this year?",
      "What makes someone unforgettable as a friend?",
    ],
    mom: [
      "What is one family memory you wish we could relive?",
      "What is something you always wanted me to understand?",
      "What makes you happiest on an ordinary day?",
      "What is something you are proud of?",
      "What is one dream you still want to fulfil?",
      "What is something you wish we did together more often?",
      "What's one lesson life has taught you?",
      "What is your favourite memory from when I was little?",
      "What makes you feel appreciated?",
      "What is something you want me to remember forever?",
    ],
    dad: [
      "What's your favourite childhood memory?",
      "What was your biggest dream when you were young?",
      "What is one lesson you want me to carry through life?",
      "What is something you wish we did more often?",
      "What's a moment in your life that made you especially proud?",
      "What makes you happy these days?",
      "What's one thing you learned the hard way?",
      "What is your favourite family memory?",
      "What's something you want to experience in the future?",
      "What is one thing you want me to know?",
    ],
  };

  const CHOICES = {
    partner: [{ q: "Pick our next little adventure.", options: ["A slow morning with nowhere to be", "A night drive with the good playlist", "Somewhere neither of us has been", "Honestly, anywhere you are"] }],
    bestie: [{ q: "Which of us is more likely to get us banned from somewhere?", options: ["Me, obviously", "You, and you know it", "Both, with a shared plan", "We're already banned"] }],
    friend: [{ q: "What's the ideal catch-up?", options: ["Coffee that turns into three hours", "A long walk and a longer chat", "Voice notes, forever", "Food first, talking later"] }],
    mom: [{ q: "Which ordinary thing should we do more of?", options: ["Tea and doing absolutely nothing", "Cooking something together", "Looking through old photos", "Going out, just the two of us"] }],
    dad: [{ q: "What should our next day out be?", options: ["A long drive", "A good meal and a long chat", "Fixing something around the house", "Whatever you've been meaning to show me"] }],
  };

  // intent -> which bank, and which of its questions (1-based), plus any extras
  const pick = (bank, list, extra) => ({ bank, list, extra: extra || [] });

  /* -------------------------------------------------- shared content per relationship */
  const BASE = {
    partner: {
      compliments: [
        "You make ordinary evenings feel like something I'd want to remember.",
        "I notice how carefully you love people. I notice it every time.",
        "My favourite sound is still you laughing at something you were trying not to laugh at.",
        "You are the first person I want to tell things to, including the very small things.",
        "Being with you has made me gentler, and I didn't know I needed that.",
        "You're beautiful in the way that gets more true the longer I know you.",
      ],
      letters: [
        { title: "Open when you miss me", text: "I'm probably missing you too, and pretending to be busy about it.\n\nCall me. I don't care what time it is. This is what I'm for." },
        { title: "Open when we've argued", text: "Being annoyed with you doesn't change a single thing about how much I love you.\n\nI'd rather be on your side and wrong than right and alone. Come and find me." },
        { title: "Open when you can't sleep", text: "Breathe out. Nothing needs solving tonight.\n\nHere's a thought to fall asleep on: somewhere close by, someone is very glad you exist." },
      ],
      secrets: [
        { label: "the first thing", text: "I knew earlier than I ever admitted to you." },
        { label: "a confession", text: "I've saved messages of yours just to read them again later." },
        { label: "the small one", text: "I practise what I'm going to say to you. It never comes out as planned." },
      ],
      messages: ["For the way you say my name.", "For every time you stayed.", "For the laugh you don't do for anyone else.", "For the quiet you make feel safe."],
    },
    bestie: {
      compliments: [
        "You are the only person who has seen all of my worst ideas and encouraged most of them.",
        "You make being a disaster feel like a team sport.",
        "I would absolutely help you hide something. I wouldn't even ask what.",
        "You're funnier than me, and I have told nobody this until now.",
        "You have a very specific way of making everything better just by being rude about it.",
        "If the group chat ever goes down, you're still the one I'd walk over to.",
      ],
      letters: [
        { title: "Open when you've embarrassed yourself", text: "It wasn't that bad.\n\nOkay, it was. But I've seen worse, mainly from you, and you survived every time.\n\nSend me the full story. Every detail. Immediately." },
        { title: "Open when you think nobody gets it", text: "I get it. Maybe not the facts, but I get you.\n\nYou don't have to explain. You can just show up and be annoying. It's how I know you're okay." },
        { title: "Open when you need a reality check", text: "You are not a mess. You're a work in progress with excellent taste in friends.\n\nDrink some water. Reply to that message. Then call me." },
      ],
      secrets: [
        { label: "classified", text: "I defend you when you're not there. Aggressively." },
        { label: "do not screenshot", text: "I keep a mental list of your best lines. It's long." },
        { label: "off the record", text: "You've quietly saved me a few times, and I've never said so." },
      ],
      messages: ["For putting up with me. Respect.", "For your terrible, perfect advice.", "For laughing in places we shouldn't.", "For knowing exactly what I meant."],
    },
    friend: {
      compliments: [
        "You make people feel welcome without ever making a big deal of it.",
        "Talking to you always leaves me a bit lighter than I arrived.",
        "You remember small things about people, and it matters more than you think.",
        "You're easy to be around, which is rarer than people admit.",
        "You're one of the good ones. I mean that plainly.",
        "I'm always glad when it's your name on my phone.",
      ],
      letters: [
        { title: "Open when you need a good thought", text: "You are doing better than you think, and more people are glad of you than you realise.\n\nThat's it. That's the whole letter." },
        { title: "Open when you've had a long week", text: "Rest. Eat something decent. Don't reply to anyone for an hour.\n\nThen, if you feel like it, tell me about it." },
      ],
      secrets: [
        { label: "something small", text: "You once said something kind that I still think about." },
        { label: "a little truth", text: "I talk about you to other people, and only ever nicely." },
      ],
      messages: ["For being easy to talk to.", "For showing up without being asked.", "For the good conversations.", "For making things lighter."],
    },
    mom: {
      compliments: [
        "You made a home feel safe long before I understood that this was work.",
        "So much of what's good in me, I learned by watching you.",
        "You've carried more than you ever let us see.",
        "Your kindness never needed an audience.",
        "You remember everything that matters to us. I hope you know we notice.",
        "I'm old enough now to see how much you gave up, and how quietly.",
      ],
      letters: [
        { title: "Open when you're tired", text: "Please sit down. Everything can wait for ten minutes, and you've earned far more than ten minutes.\n\nYou've looked after everyone for so long. Let someone look after you." },
        { title: "Open when you wonder if you did enough", text: "You did. You did more than enough.\n\nAll those days you thought you'd got it wrong, you were still the person I needed most." },
      ],
      secrets: [
        { label: "something I never said", text: "When I don't know what to do, I still wonder what you'd do." },
        { label: "a small truth", text: "I repeat your sayings now. Yes, the ones I used to roll my eyes at." },
      ],
      messages: ["For every meal you made with love.", "For staying up when I couldn't sleep.", "For the worrying I complained about.", "For believing in me first."],
    },
    dad: {
      compliments: [
        "You showed me what being dependable looks like, without ever making a speech about it.",
        "So many of the things I know how to do, I know because you were patient with me.",
        "You worked hard so that things would be easier for us. I see that now.",
        "You don't always say it in words, and I've learned to hear it anyway.",
        "Your steadiness has held up more than you know.",
        "I'm proud to be yours.",
      ],
      letters: [
        { title: "Open when you think I didn't notice", text: "I noticed. The early mornings, the things you went without, all the problems you solved before we knew they existed.\n\nThank you." },
        { title: "Open when you need to hear it", text: "You were a good dad on the days you felt you weren't. You still are.\n\nI don't say it much. I'm saying it now." },
      ],
      secrets: [
        { label: "between us", text: "I still try to be like you when things get hard." },
        { label: "for the record", text: "I've quoted your advice to other people and taken the credit." },
      ],
      messages: ["For every lift you gave me.", "For fixing what I broke.", "For being there without being asked.", "For the advice I ignored, then followed."],
    },
  };

  /* -------------------------------------------------- quiz per relationship */
  const QUIZ = {
    partner: {
      title: "What kind of love story are we?",
      questions: [
        { q: "It's a rainy Sunday. We are...", options: [["under one blanket, not moving", "soft"], ["suddenly planning a trip", "wild"], ["cooking something too ambitious", "team"], ["talking about everything until it's dark", "deep"]] },
        { q: "Our love language is mostly...", options: [["little things, remembered", "soft"], ["teasing each other, relentlessly", "wild"], ["showing up, every time", "team"], ["long conversations", "deep"]] },
        { q: "Pick a song for us.", options: [["Something slow", "soft"], ["Something loud in a car", "wild"], ["Our song, the one with the story", "team"], ["One that makes us go quiet", "deep"]] },
      ],
      results: {
        soft: { title: "The Slow Burn", text: "Soft mornings and small kindnesses. Yours is the love that makes a home out of ordinary days." },
        wild: { title: "The Great Adventure", text: "You two are the reason someone had to write 'please do not' on a sign." },
        team: { title: "The Unbeatable Team", text: "You choose each other like a habit and solve life like a shared project." },
        deep: { title: "The Midnight Conversation", text: "You could talk until the sun came up. You probably have." },
      },
    },
    bestie: {
      title: "What kind of duo are we?",
      questions: [
        { q: "We walk into a party. Within an hour we...", options: [["have a new best friend", "chaos"], ["are hiding near the snacks", "gremlins"], ["are in the kitchen fixing someone's life", "therapists"], ["have planned our exit", "plotters"]] },
        { q: "Our group chat is mostly...", options: [["screenshots and no context", "chaos"], ["memes at 3 a.m.", "gremlins"], ["'are you okay' and long voice notes", "therapists"], ["plans that may never happen", "plotters"]] },
        { q: "In a crisis, we...", options: [["make it worse, loudly", "chaos"], ["laugh first and think later", "gremlins"], ["hold each other together", "therapists"], ["make a very detailed spreadsheet", "plotters"]] },
      ],
      results: {
        chaos: { title: "Certified Chaos Agents", text: "No plan, no brakes, no regrets. Several witnesses." },
        gremlins: { title: "Two Gremlins, One Brain Cell", text: "Sharing a single brain cell, and it's always with the other one." },
        therapists: { title: "Unlicensed Therapists", text: "You've fixed each other's lives repeatedly and charged nothing." },
        plotters: { title: "The Masterminds", text: "Quietly planning something. It will be ridiculous, and it will work." },
      },
    },
    friend: {
      title: "What kind of friend are you?",
      questions: [
        { q: "Your perfect free afternoon is...", options: [["outside, somewhere new", "explorer"], ["a long conversation", "listener"], ["making something", "maker"], ["hosting people", "host"]] },
        { q: "Friends come to you when they need...", options: [["a plan to get out of the house", "explorer"], ["someone to really listen", "listener"], ["a clever fix", "maker"], ["food and a place to sit", "host"]] },
        { q: "Your bag always contains...", options: [["a map, or at least a list of places", "explorer"], ["tissues, just in case", "listener"], ["a pen and a half-finished idea", "maker"], ["snacks for everyone", "host"]] },
      ],
      results: {
        explorer: { title: "The Explorer", text: "You make people leave the house and be glad they did." },
        listener: { title: "The Good Listener", text: "People feel better after talking to you, and they aren't sure why." },
        maker: { title: "The Maker", text: "You turn ideas into actual things, while everyone else is still talking." },
        host: { title: "The Host", text: "Wherever you are feels like somewhere people are welcome." },
      },
    },
    mom: {
      title: "What kind of mother's love is yours?",
      questions: [
        { q: "When something goes wrong, you first...", options: [["make sure everyone has eaten", "nurturer"], ["start working out a solution", "strength"], ["make everyone laugh about it", "sunshine"], ["sit down and listen", "wise"]] },
        { q: "The phrase we've heard most from you is...", options: [["'Have you eaten?'", "nurturer"], ["'You can do this.'", "strength"], ["'It'll be funny one day.'", "sunshine"], ["'Tell me what happened.'", "wise"]] },
        { q: "Your perfect quiet moment is...", options: [["everyone at home and fed", "nurturer"], ["a job finally finished", "strength"], ["music on and windows open", "sunshine"], ["tea and a good talk", "wise"]] },
      ],
      results: {
        nurturer: { title: "The Heart of the Home", text: "Love, for you, always arrives with a full plate and a follow-up question." },
        strength: { title: "The Quiet Strength", text: "You carried things without complaint, and we stood on your shoulders." },
        sunshine: { title: "The Sunshine", text: "You've kept the house warm and laughing through all sorts of weather." },
        wise: { title: "The Wise One", text: "You usually knew. We usually found out later." },
      },
    },
    dad: {
      title: "What kind of dad are you?",
      questions: [
        { q: "Something at home breaks. You...", options: [["already have the toolbox out", "fixer"], ["teach me to fix it myself", "teacher"], ["make a joke, then fix it", "joker"], ["quietly handle it before anyone notices", "rock"]] },
        { q: "Your classic line is...", options: [["'I can fix that.'", "fixer"], ["'Let me show you.'", "teacher"], ["'Hi hungry, I'm Dad.'", "joker"], ["'Don't worry about it.'", "rock"]] },
        { q: "On a day off, you're...", options: [["working on some project", "fixer"], ["reading or explaining something", "teacher"], ["trying to make everyone laugh", "joker"], ["checking everyone's all right", "rock"]] },
      ],
      results: {
        fixer: { title: "The Fixer", text: "There's nothing a bit of patience and the right tool can't sort out." },
        teacher: { title: "The Teacher", text: "You didn't only do things for us. You showed us how." },
        joker: { title: "The Joker", text: "Your jokes are terrible, and we'd be lost without them." },
        rock: { title: "The Rock", text: "You've held up more than any of us saw." },
      },
    },
  };

  /* -------------------------------------------------- intents */
  const standard = (...extra) => ["opening", ...extra, "finale"];
  const INTENTS = {
    partner: [
      { id: "propose", label: "I want to propose", blurb: "A dramatic reveal, flowers, and one final question.", ambience: "fireflies",
        sections: standard("compliments", "gallery", "letters", "bouquet", "questions", "proposal"), questions: pick("proposal", [1, 2, 3, 4, 5, 6, 7, 8]),
        opening: { kicker: "Before you read anything else", greeting: "My {name},", message: "I've tried to say this properly a hundred times. So I built you somewhere to say it. Please take your time. There's no rush in here at all." },
        compliments: ["You are the person I want to tell everything to, for the rest of everything.", "I've met my future, and it leaves its things all over the place and laughs at its own jokes.", "You make forever sound less like a big word and more like a Tuesday with you."],
        finale: { title: "Whatever you said,", letter: "You don't owe this page an answer. You never will.\n\nI only wanted you to know, completely and in writing, how I feel about you. That part won't change.\n\nThank you for reading all the way to the end.", sign: "Always yours, {from}" } },
      { id: "love", label: "I want to express my love", blurb: "Letters, flowers and everything you feel, said plainly.", ambience: "fireflies",
        sections: standard("letters", "compliments", "bouquet", "gallery", "secrets", "questions"), questions: pick("romantic", [1, 2, 3, 5, 8, 9, 10]),
        opening: { kicker: "This has your name on it", greeting: "Hello, my love.", message: "Consider this a long love letter that got out of hand. Everything in here is about you." },
        compliments: ["I love you in the big ways, and in the way I save you the last bite."],
        finale: { title: "So that's the whole of it.", letter: "I love you, {name}. On the good days and the loud days and the days neither of us can explain.\n\nI wanted you to have that somewhere you can come back to.", sign: "Yours, {from}" } },
      { id: "compliment", label: "I want to compliment them", blurb: "A slow parade of everything you adore.", ambience: "petals",
        sections: standard("compliments", "gallery", "bouquet", "secrets", "quiz"), questions: pick("romantic", [2, 3, 9]),
        opening: { kicker: "A short list, getting longer", greeting: "Hi, you.", message: "It's come to my attention that nobody has told you how wonderful you are today. I've taken care of this." },
        compliments: ["You walked in, and I forgot what I was saying. It's been happening for a while.", "Your mind is one of my favourite places to spend time."],
        finale: { title: "In conclusion,", letter: "You're wonderful. I've checked this thoroughly.\n\nThe list goes on, but the page had to end somewhere.", sign: "Your biggest fan, {from}" } },
      { id: "celebrate", label: "I want to celebrate our relationship", blurb: "Your story so far, and everything still to come.", ambience: "fireflies",
        sections: standard("gallery", "letters", "compliments", "quiz", "questions", "bouquet"), questions: pick("romantic", [1, 5, 6, 8, 9]),
        opening: { kicker: "Look how far we've come", greeting: "Happy us, {name}.", message: "I went back through everything to make this. It turns out we have been very lucky, and also quite silly." },
        compliments: ["If I could go back, I'd find you sooner, and I'd still be late for our first date."],
        finale: { title: "Here's to the next part.", letter: "Of everything I've done, choosing you remains the thing I'm surest about.\n\nThank you for all of it so far. I can't wait for what we haven't done yet.", sign: "Still choosing you, {from}" } },
      { id: "smile", label: "I just want to make them smile", blurb: "Light, sweet, and over before the kettle boils.", ambience: "petals",
        sections: standard("compliments", "bouquet", "secrets"), questions: pick("romantic", [2, 4]),
        opening: { kicker: "No reason at all", greeting: "Oh, hello, {name}.", message: "There's no occasion. I saw something silly today and thought of you, so now you're getting flowers." },
        compliments: ["This has been a formal reminder that I think you're adorable."],
        finale: { title: "That's all.", letter: "Now go and have a nice day. That's an order.\n\nAlso, text me. I already miss you, and it's embarrassing.", sign: "{from}" } },
      { id: "unsaid", label: "I want to say something I've never said", blurb: "A careful place for words you've been carrying.", ambience: "stars",
        sections: standard("letters", "secrets", "compliments", "questions"), questions: pick("romantic", [3, 7, 8, 10]),
        opening: { kicker: "This took me a while", greeting: "{name},", message: "There's something I've been carrying for a long time. It felt safer to write it down, so that I wouldn't get it wrong. Read it whenever you're ready." },
        compliments: ["It's easier to write this than to say it: you matter to me more than I've been able to show."],
        finale: { title: "Now you know.", letter: "You don't need to do anything with this. I just didn't want to go on without having said it.\n\nThank you for reading.", sign: "{from}" } },
    ],
    bestie: [
      { id: "appreciation", label: "A best friend appreciation page", blurb: "A loving, slightly rude tribute.", ambience: "confetti",
        sections: standard("compliments", "gallery", "bouquet", "quiz", "questions", "secrets"), questions: pick("bestie", [1, 7, 9, 13, 15]),
        opening: { kicker: "Official notice of appreciation", greeting: "Listen up, {name}.", message: "It has been decided, by me, that you deserve an entire website. Do not let this go to your head. It will, but try." },
        compliments: ["Having you as my best friend is the only thing I've ever done on purpose."],
        finale: { title: "Anyway, I love you.", letter: "That's the serious part over with. We will never speak of this again.\n\nThanks for being my person, you absolute menace.", sign: "Yours unfortunately, {from}" } },
      { id: "chaos", label: "A funny and chaotic experience", blurb: "Maximum nonsense, minimum dignity.", ambience: "confetti",
        sections: standard("quiz", "compliments", "secrets", "questions", "gallery"), questions: pick("bestie", [2, 3, 4, 5, 11, 12]),
        opening: { kicker: "Warning: contains evidence", greeting: "OH. It's you.", message: "Congratulations, {name}. You have been legally summoned to this website. Do not attempt to leave. We have your photos." },
        compliments: ["You have the survival instincts of a pigeon and the confidence of a king. Inspirational."],
        finale: { title: "You survived.", letter: "Somehow. Against all advice.\n\nNow go and tell me which question offended you the most, because I wrote it on purpose.", sign: "Your problem, {from}" } },
      { id: "birthday", label: "A birthday surprise", blurb: "Another year older, sadly no wiser.", ambience: "confetti",
        sections: standard("compliments", "gallery", "bouquet", "letters", "questions"), questions: pick("bestie", [9, 14, 15], ["What's the one thing I must do for your birthday this year?"]),
        opening: { kicker: "It's your birthday", greeting: "Happy birthday, {name}!", message: "Yes, I remembered. No, I didn't need a reminder. Okay, one reminder. Open your present." },
        compliments: ["You've aged like an excellent cheese: stronger, a little alarming, and always the best thing at the party."],
        finale: { title: "Make a wish.", letter: "Here's to another year of you being my favourite person to be stupid with.\n\nCake is on me. So is whatever happens after the cake.", sign: "Happy birthday from {from}" } },
      { id: "letter", label: "A friendship appreciation letter", blurb: "The sincere one. You'll deny it later.", ambience: "petals",
        sections: standard("letters", "gallery", "compliments", "bouquet"), questions: pick("bestie", [7, 10, 13]),
        opening: { kicker: "Please sit down for this", greeting: "Dear {name},", message: "I'm going to be sincere for about three minutes. Please don't make it weird. I'm already making it weird." },
        compliments: ["I don't know who I'd have been without you, and I'm glad I never have to find out."],
        finale: { title: "That's me done.", letter: "You've been there for all of it. The stupid parts and the really bad parts.\n\nThank you, truly. You can go back to making fun of me now.", sign: "Love, {from}" } },
      { id: "deep", label: "A deep friendship questionnaire", blurb: "All the questions you've never actually asked.", ambience: "stars",
        sections: standard("questions", "secrets", "compliments"), questions: pick("bestie", [1, 2, 6, 7, 8, 9, 10, 13, 14, 15]),
        opening: { kicker: "A very serious investigation", greeting: "Okay, {name}.", message: "We've been friends for ages and I still have questions. Answer as honestly as you can. I'll find out if you don't." },
        compliments: ["Nobody knows me as well as you do. It's frankly a security risk."],
        finale: { title: "Thanks for telling me.", letter: "Whatever you wrote, I'm going to read it carefully and then probably bring it up at the worst possible time.\n\nThat's friendship.", sign: "{from}" } },
      { id: "smile", label: "Just something to make them smile", blurb: "A little ridiculous gift for no reason.", ambience: "confetti",
        sections: standard("compliments", "bouquet", "secrets"), questions: pick("bestie", [3, 12]),
        opening: { kicker: "No occasion", greeting: "Hi, loser.", message: "I thought you might need this today. If you don't, keep it for later. You will." },
        compliments: ["You're doing great. Well, you're doing. That's enough."],
        finale: { title: "Okay, bye.", letter: "That's it. That was the whole thing.\n\nNow send me something stupid.", sign: "{from}" } },
    ],
    friend: [
      { id: "appreciation", label: "A thoughtful appreciation page", blurb: "A gentle thank-you for being around.", ambience: "pollen",
        sections: standard("compliments", "gallery", "bouquet", "questions"), questions: pick("friend", [1, 4, 8]),
        opening: { kicker: "Just so you know", greeting: "Hello, {name}.", message: "I don't think I've ever properly said how glad I am that you're my friend. So I've made you something small." },
        compliments: ["You've made more of a difference than you've ever been told."],
        finale: { title: "That's all I wanted to say.", letter: "Thank you for being such a good friend. It's the sort of thing that doesn't get said enough, so here it is, in writing.", sign: "Your friend, {from}" } },
      { id: "birthday", label: "A birthday surprise", blurb: "A bright little celebration of them.", ambience: "confetti",
        sections: standard("compliments", "bouquet", "gallery", "questions"), questions: pick("friend", [1, 3, 7], ["What would make this your best year yet?"]),
        opening: { kicker: "Today is your day", greeting: "Happy birthday, {name}!", message: "A very happy birthday to one of my favourite people. I've brought flowers, and you don't even have to water them." },
        compliments: ["The world's been a bit nicer since you turned up in it."],
        finale: { title: "Have a wonderful year.", letter: "May this year be kind to you, and bring you far more than you asked for.\n\nHappy birthday, my friend.", sign: "With love, {from}" } },
      { id: "funny", label: "A funny friendship experience", blurb: "Silly questions and light teasing.", ambience: "confetti",
        sections: standard("quiz", "compliments", "questions", "secrets"), questions: pick("friend", [2, 3, 5, 6]),
        opening: { kicker: "An important survey", greeting: "Good day, {name}.", message: "You've been selected for a very official friendship assessment. There are no wrong answers, but there are funny ones." },
        compliments: ["You're the only person whose bad opinions I enjoy hearing."],
        finale: { title: "Assessment complete.", letter: "The results are in. You passed. There was never any doubt, though I did consider it.\n\nLet's catch up soon.", sign: "Chief assessor, {from}" } },
      { id: "letter", label: "A personalized letter", blurb: "One proper, heartfelt letter.", ambience: "pollen",
        sections: standard("letters", "gallery", "bouquet"), questions: pick("friend", [8]),
        opening: { kicker: "A letter, for you", greeting: "Dear {name},", message: "People hardly ever write letters any more. You deserve one, so here it is." },
        compliments: ["It's good to have a friend who stays."],
        finale: { title: "Until next time.", letter: "Thanks for reading all that. Write back, or better still, let's meet up.", sign: "Yours, {from}" } },
      { id: "compliments", label: "A collection of compliments", blurb: "A whole bouquet of nice things.", ambience: "petals",
        sections: standard("compliments", "bouquet", "secrets"), questions: pick("friend", [1]),
        opening: { kicker: "An overdue delivery", greeting: "For you, {name}.", message: "Here's a collection of perfectly true things about you, which you're not allowed to argue with." },
        compliments: ["Your kindness is the kind that doesn't check whether anyone's looking.", "You have very good taste. Evidence: this friendship."],
        finale: { title: "All true.", letter: "Every word of it. Come back and read them on a day when you need to.", sign: "{from}" } },
    ],
    mom: [
      { id: "appreciation", label: "A mother's appreciation page", blurb: "Everything that deserves to be said to her.", ambience: "petals",
        sections: standard("compliments", "gallery", "letters", "bouquet", "questions"), questions: pick("mom", [3, 4, 6, 9]),
        opening: { kicker: "This is for you", greeting: "Dear {name},", message: "You've done so much for me that I couldn't fit it in a card, so I made you this instead. Please sit down and enjoy it. Everything else can wait." },
        compliments: ["The older I get, the more I understand how much you did."],
        finale: { title: "Thank you, for all of it.", letter: "No page could ever hold everything you've given me.\n\nI hope that today you feel even a small part of how much you are loved.", sign: "Your {from}" } },
      { id: "birthday", label: "A birthday surprise", blurb: "A warm celebration of her day.", ambience: "petals",
        sections: standard("bouquet", "compliments", "gallery", "questions"), questions: pick("mom", [3, 5, 7]),
        opening: { kicker: "It's your special day", greeting: "Happy birthday, {name}.", message: "Today nobody needs anything from you. There's nothing to cook and nothing to organise. These flowers are for you." },
        compliments: ["You make every year better for everyone around you."],
        finale: { title: "To many more.", letter: "I hope this year gives back to you a little of what you've given to all of us.\n\nHappy birthday. I love you.", sign: "With all my love, {from}" } },
      { id: "thanks", label: "A thank-you letter", blurb: "A long-overdue thank you, in writing.", ambience: "petals",
        sections: standard("letters", "compliments", "bouquet"), questions: pick("mom", [2, 9]),
        opening: { kicker: "Long overdue", greeting: "Dear {name},", message: "I've said thank you a thousand times without really saying what for. So let me try it properly." },
        compliments: ["Thank you for the things I didn't even realise you were doing."],
        finale: { title: "Thank you.", letter: "For all of it: the days I remember, and the many more that I don't.\n\nThank you, thank you, thank you.", sign: "Your grateful {from}" } },
      { id: "memories", label: "Beautiful family memories", blurb: "A memory album, with notes in the margins.", ambience: "petals",
        sections: standard("gallery", "letters", "questions", "compliments"), questions: pick("mom", [1, 8, 10]),
        opening: { kicker: "From the family album", greeting: "Remember these, {name}?", message: "I went looking through our old photographs, and they made me want to thank you all over again." },
        compliments: ["Every happy memory I have seems to have you somewhere in the background, making it possible."],
        finale: { title: "More to come.", letter: "There are still so many photographs we haven't taken yet.\n\nLet's go and make some more.", sign: "{from}" } },
      { id: "love", label: "A collection of things I love about you", blurb: "A long and loving list.", ambience: "petals",
        sections: standard("compliments", "secrets", "bouquet", "gallery"), questions: pick("mom", [3, 9]),
        opening: { kicker: "Things I love about you", greeting: "For you, {name}.", message: "I started making a list of the things I love about you. It got long. Here's the beginning of it." },
        compliments: ["I love how you still ask whether I've eaten.", "I love the way you make any place feel like home."],
        finale: { title: "And there's more.", letter: "That was only the beginning of the list. I'll keep telling you the rest in person.", sign: "With love, {from}" } },
    ],
    dad: [
      { id: "appreciation", label: "A father's appreciation page", blurb: "Everything he'd wave away if you said it aloud.", ambience: "stars",
        sections: standard("compliments", "gallery", "letters", "bouquet", "questions"), questions: pick("dad", [3, 5, 6, 10]),
        opening: { kicker: "This is for you", greeting: "Dear {name},", message: "We don't always say these things out loud, so I've put them in writing. You can't change the subject on a web page." },
        compliments: ["I've understood more about you with every year I've grown up."],
        finale: { title: "Thanks, for everything.", letter: "You've done more for me than I will ever fully know.\n\nI'm proud of you, too. I thought you should hear that.", sign: "Your {from}" } },
      { id: "birthday", label: "A birthday surprise", blurb: "A proper tribute, quietly done.", ambience: "stars",
        sections: standard("compliments", "bouquet", "gallery", "questions"), questions: pick("dad", [1, 6, 9]),
        opening: { kicker: "Many happy returns", greeting: "Happy birthday, {name}.", message: "I know you said you didn't want anything. You should have known better. Sit down, this won't take long." },
        compliments: ["You make getting older look like something worth doing."],
        finale: { title: "To another good year.", letter: "I hope this one's full of good days, and a little less work.\n\nHappy birthday.", sign: "With love, {from}" } },
      { id: "thanks", label: "A thank-you letter", blurb: "A straightforward, heartfelt thank you.", ambience: "stars",
        sections: standard("letters", "compliments", "bouquet"), questions: pick("dad", [3, 7]),
        opening: { kicker: "Something I should say more", greeting: "Dear {name},", message: "I don't think I've ever thanked you properly. Here's my attempt, and I'd appreciate it if you read all of it." },
        compliments: ["Thank you for every time you put us first and never mentioned it."],
        finale: { title: "Thank you.", letter: "That's what it comes down to, in the end. Thank you, for all of it.", sign: "Your {from}" } },
      { id: "memories", label: "Beautiful family memories", blurb: "The good old days, with captions.", ambience: "stars",
        sections: standard("gallery", "letters", "questions", "compliments"), questions: pick("dad", [1, 8, 9]),
        opening: { kicker: "From the old days", greeting: "Remember these, {name}?", message: "I've been going through old photographs. You had some interesting hair. Here are the best of them." },
        compliments: ["So many of my favourite memories are just days out with you."],
        finale: { title: "More to come.", letter: "We've had some good days, you and I. Let's have some more of them.", sign: "{from}" } },
      { id: "admire", label: "A collection of things I admire about you", blurb: "A plain list of what you look up to.", ambience: "stars",
        sections: standard("compliments", "secrets", "bouquet", "gallery"), questions: pick("dad", [5, 7]),
        opening: { kicker: "Things I admire about you", greeting: "For you, {name}.", message: "I've been meaning to tell you what I admire about you. You'd only argue, so I made a list." },
        compliments: ["I admire your patience. I know I tested it.", "I admire how you do the right thing even when no one would know."],
        finale: { title: "That's the list.", letter: "It's not a complete list. It's just what I could write down without getting too emotional.", sign: "With respect and love, {from}" } },
    ],
  };

  const TITLES = {
    partner: { compliments: "What I keep noticing", gallery: "Us, so far", letters: "For the days ahead", bouquet: "These are for you", secrets: "Things I've never said", questions: "Tell me something" },
    bestie: { compliments: "Evidence you're okay, I guess", gallery: "Exhibit A: us", letters: "Emergency letters", bouquet: "Flowers. Don't get weird.", secrets: "Classified files", questions: "Interrogation time" },
    friend: { compliments: "A few true things", gallery: "Good days", letters: "Little letters", bouquet: "Picked for you", secrets: "Small secrets", questions: "Tell me about you" },
    mom: { compliments: "What I love about you", gallery: "From our album", letters: "Letters for you", bouquet: "For you, always", secrets: "What I never told you", questions: "I've always wanted to ask" },
    dad: { compliments: "What I admire", gallery: "The family record", letters: "A few letters", bouquet: "Yes, flowers", secrets: "Between you and me", questions: "A few questions" },
  };

  const SECTION_LABELS = {
    opening: "Opening message", compliments: "Compliments", gallery: "Photo memories", letters: "Personal letters", bouquet: "Virtual bouquet",
    secrets: "Secret messages", questions: "Questions", quiz: "A little quiz", proposal: "The big question", finale: "Final letter",
  };
  const ALL_SECTIONS = Object.keys(SECTION_LABELS);

  const PROPOSAL = {
    direct: {
      lead: "I've thought about how to ask you this for a very long time.",
      lines: ["I don't want a grand speech.", "I want the ordinary days.", "I want all of them, with you."],
      question: "{name}, will you marry me?",
      yes: "Yes", time: "I need a little time", talk: "Let's talk about this together",
      after: { yes: "You just made me the happiest person alive. I'm on my way.", time: "Of course. Take all the time you need. Nothing changes between us.", talk: "I'd love that. Thank you for telling me. Let's talk soon." },
    },
    gentle: {
      lead: "There's something I've been wanting to ask you. It isn't a big scary question.",
      lines: ["I like who I am with you.", "I like who we are together.", "I'd like to keep going, for as long as you'll have me."],
      question: "{name}, can I keep choosing you?",
      yes: "Yes, always", time: "Let me think about it", talk: "Let's talk about it together",
      after: { yes: "That's all I wanted to hear. I'll be choosing you tomorrow too.", time: "Of course. There's no rush at all. I'll still be here.", talk: "I'd love that. Whenever you're ready." },
    },
  };

  const BOUQUET = {
    kinds: {
      redrose: { label: "Red roses", colors: ["#A3243B", "#7D1A2C", "#C2404F"] },
      pinkrose: { label: "Pink roses", colors: ["#E58CA0", "#F2B5C1", "#CE6B84"] },
      tulip: { label: "Tulips", colors: ["#E2607B", "#F2A541", "#F7F0DF", "#8E5BB5"] },
      sunflower: { label: "Sunflowers", colors: ["#F2B632", "#E8912D"] },
      daisy: { label: "Daisies", colors: ["#FFFDF6", "#F8D7E2", "#CBDDF5"] },
      lily: { label: "Lilies", colors: ["#FBF6EC", "#F7C9C9", "#F6C57A"] },
      lavender: { label: "Lavender", colors: ["#8F79C6", "#B3A0DE"] },
      mixed: { label: "Mixed bouquet", colors: ["#E58CA0"] },
    },
    wraps: { kraft: { label: "Kraft paper", a: "#C69C6D", b: "#B08755" }, blush: { label: "Blush tissue", a: "#F3D4C5", b: "#E9BFB0" }, ivory: { label: "Ivory linen", a: "#FAF3E3", b: "#EDE2CB" }, sage: { label: "Sage paper", a: "#C9D5BC", b: "#AFBFA0" }, navy: { label: "Midnight paper", a: "#27395A", b: "#1C2B46" }, burgundy: { label: "Burgundy silk", a: "#6B2438", b: "#551A2B" } },
    ribbons: { satin: { label: "Satin bow", color: "#A3243B" }, velvet: { label: "Velvet band", color: "#22314E" }, twine: { label: "Rustic twine", color: "#8A6A42" }, gingham: { label: "Gingham", color: "#7E9B79" }, lace: { label: "Lace ribbon", color: "#F5EDE0" }, gold: { label: "Thin gold", color: "#C69A3E" } },
    anims: { bloom: "Slow bloom", unwrap: "Unwrap, then bloom", rain: "Petal storm" },
  };

  const GALLERY_LAYOUTS = { polaroid: "Polaroid collage", filmstrip: "Film strip", wall: "Memory wall", fullscreen: "Full-screen gallery", scrapbook: "Scrapbook" };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const relationshipIds = Object.keys(RELATIONSHIPS);
  const intentFor = (rel, id) => (INTENTS[rel] || []).find((i) => i.id === id) || null;

  function questionsFor(rel, intent) {
    const def = intent.questions;
    const bank = BANKS[def.bank];
    const out = def.list.map((n) => ({ id: `${def.bank.slice(0, 3)}${n}`, q: bank[n - 1], type: "text", options: [], on: true }));
    def.extra.forEach((q, i) => out.push({ id: `x${i + 1}`, q, type: "text", options: [], on: true }));
    CHOICES[rel].forEach((c, i) => out.push({ id: `c${i + 1}`, q: c.q, type: "choice", options: c.options.slice(), on: true }));
    return out;
  }

  // everything in the bank, offered to creators who want to add more questions
  const bankFor = (rel) => (rel === "partner" ? [...BANKS.romantic, ...BANKS.proposal] : BANKS[rel]).slice();

  function build(relationship, intentId, opts = {}) {
    const rel = RELATIONSHIPS[relationship] ? relationship : "friend";
    const intent = intentFor(rel, intentId) || INTENTS[rel][0];
    const base = BASE[rel], theme = THEMES[RELATIONSHIPS[rel].theme];
    const order = intent.sections.filter((s, i, a) => a.indexOf(s) === i);
    const usable = ALL_SECTIONS.filter((s) => s !== "proposal" || intent.id === "propose");
    const sections = [...order.map((id) => ({ id, on: true })), ...usable.filter((s) => !order.includes(s)).map((id) => ({ id, on: false }))];
    const quiz = clone(QUIZ[rel]);
    const flower = theme.flower;
    const count = rel === "partner" ? 12 : rel === "dad" ? 5 : 7;
    return {
      relationship: rel,
      intent: intent.id,
      gender: ["female", "male", "unspecified"].includes(opts.gender) ? opts.gender : "unspecified",
      recipientName: opts.recipientName || "",
      fromName: opts.fromName || "",
      proposalMode: opts.proposalMode === "gentle" ? "gentle" : "direct",
      ambience: intent.ambience || theme.ambience,
      titles: clone(TITLES[rel]),
      sections,
      opening: clone(intent.opening),
      compliments: [...intent.compliments, ...base.compliments],
      questions: questionsFor(rel, intent),
      quiz: { title: quiz.title, questions: quiz.questions.map((q) => ({ q: q.q, options: q.options.map(([t, k]) => ({ t, k })) })), results: quiz.results },
      gallery: { layout: rel === "bestie" ? "scrapbook" : rel === "partner" ? "fullscreen" : rel === "dad" ? "filmstrip" : "polaroid", slideshow: false, previewCover: false, coverId: "", photos: [] },
      letters: clone(base.letters).map((l) => ({ ...l, photoId: "" })),
      bouquet: { kind: flower, color: BOUQUET.kinds[flower].colors[0], wrap: theme.wrap, ribbon: theme.ribbon, count, anim: rel === "partner" ? "unwrap" : rel === "bestie" ? "rain" : "bloom", note: "These won't wilt. I checked.", messages: clone(base.messages) },
      secrets: clone(base.secrets),
      proposal: clone(PROPOSAL[opts.proposalMode === "gentle" ? "gentle" : "direct"]),
      finale: clone(intent.finale),
    };
  }

  const PRONOUNS = {
    female: { they: "she", them: "her", their: "her", They: "She", Their: "Her" },
    male: { they: "he", them: "him", their: "his", They: "He", Their: "His" },
    unspecified: { they: "they", them: "them", their: "their", They: "They", Their: "Their" },
  };
  function fill(text, env) {
    const p = PRONOUNS[env?.gender] || PRONOUNS.unspecified;
    return String(text ?? "")
      .replace(/\{name\}/g, env?.recipientName || "you")
      .replace(/\{from\}/g, env?.fromName || "me")
      .replace(/\{they\}/g, p.they).replace(/\{them\}/g, p.them).replace(/\{their\}/g, p.their).replace(/\{They\}/g, p.They).replace(/\{Their\}/g, p.Their);
  }

  const api = { RELATIONSHIPS, THEMES, INTENTS, BANKS, QUIZ, PROPOSAL, BOUQUET, GALLERY_LAYOUTS, SECTION_LABELS, ALL_SECTIONS, relationshipIds, intentFor, build, bankFor, fill };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LW_CATALOG = api;
})(typeof window !== "undefined" ? window : globalThis);
