/**
 * Audit berpandu — lapisan data: siap = satu hantaran lengkap;
 * draf & kedudukan dibersihkan; boleh sambung selepas app dibunuh.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDbForTests } from '../src/data/db';
import { completeGuided, getAudit, type UpsertPayload } from '../src/data/audits';
import { getDraft, getPosition, saveDraft, savePosition } from '../src/data/drafts';
import { pendingItems } from '../src/sync/outbox';

beforeEach(async () => {
  await _resetDbForTests();
  globalThis.indexedDB = new IDBFactory();
});

describe('completeGuided', () => {
  it('satu hantaran lengkap: tick + edits + semakan + catatan', async () => {
    await completeGuided('SZA00001F', {
      fields: { locno: 'W6-01', brand: 'Daikin' },
      note: 'tag pudar',
      semakan: {
        uniza: 'Tiada Isu',
        lokasi: 'Dibetulkan',
        jenis: 'Tiada Isu',
        spec: 'Dibetulkan',
        gambar: 'Dilangkau',
        catatan: 'Selesai',
      },
      uniza: 'A45210',
    });

    const rec = await getAudit('SZA00001F');
    expect(rec?.checked).toBe(true);
    expect(rec?.method).toBe('Berpandu');
    expect(rec?.edits).toEqual({ locno: 'W6-01', brand: 'Daikin' });
    expect(rec?.note).toBe('tag pudar');
    expect(rec?.semakan?.gambar).toBe('Dilangkau');

    const items = await pendingItems();
    expect(items).toHaveLength(1);
    const p = items[0].payload as UpsertPayload;
    expect(p.method).toBe('Berpandu');
    expect(p.semakan?.lokasi).toBe('Dibetulkan');
    expect(p.checked).toBe(true);
  });

  it('membersihkan draf & kedudukan selepas siap', async () => {
    // Simulasi audit separuh jalan yang dipersist
    await saveDraft('SZA00002F', {
      guidedStep: 4,
      fields: { brand: 'X' },
      semakan: { uniza: 'Tiada Isu' },
    });
    await savePosition({ screen: 'guided', asset: 'SZA00002F', step: 4 });

    await completeGuided('SZA00002F', { semakan: { uniza: 'Tiada Isu' } });

    expect(await getDraft('SZA00002F')).toBeUndefined();
    expect(await getPosition()).toBeUndefined();
  });

  it('ISU #2: keadaan berpandu kekal selepas app dibunuh (draf + posisi)', async () => {
    await saveDraft('SZA00003F', {
      guidedStep: 3,
      semakan: { uniza: 'Tiada Tagging', lokasi: 'Tiada Isu' },
      fields: { uniza: 'BARU-123' },
    });
    await savePosition({ screen: 'guided', asset: 'SZA00003F', step: 3 });

    await _resetDbForTests(); // "dibunuh"

    const draft = await getDraft('SZA00003F');
    const pos = await getPosition();
    expect(draft?.guidedStep).toBe(3);
    expect(draft?.semakan).toEqual({ uniza: 'Tiada Tagging', lokasi: 'Tiada Isu' });
    expect(draft?.fields.uniza).toBe('BARU-123');
    expect(pos).toMatchObject({ screen: 'guided', asset: 'SZA00003F', step: 3 });
  });
});
