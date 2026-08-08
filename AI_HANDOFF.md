# AI_HANDOFF.md — Read This Before Writing Any Code

> This file is written **directly to you**, the AI coding assistant (Google AI Studio, Claude, Cursor, Copilot, or any other tool operating on this repository). It is not background reading — it is a set of binding instructions for how you are allowed to work on VoiceID.

---

## 0. Required reading order

1. `PROJECT_OVERVIEW.md` — what this app is, tech stack, folder map.
2. `BACKEND_README.md` — how auth, realtime, media, database, and state actually work today.
3. `API_REFERENCE.md` — exact contracts for every endpoint, RPC, table, and realtime channel.
4. **This file** — what you are and are not allowed to do with that knowledge.

If you have not read all three of the above in this session, **do not write code yet.** Read them first.

---

## 1. The prime directive: this backend is DONE. Reuse it.

VoiceID already has a complete, working backend:
- A Supabase project (Postgres + Auth + Realtime + RLS policies)
- A Backblaze B2 media pipeline behind five serverless endpoints
- A Cloudinary avatar pipeline behind one serverless endpoint
- A WebRTC calling system signaled over Supabase Realtime
- A trigger-driven notification system

**Your default assumption for any new task must be: "the backend already does this or almost does this — extend it, don't replace it."** This applies whether the task is a bug fix, a new feature, or building an entirely new client platform (Android/iOS/Desktop — see §6).

### 1.1 Never rewrite working backend code
Do not rewrite, "clean up," "modernize," or restructure any file in `api/`, `lib/`, `src/lib/`, `src/context/`, or `supabase/migrations/` unless the user has explicitly asked you to change the specific behavior that file implements. Refactoring for its own sake is not in scope and risks breaking a contract another client (present or future) depends on. If you notice something that looks like a bug or inconsistency while working nearby (there are several documented ones — see `BACKEND_README.md` §9 and `API_REFERENCE.md` §1.5/§1.6), **name it explicitly to the user and ask before touching it.** Do not silently "fix" it as a side effect of an unrelated task.

### 1.2 Preserve API contracts
Every endpoint documented in `API_REFERENCE.md` — its URL, HTTP method, request shape, response shape, status codes, and error bodies — is a contract. Existing clients (the web app, and any client you or another AI builds from this handoff) depend on these being stable.
- **Never** change an existing endpoint's request/response shape, rename a field, change a status code's meaning, or change auth requirements on an existing route.
- **Do** add new endpoints, or new optional fields to responses, if a task genuinely requires new capability.
- If a task seems to *require* breaking an existing contract (e.g. closing the `api/delete/[objectKey].ts` authorization gap noted in `API_REFERENCE.md` §1.5), stop and confirm with the user first, explain what will change and which clients could be affected, and only then proceed — and update `API_REFERENCE.md` in the same change.

### 1.3 Preserve the database schema
Migrations in `supabase/migrations/` are additive and sequential (each migration only adds columns/tables/policies, or fixes a previously-broken policy — see the comments in `20260726000000_fix_voice_b2_constraint.sql` and `20260727000000_add_missing_delete_policies.sql` for the established style of "explain the bug, then fix it additively"). Follow this pattern for any schema change:
- **Never** edit an existing migration file. Always add a new one with a later timestamp prefix (`YYYYMMDDHHMMSS_description.sql`, matching the existing naming convention).
- **Never** `DROP` a column/table/policy that existing code reads, unless the task is explicitly a removal and you've confirmed nothing else depends on it (check `BACKEND_README.md` §5 and grep the codebase).
- New tables/columns need explicit RLS policies for every command they support (SELECT/INSERT/UPDATE/DELETE) — see §2.5/§9 of `BACKEND_README.md` for why missing policies cause silent, hard-to-diagnose failures rather than loud errors.
- If a new notification type is needed, follow the exact existing pattern: a `SECURITY DEFINER` trigger function inserts the row (client-side INSERT is intentionally blocked by RLS — do not add a client INSERT policy to work around this), and register the type in `src/lib/notificationNav.ts`'s `META` object and `resolveNotificationRoute()` switch (both are the file's documented single extension point).

### 1.4 Preserve authentication
- Do not introduce a second auth system, a custom JWT scheme, or a different session mechanism. Supabase Auth (Google OAuth + email/password) is the only identity system.
- Do not change the `verifyAuth()` contract in `lib/auth.ts`/`src/lib/auth.ts` (bearer token → `supabaseAdmin.auth.getUser()` → user or null). Any new server endpoint needing auth should call this exact function, exactly as every existing `api/*.ts` handler does.
- Do not weaken RLS policies to make a feature "just work" faster. If RLS is blocking something, that's very likely intentional (see the `AI_HANDOFF`-relevant history of `20260727000000_add_missing_delete_policies.sql`, where the *fix* was to add missing policies, not to bypass RLS). Add the correct policy instead.
- Preserve the username-onboarding gate (`ProtectedRoute.tsx` + `ChooseVoiceID.tsx` + `AuthCallbackPage.tsx`, see `BACKEND_README.md` §2.3) exactly as-is unless the task is specifically about onboarding.

