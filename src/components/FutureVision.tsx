import { motion } from 'motion/react';

export default function FutureVision() {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 max-w-7xl mx-auto overflow-x-hidden">
      <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-center mb-12 sm:mb-16">Future Vision</h2>
      <div className="relative">
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200"></div>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-8 relative">
          {[
            { year: '2026', title: 'Voice Identity' },
            { year: '2027', title: 'AI Voice & Business' },
            { year: '2028', title: 'Global Network' },
          ].map((item, i) => (
            <motion.div key={i} whileHover={{ scale: 1.1 }} className="flex flex-col items-center text-center flex-1 min-w-[100px] max-w-[160px]">
              <div className="w-8 h-8 rounded-full bg-blue-600 border-4 border-white mb-4 shrink-0"></div>
              <h3 className="font-bold text-lg">{item.year}</h3>
              <p className="text-gray-600 text-sm">{item.title}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
