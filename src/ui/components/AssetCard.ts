import { el, esc } from '../dom';
import { icon } from '../icons';
import { statusBadge } from './StatusBadge';
import { button } from './Button';
import type { AssetCardData } from '../../types';
import './asset-card.css';

export interface AssetCardOpts {
  data: AssetCardData;
  /** Kad aktif = dibesarkan dengan butang tindakan & slot gambar */
  active?: boolean;
  onOpen?: () => void;
  onStart?: () => void;
  onEdit?: () => void;
  onMore?: () => void;
  onAddPhoto?: () => void;
}

function metaRow(ic: string, text: string): string {
  return `<p class="acard-meta">${ic}<span>${esc(text)}</span></p>`;
}

export function assetCard(opts: AssetCardOpts): HTMLElement {
  const d = opts.data;
  const chips: string[] = [];
  if (d.ppmScheduled) {
    chips.push(`<span class="acard-chip">${icon('calendar-check', 14)}PPM berjadual</span>`);
  }
  if (d.photoTotal) {
    chips.push(
      `<span class="acard-chip">${icon('photo', 14)}${d.photoCount ?? 0}/${d.photoTotal} gambar</span>`,
    );
  }
  if (d.auditedBy) {
    chips.push(`<span class="acard-chip">${icon('calendar', 14)}${esc(d.auditedBy)}</span>`);
  }

  const thumbs = (d.thumbs ?? [])
    .map((src) =>
      src
        ? `<img class="acard-thumb" src="${esc(src)}" alt="Gambar aset" loading="lazy" />`
        : `<span class="acard-thumb acard-thumb-empty">${icon('photo', 18)}</span>`,
    )
    .join('');

  const slots = opts.active
    ? Array.from(
        { length: Math.max(0, (d.photoTotal ?? 0) - (d.photoCount ?? 0)) },
        () =>
          `<button type="button" class="acard-slot" aria-label="Tambah gambar">${icon('plus', 17)}</button>`,
      ).join('')
    : '';

  const node = el(`
    <article class="acard acard-${d.status}${opts.active ? ' acard-active' : ''}">
      <div class="acard-body">
        <div class="acard-top">
          <span class="acard-no"></span>
        </div>
        <p class="acard-name">${esc(d.name)}</p>
        ${metaRow(icon('map-pin', 15), d.location + (d.dept ? ' · ' + d.dept : ''))}
        ${d.spec ? metaRow(icon('tag', 15), d.spec) : ''}
        ${
          chips.length || thumbs || slots
            ? `<div class="acard-chips">${thumbs}${chips.join('')}<span class="acard-space"></span>${slots}</div>`
            : ''
        }
        <div class="acard-actions"></div>
      </div>
      ${!opts.active ? `<span class="acard-chev">${icon('chevron-right', 20)}</span>` : ''}
    </article>
  `);

  // No. aset + badge (selamat dari injection, dibina berasingan)
  const top = node.querySelector('.acard-top')!;
  const no = node.querySelector('.acard-no')!;
  no.textContent = d.assetNo;
  top.appendChild(statusBadge(d.status));

  const actions = node.querySelector('.acard-actions')!;
  if (opts.active) {
    actions.append(
      button({
        label: 'Mula audit',
        icon: 'player-play',
        variant: 'primary',
        full: true,
        onClick: opts.onStart,
      }),
      button({ label: 'Edit', icon: 'pencil', onClick: opts.onEdit }),
      button({ icon: 'dots-vertical', iconOnly: true, ariaLabel: 'Tindakan lain', onClick: opts.onMore }),
    );
  } else {
    actions.remove();
    if (opts.onOpen) {
      node.style.cursor = 'pointer';
      node.addEventListener('click', opts.onOpen);
    }
  }
  if (opts.onAddPhoto) {
    node.querySelectorAll('.acard-slot').forEach((s) =>
      s.addEventListener('click', (ev) => {
        ev.stopPropagation();
        opts.onAddPhoto?.();
      }),
    );
  }
  return node;
}
