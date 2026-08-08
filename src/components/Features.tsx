import { Mic, MessageCircle, Shield, Search, Briefcase, Zap } from 'lucide-react';
import { motion } from 'motion/react';

const features = [
  { icon: Mic, title: "Voice Calling", desc: "Crystal clear, secure voice calls." },
  { icon: MessageCircle, title: "Voice Messaging", desc: "Asynchronous voice notes." },
  { icon: Shield, title: "Private Voice Inbox", desc: "Your voice, your rules." },
  { icon: Search, title: "Username Search", desc: "Find anyone by their @handle." },
  { icon: Briefcase, title: "Business Identity", desc: "Professional voice presence." },
  { icon: Zap, title: "Future Features", desc: "AI translation & time capsules." },
];

export default function Features() {
  return (
    <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
      <h2 className="text-4xl font-extrabold tracking-tighter text-center mb-16">Why VoiceID?</h2>
      <div className="grid md:grid-cols-3 gap-10">
        {features.map((f, i) => (
          <motion.div 
            key={i} 
            whileHover={{ y: -10 }}
            className="p-8 bg-gray-50 rounded-3xl hover:bg-white hover:shadow-2xl transition duration-300 border border-transparent hover:border-gray-100"
          >
            <f.icon className="text-blue-600 mb-6" size={32} />
            <h3 className="text-xl font-bold mb-3">{f.title}</h3>
            <p className="text-gray-600">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
