/**
 * Ujian import data master — parser ketat, diff, dan apply
 * (aset hilang ditanda missing, bukan dipadam).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import * as XLSX from 'xlsx';
import { _resetDbForTests, dbGetAll } from '../src/data/db';
import {
  applyMaster,
  diffMaster,
  MasterParseError,
  parseMasterXlsx,
  type MasterAsset,
} from '../src/data/masterImport';

beforeEach(async () => {
  await _resetDbForTests();
  globalThis.indexedDB = new IDBFactory();
});

/** Bina Data.xlsx palsu dalam memori dengan struktur sebenar. */
function buildWorkbook(assets: Partial<MasterAsset>[], ppmRows: unknown[][] = []): Uint8Array {
  const wb = XLSX.utils.book_new();

  const headerRows = [
    ['SENARAI ASET'], // baris 1: tajuk
    [], // baris 2
    ['ASSET NO', 'G1', 'G2', 'NO. UNIZA', 'TYPE DESC', 'TYPE CODE', 'USER DEPT', 'DEPT NAME', 'LOC NO', 'LOC NAME', 'WORKGROUP', 'MAKE', 'BRAND', 'MODEL', 'SERIAL', 'MANUF'], // baris 3: header
  ];
  const dataRows = assets.map((a) => [
    a.asset ?? '', a.g1 ?? '', a.g2 ?? '', a.uniza ?? '', a.typedesc ?? '',
    a.typecode ?? '', a.userdept ?? '', a.deptname ?? '', a.locno ?? '', a.locname ?? '',
    a.workgroup ?? '', a.make ?? '', a.brand ?? '', a.model ?? '', a.serial ?? '', a.manuf ?? '',
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]),
    'AssetDetails',
  );

  const weekHeader: unknown[] = new Array(8).fill('');
  for (let i = 0; i < 52; i++) weekHeader[8 + i] = `W${i + 1}`;
  const ppmSheet = [weekHeader, [], ...ppmRows];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ppmSheet), 'PPM Schedule');

  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

const A1: Partial<MasterAsset> = {
  asset: 'SZA00001F', uniza: 'A45210', typedesc: 'Penghawa dingin', brand: 'Daikin',
  model: 'FTV50', locno: 'W5-A3-014', locname: 'Wad 5', deptname: 'Radiologi',
};
const A2: Partial<MasterAsset> = {
  asset: 'SZA00002F', uniza: 'A45877', typedesc: 'Katil elektrik', brand: 'Paramount',
};

describe('parseMasterXlsx', () => {
  it('membaca aset + PPM dari struktur sebenar', () => {
    const buf = buildWorkbook(
      [A1, A2],
      [['SZA00001F', 'MECH', 'Penghawa dingin', 'T01', 'AC', 'PPM', 'PPM', 'scheduled', new Date(2026, 0, 5)]],
    );
    const data = parseMasterXlsx(buf);
    expect(data.assets).toHaveLength(2);
    expect(data.assets[0]).toMatchObject({ asset: 'SZA00001F', brand: 'Daikin', locno: 'W5-A3-014' });
    expect(data.ppm).toHaveLength(1);
    expect(data.ppm[0].scheduled).toBe(1);
    expect(data.ppm[0].tasks[0].dates).toEqual([['W1', '2026-01-05']]);
  });

  it('menolak fail tanpa sheet AssetDetails dengan mesej jelas', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'SheetSalah');
    const buf = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
    expect(() => parseMasterXlsx(buf)).toThrowError(MasterParseError);
    expect(() => parseMasterXlsx(buf)).toThrowError(/AssetDetails/);
  });

  it('menolak fail yang lajurnya beralih (ASSET NO tak sah)', () => {
    const buf = buildWorkbook([
      { asset: 'nombor-pelik-1' },
      { asset: 'nombor-pelik-2' },
      { asset: 'SZA00001F' },
    ]);
    expect(() => parseMasterXlsx(buf)).toThrowError(/lajur mungkin beralih/);
  });

  it('menolak fail bukan-xlsx', () => {
    expect(() => parseMasterXlsx(new Uint8Array([1, 2, 3, 4]))).toThrowError(MasterParseError);
  });
});

describe('diffMaster — laporan perbandingan sebelum sahkan', () => {
  it('mengira tambah / buang / ubah dengan betul', () => {
    const oldAssets = parseMasterXlsx(buildWorkbook([A1, A2])).assets;
    const next = parseMasterXlsx(
      buildWorkbook([
        { ...A1, locno: 'W6-A1-001' }, // ubah lokasi
        { asset: 'SZA00003F', uniza: 'B00001' }, // baru
        // A2 dibuang
      ]),
    );
    const d = diffMaster(oldAssets, next);
    expect(d.added).toEqual(['SZA00003F']);
    expect(d.removed).toEqual(['SZA00002F']);
    expect(d.changed).toEqual(['SZA00001F']);
    expect(d.oldTotal).toBe(2);
    expect(d.newTotal).toBe(2);
  });
});

describe('applyMaster — aset hilang TIDAK dipadam', () => {
  it('menanda missing:1 pada aset yang hilang dari master baharu', async () => {
    await applyMaster(parseMasterXlsx(buildWorkbook([A1, A2])));
    // Master minggu depan: A2 dah tiada
    const result = await applyMaster(parseMasterXlsx(buildWorkbook([A1])));
    expect(result.missingKept).toBe(1);

    const rows = await dbGetAll<MasterAsset>('assets');
    expect(rows).toHaveLength(2);
    const a2 = rows.find((r) => r.asset === 'SZA00002F')!;
    expect(a2.missing).toBe(1);
    const a1 = rows.find((r) => r.asset === 'SZA00001F')!;
    expect(a1.missing).toBeUndefined();
  });

  it('aset kembali dalam master → tanda missing hilang', async () => {
    await applyMaster(parseMasterXlsx(buildWorkbook([A1, A2])));
    await applyMaster(parseMasterXlsx(buildWorkbook([A1]))); // A2 hilang
    await applyMaster(parseMasterXlsx(buildWorkbook([A1, A2]))); // A2 kembali
    const rows = await dbGetAll<MasterAsset>('assets');
    const a2 = rows.find((r) => r.asset === 'SZA00002F')!;
    expect(a2.missing).toBeUndefined();
  });
});
