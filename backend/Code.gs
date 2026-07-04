/****************************************************************
 * Audit Aset HoSZA v3 — Backend Google Apps Script (Web App)
 *
 * Beza dengan v2 (pembaikan disengajakan):
 *  1. doGet (bacaan) pun WAJIB token aktif — tiada lagi data terbuka.
 *  2. Lock berskop kecil: hanya sekitar cari-baris + tulis-baris,
 *     bukan seluruh doPost (upload gambar tak lagi menyekat semua).
 *  3. findRow_ guna TextFinder (indeks) — bukan scan linear.
 *  4. Tiada JSONP — klien guna fetch dan baca respons terus.
 *
 * Setup: isi SHEET_ID -> Run testSetup -> Run seedAdmin (ubah password!)
 *        -> Deploy > Web app (Execute as: Me, Access: Anyone) -> salin /exec.
 ****************************************************************/

var SHEET_ID = ''; // <-- ISI: ID Google Sheet
var FOLDER_ID = ''; // (pilihan) folder Drive gambar; kosong = auto-cipta
var SHEET_NAME = 'Audit';
var TRASH_SHEET_NAME = 'Rekod Dipadam';
var FOLDER_NAME = 'HoSZA Audit Foto';
var USERS_SHEET_NAME = 'Users';

/* Lajur sama dengan app v2 — admin tak perlu belajar semula */
var HEADERS = [
  'Timestamp', 'Masa Peranti', 'ASSET NO', 'NO. UNIZA',
  'Telah Diperiksa', 'Nama Pemeriksa', 'Masa Diperiksa', 'Kaedah Audit',
  'Lokasi (edit)', 'Jenama (edit)', 'Model (edit)', 'No. Serial (edit)',
  'Pembetulan (JSON)', 'Catatan',
  'Semakan UNIZA', 'Semakan Lokasi', 'Semakan Jenis Aset', 'Semakan Spesifikasi', 'Semakan Gambar',
  'Gambar No. Aset', 'Gambar Nameplate', 'Gambar Keseluruhan',
  'Gambar Tambahan 1', 'Gambar Tambahan 2', 'Gambar Jenis Aset (Isu)',
  'User', 'Status Sync'
];
var PHOTO_HEADER = {
  aset: 'Gambar No. Aset', nameplate: 'Gambar Nameplate', keseluruhan: 'Gambar Keseluruhan',
  tambahan1: 'Gambar Tambahan 1', tambahan2: 'Gambar Tambahan 2', jenisisu: 'Gambar Jenis Aset (Isu)'
};
var USERS_HEADERS = ['Username', 'Nama', 'Role', 'Status', 'Salt', 'Hash', 'Token', 'Dicipta', 'Kemaskini'];

