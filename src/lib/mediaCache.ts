import * as FileSystem from 'expo-file-system';

// Receiver media must survive normal OS cache cleanup because the B2 copy is
// deleted only after the receiver has safely stored it locally.
const CACHE_DIR = `${FileSystem.documentDirectory}voiceid-media/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

function pathFor(messageId: string, ext: string) {
  return `${CACHE_DIR}${messageId}.${ext}`;
}

function extFromMime(mime: string) {
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

/** Returns the local file:// URI for a cached message, or null if not cached. */
export async function getCachedMedia(messageId: string, mime: string): Promise<string | null> {
  await ensureDir();
  const uri = pathFor(messageId, extFromMime(mime));
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? uri : null;
}

/** Downloads a remote (signed B2) URL into the local cache and returns the file:// URI. */
export async function downloadToCache(messageId: string, remoteUrl: string, mime: string): Promise<string> {
  await ensureDir();
  const uri = pathFor(messageId, extFromMime(mime));
  const result = await FileSystem.downloadAsync(remoteUrl, uri);
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    throw new Error(`Media download failed (${result.status})`);
  }
  return uri;
}

/** Copies a freshly-recorded/picked local file into the cache under the message's id. */
export async function cacheLocalFile(messageId: string, localUri: string, mime: string): Promise<string> {
  await ensureDir();
  const uri = pathFor(messageId, extFromMime(mime));
  await FileSystem.copyAsync({ from: localUri, to: uri });
  return uri;
}

export async function deleteCachedMedia(messageId: string, mime: string) {
  const uri = pathFor(messageId, extFromMime(mime));
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
}
