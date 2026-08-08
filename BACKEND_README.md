# BACKEND_README.md — VoiceID

> Deep reference for the server, database, auth, realtime, media, and state-management layers. Read `PROJECT_OVERVIEW.md` first if you haven't. Companion to `API_REFERENCE.md` (exact endpoint contracts) and `AI_HANDOFF.md` (rules for extending this system).

---

## 1. Environment Variables

Canonical source: `.env.example`. All variables below are **required** unless marked optional.

| Variable | Used by | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Reserved (AI Studio auto-injects) | No current call sites in reviewed code; provisioned for future Gemini API usage. |
| `APP_URL` | Reserved (AI Studio auto-injects) | Cloud Run service URL; used for self-referential links/OAuth callbacks in the AI Studio deployment context. |
| `VITE_SUPABASE_URL` | Browser (`src/lib/supabase.ts`) | Supabase project URL, exposed to client bundle (Vite `VITE_` prefix). |
| `VITE_SUPABASE_ANON_KEY` | Browser (`src/lib/supabase.ts`) | Supabase anon/public key — safe for client exposure, all access is RLS-gated. |
| `SUPABASE_URL` | Server (`lib/auth.ts`) | Same project URL, server-side. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server (`lib/auth.ts`) | **Secret.** Bypasses RLS. Used only in `api/*.ts` handlers via `supabaseAdmin`. Never expose to the client. |
| `B2_APPLICATION_KEY_ID` | Server (`lib/b2.ts`) | Backblaze B2 application key ID. |
| `B2_APPLICATION_KEY` | Server (`lib/b2.ts`) | **Secret.** Backblaze B2 application key. |
| `B2_BUCKET_ID` | Server | Not directly read in code paths reviewed, but documented as required alongside bucket name/endpoint. |
| `B2_BUCKET_NAME` | Server (`api/*.ts`) | Target bucket for all media (voice, image) objects. |
| `B2_ENDPOINT` | Server (`lib/b2.ts`) | S3-compatible endpoint host; `https://` is auto-prepended if missing. Region is hardcoded to `us-west-004`. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Server (`api/cloudinary-sign.ts`) | **Not listed in `.env.example` but required** for the avatar upload flow to function — `scripts/check-env.ts` checks for these. Treat as a gap: add to `.env.example` if formalizing. |
| `VITE_CLOUDINARY_CLOUD_NAME` | Browser (`lib/profileActions.ts`) | Public cloud name used to build the unsigned Cloudinary upload URL. Also missing from `.env.example` — same gap. |

**Environment variable checklist tool**: `scripts/check-env.ts` (`npx tsx scripts/check-env.ts`) currently only checks the Cloudinary variables. It does not check Supabase or B2 variables — if extending this script, preserve its existing checks and add to them rather than replacing them.

## 2. Authentication

### 2.1 Identity provider
Supabase Auth, with two enabled methods:
- **Google OAuth** — `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://voiceid.online/auth/callback' } })`. The redirect URL is **hardcoded** in `Welcome.tsx` and `Login.tsx`, not derived from `window.location.origin` or an env var — any new deployment domain must update these two call sites (or better, refactor to use `APP_URL`/`window.location.origin`, see `AI_HANDOFF.md` for how to do this without breaking the existing flow).
- **Email/password** — `supabase.auth.signInWithPassword(...)` / sign-up flow via `SignUp.tsx` + `lib/validation.ts::signUpSchema` (zod: full name ≥2 chars, valid email, password ≥8 chars, confirm-match, must accept terms).

