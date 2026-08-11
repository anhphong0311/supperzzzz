const fs = require('fs')
const path = require('path')
const { getDb, getDataDir } = require('../db/database')
const settingsService = require('./settingsService')
const serverClient = require('./serverClient')
const accountService = require('./accountService')
const browserManager = require('../automation/browserManager')
const tiktokAutomation = require('../automation/tiktokAutomation')

// Dong bo Google Sheet/Drive gio di qua may chu trung tam (server/routes/sheets.js)
// - server giu 1 Service Account CHUNG, khong con moi may tu cau hinh Sheet
// ID/file khoa rieng nua (xem plan doi cho tinh nang nay).

function nowIso() {
  return new Date().toISOString()
}

function list() {
  const db = getDb()
  return db.prepare('SELECT * FROM video_library ORDER BY sheet_row_number ASC').all()
}

function get(id) {
  const db = getDb()
  return db.prepare('SELECT * FROM video_library WHERE id = ?').get(id)
}

function testConnection() {
  return serverClient.apiFetch('/api/sheets/status', { auth: true })
}

/**
 * Dong bo tu Google Sheet ve bang video_library noi bo.
 * - Cot dau vao (C = ten video -> caption_hint, H = link video) luon duoc
 *   cap nhat moi lan dong bo.
 * - Cot ket qua (I = link, K = da xong) CHI duoc doc 1 CHIEU DE BACKFILL khi
 *   video do CHUA co facebook_post_url trong DB noi bo (vi du: cai lai tool,
 *   mat du lieu cuc bo nhung sheet da co san lich su) - khong ghi de len
 *   tien trinh dang dang xu ly trong DB.
 */
