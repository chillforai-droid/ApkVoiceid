import { motion } from 'motion/react';

export default function Demo() {
  return (
    <section className="py-20 px-6 max-w-7xl mx-auto">
      <h2 className="text-4xl font-extrabold tracking-tighter text-center mb-16">See VoiceID in Action.</h2>
      <div className="flex flex-col md:flex-row justify-center items-center gap-10">
        <div className="w-64 h-96 bg-gray-900 rounded-3xl p-4 shadow-xl"></div>
        <div className="w-80 h-60 bg-gray-900 rounded-3xl p-4 shadow-xl hidden md:block"></div>
        <div className="w-48 h-96 bg-gray-900 rounded-3xl p-4 shadow-xl"></div>
      </div>
    </section>
  );
}
