import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Story from '../components/Story';
import Features from '../components/Features';
import Demo from '../components/Demo';
import Security from '../components/Security';
import FutureVision from '../components/FutureVision';
import FAQ, { homeFaqs } from '../components/FAQ';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';
import { faqJsonLd } from '../components/seo/FAQAccordion';

// Note: sitewide Organization + WebSite (with SearchAction) structured data
// lives statically in index.html so it's visible even to crawlers that don't
// execute JavaScript. Only the page-specific FAQPage block is injected here.
export default function LandingPage() {
  useSEO({
      title: 'VoiceID — Secure Voice & Messaging Without Sharing Your Phone Number',
      description: 'VoiceID lets you connect, message and make voice calls using your digital identity without sharing your phone number.',
      canonical: 'https://voiceid.online/',
      jsonLd: [faqJsonLd(homeFaqs)],
  });

  return (
    <div className="min-h-screen bg-white text-black font-sans">
      <Navbar />
      <Hero />
      <Story />
      <Features />
      <Security />
      <FutureVision />
      <FAQ />
      <Footer />
    </div>
  );
}
