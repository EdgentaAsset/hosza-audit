/**
 * UJIAN REGRESI ISU LAPANGAN #3 (app v2):
 * "Upload tersekat — ada internet tapi tak upload, refresh terus hilang."
 * Punca lama: rekod status 'sending' tak pernah di-retry dan tak dipersist.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDbForTests, dbGetAll, dbPut } from '../src/data/db';
import {
  allItems,
  enqueue,
  outboxCount,
  pendingItems,
  processOutbox,
  resetStuckSending,
  type OutboxItem,
} from '../src/sync/outbox';

beforeEach(async () => {
  await _resetDbForTests();
  globalThis.indexedDB = new IDBFactory(); // DB kosong setiap ujian
});

describe('outbox asas', () => {
  it('enqueue meletakkan item berstatus pending', async () => {
    await enqueue('upsert', 'SZA00001F', { checked: true });
    const items = await pendingItems();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
    expect(items[0].asset).toBe('SZA00001F');
  });

  it('item KEKAL selepas app "dibuka semula" (persist, bukan memori)', async () => {
    await enqueue('upsert', 'SZA00002F', {});
    // Simulasi tutup-buka app: sambungan DB dilupakan, data mesti kekal.
    await _resetDbForTests();
    const items = await pendingItems();
    expect(items).toHaveLength(1);
    expect(items[0].asset).toBe('SZA00002F');
  });
});

describe('ISU #3: rekod tersekat "sending"', () => {
  it('resetStuckSending mengembalikan sending → pending pada boot', async () => {
    // Simulasi app terbunuh SEMASA menghantar: item tertulis 'sending' dalam DB.
    const id = await enqueue('photo', 'SZA00003F', { kind: 'aset' });
    const all = await dbGetAll<OutboxItem>('outbox');
    const item = all.find((i) => i.id === id)!;
    item.status = 'sending';
    await dbPut('outbox', item);

    // App lama: item ini terperangkap selamanya (hanya local/failed di-retry).
    // App baru: boot memulihkannya.
    const restored = await resetStuckSending();
    expect(restored).toBe(1);
    const items = await pendingItems();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('pending');
  });

  it('selepas dipulihkan, item benar-benar dihantar semula', async () => {
    const id = await enqueue('upsert', 'SZA00004F', {});
    const all = await dbGetAll<OutboxItem>('outbox');
    const item = all.find((i) => i.id === id)!;
    item.status = 'sending';
    await dbPut('outbox', item);

    await resetStuckSending();
    const sent: string[] = [];
    await processOutbox(async (i) => {
      sent.push(i.asset);
      return 'confirmed';
    });
    expect(sent).toEqual(['SZA00004F']);
    expect(await outboxCount()).toBe(0);
  });
});

describe('resit pengesahan', () => {
  it('item keluar dari peti HANYA selepas resit (confirmed)', async () => {
    await enqueue('upsert', 'SZA00005F', {});
    const summary = await processOutbox(async () => 'confirmed');
    expect(summary.confirmed).toBe(1);
    expect(await outboxCount()).toBe(0);
  });

  it('tiada resit → item kekal (failed), TIDAK hilang', async () => {
    await enqueue('upsert', 'SZA00006F', {});
    const summary = await processOutbox(async () => 'retry');
    expect(summary.failed).toBe(1);
    const items = await allItems();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe('failed');
    expect(items[0].lastError).toBe('tiada-resit');
  });

  it('sender melempar ralat → item kekal dengan lastError, boleh retry', async () => {
    await enqueue('upsert', 'SZA00007F', {});
    await processOutbox(async () => {
      throw new Error('talian putus');
    });
    const items = await pendingItems(); // failed termasuk dalam senarai retry
    expect(items).toHaveLength(1);
    expect(items[0].lastError).toBe('talian putus');
    expect(items[0].attempts).toBe(1);

    // Cubaan kedua berjaya
    await processOutbox(async () => 'confirmed');
    expect(await outboxCount()).toBe(0);
  });

  it('diproses tertua dahulu', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const id = await enqueue('upsert', `SZA0000${8 + i}F`, {});
      // paksa createdAt menaik jelas (elak seri masa)
      const all = await dbGetAll<OutboxItem>('outbox');
      const item = all.find((x) => x.id === id)!;
      item.createdAt = now + i;
      await dbPut('outbox', item);
    }
    const order: string[] = [];
    await processOutbox(async (i) => {
      order.push(i.asset);
      return 'confirmed';
    });
    expect(order).toEqual(['SZA00008F', 'SZA00009F', 'SZA000010F']);
  });
});
