# PROJECT_OVERVIEW.md — VoiceID

> **Audience**: AI coding assistants (Google AI Studio, Cursor, Claude Code, Copilot, etc.) that will read, modify, or extend this repository.
> **Read this file first.** Then read `BACKEND_README.md` (server/data layer) and `API_REFERENCE.md` (endpoint contracts) before touching any code. Read `AI_HANDOFF.md` before starting **any** task — it contains hard rules about what must never be rewritten.

---

## 1. What VoiceID Is

VoiceID is a **username-based, phone-number-free communication platform**. Users authenticate with Google OAuth or email/password, claim a permanent `@username` ("VoiceID"), add contacts, and then:

- Send realtime **text messages**
- Send **voice messages** (recorded in-browser, up to 120s, encrypted-at-rest via ephemeral storage, auto-expiring)
- Send **image messages** (photo attachments)
- Make **1:1 WebRTC voice calls** (browser-to-browser, no SFU/media server)
- See **online presence** (green dot / offline)
- Receive **realtime notifications** (new message, friend request, friend accepted, missed call)

Production domain: `https://voiceid.online`. Deployment target described in `.env.example` and `metadata.json` is **Google AI Studio / Cloud Run**, with a parallel **Vercel** deployment path (`vercel.json`) and a **Docker** path (`Dockerfile`). All three run the *same* backend code — see §5.

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | React 19 + TypeScript | Vite 6 build tool |
| Routing | react-router-dom v7 | `BrowserRouter`, nested routes, lazy-loaded pages |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | Utility classes only, no CSS-in-JS |
| Forms/validation | react-hook-form + zod | See `lib/validation.ts` |
| Backend runtime | Node.js (Express) in dev/Docker; Vercel Serverless Functions in Vercel deploy | Same handler functions, two adapters — see §5 |
| Database | Supabase (managed PostgreSQL) | Schema in `supabase/migrations/*.sql` |
| Auth | Supabase Auth (Google OAuth + email/password) | JWT bearer tokens |
| Realtime | Supabase Realtime | Postgres CDC (`postgres_changes`), Presence, and Broadcast channels |
| Object storage (media) | Backblaze B2 (S3-compatible API) | Accessed via `@aws-sdk/client-s3` — **not** Supabase Storage for new media |
| Avatar storage | Cloudinary | Separate from B2, signed unsigned-preset upload |
| Voice calls | WebRTC (RTCPeerConnection) | Signaling over Supabase Realtime Broadcast, STUN only (`stun:stun.l.google.com:19302`), **no TURN server configured** |
| Local persistence | IndexedDB via `idb` | Caches downloaded media blobs client-side |
| AI SDK dependency | `@google/genai` | Present in `package.json`; `GEMINI_API_KEY` is provisioned by AI Studio. No current call sites use it in the reviewed code — treat as reserved/future capability, not a currently-wired feature. |

## 3. Repository Structure

