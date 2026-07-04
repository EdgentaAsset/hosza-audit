/**
 * Klien API ke backend Google Apps Script.
 *
 * Ganti JSONP app lama dengan fetch:
 *  - POST: Content-Type text/plain (JSON dalam body) — elak preflight CORS,
 *    teknik sama seperti app lama yang terbukti berjalan dengan Apps Script.
 *  - GET: fetch biasa + JSON.parse — Apps Script benarkan GET cross-origin;
 *    tiada lagi <script> suntikan JSONP (risiko keselamatan).
 */

export interface ApiOk<T = unknown> {
  ok: true;
  [k: string]: unknown;
  data?: T;
}

export interface ApiErr {
  ok: false;
  error: string;
}

export type ApiResponse<T = unknown> = (ApiOk<T> | ApiErr) & Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    message: string,
    /** 'network' = tak sampai server · 'server' = server jawab ralat · 'parse' = jawapan bukan JSON */
    public readonly kind: 'network' | 'server' | 'parse',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOpts {
  endpoint: string;
  /** Token sesi — disuntik ke setiap payload POST & query GET */
  getToken?: () => string;
  /** Untuk ujian — ganti fetch global */
  fetchFn?: typeof fetch;
}

export function createApi(opts: ApiClientOpts) {
  const f = opts.fetchFn ?? fetch;
  const endpoint = opts.endpoint.replace(/\/+$/, '');

  async function parse<T>(res: Response): Promise<ApiResponse<T>> {
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'server');
    const text = await res.text();
    try {
      return JSON.parse(text) as ApiResponse<T>;
    } catch {
      throw new ApiError('Jawapan server bukan JSON', 'parse');
    }
  }

  return {
    /** POST action ke Apps Script. Payload dibungkus {action, payload{token}}. */
    async post<T = unknown>(action: string, payload: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
      const body = JSON.stringify({
        action,
        payload: { ...payload, token: opts.getToken?.() ?? '' },
      });
      let res: Response;
      try {
        res = await f(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // elak preflight
          body,
        });
      } catch (e) {
        throw new ApiError(e instanceof Error ? e.message : 'Gagal sambung', 'network');
      }
      return parse<T>(res);
    },

    /** GET dengan query params (ganti JSONP doGet). */
    async get<T = unknown>(params: Record<string, string>): Promise<ApiResponse<T>> {
      const q = new URLSearchParams({ ...params, token: opts.getToken?.() ?? '' });
      let res: Response;
      try {
        res = await f(`${endpoint}?${q.toString()}`, { method: 'GET' });
      } catch (e) {
        throw new ApiError(e instanceof Error ? e.message : 'Gagal sambung', 'network');
      }
      return parse<T>(res);
    },
  };
}

export type ApiClient = ReturnType<typeof createApi>;
