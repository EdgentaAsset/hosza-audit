/**
 * Outbox — peti keluar hantaran ke server.
 *
 * PRINSIP (dari isu lapangan app v2 #3): rekod yang tersekat status
 * 'sending' (app terbunuh separuh jalan) TIDAK boleh terperangkap selamanya.
 * App lama hanya retry 'local'/'failed' — rekod 'sending' mati terkandas.
 * Di sini: resetStuckSending() WAJIB dipanggil setiap boot — semua 'sending'
 * dikembalikan ke 'pending' dan dicuba semula. Item hanya keluar dari peti
 * selepas RESIT pengesahan (server sahkan rekod wujud), bukan selepas hantar.
 */
import { dbDel, dbGetAll, dbGetAllByIndex, dbPut } from '../data/db';

export type OutboxStatus = 'pending' | 'sending' | 'failed';

export type OutboxKind = 'upsert' | 'photo' | 'newasset' | 'delete';

export interface OutboxItem<P = unknown> {
  id: string;
  kind: OutboxKind;
  /** ASSET NO yang terlibat — untuk papar status pada kad */
  asset: string;
  payload: P;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Masukkan kerja baharu ke peti keluar. Pulangkan id item. */
export async function enqueue<P>(kind: OutboxKind, asset: string, payload: P): Promise<string> {
  const now = Date.now();
  const item: OutboxItem<P> = {
    id: newId(),
    kind,
    asset,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  await dbPut('outbox', item);
  return item.id;
}

/**
 * WAJIB pada boot: item 'sending' = app terbunuh masa menghantar dan resit
 * tak pernah tiba. Kembalikan ke 'pending' supaya dicuba semula.
 */
export async function resetStuckSending(): Promise<number> {
  const stuck = await dbGetAllByIndex<OutboxItem>('outbox', 'status', 'sending');
  for (const item of stuck) {
    item.status = 'pending';
    item.updatedAt = Date.now();
    await dbPut('outbox', item);
  }
  return stuck.length;
}

/** Item yang menunggu dihantar (pending + failed), tertua dahulu. */
export async function pendingItems(): Promise<OutboxItem[]> {
  const all = await dbGetAll<OutboxItem>('outbox');
  return all
    .filter((i) => i.status === 'pending' || i.status === 'failed')
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function allItems(): Promise<OutboxItem[]> {
  return dbGetAll<OutboxItem>('outbox');
}

export async function outboxCount(): Promise<number> {
  return (await dbGetAll<OutboxItem>('outbox')).length;
}

async function setStatus(item: OutboxItem, status: OutboxStatus, err?: string): Promise<void> {
  item.status = status;
  item.updatedAt = Date.now();
  if (err !== undefined) item.lastError = err;
  await dbPut('outbox', item);
}

/**
 * Hasil sender untuk satu item:
 *  'confirmed' = server SAHKAN rekod wujud (resit) → item dipadam dari peti.
 *  'retry'     = hantar tak pasti/gagal → kekal, ditanda failed, cuba lagi nanti.
 */
export type SendResult = 'confirmed' | 'retry';

export type Sender = (item: OutboxItem) => Promise<SendResult>;

export interface ProcessSummary {
  confirmed: number;
  failed: number;
  skipped: boolean; // true kalau proses lain sedang berjalan
}

let processing = false;

/**
 * Proses peti keluar satu-satu (tertua dahulu). Selamat dipanggil berkali-kali
 * — panggilan bertindih di-skip, bukan berlumba.
 */
export async function processOutbox(send: Sender): Promise<ProcessSummary> {
  if (processing) return { confirmed: 0, failed: 0, skipped: true };
  processing = true;
  try {
    const items = await pendingItems();
    let confirmed = 0;
    let failed = 0;
    for (const item of items) {
      item.attempts += 1;
      await setStatus(item, 'sending');
      try {
        const result = await send(item);
        if (result === 'confirmed') {
          await dbDel('outbox', item.id);
          confirmed++;
        } else {
          await setStatus(item, 'failed', 'tiada-resit');
          failed++;
        }
      } catch (e) {
        await setStatus(item, 'failed', e instanceof Error ? e.message : String(e));
        failed++;
      }
    }
    return { confirmed, failed, skipped: false };
  } finally {
    processing = false;
  }
}
