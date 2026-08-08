import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import Breadcrumbs, { breadcrumbJsonLd } from '../../components/seo/Breadcrumbs';
import FAQAccordion, { faqJsonLd } from '../../components/seo/FAQAccordion';
import { useSEO } from '../../hooks/useSEO';
import { faqCategories, allFaqs } from '../../data/seoContent';

const pageLinks: Record<string, string> = {
  '/secure-messaging': 'Secure Messaging',
  '/private-chat': 'Private Chat',
  '/voice-messaging': 'Voice Messaging',
  '/online-chat': 'Online Chat',
  '/browser-chat': 'Browser Chat',
  '/video-calls': 'Voice & Video Calls',
  '/features': 'Features',
  '/help': 'Help Center',
  '/privacy': 'Privacy',
};

export default function HelpPage() {
  useSEO({
    title: 'Help Center — VoiceID Support & FAQs',
    description: 'Answers to common questions about VoiceID: getting started, secure messaging, voice notes, calls, privacy, and your account.',
    canonical: 'https://voiceid.online/help',
    jsonLd: [
      breadcrumbJsonLd([{ label: 'Help', path: '/help' }]),
      faqJsonLd(allFaqs),
    ],
  });

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <Navbar />
      <Breadcrumbs items={[{ label: 'Help', path: '/help' }]} />
      <section className="pt-10 sm:pt-14 pb-12 px-4 sm:px-6 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tighter mb-6">Help Center</h1>
        <p className="text-base sm:text-xl text-gray-600 max-w-2xl mx-auto">
          Answers to the most common questions about using VoiceID — from getting started to security and privacy.
        </p>
      </section>

      <nav aria-label="Help categories" className="max-w-4xl mx-auto px-6 mb-8 flex flex-wrap gap-2 justify-center">
        {faqCategories.map((c) => (
          <a key={c.category} href={`#${c.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
            {c.category}
          </a>
        ))}
      </nav>

      {faqCategories.map((c) => (
        <div key={c.category} id={c.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
          <FAQAccordion heading={c.category} items={c.items} />
          {pageLinks[c.page] && c.page !== '/help' && (
            <div className="max-w-3xl mx-auto px-6 -mt-10 pb-10 text-center">
              <Link to={c.page} className="text-sm font-semibold text-blue-600 hover:underline">
                Learn more about {pageLinks[c.page]} →
              </Link>
            </div>
          )}
        </div>
      ))}

      <Footer />
    </div>
  );
}
