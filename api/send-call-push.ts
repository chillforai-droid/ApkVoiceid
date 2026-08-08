import { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../lib/auth.js";
import { getMessaging } from "firebase-admin/messaging";
import { initializeApp, getApps, cert } from "firebase-admin/app";

/**
 * Wakes the Android app for an incoming call when it's backgrounded or fully killed —
 * something Supabase Realtime structurally cannot do on its own, since a websocket
 * subscription only stays alive while the app process does (see
 * VoiceIdApk/app/.../call/VoiceIdFirebaseMessagingService.kt for the receiving side).
 *
 * Wiring: a Supabase Database Webhook on `calls`, event = INSERT, calls this endpoint with
 * the new row as { type: "INSERT", table: "calls", record: {...} }. Configure it in the
 * Supabase Dashboard: Database -> Webhooks -> Create a new hook -> table "calls",
 * events "Insert", type "HTTP Request", URL = https://<your-domain>/api/send-call-push,
 * header `x-webhook-secret: <SUPABASE_WEBHOOK_SECRET>` (must match the env var below).
 *
 * Does nothing (silently, by design) if the receiver has no push_tokens row yet — e.g. a
 * web-only user, or an Android user who hasn't opened the app since this feature shipped.
 * The existing Realtime/in-app path keeps working exactly as before regardless.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    if (req.headers["x-webhook-secret"] !== process.env.SUPABASE_WEBHOOK_SECRET) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const call = req.body?.record;
    if (!call || call.status !== "ringing") {
        return res.json({ skipped: true, reason: "not a new ringing call" });
    }

    const { data: tokenRow } = await supabaseAdmin
        .from("push_tokens")
        .select("token")
        .eq("user_id", call.receiver_id)
        .maybeSingle();

    if (!tokenRow?.token) {
        return res.json({ skipped: true, reason: "receiver has no registered device token" });
    }

    const { data: caller } = await supabaseAdmin
        .from("profiles")
        .select("display_name, username")
        .eq("id", call.caller_id)
        .maybeSingle();

    if (getApps().length === 0) {
        // FIREBASE_SERVICE_ACCOUNT_KEY = the full service-account JSON (Firebase Console ->
        // Project settings -> Service accounts -> Generate new private key), stored as a
        // single-line env var in Vercel.
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!);
        initializeApp({ credential: cert(serviceAccount) });
    }

    try {
        await getMessaging().send({
            token: tokenRow.token,
            // Data-only (no `notification` block) so Android always routes this to
            // VoiceIdFirebaseMessagingService.onMessageReceived(), even while backgrounded —
            // a `notification` block would instead let the OS auto-display a generic system
            // notification with no Accept/Reject actions, which is exactly what this feature
            // is replacing.
            data: {
                type: "incoming_call",
                callId: call.id,
                callerId: call.caller_id,
                callerName: caller?.display_name || caller?.username || "Unknown",
            },
            android: { priority: "high" },
        });
        res.json({ success: true });
    } catch (error: any) {
        console.error("send-call-push: FCM send failed", error);
        res.status(500).json({ error: "Failed to send push" });
    }
}
