# VoiceID mobile feature/debug candidate

## Important build secrets
- SUPABASE_URL
- SUPABASE_ANON_KEY
- API_BASE_URL=https://www.voiceid.online
- CLOUDINARY_CLOUD_NAME (avatar uploader can also infer it from an existing Cloudinary avatar)
- TURN_URL / TURN_USERNAME / TURN_CREDENTIAL: strongly recommended for calls across carrier/mobile NATs.

## Added in this pass
- WebRTC signaling hardened (broadcast ack, dual STUN, ICE connected/completed state handling).
- Native in-call audio session, system incoming ringtone and caller ringback.
- Speaker / handset and mute controls.
- Contact/chat avatars and online/offline indicator.
- Realtime typing indicator using Supabase Broadcast.
- Image upload progress indicator.
- Long-press message actions: media Download/Share and own-message Delete.
- Avatar Cloudinary cloud-name fallback from existing avatar URL.
- System / Light / Dark theme preference and automatic navigation theme.
- Branded VoiceID launcher icon.

## Call recording
Two-party call recording is intentionally not faked here. Android does not provide a reliable generic API for an ordinary app to capture the remote WebRTC call audio; attempting to start a second microphone recorder can also break the active WebRTC microphone session. A production implementation needs a dedicated native/VoIP recording design plus consent UX and jurisdiction-specific compliance.
