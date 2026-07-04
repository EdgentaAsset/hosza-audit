/**
 * Lapisan IndexedDB — satu-satunya pintu ke storan peranti.
 *
 * PRINSIP (dari isu lapangan app v2): TIADA fallback senyap.
 * App lama beri IndexedDB 4 saat, kemudian jatuh diam-diam ke "mod ingatan"
 * — semua kerja hilang bila app ditutup. Di sini: kalau DB gagal dibuka,
 * kita campak DbUnavailableError dan UI WAJIB papar amaran besar.
 */

export const DB_NAME = 'hosza-audit';
export const DB_VERSION = 2;

export type StoreName =
  | 'assets' // data master aset (keyPath: id — baris BERGANDA dikekalkan seadanya; index: asset)
  | 'ppm' // jadual PPM per aset (keyPath: asset)
  | 'audits' // keadaan audit tempatan (keyPath: asset)
  | 'photos' // gambar/thumbnail (keyPath: id = `${asset}:${kind}`)
  | 'outbox' // baris gilir hantaran (keyPath: id)
  | 'drafts' // draf borang belum simpan (keyPath: asset)
  | 'meta'; // nilai kecil (keyPath: key) — versi master, kedudukan terakhir, dll

export class DbUnavailableError extends Error {
  constructor(cause?: unknown) {
    super(
      'Storan peranti (IndexedDB) tidak dapat dibuka — audit TIDAK akan disimpan. ' +
        'Jangan teruskan kerja; cuba tutup-buka app, atau semak mod penyemakan imbas peribadi.',
    );
    this.name = 'DbUnavailableError';
    this.cause = cause;
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function openRaw(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(new DbUnavailableError(e));
      return;
    }
    request.onupgradeneeded = (ev) => {
      const db = request.result;
      // v2: assets berkunci 'id' (bukan 'asset') supaya baris berganda dalam
      // Data.xlsx dikekalkan seadanya (keputusan user). Data master boleh
      // diimport semula, jadi store lama selamat dibuang.
      if (ev.oldVersion > 0 && ev.oldVersion < 2 && db.objectStoreNames.contains('assets')) {
        db.deleteObjectStore('assets');
      }
      if (!db.objectStoreNames.contains('assets')) {
        const as = db.createObjectStore('assets', { keyPath: 'id' });
        as.createIndex('asset', 'asset');
      }
      if (!db.objectStoreNames.contains('ppm')) db.createObjectStore('ppm', { keyPath: 'asset' });
      if (!db.objectStoreNames.contains('audits')) db.createObjectStore('audits', { keyPath: 'asset' });
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('outbox')) {
        const ob = db.createObjectStore('outbox', { keyPath: 'id' });
        ob.createIndex('status', 'status');
        ob.createIndex('asset', 'asset');
      }
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'asset' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      // Kalau tab lain upgrade versi, tutup supaya tak sekat — pengguna reload.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(new DbUnavailableError(request.error));
    // 'blocked' bukan kegagalan — tab lama masih pegang DB. Kita tunggu;
    // onsuccess akan menyusul selepas tab itu tutup.
  });
}

/** Buka (atau guna semula) sambungan DB. Gagal = DbUnavailableError, bukan senyap. */
export function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openRaw().catch((e) => {
      dbPromise = null; // benarkan cubaan semula selepas gagal
      throw e instanceof DbUnavailableError ? e : new DbUnavailableError(e);
    });
  }
  return dbPromise;
}

/** Untuk ujian sahaja — lupakan sambungan cache supaya DB baharu dibuka. */
export async function _resetDbForTests(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* abaikan */
    }
  }
  dbPromise = null;
}

/* ---------- Operasi asas (semua async, semua melalui satu sambungan) ---------- */

export async function dbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return req(db.transaction(store, 'readonly').objectStore(store).get(key)) as Promise<T | undefined>;
}

export async function dbPut<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDb();
  await req(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function dbDel(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  await req(db.transaction(store, 'readwrite').objectStore(store).delete(key));
}

export async function dbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return req(db.transaction(store, 'readonly').objectStore(store).getAll()) as Promise<T[]>;
}

export async function dbGetAllByIndex<T>(
  store: StoreName,
  index: string,
  value: IDBValidKey,
): Promise<T[]> {
  const db = await openDb();
  return req(
    db.transaction(store, 'readonly').objectStore(store).index(index).getAll(value),
  ) as Promise<T[]>;
}

export async function dbCount(store: StoreName): Promise<number> {
  const db = await openDb();
  return req(db.transaction(store, 'readonly').objectStore(store).count());
}

export async function dbClear(store: StoreName): Promise<void> {
  const db = await openDb();
  await req(db.transaction(store, 'readwrite').objectStore(store).clear());
}

/** Tulis banyak rekod dalam SATU transaksi (untuk import data master — laju). */
export async function dbBulkPut<T>(store: StoreName, values: T[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const v of values) os.put(v);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/* ---------- Meta (nilai kecil berkunci) ---------- */

export async function metaGet<T>(key: string): Promise<T | undefined> {
  const row = await dbGet<{ key: string; value: T }>('meta', key);
  return row?.value;
}

export async function metaSet<T>(key: string, value: T): Promise<void> {
  await dbPut('meta', { key, value });
}
