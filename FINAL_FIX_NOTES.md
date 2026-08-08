# VoiceID APK Calling — Final Relay Fix

Only `src/context/VoiceCallContext.tsx` was changed.

## Change
`RTCPeerConnection` now uses:
- `iceTransportPolicy: 'relay'`
- `bundlePolicy: 'max-bundle'`
- `rtcpMuxPolicy: 'require'`

The existing Metered TURN list remains unchanged, including UDP/80, TCP/80,
UDP/443 and TURNS/TCP/443.

## Reason
The supplied two-device diagnostics showed SDP offer/answer recovery working
and relay candidates being gathered on both devices, but ICE stayed in
`checking` and the connection stayed `connecting`. This APK-local change
forces the media path through the configured TURN relay instead of waiting for
a direct host/srflx path on mobile-carrier NAT.

## Not changed
- Web version
- Supabase schema
- signaling channel/event names
- offer/answer payload format
- call database logic

## Security
The current source contains the testing TURN credential. Do not publish this
source publicly with that credential. Rotate the credential after testing if
it is a real provider credential.
