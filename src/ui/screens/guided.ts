/**
 * Audit Berpandu — 6 langkah + ringkasan (skrin kerja utama pemeriksa).
 *
 * Setiap jawapan/perubahan DISIMPAN serta-merta (draf + kedudukan) —
 * keluar ke kamera/gallery, app dibunuh, buka semula: sambung di langkah
 * sama (isu lapangan #2). Siap = SATU hantaran lengkap ke outbox.
 */
import { el, esc, q } from '../dom';
import { icon } from '../icons';
import { button, formField, guidedStepCard, stepTracker, GUIDED_STEPS } from '../components';
import type { StepAnswer } from '../components';
import { getDraft, saveDraft, savePosition } from '../../data/drafts';
import { completeGuided, getAudit } from '../../data/audits';
import { addPhoto, photosOf, pickImage, MAIN_KINDS, KIND_LABEL, type PhotoRec } from '../../data/photos';
import { openScanner } from '../../scanner/scan';
import type { MasterAsset } from '../../data/masterImport';
import { toast } from '../toast';
import './guided.css';

/** Kunci semakan per langkah (indeks 0-5) — padan lajur Sheet app lama. */
const SEM_KEYS = ['uniza', 'lokasi', 'jenis', 'spec', 'gambar', 'catatan'] as const;

const SEM_LABEL: Record<string, string> = {
  'Tiada Isu': 'Tiada isu',
  'Tiada Tagging': 'Tiada tagging',
  Dibetulkan: 'Dibetulkan',
  Bermasalah: 'Bermasalah',
  Dilangkau: 'Dilangkau',
  Selesai: 'Selesai',
};

