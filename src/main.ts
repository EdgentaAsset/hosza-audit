/**
 * Titik masuk app.
 * Boot: buka storan (gagal = amaran besar, TIADA fallback senyap) →
 * pulihkan hantaran tersekat → lukis skrin senarai.
 */
import './ui/tokens.css';
import './ui/base.css';
import { DbUnavailableError, openDb } from './data/db';
import { resetStuckSending } from './sync/outbox';
import { startSyncEngine } from './sync/engine';
import { mountSenarai } from './ui/screens/senarai';
import { toast } from './ui/toast';

document.documentElement.dataset.theme = 'auto';

const app = document.querySelector<HTMLDivElement>('#app')!;

function showDbError(e: unknown): void {
  const msg =
    e instanceof DbUnavailableError
      ? e.message
      : 'Storan peranti gagal dibuka — audit tidak akan disimpan.';
  app.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div style="max-width:420px;text-align:center;background:var(--st-issue-bg);border:1.5px solid var(--st-issue-line);border-radius:var(--r-card);padding:28px 22px;">
        <p style="font-size:34px;margin:0;">⚠️</p>
        <p style="font-size:17px;font-weight:800;margin:10px 0 6px;color:var(--st-issue);">Storan peranti bermasalah</p>
        <p style="font-size:13.5px;font-weight:600;color:var(--ink-soft);line-height:1.6;margin:0;">${msg}</p>
        <button style="margin-top:18px;height:46px;padding:0 22px;border-radius:15px;background:var(--st-issue);color:#fff;font-weight:800;font-size:14px;"
          onclick="location.reload()">Cuba semula</button>
      </div>
    </div>
  `;
}

(async function boot() {
  try {
    await openDb();
  } catch (e) {
    showDbError(e);
    return;
  }
  // Isu lapangan #3: rekod tersekat 'sending' dipulihkan SETIAP boot.
  const restored = await resetStuckSending();
  if (restored > 0) toast(`⟳ ${restored} hantaran tersekat dipulihkan — akan dihantar semula`, 'ok');

  await mountSenarai(app);
  startSyncEngine();
})();
