import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export const homeFaqs = [
    { q: "Do I need a phone number?", a: "No, VoiceID replaces the need for a phone number for communication — you sign up and connect using a username instead." },
    { q: "Is it secure?", a: "Yes, all communications on VoiceID — text, voice notes, and calls — are end-to-end encrypted." },
    { q: "Is it free?", a: "Personal accounts are free, including messaging, voice notes, and calls." },
];

export default function FAQ() {
    const [open, setOpen] = useState<number | null>(0);

    return (
        <section className="py-20 px-6 max-w-3xl mx-auto" aria-labelledby="home-faq-heading">
            <h2 id="home-faq-heading" className="text-4xl font-extrabold tracking-tighter text-center mb-16">FAQ</h2>
            <div className="space-y-4">
                {homeFaqs.map((faq, i) => {
                    const panelId = `home-faq-panel-${i}`;
                    return (
                        <div key={i} className="border-b border-gray-100">
                            <h3 className="m-0">
                                <button
                                    onClick={() => setOpen(open === i ? null : i)}
                                    aria-expanded={open === i}
                                    aria-controls={panelId}
                                    className="flex justify-between items-center gap-4 w-full py-4 text-left font-bold"
                                >
                                    <span>{faq.q}</span>
                                    <ChevronDown className={`shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} aria-hidden="true" />
                                </button>
                            </h3>
                            <AnimatePresence>
                                {open === i && (
                                    <motion.div
                                        id={panelId}
                                        role="region"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <p className="pb-4 text-gray-600">{faq.a}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