```
VoiceID-main/
├── api/                      # Vercel serverless function handlers (media + auth glue)
│   ├── upload.ts              # POST — raw-body proxy upload to B2
│   ├── upload-auth.ts         # POST — issues a presigned PUT URL for direct-to-B2 upload
│   ├── download-auth.ts       # POST — issues a presigned GET URL (membership-checked)
│   ├── ack.ts                 # POST — recipient acknowledges receipt, server deletes B2 object
│   ├── delete/[objectKey].ts  # DELETE — deletes a B2 object (sender-initiated message delete)
│   └── cloudinary-sign.ts     # POST — signs a Cloudinary upload (avatars only)
│
├── lib/                       # Server-side copies of shared modules (see §5 for why duplicated)
│   ├── b2.ts                  # S3Client singleton for Backblaze B2
│   ├── auth.ts                # verifyAuth() + supabaseAdmin (service-role client)
│   ├── crypto.ts, validation.ts, profileActions.ts, supabase.ts,
│   │   MediaProtocol.ts, MediaCache.ts, MediaTransferManager.ts, VoiceAudioCache.ts
│   │   — byte-for-byte identical to the files of the same name under src/lib/
│
├── src/
│   ├── App.tsx                 # Route tree (react-router-dom), all pages lazy-loaded
│   ├── main.tsx                 # React root, wraps <App/> in <StrictMode/>
│   ├── types.ts                 # Shared TS interfaces (Message, MessageReceipt)
│   │
│   ├── context/                 # Global React state (see AI_HANDOFF for provider order)
│   │   ├── AuthContext.tsx       # user, session, profile, signOut, updateProfile
│   │   ├── PresenceContext.tsx   # onlineUsers Set, isUserOnline()
│   │   ├── VoiceCallContext.tsx  # WebRTC call state machine
│   │   └── NotificationContext.tsx # notification list, unread counts, realtime subscription
│   │
│   ├── hooks/
│   │   ├── useVoiceCall.ts         # re-exports VoiceCallContext
│   │   ├── useNotificationActions.ts # open/accept/decline notification actions
│   │   ├── useSEO.ts                # sets document.title / meta tags on marketing pages
│   │   └── useNoIndex.ts            # injects <meta name="robots" content="noindex,nofollow"> on private pages
│   │
│   ├── lib/                      # Client-side shared modules — canonical source (mirrored into /lib for API functions)
│   │   ├── supabase.ts            # Browser Supabase client (anon key)
│   │   ├── auth.ts                # verifyAuth() — used only when lib/ files are imported server-side
│   │   ├── b2.ts                  # (client copy, unused directly by browser — browser never talks to B2 SDK)
│   │   ├── crypto.ts              # calculateSHA256(blob) — SHA-256 integrity hash for media
│   │   ├── validation.ts          # zod schemas (signUpSchema)
│   │   ├── profileActions.ts      # uploadAvatar() (Cloudinary), updateProfile() (Supabase)
│   │   ├── MediaProtocol.ts       # Wire format constants/types for P2P media chunking
│   │   ├── MediaCache.ts          # IndexedDB store: full media blobs by messageId
│   │   ├── VoiceAudioCache.ts     # IndexedDB store: legacy voice-only blobs by messageId
│   │   ├── MediaTransferManager.ts # WebRTC DataChannel P2P file transfer (chunked, SHA-256 verified)
│   │   ├── mediaDownload.ts       # fetchAndCacheMedia() — the ACTUAL media download path used today (B2 signed URL, not WebRTC)
│   │   ├── notificationNav.ts     # Notification type → icon/color/route registry
│   │   └── timeFormat.ts          # relativeTime(), dateGroupOf(), groupByDate()
│   │
│   ├── components/
│   │   ├── auth/                  # Welcome, Login, SignUp, ChooseVoiceID, ProtectedRoute
│   │   ├── chat/                  # MessageBubble, VoiceRecorder, VoiceMessage, ImageMessage, CallManager, ConfirmDialog
│   │   ├── common/                # Avatar, PageLoader
│   │   ├── layout/                # AppShell, DesktopSidebar, MobileBottomNav
│   │   ├── notifications/         # NotificationBell, NotificationItem
│   │   └── [marketing components] # Hero, Features, Demo, FAQ, Story, Security, FutureVision, Navbar, Footer, InteractiveMockup
│   │
│   └── pages/
│       ├── LandingPage, Careers, Blog, PrivacyPolicy, TermsOfService, ContactPage  # public marketing
│       ├── auth/AuthCallbackPage, ConfirmPage, ForgotPasswordPage, ResetPasswordPage
│       ├── DashboardPage                # layout wrapper, renders <Outlet/> inside AppShell
│       ├── HomePage, SearchPage, ConversationsPage, ChatPage, CallHistoryPage,
│       │   NotificationsPage, SettingsPage, EditProfilePage, UserProfilePage
│
├── supabase/migrations/*.sql   # Full DB schema history — see BACKEND_README.md §Database
├── server.ts                    # Express dev/Docker server — mounts the same /api handlers
├── vercel.json                  # Vercel routing rewrites (/api/media/* → /api/*.ts)
├── vite.config.ts, tsconfig.json, package.json
├── Dockerfile                   # node:18-slim, npm run build && npm start
└── .env.example                 # Canonical list of required environment variables
```

## 4. Core Domain Concepts

