import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';
import { Copy, Mail } from 'lucide-react';

export default function ContactPage() {
    useSEO({
        title: 'Contact VoiceID | Help & Support',
        description: 'Contact VoiceID for account help, technical issues, bug reports, privacy questions and general support.',
        canonical: 'https://voiceid.online/contact'
    });

    const [copied, setCopied] = useState(false);
    const email = 'voiceidteam@gmail.com';

    const copyToClipboard = () => {
        navigator.clipboard.writeText(email).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
        });
    };

    return (
        <div className="min-h-screen flex flex-col bg-white">
            <Navbar />
            <main className="flex-grow pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6 max-w-2xl mx-auto">
                <h1 className="text-4xl font-extrabold tracking-tighter mb-6">Contact VoiceID</h1>
                <p className="text-lg text-gray-600 mb-8">Need help, have a question, or want to report a problem? Contact the VoiceID team by email.</p>

                <div className="bg-gray-50 p-6 sm:p-8 rounded-3xl border border-gray-100 mb-8">
                    <p className="text-lg sm:text-2xl font-bold mb-6 break-all">{email}</p>
                    <div className="flex flex-wrap gap-3 sm:gap-4">
                        <a href={`mailto:${email}?subject=VoiceID%20Support%20Request`} className="px-6 py-3 bg-blue-600 text-white rounded-full flex items-center gap-2 hover:bg-blue-700">
                            <Mail size={18} /> Email Support
                        </a>
                        <button onClick={copyToClipboard} className="px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-full flex items-center gap-2 hover:bg-gray-100">
                            <Copy size={18} /> {copied ? 'Email copied' : 'Copy Email'}
                        </button>
                    </div>
                </div>

                <div className="space-y-6 text-gray-700">
                    <h2 className="text-xl font-bold text-black">Support Categories</h2>
                    <p>You can reach out to us regarding:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Account problems</li>
                        <li>Technical issues</li>
                        <li>Bug reports</li>
                        <li>Voice/message/calling issues</li>
                        <li>Privacy concerns</li>
                        <li>Safety or abuse reports</li>
                        <li>General questions</li>
                        <li>Feature suggestions</li>
                    </ul>

                    <div className="bg-yellow-50 p-6 rounded-2xl border border-yellow-100 text-sm text-yellow-800 mt-8">
                        <p><strong>For your security, never send your password, OTP, authentication code, or other sensitive login information by email.</strong></p>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
