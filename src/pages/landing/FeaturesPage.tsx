import { MessageCircle, Mic, Phone, Search, Bell, UserCog } from 'lucide-react';
import MarketingLanding from '../../components/seo/MarketingLanding';
import { faqCategories } from '../../data/seoContent';

const faqs = faqCategories.find((c) => c.page === '/features')!.items;

const webApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'VoiceID',
  url: 'https://voiceid.online/',
  applicationCategory: 'CommunicationApplication',
  operatingSystem: 'Any (Web Browser)',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description: 'VoiceID is a browser-based communication platform combining encrypted messaging, voice notes, and voice calls, using a username instead of a phone number.',
};

export default function FeaturesPage() {
  return (
    <MarketingLanding
      path="/features"
      breadcrumbLabel="Features"
      seoTitle="VoiceID Features — Messaging, Voice Notes & Calls in One App"
      metaDescription="Explore VoiceID's core features: encrypted messaging, voice notes, voice calls, real-time notifications, and a username-based identity — all free."
      keywords="messaging app features, voice messaging app, secure calling app, all in one messaging app"
      h1="Everything You Need to Communicate, in One Place"
      intro="VoiceID brings together messaging, voice notes, and calls in a single, encrypted, username-based platform — free, and accessible from any browser."
      extraJsonLd={[webApplicationJsonLd]}
      benefits={[
        { icon: MessageCircle, title: 'Encrypted Messaging', description: 'Text conversations, one-on-one or in groups, protected end-to-end.' },
        { icon: Mic, title: 'Voice Notes', description: 'Record and send voice messages in a single tap, with a preview before sending.' },
        { icon: Phone, title: 'Voice Calls', description: 'Call anyone on VoiceID directly from a conversation, no phone number needed.' },
        { icon: Search, title: 'Username Search', description: 'Find and connect with anyone on VoiceID using just their username.' },
        { icon: Bell, title: 'Real-Time Notifications', description: 'Stay on top of new messages, calls, and account activity as they happen.' },
        { icon: UserCog, title: 'Full Account Control', description: 'Manage your profile, privacy, and notification preferences from one settings page.' },
      ]}
      howItWorks={[
        { title: 'Create your account', description: 'Sign up with an email and choose your VoiceID username.' },
        { title: 'Set up your profile', description: 'Add a display name and avatar, and adjust your privacy preferences.' },
        { title: 'Start communicating', description: 'Message, send voice notes, and call — all from one encrypted platform.' },
      ]}
      faqs={faqs}
      relatedLinks={[
        { label: 'Secure Messaging', path: '/secure-messaging' },
        { label: 'Voice Messaging', path: '/voice-messaging' },
        { label: 'Voice & Video Calls', path: '/video-calls' },
        { label: 'Help Center', path: '/help' },
      ]}
    />
  );
}
