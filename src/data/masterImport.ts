/**
 * Import data master daripada Data.xlsx — ganti build_data.py.
 *
 * Struktur fail TETAP (disahkan user): sheet "AssetDetails" (3 baris header,
 * data dari baris 4) + sheet "PPM Schedule" (baris 1 = label minggu lajur
 * 9-60, data dari baris 3). Parser KETAT: fail yang tak ikut struktur
 * ditolak dengan mesej jelas — jangan sesekali terima data rosak senyap.
 *
 * Susunan lajur AssetDetails (0-based, sama dengan build_data.py):
 *  0 ASSET NO · 1 Gambar1 · 2 Gambar2 · 3 NO. UNIZA · 4 TYPE DESC ·
 *  5 TYPE CODE · 6 USER DEPT · 7 DEPT NAME · 8 LOC NO · 9 LOC NAME ·
 * 10 WORKGROUP · 11 MAKE · 12 BRAND · 13 MODEL · 14 SERIAL · 15 MANUFACTURER
 */
import * as XLSX from 'xlsx';
import { dbBulkPut, dbClear, dbGetAll, metaSet } from './db';

export interface MasterAsset {
  asset: string;
  uniza: string;
  typedesc: string;
  typecode: string;
  userdept: string;
  deptname: string;
  locno: string;
  locname: string;
  workgroup: string;
  make: string;
  brand: string;
  model: string;
  serial: string;
  manuf: string;
  g1: string;
  g2: string;
  /** 1 = tiada dalam master terkini (dikekalkan untuk siasatan, bukan dipadam) */
  missing?: 1;
}

export interface PpmTask {
  discipline: string;
  desc: string;
  taskCode: string;
  typeCode: string;
  category: string;
  ppmType: string;
  ppm: string;
  /** [labelMinggu, tarikh YYYY-MM-DD] */
  dates: [string, string][];
}

export interface PpmRecord {
  asset: string;
  scheduled: 0 | 1;
  tasks: PpmTask[];
}

export interface MasterData {
  version: string;
  assets: MasterAsset[];
  ppm: PpmRecord[];
}

export class MasterParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MasterParseError';
  }
}

function clean(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function fmtDate(v: unknown): string {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return clean(v);
}

const ASSET_RE = /^SZA\d{5}F$/i;

/** Parse buffer Data.xlsx. Melempar MasterParseError kalau struktur tak sepadan. */
export function parseMasterXlsx(buf: ArrayBuffer | Uint8Array): MasterData {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: buf instanceof Uint8Array ? 'buffer' : 'array', cellDates: true });
  } catch {
    throw new MasterParseError('Fail tidak dapat dibaca — pastikan ia fail .xlsx yang sah.');
  }

  /* ---- AssetDetails ---- */
  const wsA = wb.Sheets['AssetDetails'];
  if (!wsA) {
    throw new MasterParseError(
      `Sheet "AssetDetails" tidak dijumpai. Sheet dalam fail: ${wb.SheetNames.join(', ')}. Pastikan fail Data.xlsx yang betul.`,
    );
  }
  const rowsA = XLSX.utils.sheet_to_json<unknown[]>(wsA, { header: 1, defval: null });
  const assets: MasterAsset[] = [];
  for (let r = 3; r < rowsA.length; r++) {
    const row = rowsA[r];
    if (!row) continue;
    const asset = clean(row[0]);
    if (!asset) continue;
    assets.push({
      asset,
      g1: clean(row[1]),
      g2: clean(row[2]),
      uniza: clean(row[3]),
      typedesc: clean(row[4]),
      typecode: clean(row[5]),
      userdept: clean(row[6]),
      deptname: clean(row[7]),
      locno: clean(row[8]),
      locname: clean(row[9]),
      workgroup: clean(row[10]),
      make: clean(row[11]),
      brand: clean(row[12]),
      model: clean(row[13]),
      serial: clean(row[14]),
      manuf: clean(row[15]),
    });
  }
  if (assets.length === 0) {
    throw new MasterParseError('Tiada aset dijumpai dalam "AssetDetails" — semak susunan fail.');
  }
  const validNo = assets.filter((a) => ASSET_RE.test(a.asset)).length;
  if (validNo < assets.length * 0.5) {
    throw new MasterParseError(
      `Hanya ${validNo}/${assets.length} baris ada format ASSET NO yang sah (SZA#####F) — lajur mungkin beralih. Fail ditolak.`,
    );
  }

  /* ---- PPM Schedule ---- */
  const wsP = wb.Sheets['PPM Schedule'];
  if (!wsP) {
    throw new MasterParseError(
      `Sheet "PPM Schedule" tidak dijumpai. Sheet dalam fail: ${wb.SheetNames.join(', ')}.`,
    );
  }
  const rowsP = XLSX.utils.sheet_to_json<unknown[]>(wsP, { header: 1, defval: null });
  if (rowsP.length < 1) throw new MasterParseError('Sheet "PPM Schedule" kosong.');
  const weekLabels: string[] = [];
  for (let c = 8; c < 60; c++) weekLabels.push(clean(rowsP[0]?.[c]));

  const ppmMap = new Map<string, PpmRecord>();
  for (let r = 2; r < rowsP.length; r++) {
    const row = rowsP[r];
    if (!row) continue;
    const asset = clean(row[0]);
    if (!asset) continue;
    const dates: [string, string][] = [];
    for (let c = 8; c < 60; c++) {
      const cell = row[c];
      if (cell != null && cell !== '') dates.push([weekLabels[c - 8], fmtDate(cell)]);
    }
    const isSched = clean(row[7]).toLowerCase() === 'scheduled';
    const task: PpmTask = {
      discipline: clean(row[1]),
      desc: clean(row[2]),
      taskCode: clean(row[3]),
      typeCode: clean(row[4]),
      category: clean(row[5]),
      ppmType: clean(row[6]),
      ppm: clean(row[7]),
      dates,
    };
    let rec = ppmMap.get(asset);
    if (!rec) {
      rec = { asset, scheduled: 0, tasks: [] };
      ppmMap.set(asset, rec);
    }
    rec.tasks.push(task);
    if (isSched) rec.scheduled = 1;
  }

  const now = new Date();
  const version = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  return { version, assets, ppm: Array.from(ppmMap.values()) };
}

