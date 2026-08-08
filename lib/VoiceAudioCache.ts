import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'VoiceAudioCache';
const STORE_NAME = 'audio';

interface VoiceAudioDB {
  audio: {
    key: string; // messageId
    value: Blob;
  };
}

let dbPromise: Promise<IDBPDatabase<VoiceAudioDB>>;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<VoiceAudioDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME);
      },
    });
  }
  return dbPromise;
}

export const VoiceAudioCache = {
  async saveAudio(messageId: string, blob: Blob) {
    const db = await getDB();
    await db.put(STORE_NAME, blob, messageId);
  },
  async getAudio(messageId: string): Promise<Blob | undefined> {
    const db = await getDB();
    return await db.get(STORE_NAME, messageId);
  },
  async hasAudio(messageId: string): Promise<boolean> {
    const db = await getDB();
    return !!(await db.get(STORE_NAME, messageId));
  },
  async deleteAudio(messageId: string) {
    const db = await getDB();
    await db.delete(STORE_NAME, messageId);
  },
};
