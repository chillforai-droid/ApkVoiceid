import { Shield, Lock, KeyRound, ShieldOff, UserCheck, Fingerprint } from 'lucide-react';
import MarketingLanding from '../../components/seo/MarketingLanding';
import { faqCategories } from '../../data/seoContent';

const faqs = faqCategories.find((c) => c.page === '/secure-messaging')!.items;

export default function SecureMessaging() {
  return (
    <MarketingLanding
      path="/secure-messaging"
      breadcrumbLabel="Secure Messaging"
      seoTitle="Secure Messaging App — End-to-End Encrypted Chat | VoiceID"
      metaDescription="VoiceID is a secure messaging app with end-to-end encryption and no phone number required. Message, send voice notes, and call with total privacy."
      keywords="secure messaging app, encrypted messaging app, secure messaging without phone number, secure chat app"
      h1="Secure Messaging Without the Compromises"
      intro="VoiceID gives you end-to-end encrypted messaging without requiring your phone number — so your conversations stay private, by design, not by promise."
      benefits={[
        { icon: Lock, title: 'End-to-End Encrypted', description: 'Every text message, voice note, and call is encrypted so only you and the recipient can access it.' },
        { icon: ShieldOff, title: 'No Phone Number Required', description: 'Sign up with a username instead of a mobile number, removing a major attack surface for your account.' },
        { icon: KeyRound, title: 'Zero-Knowledge Architecture', description: 'VoiceID is built so that message content is never accessible to us, not even in theory.' },
        { icon: Fingerprint, title: 'SIM-Swap Resistant', description: 'Since your identity isn\u2019t tied to a SIM card, losing or swapping one can\u2019t compromise your account.' },
        { icon: UserCheck, title: 'You Control Who Reaches You', description: 'Manage contacts and blocking so only the people you choose can start a conversation.' },
        { icon: Shield, title: 'Secure by Default', description: 'There\u2019s no setting to turn on — every conversation on VoiceID is encrypted from the first message.' },
      ]}
      howItWorks={[
        { title: 'Create your VoiceID', description: 'Sign up with an email address and choose a unique username — no phone number needed.' },
        { title: 'Share your username', description: 'Give your VoiceID username to the people you want to message securely.' },
        { title: 'Message with confidence', description: 'Send encrypted text, voice notes, and calls knowing your conversations stay private.' },
      ]}
      faqs={faqs}
      relatedLinks={[
        { label: 'Private Chat', path: '/private-chat' },
        { label: 'Voice Messaging', path: '/voice-messaging' },
        { label: 'Privacy at VoiceID', path: '/privacy' },
      ]}
    />
  );
}
