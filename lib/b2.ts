import { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function getS3Client() {
  if (!client) {
    if (!process.env.B2_APPLICATION_KEY_ID || !process.env.B2_APPLICATION_KEY || !process.env.B2_ENDPOINT) {
        throw new Error("B2 configuration missing");
    }
    let endpoint = process.env.B2_ENDPOINT;
    if (endpoint && !endpoint.startsWith('http')) {
        endpoint = 'https://' + endpoint;
    }
    client = new S3Client({
      region: "us-west-004", // Backblaze S3 region
      endpoint: endpoint,
      credentials: {
        accessKeyId: process.env.B2_APPLICATION_KEY_ID,
        secretAccessKey: process.env.B2_APPLICATION_KEY,
      },
      forcePathStyle: true,
    });
  }
  return client;
}