/* ================= POST ================= */
function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var action = body.action || '';
    var p = body.payload || {};

    if (action === 'register') return json_(handleRegister_(p));
    if (action === 'login') return json_(handleLogin_(p));
    if (action === 'logout') return json_(handleLogout_(p));
    if (action === 'whoami') return json_(handleWhoami_(p));

    if (['approve', 'reject', 'disable', 'enable', 'resetpw', 'forcelogout', 'listusers'].indexOf(action) >= 0) {
      if (!authAdmin_(p)) return json_({ ok: false, error: 'auth' });
      return json_(handleManage_(action, p));
    }

    if (action === 'upsert' || action === 'photo' || action === 'delete') {
      var u = authWriter_(p);
      if (!u) return json_({ ok: false, error: 'auth' });
      p._user = u;
      if (action === 'photo') return json_(handlePhoto_(p));
      if (action === 'delete') return json_(handleDelete_(p));
      return json_(handleUpsert_(p));
    }
    return json_({ ok: false, error: 'unknown-action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ================= GET (bacaan — WAJIB token aktif) ================= */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    var f = userByToken_(p.token);
    if (!f || f.obj.Status !== 'active') return json_({ ok: false, error: 'auth' });
    var action = p.action || 'all';
    if (action === 'get') {
      var row = findRowObject_(p.asset || '');
      return json_({ ok: true, found: !!row, asset: p.asset, row: row || null });
    }
    return json_({ ok: true, rows: getAllObjects_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ================= Handlers ================= */
function handleUpsert_(p) {
  var assetNo = String(p.asset || '').trim();
  if (!assetNo) return { ok: false, error: 'no-asset' };
  var who = (p._user && p._user.Nama) || '';
  var edits = p.edits || {};
  var sem = p.semakan || {};
  var rowVals = [
    new Date(), p.deviceTime || '', assetNo, p.uniza || '',
    p.checked ? 'Ya' : '', p.checked ? who : '', p.checked ? (p.checkedAt || '') : '',
    p.method || '',
    edits.locno || '', edits.brand || '', edits.model || '', edits.serial || '',
    Object.keys(edits).length ? JSON.stringify(edits) : '', p.note || '',
    sem.uniza || '', sem.lokasi || '', sem.jenis || '', sem.spec || '', sem.gambar || '',
    '', '', '', '', '', '', who, 'Disahkan'
  ];

  // Lock BERSKOP: hanya cari-baris + tulis (bukan seluruh permintaan)
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var rowIndex = findRow_(sheet, assetNo);
    if (rowIndex > 0) {
      var existing = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
      for (var c = 19; c <= 24; c++) rowVals[c] = existing[c]; // gambar: hanya action photo
      for (var s = 14; s <= 18; s++) if (!rowVals[s] && existing[s]) rowVals[s] = existing[s];
      if (!rowVals[7] && existing[7]) rowVals[7] = existing[7];
      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([rowVals]);
    } else {
      sheet.appendRow(rowVals);
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, asset: assetNo };
}

function handlePhoto_(p) {
  var assetNo = String(p.asset || '').trim();
  var colName = PHOTO_HEADER[p.kind];
  if (!assetNo || !colName) return { ok: false, error: 'bad-kind' };
  var col1 = HEADERS.indexOf(colName) + 1;

  var url = '';
  if (!p.tiada && !p.remove) {
    if (!p.dataB64) return { ok: false, error: 'no-data' };
    // Upload Drive DI LUAR lock — bahagian paling lambat tak menyekat orang lain
    var blob = Utilities.newBlob(Utilities.base64Decode(p.dataB64), p.mimeType || 'image/jpeg',
      p.filename || (assetNo + '_' + p.kind + '.jpg'));
    var file = getFolder_().createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
    url = file.getUrl();
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var rowIndex = findRow_(sheet, assetNo);
    if (rowIndex < 1) {
      var blank = HEADERS.map(function () { return ''; });
      blank[0] = new Date(); blank[2] = assetNo;
      blank[25] = (p._user && p._user.Nama) || ''; blank[26] = 'Disahkan';
      sheet.appendRow(blank);
      rowIndex = sheet.getLastRow();
    }
    sheet.getRange(rowIndex, col1).setValue(p.tiada ? 'TIADA' : p.remove ? '' : url);
    sheet.getRange(rowIndex, 1).setValue(new Date());
  } finally {
    lock.releaseLock();
  }
  return { ok: true, asset: assetNo, kind: p.kind, url: url };
}

function handleDelete_(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    var rowIndex = findRow_(sheet, String(p.asset || '').trim());
    if (rowIndex > 0) {
      var rowVals = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
      getTrashSheet_().appendRow(rowVals.concat([(p._user && p._user.Nama) || '', new Date()]));
      sheet.deleteRow(rowIndex);
      return { ok: true, deleted: true };
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, deleted: false };
}

/* ================= Helpers ================= */
function ss_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

function sheetWithHeaders_(name, headers) {
  var sheet = ss_().getSheetByName(name);
  if (!sheet) sheet = ss_().insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function getSheet_() { return sheetWithHeaders_(SHEET_NAME, HEADERS); }
function getTrashSheet_() { return sheetWithHeaders_(TRASH_SHEET_NAME, HEADERS.concat(['Dipadam Oleh', 'Masa Dipadam'])); }
function getUsersSheet_() { return sheetWithHeaders_(USERS_SHEET_NAME, USERS_HEADERS); }

function getFolder_() {
  if (FOLDER_ID) { try { return DriveApp.getFolderById(FOLDER_ID); } catch (e) {} }
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

/* TextFinder pada lajur C sahaja — pantas walau ribuan baris */
function findRow_(sheet, assetNo) {
  if (sheet.getLastRow() < 2) return -1;
  var found = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1)
    .createTextFinder(assetNo).matchEntireCell(true).matchCase(false).findNext();
  return found ? found.getRow() : -1;
}

function rowToObject_(vals) {
  var o = {};
  for (var i = 0; i < HEADERS.length; i++) o[HEADERS[i]] = vals[i];
  o.asset = vals[2]; o.uniza = vals[3]; o.checked = vals[4] === 'Ya'; o.method = vals[7];
  o.semakan = { uniza: vals[14], lokasi: vals[15], jenis: vals[16], spec: vals[17], gambar: vals[18] };
  o.photos = { aset: vals[19], nameplate: vals[20], keseluruhan: vals[21], tambahan1: vals[22], tambahan2: vals[23], jenisisu: vals[24] };
  o.user = vals[25];
  return o;
}

function findRowObject_(assetNo) {
  var sheet = getSheet_();
  var r = findRow_(sheet, assetNo);
  if (r < 1) return null;
  return rowToObject_(sheet.getRange(r, 1, 1, HEADERS.length).getValues()[0]);
}

function getAllObjects_() {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, HEADERS.length).getValues().map(rowToObject_);
}

/* ================= Auth (sama seperti v2 — terbukti) ================= */
function userRowToObj_(v) { return { Username: v[0], Nama: v[1], Role: v[2], Status: v[3], Salt: v[4], Hash: v[5], Token: v[6] }; }

function findUserRow_(sheet, username) {
  if (sheet.getLastRow() < 2) return -1;
  var col = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var t = String(username).trim().toLowerCase();
  for (var i = 0; i < col.length; i++) if (String(col[i][0]).trim().toLowerCase() === t) return i + 2;
  return -1;
}

function userByToken_(token) {
  if (!token) return null;
  var sheet = getUsersSheet_();
  if (sheet.getLastRow() < 2) return null;
  var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, USERS_HEADERS.length).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][6] !== '' && String(vals[i][6]) === String(token)) return { row: i + 2, obj: userRowToObj_(vals[i]) };
  }
  return null;
}

