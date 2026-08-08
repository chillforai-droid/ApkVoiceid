import { EyeOff, Users, MessageSquare, Ban, Search, History } from 'lucide-react';
import MarketingLanding from '../../components/seo/MarketingLanding';
import { faqCategories } from '../../data/seoContent';

const faqs = faqCategories.find((c) => c.page === '/private-chat')!.items;

export default function PrivateChat() {
  return (
    <MarketingLanding
      path="/private-chat"
      breadcrumbLabel="Private Chat"
      seoTitle="Private Chat App — One-on-One & Group Chat | VoiceID"
      metaDescription="Chat privately with VoiceID's private chat app. One-on-one and group conversations, protected by end-to-end encryption, without sharing your phone number."
      keywords="private chat app, private chat online, private messaging app, private group chat"
      h1="Private Chat, One Conversation at a Time"
      intro="Whether it's a one-on-one conversation or a private group, VoiceID keeps your chats visible only to the people in them."
      benefits={[
        { icon: EyeOff, title: 'Visible Only to Participants', description: 'Private chats are never searchable or discoverable by anyone outside the conversation.' },
        { icon: Users, title: 'Private Group Chats', description: 'Create group conversations that stay just as private as one-on-one chats.' },
        { icon: MessageSquare, title: 'Encrypted Conversations', description: 'Every private chat is protected with end-to-end encryption, including voice notes.' },
        { icon: Ban, title: 'Block Anyone, Anytime', description: 'You decide who can message you and can block unwanted contacts instantly.' },
        { icon: Search, title: 'Find People by Username', description: 'Start a private chat by searching for someone\u2019s VoiceID username — no phone number needed.' },
        { icon: History, title: 'You Control Your History', description: 'Manage your conversation history directly from the chat interface.' },
      ]}
      howItWorks={[
        { title: 'Pick a username', description: 'Your VoiceID username is the only thing you need to share to start chatting privately.' },
        { title: 'Start a conversation', description: 'Search for a username and start a private one-on-one or group chat.' },
        { title: 'Chat freely', description: 'Send text and voice notes knowing the conversation stays between participants.' },
      ]}
      faqs={faqs}
      relatedLinks={[
        { label: 'Secure Messaging', path: '/secure-messaging' },
        { label: 'Online Chat', path: '/online-chat' },
        { label: 'Voice Messaging', path: '/voice-messaging' },
      ]}
    />
  );
}
