import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'inkdrop';
const DB_VERSION = 1;
const STORE_NAME = 'signatures';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAll<T>(store: string = STORE_NAME): Promise<T[]> {
  const db = await getDb();
  return db.getAll(store);
}

export async function put<T>(value: T, store: string = STORE_NAME): Promise<void> {
  const db = await getDb();
  await db.put(store, value);
}

export async function del(key: string, store: string = STORE_NAME): Promise<void> {
  const db = await getDb();
  await db.delete(store, key);
}
