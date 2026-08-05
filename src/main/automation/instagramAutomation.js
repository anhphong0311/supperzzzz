const selectors = require('./instagramSelectors')
const { findFirst, existsAny } = require('./domHelper')
const { safeScreenshot } = require('./browserManager')
const { JOB_STATUS, ERROR_CODES } = require('./statusCodes')
const { ManualInterventionError, JobExecutionError } = require('./postAutomation')

/**
 * Dang 1 bai viet len Instagram (Feed/Reels) qua giao dien web thong
 * thuong - KHONG dung API chinh thuc. Luu y quan trong:
 *   - Tai khoan phai da duoc dang nhap Instagram THU CONG trong DUNG Chrome
 *     Profile cua tai khoan do truoc (cung profile dung cho Facebook).
 *   - Selector Instagram la BEST-EFFORT, xem ghi chu dau file
 *     instagramSelectors.js - rat co the can chinh sau lan chay DRY_RUN dau.
 *   - Instagram dang bai qua NHIEU BUOC (wizard): chon file -> crop -> loc
 *     -> caption -> chia se, khac han cau truc 1-dialog cua Facebook.
 *
 * @returns {{ status: string, postUrl: string|null, screenshotPath: string|null }}
 */
async function executeJob({ page, target, content, mediaPaths = [], dryRun, timeouts, screenshotDir, log }) {
  const T = {
    pageLoad: timeouts?.pageLoadMs ?? 30000,
    mediaUpload: timeouts?.mediaUploadMs ?? 60000,
    videoProcessing: timeouts?.videoProcessingMs ?? 90000
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
      const shot = await captureFailureScreenshot('ig-captcha')
      throw new ManualInterventionError(ERROR_CODES.CAPTCHA_DETECTED, `Instagram: phát hiện CAPTCHA ở bước "${stage}". Cần người dùng xử lý thủ công.`, shot)
    }
    if (await existsAny(page, selectors.checkpointIndicators, { timeout: 800 })) {
      const shot = await captureFailureScreenshot('ig-checkpoint')
      throw new ManualInterventionError(ERROR_CODES.CHECKPOINT_DETECTED, `Instagram: phát hiện checkpoint/yêu cầu xác minh ở bước "${stage}". Cần người dùng xử lý thủ công.`, shot)
    }
  }

  if (mediaPaths.length === 0) {
    await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, 'Instagram bắt buộc phải có ít nhất 1 ảnh/video đính kèm.')
  }

  // Buoc 1: Truy cap Instagram
  log('INFO', `Đang truy cập ${target.name}...`)
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: T.pageLoad })
  } catch (err) {
    await fail(ERROR_CODES.NETWORK_ERROR, `Không tải được Instagram: ${err.message}`)
  }
  await page.waitForTimeout(1500)
  await assertNoManualInterventionNeeded('mở Instagram')

  const loggedOut = await existsAny(page, selectors.loginIndicators.loggedOut, { timeout: 1500 })
  if (loggedOut) {
    throw new ManualInterventionError(ERROR_CODES.LOGIN_SESSION_EXPIRED, 'Chưa đăng nhập Instagram trong Chrome Profile này (hoặc phiên đã hết hạn).')
  }

  // Buoc 2: Mo trinh tao bai viet.
  // CACH 1 (uu tien): dieu huong THANG toi URL tao bai viet cua Instagram -
  // bo qua hoan toan viec phai bam trung menu "Create" -> "Post" (da xac
  // nhan qua thuc te ca bam chuot lan dieu huong phim deu de bam truot lam
  // menu tu dong dong lai). Neu Instagram doi duong dan nay, se tu dong
  // chuyen sang CACH 2 (bam nut) ben duoi.
  log('INFO', 'Đang mở trình tạo bài viết Instagram...')
  let dialog = null
  try {
    await page.goto('https://www.instagram.com/create/select/', { waitUntil: 'domcontentloaded', timeout: T.pageLoad })
    await page.waitForTimeout(1200)
    dialog = await findFirst(page, selectors.composer.dialog, { timeoutPerCandidate: 4000 })
  } catch (err) {
    // Bo qua loi dieu huong - se thu CACH 2 ben duoi
  }

  if (!dialog) {
    // CACH 2 (du phong): bam nut "Tao" roi bam "Post" trong menu phu bang
    // CHUOT (khong dung phim - da xac nhan gay dong menu ngoai y muon).
    log('INFO', 'Không mở được qua đường dẫn trực tiếp, thử bấm nút "Tạo"...')
    const trigger = await findFirst(page, selectors.composer.openTrigger, { timeoutPerCandidate: 5000 })
    if (!trigger) {
      await fail(ERROR_CODES.POST_COMPOSER_NOT_FOUND, 'Không tìm thấy nút tạo bài viết Instagram. Giao diện có thể đã thay đổi.', 'ig-composer-not-found')
    }
    await trigger.click()
    await page.waitForTimeout(800)
    await captureFailureScreenshot('ig-after-trigger-click')

    const postMenuItem = await findFirst(page, selectors.composer.postMenuItem, { timeoutPerCandidate: 3000 })
    if (postMenuItem) {
      await postMenuItem.click()
      await page.waitForTimeout(800)
    } else {
      log('WARN', 'Không thấy mục "Post" trong menu phụ - thử tìm cửa sổ trực tiếp.')
    }
    await captureFailureScreenshot('ig-after-postmenu-click')

    dialog = await findFirst(page, selectors.composer.dialog, { timeoutPerCandidate: 4000 })
  }

  if (!dialog) {
    await fail(ERROR_CODES.POST_COMPOSER_NOT_FOUND, 'Không mở được cửa sổ tạo bài viết Instagram (đã thử cả 2 cách).', 'ig-dialog-not-found')
  }
  await assertNoManualInterventionNeeded('mở cửa sổ tạo bài viết')

  // Buoc 3: Tai anh/video len (input[type=file] bi an - phai tim voi
  // state:'attached', khong duoc doi 'visible')
  log('INFO', `Đang tải lên ${mediaPaths.length} tệp...`)
  const fileInput = await findFirst(page, selectors.composer.fileInput, { timeoutPerCandidate: 4000, state: 'attached' })
  if (!fileInput) {
    await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, 'Không tìm thấy ô tải file lên Instagram.', 'ig-file-input-not-found')
  }
  try {
    await fileInput.setInputFiles(mediaPaths)
  } catch (err) {
    await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, `Tải file lên Instagram thất bại: ${err.message}`, 'ig-media-upload-failed')
  }
  await page.waitForTimeout(1500)
  await assertNoManualInterventionNeeded('sau khi chọn file')

  // Buoc 4-5: 2 man hinh "Tiep theo" (crop + bo loc)
  for (const stepName of ['crop', 'filter']) {
    const nextBtn = await findFirst(page, selectors.composer.nextButton, { timeoutPerCandidate: 8000 })
    if (!nextBtn) {
      await fail(ERROR_CODES.SUBMIT_BUTTON_NOT_FOUND, `Không tìm thấy nút "Tiếp theo" ở bước ${stepName} của Instagram.`, `ig-next-not-found-${stepName}`)
    }
    await nextBtn.click()
    await page.waitForTimeout(1000)
    await assertNoManualInterventionNeeded(`bước ${stepName}`)
  }

  // Cho video xu ly xong (neu co) truoc khi dien caption
  const processingDeadline = Date.now() + T.videoProcessing
  while (await existsAny(page, selectors.composer.processingIndicator, { timeout: 1000 })) {
    if (Date.now() > processingDeadline) {
      await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, 'Instagram xử lý video quá lâu (quá thời gian chờ).', 'ig-processing-timeout')
    }
    log('INFO', 'Đang chờ Instagram xử lý video...')
    await page.waitForTimeout(2000)
  }

  // Buoc 6: Dien caption
  log('INFO', 'Đang điền nội dung...')
  const captionBox = await findFirst(page, selectors.composer.captionInput, { timeoutPerCandidate: 5000 })
  if (!captionBox) {
    await fail(ERROR_CODES.CONTENT_INPUT_FAILED, 'Không tìm thấy ô nhập nội dung (caption) trên Instagram.', 'ig-caption-not-found')
  }
  if (content) {
    await captionBox.click()
    await page.keyboard.type(content, { delay: 8 })
  }

  if (dryRun) {
    log('INFO', 'DRY_RUN: đã điền nội dung/media Instagram, KHÔNG bấm Chia sẻ.')
    const shot = await captureFailureScreenshot('ig-dry-run-preview')
    return { status: JOB_STATUS.DRY_RUN_OK, postUrl: null, screenshotPath: shot, dryRunChecked: true }
  }

  // Buoc 7: Chia se
  log('INFO', 'Đang bấm Chia sẻ...')
  const shareBtn = await findFirst(page, selectors.composer.shareButton, { timeoutPerCandidate: 5000 })
  if (!shareBtn) {
    await fail(ERROR_CODES.SUBMIT_BUTTON_NOT_FOUND, 'Không tìm thấy nút Chia sẻ trên Instagram.', 'ig-share-not-found')
  }
  await shareBtn.click()
  await page.waitForTimeout(3000)
  await assertNoManualInterventionNeeded('sau khi bấm Chia sẻ')

  const genericError = await existsAny(page, selectors.postResult.genericError, { timeout: 1500 })
  if (genericError) {
    await fail(ERROR_CODES.POST_SUBMIT_FAILED, 'Instagram báo không thể chia sẻ bài viết này.', 'ig-submit-failed')
  }

  // Instagram khong luon hien link bai viet ngay lap tuc sau khi chia se -
  // best-effort: cho thong bao "da chia se" roi coi la thanh cong, KHONG
  // dam bao lay duoc URL bai viet that (khac Facebook).
  const shared = await existsAny(page, selectors.postResult.sharedConfirmation, { timeout: 10000 })
  if (shared) {
    log('INFO', 'Instagram đã xác nhận chia sẻ bài viết.')
  } else {
    log('INFO', 'Không thấy thông báo xác nhận rõ ràng, nhưng không có lỗi - coi như đã tiếp nhận thao tác đăng.')
  }

  return { status: JOB_STATUS.POSTED, postUrl: null, screenshotPath: null }
}

/**
 * Instagram khong co URL bai viet duoc luu san (executeJob khong lay
 * duoc), nen viec "kiem tra lai" chi co the mo trang ca nhan va bao UNKNOWN
 * - khong the xac dinh chinh xac bai da duyet/bi xoa nhu Facebook Group.
 */
async function recheckJobStatus({ page, postUrl, targetUrl, screenshotDir, log }) {
  try {
    await page.goto(postUrl || targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)
    if (await existsAny(page, selectors.checkpointIndicators, { timeout: 800 })) {
      throw new ManualInterventionError(ERROR_CODES.CHECKPOINT_DETECTED, 'Instagram: phát hiện checkpoint khi kiểm tra lại trạng thái.')
    }
    log('INFO', 'Instagram không hỗ trợ xác định chính xác trạng thái duyệt bài như Facebook Group.')
    return JOB_STATUS.UNKNOWN
  } catch (err) {
    if (err instanceof ManualInterventionError) throw err
    if (screenshotDir) await safeScreenshot(page, screenshotDir, 'ig-recheck-failed').catch(() => {})
    return JOB_STATUS.UNKNOWN
  }
}

module.exports = { executeJob, recheckJobStatus }
