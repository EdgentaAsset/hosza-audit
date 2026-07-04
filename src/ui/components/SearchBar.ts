import { el, esc, q } from '../dom';
import { icon } from '../icons';
import './search-bar.css';

export interface SearchBarOpts {
  placeholder?: string;
  onInput?: (value: string) => void;
  onScan?: () => void;
}

export function searchBar(opts: SearchBarOpts = {}): HTMLElement {
  const node = el(`
    <div class="searchbar">
      <label class="search-field">
        ${icon('search', 18)}
        <input type="search" inputmode="search" autocomplete="off"
          placeholder="${esc(opts.placeholder ?? 'Cari no. aset atau UNIZA')}" />
        <button type="button" class="search-clear hide" aria-label="Kosongkan carian">${icon('x', 16)}</button>
      </label>
      <button type="button" class="search-scan" aria-label="Imbas kod QR atau barcode">${icon('scan', 22)}</button>
    </div>
  `);
  const input = q<HTMLInputElement>(node, 'input');
  const clear = q<HTMLButtonElement>(node, '.search-clear');
  input.addEventListener('input', () => {
    clear.classList.toggle('hide', input.value === '');
    opts.onInput?.(input.value);
  });
  clear.addEventListener('click', () => {
    input.value = '';
    clear.classList.add('hide');
    opts.onInput?.('');
    input.focus();
  });
  q<HTMLButtonElement>(node, '.search-scan').addEventListener('click', () => opts.onScan?.());
  return node;
}
