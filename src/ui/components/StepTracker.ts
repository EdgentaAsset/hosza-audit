import { el, esc } from '../dom';
import { icon, type IconName } from '../icons';
import type { StepState } from '../../types';
import './step-tracker.css';

export interface StepDef {
  icon: IconName;
  label: string;
}

/** 6 langkah audit berpandu — ikut aliran app lama. */
export const GUIDED_STEPS: StepDef[] = [
  { icon: 'id', label: 'UNIZA' },
  { icon: 'map-pin', label: 'Lokasi' },
  { icon: 'category', label: 'Jenis aset' },
  { icon: 'tag', label: 'Spesifikasi' },
  { icon: 'camera', label: 'Gambar' },
  { icon: 'notes', label: 'Catatan' },
];

export interface StepTrackerOpts {
  steps: StepDef[];
  /** Indeks langkah semasa (0-based). Langkah sebelumnya = siap. */
  current: number;
  /** Override keadaan per langkah (cth langkah dilangkau) */
  states?: StepState[];
  /** Tekan bulatan langkah siap untuk patah balik */
  onJump?: (index: number) => void;
}

export function stepTracker(opts: StepTrackerOpts): HTMLElement {
  const node = el(`<div class="steps" role="list" aria-label="Langkah audit"></div>`);
  opts.steps.forEach((s, i) => {
    const state: StepState = opts.states?.[i] ?? (i < opts.current ? 'done' : i === opts.current ? 'current' : 'todo');
    if (i > 0) node.appendChild(el(`<span class="steps-line${i <= opts.current ? ' on' : ''}"></span>`));
    const c = el<HTMLButtonElement>(`
      <button type="button" class="steps-c steps-${state}" role="listitem"
        aria-label="Langkah ${i + 1}: ${esc(s.label)}${state === 'done' ? ' (siap)' : state === 'current' ? ' (semasa)' : ''}"
        ${state === 'current' ? 'aria-current="step"' : ''}>
        ${state === 'done' ? icon('check', 18) : icon(s.icon, 17)}
      </button>
    `);
    if (state === 'done' && opts.onJump) c.addEventListener('click', () => opts.onJump!(i));
    node.appendChild(c);
  });
  const label = opts.steps[opts.current]?.label ?? '';
  const wrap = el(`<div class="steps-wrap"></div>`);
  wrap.appendChild(node);
  wrap.appendChild(
    el(
      `<p class="steps-caption">Langkah ${Math.min(opts.current + 1, opts.steps.length)} daripada ${opts.steps.length} · ${esc(label)}</p>`,
    ),
  );
  return wrap;
}
