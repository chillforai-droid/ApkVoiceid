import { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../lib/b2.js";
import { verifyAuth } from "../lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = await verifyAuth(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { mimeType } = req.body;
    const objectKey = crypto.randomUUID();
    const command = new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Key: objectKey,
      ContentType: mimeType,
    });
    
    const url = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
    res.json({ url, objectKey });
}
