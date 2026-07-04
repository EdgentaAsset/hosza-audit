/** Jenis kongsi seluruh app. */

/** Status paparan aset pada kad/badge. */
export type AuditStatus = 'belum' | 'done' | 'pending' | 'issue';

/** Data yang diperlukan untuk melukis satu kad aset. */
export interface AssetCardData {
  assetNo: string;
  name: string;
  status: AuditStatus;
  location: string;
  dept: string;
  /** Baris spesifikasi, cth "Daikin FTV50 · UNIZA A45210" */
  spec: string;
  ppmScheduled?: boolean;
  /** Bilangan gambar diambil / sasaran */
  photoCount?: number;
  photoTotal?: number;
  /** URL thumbnail gambar (dipapar pada kad selesai) */
  thumbs?: string[];
  /** Pemeriksa + tarikh (untuk kad selesai), cth "Ali · 28 Jun" */
  auditedBy?: string;
}

/** Keadaan satu langkah dalam penjejak audit berpandu. */
export type StepState = 'done' | 'current' | 'todo';
