import { el, esc } from './dom';
import './toast.css';

let holder: HTMLElement | null = null;

/** Papar mesej ringkas terapung. kind: '' biasa · 'ok' hijau · 'err' merah. */
export function toast(msg: string, kind: '' | 'ok' | 'err' = ''): void {
  if (!holder) {
    holder = el(`<div class="toasts" aria-live="polite"></div>`);
    document.body.appendChild(holder);
  }
  const t = el(`<div class="toast${kind ? ` toast-${kind}` : ''}">${esc(msg)}</div>`);
  holder.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3000);
}
