-- VoiceID APK reliable WebRTC handshake.
-- Broadcast remains the fast path; these columns provide durable recovery
-- when a receiver/caller misses a one-shot Supabase Realtime broadcast.
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS offer_sdp TEXT,
  ADD COLUMN IF NOT EXISTS answer_sdp TEXT;
