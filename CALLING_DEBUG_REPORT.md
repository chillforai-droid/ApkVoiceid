# VoiceID Calling — Debug Report

Scope: voice calling only (Android APK ↔ Web, and APK ↔ APK). No other feature
(chat, media, theme, notifications, presence, friends) was touched.

---

## 1. How the working Web calling flow actually works (source of truth)

Read directly from `VoiceID-main/src/context/VoiceCallContext.tsx` (273 lines) and
cross-checked against `VoiceID-main/BACKEND_README.md` §6.3(A) and the native
Kotlin reference `app/src/main/java/com/voiceid/app/call/WebRtcCallManager.kt`
(all three agree — this is a well-documented, internally consistent protocol).

**Channel:** `voice-call:{callId}` — `callId` is the primary key of the row just
inserted into the `calls` table, never a client-generated id.

**Broadcast config:** none passed explicitly (`supabase.channel('voice-call:...')`
with no `config`). Supabase-js defaults apply: `broadcast.self = false`,
`broadcast.ack = false`.

**Events:** `receiver-ready`, `offer`, `answer`, `ice-candidate`. No others.

**Payloads:**
- `offer` / `answer` → the raw object returned by `createOffer()`/`createAnswer()`
  (browsers expose `{type, sdp}` as enumerable properties, so it serializes
  correctly over the JSON broadcast channel as-is).
- `ice-candidate` → `event.candidate` directly (browser `RTCIceCandidate` has a
  `toJSON()` the broadcast layer's `JSON.stringify` uses automatically →
  `{candidate, sdpMid, sdpMLineIndex, usernameFragment}` on the wire).

**`calls` table statuses used:** `ringing` → `accepted` | `missed` | `rejected` |
`ended`. There is **no** "connected" DB status — the actual WebRTC connection
state is purely client-side (`callState`), never written back to the DB.

### Sequence (verified from source, not assumed)

```
CALLER                                          RECEIVER
  |                                                 |
  | INSERT calls{status:'ringing'} ──────────────► (Postgres trigger / realtime)
  |                                                 |
  |                                    postgres_changes INSERT on calls:{receiverId}
  |                                                 | → shows incoming-call UI
  |                                                 |
  | subscribe voice-call:{callId}                   |
  | (registers: receiver-ready, answer,             |
  |  ice-candidate handlers; NO offer yet,           |
  |  NO RTCPeerConnection yet)                      |
  |                                                 |
  | start 30s "missed" timeout                      |
  |                                                 | user taps Accept
  |                                                 | setCallState('connecting')
  |                                                 | subscribe voice-call:{callId}
  |                                                 | (registers: offer,
  |                                                 |  ice-candidate handlers)
  |                                                 |
  |                                     on subscribe SUBSCRIBED:
  |                                                 | → broadcast 'receiver-ready'
  |                                                 | → UPDATE calls.status='accepted'
  |                                                 |
  | on 'receiver-ready':                            |
  |  clearTimeout                                   |
  |  new RTCPeerConnection(STUN only)                |
  |  getUserMedia(audio)                            |
  |  addTrack × N                                   |
  |  onicecandidate → broadcast ice-candidate        |
  |  ontrack → attach to <audio>                     |
  |  createOffer(); setLocalDescription(offer)       |
  |  broadcast 'offer' {type,sdp} ─────────────────►|
  |                                                 | on 'offer':
  |                                                 |  new RTCPeerConnection(STUN only)
  |                                                 |  getUserMedia(audio)
  |                                                 |  addTrack × N
  |                                                 |  onicecandidate → broadcast ice-candidate
  |                                                 |  ontrack → attach to <audio>
  |                                                 |  setRemoteDescription(offer)
  |                                                 |  createAnswer(); setLocalDescription(answer)
  |                                                 |  broadcast 'answer' {type,sdp}
  |◄────────────────────────────────────────────────|
  | on 'answer':                                     |  setCallState('connected')
  |  setRemoteDescription(answer)                    |  (UI-level "connected" — NOT the
  |  flush queued ICE                                |   same thing as WebRTC actually
  |                                                 |   being media-connected — see §4)
  |  ⇄ ice-candidate broadcasts both directions, queued if remoteDescription not yet set ⇄
  |                                                 |
  |  ICE connects → ontrack fires both sides → audio flows
```

