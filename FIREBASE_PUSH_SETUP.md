# Push notifications for incoming calls — setup

This makes calls actually wake the Android app (ring + Answer/Decline) even when it's
backgrounded or fully killed, using Firebase Cloud Messaging (FCM) — completely free, no
credit card, no usage limits.

Everything is already coded (both apk and web zips). You only need to do the account/config
steps below — nothing here requires writing code.

## 1. Create a Firebase project (free)
1. Go to https://console.firebase.google.com → **Add project** → any name (e.g. "VoiceID").
   You can disable Google Analytics for it, not needed.
2. Inside the project: **Project settings (gear icon) → General → Add app → Android**.
   - Android package name: `com.voiceid.app`
   - (Skip SHA-1, not needed for FCM)
3. Download **google-services.json** when offered — keep it, you'll need it twice below.

## 2. Get a service-account key (for the server to SEND pushes)
1. **Project settings → Service accounts → Generate new private key**.
2. This downloads a JSON file — this is secret, never commit it.

## 3. Android app (GitHub Actions)
In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret name | Value |
|---|---|
| `GOOGLE_SERVICES_JSON` | the **entire google-services.json content**, base64-encoded — run `base64 -w0 google-services.json` and paste the output |

That's it — the workflow (already updated) writes it to `app/google-services.json` before
building, only if this secret is set. Nothing breaks if you skip this for now.

## 4. Web backend (Vercel)
In your Vercel project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | the **entire service-account JSON from step 2**, as one line (paste the raw JSON — Vercel handles the newlines fine) |
| `SUPABASE_WEBHOOK_SECRET` | any random long string you make up, e.g. `openssl rand -hex 24` — this is just a shared secret between Supabase and this endpoint |

Redeploy after adding these (Vercel → Deployments → Redeploy).

## 5. Supabase — the two pieces
**a) Database migration** — apply `supabase/migrations/20260803000000_create_push_tokens.sql`
(via `supabase db push`, or paste it into the Supabase SQL editor and run it).

**b) Database Webhook** (Supabase Dashboard → Database → Webhooks → Create a new hook):
- Table: `calls`
- Events: `Insert` only
- Type: `HTTP Request`
- URL: `https://<your-vercel-domain>/api/send-call-push`
- HTTP Headers: add `x-webhook-secret` = the same value as `SUPABASE_WEBHOOK_SECRET` above

## That's the whole setup
Once all five are done: A calls B → a row appears in `calls` → the webhook fires →
`/api/send-call-push` looks up B's device token → sends a push → B's phone rings and shows
Answer/Decline, even if B's app was closed.

**If you skip any of this**, nothing breaks — the app keeps working exactly as it does today
(ringing/notification only while the app process is alive), it just won't wake a killed app.
You can add these steps whenever you're ready.
