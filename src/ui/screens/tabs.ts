/**
 * Tab Ringkasan / Aktiviti / Akaun — kandungan bagi nav bawah.
 * Ringkas sengaja: KPI + bar teks (tiada lib carta), senarai audit,
 * borang login sebenar. Carta penuh bila diminta.
 */
import { el, esc, q } from '../dom';
import { icon } from '../icons';
import { button, progressRing, statusBadge } from '../components';
import type { AuditRecord } from '../../data/audits';
import type { MasterAsset } from '../../data/masterImport';
import type { OutboxItem } from '../../sync/outbox';
import { metaGet } from '../../data/db';
import {
  getEndpoint,
  getSession,
  login,
  logout,
  setEndpoint,
  syncNow,
} from '../../sync/engine';
import { toast } from '../toast';
import './tabs.css';

/* ============ RINGKASAN ============ */

export interface RingkasanData {
  assets: MasterAsset[];
  audits: Map<string, AuditRecord>;
  pendingCount: number;
}

export function renderRingkasan(d: RingkasanData): HTMLElement {
  const total = d.assets.length;
  const checkedNos = new Set(
    Array.from(d.audits.values()).filter((r) => r.checked).map((r) => r.asset),
  );
  const checked = d.assets.filter((a) => checkedNos.has(a.asset)).length;
  const bermasalah = Array.from(d.audits.values()).filter((r) =>
    Object.values(r.semakan ?? {}).some((v) => v === 'Bermasalah' || v === 'Tiada Tagging'),
  ).length;
  const pct = total ? (checked / total) * 100 : 0;

  const root = el(`<div class="tabwrap"></div>`);
  const hero = el(`<div class="rk-hero"></div>`);
  hero.appendChild(progressRing(pct, 84));
  hero.appendChild(
    el(`<div>
      <p class="rk-hero-n">${checked.toLocaleString()} / ${total.toLocaleString()}</p>
      <p class="rk-hero-l">aset diaudit</p>
    </div>`),
  );
  root.appendChild(hero);

  const kpis: [string, number, string][] = [
    ['Belum diaudit', total - checked, 'belum'],
    ['Menunggu sync', d.pendingCount, 'pending'],
    ['Bermasalah', bermasalah, 'issue'],
  ];
  const grid = el(`<div class="rk-grid"></div>`);
  for (const [label, n, tone] of kpis) {
    grid.appendChild(
      el(`<div class="rk-kpi rk-${tone}"><p class="rk-kpi-n">${n.toLocaleString()}</p><p class="rk-kpi-l">${esc(label)}</p></div>`),
    );
  }
  root.appendChild(grid);

  // Pecahan jabatan — 8 terbesar, bar teks ringkas
  const byDept = new Map<string, { total: number; done: number }>();
  for (const a of d.assets) {
    const k = a.deptname || '(tiada jabatan)';
    const rec = byDept.get(k) ?? { total: 0, done: 0 };
    rec.total++;
    if (checkedNos.has(a.asset)) rec.done++;
    byDept.set(k, rec);
  }
  const top = Array.from(byDept.entries())
    .sort((x, y) => y[1].total - x[1].total)
    .slice(0, 8);
  const deptWrap = el(`<div class="rk-dept"><h2>Ikut jabatan</h2></div>`);
  for (const [name, { total: t, done }] of top) {
    const p = t ? Math.round((done / t) * 100) : 0;
    deptWrap.appendChild(
      el(`<div class="rk-dept-row">
        <span class="rk-dept-name">${esc(name)}</span>
        <span class="rk-dept-n">${done}/${t}</span>
        <span class="rk-dept-bar"><span style="width:${p}%"></span></span>
      </div>`),
    );
  }
  root.appendChild(deptWrap);
  return root;
}

/* ============ AKTIVITI ============ */

export interface AktivitiData {
  audits: AuditRecord[];
  outbox: OutboxItem[];
  onSync: () => void;
}

export function renderAktiviti(d: AktivitiData): HTMLElement {
  const root = el(`<div class="tabwrap"></div>`);

  const waiting = d.outbox.length;
  const bar = el(`<div class="ak-syncbar">
    <span>${waiting ? `${waiting} hantaran menunggu` : 'Semua hantaran selesai'}</span>
  </div>`);
  bar.prepend(el(`<span class="ak-syncdot ${waiting ? 'on' : ''}"></span>`));
  bar.appendChild(button({ label: 'Segerak', icon: 'refresh', onClick: d.onSync }));
  root.appendChild(bar);

  const failed = d.outbox.filter((i) => i.status === 'failed');
  if (failed.length) {
    root.appendChild(
      el(`<p class="ak-err">${icon('alert-circle', 14)} ${failed.length} gagal dihantar (cuba semula automatik). Ralat terakhir: ${esc(failed[0].lastError ?? '?')}</p>`),
    );
  }

  const rows = [...d.audits].sort((x, y) => y.updatedAt - x.updatedAt).slice(0, 50);
  if (rows.length === 0) {
    root.appendChild(el(`<p class="ak-empty">Belum ada aktiviti audit pada peranti ini.</p>`));
    return root;
  }
  const list = el(`<div class="ak-list"></div>`);
  const pendingAssets = new Set(d.outbox.map((i) => i.asset));
  for (const r of rows) {
    const row = el(`<div class="ak-row">
      <div class="ak-row-main">
        <span class="ak-no">${esc(r.asset)}</span>
        <span class="ak-meta">${esc(r.method ?? '')} · ${new Date(r.updatedAt).toLocaleString('ms-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>`);
    row.appendChild(
      r.checked
        ? statusBadge(pendingAssets.has(r.asset) ? 'pending' : 'done')
        : statusBadge('belum', 'Edit sahaja'),
    );
    list.appendChild(row);
  }
  root.appendChild(list);
  return root;
}

