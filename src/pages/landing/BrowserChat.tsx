import { Laptop, Download, Zap, Layers, ShieldCheck, MonitorSmartphone } from 'lucide-react';
import MarketingLanding from '../../components/seo/MarketingLanding';
import { faqCategories } from '../../data/seoContent';

const faqs = faqCategories.find((c) => c.page === '/browser-chat')!.items;

export default function BrowserChat() {
  return (
    <MarketingLanding
      path="/browser-chat"
      breadcrumbLabel="Browser Chat"
      seoTitle="Browser Chat App — Messaging With No Download | VoiceID"
      metaDescription="Use VoiceID directly in your browser — messaging, voice notes, and calls with no app download. Install to your home screen when you want."
      keywords="chat in browser no app, browser chat app no download, web based messenger, PWA messaging app"
      h1="Full-Featured Chat, Zero Downloads"
      intro="VoiceID runs entirely in your browser — no app store, no install, no storage footprint. Add it to your home screen when you want the app-like feel."
      benefits={[
        { icon: Laptop, title: 'Works in Any Browser', description: 'Chrome, Safari, Firefox, or Edge — VoiceID runs wherever you are.' },
        { icon: Download, title: 'No Install Required', description: 'Skip the app store entirely and start chatting the moment you sign up.' },
        { icon: Zap, title: 'Fast, Lightweight Experience', description: 'Built with modern web technology for a fast, responsive experience.' },
        { icon: Layers, title: 'Install as a PWA', description: 'Add VoiceID to your home screen for an app-like experience without the download.' },
        { icon: ShieldCheck, title: 'Same Security, No Compromise', description: 'The browser experience uses the same end-to-end encryption as everywhere else on VoiceID.' },
        { icon: MonitorSmartphone, title: 'Desktop & Mobile Ready', description: 'A fully responsive experience that works equally well on desktop and mobile browsers.' },
      ]}
      howItWorks={[
        { title: 'Open voiceid.online', description: 'No app store, no install — just open the site in your browser.' },
        { title: 'Sign up in seconds', description: 'Create your account with an email and username.' },
        { title: 'Optionally install', description: 'Add VoiceID to your home screen for one-tap access whenever you want it.' },
      ]}
      faqs={faqs}
      relatedLinks={[
        { label: 'Online Chat', path: '/online-chat' },
        { label: 'Voice & Video Calls', path: '/video-calls' },
        { label: 'Features', path: '/features' },
      ]}
    />
  );
}
