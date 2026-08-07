# VoiceID APK ↔ Web calling protocol alignment

Compared against `VoiceID-main/src/context/VoiceCallContext.tsx` and the native reference `app/.../WebRtcCallManager.kt`.

## Root incompatibility found
The APK had been changed to use `calls.status = accepted` as the caller's trigger for creating an SDP offer. The production web client does not use that as its signaling trigger. It waits for a Supabase Realtime broadcast named `receiver-ready` on `voice-call:{callId}`.

That difference meant Web ↔ APK and even APK timing could stall with one side at Calling and the other at Connecting.

## Protocol restored
- Channel: `voice-call:{callId}`
- Receiver subscribes first.
- Receiver broadcasts `receiver-ready`.
- Receiver then updates the DB call row to `accepted`.
- Caller creates/sends `offer` only after receiving `receiver-ready`.
- Receiver sends `answer` after setting the offer as remote description.
- Both sides exchange `ice-candidate` broadcasts.
- ICE received before remoteDescription is queued and flushed afterward.

## Payload compatibility
SDP broadcasts are now explicitly plain JSON objects:
`{ type, sdp }`

ICE remains the WebRTC-compatible candidate object (`candidate`, `sdpMid`, `sdpMLineIndex`).

## Ringtone
Caller ringback remains disabled. Incoming receiver uses Android default ringtone only. `InCallManager.start()` is no longer started before the incoming ringtone; call audio mode starts when the WebRTC connection is established.

## Backend
No API or database schema changes were made. Existing `calls` table and Supabase Realtime protocol are preserved.

## Network note
The web reference uses Google STUN and has no TURN server. This patch fixes signaling compatibility; if SDP offer/answer exchange succeeds but ICE still cannot connect on specific carrier/NAT combinations, TURN is the next infrastructure requirement.
