// Jana src/ui/icons.ts daripada @tabler/icons (outline).
// Guna: npm run gen:icons  (jalankan semula bila tambah nama dalam NAMES)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '../node_modules/@tabler/icons/icons/outline');
const OUT = resolve(HERE, '../src/ui/icons.ts');

// Senarai ikon yang dipakai app. Nama = nama fail Tabler (tanpa .svg).
const NAMES = [
  'alert-circle',
  'building-hospital',
  'calendar',
  'calendar-check',
  'camera',
  'category',
  'chart-pie',
  'check',
  'chevron-left',
  'chevron-right',
  'circle-check',
  'circle-dashed',
  'clipboard-list',
  'clock',
  'cloud-upload',
  'device-floppy',
  'dots-vertical',
  'file-text',
  'filter',
  'history',
  'home',
  'id',
  'info-circle',
  'layout-grid',
  'lock',
  'logout',
  'map-pin',
  'notes',
  'pencil',
  'photo',
  'player-play',
  'plus',
  'qrcode',
  'refresh',
  'scan',
  'search',
  'settings',
  'tag',
  'trash',
  'upload',
  'user',
  'user-circle',
  'wifi',
  'wifi-off',
  'x',
];

const entries = [];
for (const name of NAMES) {
  const raw = readFileSync(resolve(SRC, `${name}.svg`), 'utf8');
  // Buang atribut saiz tetap; saiz dikawal oleh helper icon()
  const svg = raw
    .replace(/\s*width="24"/, '')
    .replace(/\s*height="24"/, '')
    .replace(/\s*class="[^"]*"/, '')
    .replace(/\n\s*/g, ' ')
    .trim();
  entries.push(`  '${name}': ${JSON.stringify(svg)},`);
}

const out = `// FAIL DIJANA — jangan edit tangan. Sumber: @tabler/icons (MIT).
// Jana semula: npm run gen:icons (senarai dalam scripts/gen-icons.mjs)
export type IconName =
${NAMES.map((n) => `  | '${n}'`).join('\n')};

const SVG: Record<IconName, string> = {
${entries.join('\n')}
};

/** Pulangkan markup SVG ikon dengan saiz diberi (px). Warna ikut currentColor. */
export function icon(name: IconName, size = 18): string {
  return SVG[name].replace('<svg ', \`<svg width="\${size}" height="\${size}" aria-hidden="true" \`);
}
`;

writeFileSync(OUT, out, 'utf8');
console.log(`icons.ts dijana: ${NAMES.length} ikon -> ${OUT}`);
