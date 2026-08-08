import { Request, Response } from 'express';
import crypto from 'crypto';

export default function handler(req: Request, res: Response) {
  const { timestamp, folder, public_id } = req.body;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  
  if (!apiSecret || !apiKey) {
    console.error("Cloudinary configuration missing");
    return res.status(500).json({ error: 'Cloudinary configuration missing' });
  }

  const params: Record<string, any> = {
    timestamp,
    folder,
    public_id,
  };
  
  if (!timestamp || !folder || !public_id) {
    console.error("Missing required parameters", params);
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const signature = crypto
    .createHash('sha1')
    .update(Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&') + apiSecret)
    .digest('hex');

  res.json({ signature, apiKey });
}
