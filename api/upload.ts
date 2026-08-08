import { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client } from "../lib/b2.js";
import { verifyAuth } from "../lib/auth.js";

/**
 * ROOT CAUSE FIX (2026-08-04, take 2): production Vercel logs showed
 * "Are you using a Stream of unknown length as the Body of a PutObject request?" — meaning
 * req.body here is NOT a pre-buffered Buffer as express.raw() gives it in the Docker/Cloud
 * Run path, it's the raw unconsumed request stream. Passing a stream of unknown length
 * straight to PutObjectCommand is exactly what could silently write a truncated/corrupt
 * object to B2 (the original bug). My first fix (checking Buffer.isBuffer/typeof string)
 * didn't account for the stream case at all, so it misclassified every valid Vercel upload
 * as "empty" and rejected them outright — that's what broke uploads entirely just now.
 * This reads the body correctly for either runtime shape into one concrete Buffer with a
 * known length before validating or uploading, which also eliminates the SDK warning itself.
 */
async function readRawBody(req: VercelRequest): Promise<Buffer> {
    const body: any = req.body;
    if (Buffer.isBuffer(body)) return body;
    if (typeof body === "string" && body.length > 0) return Buffer.from(body, "utf8");

    // Neither Buffer nor string — read the actual bytes off whichever object is the real
    // stream: req.body itself if it's stream-like (has .pipe), otherwise the request object.
    const source: any = body && typeof body.pipe === "function" ? body : req;
    const chunks: Buffer[] = [];
    for await (const chunk of source as AsyncIterable<Buffer | string>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    let stage = "initialization";
    try {
        stage = "authentication";
        const user = await verifyAuth(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        stage = "body_read";
        const bodyBuffer = await readRawBody(req);

        stage = "body_validation";
        if (bodyBuffer.length === 0) {
            console.error("Upload rejected: empty request body", {
                contentType: req.headers["content-type"] || "(missing)",
                contentLength: req.headers["content-length"] || "(missing)",
            });
            return res.status(400).json({
                error: "Upload failed",
                stage,
                message: "No file data was received. Please try again.",
            });
        }

        stage = "s3_client_setup";
        const s3Client = getS3Client();

        const objectKey = crypto.randomUUID();
        const command = new PutObjectCommand({
          Bucket: process.env.B2_BUCKET_NAME,
          Key: objectKey,
          ContentType: (req.headers['content-type'] as string) || "application/octet-stream",
          Body: bodyBuffer,
          ContentLength: bodyBuffer.length,
        });
        
        stage = "s3_upload";
        await s3Client.send(command);
        
        stage = "success";
        res.json({ objectKey });
    } catch (e: any) {
        console.error(`Upload failed at stage: ${stage}`, e);
        res.status(500).json({ 
            error: "Upload failed",
            stage,
            message: e.message,
            details: e.$metadata || {} 
        });
    }
}