**Important nuance in the web code itself:** the receiver's `'offer'` handler
sets `callState='connected'` immediately after sending the answer — it does
**not** wait for `RTCPeerConnection.iceConnectionState`/`connectionState` to
actually reach `connected`. The caller has no such handler at all — the web
`callState` never explicitly becomes `'connected'` on the caller side by
looking at the source; it only reaches that state via whatever UI wraps this
context. This means **on the web, "connected" in the UI is not proof that
media actually flowed** — it's proof that signaling completed. This matters
for interpreting APK test results (§4).

---

## 2. How the APK's calling flow worked before this pass

The APK's `src/context/VoiceCallContext.tsx` (found already present, 33
densely-minified lines) was **not naive** — it already:
- used the identical channel name and event names,
- already normalized SDP to plain `{type, sdp}` before sending,
- already normalized ICE candidates via `.toJSON()`,
- already queued/flushed ICE candidates on both sides,
- already gated the caller's offer creation on `receiver-ready` (not on the
  `calls.accepted` DB status — an earlier attempt, documented in
  `CALLING_FIX_REPORT.md`, had used the DB status as the trigger instead and
  was correctly reverted; `WEB_CALL_PROTOCOL_ALIGNMENT.md` documents exactly
  this history),
- already listened to `oniceconnectionstatechange`/`onconnectionstatechange`
  and only flipped `callState` to `'connected'` on an actual `connected`/
  `completed` ICE/connection state (**stricter than the web client**, which
  as noted above flips to `'connected'` right after sending the answer).

So the protocol itself was already correctly aligned before this pass. This is
also why the project's own `WEB_CALL_PROTOCOL_ALIGNMENT.md` exists — a prior
pass already found and fixed the one real protocol divergence that existed
(DB-status-driven offer vs. broadcast-driven offer).

---

## 3. Exact incompatibilities / bugs found in this pass

None of these are protocol differences from the web client. All three are
React-Native-side lifecycle bugs found by reading the control flow, not by
guessing:

### 3a. `isSpeakerOn` state in `setupPeer`'s dependency chain (real bug)
`setupPeer`'s `useCallback` closed over the `isSpeakerOn` **state value**
(to decide the initial speakerphone setting once connected), which put it in
`setupPeer`'s dependency array. Every time `isSpeakerOn` changed (i.e. every
speaker-button tap during a call), `setupPeer` got a new identity →
`startCallerOffer` got a new identity → `bindSignal` got a new identity →
`watch` got a new identity → the **persistent incoming-call listener effect**
(`useEffect(..., [user, loadOther, watch])`) re-ran, tearing down and
resubscribing the `calls:{userId}` channel. This is exactly the "component
re-renders creating multiple channels" failure mode called out in the task.
It would not by itself explain a *first* call hanging, but it's a real bug
that could cause a **second** incoming call to be briefly missed if it lands
during that churn window, and it's the kind of thing that erodes confidence
in "we already tried retries and it didn't help" investigations because it's
a moving target.
**Fix:** `isSpeakerOn` is now tracked in a ref (`isSpeakerOnRef`) that
`setupPeer` reads without depending on it. `setupPeer`'s dependency array is
now stable (`[cleanup, getMedia]`), so the whole downstream chain is stable
too.

