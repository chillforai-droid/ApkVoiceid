import Constants from 'expo-constants';
import { supabase } from './supabase';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

if (!API_BASE_URL) {
  console.warn(
    'API_BASE_URL is not set — media upload/download will fail. Set it as a build-time env var / GitHub Secret.'
  );
}

async function authHeader() {
  let session = (await supabase.auth.getSession()).data.session;

  // Extra safety net on top of the AppState-driven auto-refresh in
  // supabase.ts: if the token is already expired (or expires within 30s),
  // force a refresh before using it, so a slow/late refresh cycle can't
  // still produce a 401 on the request that follows.
  const expiresAt = session?.expires_at ?? 0;
  const isExpiringSoon = expiresAt * 1000 < Date.now() + 30_000;
  if (session && isExpiringSoon) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session ?? session;
  }

  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Uploads a local file (image or voice recording) to B2 via the website's
 * server-side proxy, mirroring handleImageUpload / sendAudio in the web app.
 * Returns the objectKey to store on the message row.
 */
export async function uploadMedia(fileUri: string, mimeType: string): Promise<string> {
  const headers = await authHeader();
  const fileRes = await fetch(fileUri);
  const blob = await fileRes.blob();

  const uploadRes = await fetch(`${API_BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: { 'Content-Type': mimeType, ...headers },
    body: blob,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => '');
    throw new Error(`Upload failed (${uploadRes.status})${body ? `: ${body}` : ''}`);
  }
  const { objectKey } = await uploadRes.json();
  if (!objectKey) throw new Error('Upload did not return an objectKey');
  return objectKey;
}

/**
 * Requests a signed B2 download URL for a message's media, same flow as
 * fetchAndCacheMedia in the web app's src/lib/mediaDownload.ts.
 */
export async function getDownloadUrl(messageId: string): Promise<string> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE_URL}/api/media/download-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ messageId }),
  });
  if (!res.ok) throw new Error(`Download authorization failed (${res.status})`);
  const { url } = await res.json();
  if (!url) throw new Error('Invalid download URL');
  return url;
}

/** Best-effort ack so the server can clean up the ephemeral B2 object. */
export async function ackMedia(messageId: string) {
  const headers = await authHeader();
  fetch(`${API_BASE_URL}/api/media/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ messageId }),
  }).catch(() => {});
}

export async function deleteMedia(objectKey: string) {
  const headers = await authHeader();
  await fetch(`${API_BASE_URL}/api/media/delete/${objectKey}`, {
    method: 'DELETE',
    headers,
  });
}
