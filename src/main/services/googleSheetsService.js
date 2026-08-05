const { google } = require('googleapis')
const { getAuthClient } = require('./googleAuth')

/**
 * ============================================================================
 * CAU TRUC COT CUA SHEET RIENG CHO TOOL ("Kho Video Đăng Bài")
 * ============================================================================
 * Day la sheet SACH, tao rieng cho tool nay (khong dung chung voi sheet san
 * xuat noi dung phuc tap cua nguoi dung), nen dung 4 cot dau tien don gian:
 *   A: Ten video - TOOL CHI DOC, dung lam goi y noi dung khi tao bai dang
 *   B: Link video (Google Drive) - TOOL CHI DOC
 *   C: Link ket qua sau khi dang - TOOL GHI (chi ghi neu dang trong)
 *   D: Da dang xong (tick TRUE/checkbox) - TOOL GHI (chi ghi neu dang trong/false)
 * Hang 1 = tieu de co san (KHONG tu dong ghi de). Du lieu tu hang 2.
 *
 * Neu can doi cot, sua cac hang so trong COL ben duoi (0-indexed: A=0, B=1,
 * C=2, D=3, ...).
 */
const COL = {
  NAME: 0, // A
  VIDEO_URL: 1, // B
  RESULT_URL: 2, // C
  DONE_TICK: 3 // D
}

async function getSheetsApi(keyFilePath) {
  const auth = getAuthClient(keyFilePath)
  return google.sheets({ version: 'v4', auth })
}

/**
 * Kiem tra ket noi va quyen truy cap: doc metadata cua spreadsheet, xac nhan
 * tab (sheet con) ton tai. Nem loi ro rang neu khong ket noi duoc.
 */
async function testConnection({ sheetId, tabName, keyFilePath }) {
  const sheets = await getSheetsApi(keyFilePath)
  let res
  try {
    res = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  } catch (err) {
    if (err.code === 404) throw new Error('Không tìm thấy Google Sheet với ID này. Kiểm tra lại Sheet ID.')
    if (err.code === 403) throw new Error('Không có quyền truy cập Sheet này. Kiểm tra đã Share Sheet cho đúng email Service Account chưa.')
    throw new Error(`Không kết nối được Google Sheets: ${err.message}`)
  }
  const tabExists = (res.data.sheets || []).some((s) => s.properties.title === tabName)
  if (!tabExists) {
    const available = (res.data.sheets || []).map((s) => s.properties.title).join(', ')
    throw new Error(`Không tìm thấy tab "${tabName}" trong Sheet. Các tab hiện có: ${available || '(không có)'}`)
  }
  return { spreadsheetTitle: res.data.properties.title, tabName }
}

/**
 * Doc cot A (ten), B (link video), C (link ket qua da co - de dong bo
 * nguoc lich su neu co san), D (da xong hay chua). CHI loc ra dong co link
 * video o cot B.
 */
async function readVideoRows({ sheetId, tabName, keyFilePath }) {
  const sheets = await getSheetsApi(keyFilePath)
  const range = `${tabName}!A2:D`
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range })
  const values = res.data.values || []
  return values
    .map((row, idx) => ({
      rowNumber: idx + 2,
      videoName: (row[COL.NAME] || '').trim(),
      videoUrl: (row[COL.VIDEO_URL] || '').trim(),
      resultUrl: (row[COL.RESULT_URL] || '').trim(),
      doneTick: row[COL.DONE_TICK]
    }))
    .filter((r) => r.videoUrl)
}

/**
 * Ghi ket qua vao DUNG 2 O rieng le (C{row} va D{row}) bang batchUpdate.
 */
async function writeRowResult({ sheetId, tabName, keyFilePath }, rowNumber, { resultUrl, done }) {
  const sheets = await getSheetsApi(keyFilePath)
  const data = []
  if (resultUrl !== undefined) {
    data.push({ range: `${tabName}!C${rowNumber}`, values: [[resultUrl || '']] })
  }
  if (done !== undefined) {
    data.push({ range: `${tabName}!D${rowNumber}`, values: [[!!done]] })
  }
  if (data.length === 0) return
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: 'RAW', data }
  })
}

module.exports = { testConnection, readVideoRows, writeRowResult, COL }
