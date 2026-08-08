import { VercelRequest, VercelResponse } from "@vercel/node";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "../lib/b2.js";
import { verifyAuth, supabaseAdmin } from "../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { messageId } = req.body;
    const { data: message } = await supabaseAdmin.from("messages").select("*").eq("id", messageId).single();
    
    if (!message || message.sender_id === user.id) {
        return res.status(403).json({ error: "Forbidden" });
    }

    await getS3Client().send(new DeleteObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: message.b2_object_key,
    }));

    await supabaseAdmin.from("messages").update({ media_status: "delivered" }).eq("id", messageId);
    
    res.json({ success: true });
}
