# VoiceID Calling — ICE/SDP Final Fix Report

## 1. ROOT CAUSE

The diagnostics you supplied prove signaling (offer/answer create+persist)
and ICE candidate **gathering** (host/srflx/relay on both sides) all work.
What they do **not** show, on either side, is any `ICE_REMOTE_RECEIVED` /
`ICE_REMOTE_ADDED` entry — i.e. neither side's log shows evidence of actually
receiving the other side's candidates — and neither side shows a selected
candidate pair, because the code never asked WebRTC for that information.
"Relay candidates exist" and "a relay candidate **pair** was selected" are
different facts, and the app was only ever checking/logging the first one.

Concretely, three real bugs combine to produce exactly the symptom you saw
(stuck in `connecting`, eventual false "TURN required" dialog even with TURN
configured):

1. **The answer-resend loop's own completion check was checking the wrong
   side's data and could never be true**, so it always burned all 12 retries
   (9s) instead of confirming delivery — not fatal by itself, but it made the
   signaling path slower and less observable exactly when you needed to see
   whether the answer actually got through.
2. **There was no `getStats()` instrumentation anywhere**, so the app (and
   you) had no way to see whether a candidate pair was ever nominated/
   selected — the single most important fact for this exact symptom — it was
   simply never being asked for.
3. **The failure dialog fired, and blamed TURN, on the wrong signal.**
   `iceConnectionState`/`connectionState` reaching `'connecting'`/`'checking'`
   are normal **in-progress** states, not failure states, but the previous
   `turnUrl ? '...' : 'TURN server की जरूरत है'` messaging implied a missing
   TURN config specifically — which is misleading when TURN candidates are
   demonstrably present, and gives no signal about the real failure (no pair
   selected).

Additionally, **the TURN configuration itself had a latent regression**: if a
`TURN_URL` build secret was ever set, it silently *replaced* the full
4-variant Metered URL list (UDP/80, TCP/80, UDP/443, **TLS-TCP/443**) with
just that one URL — quietly losing the TCP/443 fallback that is specifically
what gets through the most restrictive mobile-carrier NATs/firewalls. This is
consistent with "both sides show relay candidates, but on carrier data
connections in particular, no pair connects" — plain UDP relay (port 80) is
exactly the transport most likely to be silently dropped by carrier
middleboxes, while TCP/443-TLS almost always gets through.

**Bottom line root cause: the app could gather relay candidates but had no
visibility into (and, via the TURN downgrade bug, sometimes lacked) the
specific relay transport most likely to actually work on restrictive mobile
networks, and it reported a misleading "TURN required" cause on a merely
in-progress state instead of a genuine failure.**

---

## 2. FILES CHANGED

- `src/context/VoiceCallContext.tsx` — all fixes below. No other file touched.

No other file in the project (chat, media, theme, notifications, presence,
history UI, backend, migrations) was modified.

---

## 3. EXACT CODE LOGIC FIXED

- `iceServers` construction: now always includes the full 4-variant Metered
  TURN URL array; `TURN_USERNAME`/`TURN_CREDENTIAL` secrets (if set) override
  the credentials used *with* that array instead of replacing it; a distinct
  `TURN_URL` (if it points somewhere other than Metered) is *added* as an
  extra server, never a replacement.
- `setupPeer`: added `logCandidatePairStats(reason)` using
  `RTCPeerConnection.getStats()`, called on `iceConnectionState === 'checking'`,
  `'connected'`/`'completed'`, ICE `'failed'`, `connectionState === 'failed'`,
  and on the new overall-timeout safety net. Logs candidate-pair `state`,
  `nominated`, local/remote `candidateType`, `protocol`, `bytesSent`/
  `bytesReceived`.
- `oniceconnectionstatechange` / `onconnectionstatechange`: failure dialog
  now only fires on a genuine `iceConnectionState === 'failed'` (or the
  independent `connectionState === 'failed'`) — never merely for being in
  `'connecting'`/`'checking'`. Message no longer conditionally blames TURN;
  it's now accurate regardless of TURN status (see §16).
- Added a 45-second overall connection safety-net timer (independent of the
  20s ICE-gathering-wait and 60s DB-answer-recovery-poll timeouts, long
  enough to never fire while those legitimate steps are still running),
  cleared the moment `connected()` runs, guarded so it never fires a
  confusing alert if the user already left the call screen.
- Fixed the answer-resend loop's broken completion check (§7 below).
- Made `ACCEPTED_RECOVERY_TRIGGER` explicitly single-fire per call (§9 state
  machine idempotency).

---

## 4. WEBRTC SIGNALLING FIX

No signaling protocol change. Channel name (`voice-call:{callId}`), event
names (`receiver-ready`/`offer`/`answer`/`ice-candidate`), and the
offer→answer→ICE ordering are unchanged and remain wire-compatible with the
web client and the existing APK↔APK/APK↔Web calls that were already reaching
`accepted`/`have-local-offer`/`stable` correctly per your own diagnostics.

