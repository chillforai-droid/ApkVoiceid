import { Link, useNavigate } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import Navbar from '../Navbar';
import Footer from '../Footer';
import Breadcrumbs, { breadcrumbJsonLd, Crumb } from './Breadcrumbs';
import FAQAccordion, { FaqItem, faqJsonLd } from './FAQAccordion';
import { useSEO } from '../../hooks/useSEO';

export interface Benefit {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface RelatedLink {
  label: string;
  path: string;
}

export interface MarketingLandingProps {
  path: string;
  breadcrumbLabel: string;
  seoTitle: string;
  metaDescription: string;
  keywords: string;
  h1: string;
  intro: string;
  benefits: Benefit[];
  howItWorks: { title: string; description: string }[];
  faqs: FaqItem[];
  relatedLinks: RelatedLink[];
  ctaLabel?: string;
  extraJsonLd?: Record<string, any>[];
}

export default function MarketingLanding({
  path,
  breadcrumbLabel,
  seoTitle,
  metaDescription,
  keywords,
  h1,
  intro,
  benefits,
  howItWorks,
  faqs,
  relatedLinks,
  ctaLabel = 'Create Your VoiceID',
  extraJsonLd = [],
}: MarketingLandingProps) {
  const navigate = useNavigate();
  const canonical = `https://voiceid.online${path}`;
  const crumbs: Crumb[] = [{ label: breadcrumbLabel, path }];

  useSEO({
    title: seoTitle,
    description: metaDescription,
    canonical,
    keywords,
    jsonLd: [
      breadcrumbJsonLd(crumbs),
      faqJsonLd(faqs),
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: seoTitle,
        description: metaDescription,
        url: canonical,
        isPartOf: { '@type': 'WebSite', name: 'VoiceID', url: 'https://voiceid.online/' },
      },
      ...extraJsonLd,
    ],
  });

  return (
    <div className="min-h-screen flex flex-col bg-white text-black">
      <Navbar />
      <Breadcrumbs items={crumbs} />

      <section className="pt-10 sm:pt-14 pb-16 sm:pb-20 px-4 sm:px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tighter mb-6">{h1}</h1>
        <p className="text-base sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">{intro}</p>
        <button
          onClick={() => navigate('/auth/welcome')}
          className="px-8 py-4 text-base sm:text-lg font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 transition"
        >
          {ctaLabel}
        </button>
      </section>

      <section className="py-16 px-6 max-w-6xl mx-auto w-full" aria-labelledby="benefits-heading">
        <h2 id="benefits-heading" className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-center mb-14">Why It Works</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="p-6 border border-gray-100 rounded-2xl">
                <Icon className="text-blue-600 mb-4" size={28} aria-hidden="true" />
                <h3 className="font-bold text-lg mb-2">{b.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{b.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="py-16 px-6 max-w-4xl mx-auto w-full" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-center mb-14">How It Works</h2>
        <ol className="space-y-8">
          {howItWorks.map((step, i) => (
            <li key={i} className="flex gap-5">
              <span className="shrink-0 w-9 h-9 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm" aria-hidden="true">{i + 1}</span>
              <div>
                <h3 className="font-bold text-lg mb-1">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <FAQAccordion items={faqs} />

      {relatedLinks.length > 0 && (
        <section className="py-12 px-6 max-w-4xl mx-auto w-full border-t border-gray-100" aria-labelledby="related-heading">
          <h2 id="related-heading" className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-4">Related</h2>
          <div className="flex flex-wrap gap-4">
            {relatedLinks.map((link) => (
              <Link key={link.path} to={link.path} className="text-sm font-semibold text-blue-600 hover:underline">
                {link.label} →
              </Link>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
