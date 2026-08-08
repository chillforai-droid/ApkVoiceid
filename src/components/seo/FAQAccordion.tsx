import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FaqItem {
  q: string;
  a: string;
}

/** Builds the schema.org FAQPage JSON-LD block for a list of Q&A pairs. */
export function faqJsonLd(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.a,
      },
    })),
  };
}

export default function FAQAccordion({ items, heading = 'Frequently Asked Questions' }: { items: FaqItem[]; heading?: string }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-20 px-6 max-w-3xl mx-auto" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-center mb-16">{heading}</h2>
      <div className="space-y-4">
        {items.map((faq, i) => {
          const panelId = `faq-panel-${i}`;
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