### 1.5 Preserve the upload/download flow
- `/api/media/upload`, `/api/media/upload-auth`, `/api/media/download-auth`, `/api/media/ack`, `/api/media/delete/:objectKey` and their contracts (§1 of `API_REFERENCE.md`) must keep working exactly as documented for any client already using them.
- Preserve the ephemeral-storage design (media deleted from B2 after recipient ack — `BACKEND_README.md` §7.3): this is intentional, not a bug.
- Preserve the legacy Supabase Storage fallback in `VoiceMessage.tsx` for messages with a `storage_path` but no `b2_object_key` — removing it breaks playback of pre-migration voice messages.
- If asked to improve upload/download performance or reliability, look first at activating the existing, currently-dormant `MediaTransferManager.ts` / `MediaProtocol.ts` P2P transfer system (`BACKEND_README.md` §6.3B) before designing something new — it was built for exactly this purpose and already integrates with `MediaCache`.

### 1.6 Preserve the realtime architecture
- Channel names and event names listed in `API_REFERENCE.md` §4 are a cross-client compatibility surface. If you build a second client (native mobile, desktop), it **must** use the identical channel names, event names, and payload shapes for `voice-call:{callId}` signaling, `calls:{userId}` incoming-call detection, `messages:{conversationId}`, `realtime:notifications`, and `voiceid:online-users` — otherwise a web user and a native-app user cannot message, call, or see each other's presence.
- Do not switch any of these from `postgres_changes`/`presence`/`broadcast` to a different primitive (e.g. don't move signaling to a custom WebSocket server) without the user explicitly requesting an architecture change, since that would break interoperability with every other client.
- Preserve the `REPLICA IDENTITY FULL` setting on `messages` (needed for DELETE realtime filters to work — see `BACKEND_README.md` §6.1). If a new table needs realtime DELETE filtering by a non-PK column, it needs the same setting, applied via a new migration.

---

## 2. The dual-runtime duplication rule (`lib/` vs `src/lib/`)

`lib/*.ts` (repo root) and `src/lib/*.ts` contain byte-for-byte identical copies of: `b2.ts`, `auth.ts`, `crypto.ts`, `validation.ts`, `profileActions.ts`, `supabase.ts`, `MediaProtocol.ts`, `MediaCache.ts`, `MediaTransferManager.ts`, `VoiceAudioCache.ts`. This exists because Vercel's serverless function bundler isolates `api/` and cannot reach into `src/` (see `PROJECT_OVERVIEW.md` §5).

**Rule**: any edit to one of these shared modules must be applied identically to both copies, in the same change. Before finishing any task that touched one of these files, explicitly diff `lib/<file>.ts` against `src/lib/<file>.ts` and confirm they still match (excluding the fact that some of `src/lib`'s files, like `mediaDownload.ts`, `notificationNav.ts`, `timeFormat.ts`, have no root-level counterpart at all — that's expected, they're browser-only and never imported by `api/*.ts`).

If you're tempted to solve this duplication permanently (e.g. via a shared package, a build step, or a monorepo restructure) — that's a legitimate improvement to propose, but **propose it, don't just do it**, since it changes the build/deploy pipeline (`vite.config.ts`, `vercel.json`, `Dockerfile`, `package.json` build scripts) and needs the user's sign-off.

---

## 3. Provider order matters

`src/App.tsx` composes context providers as `AuthProvider → PresenceProvider → VoiceCallProvider → NotificationProvider`. Each provider in this list calls `useAuth()` (and `VoiceCallProvider` also calls `usePresence()`), so this order is a hard dependency chain, not stylistic. If you add a new global context, insert it at the correct point in this chain based on what it depends on, and never reorder the existing four.

---

## 4. Style and code-pattern conformance

When adding code, match what's already here rather than introducing a new pattern:
- Data fetching: `useEffect` + `supabase.from(...)` + a scoped realtime subscription with cleanup (`BACKEND_README.md` §4). Don't introduce React Query, SWR, or a custom fetch hook library without being asked.
- No global state library beyond React Context — don't add Redux/Zustand/Jotai without being asked.
- Styling is Tailwind utility classes inline in JSX — no CSS Modules, styled-components, or a separate stylesheet per component.
- Error surfacing is `alert()` for mutation failures and inline red `<p>` text for form/validation errors — no toast library is installed. Don't add one without being asked.
- Media blob URL lifecycle: always track the current `URL.createObjectURL()` result in a `useRef` and revoke it on replacement and unmount (`BACKEND_README.md` §9) — this is an established, previously-fixed-bug pattern; don't reintroduce the leak in new components that render blobs.
- Mutations that go through Supabase RLS: always check the returned row count after `.select()`, never trust `error === null` alone (`BACKEND_README.md` §9 / `API_REFERENCE.md` §3.4).

---

## 5. What you may freely improve

Not everything is frozen. You are free to, and should, use good judgment on:
- New pages, new components, new features that consume the existing backend contracts.
- Bug fixes that don't change any documented contract (e.g. a UI bug, a missing loading state, a race condition in local state).
- New database tables/columns for genuinely new features, added via new additive migrations with correct RLS.
- New API endpoints for genuinely new server-side capability, following the exact conventions in `API_REFERENCE.md`/`BACKEND_README.md` §9 (verifyAuth first, method check, typed JSON errors).
- Adding a TURN server configuration to fix WebRTC connectivity for symmetric-NAT users (a documented known gap, `BACKEND_README.md` §6.3) — this is additive (new ICE server entries) and doesn't break any contract.
- Formalizing the undocumented Cloudinary env vars into `.env.example` (`BACKEND_README.md` §1) — purely additive documentation/config hygiene.
- Adding auth verification to `api/cloudinary-sign.ts` (a documented gap, `API_REFERENCE.md` §1.6) — but confirm with the user first per §1.2 above, since it changes an existing endpoint's behavior for any caller not currently sending a token.

---

## 6. Building a new client (Android / iOS / Desktop)

If your task is to build a native client, the backend requires **zero changes** to get a working client talking to the same users, messages, contacts, and calls as the web app. Concretely:

1. **Auth**: use the platform's Supabase SDK against the same `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` project. Implement Google OAuth (native flow, not web redirect) and email/password, matching `API_REFERENCE.md` §2.
2. **Onboarding gate**: replicate the username-check-and-claim flow (`API_REFERENCE.md` §2, `BACKEND_README.md` §2.3) before allowing access to the rest of the app.
3. **Data**: use the same table contracts in `API_REFERENCE.md` §3 — same table names, same column names, same RLS-implied permission model. Do not create parallel tables "for mobile."
4. **Media**: implement upload against `POST /api/media/upload` (raw body) or `/api/media/upload-auth` (presigned, better for mobile — avoids proxying large files through your app server) exactly per §1.1/§1.2, and download against `/api/media/download-auth` + `/api/media/ack` per §1.3/§1.4. Compute SHA-256 client-side before upload, exactly as the web client does, and enforce the same voice-message 1–120 second duration rule (the DB will reject anything outside that range).
5. **Realtime**: use the Supabase Realtime SDK for your platform, subscribing to the exact channel/event names in `API_REFERENCE.md` §4. For calling, implement the WebRTC signaling sequence in `BACKEND_README.md` §6.3 using your platform's native WebRTC library (e.g. `WebRTC.framework`/GoogleWebRTC on iOS, `org.webrtc` on Android) — **the signaling channel name, event names, and SDP/ICE payload shapes must match exactly**, since a native client needs to be able to call a web client and vice versa.
6. **Notifications**: read from the same `notifications` table/realtime channel. For native push notifications (APNs/FCM) — which the current web app does not have at all — this is new capability: you'll need a new server-side integration (e.g. a Postgres trigger or Edge Function that calls FCM/APNs when a notification row is inserted). Design this as an **addition** alongside the existing in-app notification system, not a replacement.
7. **Do not** reimplement any business logic that lives in Postgres triggers (contact acceptance → conversation creation, message → notification, missed call → notification — `BACKEND_README.md` §5.2) on the client. Let the existing triggers do this work; the native client only needs to read the resulting rows/notifications.

The goal stated by the project owner is explicit: **new clients are additional consumers of one shared backend**, not separate backends. If at any point building a new client seems to require changing a shared table, endpoint, or realtime contract, stop and flag it rather than proceeding — per §1.2/§1.3 above.

---

## 7. Before you finish any task

Checklist:
- [ ] Did I avoid rewriting any file in `api/`, `lib/`, `src/lib/`, `src/context/`, or `supabase/migrations/` beyond what the task required?
- [ ] If I touched a shared module, did I update **both** `lib/X.ts` and `src/lib/X.ts`?
- [ ] If I touched the DB schema, did I add a **new** migration file rather than editing an existing one, and does every new table/column have explicit RLS policies?
- [ ] If I added a new API endpoint, does it call `verifyAuth()` (or explicitly and intentionally not, with that decision flagged to the user) and return the established JSON error shapes?
- [ ] If I added a new notification type, did I add a `SECURITY DEFINER` trigger (not a client INSERT) and register it in `notificationNav.ts`?
- [ ] Did I leave every existing endpoint, table, and realtime channel contract unchanged, unless the user explicitly asked me to change it?
- [ ] If I noticed an existing bug or gap outside my task's scope, did I report it instead of silently fixing it?
- [ ] Did I update `API_REFERENCE.md` and/or `BACKEND_README.md` in the same change if I added or changed anything they document?
