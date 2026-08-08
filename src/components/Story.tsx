import { motion } from 'motion/react';

export default function Story() {
  return (
    <section id="about" className="py-20 px-6 max-w-7xl mx-auto">
      <h2 className="text-4xl font-extrabold tracking-tighter text-center mb-16">Stop Sharing Your Phone Number.</h2>
      <div className="grid md:grid-cols-2 gap-10">
        <div className="p-8 bg-gray-50 rounded-3xl">
          <h3 className="text-xl font-bold mb-6">Traditional Communication</h3>
          <ul className="space-y-4 text-gray-600">
            <li>Phone Number</li>
            <li>Privacy Risk</li>
            <li>Spam</li>
            <li>SIM Dependency</li>
          </ul>
        </div>
        <div className="p-8 bg-black text-white rounded-3xl">
          <h3 className="text-xl font-bold mb-6">VoiceID</h3>
          <ul className="space-y-4 text-gray-200">
            <li>Username</li>
            <li>Private</li>
            <li>Secure</li>
            <li>Internet Based</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
