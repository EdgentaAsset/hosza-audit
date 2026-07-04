import { el, esc } from '../dom';
import { icon, type IconName } from '../icons';
import { progressBar } from './Progress';
import './app-header.css';

export interface HeaderAction {
  icon: IconName;
  ariaLabel: string;
  /** Titik notifikasi kecil (cth penapis aktif / belum sync) */
  dot?: boolean;
  onClick?: () => void;
}

export interface AppHeaderOpts {
  title: string;
  subtitle?: string;
  /** Peratus kemajuan audit — bar nipis di bawah header */
  progressPct?: number;
  actions?: HeaderAction[];
}

export function appHeader(opts: AppHeaderOpts): HTMLElement {
  const node = el(`
    <header class="apphead">
      <div class="apphead-row">
        <div class="apphead-tile">${icon('clipboard-list', 26)}</div>
        <div class="apphead-titles">
          <p class="apphead-title">${esc(opts.title)}</p>
          ${opts.subtitle ? `<p class="apphead-sub">${esc(opts.subtitle)}</p>` : ''}
        </div>
        <div class="apphead-actions"></div>
      </div>
    </header>
  `);
  const actions = node.querySelector('.apphead-actions')!;
  for (const a of opts.actions ?? []) {
    const b = el<HTMLButtonElement>(
      `<button type="button" class="apphead-btn" aria-label="${esc(a.ariaLabel)}">
        ${icon(a.icon, 19)}${a.dot ? '<span class="apphead-dot"></span>' : ''}
      </button>`,
    );
    if (a.onClick) b.addEventListener('click', a.onClick);
    actions.appendChild(b);
  }
  if (opts.progressPct != null) {
    const wrap = el(`<div class="apphead-progress"></div>`);
    wrap.appendChild(progressBar(opts.progressPct, 'Kemajuan audit'));
    node.appendChild(wrap);
  }
  return node;
}
