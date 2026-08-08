import { motion } from 'motion/react';
import { Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      aria-label="Primary"
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between backdrop-blur-xl bg-white/80 border-b border-gray-100/50"
    >
      <a href="/" className="flex items-center gap-2" aria-label="VoiceID home">
        <Mic className="text-black" size={24} aria-hidden="true" />
        <span className="font-bold text-xl tracking-tighter">VoiceID</span>
      </a>
      <div className="hidden md:flex gap-8 text-sm font-medium text-gray-600">
        <a href="/features" className="hover:text-black">Features</a>
        <a href="#security" className="hover:text-black">Security</a>
        <a href="/blog" className="hover:text-black">Blog</a>
        <a href="/help" className="hover:text-black">Help</a>
      </div>
      <div className="flex gap-4">
        <button onClick={() => navigate('/auth/login')} aria-label="Log in to VoiceID" className="text-sm font-medium text-gray-600 hover:text-black">Login</button>
        <button onClick={() => navigate('/auth/welcome')} aria-label="Create a VoiceID account" className="px-4 py-2 text-sm font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition">Create VoiceID</button>
      </div>
    </motion.nav>
  );
}