---

## 5. ICE FIX

- Added `getStats()`-based candidate-pair visibility (§1, §3) — this doesn't
  change ICE behavior, it makes the actual selected (or unselected) pair
  observable for the first time.
- Fixed the false-failure dialog trigger (only genuine `'failed'` now, not
  `'connecting'`/`'checking'`).
- Added the 45s overall safety-net so a call can never hang on "Connecting…"
  literally forever, without misattributing the cause.

---

## 6. TURN FIX

Full 4-variant Metered TURN URL list (UDP/80, TCP/80, UDP/443, **TURNS/
TCP/443**) is now always present, regardless of whether `TURN_URL` build
secrets are set. This directly targets restrictive mobile-carrier NAT/
firewall cases per your requirement #8 and #1 — TURNS-over-443 is the
fallback most likely to survive carrier deep-packet inspection that blocks
plain UDP or non-standard TCP ports. No provider change — still Metered, as
required. No hardcoded production secrets were introduced; the existing test
credentials already present in the file are unchanged, and build-time
`TURN_USERNAME`/`TURN_CREDENTIAL` secrets still take priority when set.

---

## 7. ANSWER RECOVERY FIX

The three existing recovery paths (direct broadcast, `watch()`'s
`postgres_changes` UPDATE listener checking `row.answer_sdp`, and a 60-second/
500ms DB poll) were already structurally correct and symmetric with the
already-working offer-recovery path — inspected line-by-line, no asymmetry
bug found there. The one real bug found and fixed: the answer-resend loop
(receiver side, after persisting+creating the answer) checked
`pc.current?.remoteDescription?.type === 'answer'` as its "stop resending"
condition — but that's checking the **receiver's own** peer connection,
whose remote description is always `type: 'offer'`, never `'answer'`. That
condition could never be true, so the loop always spent all 12 attempts
(9 seconds) resending regardless of whether the caller had already received
it. Replaced with a check on the broadcast's own delivery confirmation
(`result === 'ok'`, twice in a row) instead of a condition that could never
be satisfied.

`ANSWER_RECOVERED` / `REMOTE_DESCRIPTION_SET` / `SIGNALING_STATE stable`
logging on the caller side was already present and unchanged — confirmed
correct against your required log names.

---

## 8. ICE CANDIDATE FIX

Caller/receiver identification, `callId` scoping, `sdpMid`/`sdpMLineIndex`
preservation, and the early-candidate queue-then-flush-after-
`setRemoteDescription` logic were all already correct on inspection — no
candidates are silently discarded, none are added to a null/closed peer
connection (guarded by `pc.current?.remoteDescription` before
`addIceCandidate`), and nothing mixes candidates between different call IDs
(each call gets its own channel subscription and its own `iceQueue.current`,
reset in `cleanup()`). No changes made here beyond the general logging
already in place from the prior pass.

---

## 9. PEER CONNECTION LIFECYCLE FIX

Searched the entire project for `new RTCPeerConnection` — it exists in
exactly one place (`setupPeer` in `VoiceCallContext.tsx`), used by both
caller and receiver via `pc.current || (await setupPeer(mode))`, which
already prevents creating a second `RTCPeerConnection` for an in-progress
call. `cleanup()` already closes the peer connection, stops local tracks,
removes the signaling channel, and clears the ICE queue on every terminal
path (hangup/reject/timeout/failure). The one lifecycle correctness fix made
here: the `'accepted'` DB-status recovery trigger now explicitly only acts
once (`offerStarted.current` checked *before* logging/calling, not just
inside `startCallerOffer`), per your requirement that a persistently-
`'accepted'` row must not repeatedly restart negotiation — it already
couldn't create a second `RTCPeerConnection` due to the `offerStarted` guard,
but the trigger now visibly reflects that idempotency instead of firing
(harmlessly, but confusingly) every time.

---

## 10. RINGTONE FIX

Not touched — already correct per your requirements before this pass
(receiver-only ringtone via `expo-av`, stopped on accept/reject/end/timeout,
no caller ringback). Verified again in this pass; no changes needed.

---

## 11. VOICE CALL FIX

Covered by §5–§7 above — voice calls use the same `setupPeer`/signaling path
as everything else in this file, so all fixes apply directly.

---

## 12. VIDEO CALL FIX

