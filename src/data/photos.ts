/**
 * Gambar aset — kompres di peranti, thumb disimpan tempatan, upload via outbox.
 * Rekod tempatan kekal walau app dibunuh; url diisi bila server sahkan.
 */
import { dbGet, dbGetAll, dbPut } from './db';
import { enqueue } from '../sync/outbox';

export type PhotoKind = 'aset' | 'nameplate' | 'keseluruhan' | 'tambahan1' | 'tambahan2' | 'jenisisu';

export const MAIN_KINDS: PhotoKind[] = ['aset', 'nameplate', 'keseluruhan'];

export const KIND_LABEL: Record<PhotoKind, string> = {
  aset: 'No. Aset',
  nameplate: 'Nameplate',
  keseluruhan: 'Keseluruhan',
  tambahan1: 'Tambahan 1',
  tambahan2: 'Tambahan 2',
  jenisisu: 'Isu Jenis Aset',
};

export interface PhotoRec {
  id: string; // `${asset}:${kind}`
  asset: string;
  kind: PhotoKind;
  /** dataURL kecil untuk paparan kad (±256px) */
  thumb: string;
  /** URL Drive selepas server sahkan */
  url?: string;
  takenAt: number;
}

/** Kecilkan imej ke maxPx & pulangkan JPEG. */
async function resize(file: Blob, maxPx: number, quality: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return canvas.toDataURL('image/jpeg', quality);
}

/** Proses fail dari kamera/galeri → simpan tempatan + baris gilir upload. */
export async function addPhoto(asset: string, kind: PhotoKind, file: Blob): Promise<PhotoRec> {
  // ponytail: 1600px/0.8 lalai (3G hospital); knob penuh bila skrin Tetapan siap
  const full = await resize(file, 1600, 0.8);
  const thumb = await resize(file, 256, 0.7);
  const rec: PhotoRec = { id: `${asset}:${kind}`, asset, kind, thumb, takenAt: Date.now() };
  await dbPut('photos', rec);
  await enqueue('photo', asset, {
    asset,
    kind,
    dataB64: full.split(',')[1],
    mimeType: 'image/jpeg',
    filename: `${asset}_${kind}.jpg`,
  });
  return rec;
}

/** Simpan URL Drive selepas resit server (dipanggil enjin sync). */
export async function setPhotoUrl(asset: string, kind: string, url: string): Promise<void> {
  const rec = await dbGet<PhotoRec>('photos', `${asset}:${kind}`);
  if (rec) await dbPut('photos', { ...rec, url });
}

export async function photosOf(asset: string): Promise<PhotoRec[]> {
  return (await dbGetAll<PhotoRec>('photos')).filter((p) => p.asset === asset);
}

export async function allPhotos(): Promise<PhotoRec[]> {
  return dbGetAll<PhotoRec>('photos');
}

/** Buka pemilih kamera/galeri OS & pulangkan fail (null kalau batal). */
export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*'; // Android tawar Kamera ATAU Galeri — dua-dua dapat
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // oncancel disokong browser moden; fallback: biar promise tergantung tanpa kesan
    input.oncancel = () => resolve(null);
    input.click();
  });
}
