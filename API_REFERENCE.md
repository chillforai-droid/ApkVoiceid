# API_REFERENCE.md — VoiceID

> Exact request/response contracts for every server endpoint, plus the Supabase RPC and table-access contracts a new client (web, Android, iOS, Desktop) must replicate. All endpoints are relative to the app's origin (e.g. `https://voiceid.online`). **These contracts are frozen** — see `AI_HANDOFF.md`. If a change seems necessary, add a new endpoint/field rather than altering an existing one.

---

## 1. Media API (`/api/media/*`)

Public path prefix `/api/media/*` is rewritten by `vercel.json` to the underlying file in `api/`. In Express (`server.ts`), the same handlers are mounted directly on `/api/media/*`. **A new client must call the public `/api/media/*` paths**, not the internal file paths.

Common conventions across all media endpoints:
- Auth: `Authorization: Bearer <supabase_access_token>` header, required on every request. Missing/invalid → `401 {"error":"Unauthorized"}`.
- Wrong HTTP method → `405 {"error":"Method not allowed"}`.
- All JSON-body endpoints expect and return `Content-Type: application/json`.

### 1.1 `POST /api/media/upload`

Uploads a media file directly to Backblaze B2 through the server (server holds the B2 credentials; the client never talks to B2 directly for uploads).

