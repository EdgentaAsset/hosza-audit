/**
 * Rekod audit tempatan — satu rekod per ASSET NO (sama seperti UPSERT backend).
 * Setiap tindakan (tick / edit) DISIMPAN ke IndexedDB dan DIMASUKKAN ke
 * outbox serentak — takkan ada tindakan yang wujud di skrin sahaja.
 */
import { dbGet, dbGetAll, dbPut } from './db';
import { enqueue } from '../sync/outbox';
import { clearDraft, clearPosition } from './drafts';

export interface AuditRecord {
  asset: string;
  checked: boolean;
  /** Masa tick pada peranti (ISO) */
  checkedAt?: string;
  /** Nama pemeriksa (diisi selepas milestone auth; buat masa ini kosong) */
  by?: string;
  method?: 'Tick' | 'Berpandu';
  /** Pembetulan medan: locno, brand, model, serial, uniza */
  edits?: Record<string, string>;
  note?: string;
  /** Keputusan semakan audit berpandu (uniza/lokasi/jenis/spec/gambar) */
  semakan?: Record<string, string>;
  updatedAt: number;
}

/** Payload upsert yang akan sampai ke backend (padan dengan Code.gs). */
export interface UpsertPayload {
  asset: string;
  uniza?: string;
  deviceTime: string;
  checked: boolean;
  checkedAt?: string;
  method?: string;
  edits?: Record<string, string>;
  note?: string;
  semakan?: Record<string, string>;
}

export async function getAudit(asset: string): Promise<AuditRecord | undefined> {
  return dbGet<AuditRecord>('audits', asset);
}

export async function listAudits(): Promise<AuditRecord[]> {
  return dbGetAll<AuditRecord>('audits');
}

function toPayload(rec: AuditRecord, uniza?: string): UpsertPayload {
  return {
    asset: rec.asset,
    uniza,
    deviceTime: new Date().toISOString(),
    checked: rec.checked,
    checkedAt: rec.checkedAt,
    method: rec.method,
    edits: rec.edits,
    note: rec.note,
    semakan: rec.semakan,
  };
}

/** Simpan rekod + baris gilir hantaran dalam satu langkah. */
async function persistAndQueue(rec: AuditRecord, uniza?: string): Promise<AuditRecord> {
  rec.updatedAt = Date.now();
  await dbPut('audits', rec);
  await enqueue('upsert', rec.asset, toPayload(rec, uniza));
  return rec;
}

/** Tanda "Telah Diperiksa". */
export async function tickAudit(asset: string, opts: { uniza?: string; by?: string } = {}): Promise<AuditRecord> {
  const rec: AuditRecord = (await getAudit(asset)) ?? { asset, checked: false, updatedAt: 0 };
  rec.checked = true;
  rec.checkedAt = new Date().toISOString();
  rec.method = rec.method ?? 'Tick';
  if (opts.by) rec.by = opts.by;
  return persistAndQueue(rec, opts.uniza);
}

/** Batal tick (tersilap tanda). */
export async function untickAudit(asset: string, uniza?: string): Promise<AuditRecord> {
  const rec: AuditRecord = (await getAudit(asset)) ?? { asset, checked: false, updatedAt: 0 };
  rec.checked = false;
  rec.checkedAt = undefined;
  return persistAndQueue(rec, uniza);
}

/**
 * Siapkan audit berpandu: satu rekod lengkap (tick + pembetulan + semakan
 * 5 bahagian) dalam SATU hantaran. Draf & kedudukan dibersihkan.
 */
export async function completeGuided(
  asset: string,
  opts: {
    fields?: Record<string, string>;
    note?: string;
    semakan?: Record<string, string>;
    uniza?: string;
    by?: string;
  },
): Promise<AuditRecord> {
  const rec: AuditRecord = (await getAudit(asset)) ?? { asset, checked: false, updatedAt: 0 };
  rec.checked = true;
  rec.checkedAt = new Date().toISOString();
  rec.method = 'Berpandu';
  if (opts.by) rec.by = opts.by;
  if (opts.fields && Object.keys(opts.fields).length) rec.edits = { ...rec.edits, ...opts.fields };
  if (opts.note !== undefined && opts.note !== '') rec.note = opts.note;
  if (opts.semakan) rec.semakan = { ...rec.semakan, ...opts.semakan };
  const saved = await persistAndQueue(rec, opts.uniza);
  await clearDraft(asset);
  await clearPosition();
  return saved;
}

/** Simpan pembetulan medan + catatan. Draf aset itu dibersihkan. */
export async function saveEdits(
  asset: string,
  edits: Record<string, string>,
  note?: string,
  uniza?: string,
): Promise<AuditRecord> {
  const rec: AuditRecord = (await getAudit(asset)) ?? { asset, checked: false, updatedAt: 0 };
  rec.edits = { ...rec.edits, ...edits };
  if (note !== undefined) rec.note = note;
  const saved = await persistAndQueue(rec, uniza);
  await clearDraft(asset);
  return saved;
}
