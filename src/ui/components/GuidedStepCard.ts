import { el, esc, q } from '../dom';
import { icon, type IconName } from '../icons';
import './guided-step-card.css';

/* ---------- Medan borang (dipakai dalam langkah berpandu & edit) ---------- */

export interface FormFieldOpts {
  label: string;
  value?: string;
  placeholder?: string;
  /** Nilai asal dari pangkalan data — dipapar sebagai caption */
  original?: string;
  /** Papar butang imbas dalam medan */
  scan?: boolean;
  readonly?: boolean;
  onInput?: (value: string) => void;
  onScan?: () => void;
}

export function formField(opts: FormFieldOpts): HTMLElement {
  if (opts.readonly) {
    return el(`
      <div class="ffield">
        <span class="ffield-label">${esc(opts.label)}</span>
        <div class="ffield-ro">${esc(opts.value ?? '—')}</div>
      </div>
    `);
  }
  const node = el(`
    <div class="ffield">
      <label>
        <span class="ffield-label">${esc(opts.label)}</span>
        <span class="ffield-box">
          <input type="text" autocomplete="off"
            value="${esc(opts.value ?? '')}" placeholder="${esc(opts.placeholder ?? '')}" />
          ${opts.scan ? `<button type="button" class="ffield-scan" aria-label="Imbas ke medan ini">${icon('scan', 19)}</button>` : ''}
        </span>
      </label>
      ${
        opts.original != null
          ? `<p class="ffield-orig">${icon('info-circle', 13)}Asal dalam pangkalan data: ${esc(opts.original || 'kosong')}</p>`
          : ''
      }
    </div>
  `);
  const input = q<HTMLInputElement>(node, 'input');
  if (opts.onInput) input.addEventListener('input', () => opts.onInput!(input.value));
  if (opts.scan && opts.onScan) {
    q(node, '.ffield-scan').addEventListener('click', opts.onScan);
  }
  return node;
}

/* ---------- Butang jawapan langkah ---------- */

export interface StepAnswer {
  label: string;
  icon?: IconName;
  /** ok = hijau · warn = oren · save = kelabu (aktif bila ada perubahan) */
  kind: 'ok' | 'warn' | 'save';
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/* ---------- Kad langkah ---------- */

export interface GuidedStepCardOpts {
  icon: IconName;
  title: string;
  desc?: string;
  /** Kandungan langkah (medan borang dll) */
  body?: HTMLElement[];
  answers?: StepAnswer[];
  /** Caption kecil bawah butang, cth "Butang Simpan aktif bila anda mengubah nilai" */
  caption?: string;
}

export function guidedStepCard(opts: GuidedStepCardOpts): HTMLElement {
  const node = el(`
    <section class="gstep">
      <div class="gstep-head">
        <span class="gstep-tile">${icon(opts.icon, 21)}</span>
        <h2 class="gstep-title">${esc(opts.title)}</h2>
      </div>
      ${opts.desc ? `<p class="gstep-desc">${esc(opts.desc)}</p>` : ''}
      <div class="gstep-body"></div>
      <div class="gstep-answers"></div>
      ${opts.caption ? `<p class="gstep-caption">${esc(opts.caption)}</p>` : ''}
    </section>
  `);
  const body = q(node, '.gstep-body');
  (opts.body ?? []).forEach((b) => body.appendChild(b));
  const answers = q(node, '.gstep-answers');
  for (const a of opts.answers ?? []) {
    const b = el<HTMLButtonElement>(`
      <button type="button" class="gstep-ans gstep-ans-${a.kind}${a.selected ? ' on' : ''}"
        ${a.disabled ? 'disabled' : ''} ${a.selected ? 'aria-pressed="true"' : ''}>
        ${a.icon ? icon(a.icon, 18) : ''}<span>${esc(a.label)}</span>
      </button>
    `);
    if (a.onClick) b.addEventListener('click', a.onClick);
    answers.appendChild(b);
  }
  if (!opts.answers?.length) answers.remove();
  if (!opts.body?.length) body.remove();
  return node;
}
