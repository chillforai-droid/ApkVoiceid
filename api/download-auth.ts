import { VercelRequest, VercelResponse } from "@vercel/node";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../lib/b2.js";
import { verifyAuth, supabaseAdmin } from "../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { messageId } = req.body;
    const { data: message } = await supabaseAdmin.from("messages").select("*").eq("id", messageId).single();
    
    if (!message) {
        return res.status(404).json({ error: "Message not found" });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
        .from("conversation_members")
        .select("conversation_id")
        .eq("conversation_id", message.conversation_id)
        .eq("user_id", user.id)
        .maybeSingle();
        
    if (membershipError) {
        console.error("Database error during membership check", membershipError);
        return res.status(500).json({ error: "Internal Server Error" });
    }

    if (!membership) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const command = new GetObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: message.b2_object_key,
    });
    
    const url = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
    res.json({ url });
}
