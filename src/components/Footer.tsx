import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="py-20 px-6 border-t border-gray-100 bg-gray-50">
      <div className="max-w-7xl mx-auto grid md:grid-cols-5 gap-12">
        <div className="col-span-1">
          <div className="font-bold text-2xl tracking-tighter mb-4">VoiceID</div>
          <p className="text-sm text-gray-500">The world's first Voice Identity Platform.</p>
        </div>
        <nav aria-label="Solutions">
          <h4 className="font-bold mb-4">Solutions</h4>
          <ul className="space-y-2 text-sm text-gray-500">
            <li><Link to="/secure-messaging" className="hover:text-black">Secure Messaging</Link></li>
            <li><Link to="/private-chat" className="hover:text-black">Private Chat</Link></li>
            <li><Link to="/voice-messaging" className="hover:text-black">Voice Messaging</Link></li>
            <li><Link to="/online-chat" className="hover:text-black">Online Chat</Link></li>
            <li><Link to="/browser-chat" className="hover:text-black">Browser Chat</Link></li>
            <li><Link to="/video-calls" className="hover:text-black">Voice &amp; Video Calls</Link></li>
          </ul>
        </nav>
        <nav aria-label="Product">
          <h4 className="font-bold mb-4">Product</h4>
          <ul className="space-y-2 text-sm text-gray-500">
            <li><Link to="/features" className="hover:text-black">Features</Link></li>
            <li><a href="/#security" className="hover:text-black">Security</a></li>
            <li><Link to="/privacy" className="hover:text-black">Privacy</Link></li>
            <li><Link to="/help" className="hover:text-black">Help Center</Link></li>
          </ul>
        </nav>
        <nav aria-label="Company">
          <h4 className="font-bold mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-gray-500">
            <li><a href="/#about" className="hover:text-black">About</a></li>
            <li><Link to="/careers" className="hover:text-black">Careers</Link></li>
            <li><Link to="/blog" className="hover:text-black">VoiceID Blog</Link></li>
          </ul>
        </nav>
        <nav aria-label="Resources">
          <h4 className="font-bold mb-4">Resources</h4>
          <ul className="space-y-2 text-sm text-gray-500">
            <li><Link to="/privacy-policy" className="hover:text-black">Privacy Policy</Link></li>
            <li><Link to="/terms-of-service" className="hover:text-black">Terms of Service</Link></li>
            <li><Link to="/contact" className="hover:text-black">Contact Us</Link></li>
          </ul>
        </nav>
      </div>
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-100 text-sm text-gray-400">
        © 2026 VoiceID Inc. All rights reserved.
      </div>
    </footer>
  );
}