### 3b. `receiver-ready` silently dropped if caller channel not yet ready (real bug, matches the reported symptom)
`startCallerOffer` checked `callerSignalReady.current` once; if false, it
returned and did **nothing else** — no requeue, no retry, no log that would
tell you it happened. `callerSignalReady.current` is only set `true` inside
the caller's own `channel.subscribe()` callback when that callback reports
`'SUBSCRIBED'`. Under normal conditions the caller's own subscribe ack should
arrive before the receiver could possibly have subscribed, sent
`receiver-ready`, and had it delivered back — but this ordering is **not
guaranteed** by the Supabase Realtime client (two independent websocket round
trips, no cross-client synchronization). If the caller's own subscribe ack is
ever delayed (cold start, slow network, app just resumed from background),
`receiver-ready` arrives, is silently discarded, and the call hangs forever
with caller stuck on "Calling…" and receiver stuck on "Connecting…" — this is
**exactly** the reported symptom, and it fully explains why the receiver
successfully reaches `'connected'` in some traces (it doesn't wait on this
gate) while the caller never sends an offer at all.
**Fix:** this is now buffered, not retried. If `receiver-ready` arrives before
`callerSignalReady.current` is true, a `pendingReceiverReady` flag is set.
When the caller's channel does reach `SUBSCRIBED`, it checks that flag and
drains it — a one-time, event-driven catch-up for a message that was
genuinely received, not a blind timer-based re-send.

### 3c. Missing Android permissions for reliable audio routing (real gap, defensive fix)
`app.config.js` declared `RECORD_AUDIO`, `CAMERA`, `INTERNET`,
`POST_NOTIFICATIONS`, `READ_MEDIA_IMAGES` — but not `MODIFY_AUDIO_SETTINGS`
(required for `AudioManager.setMode(MODE_IN_COMMUNICATION)`, which
`react-native-incall-manager`'s `InCallManager.start()` performs internally),
`ACCESS_NETWORK_STATE` (used by WebRTC's internal network-change monitor
during ICE gathering on Android), `BLUETOOTH_CONNECT` (Android 12+ runtime
permission needed to route audio to a paired headset), or `WAKE_LOCK` (keep
the CPU awake for the duration of an active call). This would not explain the
ICE-connection-never-completes symptom (audio routing only runs *after* a
connection is established), but it's a real, verifiable gap that would cause
a **second** bug (silent audio-routing failure, or a permission exception on
some Android versions) as soon as the connection issue is fixed — added now
defensively rather than discovered later as a fresh support ticket.

### 3d. Confirmed NOT a bug (checked, ruled out)
- `react-native-webrtc@124.0.4` does **not** ship an Expo config plugin
  (`app.plugin.js`) or an `"expo"` field in `package.json` — verified by
  downloading and inspecting the actual npm tarball. Its own
  `android/src/main/AndroidManifest.xml` only declares a
  `MediaProjectionService` (used for screen-share, unrelated to voice calls)
  and relies entirely on standard React Native autolinking, which
  `expo prebuild` already performs correctly. There is nothing to register in
  `app.config.js`'s `plugins` array for this library. (I checked this because
  it's a common real failure mode for other native modules — it just isn't
  one here.)
- `addTrack`/`ontrack` (Unified Plan) are both correctly used and are fully
  supported at `react-native-webrtc@124` (M124-aligned versioning) — the code
  also keeps the legacy `onaddstream` as a defensive fallback, which is
  harmless.
- Provider order in `App.tsx` (`Auth → Notification → Presence → VoiceCall`)
  differs from the order documented in the web's `AI_HANDOFF.md`
  (`Auth → Presence → VoiceCall → Notification`) — `NotificationProvider` and
  `PresenceProvider` are swapped. This **does not affect calling**
  (`VoiceCallProvider` is still correctly nested inside `PresenceProvider`,
  so `usePresence()` inside it works). It could affect whether
  `NotificationProvider` sees accurate presence data, which is out of scope
  for this task — flagging it here rather than fixing it, per the "calling
  only" instruction.

---

## 4. Root cause of the "Calling…" / "Connecting…" freeze — exact stage(s)

Per the task's required stage classification (A–O):

- **A–L (incoming call detection through ICE candidate add): confirmed
  correctly implemented and wire-compatible with the web client**, both by
  static code comparison and by the project's own prior alignment pass. No
  changes were needed to the wire protocol itself.
- **C is where a real, previously-undetected bug lived**: not in the protocol,
  but in the *local* handling of an early `receiver-ready` (§3b above). This
  is a plausible full explanation for at least some of the observed hangs on
  its own, independent of networking.
