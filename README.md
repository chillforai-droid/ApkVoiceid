# VoiceID

VoiceID is a secure, username-based communication platform that allows users to connect, message, and talk without sharing their personal phone numbers.

## Core V1 Features

- Authentication (Google OAuth)
- VoiceID/user profiles (with username-based URLs)
- Profile avatars (Cloudinary)
- User search
- Contacts/friends
- Realtime text messaging
- Voice messages
- Realtime notifications
- Online presence
- WebRTC voice calling
- Privacy-focused: No phone number required

## Technology Stack

- React (19+)
- TypeScript
- Vite
- Supabase (PostgreSQL, Realtime, Auth)
- WebRTC
- Cloudinary
- Vercel (Deployment)

## Architecture

- **Frontend**: React SPA
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL (Supabase)
- **Realtime**: Supabase Realtime
- **Media storage**: Cloudinary
- **Voice calling**: WebRTC / Supabase Realtime Signaling

## Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CLOUDINARY_CLOUD_NAME`

## Local Development

```bash
npm install
npm run dev
```

## Production

Production domain: https://voiceid.online