| Concept | Where it lives | Notes |
|---|---|---|
| **Profile** | `profiles` table | 1:1 with `auth.users`. `username` is unique, permanent once chosen. |
| **Contact** | `contacts` table | Directional request (`requester_id` → `responder_id`), `status`: `pending` \| `accepted` \| `blocked`. Accepting auto-creates a `conversation`. |
| **Conversation** | `conversations` + `conversation_members` | Currently always 1:1 (`is_group` column exists but no group UI/logic implemented). |
| **Message** | `messages` table | `content_type`: `text` \| `voice` \| `image`. Voice/image messages reference a Backblaze object via `b2_object_key`, not a URL. |
| **Message Receipt** | `message_receipts` table | Tracks `delivered_at` / `played_at` for voice messages, driven by RPCs `acknowledge_voice_delivery` / `acknowledge_voice_played` (these RPCs are **not currently called from any reviewed frontend code** — the app currently uses the `/api/media/ack` REST endpoint + `media_status` column instead; treat the RPC path as legacy/unused). |
| **Call** | `calls` table | `status`: `ringing` \| `accepted` \| `rejected` \| `ended` \| `missed` \| `cancelled` \| `failed`. Drives `VoiceCallContext` state machine. |
| **Notification** | `notifications` table | Created **only** by `SECURITY DEFINER` Postgres triggers (never client INSERT) for: `message`, `friend_request`, `friend_accepted`, `missed_call`. |
| **User Settings** | `user_settings` table | Privacy prefs (`contact_requests`, `calls`, `voice_messages`) and notification toggles. **Not currently enforced by any RLS policy or server check** — it's a data model without wired enforcement logic yet. |

## 5. Three Deployment Targets, One Backend

This is the single most important architectural fact for any AI extending this repo:

1. **`api/*.ts`** files are written in the **Vercel serverless function** signature: `(req: VercelRequest, res: VercelResponse) => void`.
2. **`server.ts`** is a thin **Express adapter** that imports those same handler functions and mounts them on Express routes, for local dev (`npm run dev`) and Docker/Cloud Run deployment (`npm start`).
3. **`vercel.json`** rewrites public-facing paths (`/api/media/upload`, etc.) to the actual file paths (`/api/upload`, etc.) for the Vercel deployment.

Because of this dual-runtime requirement, `api/*.ts` handlers cannot import from `src/` (Vercel's build isolates the `api/` directory). That is **why `lib/` at the repo root duplicates several files from `src/lib/`** — it is not accidental drift, it is a deliberate workaround. **Any change to a shared module (auth, b2, crypto, MediaCache, etc.) must be applied identically to both `lib/X.ts` and `src/lib/X.ts`**, or the two runtimes will diverge. See `AI_HANDOFF.md` for the enforced procedure.

The public API surface is always `/api/media/*` (see `API_REFERENCE.md`). Internally this maps to `/api/upload.ts`, `/api/upload-auth.ts`, `/api/download-auth.ts`, `/api/ack.ts`, `/api/delete/[objectKey].ts`.

## 6. Client Platforms This Backend Must Support

The backend (Supabase project + `/api/media/*` endpoints + DB schema) is designed to be **platform-agnostic**. The existing React web client is one consumer of it. Any new client (Android, iOS, Desktop) is expected to:

- Authenticate against the same Supabase Auth project (Google OAuth + email/password)
- Read/write the same PostgreSQL tables under the same RLS policies
- Call the same `/api/media/*` REST endpoints with the same `Authorization: Bearer <supabase_access_token>` contract
- Subscribe to the same Supabase Realtime channels for messages, notifications, presence, and call signaling
- Reimplement the WebRTC calling flow using each platform's native WebRTC library, following the exact signaling protocol described in `BACKEND_README.md` §Realtime & Voice Calls — the signaling contract (channel naming, event names/payloads) must not change, or web and native clients cannot call each other.

Full instructions and hard constraints for this work are in `AI_HANDOFF.md`.

## 7. Where To Go Next

- **Server internals, environment variables, DB schema, auth, realtime, uploads** → `BACKEND_README.md`
- **Exact endpoint contracts (request/response shapes, status codes, error cases)** → `API_REFERENCE.md`
- **Rules for extending this project safely (what to reuse, what never to touch)** → `AI_HANDOFF.md`