### 2.2 Session lifecycle (client)
`src/context/AuthContext.tsx` is the single source of truth for `user`, `session`, and `profile` on the client:
1. On mount, calls `supabase.auth.getSession()` to hydrate initial state.
2. Subscribes to `supabase.auth.onAuthStateChange` for all subsequent changes (sign-in, sign-out, token refresh).
3. On any session with a user, calls `fetchProfile(userId, user)` which `SELECT`s the `profiles` row and **self-heals** a missing `avatar_url` by copying it from `user.user_metadata.avatar_url` (Google's photo) if present.
4. Exposes `signOut()` and `updateProfile()` (manual profile refetch, called after edits).

### 2.3 Post-auth routing (username onboarding gate)
New users authenticate but have no `profiles` row (or a row with no `username`) until they complete onboarding:
- `AuthCallbackPage.tsx` (OAuth landing page) checks for an existing profile+username after `getSession()`; if missing, redirects to `/auth/choose-id`, else `/dashboard`.
- `ChooseVoiceID.tsx` lets the user pick a unique lowercase username (client-side availability check against `profiles.username`, ≥3 chars) and `INSERT`s the `profiles` row with `id = user.id`.
- `ProtectedRoute.tsx` enforces this gate on **every** protected route: if `user` exists but `profile.username` doesn't, and the current path isn't `/auth/choose-id`, it redirects there. This means the onboarding gate is enforced app-wide, not just on the OAuth callback path.

### 2.4 Server-side auth verification
`lib/auth.ts` (duplicated in `src/lib/auth.ts` — see `PROJECT_OVERVIEW.md` §5):
```ts
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const verifyAuth = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (error || !user) return null;
  return user;
};
```
Every `/api/media/*` handler (upload, upload-auth, download-auth, ack, delete) calls `verifyAuth(req)` first and returns `401` if it fails. The client sends `Authorization: Bearer <access_token>` where the token comes from `supabase.auth.getSession()`.

### 2.5 Authorization model (RLS)
Row Level Security is enabled on nearly every table. The client uses the **anon key** for all direct Supabase calls (never the service role key) — so RLS is the actual security boundary for the browser, not application logic. Key policies (see full SQL in §5):
- `profiles`: publicly readable, self-writable.
- `messages`: readable/insertable/updatable/deletable only by conversation members / the sender (see migration `20260727000000_add_missing_delete_policies.sql` for a documented historical bug where missing DELETE/UPDATE policies caused silent no-op failures — **do not repeat this pattern**: every table needs explicit policies for every command it supports, and client code should verify `.select()` on mutations actually returned rows, exactly as `ChatPage.tsx::deleteMessage/updateMessage` does).
- `notifications`: readable/updatable/deletable by owner only; **no INSERT policy for authenticated clients at all** — rows are created exclusively by `SECURITY DEFINER` trigger functions, which is an intentional anti-spoofing measure (a user can never forge a notification appearing to be "from" someone else).
- `conversations` / `conversation_members`: readable by members only; the private-conversation creation path goes through the `create_private_conversation(other_user_id)` RPC (`SECURITY DEFINER`), not raw client inserts, to avoid a client being able to add itself to arbitrary conversations.

## 3. Route Structure (Frontend)

Defined entirely in `src/App.tsx` using `react-router-dom` v7. Every page component is `React.lazy()`-loaded (code-split), wrapped in a single top-level `<Suspense fallback={<PageLoader/>}>`.

```
/                              LandingPage (public, marketing)
/careers                       Careers (public)
/blog                          Blog (public)
/privacy-policy                PrivacyPolicy (public)
/terms-of-service               TermsOfService (public)
/contact                       ContactPage (public)

/auth/welcome                  Welcome (OAuth + entry point)
/auth/signup                   SignUp (email/password)
/auth/login                    Login (email/password + Google)
/auth/callback                 AuthCallbackPage (OAuth redirect target)
/auth/confirm                  ConfirmPage (email confirmation landing)
/auth/forgot-password           ForgotPasswordPage
/auth/reset-password            ResetPasswordPage
/auth/choose-id                ChooseVoiceID (username onboarding, gated — see §2.3)

/profile/:id                   UserProfilePage (public profile view, by user id)
/u/:username                   UserProfilePage (public profile view, by username — same component, different param)

/dashboard                     DashboardPage (ProtectedRoute-wrapped; renders AppShell + <Outlet/>)
  (index)                      HomePage
  /dashboard/search             SearchPage
  /dashboard/profile/:id        UserProfilePage (in-app variant, same component as public one)
  /dashboard/profile/edit       EditProfilePage
  /dashboard/messages           ConversationsPage (conversation list/inbox)
  /dashboard/chat/:id           ChatPage (id = conversation_id)
  /dashboard/calls              CallHistoryPage
  /dashboard/notifications      NotificationsPage
  /dashboard/settings           SettingsPage
```

**Route param convention**: `:id` under `/dashboard/*` almost always refers to either a `conversation_id` (chat) or a `profile.id` = `auth.users.id` (profile pages) — never a `username`. Only the public `/u/:username` route resolves by username.

`ProtectedRoute` (wraps `/dashboard`) — auth gate:
```tsx
if (loading) return <Loading/>;
if (!user) return <Navigate to="/auth/welcome"/>;
if (user && !profile?.username && pathname !== '/auth/choose-id') return <Navigate to="/auth/choose-id"/>;
return children;
```

**Layout**: `DashboardPage` renders `<AppShell><Outlet/></AppShell>`. `AppShell` conditionally hides the sidebar/bottom-nav/header when `pathname.startsWith('/dashboard/chat/')` (chat gets a full-bleed layout), and always renders `<CallManager/>` (the full-screen incoming/active call overlay) so an incoming call can interrupt any dashboard screen.

## 4. State Management

There is **no external state library** (no Redux/Zustand/Jotai). All shared state is React Context + hooks, composed in this **fixed provider order** in `App.tsx` (order matters — see `AI_HANDOFF.md`):

```tsx
<AuthProvider>
  <PresenceProvider>       {/* depends on useAuth() */}
    <VoiceCallProvider>     {/* depends on useAuth() + usePresence() */}
      <NotificationProvider> {/* depends on useAuth() */}
        <BrowserRouter>...</BrowserRouter>
      </NotificationProvider>
    </VoiceCallProvider>
  </PresenceProvider>
</AuthProvider>
```

| Context | Hook | State owned | Realtime source |
|---|---|---|---|
| `AuthContext` | `useAuth()` | `user`, `session`, `profile`, `loading` | Supabase Auth session events |
| `PresenceContext` | `usePresence()` | `onlineUsers: Set<string>`, `isUserOnline(id)` | Supabase Realtime **Presence** channel `voiceid:online-users` |
| `VoiceCallContext` | `useVoiceCall()` (re-exported from `hooks/useVoiceCall.ts`) | `callState` (`idle`\|`ringing-outgoing`\|`ringing-incoming`\|`connecting`\|`connected`), `activeCall`, mute/speaker state | Supabase Realtime **Broadcast** on `voice-call:{callId}` + Postgres changes on `calls` table |
| `NotificationContext` | `useNotifications()` | `notifications[]`, `unreadCount`, `unreadMessageCount`, pagination state | Supabase Realtime **postgres_changes** on `notifications` table |

Local component state (`useState`) is used for everything page-specific (message lists in `ChatPage`, search results in `SearchPage`, etc.) — these are fetched directly with `supabase.from(...)` calls inside `useEffect`, each with its own realtime subscription scoped to that page (e.g. `ChatPage` subscribes to `messages:{conversationId}`, `CallHistoryPage` subscribes to `call-history-updates`). **Pattern to follow for new pages**: fetch on mount → subscribe to a scoped Realtime channel for live updates → unsubscribe (`supabase.removeChannel(channel)`) in the `useEffect` cleanup function. Every existing page follows this pattern; do not introduce a different one.

Client-only ephemeral state examples (not backed by the DB): `SearchPage`'s recent-search history is stored in **`localStorage`** (key: `searchHistory`, capped at 5 entries) — the only use of `localStorage` in the app.

## 5. Database

### 5.1 Schema (assembled from `supabase/migrations/*.sql`, applied in filename/timestamp order)

```
profiles
  id UUID PK REFERENCES auth.users
  display_name, username (UNIQUE, NOT NULL), bio, avatar_url,
  country, language, timezone, is_verified, is_business,
  created_at, updated_at

username_history
  id, user_id → profiles, username, changed_at
  (populated by no current trigger/code path — schema exists, not wired)

conversations
  id, created_at, is_group (bool, unused by any group-chat UI), last_message_at

conversation_members
  conversation_id, user_id  (composite PK)

messages
  id, conversation_id, sender_id, content_type ('text'|'voice'|'image'),
  content_body, transcript (AI-generated, unused by any code path — reserved),
  created_at,
  -- added by 20260724000001:
  storage_path, duration, mime_type, expires_at, server_delete_after, storage_deleted_at,
  -- added by 20260726000000 (B2 migration):
  b2_object_key, sha256, media_status, byte_size
  CONSTRAINT valid_voice_metadata: for content_type='voice', requires
    (storage_path OR b2_object_key) AND duration BETWEEN 1 AND 120 AND mime_type NOT NULL
  REPLICA IDENTITY FULL  -- required so realtime DELETE payloads include conversation_id

message_receipts
  message_id, user_id (composite PK) → messages, auth.users
  delivered_at, played_at, local_persist_confirmed_at
  -- populated via RPCs acknowledge_voice_delivery / acknowledge_voice_played
  -- NOTE: these RPCs are not called by any reviewed frontend code today;
  -- the live delivery-ack path is /api/media/ack + messages.media_status instead.

contacts
  id, requester_id, responder_id → profiles,
  status ('pending'|'accepted'|'blocked'), created_at

calls
  id, caller_id, receiver_id → profiles,
  status ('ringing'|'accepted'|'rejected'|'ended'|'missed'|'cancelled'|'failed'),
  created_at, answered_at, ended_at

user_settings
  user_id PK → auth.users
  contact_requests ('everyone'|'contacts_of_contacts'|'nobody'),
  calls ('everyone'|'contacts'|'nobody'),
  voice_messages ('everyone'|'contacts'|'nobody'),
  notify_contact_requests, notify_messages, notify_calls (bool),
  created_at, updated_at
  -- NOTE: not currently enforced anywhere (no RLS/server check reads these
  -- values to actually block a contact request/call/voice message).

notifications
  id, user_id, actor_id, title, message,
  type ('message'|'friend_request'|'friend_accepted'|'missed_call'),
  related_id, secondary_id, is_read, is_deleted (unused by any DELETE-vs-soft-delete logic — hard DELETE is used instead), created_at
  RLS: SELECT/UPDATE/DELETE by owner; NO client INSERT policy (trigger-only)

organizations / organization_members / audit_logs
  -- Present in the initial schema (20260723000000_init_schema.sql) as
  -- forward-looking scaffolding. No RLS beyond table creation, no frontend
  -- code reads or writes them. Treat as unused/reserved — do not build on
  -- top of them without first verifying they are still intended for use.
```

### 5.2 Triggers & functions (business logic that lives in Postgres, not the app server)

| Trigger / function | Fires on | Effect |
|---|---|---|
| `handle_updated_at()` | BEFORE UPDATE on `profiles`, `user_settings` | Sets `updated_at = now()` |
| `handle_contact_request()` | AFTER INSERT on `contacts` (status='pending') | Creates a `friend_request` notification for the responder |
| `handle_contact_acceptance()` | AFTER UPDATE on `contacts` (pending→accepted) | Idempotently creates (or reuses) a 1:1 `conversation` + `conversation_members`, then creates a `friend_accepted` notification for the requester |
| `handle_new_message_notification()` | AFTER INSERT on `messages` | Creates a `message` notification for every other conversation member (not the sender), with a computed preview string per `content_type` |
| `handle_missed_call_notification()` | AFTER UPDATE on `calls` (status→'missed') | Creates a `missed_call` notification for the receiver |
| `voiceid_set_voice_expiry_before_insert()` | BEFORE INSERT on `messages` | For `content_type='voice'`, sets `expires_at = now() + 30 days` |
| `create_private_conversation(other_user_id)` RPC | Called from client (not currently invoked in reviewed frontend — `conversations` are created via the contact-acceptance trigger path in practice; this RPC exists as an alternate/direct creation path and is `SECURITY DEFINER` + granted to `authenticated`) | Finds-or-creates a private 1:1 conversation between the caller and `other_user_id` |
| `acknowledge_voice_delivery(p_message_id)` / `acknowledge_voice_played(p_message_id)` RPCs | Not currently called by reviewed frontend | Upsert `message_receipts`; the former also sets `server_delete_after = now() + 24h` on first ack |

All trigger functions are `SECURITY DEFINER` so they can write to `notifications` despite clients having no INSERT policy on that table — **this is the intended and only way notification rows get created.** Any new notification type must follow this same pattern (a `SECURITY DEFINER` function/trigger, never a client-side INSERT).

### 5.3 Storage
- **Backblaze B2** (S3-compatible, via `@aws-sdk/client-s3`): the storage backend for voice and image message media as of the `20260726000000_fix_voice_b2_constraint.sql` migration. Objects are addressed by a random UUID key (`b2_object_key` on the `messages` row), not by a predictable path.
- **Supabase Storage bucket `voice-messages-temp`**: legacy path from before the B2 migration, defined in `20260724000001_add_voice_messaging.sql` with member-scoped SELECT/INSERT policies. `VoiceMessage.tsx` still supports playing back old messages that have a `storage_path` but no `b2_object_key` (see fallback logic in §Media below) — **do not remove this fallback**, it's the only way pre-migration voice messages remain playable.
- **Cloudinary**: avatar images only, via unsigned-style client upload with a server-computed signature (`api/cloudinary-sign.ts`). Completely separate system from B2; do not conflate the two upload paths.

## 6. Realtime Architecture

All realtime functionality uses **Supabase Realtime**, which multiplexes three distinct primitives over one WebSocket connection per channel subscription:

### 6.1 `postgres_changes` (Postgres CDC — DB-driven)
Used for anything that should reflect a database row changing, regardless of which client wrote it:
- `NotificationContext`: channel `realtime:notifications`, filtered `user_id=eq.{userId}`, listens to `INSERT`/`UPDATE`/`DELETE` on `notifications`.
- `ChatPage`: channel `messages:{conversationId}`, listens to `INSERT`/`UPDATE`/`DELETE` on `messages` filtered by `conversation_id`.
- `ConversationsPage`: listens for changes to refresh the conversation list (debounced 150ms to coalesce bursts from the `conversations`/`messages` tables firing together).
- `CallHistoryPage`: channel `call-history-updates`, listens to `*` on `calls` filtered separately by `caller_id` and `receiver_id`.
- `VoiceCallContext` (incoming-call listener): channel `calls:{userId}`, listens to `INSERT` on `calls` filtered `receiver_id=eq.{userId}`, sets `callState='ringing-incoming'` when a new row has `status='ringing'`.

**Requirement for any new `postgres_changes` filter to work on DELETE**: the table needs `REPLICA IDENTITY FULL` (see the `messages` table fix in `20260727000000...sql`) — otherwise the `old` record in the payload only contains the primary key, and any filter on another column (like `conversation_id`) will never match.

### 6.2 Presence (who's online)
`PresenceContext`: single global channel `voiceid:online-users`. On `SUBSCRIBED`, calls `channel.track({ user_id, online_at })`. Listens to the `sync` event, flattens `channel.presenceState()` into a `Set<string>` of online user IDs. This is a **single shared channel for the whole app** — do not create per-conversation presence channels, it would fragment the online/offline signal.

### 6.3 Broadcast (ephemeral peer-to-peer signaling — WebRTC)
Used exclusively for WebRTC SDP/ICE signaling, never for anything that needs persistence. Two independent broadcast protocols exist in this codebase:

**A. Voice call signaling** (`VoiceCallContext`, actively used) — channel name `voice-call:{callId}`:
1. Caller: `supabase.from('calls').insert({caller_id, receiver_id, status:'ringing'})` → gets `call.id`.
2. Caller subscribes to `voice-call:{call.id}`, waits for a `receiver-ready` broadcast event.
3. Receiver (on incoming `postgres_changes` INSERT with `status='ringing'`) shows the incoming-call UI; on `acceptCall()`, subscribes to `voice-call:{activeCall.id}` and, once subscribed, **broadcasts `receiver-ready`**, then updates `calls.status='accepted'`.
4. Caller, on receiving `receiver-ready`: creates `RTCPeerConnection` (STUN only), calls `getUserMedia({audio:{echoCancellation,noiseSuppression,autoGainControl}})`, creates an SDP offer, **broadcasts `offer`**.
5. Receiver, on `offer`: creates its own `RTCPeerConnection` + local stream, `setRemoteDescription(offer)`, creates an answer, **broadcasts `answer`**.
6. Both sides exchange **`ice-candidate`** broadcast events as they're discovered; candidates arriving before `setRemoteDescription` completes are queued (`iceCandidateQueue`) and flushed after.
7. `ontrack` on either side attaches the remote `MediaStream` to a shared `<audio ref={remoteAudioRef} autoPlay playsInline/>` element rendered by `CallManager`.
8. **No answer within 30 seconds of ringing** → caller sets `calls.status='missed'` and tears down (`cleanupCall()`).
9. Either side calling `endCall()` sets `calls.status='ended'` and calls `cleanupCall()` (closes `RTCPeerConnection`, stops local tracks, unsubscribes the broadcast channel, resets all state).

**B. Media P2P transfer protocol** (`MediaTransferManager.ts` + `MediaProtocol.ts`, **defined but not currently wired into any UI flow** — `VoiceRecorder.tsx` and `ChatPage.tsx::handleImageUpload` both use the B2 REST upload path instead, see §7). Channel name `media:transfer:{messageId}`, broadcast events `offer`/`answer`/`ice-candidate`/`transfer-ack`, plus a custom binary chunk-framing protocol (8-byte header: 4-byte big-endian chunk index + 4-byte big-endian total chunks, 16 KiB chunks) sent over an `RTCDataChannel`. **Do not delete this code** — it's a reserved/parallel transfer mechanism; if you are asked to "wire up" media transfer or improve upload performance, this is very likely the mechanism to activate rather than build from scratch. See `AI_HANDOFF.md`.

**No TURN server is configured anywhere** (`iceServers: [{urls:'stun:stun.l.google.com:19302'}]` only, hardcoded in `VoiceCallContext.tsx`). Calls between peers on symmetric NATs will fail to connect. This is a known limitation, not a bug to silently fix by guessing credentials — flag it in `AI_HANDOFF.md`-style docs if asked to productionize calling.

## 7. Media Upload / Download Flow (the path actually used today)

### 7.1 Voice messages (`VoiceRecorder.tsx`)
1. Record via `MediaRecorder` (`audio/webm`, falls back to `audio/mp4`/`audio/ogg` by browser support), max 120s enforced client-side.
2. On send: compute SHA-256 of the blob (`crypto.subtle.digest`).
3. `POST /api/media/upload` — **raw binary body**, `Content-Type: <blob.type>`, `Authorization: Bearer <token>`. Server (`api/upload.ts`) verifies auth, generates a random `objectKey` (`crypto.randomUUID()`), streams the raw body directly to B2 via `PutObjectCommand`, returns `{objectKey}`.
4. Client inserts the `messages` row itself (id pre-generated client-side via `crypto.randomUUID()` so it can reference the same id in `MediaCache` before the DB round-trip completes): `content_type:'voice', b2_object_key, sha256, media_status:'pending', duration, mime_type, byte_size`.
5. Client also writes the blob into local `MediaCache` (IndexedDB) immediately — the sender always has an instant local copy, no download needed for their own message.

### 7.2 Image messages (`ChatPage.tsx::handleImageUpload`)
Same upload endpoint and pattern as voice, but: `media_status` is set to `'delivered'` immediately at insert time (images aren't treated as needing a delivery ack), and the local preview `<img>` uses a temporary `URL.createObjectURL(file)` that's revoked once the real message row is created (or on unmount, as a safety net).

### 7.3 Download (recipient side) — `mediaDownload.ts::fetchAndCacheMedia(message, mediaType)`
Shared by both `ImageMessage.tsx` and `VoiceMessage.tsx`:
1. Check `MediaCache` (IndexedDB) first — return immediately if present.
2. `POST /api/media/download-auth` with `{messageId}` — server (`api/download-auth.ts`) verifies auth, verifies the requester is a `conversation_members` row for that message's conversation (`403` if not), then returns a **presigned B2 GET URL**, 1-hour expiry.
3. Client fetches the presigned URL directly (browser → B2, not proxied), gets the blob, stores it in `MediaCache`.
4. **Best-effort** `POST /api/media/ack` with `{messageId}` — server (`api/ack.ts`) verifies auth, loads the message, **rejects (`403`) if the caller is the sender** (only the recipient triggers cleanup), then deletes the B2 object and sets `messages.media_status='delivered'`. Client fires this without awaiting/blocking on its result (`.catch(() => {})`) since a `403` for the sender's own eventual re-view is an expected, harmless outcome.

**Net effect**: media objects in B2 are ephemeral — deleted from B2 as soon as the recipient has downloaded and cached them locally, while the DB row (and the sender's local cache) persists. This is a deliberate storage-minimization design, not a bug — do not "fix" it by making objects permanent without understanding this is intentional.

### 7.4 Delete (sender-initiated message delete) — `ChatPage.tsx::deleteMessage`
1. `DELETE` the `messages` row via Supabase client (RLS: sender-only).
2. Verify the delete actually affected rows (`.select()` on the delete, check length — see §2.5 RLS note on why this check exists).
3. If the message had a `b2_object_key`, `DELETE /api/media/delete/{objectKey}` (server verifies auth only — **does not currently verify the requester is the message sender or even a conversation member**; it will delete any object key it's given, treating auth as sufficient. This is looser than `ack.ts`/`download-auth.ts` — be aware of this asymmetry if hardening security).
4. Remove from local `MediaCache`.

### 7.5 Avatar upload (`profileActions.ts::uploadAvatar`) — separate system
1. `POST /api/cloudinary-sign` with `{timestamp, folder:'voiceid/avatars', public_id:user.id}` → server computes a SHA-1 signature using `CLOUDINARY_API_SECRET`.
2. Client `POST`s a `FormData` (file + signature + apiKey + timestamp + folder + public_id) directly to `https://api.cloudinary.com/v1_1/{cloudName}/image/upload`.
3. Client then `UPDATE`s `profiles.avatar_url` with the returned `secure_url` via `profileActions.ts::updateProfile`.

## 8. Notifications (application-level summary)

See §5.2 for the trigger mechanics. Client-side (`NotificationContext`):
- Initial fetch: latest 30 notifications, paginated via `fetchMore()` (cursor = last item's `created_at`, `lt` filter).
- Realtime INSERT handling has one special case: if an incoming `message` notification's `related_id` (conversation id) matches the conversation the user currently has open (tracked via `setActiveConversationId`, called by `ChatPage` on mount/unmount), the client **immediately marks it read** (both locally and via an `UPDATE` call) instead of incrementing the unread badge — this is a client-driven "I'm already looking at this" optimization, not a server-side check.
- `unreadMessageCount` is a derived filter (`type==='message' && !is_read`) of the same notification list — there is no separate query for it.
- Notification → route resolution is centralized in `lib/notificationNav.ts::resolveNotificationRoute()` — a `switch` on `type` returning a path string or `null` (no sensible destination, e.g. an unknown future type). **Adding a new notification type requires updating this switch AND the `META` registry in the same file** (icon/color/category) — both are designed as the single extension point, per the file's own header comment.

## 9. Error Handling Conventions

These are the conventions actually used throughout the codebase — follow them for consistency when adding new code:

- **API handlers** (`api/*.ts`): check `req.method`, return `405` if wrong. Check `verifyAuth`, return `401` if it fails. Return typed JSON error bodies: `{error: string}` for simple cases; `api/upload.ts` additionally returns `{error, stage, message, details}` on failure, capturing which internal step (`authentication`|`s3_client_setup`|`s3_upload`) failed, to aid debugging B2 connectivity issues — **preserve this staged-error pattern** if modifying `upload.ts`.
- **Supabase mutations from the client**: never trust "no error" as "the mutation happened" when RLS is in play — a blocked UPDATE/DELETE returns `error: null` with zero affected rows. Always `.select()` the mutation and check the returned array length before updating local state (see `ChatPage.tsx::deleteMessage`/`updateMessage` for the canonical pattern).
- **Realtime subscription cleanup**: every `useEffect` that creates a channel returns a cleanup function calling `supabase.removeChannel(channel)`. Every new realtime subscription must follow this or it will leak connections across navigations/remounts.
- **Object URL lifecycle**: any `URL.createObjectURL(blob)` must have a matching `URL.revokeObjectURL(url)` — on replacement (new URL before revoking the old) and on unmount. `ImageMessage.tsx`, `VoiceMessage.tsx`, `VoiceRecorder.tsx`, and `ChatPage.tsx`'s image preview all do this via a `useRef` tracking the "current" URL. This was previously a leak (per in-code comments) and the fix is now the established pattern — do not regress it.
- **User-facing errors**: mostly `alert()` calls for mutation failures (delete/update message, call rejection reasons) and inline `<p className="text-red-500">` for form/recording errors (`VoiceRecorder`, `Login`, `SignUp`, `ChooseVoiceID`). No global toast/snackbar system exists.
- **Loading states**: local `useState<boolean>` per page/component + a shared `<Loader2 className="animate-spin"/>` (lucide-react) idiom, and a top-level `<PageLoader/>` component for route-level `Suspense` fallback. No skeleton-screen system.
