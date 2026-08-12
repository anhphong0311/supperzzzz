const { google } = require('googleapis')
const { getAuthClient } = require('./googleAuth')

// Cau truc cot giong het ban cuc bo cu (src/main/services/googleSheetsService.js):
//   A: Ten video (chi doc) | B: Link video Drive (chi doc)
//   C: Link ket qua (server ghi) | D: Da dang xong - tick (server ghi)
const COL = { NAME: 0, VIDEO_URL: 1, RESULT_URL: 2, DONE_TICK: 3 }

function getConfig() {
  const sheetId = process.env.GOOGLE_SHEET_ID
  const tabName = (process.env.GOOGLE_SHEET_TAB_NAME || 'Sheet1').trim()
  if (!sheetId) {
    // Log chan doan tam thoi - de xem trong Render Logs xem bien co that su
    // vang mat hay chi la 1 loi khac bi bao nham thanh loi nay.
    console.error(
      'GOOGLE_SHEET_ID rong. Cac bien GOOGLE_* server thay duoc:',
      Object.keys(process.env).filter((k) => k.startsWith('GOOGLE_')),
      'do dai GOOGLE_SHEET_ID:', sheetId ? sheetId.length : 0
    )
    throw new Error('Server chưa cấu hình GOOGLE_SHEET_ID.')
  }
  return { sheetId, tabName }
}

async function getSheetsApi() {
  const auth = getAuthClient()
  return google.sheets({ version: 'v4', auth })
}

async function getStatus() {
  const { sheetId, tabName } = getConfig()
  const sheets = await getSheetsApi()
  let res
  try {
    res = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
  } catch (err) {
    if (err.code === 404) throw new Error('Không tìm thấy Google Sheet với ID đã cấu hình trên server.')
    if (err.code === 403) throw new Error('Server chưa được Share quyền truy cập Sheet này (email Service Account).')
    throw new Error(`Không kết nối được Google Sheets: ${err.message}`)
  }
  const tabExists = (res.data.sheets || []).some((s) => s.properties.title === tabName)
  if (!tabExists) {
    const available = (res.data.sheets || []).map((s) => s.properties.title).join(', ')
    throw new Error(`Không tìm thấy tab "${tabName}" trong Sheet. Các tab hiện có: ${available || '(không có)'}`)
  }
  return { spreadsheetTitle: res.data.properties.title, tabName }
}

async function readVideoRows() {
  const { sheetId, tabName } = getConfig()
  const sheets = await getSheetsApi()
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

async function writeRowResult(rowNumber, { resultUrl, done }) {
  const { sheetId, tabName } = getConfig()
  const sheets = await getSheetsApi()
  const data = []
  if (resultUrl !== undefined) data.push({ range: `${tabName}!C${rowNumber}`, values: [[resultUrl || '']] })
  if (done !== undefined) data.push({ range: `${tabName}!D${rowNumber}`, values: [[!!done]] })
  if (data.length === 0) return
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: { valueInputOption: 'RAW', data }
  })
}

module.exports = { getStatus, readVideoRows, writeRowResult }