async function syncFromSheet() {
  const rows = await serverClient.apiFetch('/api/sheets/videos', { auth: true })

  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO video_library (sheet_row_number, video_url, caption_hint, synced_at, updated_at)
    VALUES (@sheet_row_number, @video_url, @caption_hint, @synced_at, @synced_at)
    ON CONFLICT(sheet_row_number) DO UPDATE SET
      video_url = excluded.video_url,
      caption_hint = excluded.caption_hint,
      synced_at = excluded.synced_at,
      updated_at = excluded.synced_at
  `)
  const backfillResult = db.prepare(`
    UPDATE video_library
    SET facebook_post_url = @result_url, status = 'DA_DANG', posted_at = COALESCE(posted_at, @synced_at), updated_at = @synced_at
    WHERE sheet_row_number = @sheet_row_number AND facebook_post_url IS NULL
  `)

  const tx = db.transaction((list) => {
    list.forEach((r) => {
      const synced_at = nowIso()
      upsert.run({
        sheet_row_number: r.rowNumber,
        video_url: r.videoUrl,
        caption_hint: r.videoName,
        synced_at
      })
      if (r.resultUrl) {
        backfillResult.run({ sheet_row_number: r.rowNumber, result_url: r.resultUrl, synced_at })
      }
    })
  })
  tx(rows)

  return { syncedCount: rows.length }
}

function updateRow(id, data) {
  const db = getDb()
  const current = get(id)
  if (!current) throw new Error(`Không tìm thấy video id=${id}`)
  const merged = { ...current, ...data, id, updated_at: nowIso() }
  db.prepare(`
    UPDATE video_library SET
      status = @status,
      local_file_path = @local_file_path,
      facebook_post_url = @facebook_post_url,
      instagram_post_url = @instagram_post_url,
      threads_post_url = @threads_post_url,
      tiktok_post_url = @tiktok_post_url,
      error_message = @error_message,
      posted_at = @posted_at,
      updated_at = @updated_at
    WHERE id = @id
  `).run(merged)
  return get(id)
}

/**
 * Tai video ve may (tu Google Drive) de co the dinh kem khi dang bai. Cap
 * nhat trang thai DANG_TAI -> DA_TAI hoac LOI.
 */
async function downloadVideo(id) {
  const video = get(id)
  if (!video) throw new Error(`Không tìm thấy video id=${id}`)

  updateRow(id, { status: 'DANG_TAI', error_message: null })
  try {
    const settings = settingsService.getAll()
    const destDir = path.join(getDataDir(), 'video-downloads')
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
    // Chua biet ten file that (server tra ve qua header Content-Disposition
    // SAU khi tai xong) nen tai tam vao 1 duong dan roi doi ten lai.
    const tempPath = path.join(destDir, `${Date.now()}-tmp`)
    const downloadPath = `/api/sheets/download?url=${encodeURIComponent(video.video_url)}`
    const result = await serverClient.downloadToFile(downloadPath, tempPath, {
      timeoutMs: Number(settings.video_download_timeout_ms || 300000)
    })
    const safeName = (result.fileName || `${id}.mp4`).replace(/[\\/:*?"<>|]/g, '_')
    const finalPath = path.join(destDir, `${Date.now()}-${safeName}`)
    fs.renameSync(tempPath, finalPath)
    return updateRow(id, { status: 'DA_TAI', local_file_path: finalPath })
  } catch (err) {
    updateRow(id, { status: 'LOI', error_message: err.message })
    throw err
  }
}

/**
 * Mo dung Chrome Profile cua 1 tai khoan, vao trang "Quan ly bai dang" cua
 * TikTok Studio de lay link that cua video MOI NHAT, roi luu lai vao
 * video_library.tiktok_post_url. Dung khi bai da dang tu truoc (vi du dang
 * truoc khi tinh nang lay link nay ton tai) nen chua co san link.
 */
async function fetchTiktokLink(id, accountId) {
  const video = get(id)
  if (!video) throw new Error(`Không tìm thấy video id=${id}`)
  const account = accountService.get(accountId)
  if (!account) throw new Error('Không tìm thấy tài khoản.')
  const settings = settingsService.getAll()
  const headless = String(settings.headless_mode) === 'true'
  const context = await browserManager.launchProfile(account.browser_profile_path, { headless })
  try {
    const page = context.pages()[0] || (await context.newPage())
    const url = await tiktokAutomation.tryFetchLatestPostUrl(page, () => {})
    if (url) updateRow(id, { tiktok_post_url: url })
    return { postUrl: url }
  } finally {
    await context.close().catch(() => {})
  }
}

/**
 * Ghi lai link ket qua (cot I) va tick da xong (cot K) nguoc ve dung dong
 * tren Google Sheet - CHI 2 o nay, khong dung toi cot nao khac.
 */
async function writeBackToSheet(id) {
  const video = get(id)
  if (!video) throw new Error(`Không tìm thấy video id=${id}`)
  const resultUrl = video.facebook_post_url || video.instagram_post_url || video.threads_post_url || video.tiktok_post_url || ''
  // KHONG duoc dung "co resultUrl hay khong" de tinh done - TikTok (khac
  // Facebook) khong lay duoc link bai dang tu dong nen tiktok_post_url luon
  // rong ke ca khi da dang thanh cong that, se khien cot "Da dang" tren
  // Sheet luon bao FALSE sai. Dung thang trang thai da luu trong DB.
  const done = video.status === 'DA_DANG'
  await serverClient.apiFetch(`/api/sheets/videos/${video.sheet_row_number}/result`, {
    method: 'POST',
    body: { resultUrl, done },
    auth: true
  })
  return true
}

/**
 * Cap nhat ket qua dang bai cho 1 nen tang cu the (hien tai chi Facebook o
 * Giai doan 1) - dung de tu dong noi ket qua tu man hinh Tao bai dang
 * (khi bai duoc tao tu 1 video trong Kho video) ve lai video_library.
 */
const PLATFORM_URL_FIELD = {
  facebook: 'facebook_post_url',
  instagram: 'instagram_post_url',
  threads: 'threads_post_url',
  tiktok: 'tiktok_post_url'
}

function markPlatformResult(id, platform, { success, url, errorMessage }) {
  const urlField = PLATFORM_URL_FIELD[platform] || 'facebook_post_url'
  const patch = { [urlField]: url || null }
  if (success) {
    patch.status = 'DA_DANG'
    patch.posted_at = nowIso()
    patch.error_message = null
  } else {
    patch.status = 'LOI'
    patch.error_message = errorMessage || 'Đăng thất bại.'
  }
  return updateRow(id, patch)
}

function remove(id) {
  const db = getDb()
  db.prepare('DELETE FROM video_library WHERE id = ?').run(id)
  return true
}

/**
 * Chon video ke tiep de lich dang tu dong su dung: uu tien video da tai ve
 * may (DA_TAI) truoc video chua tai (CHUA_DANG - lich se tu tai khi chay),
 * theo dung thu tu dong tren Sheet. Bo qua video dang xu ly/da xong/loi
 * (loi can nguoi dung tu kiem tra lai thu cong, khong tu dong thu lai).
 */
function pickNextPending() {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM video_library
    WHERE status IN ('CHUA_DANG', 'DA_TAI')
    ORDER BY CASE status WHEN 'DA_TAI' THEN 0 ELSE 1 END, sheet_row_number ASC
    LIMIT 1
  `).get()
}

module.exports = {
  list,
  get,
  testConnection,
  syncFromSheet,
  updateRow,
  downloadVideo,
  fetchTiktokLink,
  writeBackToSheet,
  markPlatformResult,
  pickNextPending,
  remove
}