/* ---------- Laporan perbandingan (sebelum sahkan) ---------- */

export interface MasterDiff {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
  oldTotal: number;
  newTotal: number;
}

const COMPARE_KEYS: (keyof MasterAsset)[] = [
  'uniza', 'typedesc', 'typecode', 'userdept', 'deptname', 'locno', 'locname',
  'workgroup', 'make', 'brand', 'model', 'serial', 'manuf', 'g1', 'g2',
];

/** Banding master sedia ada (dalam peranti) dengan data baharu. */
export function diffMaster(oldAssets: MasterAsset[], next: MasterData): MasterDiff {
  const oldMap = new Map(oldAssets.filter((a) => !a.missing).map((a) => [a.asset, a]));
  const added: string[] = [];
  const changed: string[] = [];
  let unchanged = 0;
  for (const a of next.assets) {
    const old = oldMap.get(a.asset);
    if (!old) {
      added.push(a.asset);
      continue;
    }
    oldMap.delete(a.asset);
    if (COMPARE_KEYS.some((k) => (old[k] ?? '') !== (a[k] ?? ''))) changed.push(a.asset);
    else unchanged++;
  }
  return {
    added,
    removed: Array.from(oldMap.keys()),
    changed,
    unchanged,
    oldTotal: oldAssets.filter((a) => !a.missing).length,
    newTotal: next.assets.length,
  };
}

/* ---------- Guna pakai (selepas user sahkan laporan) ---------- */

export interface ApplyResult {
  version: string;
  total: number;
  missingKept: number;
}

/**
 * Tulis master baharu ke IndexedDB. Aset yang hilang dari master TIDAK
 * dipadam — ditanda missing:1 supaya audit sedia ada tak tergantung.
 */
export async function applyMaster(next: MasterData): Promise<ApplyResult> {
  const current = await dbGetAll<MasterAsset>('assets');
  const nextKeys = new Set(next.assets.map((a) => a.asset));
  const keepMissing = current
    .filter((a) => !nextKeys.has(a.asset))
    .map((a) => ({ ...a, missing: 1 as const }));

  await dbClear('assets');
  await dbBulkPut('assets', [...next.assets, ...keepMissing]);
  await dbClear('ppm');
  await dbBulkPut('ppm', next.ppm);
  await metaSet('masterVersion', next.version);
  await metaSet('masterCounts', {
    assets: next.assets.length,
    ppm: next.ppm.length,
    missingKept: keepMissing.length,
    appliedAt: Date.now(),
  });
  return { version: next.version, total: next.assets.length, missingKept: keepMissing.length };
}
