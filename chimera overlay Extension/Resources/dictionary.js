// dictionary.js
// Global dictionary for Safari Web Extension
// Schema:
//   translation: what it means (English)
//   context: a short natural example that shows how it’s used (EN + ZH in one line)

window.DICTIONARY = {
  // ───────── Pronouns / possession
  "i": {
    pinyin: "wǒ",
    translation: "I / me",
    context: "I like tea. — Wǒ xǐhuān chá. (我喜欢茶)"
  },
  "me": {
    pinyin: "wǒ",
    translation: "me",
    context: "He saw me. — Tā kànjiàn wǒ. (他看见我)"
  },
  "you": {
    pinyin: "nǐ",
    translation: "you",
    context: "Do you want it? — Nǐ yào ma? (你要吗)"
  },
  "he": {
    pinyin: "tā",
    translation: "he",
    context: "He is my friend. — Tā shì wǒ de péngyou. (他是我的朋友)"
  },
  "she": {
    pinyin: "tā",
    translation: "she",
    context: "She is a student. — Tā shì xuéshēng. (她是学生)"
  },
  "we": {
    pinyin: "wǒmen",
    translation: "we / us",
    context: "We are going. — Wǒmen zǒu. (我们走)"
  },
  "they": {
    pinyin: "tāmen",
    translation: "they / them",
    context: "They are here. — Tāmen zài zhèlǐ. (他们在这里)"
  },
  "my": {
    pinyin: "wǒ de",
    translation: "my",
    context: "My phone. — Wǒ de shǒujī. (我的手机)"
  },
  "your": {
    pinyin: "nǐ de",
    translation: "your",
    context: "Your name? — Nǐ de míngzi ne? (你的名字呢)"
  },

  // ───────── Degree / discourse
  "very": {
    pinyin: "hěn",
    translation: "very",
    context: "Very good. — Hěn hǎo. (很好)"
  },
  "too": {
    pinyin: "tài",
    translation: "too (excessively) / super",
    context: "Too expensive. — Tài guì le. (太贵了)"
  },
  "also": {
    pinyin: "yě",
    translation: "also",
    context: "I also want it. — Wǒ yě yào. (我也要)"
  },
  "only": {
    pinyin: "zhǐ",
    translation: "only",
    context: "Only you. — Zhǐ yǒu nǐ. (只有你)"
  },
  "just": {
    pinyin: "jiù",
    translation: "just / then (often emphasis)",
    context: "Then do it. — Jiù zhème zuò. (就这么做)"
  },
  "already": {
    pinyin: "yǐjīng",
    translation: "already",
    context: "I already ate. — Wǒ yǐjīng chī le. (我已经吃了)"
  },
  "still": {
    pinyin: "hái",
    translation: "still",
    context: "Still not done. — Hái méi zuò wán. (还没做完)"
  },
  "again": {
    pinyin: "zài",
    translation: "again",
    context: "Say it again. — Zài shuō yíbiàn. (再说一遍)"
  },

  // ───────── Existence / negation
  "have": {
    pinyin: "yǒu",
    translation: "have / there is",
    context: "Do you have time? — Nǐ yǒu shíjiān ma? (你有时间吗)"
  },
  "not": {
    pinyin: "bù",
    translation: "not",
    context: "I don’t know. — Wǒ bù zhīdào. (我不知道)"
  },
  "never": {
    pinyin: "cóng bù",
    translation: "never",
    context: "I never smoke. — Wǒ cóng bù chōuyān. (我从不抽烟)"
  },

  // ───────── Location
  "here": {
    pinyin: "zhèlǐ",
    translation: "here",
    context: "Come here. — Lái zhèlǐ. (来这里)"
  },
  "there": {
    pinyin: "nàlǐ",
    translation: "there",
    context: "Over there. — Zài nàlǐ. (在那里)"
  },

  // ───────── Question words (context shows real placement)
  "what": {
    pinyin: "shénme",
    translation: "what",
    context: "What do you want? — Nǐ xiǎng yào shénme? (你想要什么)"
  },
  "where": {
    pinyin: "nǎlǐ",
    translation: "where",
    context: "Where are you going? — Nǐ qù nǎlǐ? (你去哪里)"
  },
  "who": {
    pinyin: "shéi",
    translation: "who",
    context: "Who is he? — Tā shì shéi? (他是谁)"
  },
  "how": {
    pinyin: "zěnme",
    translation: "how",
    context: "How do I do this? — Zhège zěnme zuò? (这个怎么做)"
  },
  "why": {
    pinyin: "wèishénme",
    translation: "why",
    context: "Why are you late? — Nǐ wèishénme chídào? (你为什么迟到)"
  },
  "when": {
    pinyin: "shénme shíhou",
    translation: "when",
    context: "When are you coming? — Nǐ shénme shíhou lái? (你什么时候来)"
  },

  // ───────── Simple answers / demonstratives
  "yes": {
    pinyin: "shì",
    translation: "yes / is (sometimes)",
    context: "Yes, I am. — Shì, wǒ shì. (是，我是)"
  },
  "no": {
    pinyin: "bù",
    translation: "no / not",
    context: "No, I’m not. — Bù, wǒ bú shì. (不，我不是)"
  },
  "this": {
    pinyin: "zhè",
    translation: "this",
    context: "This one. — Zhè ge. (这个)"
  },
  "that": {
    pinyin: "nà",
    translation: "that (demonstrative)",
    context: "That one. — Nà ge. (那个)"
  }
};