function sha256Hex_(s) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < raw.length; i++) { var b = (raw[i] + 256) % 256; hex += (b < 16 ? '0' : '') + b.toString(16); }
  return hex;
}
function randSalt_() { return Utilities.getUuid().replace(/-/g, ''); }
function randToken_() { return Utilities.getUuid() + Utilities.getUuid().slice(0, 8); }
function hashPw_(salt, pw) { return sha256Hex_(String(salt) + String(pw)); }

function authWriter_(p) {
  var f = userByToken_(p && p.token);
  if (!f) return null;
  var o = f.obj;
  if (o.Status !== 'active') return null;
  if (o.Role !== 'admin' && o.Role !== 'administrator') return null;
  return o;
}
function authAdmin_(p) { var u = authWriter_(p); return u && u.Role === 'administrator' ? u : null; }

function handleRegister_(p) {
  var username = String(p.username || '').trim(), name = String(p.name || '').trim(), pw = String(p.password || '');
  if (!username || !name || !pw) return { ok: false, error: 'lengkap' };
  var sheet = getUsersSheet_();
  if (findUserRow_(sheet, username) > 0) return { ok: false, error: 'username-wujud' };
  var salt = randSalt_(), now = new Date();
  sheet.appendRow([username, name, 'admin', 'pending', salt, hashPw_(salt, pw), '', now, now]);
  return { ok: true };
}

