import { Phone, Mic, Search } from 'lucide-react';
import { motion } from 'motion/react';

const actions = [
  { icon: Phone, label: 'Start Voice Call', color: 'bg-blue-50 text-blue-600' },
  { icon: Mic, label: 'Send Voice Message', color: 'bg-purple-50 text-purple-600' },
  { icon: Search, label: 'Search VoiceID', color: 'bg-emerald-50 text-emerald-600' },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {actions.map((action) => (
        <motion.button
          key={action.label}
          whileHover={{ y: -4 }}
          className={`p-6 rounded-2xl border border-gray-100 flex flex-col items-center gap-4 ${action.color}`}
        >
          <action.icon size={28} />
          <span className="font-semibold">{action.label}</span>
        </motion.button>
      ))}
    </div>
  );
}
