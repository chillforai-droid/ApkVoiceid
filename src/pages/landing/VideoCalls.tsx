import { Phone, Lock, Globe, History, WifiOff, PhoneCall } from 'lucide-react';
import MarketingLanding from '../../components/seo/MarketingLanding';
import { faqCategories } from '../../data/seoContent';

const faqs = faqCategories.find((c) => c.page === '/video-calls')!.items;

export default function VideoCalls() {
  return (
    <MarketingLanding
      path="/video-calls"
      breadcrumbLabel="Voice & Video Calls"
      seoTitle="Voice Calls in Your Browser — No Phone Number Needed | VoiceID"
      metaDescription="Make encrypted voice calls with VoiceID — no phone number, no SIM card, and no app download. Just your username and a browser."
      keywords="voice call app in browser, make calls without phone number, free VoIP app, encrypted voice calls"
      h1="Calls That Don't Need a Phone Number"
      intro="Place encrypted voice calls to anyone on VoiceID, straight from your browser — no SIM card, no carrier, no phone number required."
      benefits={[
        { icon: Phone, title: 'Call by Username', description: 'Place calls using a VoiceID username instead of a phone number.' },
        { icon: Lock, title: 'End-to-End Encrypted Calls', description: 'Every call is encrypted so only you and the person you\u2019re speaking with can hear it.' },
        { icon: Globe, title: 'Works Anywhere Online', description: 'Calls run over the internet, so location and carrier coverage don\u2019t matter.' },
        { icon: WifiOff, title: 'No SIM Card Needed', description: 'Make and receive calls without ever needing a physical SIM card.' },
        { icon: History, title: 'Full Call History', description: 'Review your past calls anytime from your call history.' },
        { icon: PhoneCall, title: 'Call From Any Chat', description: 'Jump straight from a conversation into a voice call with one tap.' },
      ]}
      howItWorks={[
        { title: 'Open a conversation', description: 'Go to any chat with someone on VoiceID.' },
        { title: 'Tap to call', description: 'Start a voice call directly from the conversation — no dialing a number.' },
        { title: 'Talk securely', description: 'Your call is encrypted end-to-end for the entire conversation.' },
      ]}
      faqs={faqs}
      relatedLinks={[
        { label: 'Voice Messaging', path: '/voice-messaging' },
        { label: 'Secure Messaging', path: '/secure-messaging' },
        { label: 'Browser Chat', path: '/browser-chat' },
      ]}
    />
  );
}
