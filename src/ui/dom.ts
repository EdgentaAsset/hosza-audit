/** Helper DOM ringan — komponen bina markup dengan template string. */

/** Escape HTML untuk sebarang nilai dari data/pengguna. */
export function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Tukar template HTML kepada HTMLElement (mesti satu elemen akar). */
export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  const node = t.content.firstElementChild;
  if (!node) throw new Error('el(): markup kosong');
  return node as T;
}

/** querySelector yang wajib jumpa — untuk rujukan dalaman komponen. */
export function q<T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string): T {
  const node = root.querySelector<T>(sel);
  if (!node) throw new Error(`q(): tiada elemen sepadan "${sel}"`);
  return node;
}
