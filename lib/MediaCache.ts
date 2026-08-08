import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'MediaCache';
const STORE_NAME = 'media';

export interface MediaRecord {
  messageId: string;
  mediaType: 'voice' | 'image';
  blob: Blob;
  mimeType: string;
  byteSize: number;
  createdAt: number;
  sha256: string;
  deliveryStatus: 'pending' | 'delivered';
}

interface MediaDB {
  media: {
    key: string; // messageId
    value: MediaRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<MediaDB>>;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<MediaDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME);
      },
    });
  }
  return dbPromise;
}

export const MediaCache = {
  async putMedia(record: MediaRecord) {
    const db = await getDB();
    await db.put(STORE_NAME, record, record.messageId);
  },
  async getMedia(messageId: string): Promise<MediaRecord | undefined> {
    const db = await getDB();
    return await db.get(STORE_NAME, messageId);
  },
  async hasMedia(messageId: string): Promise<boolean> {
    const db = await getDB();
    return !!(await db.get(STORE_NAME, messageId));
  },
  async deleteMedia(messageId: string) {
    const db = await getDB();
    await db.delete(STORE_NAME, messageId);
  },
  async getMetadata(messageId: string): Promise<Omit<MediaRecord, 'blob'> | undefined> {
    const record = await this.getMedia(messageId);
    if (!record) return undefined;
    const { blob, ...metadata } = record;
    return metadata;
  }
};
