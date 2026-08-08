import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const site = 'https://voiceid.online';

const pages = [
  { path:'/', title:'VoiceID — Secure Voice & Messaging Without Sharing Your Phone Number', description:'VoiceID lets you connect, message and make voice calls using your digital identity without sharing your phone number.', h1:'Connect, Message & Talk Without Sharing Your Phone Number' },
  { path:'/secure-messaging', title:'Secure Messaging Without a Phone Number | VoiceID', description:'Secure messaging with end-to-end encryption and a username-based identity. Chat privately without sharing your phone number.', h1:'Secure Messaging Without Sharing Your Phone Number' },
  { path:'/private-chat', title:'Private Chat — Encrypted Conversations | VoiceID', description:'Start private, encrypted conversations using a VoiceID username. No phone number is required to connect.', h1:'Private Chat That Keeps Conversations Private' },
  { path:'/voice-messaging', title:'Voice Messaging — Private Voice Notes | VoiceID', description:'Send private, encrypted voice messages from your browser. Record, preview and share voice notes without a phone number.', h1:'Private Voice Messaging Made Simple' },
  { path:'/online-chat', title:'Online Chat — Real-Time Messaging | VoiceID', description:'Chat online in real time with delivery, read status, typing indicators and presence, using a username instead of a phone number.', h1:'Real-Time Online Chat' },
  { path:'/browser-chat', title:'Browser Chat — No App Required | VoiceID', description:'Use VoiceID directly in your browser for messaging, voice notes and calls. No app-store installation required.', h1:'Browser Chat Without an App Download' },
  { path:'/video-calls', title:'Voice & Video Calls Online | VoiceID', description:'Make internet voice and video calls using a VoiceID username, with encrypted calling and no phone number required.', h1:'Voice & Video Calls Online' },
  { path:'/features', title:'VoiceID Features — Messaging, Voice Notes & Calls', description:'Explore VoiceID features including encrypted messaging, voice notes, voice calls, video calls, notifications and profile controls.', h1:'Everything You Need to Communicate Privately' },
  { path:'/help', title:'Help Center — VoiceID Support & FAQs', description:'Answers to common questions about VoiceID, secure messaging, voice notes, calls, privacy and your account.', h1:'VoiceID Help Center' },
  { path:'/privacy', title:'Privacy at VoiceID — Private Communication', description:'Learn how VoiceID approaches private communication, encryption, identity and user control.', h1:'Privacy by Design' },
  { path:'/careers', title:'Careers at VoiceID', description:'Learn about opportunities to work with the VoiceID team building private, real-time communication tools.', h1:'Careers at VoiceID' },
  { path:'/contact', title:'Contact VoiceID | Help & Support', description:'Contact VoiceID for account help, technical issues, bug reports, privacy questions and general support.', h1:'Contact VoiceID' },
  { path:'/privacy-policy', title:'Privacy Policy | VoiceID', description:'Read the VoiceID privacy policy and learn how account, communication and technical data are handled.', h1:'VoiceID Privacy Policy' },
  { path:'/terms-of-service', title:'Terms of Service | VoiceID', description:'Read the VoiceID terms of service governing use of the VoiceID communication platform.', h1:'VoiceID Terms of Service' },
  { path:'/blog', title:'VoiceID Blog — Secure Messaging, Privacy & Voice Communication', description:'Guides and insights on secure messaging, private communication, voice messages, online chat, and real-time messaging from the VoiceID team.', h1:'VoiceID Blog' },
  { path:'/blog/topic/secure-messaging', title:'Secure Messaging Articles & Guides | VoiceID Blog', description:'Explore VoiceID articles and guides on secure messaging, privacy, security and practical communication tips.', h1:'Secure Messaging Articles & Guides' },
  { path:'/blog/topic/private-communication', title:'Private Communication Articles & Guides | VoiceID Blog', description:'Explore VoiceID articles and guides on private communication, encryption, identity and safer online conversations.', h1:'Private Communication Articles & Guides' },
  { path:'/blog/topic/voice-messages', title:'Voice Messages Articles & Guides | VoiceID Blog', description:'Explore VoiceID articles and guides about voice messages, voice notes, privacy and modern communication.', h1:'Voice Messages Articles & Guides' },
  { path:'/blog/topic/online-chat', title:'Online Chat Articles & Guides | VoiceID Blog', description:'Explore VoiceID articles and guides about online chat, real-time messaging and modern communication.', h1:'Online Chat Articles & Guides' },
  { path:'/blog/topic/browser-messaging', title:'Browser Messaging Articles & Guides | VoiceID Blog', description:'Explore VoiceID articles and guides about browser-based messaging and app-free communication.', h1:'Browser Messaging Articles & Guides' },
  { path:'/blog/topic/real-time-messaging', title:'Real-Time Messaging Articles & Guides | VoiceID Blog', description:'Explore VoiceID articles and guides about real-time messaging, presence, typing and notifications.', h1:'Real-Time Messaging Articles & Guides' },
];

