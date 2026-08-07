# VoiceID Calling Fix — focused pass

## Root cause addressed
The previous mobile call handshake depended on an ephemeral `receiver-ready` Supabase Broadcast. Even with retries, the caller only created an SDP offer when that transient broadcast arrived. If the event was missed or channel timing differed between the two phones, the receiver stayed `Connecting` and the caller stayed `Calling`/`Connecting` because SDP negotiation never started.

## New handshake
- The `calls` database row is now the durable acceptance signal.
- Receiver first subscribes to `voice-call:{callId}` and only after `SUBSCRIBED` updates the call row to `accepted`.
- Caller subscribes to both its signaling channel and call-row updates.
- When caller sees durable `accepted` and its signaling channel is ready, it creates exactly one SDP offer.
- Caller also queries current call status after subscription, covering a realtime UPDATE race.
- `offerStarted` prevents duplicate offers.
- Offer/answer remain on the existing compatible Supabase broadcast channel; ICE queuing is preserved.

This changes only mobile calling and does not alter chat/media/theme/backend schema.

## Ringtone
Incoming side now initializes Android in-call audio management before requesting the system default ringtone. Caller-side ringback remains disabled. Ringtone is stopped by existing accept/reject/end cleanup.

## Diagnostics
Development logs were added for signaling subscription, call-row status, offer send/receive, answer send/receive, and ringtone failure. No tokens/secrets are logged.

## Important real-device limitation
A successful SDP/ICE handshake can still fail across restrictive carrier NAT if no TURN relay is configured. `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` remain supported. If both phones reach offer/answer but ICE fails, TURN is the next required infrastructure step.
