/**
 * Titik masuk app — Milestone 1: shell sahaja.
 * Skrin sebenar dibina pada Milestone 2+. Galeri komponen: /preview.html
 */
import './ui/tokens.css';
import './ui/base.css';

document.documentElement.dataset.theme = 'auto';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;">
    <div>
      <p style="font-size:19px;font-weight:800;margin:0;">Audit Aset HoSZA — v3</p>
      <p style="color:var(--muted);font-weight:600;margin:8px 0 0;">
        Dalam pembinaan (Milestone 1). Galeri komponen:
        <a href="./preview.html" style="color:var(--indigo-600);font-weight:800;">preview.html</a>
      </p>
    </div>
  </div>
`;
