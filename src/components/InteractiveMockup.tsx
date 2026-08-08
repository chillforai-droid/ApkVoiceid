import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { Phone, Search, Mic, User, LayoutDashboard, LogIn } from 'lucide-react';

export default function InteractiveMockup() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((s) => (s + 1) % 9);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full max-w-sm h-[600px] bg-gray-900 rounded-[3rem] p-4 shadow-2xl border-8 border-gray-800 mx-auto overflow-hidden relative">
      <div className="h-full bg-white rounded-[2.5rem] p-6 flex flex-col justify-between relative">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div key="login" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center h-full text-center">
              <LogIn size={64} className="mx-auto mb-4 text-blue-600" />
              <h3 className="text-2xl font-bold">Welcome to VoiceID</h3>
              <p className="text-gray-500">Login or Signup</p>
            </motion.div>
          )}
          {step === 1 && (
            <motion.div key="voiceid" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center h-full text-center">
              <Mic size={64} className="mx-auto mb-4 text-purple-600" />
              <h3 className="text-2xl font-bold">Create VoiceID</h3>
              <input type="text" placeholder="@username" className="mt-4 border-b-2 border-black w-full text-center p-2" />
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center h-full text-center">
              <LayoutDashboard size={64} className="mx-auto mb-4 text-green-600" />
              <h3 className="text-2xl font-bold">Your Dashboard</h3>
              <p className="text-gray-500">Start communicating securely</p>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full">
              <div className="flex items-center gap-2 border-b-2 border-black w-full pb-2">
                <Search size={20} />
                <span className="text-xl font-bold">@mahendra</span>
              </div>
            </motion.div>
          )}
          {step === 4 && (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center"><User size={40} className="text-gray-400" /></div>
              <span className="text-xl font-bold">Mahendra</span>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-full">Voice Call</button>
            </motion.div>
          )}
          {step === 5 && (
            <motion.div key="calling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full gap-4">
              <span className="text-lg">Calling...</span>
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center">
                <Phone className="text-white" size={40} />
              </motion.div>
            </motion.div>
          )}
          {step >= 6 && (
            <motion.div key="connected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full gap-8">
              <span className="text-lg">Connected</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <motion.div key={i} animate={{ height: [20, 50, 20] }} transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }} className="w-2 bg-blue-600 rounded-full" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
