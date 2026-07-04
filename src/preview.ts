/**
 * Galeri komponen — rujukan visual rasmi.
 * Buka /preview.html semasa `npm run dev`.
 */
import './ui/tokens.css';
import './ui/base.css';
import './preview.css';
import {
  appHeader,
  assetCard,
  bottomNav,
  button,
  filterChip,
  filterChipRow,
  formField,
  guidedStepCard,
  progressBar,
  progressRing,
  searchBar,
  statusBadge,
  stepTracker,
  APP_NAV,
  GUIDED_STEPS,
} from './ui/components';
import { el } from './ui/dom';
import type { AssetCardData } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
document.documentElement.dataset.theme = 'auto';

/* ---------- Data contoh (dari mockup yang dikunci) ---------- */

const SAMPLE: Record<string, AssetCardData> = {
  belum: {
    assetNo: 'SZA01234F',
    name: 'Penghawa dingin split unit',
    status: 'belum',
    location: 'Wad 5, Aras 3',
    dept: 'Jabatan Radiologi',
    spec: 'Daikin FTV50 · UNIZA A45210',
    ppmScheduled: true,
    photoCount: 0,
    photoTotal: 3,
  },
  done: {
    assetNo: 'SZA01235F',
    name: 'Katil elektrik 3 fungsi',
    status: 'done',
    location: 'Wad 5, Aras 3',
    dept: 'Jabatan Kejururawatan',
    spec: 'Paramount A6 · UNIZA A45877',
    photoCount: 3,
    photoTotal: 3,
    thumbs: ['', '', ''],
    auditedBy: 'Ali · 28 Jun',
  },
  pending: {
    assetNo: 'SZA01236F',
    name: 'Mesin sedut mukus',
    status: 'pending',
    location: 'Wad 6, Aras 3',
    dept: 'Jabatan Kejururawatan',
    spec: 'Medela Basic · UNIZA A46102',
  },
  issue: {
    assetNo: 'SZA01237F',
    name: 'Kerusi roda standard',
    status: 'issue',
    location: 'Lobi Utama, Aras 1',
    dept: 'Jabatan Kecemasan',
    spec: 'UNIZA A47001',
  },
};

/* ---------- Helper galeri ---------- */

function section(title: string, ...nodes: HTMLElement[]): void {
  const s = el(`<section class="gal-section"><h2></h2></section>`);
  s.querySelector('h2')!.textContent = title;
  nodes.forEach((n) => s.appendChild(n));
  app.querySelector('.gal')!.appendChild(s);
}

function row(...nodes: HTMLElement[]): HTMLElement {
  const r = el(`<div class="gal-row"></div>`);
  nodes.forEach((n) => r.appendChild(n));
  return r;
}

function stack(...nodes: HTMLElement[]): HTMLElement {
  const r = el(`<div class="gal-stack"></div>`);
  nodes.forEach((n) => r.appendChild(n));
  return r;
}

app.appendChild(
  el(`<div class="gal">
    <h1 class="gal-h1">Galeri Komponen — Audit Aset HoSZA</h1>
    <p class="gal-sub">Rujukan visual rasmi v3 · Nunito · indigo gradient · sumber tunggal: src/ui/tokens.css</p>
  </div>`),
);

/* ---------- Spesimen komponen ---------- */

section(
  'Butang',
  row(
    button({ label: 'Mula audit', icon: 'player-play', variant: 'primary' }),
    button({ label: 'Edit', icon: 'pencil' }),
    button({ label: 'Batal', variant: 'ghost' }),
    button({ label: 'Padam rekod', icon: 'trash', variant: 'danger' }),
    button({ icon: 'dots-vertical', iconOnly: true, ariaLabel: 'Tindakan lain' }),
    button({ label: 'Simpan', icon: 'device-floppy', variant: 'primary', disabled: true }),
  ),
);

section(
  'Badge status',
  row(statusBadge('belum'), statusBadge('done'), statusBadge('pending'), statusBadge('issue')),
);

section(
  'Chip tapisan',
  filterChipRow([
    filterChip({ label: 'Semua', active: true }),
    filterChip({ label: 'Belum diaudit', count: 2201 }),
    filterChip({ label: 'Selesai', count: 4120 }),
    filterChip({ label: 'Bermasalah', count: 14 }),
  ]),
);

section('Bar carian', searchBar({}));

const pbarWrap = el(`<div style="max-width:420px"></div>`);
pbarWrap.appendChild(progressBar(65, 'Kemajuan audit'));
section('Kemajuan', row(progressRing(65), pbarWrap));

