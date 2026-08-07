# VoiceID call + theme repair report

## Root cause: call stuck on Connecting
The call signaling used an ephemeral Supabase Realtime broadcast `receiver-ready` as the only trigger for the caller to create its WebRTC offer. The receiver sent that event only once. A broadcast is not durable: if the caller channel was not fully subscribed at that exact moment, the event could be lost. The receiver then remained on `Connecting...` and the caller stayed on `Calling...` because no SDP offer/answer exchange began.

Repair: receiver-ready is now retried after the receiver channel reaches SUBSCRIBED. Caller-side offer creation is idempotent, so retries cannot create duplicate offers. Existing queued ICE candidate handling is preserved. Connected state is also guarded against duplicate transitions.

## Root cause: caller heard ringing
Outgoing calls explicitly called `InCallManager.startRingback('_DEFAULT_')`, which intentionally played a ringback tone on the caller device. This contradicted the required VoiceID behavior.

Repair: outgoing ringback was removed. Incoming ringtone remains only in the receiver's INSERT handler via `startRingtone('_DEFAULT_')`, and existing `stopTones()` stops it on accept/reject/end/cleanup.

## Root cause: Light mode only worked on some pages
ThemeContext stored a mode and NavigationContainer changed theme, but several screens used hard-coded dark colors (`#0B1220`, `#070D18`, `#172033`, white text) directly in their StyleSheets. Therefore changing navigation theme could not affect those screens.

Repair: ThemeContext now exposes one semantic palette (`background`, `surface`, `surfaceAlt`, `card`, `text`, `textSecondary`, `border`, `input`, etc.). Chats, Call History, Notifications, Chat and Settings consume those colors for the major screen surfaces, text, borders and inputs. System/Automatic continues to listen to Android Appearance changes and the selected mode remains persisted in AsyncStorage.

## Files changed
- src/context/VoiceCallContext.tsx
- src/context/ThemeContext.tsx
- src/screens/main/ConversationsScreen.tsx
- src/screens/main/CallHistoryScreen.tsx
- src/screens/main/NotificationsScreen.tsx
- src/screens/main/ChatScreen.tsx
- src/screens/main/SettingsScreen.tsx
- src/navigation/RootNavigator.tsx

## Backend/API
No backend API contract was changed.

## Important network note
The project already supports optional TURN_URL / TURN_USERNAME / TURN_CREDENTIAL. STUN-only WebRTC can still fail between some mobile networks/NATs even when signaling is correct. For production reliability TURN should be configured.

## Validation limitation
A full local TypeScript/Android build could not be completed in this environment because the package registry available here returned 404 for expo-sharing, so dependencies could not be installed. The final APK must therefore be built by the existing GitHub Actions workflow and tested on two physical phones. The key test is: caller sees Calling, receiver alone hears ringtone, receiver accepts, both move through Connecting to Connected and two-way audio is heard.
