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
    masterImport.ts  Parser Data.xlsx KETAT (ganti build_data.py). xlsx LAZY-load (admin sahaja).
    masterStore.ts   Jenis + diff + applyMaster TANPA xlsx — peranti penerima edaran guna ini.
    audits.ts        AuditRecord per ASSET NO. tick/untick/saveEdits/completeGuided → dbPut+enqueue.
    drafts.ts        Draf setiap-ketukan + posisi terakhir (resume selepas app dibunuh).
    photos.ts        Kompres canvas 1600px+thumb256, simpan lokal, upload via outbox.
  sync/
    outbox.ts        Peti keluar. resetStuckSending() pada boot. seq monotonic. resit = confirmed.
    api.ts           fetch POST text/plain (elak preflight) + GET. Ganti JSONP.
    engine.ts        30s + online listener. login/logout/session/endpoint (localStorage).
                     checkMaster() setiap sync (edaran master) + pushMaster() (admin).
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

## Status (5 Julai 2026) — TERAS PENUH SIAP & LIVE + EDARAN MASTER BERPUSAT

Siap: import xlsx, senarai+carian, tick/edit, audit berpandu 6 langkah, kamera/gambar,
pengimbas QR, enjin sync, backend Code.gs v2, PWA, tab Ringkasan/Aktiviti/Akaun, login,
kebenaran v0 (tulis perlu login), mod gelap + saiz teks, **edaran master berpusat**. 45 ujian.

**Edaran master berpusat (task #24 — SIAP):**
- `Code.gs`: `mastersave` (POST, administrator sahaja — JSON master → fail Drive folder
  "HoSZA Master Data", pointer MASTER_VERSION/MASTER_FILE_ID dalam PropertiesService;
  fail versi lama TAK dipadam = rollback manual), `masterversion` + `master` (GET bertoken).
- `masterStore.ts` (baru): jenis+diff+apply tanpa xlsx; `masterImport.ts` re-export (parser
  xlsx kekal lazy 334kB, main chunk 39kB).
- `engine.ts`: `checkMaster()` dipanggil pada setiap `syncNow` — versi server > lokal
  (banding rentetan YYYYMMDDHHmm) → muat turun & apply senyap + event `hosza:sync`.
  `pushMaster()` dipanggil selepas Administrator import xlsx (toast berjaya/gagal).
- UI: butang import (header + tab Akaun) hanya administrator; empty-state pengguna biasa
  = "Menunggu data dari Administrator" + butang "Semak sekarang" (panggil checkMaster).
- Ujian: `tests/masterDistribution.test.ts` (7 ujian — apply versi baru, skip versi sama,
  offline, tiada sesi, pushMaster).

**Tinggal user buat:**
1. **Salin `backend/Code.gs` baharu ke Apps Script + DEPLOY SEMULA** (New deployment /
   manage deployments → edit → version baru — kod lama tak ada action master*).
2. Tab Akaun → login sebagai administrator → import Data.xlsx → sahkan toast
   "Master diedarkan" → login peranti/browser lain sebagai admin biasa → data muncul
   automatik (≤30s atau butang Semak sekarang).

## SETERUSNYA — pilih dari Fasa 2, atau Fasa 2b edaran

Fasa 2b edaran (sambungan task #24, bila perlu): had 12 versi + UI rollback + delta
(sekarang muat turun penuh ~1-3MB setiap kemas kini master — ok untuk mingguan/bulanan).

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
