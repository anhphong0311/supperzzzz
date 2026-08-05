const fs = require('fs')
const path = require('path')
const { google } = require('googleapis')
const { getAuthClient } = require('./googleAuth')

/**
 * Trich file ID tu cac dinh dang link Google Drive pho bien:
 *   https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *   https://drive.google.com/open?id=FILE_ID
 *   https://drive.google.com/uc?id=FILE_ID&export=download
 *   https://drive.google.com/uc?export=download&id=FILE_ID
 */
function extractFileId(driveUrl) {
  if (!driveUrl) return null
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/
  ]
  for (const re of patterns) {
    const m = driveUrl.match(re)
    if (m) return m[1]
  }
  return null
}

async function getDriveApi(keyFilePath) {
  const auth = getAuthClient(keyFilePath)
  return google.drive({ version: 'v3', auth })
}

/**
 * Tai 1 file video tu Google Drive ve thu muc tam, tra ve duong dan file
 * cuc bo. File Drive PHAI duoc chia se cho email Service Account (hoac bat
 * "Anyone with the link"), neu khong se loi 403/404.
 */
async function downloadVideo({ keyFilePath, driveUrl, destDir, timeoutMs = 300000 }) {
  const fileId = extractFileId(driveUrl)
  if (!fileId) {
    throw new Error(`Không đọc được ID file từ link Drive: ${driveUrl}`)
  }

  const drive = await getDriveApi(keyFilePath)

  let meta
  try {
    meta = await drive.files.get({ fileId, fields: 'id, name, mimeType, size' })
  } catch (err) {
    if (err.code === 404) throw new Error('Không tìm thấy file trên Google Drive (kiểm tra lại link hoặc quyền chia sẻ).')
    if (err.code === 403) throw new Error('Không có quyền tải file này. Cần chia sẻ file/thư mục cho email Service Account hoặc bật "Anyone with the link".')
    throw new Error(`Không lấy được thông tin file trên Drive: ${err.message}`)
  }

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  const safeName = (meta.data.name || fileId).replace(/[\\/:*?"<>|]/g, '_')
  const destPath = path.join(destDir, `${Date.now()}-${safeName}`)

  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' })

  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(destPath)
    const timer = setTimeout(() => {
      dest.destroy()
      reject(new Error('Tải video quá thời gian chờ (video quá lớn hoặc mạng chậm).'))
    }, timeoutMs)

    res.data
      .on('end', () => {
        clearTimeout(timer)
        resolve()
      })
      .on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`Tải video thất bại: ${err.message}`))
      })
      .pipe(dest)
  })

  return { localPath: destPath, fileName: meta.data.name, mimeType: meta.data.mimeType, size: meta.data.size }
}

module.exports = { extractFileId, downloadVideo }