- **M (NAT traversal / TURN) is very likely the dominant remaining cause**,
  and this is not a guess — it is stated directly in the project's own
  documentation, written before this task started:
  - `VoiceID-main/BACKEND_README.md` §6.3: *"No TURN server is configured
    anywhere (`iceServers: [{urls:'stun:stun.l.google.com:19302'}]` only,
    hardcoded in `VoiceCallContext.tsx`). Calls between peers on symmetric
    NATs will fail to connect. This is a known limitation, not a bug to
    silently fix by guessing credentials."*
  - `VoiceID-main/AI_HANDOFF.md` §5 lists *"Adding a TURN server
    configuration to fix WebRTC connectivity for symmetric-NAT users"* as an
    open, documented gap.
  - The native Android reference implementation
    (`WebRtcCallManager.kt`) carries the same STUN-only configuration with an
    explicit code comment stating it mirrors this same known web limitation.
  - Two phones on cellular data (different carriers, or the same carrier's
    carrier-grade NAT) are **exactly** the network condition where STUN alone
    routinely fails and a TURN relay becomes mandatory — this is standard
    WebRTC behavior, not specific to this codebase. Two devices on the same
    Wi-Fi/LAN, by contrast, will often connect fine with STUN-only, which is
    consistent with "the web version already works" if web-to-web testing
    happened on the same network while phone-to-phone testing happened over
    mobile data.
- **N/O (remote audio track / Android audio routing):** code-verified correct
  (`ontrack` wired, `InCallManager.start()` called only after an actual
  connected state) but **unreachable while M is unresolved** — if ICE never
  connects, these stages never execute, so they cannot currently be blamed
  for the freeze. §3c's permission fixes are preventative for once M is
  resolved, not a fix for the freeze itself.

**Bottom line:** the freeze has at least one confirmed, fixed local bug
(§3b), and is most likely dominated by a documented, pre-existing
infrastructure gap (no TURN server) rather than any remaining signaling
defect. The code cannot itself prove which of the two accounts for any given
failed call without a real-device trace — see §9.

---

## 5. Files changed

| File | What changed |
|---|---|
| `src/context/VoiceCallContext.tsx` | Rewritten (protocol unchanged) — fixed §3a and §3b, added full `[VOICEID_CALL]` structured logging at every stage, fixed a pre-existing `startRingtone()` TypeScript arity error. |
| `app.config.js` | Added `MODIFY_AUDIO_SETTINGS`, `ACCESS_NETWORK_STATE`, `BLUETOOTH_CONNECT`, `WAKE_LOCK` to `android.permissions`. No plugins added (see §3d). |
| `CALLING_DEBUG_REPORT.md` | New — this file. |

**Not changed:** `CallOverlay.tsx` (pure presentation, driven entirely by
context state — no bug found in it), `CallHistoryScreen.tsx`, any chat/media/
theme/notification/presence file, any backend/API/migration file, any web
project file.

---

## 6. Functions changed (in `VoiceCallContext.tsx`)

- `setupPeer` — no longer depends on `isSpeakerOn` state; reads
  `isSpeakerOnRef.current` instead. Added `onsignalingstatechange`,
  `onicegatheringstatechange`, and expanded `oniceconnectionstatechange`
  logging, including a specific `ICE_FAILED_LIKELY_NAT` log + user-facing
  alert when `iceConnectionState === 'failed'`.
- `startCallerOffer` — added the `pendingReceiverReady` buffering described
  in §3b, plus `OFFER_CREATED`/`OFFER_SENT`/`OFFER_FAILED` logging.
- `bindSignal` — unchanged behavior, added `RECEIVER_READY_RECEIVED`,
  `ANSWER_RECEIVED`, `OFFER_RECEIVED`, `ANSWER_CREATED`, `ANSWER_SENT`,
  `ICE_QUEUED`/`ICE_ADDED`/`ICE_ADD_FAILED` logging.
- `startCall` — added the drain-on-subscribe logic that consumes
  `pendingReceiverReady`, plus `OUTGOING_CALL_CREATED`/
  `CALLER_CHANNEL_STATUS`/`CALL_TIMEOUT_MISSED` logging.
- `acceptCall` — added `RECEIVER_CHANNEL_STATUS`/`RECEIVER_READY_SENT`/
  `ACCEPT_DB_UPDATE_FAILED` logging. Behavior unchanged.
