# Audit Aset HoSZA — v3

App audit aset (PWA, mobile-first) untuk Hospital Sultan Zainal Abidin — UEM Edgenta.
Rebuild penuh daripada app v2 (satu fail HTML) kepada seni bina modular.

## Stack

- **Vite + TypeScript** (vanilla, tiada framework) — output static, host di GitHub Pages
- **IndexedDB** — data master & audit disimpan dalam peranti (offline-first)
- **Google Apps Script + Google Sheet** — backend pusat (audit, auth, gambar)
- **@zxing/browser** — imbas QR/barcode (fallback untuk BarcodeDetector)
- **SheetJS (xlsx)** — Administrator upload Data.xlsx terus dalam app

## Struktur

```
src/
  ui/          tokens.css, icons.ts, komponen (AssetCard, StepTracker, ...)
  data/        IndexedDB, data master, delta sync
  sync/        outbox pattern, pull, sahkan-baca-balik
  scanner/     BarcodeDetector + ZXing
  auth/        sesi, token, peranan
  permissions/ sistem kebenaran boleh-konfigurasi
backend/       Code.gs (Apps Script)
scripts/       gen-icons.mjs
```

## Perintah

```bash
npm run dev        # dev server (app: /, galeri komponen: /preview.html)
npm run build      # build produksi ke dist/
npm run test       # ujian Vitest
npm run gen:icons  # jana semula src/ui/icons.ts dari @tabler/icons
```

## Panduan gaya

Nunito · aksen indigo gradient (#8b5cf6 → #6d28d9) · bucu bulat (kad 22px) ·
bayang lembut ungu · warna status: ungu = belum diaudit, hijau = selesai,
oren = menunggu sync, merah = bermasalah. Rujuk `src/ui/tokens.css`.