section(
  'Kad aset — varian status',
  stack(
    assetCard({ data: SAMPLE.belum, active: true }),
    assetCard({ data: SAMPLE.done, onOpen: () => {} }),
    assetCard({ data: SAMPLE.pending, onOpen: () => {} }),
    assetCard({ data: SAMPLE.issue, onOpen: () => {} }),
  ),
);

section('Penjejak langkah', stepTracker({ steps: GUIDED_STEPS, current: 1 }));

section(
  'Medan borang',
  stack(
    formField({ label: 'No. lokasi', value: 'W5-A3-014', scan: true, original: 'W5-A3-014' }),
    formField({ label: 'Nama lokasi', value: 'Wad 5, Aras 3 — Sayap B', readonly: true }),
  ),
);

/* ---------- Komposisi skrin penuh ---------- */

function phoneHome(): HTMLElement {
  const phone = el(`<div class="phone"></div>`);
  phone.appendChild(
    appHeader({
      title: 'Audit aset HoSZA',
      subtitle: '4,120 / 6,321 diaudit · 65%',
      progressPct: 65,
      actions: [
        { icon: 'filter', ariaLabel: 'Tapis senarai', dot: true },
        { icon: 'layout-grid', ariaLabel: 'Menu' },
      ],
    }),
  );
  const main = el(`<main></main>`);
  main.appendChild(searchBar({}));
  main.appendChild(
    filterChipRow([
      filterChip({ label: 'Semua', active: true }),
      filterChip({ label: 'Belum diaudit' }),
      filterChip({ label: 'Selesai' }),
      filterChip({ label: 'Bermasalah' }),
    ]),
  );
  main.appendChild(assetCard({ data: SAMPLE.belum, active: true }));
  main.appendChild(assetCard({ data: SAMPLE.done, onOpen: () => {} }));
  main.appendChild(assetCard({ data: SAMPLE.pending, onOpen: () => {} }));
  phone.appendChild(main);
  phone.appendChild(bottomNav({ items: APP_NAV, activeId: 'senarai' }));
  return phone;
}

function phoneGuided(): HTMLElement {
  const phone = el(`<div class="phone"></div>`);
  phone.appendChild(
    el(`<div class="gtop">
      <button type="button" aria-label="Kembali">‹</button>
      <div class="gtop-titles">
        <p class="gtop-title">Audit berpandu</p>
        <p class="gtop-sub">SZA01234F · Penghawa dingin split unit</p>
      </div>
      <button type="button" aria-label="Tutup">✕</button>
    </div>`),
  );
  const steps = el(`<div class="gsteps"></div>`);
  steps.appendChild(stepTracker({ steps: GUIDED_STEPS, current: 1 }));
  phone.appendChild(steps);
  const main = el(`<main></main>`);
  main.appendChild(
    guidedStepCard({
      icon: 'map-pin',
      title: 'Semak lokasi aset',
      desc: 'Pastikan aset berada di lokasi yang direkodkan. Betulkan jika berpindah.',
      body: [
        formField({ label: 'No. lokasi', value: 'W5-A3-014', scan: true, original: 'W5-A3-014' }),
        formField({ label: 'Nama lokasi', value: 'Wad 5, Aras 3 — Sayap B', readonly: true }),
      ],
      answers: [
        { label: 'Tiada isu', icon: 'circle-check', kind: 'ok' },
        { label: 'Simpan', icon: 'device-floppy', kind: 'save', disabled: true },
      ],
      caption: 'Butang Simpan aktif bila anda mengubah nilai',
    }),
  );
  phone.appendChild(main);
  phone.appendChild(
    el(`<div class="gfoot"></div>`),
  );
  const foot = phone.querySelector('.gfoot')!;
  foot.appendChild(button({ label: 'Kembali', icon: 'chevron-left' }));
  foot.appendChild(el(`<span class="gfoot-count">2 / 6</span>`));
  foot.appendChild(button({ label: 'Seterusnya', variant: 'primary', disabled: true }));
  return phone;
}

const phones = el(`<div class="gal-phones"></div>`);
const p1 = el(`<div></div>`);
p1.appendChild(el(`<p class="phone-label">Skrin utama — Senarai</p>`));
p1.appendChild(phoneHome());
const p2 = el(`<div></div>`);
p2.appendChild(el(`<p class="phone-label">Audit berpandu — Langkah 2 (Lokasi)</p>`));
p2.appendChild(phoneGuided());
phones.append(p1, p2);
section('Komposisi skrin penuh', phones);
