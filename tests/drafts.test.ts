/**
 * UJIAN REGRESI ISU LAPANGAN #2 (app v2):
 * "Keluar app pergi gallery, masuk balik semua kerja hilang."
 * Punca lama: simpan hanya bila tekan Simpan + fallback in-memory senyap.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDbForTests } from '../src/data/db';
import {
  clearDraft,
  getDraft,
  getPosition,
  saveDraft,
  savePosition,
} from '../src/data/drafts';

beforeEach(async () => {
  await _resetDbForTests();
  globalThis.indexedDB = new IDBFactory();
});

describe('ISU #2: kerja tak hilang bila app dibunuh', () => {
  it('setiap ketukan disimpan — app "dibunuh" — draf masih ada', async () => {
    // Pengguna menaip tiga kali (tiga perubahan berturut)
    await saveDraft('SZA00001F', { fields: { brand: 'D' } });
    await saveDraft('SZA00001F', { fields: { brand: 'Da' } });
    await saveDraft('SZA00001F', { fields: { brand: 'Daikin', model: 'FTV50' } });

    // Android bunuh app (sambungan DB hilang) — data MESTI kekal dalam storan
    await _resetDbForTests();

    const draft = await getDraft('SZA00001F');
    expect(draft).toBeDefined();
    expect(draft!.fields).toEqual({ brand: 'Daikin', model: 'FTV50' });
  });

  it('merge tidak memadam medan lain / semakan langkah', async () => {
    await saveDraft('SZA00002F', { fields: { locno: 'W5-A3-014' }, guidedStep: 2 });
    await saveDraft('SZA00002F', { semakan: { uniza: 'Tiada Isu' } });
    await saveDraft('SZA00002F', { guidedStep: 3 });

    const draft = await getDraft('SZA00002F');
    expect(draft!.fields.locno).toBe('W5-A3-014');
    expect(draft!.semakan).toEqual({ uniza: 'Tiada Isu' });
    expect(draft!.guidedStep).toBe(3);
  });

  it('app ingat kedudukan terakhir (aset + langkah) selepas dibuka semula', async () => {
    await savePosition({ screen: 'guided', asset: 'SZA00003F', step: 4 });
    await _resetDbForTests(); // "dibunuh"
    const pos = await getPosition();
    expect(pos).toMatchObject({ screen: 'guided', asset: 'SZA00003F', step: 4 });
  });

  it('clearDraft memadam draf selepas simpan rasmi', async () => {
    await saveDraft('SZA00004F', { fields: { note: 'ok' } });
    await clearDraft('SZA00004F');
    expect(await getDraft('SZA00004F')).toBeUndefined();
  });
});