function handleLogin_(p) {
  var username = String(p.username || '').trim(), pw = String(p.password || '');
  if (!username || !pw) return { ok: false, error: 'lengkap' };
  var sheet = getUsersSheet_();
  var r = findUserRow_(sheet, username);
  if (r < 1) return { ok: false, error: 'no-user' };
  var o = userRowToObj_(sheet.getRange(r, 1, 1, USERS_HEADERS.length).getValues()[0]);
  if (o.Status === 'disabled') return { ok: false, error: 'disabled' };
  if (hashPw_(o.Salt, pw) !== o.Hash) return { ok: false, error: 'salah' };
  var token = randToken_();
  sheet.getRange(r, 7).setValue(token);
  sheet.getRange(r, 9).setValue(new Date());
  return { ok: true, token: token, role: o.Role, name: o.Nama, status: o.Status, username: o.Username };
}

function handleLogout_(p) {
  var f = userByToken_(p && p.token);
  if (f) getUsersSheet_().getRange(f.row, 7).setValue('');
  return { ok: true };
}

function handleWhoami_(p) {
  var f = userByToken_(p && p.token);
  if (!f || f.obj.Status === 'disabled') return { ok: false, error: 'auth' };
  return { ok: true, role: f.obj.Role, status: f.obj.Status, name: f.obj.Nama, username: f.obj.Username };
}

function handleManage_(action, p) {
  var sheet = getUsersSheet_();
  if (action === 'listusers') {
    if (sheet.getLastRow() < 2) return { ok: true, users: [] };
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, USERS_HEADERS.length).getValues();
    return { ok: true, users: vals.map(function (v) { return { username: v[0], name: v[1], role: v[2], status: v[3], hasToken: v[6] !== '' }; }) };
  }
  var username = String(p.username || '').trim();
  var r = findUserRow_(sheet, username);
  if (r < 1) return { ok: false, error: 'no-user' };
  if (action === 'approve' || action === 'enable') sheet.getRange(r, 4).setValue('active');
  else if (action === 'reject' || action === 'disable') { sheet.getRange(r, 4).setValue('disabled'); sheet.getRange(r, 7).setValue(''); }
  else if (action === 'forcelogout') sheet.getRange(r, 7).setValue('');
  else if (action === 'resetpw') {
    var np = String(p.newPassword || '');
    if (!np) return { ok: false, error: 'no-pw' };
    var salt = randSalt_();
    sheet.getRange(r, 5).setValue(salt);
    sheet.getRange(r, 6).setValue(hashPw_(salt, np));
    sheet.getRange(r, 7).setValue('');
  } else return { ok: false, error: 'unknown-manage' };
  sheet.getRange(r, 9).setValue(new Date());
  return { ok: true, username: username };
}

/* Run sekali dari editor — TUKAR password sebelum run! */
function seedAdmin() {
  var SEED_USER = 'admin', SEED_PASS = 'ubah-saya-segera', SEED_NAME = 'Administrator';
  var sheet = getUsersSheet_();
  if (findUserRow_(sheet, SEED_USER) > 0) { Logger.log('Sudah wujud: ' + SEED_USER); return; }
  var salt = randSalt_(), now = new Date();
  sheet.appendRow([SEED_USER, SEED_NAME, 'administrator', 'active', salt, hashPw_(salt, SEED_PASS), '', now, now]);
  Logger.log('Administrator dicipta: ' + SEED_USER);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function testSetup() {
  Logger.log('Audit: ' + getSheet_().getName() + ' | Users: ' + getUsersSheet_().getName() + ' | Folder: ' + getFolder_().getName());
}
