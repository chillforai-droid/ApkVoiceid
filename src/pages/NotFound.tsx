import { Link } from 'react-router-dom';
import { Home, Search, HelpCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

const helpfulLinks = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Secure Messaging', path: '/secure-messaging', icon: Search },
  { label: 'Help Center', path: '/help', icon: HelpCircle },
];

export default function NotFound() {
  useSEO({
    title: 'Page Not Found | VoiceID',
    description: 'The page you were looking for doesn\u2019t exist. Head back to VoiceID or explore secure messaging, voice notes, and calls.',
    canonical: 'https://voiceid.online/404',
    robots: 'noindex, follow',
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow flex flex-col items-center justify-center text-center px-6 py-24">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-600 mb-4">404</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tighter mb-4">We couldn&rsquo;t find that page</h1>
        <p className="text-lg text-gray-600 mb-10 max-w-md">
          The page you were looking for may have moved or no longer exists. Here are a few places to go instead.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {helpfulLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-black rounded-full hover:bg-gray-800 transition"
              >
                <Icon size={16} aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
