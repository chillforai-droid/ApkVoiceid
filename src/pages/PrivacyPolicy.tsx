import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tighter mb-8">Privacy Policy</h1>
        <div className="space-y-8 text-gray-700 text-base sm:text-lg leading-relaxed">
          <p>Last Updated: July 25, 2026</p>
          <p>At VoiceID, your privacy is our core product, not a feature. We do not store your phone number, and we do not sell your personal data. This policy outlines how we handle the minimal information we do collect to provide our service.</p>
          
          <h2 className="text-2xl font-bold text-black">1. What We Collect</h2>
          <p>We only collect the minimal information required for our service to function:</p>
          <ul className="list-disc pl-5">
            <li><strong>Account Information:</strong> Your chosen username.</li>
            <li><strong>Public Profile:</strong> Any avatar or bio information you choose to make public.</li>
            <li><strong>Encrypted Metadata:</strong> Information necessary to route messages (sender/receiver IDs), which is encrypted in transit and at rest.</li>
          </ul>

          <h2 className="text-2xl font-bold text-black">2. Data Security</h2>
          <p>All communication is end-to-end encrypted. We cannot access the content of your messages or calls. We use industry-standard cryptographic protocols to ensure your data remains secure and private.</p>

          <h2 className="text-2xl font-bold text-black">3. Sharing of Information</h2>
          <p>We do not share, sell, or rent your personal information to third parties for marketing purposes under any circumstances. We may disclose information if required by law, such as to comply with a subpoena or similar legal process.</p>

          <h2 className="text-2xl font-bold text-black">4. Your Rights</h2>
          <p>You have the right to access, rectify, or delete your account information at any time directly through the VoiceID application settings.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
