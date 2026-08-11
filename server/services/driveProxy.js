const { google } = require('googleapis')
const { getAuthClient } = require('./googleAuth')

function extractFileId(driveUrl) {
  if (!driveUrl) return null
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/]
  for (const re of patterns) {
    const m = driveUrl.match(re)
    if (m) return m[1]
  }
  return null
}

async function getDriveApi() {
  const auth = getAuthClient()
  return google.drive({ version: 'v3', auth })
}

/**
 * Lay metadata + 1 stream doc file video tu Drive, dung Service Account
 * CHUNG cua server (nhan vien khong can biet gi ve key nay). Goi ham
 * response.data.pipe(res) o route de chuyen tiep truc tiep byte cho client,
 * khong buffer ca file vao bo nho server (tranh tran RAM tren goi mien phi).
 */
async function openVideoStream(driveUrl) {
  const fileId = extractFileId(driveUrl)
  if (!fileId) throw new Error(`Không đọc được ID file từ link Drive: ${driveUrl}`)

  const drive = await getDriveApi()

  let meta
  try {
    meta = await drive.files.get({ fileId, fields: 'id, name, mimeType, size' })
  } catch (err) {
    if (err.code === 404) throw new Error('Không tìm thấy file trên Google Drive.')
    if (err.code === 403) throw new Error('Server chưa được chia sẻ quyền truy cập file này trên Drive.')
    throw new Error(`Không lấy được thông tin file trên Drive: ${err.message}`)
  }

  const stream = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })
  return {
    stream: stream.data,
    fileName: meta.data.name || `${fileId}.mp4`,
    mimeType: meta.data.mimeType || 'application/octet-stream',
    size: meta.data.size
  }
}

module.exports = { extractFileId, openVideoStream }
