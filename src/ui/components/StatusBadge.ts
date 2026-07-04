import { el, esc } from '../dom';
import { icon } from '../icons';
import type { AuditStatus } from '../../types';
import './status-badge.css';

const CFG: Record<AuditStatus, { label: string; iconHTML: string }> = {
  belum: { label: 'Belum diaudit', iconHTML: '<span class="sb-dot"></span>' },
  done: { label: 'Selesai', iconHTML: icon('circle-check', 14) },
  pending: { label: 'Menunggu sync', iconHTML: icon('clock', 14) },
  issue: { label: 'Bermasalah', iconHTML: icon('alert-circle', 14) },
};

export function statusBadge(status: AuditStatus, label?: string): HTMLElement {
  const c = CFG[status];
  return el(
    `<span class="sbadge sbadge-${status}">${c.iconHTML}${esc(label ?? c.label)}</span>`,
  );
}