export async function openGuided(a: MasterAsset, onDone: () => void): Promise<void> {
  const audit = await getAudit(a.asset);
  const draft = await getDraft(a.asset);
  let photos: PhotoRec[] = await photosOf(a.asset);

  const ctx = {
    step: Math.min(Math.max(draft?.guidedStep ?? 1, 1), 7),
    sem: { ...(audit?.semakan ?? {}), ...(draft?.semakan ?? {}) } as Record<string, string>,
    fields: { ...(draft?.fields ?? {}) } as Record<string, string>,
  };

  const valueOf = (key: string, master: keyof MasterAsset): string =>
    ctx.fields[key] ?? audit?.edits?.[key] ?? String(a[master] ?? '');

  async function persist(): Promise<void> {
    await saveDraft(a.asset, { guidedStep: ctx.step, semakan: ctx.sem, fields: ctx.fields });
    await savePosition({ screen: 'guided', asset: a.asset, step: ctx.step });
  }

  const overlay = el(`
    <div class="guided">
      <div class="guided-top">
        <button type="button" class="guided-iconbtn" data-back aria-label="Kembali">${icon('chevron-left', 20)}</button>
        <div class="guided-titles">
          <p class="guided-title">Audit berpandu</p>
          <p class="guided-sub">${esc(a.asset)} · ${esc(a.typedesc || '')}</p>
        </div>
        <button type="button" class="guided-iconbtn" data-close aria-label="Tutup dan simpan draf">${icon('x', 19)}</button>
      </div>
      <div class="guided-steps"></div>
      <main class="guided-body"></main>
      <div class="guided-foot"></div>
    </div>
  `);

  const stepsWrap = q(overlay, '.guided-steps');
  const body = q(overlay, '.guided-body');
  const foot = q(overlay, '.guided-foot');

  function resolved(stepIdx: number): boolean {
    return !!ctx.sem[SEM_KEYS[stepIdx]];
  }

  function setSem(stepIdx: number, value: string, advance = true): void {
    ctx.sem[SEM_KEYS[stepIdx]] = value;
    if (advance && ctx.step < 7) ctx.step += 1;
    void persist();
    render();
  }

  function fieldInput(key: string): (v: string) => void {
    return (v) => {
      ctx.fields[key] = v;
      void persist(); // setiap ketukan
      render(); // kemaskini keadaan butang Simpan
    };
  }

  /* ---------- Kandungan setiap langkah ---------- */

  function answersFor(
    stepIdx: number,
    extra: StepAnswer[] = [],
    changed = false,
    saveLabel = 'Simpan',
  ): StepAnswer[] {
    const cur = ctx.sem[SEM_KEYS[stepIdx]];
    return [
      {
        label: 'Tiada isu',
        icon: 'circle-check',
        kind: 'ok',
        selected: cur === 'Tiada Isu',
        onClick: () => setSem(stepIdx, 'Tiada Isu'),
      },
      ...extra,
      {
        label: saveLabel,
        icon: 'device-floppy',
        kind: 'save',
        disabled: !changed,
        onClick: () => setSem(stepIdx, 'Dibetulkan'),
      },
    ];
  }

  function stepCard(): HTMLElement {
    const s = ctx.step;
    if (s === 1) {
      const cur = valueOf('uniza', 'uniza');
      const changed = cur.trim() !== String(a.uniza ?? '').trim();
      return guidedStepCard({
        icon: 'id',
        title: 'Semak No. UNIZA',
        desc: 'Imbas barcode UNIZA pada aset, atau taip. Kalau tag tiada, tekan Tiada tagging.',
        body: [
          formField({
            label: 'No. UNIZA',
            value: cur,
            original: String(a.uniza ?? ''),
            scan: true,
            onScan: () =>
              void openScanner((v) => {
                ctx.fields['uniza'] = v;
                void persist();
                render();
              }),
            onInput: fieldInput('uniza'),
          }),
        ],
        answers: answersFor(
          0,
          [
            {
              label: 'Tiada tagging',
              icon: 'alert-circle',
              kind: 'warn',
              selected: ctx.sem.uniza === 'Tiada Tagging',
              onClick: () => setSem(0, 'Tiada Tagging'),
            },
          ],
          changed,
        ),
        caption: 'Butang Simpan aktif bila anda mengubah nilai',
      });
    }
    if (s === 2) {
      const cur = valueOf('locno', 'locno');
      const changed = cur.trim() !== String(a.locno ?? '').trim();
      return guidedStepCard({
        icon: 'map-pin',
        title: 'Semak lokasi aset',
        desc: 'Pastikan aset berada di lokasi yang direkodkan. Betulkan jika berpindah.',
        body: [
          formField({
            label: 'No. lokasi',
            value: cur,
            original: String(a.locno ?? ''),
            onInput: fieldInput('locno'),
          }),
          formField({ label: 'Nama lokasi', value: a.locname || '—', readonly: true }),
        ],
        answers: answersFor(1, [], changed),
        caption: 'Butang Simpan aktif bila anda mengubah nilai',
      });
    }
    if (s === 3) {
      return guidedStepCard({
        icon: 'category',
        title: 'Semak jenis aset',
        desc: 'Jenis aset tak boleh diedit. Jika salah atau bermasalah, tanda Bermasalah — gambar bukti diambil di langkah Gambar.',
        body: [
          formField({ label: 'Jenis aset', value: a.typedesc || '—', readonly: true }),
          formField({ label: 'Kod jenis', value: a.typecode || '—', readonly: true }),
        ],
        answers: [
          {
            label: 'Tiada isu',
            icon: 'circle-check',
            kind: 'ok',
            selected: ctx.sem.jenis === 'Tiada Isu',
            onClick: () => setSem(2, 'Tiada Isu'),
          },
          {
            label: 'Bermasalah',
            icon: 'alert-circle',
            kind: 'warn',
            selected: ctx.sem.jenis === 'Bermasalah',
            onClick: () => setSem(2, 'Bermasalah'),
          },
        ],
      });
    }
    if (s === 4) {
      const cb = valueOf('brand', 'brand');
      const cm = valueOf('model', 'model');
      const cs = valueOf('serial', 'serial');
      const changed =
        cb.trim() !== String(a.brand ?? '').trim() ||
        cm.trim() !== String(a.model ?? '').trim() ||
        cs.trim() !== String(a.serial ?? '').trim();
      return guidedStepCard({
        icon: 'tag',
        title: 'Semak spesifikasi',
        desc: 'Banding jenama, model dan no. serial dengan nameplate aset.',
        body: [
          formField({ label: 'Jenama', value: cb, original: String(a.brand ?? ''), onInput: fieldInput('brand') }),
          formField({ label: 'Model', value: cm, original: String(a.model ?? ''), onInput: fieldInput('model') }),
          formField({
            label: 'No. serial',
            value: cs,
            original: String(a.serial ?? ''),
            scan: true,
            onScan: () =>
              void openScanner((v) => {
                ctx.fields['serial'] = v;
                void persist();
                render();
              }),
            onInput: fieldInput('serial'),
          }),
        ],
        answers: answersFor(3, [], changed),
        caption: 'Butang Simpan aktif bila anda mengubah nilai',
      });
    }
    if (s === 5) {
      const tiles = el(`<div class="gph"></div>`);
      for (const kind of MAIN_KINDS) {
        const p = photos.find((x) => x.kind === kind);
        const tile = el(`
          <button type="button" class="gph-tile" aria-label="Ambil gambar ${esc(KIND_LABEL[kind])}">
            ${p ? `<img src="${p.thumb}" alt="" />` : icon('camera', 22)}
            <span>${esc(KIND_LABEL[kind])}</span>
          </button>
        `);
        tile.addEventListener('click', async () => {
          const file = await pickImage();
          if (!file) return;
          toast('Memproses gambar…', '');
          await addPhoto(a.asset, kind, file);
          photos = await photosOf(a.asset);
          ctx.sem.gambar = 'Diambil'; // langkah selesai bila ada >=1 gambar
          await persist();
          render();
          toast('✓ Gambar disimpan — akan dimuat naik', 'ok');
        });
        tiles.appendChild(tile);
      }
      return guidedStepCard({
        icon: 'camera',
        title: 'Gambar aset',
        desc: 'Ambil gambar No. Aset, nameplate dan keseluruhan. Satu pun cukup untuk teruskan.',
        body: [tiles],
        answers: [
          {
            label: 'Langkau — tiada gambar',
            icon: 'chevron-right',
            kind: 'warn',
            selected: ctx.sem.gambar === 'Dilangkau',
            onClick: () => setSem(4, 'Dilangkau'),
          },
        ],
        caption: photos.length ? `${photos.length} gambar diambil` : undefined,
      });
    }
    if (s === 6) {
      const note = ctx.fields['note'] ?? audit?.note ?? '';
      const card = guidedStepCard({
        icon: 'notes',
        title: 'Catatan pemeriksa',
        desc: 'Apa-apa pemerhatian tambahan (pilihan).',
        answers: [
          {
            label: 'Tiada catatan',
            icon: 'circle-check',
            kind: 'ok',
            selected: ctx.sem.catatan === 'Selesai' && !note,
            onClick: () => setSem(5, 'Selesai'),
          },
          {
            label: 'Simpan catatan',
            icon: 'device-floppy',
            kind: 'save',
            disabled: !note.trim(),
            onClick: () => setSem(5, 'Selesai'),
          },
        ],
      });
      const noteWrap = el(`
        <div class="ffield">
          <label>
            <span class="ffield-label">Catatan</span>
            <textarea class="guided-note" rows="3" placeholder="Cth: aset berfungsi, tag pudar...">${esc(note)}</textarea>
          </label>
        </div>
      `);
      const ta = q<HTMLTextAreaElement>(noteWrap, 'textarea');
      ta.addEventListener('input', () => {
        ctx.fields['note'] = ta.value;
        void persist();
        const saveBtn = card.querySelector<HTMLButtonElement>('.gstep-ans-save');
        if (saveBtn) saveBtn.disabled = !ta.value.trim();
      });
      const bodyEl = card.querySelector('.gstep-body');
      if (bodyEl) bodyEl.appendChild(noteWrap);
      else card.insertBefore(noteWrap, card.querySelector('.gstep-answers'));
      return card;
    }
    return summaryCard();
  }

  function summaryCard(): HTMLElement {
    const rows = GUIDED_STEPS.map((st, i) => {
      const v = ctx.sem[SEM_KEYS[i]];
      const label = v ? (SEM_LABEL[v] ?? v) : 'Belum dijawab';
      const tone = !v
        ? 'todo'
        : v === 'Bermasalah' || v === 'Tiada Tagging'
          ? 'warn'
          : v === 'Dilangkau'
            ? 'skip'
            : 'ok';
      return `
        <div class="gsum-row">
          <span class="gsum-ic">${icon(st.icon, 16)}</span>
          <span class="gsum-label">${esc(st.label)}</span>
          <span class="gsum-val gsum-${tone}">${esc(label)}</span>
        </div>`;
    }).join('');
    const editedCount = Object.keys(ctx.fields).filter((k) => k !== 'note' && ctx.fields[k] !== undefined).length;
    const card = el(`
      <section class="gstep">
        <div class="gstep-head">
          <span class="gstep-tile">${icon('circle-check', 21)}</span>
          <h2 class="gstep-title">Ringkasan audit</h2>
        </div>
        <p class="gstep-desc">Semak sebelum selesai. Tekan bulatan langkah di atas untuk mengubah jawapan.</p>
        <div class="gsum">${rows}</div>
        ${editedCount ? `<p class="gsum-note">${editedCount} medan dibetulkan akan dihantar bersama.</p>` : ''}
        <div class="gsum-finish"></div>
      </section>
    `);
    const allDone = SEM_KEYS.every((k) => ctx.sem[k]);
    q(card, '.gsum-finish').appendChild(
      button({
        label: 'Selesai audit — Tanda Diperiksa',
        icon: 'check',
        variant: 'primary',
        full: true,
        disabled: !allDone,
        onClick: async () => {
          const fields = { ...ctx.fields };
          const note = fields['note'];
          delete fields['note'];
          await completeGuided(a.asset, {
            fields,
            note,
            semakan: ctx.sem,
            uniza: ctx.fields['uniza'] ?? a.uniza,
          });
          toast('✓ Audit berpandu selesai — akan dihantar ke pusat', 'ok');
          close(false);
          onDone();
        },
      }),
    );
    if (!allDone) {
      card.appendChild(
        el(`<p class="gstep-caption">Semua 6 langkah perlu dijawab sebelum selesai</p>`),
      );
    }
    return card;
  }

  /* ---------- Render ---------- */

  function render(): void {
    stepsWrap.innerHTML = '';
    stepsWrap.appendChild(
      stepTracker({
        steps: GUIDED_STEPS,
        current: Math.min(ctx.step - 1, 5),
        states: GUIDED_STEPS.map((_, i) =>
          ctx.step === 7
            ? resolved(i)
              ? 'done'
              : 'todo'
            : i === ctx.step - 1
              ? 'current'
              : resolved(i)
                ? 'done'
                : 'todo',
        ),
        onJump: (i) => {
          ctx.step = i + 1;
          void persist();
          render();
        },
      }),
    );

    body.innerHTML = '';
    body.appendChild(stepCard());

    foot.innerHTML = '';
    const back = button({
      label: 'Kembali',
      icon: 'chevron-left',
      onClick: () => {
        if (ctx.step > 1) {
          ctx.step -= 1;
          void persist();
          render();
        }
      },
    });
    if (ctx.step === 1) back.style.visibility = 'hidden';
    foot.appendChild(back);
    foot.appendChild(
      el(`<span class="guided-count">${Math.min(ctx.step, 6)} / 6</span>`),
    );
    const canFwd = ctx.step < 7 && resolved(ctx.step - 1);
    const next = button({
      label: ctx.step >= 6 ? 'Ringkasan' : 'Seterusnya',
      variant: 'primary',
      disabled: !canFwd,
      onClick: () => {
        if (canFwd) {
          ctx.step += 1;
          void persist();
          render();
        }
      },
    });
    if (ctx.step === 7) next.style.visibility = 'hidden';
    foot.appendChild(next);
  }

  function close(keepDraft: boolean): void {
    overlay.remove();
    document.body.style.overflow = '';
    if (keepDraft) {
      toast('Audit disimpan sebagai draf — sambung bila-bila', '');
    }
  }

  q(overlay, '[data-close]').addEventListener('click', () => {
    close(true);
    onDone();
  });
  q(overlay, '[data-back]').addEventListener('click', () => {
    close(true);
    onDone();
  });

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  await persist();
  render();
  if (draft?.guidedStep && draft.guidedStep > 1) {
    toast(`⏯ Menyambung audit di langkah ${Math.min(draft.guidedStep, 6)}`, 'ok');
  }
}
