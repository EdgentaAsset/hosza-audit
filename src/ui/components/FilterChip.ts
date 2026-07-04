import { el, esc } from '../dom';
import './filter-chip.css';

export interface FilterChipOpts {
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}

export function filterChip(opts: FilterChipOpts): HTMLButtonElement {
  const node = el<HTMLButtonElement>(
    `<button type="button" class="fchip${opts.active ? ' on' : ''}" aria-pressed="${!!opts.active}">
      ${esc(opts.label)}${opts.count != null ? `<span class="fchip-n">${opts.count}</span>` : ''}
    </button>`,
  );
  if (opts.onClick) node.addEventListener('click', opts.onClick);
  return node;
}

/** Baris chips boleh-skrol mendatar. */
export function filterChipRow(chips: HTMLElement[]): HTMLElement {
  const row = el(`<div class="fchip-row" role="group" aria-label="Tapisan"></div>`);
  chips.forEach((c) => row.appendChild(c));
  return row;
}
