/**
 * Storan & edaran data master — TANPA pustaka xlsx.
 *
 * Dipecah dari masterImport.ts supaya peranti PENERIMA (yang hanya terima
 * JSON master dari server) tak perlu muat pustaka Excel 335kB. Parser xlsx
 * kekal dalam masterImport.ts (Administrator sahaja).
 */
import { dbBulkPut, dbClear, dbGetAll, metaSet } from './db';

export interface MasterAsset {
  /**
   * Kunci unik baris. Baris pertama sesuatu ASSET NO: id = asset;
   * baris BERGANDA seterusnya: `asset~2`, `asset~3`, ... — duplicate dalam
   * Data.xlsx DIKEKALKAN seadanya (keputusan user: papar data sebagaimana fail).
   */
  id: string;
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
  /** 1 = nombor aset ini muncul lebih dari sekali dalam fail */
  dup?: 1;
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

/** Banding master sedia ada (dalam peranti) dengan data baharu — ikut id baris. */
export function diffMaster(oldAssets: MasterAsset[], next: MasterData): MasterDiff {
  const oldMap = new Map(oldAssets.filter((a) => !a.missing).map((a) => [a.id, a]));
  const added: string[] = [];
  const changed: string[] = [];
  let unchanged = 0;
  for (const a of next.assets) {
    const old = oldMap.get(a.id);
    if (!old) {
      added.push(a.id);
      continue;
    }
    oldMap.delete(a.id);
    if (COMPARE_KEYS.some((k) => (old[k] ?? '') !== (a[k] ?? ''))) changed.push(a.id);
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
  /** Bilangan baris yang nombor asetnya berganda dalam fail */
  duplicates: number;
}

/**
 * Tulis master baharu ke IndexedDB. Aset yang hilang dari master TIDAK
 * dipadam — ditanda missing:1 supaya audit sedia ada tak tergantung.
 */
export async function applyMaster(next: MasterData): Promise<ApplyResult> {
  const current = await dbGetAll<MasterAsset>('assets');
  const nextKeys = new Set(next.assets.map((a) => a.id));
  const keepMissing = current
    .filter((a) => !nextKeys.has(a.id))
    .map((a) => ({ ...a, missing: 1 as const }));
  const duplicates = next.assets.filter((a) => a.dup).length;

  await dbClear('assets');
  await dbBulkPut('assets', [...next.assets, ...keepMissing]);
  await dbClear('ppm');
  await dbBulkPut('ppm', next.ppm);
  await metaSet('masterVersion', next.version);
  await metaSet('masterCounts', {
    assets: next.assets.length,
    ppm: next.ppm.length,
    missingKept: keepMissing.length,
    duplicates,
    appliedAt: Date.now(),
  });
  return {
    version: next.version,
    total: next.assets.length,
    missingKept: keepMissing.length,
    duplicates,
  };
}
