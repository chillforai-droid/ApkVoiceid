import { Globe, RefreshCw, Bell, Search, CheckCircle, Wifi } from 'lucide-react';
import MarketingLanding from '../../components/seo/MarketingLanding';
import { faqCategories } from '../../data/seoContent';

const faqs = faqCategories.find((c) => c.page === '/online-chat')!.items;

export default function OnlineChat() {
  return (
    <MarketingLanding
      path="/online-chat"
      breadcrumbLabel="Online Chat"
      seoTitle="Online Chat App — Real-Time Messaging | VoiceID"
      metaDescription="Chat online in real time with VoiceID. Free, browser-based, and synced across devices — no phone number, no download required."
      keywords="online chat app, free online chat, real time online chat, online chat without phone number"
      h1="Online Chat That Keeps Up With You"
      intro="VoiceID delivers real-time online chat with presence, read receipts, and instant sync across every device you use — free, and without a phone number."
      benefits={[
        { icon: Globe, title: 'Available Anywhere', description: 'Chat online from any modern browser, on any device, anywhere in the world.' },
        { icon: RefreshCw, title: 'Synced Across Devices', description: 'Your conversations stay up to date whether you\u2019re on desktop or mobile.' },
        { icon: Bell, title: 'Real-Time Notifications', description: 'Get notified the moment a new message arrives, without refreshing the page.' },
        { icon: Search, title: 'Find People Easily', description: 'Search by username to start chatting with anyone on VoiceID.' },
        { icon: CheckCircle, title: 'Delivery & Read Status', description: 'See when a message has been delivered and read, right inside the conversation.' },
        { icon: Wifi, title: 'Built for Real-Time', description: 'Messages, presence, and calls all sync instantly over a persistent connection.' },
      ]}
      howItWorks={[
        { title: 'Sign up free', description: 'Create your VoiceID account with just an email and a username.' },
        { title: 'Search for contacts', description: 'Find people by their VoiceID username to start chatting.' },
        { title: 'Chat in real time', description: 'Messages, presence, and notifications sync instantly across your devices.' },
      ]}
      faqs={faqs}
      relatedLinks={[
        { label: 'Private Chat', path: '/private-chat' },
        { label: 'Browser Chat', path: '/browser-chat' },
        { label: 'Voice Messaging', path: '/voice-messaging' },
      ]}
    />
  );
}
