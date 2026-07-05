/**
 * Enjin sync — sambung outbox ke backend Apps Script.
 * Resit = respons JSON {ok:true} dari fetch. (App lama perlukan
 * "sahkan-baca-balik" kerana JSONP tak boleh baca respons POST;
 * dengan fetch kita BACA respons terus — satu lapisan dibuang.)
 */
import { processOutbox, type ProcessSummary } from './outbox';
import { createApi } from './api';
import { setPhotoUrl } from '../data/photos';

const EP_KEY = 'endpoint';
const SESSION_KEY = 'session';

export interface Session {
  token: string;
  name: string;
  role: string;
  username: string;
}

export const getEndpoint = (): string => localStorage.getItem(EP_KEY) ?? '';
export const setEndpoint = (v: string): void => localStorage.setItem(EP_KEY, v.trim());

export function getSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}
export const setSession = (s: Session): void => localStorage.setItem(SESSION_KEY, JSON.stringify(s));
export const clearSession = (): void => localStorage.removeItem(SESSION_KEY);

function api() {
  return createApi({ endpoint: getEndpoint(), getToken: () => getSession()?.token ?? '' });
}

/** Log masuk → simpan sesi. Melempar Error dengan mesej BM kalau gagal. */
export async function login(username: string, password: string): Promise<Session> {
  const r = await api().post<never>('login', { username, password });
  if (!r.ok) {
    const msg =
      { 'no-user': 'Username tidak wujud', salah: 'Password salah', disabled: 'Akaun dinyahaktifkan' }[
        String(r.error)
      ] ?? `Log masuk gagal: ${String(r.error)}`;
    throw new Error(msg);
  }
  const s: Session = {
    token: String(r.token),
    name: String(r.name),
    role: String(r.role),
    username: String(r.username),
  };
  setSession(s);
  return s;
}

/** Satu pusingan sync. Selamat dipanggil bila-bila (skip kalau tiada endpoint/sesi/talian). */
export async function syncNow(): Promise<ProcessSummary> {
  if (!navigator.onLine || !getEndpoint() || !getSession()?.token) {
    return { confirmed: 0, failed: 0, skipped: true };
  }
  const a = api();
  const sum = await processOutbox(async (item) => {
    const r = await a.post(item.kind, item.payload as Record<string, unknown>);
    if (!r.ok) return 'retry';
    if (item.kind === 'photo' && typeof r.url === 'string' && r.url) {
      await setPhotoUrl(item.asset, String((item.payload as { kind: string }).kind), r.url);
    }
    return 'confirmed';
  });
  if (sum.confirmed > 0) window.dispatchEvent(new CustomEvent('hosza:sync'));
  return sum;
}

/** Mula enjin: pusingan setiap 30s + serta-merta bila talian kembali. */
export function startSyncEngine(): void {
  setInterval(() => void syncNow(), 30_000);
  window.addEventListener('online', () => void syncNow());
  void syncNow();
}
