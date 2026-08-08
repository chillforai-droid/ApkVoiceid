export interface BlogPost {
  slug: string;
  title: string;
  metaDescription: string;
  cluster: string;
  clusterSlug: string;
  date: string; // ISO
  author: string;
  paragraphs: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'why-your-phone-number-is-not-a-safe-identity',
    title: 'Why Your Phone Number Is Not a Safe Identity',
    metaDescription: 'Phone numbers were never designed to be a security credential. Here is why relying on them for identity puts your accounts at risk.',
    cluster: 'Secure Messaging',
    clusterSlug: 'secure-messaging',
    date: '2026-07-25',
    author: 'VoiceID Team',
    paragraphs: [
      'Phone numbers were never designed for the internet age. They were built for basic circuit-switched telephone networks in the mid-20th century. Today, they are a massive security liability.',
      'SIM swapping attacks, SMS interception, and poor authentication practices mean your phone number is one of the easiest ways for hackers to gain access to your accounts. At VoiceID, we are pioneering a new approach: identity based on a username you control, not telecommunication infrastructure.',
      'Because a phone number is reassigned, ported, and resold across carriers, it makes a poor long-term identifier. A username-based identity removes that dependency entirely, so switching carriers or losing a SIM card never puts your conversations at risk.',
    ],
  },
  {
    slug: 'introducing-secure-end-to-end-encryption-on-voiceid',
    title: 'Introducing Secure End-to-End Encryption on VoiceID',
    metaDescription: 'All communication on VoiceID — text, voice notes, and calls — is now protected by end-to-end encryption. Here is what that means for you.',
    cluster: 'Private Communication',
    clusterSlug: 'private-communication',
    date: '2026-06-15',
    author: 'VoiceID Team',
    paragraphs: [
      'Privacy is not just a feature at VoiceID; it is the core of our business model. All communications on our platform — text, voice, and calls — are protected by end-to-end encryption.',
      'This means that only the sender and the intended recipient can read or listen to the communication. We have built our architecture to be zero-knowledge by design, so you remain in control of your data.',
      'End-to-end encryption is a technical foundation, not a marketing checkbox. It shapes how every feature on VoiceID — from voice notes to calling — is built from the ground up.',
    ],
  },
  {
    slug: 'the-future-of-decentralized-communication',
    title: 'The Future of Decentralized Communication',
    metaDescription: 'How decentralized identity systems can reduce reliance on big tech and give people more control over their own data.',
    cluster: 'Private Communication',
    clusterSlug: 'private-communication',
    date: '2026-05-10',
    author: 'VoiceID Team',
    paragraphs: [
      'We explore how decentralized identity systems can reduce our reliance on big tech, restore data sovereignty, and build a more resilient internet ecosystem.',
      'A username-based identity is one small but meaningful step toward that future: it separates who you are online from the telecom infrastructure that traditionally defined your digital identity.',
    ],
  },
  {
    slug: 'how-sim-swapping-attacks-work-and-how-to-avoid-them',
    title: 'How SIM Swapping Attacks Work — And How to Avoid Them',
    metaDescription: 'A plain-language breakdown of SIM swapping attacks, why phone-number-based accounts are vulnerable, and how to reduce your exposure.',
    cluster: 'Secure Messaging',
    clusterSlug: 'secure-messaging',
    date: '2026-07-10',
    author: 'VoiceID Team',
    paragraphs: [
      'A SIM swap attack happens when someone convinces your mobile carrier to transfer your phone number to a SIM card they control. Once that happens, any account that uses your number for verification or recovery can be compromised.',
      'The reason this attack works so well is simple: phone numbers were never meant to be a security credential. They are a routing address for a telecom network, not a cryptographic identity.',
      'Reducing your exposure means limiting how many accounts are tied to your phone number in the first place. Messaging platforms that use a username-based identity, like VoiceID, remove this single point of failure for your conversations.',
    ],
  },
  {
    slug: 'anonymous-vs-private-understanding-the-difference',
    title: 'Anonymous vs. Private: Understanding the Difference',
    metaDescription: 'Anonymous and private are not the same thing. Here is how VoiceID thinks about the distinction — and why it matters for how you communicate.',
    cluster: 'Private Communication',
    clusterSlug: 'private-communication',
    date: '2026-07-02',
    author: 'VoiceID Team',
    paragraphs: [
      'People often use "anonymous" and "private" interchangeably, but they describe very different things. Anonymity means no one knows who you are. Privacy means the content of your communication is protected, even if your identity is known to the people you\u2019re talking to.',
      'VoiceID is built around privacy, not anonymity. You still have a persistent identity — your username — but your conversations are end-to-end encrypted and your phone number is never required or exposed.',
      'This distinction matters because most people don\u2019t want to disappear from the people they talk to; they want their conversations to stay between the people involved.',
    ],
  },
  {
    slug: 'why-voice-messages-are-taking-over-text-based-chat',
    title: 'Why Voice Messages Are Taking Over Text-Based Chat',
    metaDescription: 'Voice notes convey tone and nuance faster than typing. Here is why voice messaging is becoming the default for quick, personal communication.',
    cluster: 'Voice Messages',
    clusterSlug: 'voice-messages',
    date: '2026-06-28',
    author: 'VoiceID Team',
    paragraphs: [
      'Typing a thoughtful message takes time, and text alone strips out tone, emphasis, and warmth. Voice messages solve both problems: they are faster to record than to type, and they carry the nuance that text can\u2019t.',
      'On VoiceID, voice notes are treated as a first-class part of the conversation, protected by the same end-to-end encryption as text, so speed doesn\u2019t come at the cost of privacy.',
    ],
  },
  {
    slug: 'are-voice-messages-more-secure-than-text',
    title: 'Are Voice Messages More Secure Than Text? Here\u2019s the Truth',
    metaDescription: 'Voice messages are not automatically more secure than text — encryption is what matters. Here is how VoiceID protects both equally.',
    cluster: 'Voice Messages',
    clusterSlug: 'voice-messages',
    date: '2026-06-05',
    author: 'VoiceID Team',
    paragraphs: [
      'It\u2019s a common assumption that voice messages are inherently harder to intercept than text. In reality, security comes from encryption, not the format of the message.',
      'On VoiceID, voice notes are encrypted end-to-end using the same protections as text messages, so neither format is a weaker link than the other.',
    ],
  },
  {
    slug: 'the-evolution-of-online-chat-from-irc-to-modern-messengers',
    title: 'The Evolution of Online Chat: From IRC to Modern Messengers',
    metaDescription: 'A brief history of online chat — from early IRC networks to today\u2019s encrypted, real-time messaging platforms.',
    cluster: 'Online Chat',
    clusterSlug: 'online-chat',
    date: '2026-05-22',
    author: 'VoiceID Team',
    paragraphs: [
      'Online chat has come a long way from IRC channels and early instant messengers. What started as plain-text protocols with no privacy guarantees has evolved into real-time, richly featured platforms.',
      'The biggest shift hasn\u2019t been speed — it\u2019s trust. Modern users expect their conversations to be encrypted by default, synced across devices, and free from unnecessary data collection. That expectation is what shapes how VoiceID approaches online chat today.',
    ],
  },
  {
    slug: 'why-browser-based-messaging-apps-are-gaining-ground',
    title: 'Why Browser-Based Messaging Apps Are Gaining Ground',
    metaDescription: 'No download, no app store, no storage footprint. Here is why browser-based messengers are becoming a practical choice for everyday communication.',
    cluster: 'Browser Messaging',
    clusterSlug: 'browser-messaging',
    date: '2026-04-30',
    author: 'VoiceID Team',
    paragraphs: [
      'Installing an app used to be the only way to get a fast, reliable messaging experience. Modern browsers have changed that. A well-built web app can now deliver real-time messaging, voice notes, and calling without ever touching an app store.',
      'VoiceID runs entirely in the browser, and can be installed to your home screen as a Progressive Web App when you want an app-like experience — without the storage footprint of a native install.',
    ],
  },
  {
    slug: 'what-makes-a-messaging-platform-feel-real-time',
    title: 'What Makes a Messaging Platform Feel "Real-Time"?',
    metaDescription: 'Instant delivery, live presence, and typing indicators all combine to create the feeling of real-time messaging. Here is what is happening under the hood.',
    cluster: 'Real-Time Messaging',
    clusterSlug: 'real-time-messaging',
    date: '2026-04-12',
    author: 'VoiceID Team',
    paragraphs: [
      'A messaging platform feels real-time when messages, presence, and notifications arrive with almost no perceptible delay. That experience is the result of persistent connections and careful engineering, not magic.',
      'VoiceID is designed to keep every conversation in sync the moment something changes — a new message, a call, or a status update — across every device you\u2019re signed into.',
    ],
  },
  {
    slug: 'how-to-protect-your-identity-while-chatting-online',
    title: 'How to Protect Your Identity While Chatting Online',
    metaDescription: 'Practical steps for protecting your personal information while chatting online, from choosing the right platform to managing what you share.',
    cluster: 'Private Communication',
    clusterSlug: 'private-communication',
    date: '2026-03-18',
    author: 'VoiceID Team',
    paragraphs: [
      'Protecting your identity online starts with choosing a platform that doesn\u2019t require unnecessary personal information in the first place. A messaging app that requires your phone number immediately creates a link between your online conversations and your real-world identity.',
      'Beyond platform choice, simple habits help: use a username you\u2019re comfortable sharing broadly, review who can contact you, and prefer platforms that encrypt conversations end-to-end by default.',
      'VoiceID was built around this principle — a username-based identity paired with end-to-end encryption, so protecting your identity isn\u2019t something you have to configure yourself.',
    ],
  },
];
