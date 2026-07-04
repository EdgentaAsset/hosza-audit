/**
 * Skrin Senarai — skrin utama app.
 *
 * PRINSIP (isu lapangan #1): data dimuat dari IndexedDB SELEPAS UI dilukis,
 * carian hanya melukis semula bahagian senarai (bukan seluruh skrin), dan
 * senarai dilukis berkelompok (48 kad + "lihat lagi" automatik) supaya
 * butang & input sentiasa responsif walau 6,000+ aset.
 */
import {
  appHeader,
  assetCard,
  bottomNav,
  button,
  filterChip,
  filterChipRow,
  searchBar,
  APP_NAV,
} from '../components';
import { el, esc } from '../dom';
import { icon } from '../icons';
import { dbCount, dbGetAll } from '../../data/db';
import type { MasterAsset, PpmRecord } from '../../data/masterImport';
import { listAudits, tickAudit, untickAudit, type AuditRecord } from '../../data/audits';
import { pendingItems } from '../../sync/outbox';
import { openEditSheet } from './editSheet';
import { openGuided } from './guided';
import { getPosition } from '../../data/drafts';
import { toast } from '../toast';
import type { AssetCardData, AuditStatus } from '../../types';
import './senarai.css';

const BATCH = 48;

type Filter = 'semua' | AuditStatus;

interface State {
  assets: MasterAsset[];
  ppmScheduled: Set<string>;
  audits: Map<string, AuditRecord>;
  /** ASSET NO yang masih ada hantaran menunggu dalam outbox */
  pendingAssets: Set<string>;
  query: string;
  filter: Filter;
  limit: number;
  active: string | null;
}

const state: State = {
  assets: [],
  ppmScheduled: new Set(),
  audits: new Map(),
  pendingAssets: new Set(),
  query: '',
  filter: 'semua',
  limit: BATCH,
  active: null,
};

/** Status paparan: selesai (disahkan) / menunggu sync / belum diaudit. */
function statusOf(a: MasterAsset): AuditStatus {
  const rec = state.audits.get(a.asset);
  if (rec?.checked) return state.pendingAssets.has(a.asset) ? 'pending' : 'done';
  return 'belum';
}

function auditedLabel(a: MasterAsset): string | undefined {
  const rec = state.audits.get(a.asset);
  if (!rec?.checked || !rec.checkedAt) return undefined;
  const d = new Date(rec.checkedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' });
  return rec.by ? `${rec.by} · ${d}` : d;
}

function cardData(a: MasterAsset): AssetCardData {
  const spec = [
    [a.brand, a.model].filter(Boolean).join(' '),
    a.uniza ? `UNIZA ${a.uniza}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    assetNo: a.asset,
    name: a.typedesc || '(tiada keterangan)',
    status: statusOf(a),
    location: a.locname || a.locno || '—',
    dept: a.deptname || '',
    spec,
    ppmScheduled: state.ppmScheduled.has(a.asset),
    photoCount: 0,
    photoTotal: 3,
    auditedBy: auditedLabel(a),
  };
}

function matches(a: MasterAsset, qUp: string): boolean {
  return (
    a.asset.toUpperCase().includes(qUp) ||
    a.uniza.toUpperCase().includes(qUp) ||
    a.typedesc.toUpperCase().includes(qUp) ||
    a.locname.toUpperCase().includes(qUp) ||
    a.brand.toUpperCase().includes(qUp) ||
    a.model.toUpperCase().includes(qUp)
  );
}

function filtered(): MasterAsset[] {
  const qUp = state.query.trim().toUpperCase();
  let rows = state.assets;
  if (qUp) rows = rows.filter((a) => matches(a, qUp));
  if (state.filter !== 'semua') rows = rows.filter((a) => statusOf(a) === state.filter);
  return rows;
}

/* ---------- Import Data.xlsx (empty state / butang header) ---------- */

async function importFromBuffer(buf: ArrayBuffer, rerender: () => void): Promise<void> {
  // Pustaka Excel berat (~340kB) — dimuat HANYA bila import diperlukan,
  // bukan pada boot (isu lapangan #1: app mesti buka laju).
  const { applyMaster, diffMaster, MasterParseError, parseMasterXlsx } = await import(
    '../../data/masterImport'
  );
  let parsed;
  try {
    parsed = parseMasterXlsx(buf);
  } catch (e) {
    toast(e instanceof MasterParseError ? e.message : 'Fail tidak dapat dibaca', 'err');
    return;
  }
  const existing = await dbGetAll<MasterAsset>('assets');
  if (existing.length > 0) {
    const d = diffMaster(existing, parsed);
    const msg =
      `Semakan data master:\n\n` +
      `Sekarang: ${d.oldTotal} aset → Baharu: ${d.newTotal} aset\n` +
      `+${d.added.length} baru · −${d.removed.length} dibuang · ${d.changed.length} berubah\n\n` +
      `Teruskan?`;
    if (!window.confirm(msg)) {
      toast('Import dibatalkan', '');
      return;
    }
  }
  const res = await applyMaster(parsed);
  const dupNote = res.duplicates ? ` (${res.duplicates} baris nombor berganda dikekalkan)` : '';
  toast(`✓ Data master v${res.version} — ${res.total.toLocaleString()} aset${dupNote}`, 'ok');
  await loadData();
  rerender();
}

function pickXlsx(rerender: () => void): void {
  const input = el<HTMLInputElement>(
    `<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hide" />`,
  );
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    toast('Memproses fail…', '');
    await importFromBuffer(await file.arrayBuffer(), rerender);
    input.remove();
  });
  document.body.appendChild(input);
  input.click();
}

