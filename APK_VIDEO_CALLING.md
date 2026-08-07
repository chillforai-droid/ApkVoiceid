# APK-only Video Calling

- Chat header has a blue video-camera button beside the voice-call button.
- Video uses the existing Supabase calls row + realtime WebRTC signaling; no website UI changes are required.
- The SDP offer tells the receiver whether the accepted call is video, so the existing calls table does not need a schema migration.
- Controls: mic mute, speaker/handset, camera on/off, front/back camera switch, local preview, remote full-screen video, timer and end call.
- Android CAMERA and RECORD_AUDIO permissions are already declared in app.config.js.
- TURN_URL / TURN_USERNAME / TURN_CREDENTIAL are strongly recommended for mobile-network reliability.
