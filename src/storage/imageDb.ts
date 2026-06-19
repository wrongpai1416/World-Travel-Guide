// IndexedDB 图片 Blob 存储

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'WorldTravelGuideImageDB';
const DB_VERSION = 1;
const STORE_NAME = 'imageBlobs';

interface ImageBlobRecord {
  key: string;
  blob: Blob;
  mimeType: string;
  size: number;
  createdAt: number;
}

function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    },
  });
}

export const imageDb = {
  async saveBlob(key: string, blob: Blob, mimeType?: string): Promise<string> {
    const db = await getDB();
    const data: ImageBlobRecord = {
      key,
      blob,
      mimeType: mimeType || 'image/png',
      size: blob.size,
      createdAt: Date.now(),
    };
    await db.put(STORE_NAME, data);
    return key;
  },

  async getBlob(key: string): Promise<ImageBlobRecord | null> {
    const db = await getDB();
    const result = await db.get(STORE_NAME, key);
    return result || null;
  },

  async deleteBlob(key: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, key);
  },

  async getAllBlobs(): Promise<ImageBlobRecord[]> {
    const db = await getDB();
    return db.getAll(STORE_NAME);
  },

  async clearAll(): Promise<void> {
    const db = await getDB();
    await db.clear(STORE_NAME);
  },
};