/* ============ AKAUN ============ */

export interface AkaunOpts {
  onChanged: () => void;
  onImport: () => void;
}

export async function renderAkaun(opts: AkaunOpts): Promise<HTMLElement> {
  const root = el(`<div class="tabwrap"></div>`);
  const s = getSession();

  if (s) {
    const card = el(`<div class="au-card">
      <div class="au-avatar">${esc(s.name.slice(0, 2).toUpperCase())}</div>
      <div class="au-info">
        <p class="au-name">${esc(s.name)}</p>
        <p class="au-role">${esc(s.role)} · ${esc(s.username)}</p>
      </div>
    </div>`);
    card.appendChild(
      button({
        label: 'Log keluar',
        icon: 'logout',
        variant: 'danger',
        onClick: async () => {
          await logout();
          toast('Log keluar berjaya', '');
          opts.onChanged();
        },
      }),
    );
    root.appendChild(card);
  } else {
    const form = el(`<form class="au-login">
      <h2>Log masuk pemeriksa</h2>
      <p class="au-hint">Tanpa log masuk, app baca-sahaja. Akaun diuruskan Administrator.</p>
      <label><span>URL Pengurusan (/exec)</span><input name="ep" type="url" value="${esc(getEndpoint())}" placeholder="https://script.google.com/macros/s/.../exec" /></label>
      <label><span>Username</span><input name="u" autocomplete="username" /></label>
      <label><span>Password</span><input name="p" type="password" autocomplete="current-password" /></label>
    </form>`);
    form.appendChild(button({ label: 'Log masuk', icon: 'lock', variant: 'primary', full: true }));
    form.addEventListener('submit', (ev) => ev.preventDefault());
    q(form, '.btn-primary').addEventListener('click', async () => {
      const ep = q<HTMLInputElement>(form, '[name=ep]').value.trim();
      const u = q<HTMLInputElement>(form, '[name=u]').value.trim();
      const p = q<HTMLInputElement>(form, '[name=p]').value;
      if (!ep || !u || !p) return toast('Isi URL, username dan password', 'err');
      setEndpoint(ep);
      try {
        const sess = await login(u, p);
        toast(`✓ Selamat datang, ${sess.name}`, 'ok');
        void syncNow();
        opts.onChanged();
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Log masuk gagal', 'err');
      }
    });
    root.appendChild(form);
  }

  // Tetapan paparan
  const set = el(`<div class="au-set"><h2>Tetapan</h2></div>`);
  const mkToggle = (label: string, key: string, opts2: [string, string][]): HTMLElement => {
    const cur = localStorage.getItem(key) ?? opts2[0][0];
    const row = el(`<div class="au-set-row"><span>${esc(label)}</span><span class="au-seg"></span></div>`);
    const seg = q(row, '.au-seg');
    for (const [val, lab] of opts2) {
      const b = el<HTMLButtonElement>(`<button type="button" class="${val === cur ? 'on' : ''}">${esc(lab)}</button>`);
      b.addEventListener('click', () => {
        localStorage.setItem(key, val);
        applyPrefs();
        seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      });
      seg.appendChild(b);
    }
    return row;
  };
  set.appendChild(mkToggle('Saiz teks', 'textsize', [['biasa', 'Biasa'], ['besar', 'Besar']]));
  set.appendChild(mkToggle('Tema', 'theme', [['auto', 'Auto'], ['dark', 'Gelap']]));
  root.appendChild(set);

  // Data master
  const counts = await metaGet<{ assets: number; duplicates: number; appliedAt: number }>('masterCounts');
  const dm = el(`<div class="au-set"><h2>Data master</h2></div>`);
  const version = await metaGet<string>('masterVersion');
  dm.appendChild(
    el(`<p class="au-hint">${
      counts
        ? `${counts.assets.toLocaleString()} aset · v${esc(version ?? '?')} · dikemas kini ${new Date(counts.appliedAt).toLocaleDateString('ms-MY')}`
        : 'Belum ada — diedarkan oleh Administrator secara automatik'
    }</p>`),
  );
  // Import = tugas Administrator; peranti lain terima edaran dari pusat.
  if (s?.role === 'administrator') {
    dm.appendChild(button({ label: 'Import Data.xlsx', icon: 'upload', onClick: opts.onImport }));
  }
  root.appendChild(dm);

  return root;
}

/** Guna pilihan paparan tersimpan (dipanggil pada boot & bila ditukar). */
export function applyPrefs(): void {
  const root = document.documentElement;
  root.dataset.theme = localStorage.getItem('theme') ?? 'auto';
  if (localStorage.getItem('textsize') === 'besar') root.dataset.textsize = 'besar';
  else delete root.dataset.textsize;
}
