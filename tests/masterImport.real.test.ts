/**
 * Verifikasi parser dengan Data.xlsx SEBENAR (kalau ada pada mesin ini).
 * Fail sebenar TIDAK dikomit (repo public) — ujian ini skip di mesin lain.
 * Laluan boleh di-override dengan env HOSZA_DATA_XLSX.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { parseMasterXlsx } from '../src/data/masterImport';

const DEFAULT_PATH =
  'C:\\Users\\user\\OneDrive - UEM Edgenta Berhad\\Documents\\Edgenta\\Hospital Sultan Zainal Abidin (HoSZA)\\9. Apps\\App v2\\Data.xlsx';
const PATH = process.env.HOSZA_DATA_XLSX ?? DEFAULT_PATH;
const available = existsSync(PATH);

describe.skipIf(!available)('Data.xlsx sebenar', () => {
  it('parse penuh — kiraan sepadan dengan build_data.py (6,321 aset)', () => {
    const data = parseMasterXlsx(new Uint8Array(readFileSync(PATH)));
    // PANDUAN.md app lama: "Mengandungi 6,321 aset + PPM"
    expect(data.assets.length).toBe(6321);
    expect(data.ppm.length).toBeGreaterThan(0);
    // Setiap aset ada nombor; format majoriti SZA#####F
    const valid = data.assets.filter((a) => /^SZA\d{5}F$/i.test(a.asset)).length;
    expect(valid / data.assets.length).toBeGreaterThan(0.95);
  });
});