/* ---------- Muat data dari IndexedDB ---------- */

async function loadData(): Promise<void> {
  const [assets, ppm, audits, pending] = await Promise.all([
    dbGetAll<MasterAsset>('assets'),
    dbGetAll<PpmRecord>('ppm'),
    listAudits(),
    pendingItems(),
  ]);
  state.assets = assets
    .filter((a) => !a.missing)
    .sort((x, y) => (x.id < y.id ? -1 : 1)); // baris berganda kekal bersebelahan
  state.ppmScheduled = new Set(ppm.filter((p) => p.scheduled === 1).map((p) => p.asset));
  state.audits = new Map(audits.map((r) => [r.asset, r]));
  state.pendingAssets = new Set(pending.map((i) => i.asset));
}

/* ---------- Skrin ---------- */

export async function mountSenarai(root: HTMLElement): Promise<void> {
  root.innerHTML = '';
  const scr = el(`<div class="scr"></div>`);
  root.appendChild(scr);

  const rerenderAll = () => renderShell();

  async function refresh(): Promise<void> {
    await loadData();
    renderShell();
  }

  /** Tick pantas melalui butang ⋮ — audit berpandu penuh datang kemudian. */
  async function quickTick(a: MasterAsset): Promise<void> {
    const rec = state.audits.get(a.asset);
    if (rec?.checked) {
      if (!window.confirm(`Batalkan tanda "Telah Diperiksa" untuk ${a.asset}?`)) return;
      await untickAudit(a.asset, a.uniza);
      toast('Tanda diperiksa dibatalkan', '');
    } else {
      if (!window.confirm(`Tanda ${a.asset} sebagai "Telah Diperiksa"?`)) return;
      await tickAudit(a.asset, { uniza: a.uniza });
      toast('✓ Ditanda diperiksa — akan dihantar ke pusat', 'ok');
    }
    await refresh();
  }

  function renderShell(): void {
    scr.innerHTML = '';
    const total = state.assets.length;
    const checkedNos = new Set(
      Array.from(state.audits.values())
        .filter((r) => r.checked)
        .map((r) => r.asset),
    );
    const checkedRows = state.assets.filter((a) => checkedNos.has(a.asset)).length;

    scr.appendChild(
      appHeader({
        title: 'Audit aset HoSZA',
        subtitle: total
          ? `${checkedRows.toLocaleString()} / ${total.toLocaleString()} diaudit · ${total ? Math.round((checkedRows / total) * 100) : 0}%`
          : 'Tiada data master — import Data.xlsx',
        progressPct: total ? (checkedRows / total) * 100 : 0,
        actions: [
          { icon: 'upload', ariaLabel: 'Import Data.xlsx', onClick: () => pickXlsx(rerenderAll) },
          { icon: 'settings', ariaLabel: 'Tetapan', onClick: () => toast('Tetapan — milestone seterusnya') },
        ],
      }),
    );

    const main = el(`<main class="scr-main"></main>`);
    scr.appendChild(main);

    if (total === 0) {
      const empty = el(`
        <div class="scr-empty">
          <span class="scr-empty-ic">${icon('cloud-upload', 34)}</span>
          <p class="scr-empty-t">Belum ada data aset</p>
          <p class="scr-empty-s">Import fail Data.xlsx untuk mula — 6,000+ aset akan disimpan terus dalam peranti ini dan boleh diguna offline.</p>
        </div>
      `);
      empty.appendChild(
        button({
          label: 'Pilih Data.xlsx',
          icon: 'upload',
          variant: 'primary',
          onClick: () => pickXlsx(rerenderAll),
        }),
      );
      main.appendChild(empty);
    } else {
      main.appendChild(
        searchBar({
          onInput: (v) => {
            state.query = v;
            state.limit = BATCH;
            renderList();
          },
          onScan: () => toast('Imbas kod — milestone seterusnya'),
        }),
      );
      main.appendChild(
        filterChipRow(
          (
            [
              ['semua', 'Semua'],
              ['belum', 'Belum diaudit'],
              ['done', 'Selesai'],
              ['issue', 'Bermasalah'],
            ] as [Filter, string][]
          ).map(([id, label]) =>
            filterChip({
              label,
              active: state.filter === id,
              onClick: () => {
                state.filter = id;
                state.limit = BATCH;
                renderShell();
              },
            }),
          ),
        ),
      );
      const listWrap = el(`<div class="scr-list"></div>`);
      main.appendChild(listWrap);
      renderList();

      function renderList(): void {
        const rows = filtered();
        const shown = rows.slice(0, state.limit);
        listWrap.innerHTML = '';
        if (rows.length === 0) {
          listWrap.appendChild(
            el(`<p class="scr-none">Tiada aset sepadan dengan "${esc(state.query)}"</p>`),
          );
          return;
        }
        listWrap.appendChild(
          el(`<p class="scr-count">${rows.length.toLocaleString()} aset</p>`),
        );
        const frag = document.createDocumentFragment();
        for (const a of shown) {
          const isActive = state.active === a.id;
          frag.appendChild(
            assetCard({
              data: cardData(a),
              active: isActive,
              onOpen: () => {
                state.active = a.id;
                renderList();
              },
              onStart: () => void openGuided(a, refresh),
              onEdit: () => void openEditSheet(a, refresh),
              onMore: () => void quickTick(a),
              onAddPhoto: () => toast('Gambar — milestone seterusnya'),
            }),
          );
        }
        listWrap.appendChild(frag);
        if (rows.length > state.limit) {
          const sentinel = el(`<div class="scr-sentinel">${icon('dots-vertical', 18)}</div>`);
          listWrap.appendChild(sentinel);
          new IntersectionObserver((entries, obs) => {
            if (entries.some((e) => e.isIntersecting)) {
              obs.disconnect();
              state.limit += BATCH;
              renderList();
            }
          }).observe(sentinel);
        }
      }
    }

    scr.appendChild(
      bottomNav({
        items: APP_NAV,
        activeId: 'senarai',
        onSelect: (id) => {
          if (id !== 'senarai') toast('Tab ini datang di milestone seterusnya');
        },
      }),
    );
  }

  // Lukis rangka DULU (responsif serta-merta), kemudian isi data.
  renderShell();
  if ((await dbCount('assets')) > 0) {
    await loadData();
    renderShell();

    // Sambung audit yang terputus (app dibunuh semasa audit berpandu)
    const pos = await getPosition();
    if (pos?.screen === 'guided' && pos.asset) {
      const a = state.assets.find((x) => x.asset === pos.asset);
      if (a) void openGuided(a, refresh);
    }
  }

  // Cangkuk dev untuk verifikasi automatik (dibuang dalam build produksi)
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__devImport = (buf: ArrayBuffer) =>
      importFromBuffer(buf, rerenderAll);
  }
}
