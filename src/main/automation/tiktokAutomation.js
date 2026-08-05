const selectors = require('./tiktokSelectors')
const { findFirst, existsAny } = require('./domHelper')
const { safeScreenshot } = require('./browserManager')
const { JOB_STATUS, ERROR_CODES } = require('./statusCodes')
const { ManualInterventionError, JobExecutionError } = require('./postAutomation')

/**
 * Dang 1 video len TikTok qua giao dien web (tiktok.com/upload) - KHONG
 * dung API chinh thuc. Luu y:
 *   - Tai khoan phai da duoc dang nhap TikTok THU CONG trong DUNG Chrome
 *     Profile cua tai khoan do truoc.
 *   - Selector TikTok la BEST-EFFORT, xem ghi chu dau file
 *     tiktokSelectors.js - can kiem chung bang DRY_RUN.
 *   - TikTok CHI nhan 1 video moi lan dang (khong dang duoc nhieu file/anh
 *     tinh nhu Facebook/Instagram) - dung file dau tien trong mediaPaths.
 *
 * @returns {{ status: string, postUrl: string|null, screenshotPath: string|null }}
 */
async function executeJob({ page, content, mediaPaths = [], dryRun, timeouts, screenshotDir, log }) {
  const T = {
    pageLoad: timeouts?.pageLoadMs ?? 30000,
    mediaUpload: timeouts?.mediaUploadMs ?? 60000,
    videoProcessing: timeouts?.videoProcessingMs ?? 120000
  }

  const captureFailureScreenshot = async (prefix) => {
    if (!screenshotDir) return null
    return safeScreenshot(page, screenshotDir, prefix)
  }

  const fail = async (errorCode, message, prefix) => {
    const shot = prefix ? await captureFailureScreenshot(prefix) : null
    throw new JobExecutionError(errorCode, message, shot)
  }

  const assertNoManualInterventionNeeded = async (stage) => {
    if (await existsAny(page, selectors.captchaIndicators, { timeout: 800 })) {
      const shot = await captureFailureScreenshot('tt-captcha')
      throw new ManualInterventionError(ERROR_CODES.CAPTCHA_DETECTED, `TikTok: phát hiện CAPTCHA ở bước "${stage}". Cần người dùng xử lý thủ công.`, shot)
    }
    if (await existsAny(page, selectors.checkpointIndicators, { timeout: 800 })) {
      const shot = await captureFailureScreenshot('tt-checkpoint')
      throw new ManualInterventionError(ERROR_CODES.CHECKPOINT_DETECTED, `TikTok: phát hiện checkpoint/yêu cầu xác minh ở bước "${stage}". Cần người dùng xử lý thủ công.`, shot)
    }
  }

  if (mediaPaths.length === 0) {
    await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, 'TikTok bắt buộc phải có 1 video đính kèm.')
  }
  const videoPath = mediaPaths[0]

  // Buoc 1: Di THANG toi trang tai video - TikTok khong can bam qua menu
  // nao ca, do la diem khac biet thuan loi so voi Instagram.
  log('INFO', 'Đang mở trang tải video TikTok...')
  try {
    await page.goto('https://www.tiktok.com/upload?lang=en', { waitUntil: 'domcontentloaded', timeout: T.pageLoad })
  } catch (err) {
    await fail(ERROR_CODES.NETWORK_ERROR, `Không tải được trang upload TikTok: ${err.message}`)
  }
  await page.waitForTimeout(2000)
  await assertNoManualInterventionNeeded('mở trang upload')

  const loggedOut = await existsAny(page, selectors.loginIndicators.loggedOut, { timeout: 1500 })
  if (loggedOut) {
    throw new ManualInterventionError(ERROR_CODES.LOGIN_SESSION_EXPIRED, 'Chưa đăng nhập TikTok trong Chrome Profile này (hoặc phiên đã hết hạn).')
  }

  // Buoc 2: Tai video len (input[type=file] bi an - phai tim voi
  // state:'attached', khong duoc doi 'visible')
  log('INFO', 'Đang tải video lên TikTok...')
  const fileInput = await findFirst(page, selectors.upload.fileInput, { timeoutPerCandidate: 6000, state: 'attached' })
  if (!fileInput) {
    await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, 'Không tìm thấy ô tải video lên TikTok.', 'tt-file-input-not-found')
  }
  try {
    await fileInput.setInputFiles([videoPath])
  } catch (err) {
    await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, `Tải video lên TikTok thất bại: ${err.message}`, 'tt-media-upload-failed')
  }
  await page.waitForTimeout(2000)
  await assertNoManualInterventionNeeded('sau khi chọn video')

  // Cho TikTok tai/xu ly video xong (co the mat vai chuc giay voi video dai)
  const processingDeadline = Date.now() + T.videoProcessing
  while (await existsAny(page, selectors.upload.processingIndicator, { timeout: 1500 })) {
    if (Date.now() > processingDeadline) {
      await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, 'TikTok xử lý video quá lâu (quá thời gian chờ).', 'tt-processing-timeout')
    }
    log('INFO', 'Đang chờ TikTok xử lý video...')
    await page.waitForTimeout(3000)
  }

  // Buoc 3: Dien caption
  log('INFO', 'Đang điền nội dung...')
  const captionBox = await findFirst(page, selectors.upload.captionInput, { timeoutPerCandidate: 8000 })
  if (!captionBox) {
    await fail(ERROR_CODES.CONTENT_INPUT_FAILED, 'Không tìm thấy ô nhập nội dung trên TikTok.', 'tt-caption-not-found')
  }
  if (content) {
    await captionBox.click()
    // TikTok caption box thuong da co san hashtag/mo ta goi y - chon het va
    // ghi de bang noi dung that de tranh bi dinh vao van ban mac dinh.
    await page.keyboard.press('Control+A').catch(() => {})
    await page.keyboard.type(content, { delay: 8 })
  }

  if (dryRun) {
    log('INFO', 'DRY_RUN: đã điền nội dung/video TikTok, KHÔNG bấm Đăng.')
    const shot = await captureFailureScreenshot('tt-dry-run-preview')
    return { status: JOB_STATUS.DRY_RUN_OK, postUrl: null, screenshotPath: shot, dryRunChecked: true }
  }

  // Buoc 4: Dang bai
  log('INFO', 'Đang bấm Đăng...')
  const postButton = await findFirst(page, selectors.upload.postButton, { timeoutPerCandidate: 5000 })
  if (!postButton) {
    await fail(ERROR_CODES.SUBMIT_BUTTON_NOT_FOUND, 'Không tìm thấy nút Đăng trên TikTok.', 'tt-post-button-not-found')
  }
  await postButton.click()
  await page.waitForTimeout(4000)
  await assertNoManualInterventionNeeded('sau khi bấm Đăng')

  const genericError = await existsAny(page, selectors.postResult.genericError, { timeout: 2000 })
  if (genericError) {
    await fail(ERROR_CODES.POST_SUBMIT_FAILED, 'TikTok báo không thể đăng video này.', 'tt-submit-failed')
  }

  const success = await existsAny(page, selectors.postResult.successIndicators, { timeout: 15000 })
  if (success) {
    log('INFO', 'TikTok đã xác nhận đăng video thành công.')
  } else {
    log('INFO', 'Không thấy thông báo xác nhận rõ ràng, nhưng không có lỗi - coi như đã tiếp nhận thao tác đăng.')
  }

  // TikTok khong luon hien link video ngay - best-effort, khong dam bao lay
  // duoc URL that (giong Instagram).
  return { status: JOB_STATUS.POSTED, postUrl: null, screenshotPath: null }
}

/**
 * TikTok khong co URL bai viet duoc luu san trong da so truong hop, nen
 * "kiem tra lai" chi bao UNKNOWN - khong the xac dinh chinh xac trang thai
 * duyet/xoa nhu Facebook Group.
 */
async function recheckJobStatus({ page, postUrl, targetUrl, screenshotDir, log }) {
  try {
    await page.goto(postUrl || targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    if (await existsAny(page, selectors.checkpointIndicators, { timeout: 800 })) {
      throw new ManualInterventionError(ERROR_CODES.CHECKPOINT_DETECTED, 'TikTok: phát hiện checkpoint khi kiểm tra lại trạng thái.')
    }
    log('INFO', 'TikTok không hỗ trợ xác định chính xác trạng thái duyệt bài như Facebook Group.')
    return JOB_STATUS.UNKNOWN
  } catch (err) {
    if (err instanceof ManualInterventionError) throw err
    if (screenshotDir) await safeScreenshot(page, screenshotDir, 'tt-recheck-failed').catch(() => {})
    return JOB_STATUS.UNKNOWN
  }
}

module.exports = { executeJob, recheckJobStatus }
