/**
 * Draf & kedudukan terakhir — "setiap ketukan disimpan".
 *
 * PRINSIP (dari isu lapangan app v2 #2): Android bunuh app di latar bila
 * pengguna keluar ke kamera/gallery. App lama simpan hanya bila tekan Simpan
 * → kerja separuh jalan hilang. Di sini: setiap perubahan borang/langkah
 * disimpan SERTA-MERTA (saveDraft dipanggil on-change), dan app ingat di
 * mana pengguna berada (savePosition) supaya buka semula = sambung terus.
 */
import { dbDel, dbGet, dbPut, metaGet, metaSet } from './db';

/** Draf satu aset — medan yang sedang diubah + keadaan audit berpandu. */
export interface Draft {
  asset: string;
  /** Nilai medan yang diubah (locno, brand, model, serial, uniza, note...) */
  fields: Record<string, string>;
  /** Langkah audit berpandu semasa (1-6), kalau sedang dalam aliran berpandu */
  guidedStep?: number;
  /** Keputusan semakan per langkah (uniza/lokasi/jenis/spec/gambar) */
  semakan?: Record<string, string>;
  updatedAt: number;
}

/** Kemaskini draf secara merge — panggil pada SETIAP perubahan input. */
export async function saveDraft(
  asset: string,
  patch: Partial<Omit<Draft, 'asset' | 'updatedAt'>> & { fields?: Record<string, string> },
): Promise<Draft> {
  const existing = (await dbGet<Draft>('drafts', asset)) ?? {
    asset,
    fields: {},
    updatedAt: 0,
  };
  const merged: Draft = {
    ...existing,
    ...patch,
    fields: { ...existing.fields, ...(patch.fields ?? {}) },
    semakan: patch.semakan ? { ...existing.semakan, ...patch.semakan } : existing.semakan,
    asset,
    updatedAt: Date.now(),
  };
  await dbPut('drafts', merged);
  return merged;
}

export async function getDraft(asset: string): Promise<Draft | undefined> {
  return dbGet<Draft>('drafts', asset);
}

/** Padam draf selepas ia disimpan rasmi (masuk audits + outbox). */
export async function clearDraft(asset: string): Promise<void> {
  await dbDel('drafts', asset);
}

/* ---------- Kedudukan terakhir (sambung di mana tinggal) ---------- */

export interface Position {
  /** Skrin semasa, cth 'guided' | 'edit' | 'senarai' */
  screen: string;
  asset?: string;
  step?: number;
  savedAt: number;
}

const POS_KEY = 'lastPosition';

export async function savePosition(pos: Omit<Position, 'savedAt'>): Promise<void> {
  await metaSet<Position>(POS_KEY, { ...pos, savedAt: Date.now() });
}

export async function getPosition(): Promise<Position | undefined> {
  return metaGet<Position>(POS_KEY);
}

export async function clearPosition(): Promise<void> {
  await metaSet(POS_KEY, undefined);
}
