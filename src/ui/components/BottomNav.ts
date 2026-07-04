import { el, esc } from '../dom';
import { icon, type IconName } from '../icons';
import './bottom-nav.css';

export interface NavItem {
  id: string;
  icon: IconName;
  label: string;
}

export const APP_NAV: NavItem[] = [
  { id: 'senarai', icon: 'home', label: 'Senarai' },
  { id: 'ringkasan', icon: 'file-text', label: 'Ringkasan' },
  { id: 'aktiviti', icon: 'chart-pie', label: 'Aktiviti' },
  { id: 'akaun', icon: 'user', label: 'Akaun' },
];

export interface BottomNavOpts {
  items: NavItem[];
  activeId: string;
  onSelect?: (id: string) => void;
}

export function bottomNav(opts: BottomNavOpts): HTMLElement {
  const node = el(`<nav class="bnav" aria-label="Navigasi utama"></nav>`);
  for (const item of opts.items) {
    const active = item.id === opts.activeId;
    const b = el<HTMLButtonElement>(`
      <button type="button" class="bnav-item${active ? ' on' : ''}"
        ${active ? 'aria-current="page"' : ''}>
        ${icon(item.icon, 23)}
        <span>${esc(item.label)}</span>
        <span class="bnav-pill"></span>
      </button>
    `);
    if (opts.onSelect) b.addEventListener('click', () => opts.onSelect!(item.id));
    node.appendChild(b);
  }
  return node;
}