const posts = [
['why-your-phone-number-is-not-a-safe-identity','Why Your Phone Number Is Not a Safe Identity','Phone numbers were never designed to be a security credential. Here is why relying on them for identity puts your accounts at risk.'],
['introducing-secure-end-to-end-encryption-on-voiceid','Introducing Secure End-to-End Encryption on VoiceID','All communication on VoiceID — text, voice notes, and calls — is now protected by end-to-end encryption. Here is what that means for you.'],
['the-future-of-decentralized-communication','The Future of Decentralized Communication','How decentralized identity systems can reduce reliance on big tech and give people more control over their own data.'],
['how-sim-swapping-attacks-work-and-how-to-avoid-them','How SIM Swapping Attacks Work — And How to Avoid Them','A plain-language breakdown of SIM swapping attacks, why phone-number-based accounts are vulnerable, and how to reduce your exposure.'],
['anonymous-vs-private-understanding-the-difference','Anonymous vs. Private: Understanding the Difference','Anonymous and private are not the same thing. Here is how VoiceID thinks about the distinction — and why it matters for how you communicate.'],
['why-voice-messages-are-taking-over-text-based-chat','Why Voice Messages Are Taking Over Text-Based Chat','Voice notes convey tone and nuance faster than typing. Here is why voice messaging is becoming the default for quick, personal communication.'],
['are-voice-messages-more-secure-than-text','Are Voice Messages More Secure Than Text? Here’s the Truth','Voice messages are not automatically more secure than text — encryption is what matters. Here is how VoiceID protects both equally.'],
['the-evolution-of-online-chat-from-irc-to-modern-messengers','The Evolution of Online Chat: From IRC to Modern Messengers','A brief history of online chat — from early IRC networks to today’s encrypted, real-time messaging platforms.'],
['why-browser-based-messaging-apps-are-gaining-ground','Why Browser-Based Messaging Apps Are Gaining Ground','No download, no app store, no storage footprint. Here is why browser-based messengers are becoming a practical choice for everyday communication.'],
['what-makes-a-messaging-platform-feel-real-time','What Makes a Messaging Platform Feel Real-Time?','Instant delivery, live presence, and typing indicators all combine to create the feeling of real-time messaging.'],
['how-to-protect-your-identity-while-chatting-online','How to Protect Your Identity While Chatting Online','Practical steps for protecting your personal information while chatting online, from choosing the right platform to managing what you share.'],
];
for (const [slug,title,description] of posts) pages.push({path:`/blog/${slug}`,title:`${title} | VoiceID Blog`,description,h1:title});

function esc(s){return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
function render(base, p){
  let html=base;
  html=html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(p.title)}</title>`);
  html=html.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${esc(p.description)}" />`);
  html=html.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${site}${p.path}" />`);
  html=html.replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${esc(p.title)}" />`);
  html=html.replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${esc(p.description)}" />`);
  html=html.replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${site}${p.path}" />`);
  html=html.replace(/<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${esc(p.title)}" />`);
  html=html.replace(/<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${esc(p.description)}" />`);
  const body=`<main id="seo-prerender"><article><h1>${esc(p.h1)}</h1><p>${esc(p.description)}</p><p>VoiceID provides private, real-time communication using a username-based identity. Explore the page to learn more.</p></article></main>`;
  html=html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}

const base=fs.readFileSync(path.join(dist,'index.html'),'utf8');
for(const p of pages){
  const dir=p.path==='/'?dist:path.join(dist,p.path.replace(/^\//,'').replace(/\/$/,''));
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.html'),render(base,p));
}
console.log(`SEO prerendered ${pages.length} public URLs`);
