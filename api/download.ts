import { VercelRequest, VercelResponse } from "@vercel/node";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "../lib/b2.js";
import { verifyAuth, supabaseAdmin } from "../lib/auth.js";

/**
 * Same-origin media download for the web client.
 *
 * The existing /api/media/download-auth contract is intentionally unchanged for
 * native clients. Browsers can fail when fetching the returned B2 presigned URL
 * directly if the B2 CORS allow-list does not exactly match the current web
 * origin (voiceid.online vs www.voiceid.online). This endpoint performs the same
 * membership check, downloads server-to-server from B2, and returns the bytes
 * from the VoiceID origin, so browser CORS cannot break media rendering.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { messageId } = req.body || {};
    if (!messageId) return res.status(400).json({ error: "messageId is required" });

    const { data: message, error: messageError } = await supabaseAdmin
      .from("messages")
      .select("id, conversation_id, b2_object_key, mime_type")
      .eq("id", messageId)
      .single();

    if (messageError || !message) return res.status(404).json({ error: "Message not found" });
    if (!message.b2_object_key) return res.status(404).json({ error: "Media object not found" });

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("conversation_members")
      .select("conversation_id")
      .eq("conversation_id", message.conversation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("Database error during media download membership check", membershipError);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    if (!membership) return res.status(403).json({ error: "Forbidden" });

    const object = await getS3Client().send(new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: message.b2_object_key,
    }));

    if (!object.Body) return res.status(404).json({ error: "Media object is empty" });

    const bytes = await object.Body.transformToByteArray();
    const contentType = message.mime_type || object.ContentType || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(bytes.byteLength));
    res.setHeader("Cache-Control", "private, no-store");
    return res.status(200).send(Buffer.from(bytes));
  } catch (error: any) {
    const status = error?.$metadata?.httpStatusCode;
    if (status === 404 || error?.name === "NoSuchKey") {
      return res.status(404).json({ error: "Media object not found" });
    }
    console.error("Same-origin media download failed", error);
    return res.status(500).json({ error: "Media download failed", message: error?.message });
  }
}
