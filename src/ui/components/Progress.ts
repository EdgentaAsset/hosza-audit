import { el, esc } from '../dom';
import './progress.css';

/** Bar kemajuan nipis dengan isian gradient. pct: 0–100. */
export function progressBar(pct: number, label?: string): HTMLElement {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return el(`
    <div class="pbar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"
      ${label ? `aria-label="${esc(label)}"` : ''}>
      <div class="pbar-fill" style="width:${p}%"></div>
    </div>
  `);
}

/** Cincin kemajuan dengan peratus di tengah. size dalam px. */
export function progressRing(pct: number, size = 46): HTMLElement {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 16;
  const c = 2 * Math.PI * r;
  const on = (p / 100) * c;
  return el(`
    <svg class="pring" width="${size}" height="${size}" viewBox="0 0 40 40" role="img"
      aria-label="Kemajuan ${p} peratus">
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="var(--surface-soft)" stroke-width="5"/>
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="url(#pring-grad)" stroke-width="5"
        stroke-linecap="round" stroke-dasharray="${on.toFixed(1)} ${(c - on).toFixed(1)}"
        transform="rotate(-90 20 20)"/>
      <defs>
        <linearGradient id="pring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--indigo-500)"/>
          <stop offset="1" stop-color="var(--indigo-700)"/>
        </linearGradient>
      </defs>
      <text x="20" y="24" text-anchor="middle" class="pring-text">${p}%</text>
    </svg>
  `);
}
