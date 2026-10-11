/**
 * わんこ大戦争 - 引き継ぎコードのクラウド保存（Googleスプレッドシート + GAS）
 *
 * セットアップ手順は同じフォルダの README.md を参照。
 * このスクリプトを紐づけたスプレッドシートの「SaveCodes」シートに、
 * key（合言葉）/ name（セーブデータの名前）/ code（引き継ぎコード本体）/ updatedAt の4列で保存する。
 *
 * 認証なしの素朴な「合言葉」方式。合言葉を知っている人なら誰でも読み書きできるので、
 * ゲームのセーブデータ以外（個人情報・機密情報など）には絶対に使わないこと。
 */

const SHEET_NAME = 'SaveCodes';
const HEADER = ['key', 'name', 'code', 'updatedAt'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADER);
  }
  return sheet;
}

// 合言葉(key)に一致する行番号（1始まり、見つからなければ-1）を返す
function findRowByKey_(sheet, key) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) return i + 2;
  }
  return -1;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 読み込み：GET <web app URL>?key=合言葉
function doGet(e) {
  const key = String((e && e.parameter && e.parameter.key) || '').trim();
  if (!key) return jsonOutput_({ ok: false, error: 'missing_key' });

  const sheet = getSheet_();
  const row = findRowByKey_(sheet, key);
  if (row < 0) return jsonOutput_({ ok: false, error: 'not_found' });

  const values = sheet.getRange(row, 1, 1, 4).getValues()[0];
  return jsonOutput_({ ok: true, key: values[0], name: values[1], code: values[2], updatedAt: values[3] });
}

// 保存：POST <web app URL>  body（text/plain）: { "key": "...", "name": "...", "code": "..." }
// 同じ合言葉が既にあれば上書き、なければ新しい行を追加する。
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'invalid_json' });
  }

  const key = String(payload.key || '').trim();
  const name = String(payload.name || '');
  const code = String(payload.code || '');
  if (!key || !code) return jsonOutput_({ ok: false, error: 'missing_params' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const row = findRowByKey_(sheet, key);
    const updatedAt = new Date().toISOString();
    if (row > 0) {
      sheet.getRange(row, 2, 1, 3).setValues([[name, code, updatedAt]]);
    } else {
      sheet.appendRow([key, name, code, updatedAt]);
    }
    return jsonOutput_({ ok: true, updatedAt });
  } finally {
    lock.releaseLock();
  }
}
