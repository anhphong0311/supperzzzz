const { google } = require('googleapis')

/**
 * Dung chung 1 Service Account (file khoa JSON) cho ca Google Sheets va
 * Google Drive - xem README muc "Ket noi Google Sheets" de biet cach tao.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly'
]

function getAuthClient(keyFilePath) {
  if (!keyFilePath || !keyFilePath.trim()) {
    throw new Error('Chưa cấu hình đường dẫn file khoá Service Account (JSON). Vào Cài đặt để thêm.')
  }
  return new google.auth.GoogleAuth({ keyFile: keyFilePath, scopes: SCOPES })
}

module.exports = { getAuthClient, SCOPES }
