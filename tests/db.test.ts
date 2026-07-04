/**
 * Ujian lapisan DB — termasuk regresi "fallback senyap" (sebahagian isu #2):
 * app lama jatuh diam-diam ke mod in-memory bila IndexedDB gagal; app baru
 * MESTI melempar DbUnavailableError yang jelas.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  _resetDbForTests,
  DbUnavailableError,
  dbBulkPut,
  dbGetAll,
  dbPut,
  metaGet,
  metaSet,
  openDb,
} from '../src/data/db';

beforeEach(async () => {
  await _resetDbForTests();
  globalThis.indexedDB = new IDBFactory();
});

describe('lapisan DB', () => {
  it('membuka DB dengan semua store', async () => {
    const db = await openDb();
    const names = Array.from(db.objectStoreNames).sort();
    expect(names).toEqual(['assets', 'audits', 'drafts', 'meta', 'outbox', 'photos', 'ppm']);
  });

  it('bulkPut menulis banyak rekod dalam satu transaksi', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      id: `SZA${String(i).padStart(5, '0')}F`,
      asset: `SZA${String(i).padStart(5, '0')}F`,
      name: `Aset ${i}`,
    }));
    await dbBulkPut('assets', rows);
    expect(await dbGetAll('assets')).toHaveLength(500);
  });

  it('meta simpan & baca nilai kecil', async () => {
    await metaSet('masterVersion', '2026-07-04');
    expect(await metaGet('masterVersion')).toBe('2026-07-04');
  });

  it('TIADA fallback senyap: DB gagal → DbUnavailableError, tulisan turut gagal', async () => {
    // Simulasi persekitaran yang menyekat IndexedDB (cth mod peribadi lama)
    globalThis.indexedDB = {
      open() {
        throw new Error('sekat');
      },
    } as unknown as IDBFactory;

    await expect(openDb()).rejects.toBeInstanceOf(DbUnavailableError);
    // dan operasi tulis TIDAK berpura-pura berjaya (app lama buat begitu):
    await expect(dbPut('audits', { asset: 'SZA00001F' })).rejects.toBeInstanceOf(
      DbUnavailableError,
    );
  });

  it('selepas kegagalan, cubaan semula dibenarkan bila storan pulih', async () => {
    globalThis.indexedDB = {
      open() {
        throw new Error('sekat');
      },
    } as unknown as IDBFactory;
    await expect(openDb()).rejects.toBeInstanceOf(DbUnavailableError);

    globalThis.indexedDB = new IDBFactory(); // storan "pulih"
    const db = await openDb();
    expect(db.objectStoreNames.length).toBeGreaterThan(0);
  });
});
