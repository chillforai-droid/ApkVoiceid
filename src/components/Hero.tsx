import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import InteractiveMockup from './InteractiveMockup';

export default function Hero() {
  const navigate = useNavigate();
  
  return (
    <section className="pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 text-center overflow-x-hidden">
      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-4xl sm:text-6xl md:text-8xl font-extrabold tracking-tighter text-black mb-6"
      >
        Your Voice.<br />Your Identity.
      </motion.h1>
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-base sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto"
      >
        VoiceID is your permanent, secure digital identity for the internet. Communicate instantly and securely without ever sharing your phone number again.
      </motion.p>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex gap-4 justify-center"
      >
        <button onClick={() => navigate('/auth/welcome')} className="px-8 py-4 text-base sm:text-lg font-semibold text-white bg-blue-600 rounded-full hover:bg-blue-700 transition">Create VoiceID</button>
      </motion.div>
      
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-14 sm:mt-20"
      >
        <InteractiveMockup />
      </motion.div>
    </section>
  );
}
