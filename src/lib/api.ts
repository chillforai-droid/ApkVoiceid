import Constants from 'expo-constants';
import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

const configuredApiBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

// voiceid.online currently redirects API traffic while the www host serves the
// media routes reliably. Keep ONE canonical origin in the APK; two URLs must
// not be concatenated into API_BASE_URL. The fallback only protects builds
// where the GitHub secret was accidentally omitted.
const API_BASE_URL = (configuredApiBaseUrl || 'https://www.voiceid.online').replace(/\/+$/, '');

if (!configuredApiBaseUrl) {
  console.warn('API_BASE_URL is not set; using canonical https://www.voiceid.online');
} else if (API_BASE_URL === 'https://voiceid.online') {
  console.warn('Use https://www.voiceid.online as API_BASE_URL to avoid redirect-sensitive media uploads.');
}

/** Thrown when the user's session can't be used/refreshed and they need to log in again. */
export class SessionExpiredError extends Error {
  constructor() {
    super('आपका session expire हो गया है। कृपया दोबारा login करें।');
    this.name = 'SessionExpiredError';
  }
}

async function authHeader(): Promise<{ Authorization: string }> {
  let session = (await supabase.auth.getSession()).data.session;

  if (!session) {
    // Not logged in / session never restored — no point sending the request.
    throw new SessionExpiredError();
  }

  // Extra safety net on top of the AppState-driven auto-refresh in
  // supabase.ts: if the token is already expired (or expires within 30s),
  // force a refresh before using it, so a slow/late refresh cycle can't
  // still produce a 401 on the request that follows.
  const expiresAt = session.expires_at ?? 0;
  const isExpiringSoon = expiresAt * 1000 < Date.now() + 30_000;

  if (isExpiringSoon) {
    const { data, error } = await supabase.auth.refreshSession();
    // BUG FIX: previously this fell back to `session` (the already-expired
    // one) whenever refresh failed, so the request went out anyway with a
    // token guaranteed to be rejected — that silent fallback is exactly
    // what produced "Upload failed (401): Unauthorized" even though this
    // function looked like it was already protecting against stale tokens.
    // A failed refresh means the refresh token itself is dead (expired /
    // revoked / user logged out elsewhere), so there is no valid token to
    // fall back to — surface that clearly instead of sending a doomed
    // request.
    if (error || !data.session) {
      console.error('authHeader: refreshSession failed, session is dead', error);
      throw new SessionExpiredError();
    }
    session = data.session;
  }

  return { Authorization: `Bearer ${session.access_token}` };
}

/**
 * Uploads a local file (image or voice recording) to B2 via the website's
 * server-side proxy, mirroring handleImageUpload / sendAudio in the web app.
 * Returns the objectKey to store on the message row.
 */
export async function uploadMedia(fileUri: string, mimeType: string): Promise<string> {
  const headers = await authHeader();

  // IMPORTANT: do not convert a React-Native file:// URI to a JS Blob and then
  // pass that Blob to fetch(). On some Android/RN builds that path can report a
  // successful HTTP upload while the bytes arriving at the server are not the
  // original file bytes. Expo FileSystem streams the actual file as binary.
  const result = await FileSystem.uploadAsync(`${API_BASE_URL}/api/media/upload`, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': mimeType, ...headers },
  });

  if (result.status < 200 || result.status >= 300) {
    if (result.status === 401) throw new SessionExpiredError();
    throw new Error(`Upload failed (${result.status})${result.body ? `: ${result.body}` : ''}`);
  }

  let payload: any;
  try { payload = JSON.parse(result.body || '{}'); } catch { payload = {}; }
  if (!payload.objectKey) throw new Error('Upload did not return an objectKey');
  return payload.objectKey;
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
  if (!res.ok) {
    if (res.status === 401) throw new SessionExpiredError();
    throw new Error(`Download authorization failed (${res.status})`);
  }
  const { url } = await res.json();
  if (!url) throw new Error('Invalid download URL');
  return url;
}

/** Best-effort ack so the server can clean up the ephemeral B2 object. */
export async function ackMedia(messageId: string) {
  try {
    const headers = await authHeader();
    fetch(`${API_BASE_URL}/api/media/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ messageId }),
    }).catch(() => {});
  } catch {
    // Best-effort — a dead session here shouldn't block anything else.
  }
}

export async function deleteMedia(objectKey: string) {
  const headers = await authHeader();
  await fetch(`${API_BASE_URL}/api/media/delete/${objectKey}`, {
    method: 'DELETE',
    headers,
  });
}

/**
 * Call this from a catch block around uploadMedia/getDownloadUrl/etc.
 * If the error was a dead session, signs the user out (which the app's
 * RootNavigator picks up automatically and switches back to the Login
 * screen) and shows one clear message, instead of leaving them stuck
 * re-tapping "send" against a token that will never work again.
 * Returns true if it handled the error (caller can skip its own alert).
 */
export async function handleSessionExpired(err: unknown): Promise<boolean> {
  if (err instanceof SessionExpiredError) {
    Alert.alert('Session Expired', err.message);
    await supabase.auth.signOut();
    return true;
  }
  return false;
}
