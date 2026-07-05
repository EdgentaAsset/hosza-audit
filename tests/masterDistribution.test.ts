/**
 * Edaran data master berpusat: Administrator push (mastersave), peranti lain
 * semak versi setiap sync dan apply senyap kalau server lebih baru.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDbForTests, dbGetAll, metaSet } from '../src/data/db';
import type { MasterAsset, MasterData } from '../src/data/masterStore';
import { checkMaster, pushMaster, setEndpoint, setSession } from '../src/sync/engine';

const MASTER: MasterData = {
  version: '202607051200',
  assets: [
    {
      id: 'SZA00001F', asset: 'SZA00001F', uniza: 'A1', typedesc: 'Penghawa dingin',
      typecode: '', userdept: '', deptname: 'Radiologi', locno: '', locname: 'Wad 5',
      workgroup: '', make: '', brand: 'Daikin', model: '', serial: '', manuf: '', g1: '', g2: '',
    },
  ],
  ppm: [],
};

/** Fetch palsu yang faham action masterversion/master/mastersave. */
function serverFetch(serverVersion: string, calls: string[]): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const { action } = JSON.parse(String(init.body));
      calls.push(action);
      return new Response(JSON.stringify({ ok: true, version: serverVersion }));
    }
    const action = new URL(String(input)).searchParams.get('action') ?? '';
    calls.push(action);
    if (action === 'masterversion') return new Response(JSON.stringify({ ok: true, version: serverVersion }));
    if (action === 'master')
      return new Response(JSON.stringify({ ok: true, version: serverVersion, master: MASTER }));
    return new Response(JSON.stringify({ ok: false, error: 'unknown-action' }));
  }) as unknown as typeof fetch;
}

beforeEach(async () => {
  await _resetDbForTests();
  globalThis.indexedDB = new IDBFactory();
  vi.stubGlobal('localStorage', {
    store: new Map<string, string>(),
    getItem(k: string) { return this.store.get(k) ?? null; },
    setItem(k: string, v: string) { this.store.set(k, v); },
    removeItem(k: string) { this.store.delete(k); },
  });
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('window', { dispatchEvent: () => true });
  setEndpoint('https://script.google.com/macros/s/X/exec');
  setSession({ token: 't1', name: 'Ali', role: 'admin', username: 'ali' });
});

describe('checkMaster', () => {
  it('versi server lebih baru → muat turun & apply senyap', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', serverFetch(MASTER.version, calls));
    expect(await checkMaster()).toBe(true);
    expect(calls).toEqual(['masterversion', 'master']);
    const assets = await dbGetAll<MasterAsset>('assets');
    expect(assets).toHaveLength(1);
    expect(assets[0].asset).toBe('SZA00001F');
  });

  it('versi sama → TIADA muat turun (jimat data)', async () => {
    await metaSet('masterVersion', MASTER.version);
    const calls: string[] = [];
    vi.stubGlobal('fetch', serverFetch(MASTER.version, calls));
    expect(await checkMaster()).toBe(false);
    expect(calls).toEqual(['masterversion']);
  });

  it('server belum ada master (versi kosong) → false, tiada ralat', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', serverFetch('', calls));
    expect(await checkMaster()).toBe(false);
  });

  it('tiada sesi → skip terus', async () => {
    vi.stubGlobal('localStorage', {
      store: new Map(), getItem() { return null; }, setItem() {}, removeItem() {},
    });
    const f = vi.fn();
    vi.stubGlobal('fetch', f as unknown as typeof fetch);
    expect(await checkMaster()).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('talian putus (fetch melempar) → false, cuba lagi sync depan', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch);
    expect(await checkMaster()).toBe(false);
  });
});

describe('pushMaster', () => {
  it('hantar action mastersave dengan versi', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', serverFetch('', calls));
    await pushMaster(MASTER);
    expect(calls).toEqual(['mastersave']);
  });

  it('server tolak (bukan administrator) → melempar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: 'auth' })),
    ) as unknown as typeof fetch);
    await expect(pushMaster(MASTER)).rejects.toThrow('auth');
  });
});