No separate video signaling system exists (confirmed — `setupPeer(mode)` is
the single shared implementation for both `'voice'` and `'video'` modes, only
`getUserMedia`'s `video` constraint differs). All fixes in this pass apply
equally to video calls; nothing video-specific needed to be added or changed.

---

## 13. ANDROID/APK CONSIDERATIONS

No new Android-specific code was needed for this pass — the previous pass
already added `MODIFY_AUDIO_SETTINGS`, `ACCESS_NETWORK_STATE`,
`BLUETOOTH_CONNECT`, `WAKE_LOCK` permissions alongside `RECORD_AUDIO`/
`CAMERA`/`INTERNET`/`POST_NOTIFICATIONS`. Not re-touched here since nothing
in this pass's root cause was permission-related.

---

## 14. DATABASE CHANGES, IF ANY

**None in this pass.** The `offer_sdp`/`answer_sdp` columns already existed
(added in a prior pass, migration `20260807000000_add_persistent_call_sdp.sql`)
and are used as-is. No new migration was added, no column was renamed or
dropped, no existing call record is touched destructively.

---

## 15. WHETHER SUPABASE SCHEMA WAS CHANGED

**No.** Schema is unchanged in this pass.

---

## 16. WHETHER WEB VERSION REMAINS COMPATIBLE

**Yes.** Nothing in this pass touches the web project, the signaling
protocol, event names, payload shapes, or the `calls` table contract. The
web client was not inspected for changes because none of this pass's fixes
required any — they are entirely APK-local (TURN server list construction,
`getStats()` instrumentation, failure-message accuracy, a broken retry-loop
condition, and idempotency of an existing recovery trigger).

The misleading failure message was also corrected per your explicit
instruction #16:
> Old: *"...इसे ठीक करने के लिए TURN सर्वर की ज़रूरत है"* (implied missing
> TURN even when TURN was configured)
> New: *"कॉल कनेक्ट नहीं हो पाई। नेटवर्क कनेक्शन स्थापित नहीं हो सका। कृपया
> दोबारा प्रयास करें।"* — accurate regardless of cause, shown only on a
> genuine terminal ICE/connection failure or the 45s overall timeout.

---

## 17. TEST RESULTS

- `npm install --legacy-peer-deps` — succeeded.
- `npx tsc --noEmit` — **`src/context/VoiceCallContext.tsx` compiles with
  zero errors.** Two pre-existing, unrelated errors remain elsewhere
  (`ThemeContext.tsx` color-type mismatch, `ChatScreen.tsx` dynamic-import/
  `tsconfig` module-target mismatch) — both existed before this pass, are
  outside calling, and were deliberately not touched.
- `getStats()` API shape was verified against the installed
  `react-native-webrtc` source (`RTCPeerConnection.getStats()` resolves to a
  plain `Map`, confirmed by reading its implementation) — the
  `stats.forEach(...)`/`stats.get(id)` calls added in this pass match that
  API exactly, not assumed from browser behavior.
- **Full Android Gradle build was not run in this sandbox** — no network
  access to `dl.google.com`/Android SDK repositories here, same limitation as
  the prior pass. Your existing GitHub Actions CI remains the correct place
  to validate the actual APK build; nothing in this patch changes that
  pipeline.
- **I have not personally verified two real devices reach `connected`/
  `completed` with a selected candidate pair** — I cannot run real hardware
  from here. What I *can* state: every previously-missing piece of evidence
  needed to determine that definitively (candidate-pair selection, protocol,
  nominated status, bytes flowing) is now logged automatically at exactly the
  moments that matter, and the TURN transport most likely to be silently
  failing on carrier networks (TLS/443) is now guaranteed present regardless
  of build secrets.

---

## 18. EXACT APK BUILD STEPS

No change to your build process. Same as before:

1. Push this change to your repo (`git add src/context/VoiceCallContext.tsx
   && git commit -m "Fix ICE candidate-pair visibility, TURN transport
   downgrade, and false TURN-required failure message" && git push`).
2. Your existing `.github/workflows/build-apk.yml` runs automatically —
   `npm install --legacy-peer-deps` → `expo prebuild` → Gradle
   `assembleRelease`.
3. Download the APK from the workflow's Artifacts.
4. Install and test per §22 of your instructions (voice A→B, B→A; video
   A→B, B→A; Wi-Fi↔Wi-Fi, mobile↔mobile, Wi-Fi↔mobile, mobile↔Wi-Fi).

**What to look for in `adb logcat` (or the diagnostic report already built
into the app) this time, specifically:**
- `CANDIDATE_PAIR` entries with `state=succeeded` and `nominated=true` — this
  is the direct proof a working pair was selected. Note the `local=`/
  `remote=` candidate types (e.g. `relay/udp` vs `relay/tcp`) — that tells
  you which TURN transport actually worked on that network.
- `CANDIDATE_PAIR_NONE_YET` at the `'checking'` stage is normal (checks are
  still running); seeing it persist all the way to `OVERALL_CONNECT_TIMEOUT`
  or `ICE_FAILED` without ever producing a `CANDIDATE_PAIR` with
  `nominated=true` would mean no candidate pair worked at all — genuinely
  different information than what was visible before this pass.

I have not claimed the call is fixed beyond what I can actually verify from
here: the code now correctly reports the fact that matters (was a pair
selected, and which transport), the specific TURN-transport regression is
closed, and the false-attribution failure message is corrected. Whether a
given real device pair actually reaches `connected` depends on facts (mobile
carrier NAT behavior, Metered relay reachability from that specific network)
that only a real-device test with these new logs can settle — but you will
now get a direct, unambiguous answer from that test instead of another round
of guessing.
