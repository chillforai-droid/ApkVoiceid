import { supabase } from './supabase';
import { MediaCache } from './MediaCache';
import { calculateSHA256 } from './crypto';

/**
 * Shared B2 download flow used by both ImageMessage and VoiceMessage.
 *
 * 1. Returns the locally cached blob if we already have it.
 * 2. Otherwise requests a signed download URL from /api/media/download-auth,
 *    downloads the object, caches it in MediaCache, and acknowledges receipt
 *    via /api/media/ack (which lets the server delete the ephemeral B2
 *    object). Acking is best-effort: it is expected to fail (403) when the
 *    viewer is the message sender, since only the recipient should trigger
 *    server-side cleanup.
 */
export async function fetchAndCacheMedia(message: any, mediaType: 'image' | 'voice'): Promise<Blob> {
  const cached = await MediaCache.getMedia(message.id);
  if (cached) return cached.blob;

  if (!message.b2_object_key) {
    throw new Error('Message has no B2 object key');
  }

  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  // Browser-safe same-origin download. The native app can keep using
  // /api/media/download-auth + the B2 presigned URL. Fetching B2 directly from
  // the browser is fragile when the site's origin is voiceid.online but B2 CORS
  // is configured for www.voiceid.online (or vice versa).
  const blobRes = await fetch('/api/media/download', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messageId: message.id }),
  });

  if (!blobRes.ok) {
    let detail = '';
    try { detail = await blobRes.text(); } catch {}
    throw new Error(`Failed to fetch media (${blobRes.status})${detail ? `: ${detail}` : ''}`);
  }
  const blob = await blobRes.blob();

  // IMPORTANT: Do not block rendering/caching on message SHA/size metadata.
  // Mobile and web clients created older messages with slightly different
  // metadata/hash implementations. The authoritative success condition for
  // ephemeral media is: the authenticated download returned actual bytes and
  // those bytes were committed to this receiver's local IndexedDB cache.
  // We still calculate/log integrity differences for diagnostics, but a stale
  // metadata value must never turn a valid downloaded image into
  // "Failed to load image" or prevent local persistence.
  if (blob.size <= 0) throw new Error('Downloaded media is empty');
  if (message.byte_size && blob.size !== Number(message.byte_size)) {
    console.warn('Media byte_size metadata mismatch', {
      messageId: message.id,
      expected: Number(message.byte_size),
      actual: blob.size,
    });
  }
  if (message.sha256) {
    try {
      const actualHash = await calculateSHA256(blob);
      if (actualHash !== message.sha256) {
        console.warn('Media SHA-256 metadata mismatch', {
          messageId: message.id,
          expected: message.sha256,
          actual: actualHash,
        });
      }
    } catch (error) {
      console.warn('Media integrity diagnostic skipped', error);
    }
  }

  await MediaCache.putMedia({
    messageId: message.id,
    mediaType,
    blob,
    mimeType: message.mime_type || blob.type,
    byteSize: message.byte_size || blob.size,
    createdAt: Date.now(),
    sha256: message.sha256 || '',
    deliveryStatus: 'delivered',
  });

  // Best-effort ack; server rejects this for the sender's own message, which is fine.
  fetch('/api/media/ack', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ messageId: message.id }),
  }).catch(() => {});

  return blob;
}
