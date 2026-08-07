# VoiceID Calling — Durable SDP Fix

## Exact failure proven by device diagnostics
Caller reached OFFER_SENT and generated TURN relay candidates, while receiver never logged OFFER_RECEIVED. Therefore TURN was working and the one-shot Supabase Broadcast offer was being missed/not processed.

## Fix
- Broadcast is retained as the fast path for web compatibility.
- Caller persists `offer_sdp` to `calls` before broadcasting offer.
- Receiver consumes offer from either Broadcast, postgres_changes, or a 500ms DB fallback poll.
- Receiver persists `answer_sdp` before broadcasting answer.
- Caller consumes answer from Broadcast, postgres_changes, or a 500ms DB fallback poll.
- SDP de-duplication prevents the same offer/answer from being processed twice.
- ICE candidates continue over Realtime; TURN relay generation was already confirmed by diagnostics.

## REQUIRED ONE-TIME DATABASE STEP
Run `supabase/migrations/20260807000000_add_persistent_call_sdp.sql` in Supabase SQL Editor before testing this APK.

SQL:
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS offer_sdp TEXT,
  ADD COLUMN IF NOT EXISTS answer_sdp TEXT;

No RLS policy change is required because existing calls UPDATE/SELECT policies already allow caller/receiver access to their call row.
