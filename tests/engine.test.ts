/** Enjin sync: resit = respons {ok:true}; gagal/ralat = item kekal untuk retry. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { _resetDbForTests } from '../src/data/db';
import { enqueue, outboxCount, pendingItems } from '../src/sync/outbox';
import { syncNow, setEndpoint, setSession } from '../src/sync/engine';

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status: ok ? 200 : 500 }),
  ) as unknown as typeof fetch;
}

beforeEach(async () => {
  await _resetDbForTests();
  globalThis.indexedDB = new IDBFactory();
  // Persekitaran browser minimum untuk engine
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

describe('syncNow', () => {
  it('respons ok:true = resit → item keluar dari peti', async () => {
    vi.stubGlobal('fetch', fakeFetch({ ok: true, asset: 'SZA00001F' }));
    await enqueue('upsert', 'SZA00001F', { checked: true });
    const sum = await syncNow();
    expect(sum.confirmed).toBe(1);
    expect(await outboxCount()).toBe(0);
  });

  it('server jawab ok:false → item kekal failed (retry kemudian)', async () => {
    vi.stubGlobal('fetch', fakeFetch({ ok: false, error: 'auth' }));
    await enqueue('upsert', 'SZA00002F', {});
    const sum = await syncNow();
    expect(sum.failed).toBe(1);
    expect((await pendingItems())[0].status).toBe('failed');
  });

  it('talian putus (fetch melempar) → item kekal, tiada kehilangan', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch);
    await enqueue('upsert', 'SZA00003F', {});
    const sum = await syncNow();
    expect(sum.failed).toBe(1);
    expect(await outboxCount()).toBe(1);
  });

  it('tiada sesi → skip terus (tiada percubaan hantar)', async () => {
    vi.stubGlobal('localStorage', {
      store: new Map(), getItem() { return null; }, setItem() {}, removeItem() {},
    });
    const sum = await syncNow();
    expect(sum.skipped).toBe(true);
  });
});
