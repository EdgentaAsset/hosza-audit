/**
 * Helaian Edit — betulkan maklumat aset.
 * Setiap ketukan disimpan ke draf SERTA-MERTA (isu lapangan #2); tutup tanpa
 * simpan pun kerja tak hilang — buka semula, draf dipulihkan automatik.
 */
import { el, esc, q } from '../dom';
import { icon } from '../icons';
import { button } from '../components';
import { formField } from '../components';
import { getDraft, saveDraft } from '../../data/drafts';
import { getAudit, saveEdits } from '../../data/audits';
import type { MasterAsset } from '../../data/masterImport';
import { toast } from '../toast';
import './edit-sheet.css';

const FIELDS: { key: string; label: string; master: keyof MasterAsset; scan?: boolean }[] = [
  { key: 'uniza', label: 'No. UNIZA', master: 'uniza', scan: true },
  { key: 'locno', label: 'No. lokasi', master: 'locno' },
  { key: 'brand', label: 'Jenama', master: 'brand' },
  { key: 'model', label: 'Model', master: 'model' },
  { key: 'serial', label: 'No. serial', master: 'serial', scan: true },
];

export async function openEditSheet(a: MasterAsset, onSaved: () => void): Promise<void> {
  const audit = await getAudit(a.asset);
  const draft = await getDraft(a.asset);
  const hasDraft = !!draft && Object.keys(draft.fields).length > 0;

  /** Nilai semasa medan: draf > pembetulan tersimpan > master */
  const valueOf = (key: string, master: keyof MasterAsset): string =>
    draft?.fields[key] ?? audit?.edits?.[key] ?? String(a[master] ?? '');

  const overlay = el(`
    <div class="esheet-overlay">
      <div class="esheet" role="dialog" aria-modal="true" aria-label="Edit aset ${esc(a.asset)}">
        <div class="esheet-head">
          <div>
            <p class="esheet-title">Edit aset</p>
            <p class="esheet-sub">${esc(a.asset)} · ${esc(a.typedesc || '')}</p>
          </div>
          <button type="button" class="esheet-x" aria-label="Tutup">${icon('x', 19)}</button>
        </div>
        <div class="esheet-body"></div>
        <div class="esheet-foot"></div>
      </div>
    </div>
  `);

  const body = q(overlay, '.esheet-body');
  const changed = new Map<string, string>();

  for (const f of FIELDS) {
    const original = String(a[f.master] ?? '');
    body.appendChild(
      formField({
        label: f.label,
        value: valueOf(f.key, f.master),
        original,
        scan: f.scan,
        onScan: () => toast('Imbas kod — milestone seterusnya'),
        onInput: (v) => {
          changed.set(f.key, v);
          void saveDraft(a.asset, { fields: { [f.key]: v } }); // setiap ketukan
          updateSaveState();
        },
      }),
    );
  }

  // Catatan
  const noteVal = draft?.fields['note'] ?? audit?.note ?? '';
  const noteWrap = el(`
    <div class="ffield">
      <label>
        <span class="ffield-label">Catatan</span>
        <textarea class="esheet-note" rows="3" placeholder="Catatan pemeriksa (pilihan)">${esc(noteVal)}</textarea>
      </label>
    </div>
  `);
  const noteEl = q<HTMLTextAreaElement>(noteWrap, 'textarea');
  noteEl.addEventListener('input', () => {
    changed.set('note', noteEl.value);
    void saveDraft(a.asset, { fields: { note: noteEl.value } });
    updateSaveState();
  });
  body.appendChild(noteWrap);

  const foot = q(overlay, '.esheet-foot');
  const saveBtn = button({
    label: 'Simpan',
    icon: 'device-floppy',
    variant: 'primary',
    full: true,
    disabled: !hasDraft,
    onClick: async () => {
      const fields: Record<string, string> = {};
      // Gabung draf penuh (termasuk sesi lepas) + perubahan sesi ini
      const latestDraft = await getDraft(a.asset);
      for (const [k, v] of Object.entries(latestDraft?.fields ?? {})) fields[k] = v;
      for (const [k, v] of changed) fields[k] = v;
      const note = fields['note'];
      delete fields['note'];
      await saveEdits(a.asset, fields, note, fields['uniza'] ?? a.uniza);
      toast('✓ Pembetulan disimpan — akan dihantar ke pusat', 'ok');
      close();
      onSaved();
    },
  });
  foot.appendChild(saveBtn);

  function updateSaveState(): void {
    saveBtn.disabled = false;
  }

  function close(): void {
    overlay.remove();
    document.body.style.overflow = '';
  }

  q(overlay, '.esheet-x').addEventListener('click', () => {
    close();
    if (changed.size > 0) toast('Draf disimpan — buka semula untuk sambung', '');
  });
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) {
      close();
      if (changed.size > 0) toast('Draf disimpan — buka semula untuk sambung', '');
    }
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  if (hasDraft) toast('✎ Draf sesi lepas dipulihkan', 'ok');
}