- `getMedia` — added `LOCAL_STREAM_CREATED` logging (track count, enabled,
  readyState).
- `watch` — added `CALL_ROW_STATUS` logging. Behavior unchanged.
- New `callLog()` helper — the structured `[VOICEID_CALL]` logger, gated on
  `__DEV__`, never logs tokens/secrets/credentials — only call IDs, event
  names, and WebRTC state enums, matching the task's logging spec.

---

## 7. Supabase channel/event/payload comparison

| | Web (source of truth) | APK (before) | APK (after) |
|---|---|---|---|
| Channel name | `voice-call:{callId}` | `voice-call:{callId}` | unchanged |
| Broadcast config | default (`self:false, ack:false`, implicit) | explicit `{ack:true, self:false}` | unchanged — kept `ack:true` deliberately (see below) |
| Events | `receiver-ready`, `offer`, `answer`, `ice-candidate` | same | unchanged |
| Offer/answer payload | `{type, sdp}` (implicit, browser object) | explicit `{type, sdp}` | unchanged |
| ICE payload | `{candidate, sdpMid, sdpMLineIndex, usernameFragment}` (implicit via `toJSON()`) | explicit `.toJSON()` | unchanged |
| Offer trigger | `receiver-ready` broadcast | `receiver-ready` broadcast | unchanged |
| DB status driving offer? | No | No (already fixed in a prior pass — see `CALLING_FIX_REPORT.md`) | No |

