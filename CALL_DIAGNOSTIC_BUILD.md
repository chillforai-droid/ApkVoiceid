# VoiceID Call Diagnostic Build

This build intentionally keeps the current signaling and Metered TURN configuration, and adds an on-device diagnostic panel so failures can be debugged without ADB/Android Studio.

## How to use
1. Install this same APK on both phones.
2. Start a voice call and Accept on the receiver.
3. If it remains on Connecting, tap **Call Debug** on BOTH phones.
4. Take a screenshot of each panel, or tap **Share** and send the generated text report.

## Important stages
- `CALLER_CHANNEL_STATUS • SUBSCRIBED`
- `RECEIVER_CHANNEL_STATUS • SUBSCRIBED`
- `RECEIVER_READY_SENT • result=ok`
- `RECEIVER_READY_RECEIVED`
- `OFFER_CREATED` / `OFFER_SENT • result=ok`
- `OFFER_RECEIVED`
- `ANSWER_CREATED` / `ANSWER_SENT • result=ok`
- `ANSWER_RECEIVED`
- `ICE_LOCAL • type=host/srflx/relay`
- `ICE_REMOTE_RECEIVED`
- `ICE_CONNECTION_STATE • checking/connected/failed`
- `CONNECTION_STATE • connected`
- `REMOTE_TRACK_RECEIVED`
- `MEDIA_CONNECTED`

A `relay` candidate proves the TURN server produced a relay candidate. If both sides exchange offer/answer and relay candidates but ICE still fails, the report will narrow the remaining issue substantially.

No secrets or TURN passwords are included in the diagnostic report.
