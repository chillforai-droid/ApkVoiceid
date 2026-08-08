import { VercelRequest, VercelResponse } from "@vercel/node";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "../../lib/b2.js";
import { verifyAuth, supabaseAdmin } from "../../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
    
    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    
    const objectKey = req.query.objectKey as string;
    if (!objectKey) return res.status(400).json({ error: "Missing objectKey" });

    // Ownership check: only the message's own sender may delete the B2 object
    // behind it — otherwise any authenticated user could delete anyone else's
    // media just by knowing/guessing the objectKey.
    const { data: message, error: lookupError } = await supabaseAdmin
        .from("messages")
        .select("id, sender_id")
        .eq("b2_object_key", objectKey)
        .maybeSingle();

    if (lookupError) {
        console.error("Delete: error looking up message for objectKey", lookupError);
        return res.status(500).json({ error: "Internal Server Error" });
    }

    if (!message) return res.status(404).json({ error: "Not found" });
    if (message.sender_id !== user.id) return res.status(403).json({ error: "Forbidden" });

    await getS3Client().send(new DeleteObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: objectKey,
    }));
    
    res.json({ success: true });
}
