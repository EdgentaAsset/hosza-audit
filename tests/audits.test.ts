/**
 * Aliran audit teras: setiap tindakan = rekod tempatan + item outbox.
 * Tiada tindakan yang wujud "di skrin sahaja".
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDbForTests } from '../src/data/db';
import { getAudit, saveEdits, tickAudit, untickAudit } from '../src/data/audits';
import { allItems, pendingItems } from '../src/sync/outbox';
import { getDraft, saveDraft } from '../src/data/drafts';
import type { UpsertPayload } from '../src/data/audits';

beforeEach(async () => {
  await _resetDbForTests();
  globalThis.indexedDB = new IDBFactory();
});

describe('tick', () => {
  it('tick menyimpan rekod + memasukkan outbox serentak', async () => {
    await tickAudit('SZA00001F', { uniza: 'A45210' });
    const rec = await getAudit('SZA00001F');
    expect(rec?.checked).toBe(true);
    expect(rec?.checkedAt).toBeTruthy();

    const items = await pendingItems();
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('upsert');
    const payload = items[0].payload as UpsertPayload;
    expect(payload.checked).toBe(true);
    expect(payload.uniza).toBe('A45210');
  });

  it('batal tick turut dihantar (rekod dikemaskini di pusat, bukan senyap)', async () => {
    await tickAudit('SZA00002F');
    await untickAudit('SZA00002F');
    const rec = await getAudit('SZA00002F');
    expect(rec?.checked).toBe(false);
    expect(await allItems()).toHaveLength(2); // dua hantaran: tick + batal
  });
});

describe('edit', () => {
  it('saveEdits merge pembetulan + enqueue + bersihkan draf', async () => {
    await saveDraft('SZA00003F', { fields: { brand: 'Daikin' } });
    await saveEdits('SZA00003F', { brand: 'Daikin', locno: 'W6-01' }, 'nota ujian');

    const rec = await getAudit('SZA00003F');
    expect(rec?.edits).toEqual({ brand: 'Daikin', locno: 'W6-01' });
    expect(rec?.note).toBe('nota ujian');
    expect(await getDraft('SZA00003F')).toBeUndefined(); // draf dibersihkan

    const items = await pendingItems();
    expect(items).toHaveLength(1);
    expect((items[0].payload as UpsertPayload).edits).toEqual({
      brand: 'Daikin',
      locno: 'W6-01',
    });
  });

  it('edit kemudian tick — rekod sama, dua hantaran, edits kekal', async () => {
    await saveEdits('SZA00004F', { serial: 'SN-123' });
    await tickAudit('SZA00004F');
    const rec = await getAudit('SZA00004F');
    expect(rec?.checked).toBe(true);
    expect(rec?.edits).toEqual({ serial: 'SN-123' });
    const items = await pendingItems();
    expect(items).toHaveLength(2);
    // Hantaran terakhir membawa keadaan penuh (checked + edits)
    const last = items[items.length - 1].payload as UpsertPayload;
    expect(last.checked).toBe(true);
    expect(last.edits).toEqual({ serial: 'SN-123' });
  });
});
