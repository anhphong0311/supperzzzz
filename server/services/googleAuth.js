const { google } = require('googleapis')

// Dung 1 Service Account CHUNG, luu tren server (bien moi truong
// GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 = noi dung file JSON key, ma hoa base64
// de an toan khi dan vao o Environment Variable) - khong con phat file key
// nay cho tung may nhan vien nua, tranh moi nguoi deu cam 1 ban co quyen
// doc/ghi Sheet + Drive.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly']

let cachedAuth = null

function getAuthClient() {
  if (cachedAuth) return cachedAuth
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_BASE64
  if (!b64) throw new Error('Server chưa cấu hình GOOGLE_SERVICE_ACCOUNT_KEY_BASE64.')
  let credentials
  try {
    credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  } catch (err) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 không phải JSON hợp lệ sau khi giải mã base64.')
  }
  cachedAuth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES })
  return cachedAuth
}

module.exports = { getAuthClient, SCOPES }
