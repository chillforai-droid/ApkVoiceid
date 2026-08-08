import { Mic, Zap, Lock, Clock, Users, Smartphone } from 'lucide-react';
import MarketingLanding from '../../components/seo/MarketingLanding';
import { faqCategories } from '../../data/seoContent';

const faqs = faqCategories.find((c) => c.page === '/voice-messaging')!.items;

export default function VoiceMessaging() {
  return (
    <MarketingLanding
      path="/voice-messaging"
      breadcrumbLabel="Voice Messaging"
      seoTitle="Voice Messaging App — Send Secure Voice Notes | VoiceID"
      metaDescription="Send voice messages in seconds with VoiceID. Encrypted voice notes, no phone number required, delivered instantly in any browser."
      keywords="voice messaging app, send voice messages online, voice notes app, secure voice messages"
      h1="Say It Faster With Voice Messages"
      intro="Recording a voice note is faster than typing and carries the tone that text can't. VoiceID makes voice messaging quick, encrypted, and always in sync."
      benefits={[
        { icon: Mic, title: 'One-Tap Recording', description: 'Press, speak, and send — voice notes are as quick to record as they are to listen to.' },
        { icon: Lock, title: 'Encrypted Voice Notes', description: 'Voice messages are protected by the same end-to-end encryption as your text conversations.' },
        { icon: Zap, title: 'Delivered Instantly', description: 'Voice notes are compressed and delivered in real time, even on slower connections.' },
        { icon: Clock, title: 'Preview Before Sending', description: 'Listen back to your voice note before you send it, so you always say exactly what you mean.' },
        { icon: Users, title: 'Works in Groups Too', description: 'Send voice messages in one-on-one chats or private group conversations.' },
        { icon: Smartphone, title: 'No App Required', description: 'Record and send voice messages directly from your browser, on any device.' },
      ]}
      howItWorks={[
        { title: 'Open a conversation', description: 'Head into any chat on VoiceID, one-on-one or group.' },
        { title: 'Hold to record', description: 'Press and hold the microphone icon to record your voice message.' },
        { title: 'Release to send', description: 'Let go to send instantly — or preview it first if you want to double-check.' },
      ]}
      faqs={faqs}
      relatedLinks={[
        { label: 'Secure Messaging', path: '/secure-messaging' },
        { label: 'Voice & Video Calls', path: '/video-calls' },
        { label: 'Online Chat', path: '/online-chat' },
      ]}
    />
  );
}
