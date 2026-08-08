import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function Careers() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 max-w-4xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tighter mb-8">Join the Future of Privacy</h1>
        <p className="text-xl text-gray-600 mb-8">At VoiceID, we are building a more private, secure internet. If you are passionate about privacy, cryptography, and building user-centric products, we want to hear from you.</p>
        
        <h2 className="text-3xl font-bold mb-4">Our Culture</h2>
        <p className="mb-6">We value autonomy, transparency, and deep technical excellence. We operate as a remote-first team, trusting each other to deliver results without micro-management. Our work directly impacts how people communicate globally, and we take that responsibility seriously.</p>

        <h2 className="text-3xl font-bold mb-4">Open Positions</h2>
        <div className="space-y-6">
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-2xl font-semibold">Senior Backend Engineer (Cryptography Focus)</h3>
            <p className="text-gray-600 mt-2">Help us design and implement our next-generation end-to-end encryption protocols. Deep knowledge of WebRTC, TLS, and modern cryptographic libraries is essential.</p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-2xl font-semibold">Product Designer (UX/UI for Privacy)</h3>
            <p className="text-gray-600 mt-2">Design intuitive interfaces that make complex security concepts easy to understand for everyone. Help us prove that privacy doesn't have to be complicated.</p>
          </div>
          <div className="p-6 border border-gray-200 rounded-lg">
            <h3 className="text-2xl font-semibold">DevOps Engineer (Infrastructure Security)</h3>
            <p className="text-gray-600 mt-2">Manage and scale our global infrastructure with a security-first mindset. Focus on automation, observability, and robust protection against threats.</p>
          </div>
        </div>

        <h2 className="text-3xl font-bold mt-12 mb-4">Why Work Here?</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>Competitive salary and equity packages.</li>
          <li>Flexible working hours and remote-first culture.</li>
          <li>Comprehensive health and wellness benefits.</li>
          <li>Generous learning and development budget.</li>
          <li>Regular team offsites and collaborative retreats.</li>
        </ul>

        <p className="mt-12 text-lg font-semibold">Interested? Send your portfolio and resume to <a href="mailto:careers@voiceid.example" className="text-blue-600 hover:underline">careers@voiceid.example</a>.</p>
      </main>
      <Footer />
    </div>
  );
}
