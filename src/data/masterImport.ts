/**
 * Import data master daripada Data.xlsx — ganti build_data.py.
 *
 * Struktur fail TETAP (disahkan user): sheet "AssetDetails" (3 baris header,
 * data dari baris 4) + sheet "PPM Schedule" (baris 1 = label minggu lajur
 * 9-60, data dari baris 3). Parser KETAT: fail yang tak ikut struktur
 * ditolak dengan mesej jelas — jangan sesekali terima data rosak senyap.
 *
 * Fail ini memuatkan pustaka xlsx (335kB) — HANYA untuk Administrator yang
 * import fail. Jenis data + diff + apply berada di masterStore.ts (ringan)
 * dan di-re-export di sini untuk keserasian.
 *
 * Susunan lajur AssetDetails (0-based, sama dengan build_data.py):
 *  0 ASSET NO · 1 Gambar1 · 2 Gambar2 · 3 NO. UNIZA · 4 TYPE DESC ·
 *  5 TYPE CODE · 6 USER DEPT · 7 DEPT NAME · 8 LOC NO · 9 LOC NAME ·
 * 10 WORKGROUP · 11 MAKE · 12 BRAND · 13 MODEL · 14 SERIAL · 15 MANUFACTURER
 */
import * as XLSX from 'xlsx';
import type { MasterAsset, MasterData, PpmRecord, PpmTask } from './masterStore';

export * from './masterStore';

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
  const seen = new Map<string, number>(); // ASSET NO -> kali dilihat
  for (let r = 3; r < rowsA.length; r++) {
    const row = rowsA[r];
    if (!row) continue;
    const asset = clean(row[0]);
    if (!asset) continue;
    const n = (seen.get(asset) ?? 0) + 1;
    seen.set(asset, n);
    assets.push({
      id: n === 1 ? asset : `${asset}~${n}`,
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
  // Tanda baris yang nombornya berganda (papar seadanya, tapi boleh dilaporkan)
  for (const a of assets) {
    if ((seen.get(a.asset) ?? 0) > 1) a.dup = 1;
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
