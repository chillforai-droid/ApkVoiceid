import { Link } from 'react-router-dom';
import { ShieldOff, Lock, EyeOff, Database, FileText, UserX } from 'lucide-react';
import MarketingLanding from '../../components/seo/MarketingLanding';
import { faqCategories } from '../../data/seoContent';

const faqs = faqCategories.find((c) => c.page === '/privacy')!.items;

export default function PrivacyLanding() {
  return (
    <MarketingLanding
      path="/privacy"
      breadcrumbLabel="Privacy"
      seoTitle="Privacy at VoiceID — Built Around You, Not Your Data"
      metaDescription="See how VoiceID approaches privacy: no phone number required, end-to-end encryption, and data practices designed around minimal collection."
      keywords="privacy first messaging app, identity protection chat app, messaging app no phone number required"
      h1="Privacy Isn't a Setting Here — It's the Foundation"
      intro="VoiceID was built around a simple idea: you shouldn't have to trade your phone number and personal data for the ability to talk to people privately."
      benefits={[
        { icon: ShieldOff, title: 'No Phone Number Needed', description: 'Your identity on VoiceID is a username you choose, not a number tied to a carrier.' },
        { icon: Lock, title: 'End-to-End Encryption', description: 'Messages, voice notes, and calls are encrypted so only participants can access them.' },
        { icon: EyeOff, title: 'Minimal Data Collection', description: 'VoiceID only collects what\u2019s needed to operate your account.' },
        { icon: Database, title: 'Zero-Knowledge by Design', description: 'Our architecture is built so we can\u2019t access the content of your conversations.' },
        { icon: UserX, title: 'You Control Contact', description: 'Decide who can reach you, and block anyone who shouldn\u2019t.' },
        { icon: FileText, title: 'Transparent Policies', description: 'Our full data practices are documented in plain language in our Privacy Policy.' },
      ]}
      howItWorks={[
        { title: 'Sign up without a phone number', description: 'Use an email and username instead of handing over your mobile number.' },
        { title: 'Communicate privately', description: 'Every conversation is encrypted end-to-end by default.' },
        { title: 'Stay in control', description: 'Manage your data, contacts, and account from your settings at any time.' },
      ]}
      faqs={faqs}
      relatedLinks={[
        { label: 'Secure Messaging', path: '/secure-messaging' },
        { label: 'Full Privacy Policy', path: '/privacy-policy' },
        { label: 'Terms of Service', path: '/terms-of-service' },
      ]}
    />
  );
}
