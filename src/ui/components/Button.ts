import { el, esc } from '../dom';
import { icon, type IconName } from '../icons';
import './button.css';

export interface ButtonOpts {
  label?: string;
  icon?: IconName;
  /** primary = gradient indigo · secondary = bingkai · ghost = tiada bingkai · danger = merah */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Butang segi empat ikon sahaja (perlu aria) */
  iconOnly?: boolean;
  ariaLabel?: string;
  full?: boolean;
  disabled?: boolean;
  onClick?: (ev: MouseEvent) => void;
}

export function button(opts: ButtonOpts): HTMLButtonElement {
  const v = opts.variant ?? 'secondary';
  const cls = [
    'btn',
    `btn-${v}`,
    opts.iconOnly ? 'btn-icononly' : '',
    opts.full ? 'btn-full' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const inner = [
    opts.icon ? icon(opts.icon, opts.iconOnly ? 19 : 17) : '',
    opts.label ? `<span>${esc(opts.label)}</span>` : '',
  ].join('');
  const node = el<HTMLButtonElement>(
    `<button type="button" class="${cls}"${opts.disabled ? ' disabled' : ''}${
      opts.ariaLabel ? ` aria-label="${esc(opts.ariaLabel)}"` : ''
    }>${inner}</button>`,
  );
  if (opts.onClick) node.addEventListener('click', opts.onClick);
  return node;
}
