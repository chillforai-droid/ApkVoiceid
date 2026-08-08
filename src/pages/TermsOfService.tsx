import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tighter mb-8">Terms of Service</h1>
        <div className="space-y-8 text-gray-700 text-base sm:text-lg leading-relaxed">
          <p>Last Updated: July 25, 2026</p>
          <p>By accessing or using VoiceID, you agree to these Terms of Service. If you do not agree to these terms, you may not use our service.</p>
          
          <h2 className="text-2xl font-bold text-black">1. Acceptable Use</h2>
          <p>You agree to use VoiceID only for lawful purposes. You must not:</p>
          <ul className="list-disc pl-5">
            <li>Engage in illegal, harmful, or abusive activities.</li>
            <li>Harass, threaten, or intimidate other users.</li>
            <li>Attempt to reverse-engineer or compromise our security protocols.</li>
            <li>Impersonate another user or entity.</li>
          </ul>

          <h2 className="text-2xl font-bold text-black">2. Account Security</h2>
          <p>You are responsible for maintaining the confidentiality of your VoiceID credentials. You agree to notify us immediately of any unauthorized access to your account.</p>

          <h2 className="text-2xl font-bold text-black">3. Intellectual Property</h2>
          <p>All software, interfaces, and branding associated with VoiceID are the exclusive property of VoiceID and its licensors. You may not use our brand assets without prior written consent.</p>

          <h2 className="text-2xl font-bold text-black">4. Termination</h2>
          <p>We reserve the right to suspend or terminate your account at our sole discretion, without notice, if we suspect you are violating these terms.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
