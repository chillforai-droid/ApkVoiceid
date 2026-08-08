import { Lock, ShieldCheck, EyeOff } from 'lucide-react';
import { motion } from 'motion/react';

export default function Security() {
  return (
    <section id="security" className="py-16 sm:py-20 px-6 sm:px-10 bg-black text-white rounded-[2rem] sm:rounded-[3rem] mx-4 sm:mx-6 lg:mx-auto max-w-7xl my-16 sm:my-20">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tighter mb-6 sm:mb-8">Uncompromising Security</h2>
        <p className="text-base sm:text-xl text-gray-400 mb-10 sm:mb-16">Your VoiceID is protected by the most advanced security protocols on the internet.</p>
        <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            <motion.div whileHover={{ scale: 1.05 }} className="flex flex-col items-center p-6 sm:p-8 bg-gray-900 rounded-3xl">
                <Lock className="text-blue-500 mb-6" size={40} />
                <span className="font-semibold text-lg text-center">End-to-end Encrypted</span>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="flex flex-col items-center p-6 sm:p-8 bg-gray-900 rounded-3xl">
                <ShieldCheck className="text-blue-500 mb-6" size={40} />
                <span className="font-semibold text-lg text-center">Spam Protection</span>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="flex flex-col items-center p-6 sm:p-8 bg-gray-900 rounded-3xl">
                <EyeOff className="text-blue-500 mb-6" size={40} />
                <span className="font-semibold text-lg text-center">Privacy Controls</span>
            </motion.div>
        </div>
      </div>
    </section>
  );
}
