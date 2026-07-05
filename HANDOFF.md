# Handoff — App Audit Aset HoSZA v3

> Dokumen ini untuk sesi Claude Code seterusnya. Baca dulu sebelum buat apa-apa.
> Kemas kini bahagian "Status" & "Seterusnya" setiap kali ada kemajuan.

## Ringkasan projek

Bina semula app audit aset Hospital Sultan Zainal Abidin (HoSZA) untuk UEM Edgenta,
dari kosong. App lama = satu fail `index.html` 2,831 baris + `app-data.js` 3.9MB +
`Code.gs`. App baru = Vite + TypeScript **vanilla (BUKAN React)**, bermodul.

- **Repo:** https://github.com/EdgentaAsset/hosza-audit (public, akaun `EdgentaAsset`)
- **Live:** https://edgentaasset.github.io/hosza-audit/ (auto-deploy tiap push, GitHub Actions)
- **Folder tempatan:** `C:\Dev\hosza-audit` (LUAR OneDrive — sengaja, elak sync node_modules)
- **Branch:** `main`

## Setup pantas (mesin baru)

```
cd C:\Dev\hosza-audit
npm install
npm run dev      # buka http://localhost:5173  (app), /preview.html (galeri komponen)
npm run build    # tsc + vite build → dist/
npm test         # vitest — mesti hijau sebelum commit
```

`gh` CLI ada di `C:\Program Files\GitHub CLI` (tak dalam PATH — tambah manual dalam PowerShell).

## Seni bina (peta fail)

```
src/
  data/
    db.ts            IndexedDB — SATU pintu storan. TIADA fallback senyap (DbUnavailableError).
                     Stores: assets(id) ppm audits(asset) photos(id) outbox(id) drafts(asset) meta
    masterImport.ts  Parser Data.xlsx KETAT (ganti build_data.py) + diff + apply. xlsx LAZY-load.
    audits.ts        AuditRecord per ASSET NO. tick/untick/saveEdits/completeGuided → dbPut+enqueue.
    drafts.ts        Draf setiap-ketukan + posisi terakhir (resume selepas app dibunuh).
    photos.ts        Kompres canvas 1600px+thumb256, simpan lokal, upload via outbox.
  sync/
    outbox.ts        Peti keluar. resetStuckSending() pada boot. seq monotonic. resit = confirmed.
    api.ts           fetch POST text/plain (elak preflight) + GET. Ganti JSONP.
    engine.ts        30s + online listener. login/logout/session/endpoint (localStorage).
  scanner/scan.ts    BarcodeDetector native → fallback ZXing (lazy).
  ui/
    tokens.css       Indigo gradient, Nunito, warna status, mod gelap. SUMBER TUNGGAL warna.
    components/       Button StatusBadge FilterChip SearchBar Progress AppHeader AssetCard
                      StepTracker BottomNav GuidedStepCard. Vanilla → HTMLElement.
    screens/
      senarai.ts      Skrin utama: boot, carian, kad batch-48, tab switcher, import xlsx.
      guided.ts       Audit berpandu 6 langkah + ringkasan + resume.
      editSheet.ts    Helaian edit medan.
      tabs.ts         Ringkasan / Aktiviti / Akaun (login sebenar).
  main.ts            Boot: openDb → resetStuckSending → mountSenarai → startSyncEngine → SW.
backend/Code.gs      Apps Script v2. doGet perlu token. Lock berskop kecil. TextFinder.
scripts/gen-icons.mjs  Jana src/ui/icons.ts dari @tabler/icons. `npm run gen:icons`.
tests/               38 ujian Vitest (fake-indexeddb). Termasuk 3 isu lapangan.
```

## 3 isu lapangan app lama — SEMUA sudah diselesaikan + ada ujian regresi

1. **Butang audit hilang ~1 min** → app ringan (data di IndexedDB, bukan 3.9MB dlm memori),
   render bahagian kecil sahaja.
2. **Keluar app → kerja hilang** → setiap ketukan dipersist (drafts.ts) + resume posisi.
   `tests/drafts.test.ts`.
3. **Upload tersekat 'sending' selamanya** → outbox + resetStuckSending pada boot.
   `tests/outbox.test.ts`.

Bila ubah kod sync/draf/audit — JANGAN pecahkan ujian ni. Ia perisai 3 isu tu.