**Request**
- Method: `POST`
- Headers:
  - `Authorization: Bearer <token>` (required)
  - `Content-Type: <mime type of the file, e.g. audio/webm, image/jpeg>` (required — becomes the B2 object's `ContentType`)
- Body: **raw binary** file content (not multipart/form-data, not JSON). In the Express dev server this is parsed with `express.raw({ type: '*/*', limit: '10mb' })` — **10MB request body limit**.

**Response — success (200)**
```json
{ "objectKey": "3fa85f64-5717-4562-b3fc-2c963f66afa6" }
```
`objectKey` is a server-generated `crypto.randomUUID()` — the client has no control over the storage key.

**Response — failure (500)**
```json
{
  "error": "Upload failed",
  "stage": "authentication" | "s3_client_setup" | "s3_upload",
  "message": "<underlying error message>",
  "details": { }
}
```
`stage` tells you which step failed — useful for distinguishing "B2 credentials misconfigured" from "auth token invalid" from "network/S3 error".

**Response — auth failure (401)**: `{ "error": "Unauthorized" }`
**Response — wrong method (405)**: `{ "error": "Method not allowed" }`

**Client responsibility after a successful upload**: insert the corresponding `messages` row yourself (see §3.2/3.3) — this endpoint only stores the bytes, it does not touch the database.

---

### 1.2 `POST /api/media/upload-auth`

Issues a presigned B2 PUT URL for a **direct-to-B2 client upload** (bypassing the server for the actual bytes). **Currently unused by the reviewed frontend** (both voice and image upload use `/api/media/upload` instead) — but it is a fully functional, intentional alternate path. Prefer it for large files or bandwidth-constrained server environments.

**Request**
```json
{ "mimeType": "audio/webm" }
```
Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`.

**Response — success (200)**
```json
{
  "url": "https://<b2-endpoint>/<bucket>/<objectKey>?X-Amz-...",
  "objectKey": "generated-uuid"
}
```
`url` is valid for **1 hour** (`expiresIn: 3600`). Client must then `PUT` the raw file bytes directly to `url` with `Content-Type` matching the `mimeType` sent above.

**Errors**: same `401`/`405` shape as above.

---

### 1.3 `POST /api/media/download-auth`

Issues a presigned B2 GET URL for downloading a message's media, after verifying the requester is a member of the message's conversation.

**Request**
```json
{ "messageId": "uuid" }
```
Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`.

**Response — success (200)**
```json
{ "url": "https://<b2-endpoint>/<bucket>/<objectKey>?X-Amz-..." }
```
Valid for **1 hour**. Client then `GET`s this URL directly (browser/native HTTP client → B2, not proxied through the app server) to retrieve the blob.

**Response — errors**
- `404 {"error":"Message not found"}` — no `messages` row with that id.
- `403 {"error":"Forbidden"}` — requester is not a `conversation_members` row for `message.conversation_id`.
- `500 {"error":"Internal Server Error"}` — DB error during the membership check.
- `401`/`405` as above.

**Client responsibility**: after a successful download, cache the blob locally (the web client uses `MediaCache`, an IndexedDB store — see `BACKEND_README.md` §7) and then call `POST /api/media/ack` (§1.4) as best-effort cleanup.

---

### 1.4 `POST /api/media/ack`

Recipient acknowledges they've downloaded and cached a media message. Triggers server-side deletion of the B2 object (storage-minimization — see `BACKEND_README.md` §7.3) and marks the message delivered.

**Request**
```json
{ "messageId": "uuid" }
```
Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`.

**Response — success (200)**
```json
{ "success": true }
```
Side effects: deletes the B2 object at `messages.b2_object_key`; sets `messages.media_status = 'delivered'`.

**Response — errors**
- `403 {"error":"Forbidden"}` — **the caller is the message's own sender** (senders never trigger this cleanup; this is an *expected* response in normal operation when a sender's client also calls this endpoint for its own message — treat `403` here as non-fatal, not a bug to retry/surface to the user).
- `401`/`405` as above.

**Design note for new clients**: call this **without blocking the UI** on the result — it's a fire-and-forget cleanup signal, exactly as the web client treats it (`.catch(() => {})`).

---

### 1.5 `DELETE /api/media/delete/:objectKey`

Deletes a raw B2 object by key. Used by the sender-initiated message-delete flow, called **after** the `messages` row itself has already been deleted from the database by the client.

**Request**
- Method: `DELETE`
- URL: `/api/media/delete/{objectKey}` (the B2 object key, URL-path segment — Vercel rewrites `/api/media/delete/:objectKey` → `/api/delete/[objectKey].ts`; Express extracts `req.params.objectKey` into the query for the shared handler)
- Headers: `Authorization: Bearer <token>` (required)
- No body.

**Response — success (200)**
```json
{ "success": true }
```

**Response — errors**: `401`/`405` as above.

**Security note (do not silently "fix")**: unlike `download-auth` and `ack`, this endpoint verifies only that the caller is *authenticated* — it does **not** verify the caller is the message's sender, a conversation member, or that the object key even corresponds to a real message. Any authenticated user who knows/guesses an `objectKey` can delete it. This is a known gap in the current implementation, documented here rather than silently patched, because closing it changes the endpoint's contract (see `AI_HANDOFF.md` for the required process before changing any contract).

---

### 1.6 `POST /api/cloudinary-sign`

Signs a Cloudinary upload request for avatar images. **Not under `/api/media/*`** — separate system (see `BACKEND_README.md` §7.5). No `verifyAuth` call in this handler (relies on the caller already being an authenticated app user with a valid `user.id` as `public_id`, but does not itself check a bearer token) — treat this as another known gap, not a template to copy for new endpoints that need real auth.

**Request**
```json
{ "timestamp": 1721260800, "folder": "voiceid/avatars", "public_id": "user-uuid" }
```
Headers: `Content-Type: application/json`. No `Authorization` header is checked by this handler.

**Response — success (200)**
```json
{ "signature": "<sha1 hex digest>", "apiKey": "<cloudinary api key>" }
```

**Response — errors**
- `400 {"error":"Missing required parameters"}` — any of `timestamp`/`folder`/`public_id` missing.
- `500 {"error":"Cloudinary configuration missing"}` — server env vars not set.

**Client responsibility**: `POST` a `multipart/form-data` body directly to `https://api.cloudinary.com/v1_1/{VITE_CLOUDINARY_CLOUD_NAME}/image/upload` containing `file`, `signature`, `api_key`, `timestamp`, `folder`, `public_id`. On success, Cloudinary returns `{secure_url, ...}`; the client must then `UPDATE profiles SET avatar_url = secure_url` itself (see §3.1).

---

## 2. Authentication Contract (Supabase Auth — not a custom endpoint)

New clients authenticate directly against the Supabase project (same `VITE_SUPABASE_URL` / anon key as the web client) using the Supabase SDK for their platform (JS, Swift, Kotlin, etc.). There is no custom `/api/auth/*` endpoint layer — Supabase Auth *is* the auth API.

- **Google OAuth**: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '<your-callback-url>' } })`. Native clients should use the platform-appropriate OAuth redirect handling (deep link / universal link) rather than a browser `redirectTo`, but must land the user in the same post-auth onboarding flow described below.
- **Email/password sign up**: `supabase.auth.signUp({ email, password })` (validate client-side against the same rules as `lib/validation.ts::signUpSchema`: name ≥2 chars, valid email, password ≥8 chars).
- **Email/password sign in**: `supabase.auth.signInWithPassword({ email, password })`.
- **Session token**: after sign-in, `supabase.auth.getSession()` returns `session.access_token` — this is the JWT to send as `Authorization: Bearer <token>` to every `/api/media/*` call.
- **Post-auth onboarding check** (must be replicated by any new client): after obtaining a session, `SELECT * FROM profiles WHERE id = auth.uid()`. If no row, or `username IS NULL`, the client must present a username-selection UI and `INSERT INTO profiles (id, username) VALUES (auth.uid(), '<chosen>')` before allowing access to the rest of the app (mirrors `ChooseVoiceID.tsx` — see `BACKEND_README.md` §2.3). Username availability check: `SELECT username FROM profiles WHERE username = '<candidate lowercase>'` — empty result = available.

---

## 3. Direct Database Contracts (via Supabase client SDK, RLS-enforced)

These are not REST endpoints but are equally part of the "API surface" any new client must replicate exactly, since RLS policies define what's actually permitted server-side regardless of client platform.

### 3.1 Update profile
```
UPDATE profiles SET display_name = ?, bio = ?, avatar_url = ? WHERE id = auth.uid()
```
Allowed by RLS only when `auth.uid() = id`.

### 3.2 Send a text message
```
INSERT INTO messages (conversation_id, sender_id, content_body, content_type)
VALUES (?, auth.uid(), ?, 'text')
```
Allowed by RLS only if `auth.uid()` is a `conversation_members` row for `conversation_id`. A `message` notification is created automatically server-side (trigger) for every other conversation member — the client does not create notifications itself.

### 3.3 Send a voice or image message (after uploading media — see §1.1)
```
INSERT INTO messages (
  id,               -- client-generated UUID (voice) or server-default (image) — either is valid
  conversation_id, sender_id, content_body, content_type,   -- 'voice' | 'image'
  b2_object_key, sha256, media_status,                        -- 'pending' (voice) | 'delivered' (image)
  duration,          -- REQUIRED for voice: integer seconds, 1–120 (DB CHECK constraint enforces this)
  mime_type, byte_size
) VALUES (...)
```
The `valid_voice_metadata` CHECK constraint will **reject** any voice-type insert missing `duration` (out of 1–120 range), `mime_type`, or both `storage_path` and `b2_object_key`. A new client must compute `duration` client-side (recording elapsed time, capped at 120) exactly as `VoiceRecorder.tsx` does.

### 3.4 Edit / delete a message
```
UPDATE messages SET content_body = ? WHERE id = ?     -- RLS: auth.uid() = sender_id
DELETE FROM messages WHERE id = ?                       -- RLS: auth.uid() = sender_id
```
**Always request the mutation with `.select()`/`RETURNING` and check the row count** — RLS-blocked mutations return no error but zero affected rows (see `BACKEND_README.md` §9). For a media message, follow the delete with `DELETE /api/media/delete/{objectKey}` (§1.5).

### 3.5 Contacts (friend requests)
```
INSERT INTO contacts (requester_id, responder_id, status) VALUES (auth.uid(), ?, 'pending')
UPDATE contacts SET status = 'accepted' WHERE id = ?     -- either party; triggers conversation creation
UPDATE contacts SET status = 'blocked'  WHERE id = ?     -- decline
DELETE FROM contacts WHERE id = ?                          -- either party (remove/unblock)
```
Query own contacts: `SELECT * FROM contacts WHERE requester_id = auth.uid() OR responder_id = auth.uid()`.

### 3.6 Conversations & membership
```
SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()
SELECT id, last_message_at,
       conversation_members(user_id, profiles(display_name, avatar_url)),
       messages(content_body, created_at, content_type)
FROM conversations WHERE id IN (...) ORDER BY last_message_at DESC
```
To create a new 1:1 conversation directly (rather than via contact acceptance), call the RPC:
```
supabase.rpc('create_private_conversation', { other_user_id: '<uuid>' })
```
Returns the existing or newly-created `conversation.id`. `SECURITY DEFINER`, granted to `authenticated` role.

### 3.7 Calls
```
INSERT INTO calls (caller_id, receiver_id, status) VALUES (auth.uid(), ?, 'ringing')
UPDATE calls SET status = 'accepted', answered_at = now() WHERE id = ?
UPDATE calls SET status = 'ended', ended_at = now() WHERE id = ?
UPDATE calls SET status = 'missed', ended_at = now() WHERE id = ?   -- caller-side 30s timeout
```
RLS: `SELECT`/`UPDATE` allowed to caller or receiver; `INSERT` allowed only as `caller_id = auth.uid()`. See `BACKEND_README.md` §6.3 for the full WebRTC signaling sequence that must accompany these row changes — the DB row alone does not establish the call, it's the trigger for realtime signaling.

### 3.8 Notifications
```
SELECT * FROM notifications WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 30
UPDATE notifications SET is_read = true WHERE id = ?                          -- single
UPDATE notifications SET is_read = true WHERE user_id = auth.uid() AND is_read = false   -- mark all
UPDATE notifications SET is_read = true WHERE user_id = auth.uid() AND related_id = ? AND type = 'message' AND is_read = false  -- mark conversation read
DELETE FROM notifications WHERE id = ?
DELETE FROM notifications WHERE user_id = auth.uid()                            -- clear all
```
**There is no client INSERT path for notifications — do not attempt one, it will be rejected by RLS.** New notification types must be created via a new `SECURITY DEFINER` trigger function (see `BACKEND_README.md` §5.2/§8).

### 3.9 Search
```
SELECT * FROM profiles
WHERE username ILIKE '%<query>%' OR display_name ILIKE '%<query>%'
LIMIT 10
```
Publicly readable per the `profiles` SELECT policy — no membership/contact check.

---

## 4. Realtime Channel Contracts

A new client must subscribe to the following channel names/events **exactly as named** — these strings form the cross-client compatibility surface for realtime features (e.g. a web user calling an Android user):

| Channel name pattern | Type | Events | Purpose |
|---|---|---|---|
| `realtime:notifications` | postgres_changes | INSERT/UPDATE/DELETE on `notifications`, filter `user_id=eq.{self}` | Notification feed |
| `messages:{conversationId}` | postgres_changes | INSERT/UPDATE/DELETE on `messages`, filter `conversation_id=eq.{id}` | Live chat updates |
| `voiceid:online-users` | presence | `sync`, `track({user_id, online_at})` | Global online/offline presence |
| `calls:{userId}` | postgres_changes | INSERT on `calls`, filter `receiver_id=eq.{self}` | Incoming call detection |
| `voice-call:{callId}` | broadcast | `receiver-ready`, `offer`, `answer`, `ice-candidate` | WebRTC signaling for a specific call — see `BACKEND_README.md` §6.3 for full sequence and payload shapes (raw `RTCSessionDescriptionInit` / `RTCIceCandidateInit` objects as the broadcast `payload`) |
| `media:transfer:{messageId}` | broadcast | `offer`, `answer`, `ice-candidate`, `transfer-ack` | Reserved P2P media transfer signaling (not currently activated in the UI — see `BACKEND_README.md` §6.3B) |
| `call-history-updates` | postgres_changes | `*` on `calls`, filtered separately by `caller_id`/`receiver_id` | Call history live refresh |

Broadcast payloads are passed through as-is (JSON-serialized `RTCSessionDescriptionInit`/`RTCIceCandidateInit`/`{messageId}` objects) — there is no additional envelope/versioning beyond `{type:'broadcast', event:'<name>', payload:{...}}`, which is the Supabase Realtime broadcast wire format itself.