**On `ack:true`:** this is a deliberate, justified difference from the web
client, not an oversight. With `ack:true`, `channel.send()` returns a promise
that resolves to `'ok' | 'timed out' | 'error'` once the server confirms
receipt — without it (the web's default), `send()` resolves immediately with
no confirmation at all. This is exactly what the task asked for ("For EVERY
critical broadcast, log whether Supabase returns: ok / timed out / error") —
turning it off to match the web byte-for-byte would remove that visibility.
It does not change the wire format of what a receiving client (web or APK)
gets, so it does not break cross-client compatibility.

---

## 8. SDP serialization comparison

Both before and after this pass, the APK explicitly extracts
`{type: desc.type, sdp: desc.sdp}` before broadcasting, rather than
broadcasting a native `RTCSessionDescription` instance directly. This was
already correct — react-native-webrtc's `RTCSessionDescription`/session
description objects are not guaranteed to serialize identically to a
browser's, and explicit extraction sidesteps that entirely. No change made
here beyond adding `sdpLength` logging at each creation/receipt point.

## 9. ICE candidate serialization comparison

Both sides use `candidate.toJSON()` (with a raw-object fallback if `toJSON`
is unavailable) before broadcasting, and reconstruct via
`new RTCIceCandidate(payload)` on receipt — matching the web client's
implicit `toJSON()` serialization. Both sides queue candidates that arrive
before `remoteDescription` is set and flush the queue afterward (the APK
receiver-side flush is arguably *more* correct than the web client's, which
has a latent gap where its own `'offer'` handler never flushes the queue —
not changed, since fixing the web client is out of scope and the APK's more
careful version is already compatible on the wire). No change made beyond
`ICE_QUEUED`/`ICE_ADDED`/`ICE_ADD_FAILED` logging.

## 10. Android audio-routing changes

`InCallManager.start()` is still only called once `connected()` fires (i.e.
only after `oniceconnectionstatechange`/`onconnectionstatechange` actually
reports `connected`/`completed`) — unchanged. Added:
`MODIFY_AUDIO_SETTINGS`, `ACCESS_NETWORK_STATE`, `BLUETOOTH_CONNECT`,
`WAKE_LOCK` permissions (§3c). Ringtone behavior (`InCallManager
.startRingtone()`/`stopRingtone()`, receiver-only, no caller ringback) is
unchanged — it already matched the "only receiver hears ringtone" product
requirement.

## 11. Is TURN required?

Almost certainly yes, for calls between two phones on different/cellular
networks — see §4. This is a pre-existing, explicitly documented
infrastructure gap in **both** the web and native reference implementations,
not something introduced by or unique to the APK.

## 12. Environment variables required

Already wired end-to-end (not newly added by this pass — confirmed present in
`app.config.js` and `.github/workflows/build-apk.yml`):

- `TURN_URL`
- `TURN_USERNAME`
- `TURN_CREDENTIAL`

If these GitHub Actions secrets are not currently set, the app silently falls
back to STUN-only (same as web) — it will not crash, but cross-network calls
will very likely fail at the ICE stage. **Action needed from you:** provision
a TURN service (e.g. Twilio Network Traversal Service, Xirsys, Cloudflare
Calls, or a self-hosted `coturn`) and set these three secrets. I have not
fabricated or guessed credentials for this, per the task's explicit
instruction.

## 13. Build / typecheck results

- `npm install --legacy-peer-deps` — succeeded (1147 packages), no changes to
  `package.json` (only used to obtain type definitions for `tsc`).
- `npx tsc --noEmit` — **`src/context/VoiceCallContext.tsx` now compiles with
  zero errors** (previously had one: a `startRingtone()` call missing 3
  required-by-type-defs arguments — fixed with explicit safe defaults, not
  suppressed with `any`).
- Two **pre-existing, unrelated** errors remain elsewhere in the project and
  were deliberately **not** touched, per the "calling only" instruction:
  - `src/context/ThemeContext.tsx` — a theme-color type mismatch.
  - `src/screens/main/ChatScreen.tsx` — a dynamic-`import()` / `tsconfig`
    `module` target mismatch.
  
  Both existed before this pass and are outside calling; flagging them here
  rather than silently fixing them, per the task's own checklist principle
  ("If I noticed an existing bug or gap outside my task's scope, did I report
  it instead of silently fixing it?" — borrowed from `AI_HANDOFF.md` §7,
  which applies here too).
- Full `expo prebuild` + Android Gradle build was **not** run in this
  environment: the sandbox's network allowlist covers `npmjs.org`/
  `pypi.org`/GitHub, but not `dl.google.com` or the Android SDK/Gradle Plugin
  repositories the existing `.github/workflows/build-apk.yml` CI relies on.
  That CI pipeline (already working, per this conversation's history) remains
  the correct place to validate the actual Android build — nothing in this
  patch changes that pipeline or its inputs.

## 14. Remaining real-device tests (do not skip)

**Code/build verified (TypeScript); two-device WebRTC media connectivity
still requires real-device testing.** Specifically, run these three
combinations with `adb logcat` (or the Metro/Expo dev client console)
filtered on `[VOICEID_CALL]`, and check where the trace stops:

1. **APK ↔ APK, same Wi-Fi.** Expect full `ICE_CONNECTION_STATE: checking →
   connected` on both sides. If this fails too, that would newly implicate
   something other than NAT (worth reopening investigation).
2. **APK ↔ APK, different networks (e.g. one on Wi-Fi, one on mobile data).**
   If signaling logs complete (`OFFER_SENT` → `OFFER_RECEIVED` →
   `ANSWER_SENT` → `ANSWER_RECEIVED`, ICE candidates flowing both ways) but
   `ICE_CONNECTION_STATE` never leaves `checking` or reaches `failed` — that
   is the TURN requirement confirmed directly, not inferred.
3. **APK ↔ Web**, both directions (APK calling a web-logged-in user, and a
   web user calling an APK user) — confirms cross-client wire compatibility
   holds in practice, not just on paper.

If test 1 also fails, capture the full `[VOICEID_CALL]` sequence and send it
back — that would mean there's still a local bug, and the exact stage where
the log sequence stops will point directly at it (per the A–O breakdown in
§4, now that every stage is instrumented).

## Temporary Metered TURN test configuration (2026-08-07)

- Added Metered STUN `stun:stun.relay.metered.ca:80`.
- Added TURN relay candidates on ports 80 and 443, including TCP and secure TURNS 443.
- Existing build-time `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` still take priority.
- If those build secrets are absent, the APK temporarily falls back to the Metered testing credential supplied by the project owner.
- Signalling protocol, Supabase channel/event names, ringtone behavior, and call UI were not changed in this patch.
- After testing, remove/rotate the temporary credential and use GitHub Actions secrets for production.