## Keputusan penting user (jangan ubah tanpa tanya)

- **Baris berganda Data.xlsx DIKEKALKAN seadanya** (papar data sebagaimana fail). DB assets
  keyPath `id` (`asset`, `asset~2`, `asset~3`…) + index `asset`. 6,321 baris, bukan dinyahganda.
- **Vanilla TS, bukan React.** Claude Design sync dibatalkan (pilihan C). Reka bentuk skrin baru
  = mockup dalam chat, bukan prototaip Claude Design.
- **Gaya estetik:** Nunito, indigo gradient `#8b5cf6→#6d28d9`, bucu bulat besar, bayang lembut
  ungu, warna status ungu/hijau/oren/merah. Rujuk `src/ui/tokens.css`.
- **Google Sheets kekal** sebagai backend (percuma, admin biasa). Lajur Sheet sama dengan app v2.

## Status (5 Julai 2026) — TERAS PENUH SIAP & LIVE

Siap: import xlsx, senarai+carian, tick/edit, audit berpandu 6 langkah, kamera/gambar,
pengimbas QR, enjin sync, backend Code.gs v2, PWA, tab Ringkasan/Aktiviti/Akaun, login,
kebenaran v0 (tulis perlu login), mod gelap + saiz teks. 38 ujian. 11 commit.

**User sudah** siapkan backend Apps Script (Google Sheet + deploy /exec).
**Tinggal user buat:** tab Akaun → masuk URL /exec + login → import Data.xlsx → uji audit
sebenar sampai muncul di Google Sheet.

## SETERUSNYA (mula di sini) — Edaran data master berpusat

**Masalah:** sekarang SETIAP pengguna kena import Data.xlsx sendiri (master di IndexedDB
tiap peranti). Sepatutnya: Administrator upload sekali → semua peranti terima automatik.

**Rancangan (belum dimulakan, task #24):**
1. `backend/Code.gs`: action `mastersave` (simpan JSON master sebagai fail Drive, pointer
   versi dalam PropertiesService), `master` (hidang fail terkini), `masterversion` (versi je).
   Gate `mastersave` kepada administrator sahaja.
2. Pecah `masterImport.ts`: keluarkan `applyMaster`/diff/jenis ke `masterStore.ts` (TANPA xlsx)
   supaya peranti penerima tak muat pustaka Excel 335kB. Parser xlsx kekal di `masterImport.ts`
   (admin sahaja).
3. `engine.ts`: `checkMaster()` pada setiap sync — kalau versi server > versi lokal, muat turun
   & apply senyap.
4. Butang import (⬆ header + tab Akaun) → hanya nampak untuk administrator. Empty-state pengguna
   biasa: "Menunggu data dari Administrator", bukan butang import.
5. Simpan versi lama di Drive (12 versi, rollback) + delta — FASA 2b, boleh tunggu.

## Fasa 2 (belum dibina — sebut bila nak)

- Panel Administrator: jadual kebenaran Role×Modul, suis Kunci Audit, urus pengguna.
- Daftar aset baharu (aset tiada dalam master) → tab "Aset Baharu" di Sheet.
- Paparan jadual PPM (data dah ada di store `ppm`, cuma belum ada UI).
- Thumbnail viewer besar, padam gambar, konflik updatedAt, resume guided merentas peranti.

## Nota teknikal / jerat

- **tsconfig `erasableSyntaxOnly`**: JANGAN guna parameter properties (`constructor(private x)`).
  Isytihar medan berasingan.
- **PowerShell 5.1**: mesej commit here-string — JANGAN letak `"` dalam teks (argumen pecah).
  `&&`/`||` tak wujud; guna `;` atau `if ($?)`.
- **Preview browser**: `public/Data.dev.xlsx` = salinan data sebenar (gitignored). Cangkuk dev
  `window.__devImport(buf)` (DEV sahaja) untuk import tanpa klik.
- **CRLF warnings** masa git add — normal di Windows, abaikan.
- Deploy kadang gagal "Deployment failed, try again later" (sekatan GitHub) — push semula/tunggu.

## Memori projek

Fail memori auto (`~/.claude/.../memory/rebuild-plan.md`) ada ringkasan sama, dimuat setiap sesi.
Dokumen INI (dalam repo) lebih terperinci — kemas kini dua-dua bila ada perubahan besar.
