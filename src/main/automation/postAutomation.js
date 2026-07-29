const selectors = require('./selectors')
const { findFirst, existsAny } = require('./domHelper')
const { safeScreenshot } = require('./browserManager')
const { JOB_STATUS, ERROR_CODES } = require('./statusCodes')

/**
 * Loi dac biet: yeu cau nguoi dung can thiep thu cong (CAPTCHA, checkpoint,
 * het phien, doi mat khau...). Khi gap loi nay, hang doi PHAI dung lai toan
 * bo (khong chi bo qua job hien tai) va bao cho nguoi dung - khong tu dong
 * vuot qua duoi bat ky hinh thuc nao (muc 9, muc 20).
 */
class ManualInterventionError extends Error {
  constructor(code, message, screenshotPath = null) {
    super(message)
    this.name = 'ManualInterventionError'
    this.code = code
    this.screenshotPath = screenshotPath
  }
}

/**
 * Loi thao tac thong thuong (khong can nguoi dung can thiep, chi la job that bai).
 */
class JobExecutionError extends Error {
  constructor(errorCode, message, screenshotPath = null) {
    super(message)
    this.name = 'JobExecutionError'
    this.errorCode = errorCode
    this.screenshotPath = screenshotPath
  }
}

/**
 * Thuc hien 1 job dang bai vao 1 nhom (muc 9, cac buoc 2-14).
 * Buoc 1 (mo dung Chrome Profile) va buoc 15 (dong tab/chuyen nhom) do
 * queue engine dam nhiem vi context/page duoc tai su dung giua cac job cua
 * cung mot tai khoan.
 *
 * @returns {{ status: string, facebookPostUrl: string|null, screenshotPath: string|null }}
 */
async function executeJob({ page, groupUrl, content, mediaPaths = [], dryRun, timeouts, screenshotDir, log }) {
  const T = {
    pageLoad: timeouts?.pageLoadMs ?? 30000,
    mediaUpload: timeouts?.mediaUploadMs ?? 60000
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
      const shot = await captureFailureScreenshot('captcha')
      throw new ManualInterventionError(ERROR_CODES.CAPTCHA_DETECTED, `Phát hiện CAPTCHA ở bước "${stage}". Cần người dùng xử lý thủ công.`, shot)
    }
    if (await existsAny(page, selectors.checkpointIndicators, { timeout: 800 })) {
      const shot = await captureFailureScreenshot('checkpoint')
      throw new ManualInterventionError(ERROR_CODES.CHECKPOINT_DETECTED, `Phát hiện checkpoint/yêu cầu xác minh ở bước "${stage}". Cần người dùng xử lý thủ công.`, shot)
    }
  }

  // Buoc 2: Truy cap URL nhom
  log('INFO', `Đang truy cập nhóm: ${groupUrl}`)
  try {
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: T.pageLoad })
  } catch (err) {
    await fail(ERROR_CODES.NETWORK_ERROR, `Không tải được trang nhóm: ${err.message}`)
  }
  await page.waitForTimeout(1500)
  await assertNoManualInterventionNeeded('mở nhóm')

  // Buoc 4: Kiem tra con dang nhap hay khong
  const loggedOut = await existsAny(page, selectors.loginIndicators.loggedOut, { timeout: 1000 })
  if (loggedOut) {
    throw new ManualInterventionError(ERROR_CODES.LOGIN_SESSION_EXPIRED, 'Phiên đăng nhập đã hết hạn.')
  }

  // Buoc 3: Kiem tra co the xem/dang bai trong nhom hay khong
  const unavailable = await existsAny(page, selectors.groupAccessIndicators.unavailable, { timeout: 1000 })
  if (unavailable) {
    return {
      status: JOB_STATUS.GROUP_UNAVAILABLE,
      facebookPostUrl: null,
      screenshotPath: await captureFailureScreenshot('group-unavailable')
    }
  }
  const notMember = await existsAny(page, selectors.groupAccessIndicators.notAMember, { timeout: 1000 })
  if (notMember) {
    return {
      status: JOB_STATUS.NOT_A_MEMBER,
      facebookPostUrl: null,
      screenshotPath: await captureFailureScreenshot('not-a-member')
    }
  }

  // Buoc 5-6: Tim va mo khu vuc tao bai viet
  log('INFO', 'Đang tìm khu vực tạo bài viết...')
  const trigger = await findFirst(page, selectors.composer.openTrigger, { timeoutPerCandidate: 4000 })
  if (!trigger) {
    await fail(ERROR_CODES.POST_COMPOSER_NOT_FOUND, 'Không tìm thấy khu vực tạo bài viết. Giao diện Facebook có thể đã thay đổi.', 'composer-not-found')
  }
  await trigger.click()

  const dialog = await findFirst(page, selectors.composer.dialog, { timeoutPerCandidate: 5000 })
  if (!dialog) {
    await fail(ERROR_CODES.POST_COMPOSER_NOT_FOUND, 'Không mở được cửa sổ tạo bài viết.', 'composer-dialog-not-found')
  }
  await assertNoManualInterventionNeeded('mở cửa sổ tạo bài viết')

  // Buoc 7: Dien noi dung
  log('INFO', 'Đang điền nội dung...')
  const editable = await findFirst(page, selectors.composer.contentEditable, { timeoutPerCandidate: 5000 })
  if (!editable) {
    await fail(ERROR_CODES.CONTENT_INPUT_FAILED, 'Không tìm thấy ô nhập nội dung bài viết.', 'content-input-failed')
  }
  await editable.click()
  await page.keyboard.type(content, { delay: 8 })

  // Buoc 8-9: Tai anh len va cho hoan tat
  if (mediaPaths.length > 0) {
    log('INFO', `Đang tải lên ${mediaPaths.length} ảnh...`)
    // input[type=file] cua Facebook bi an bang CSS (nguoi dung thay khong
    // bam thang vao no ma bam nut "Anh/video" hien thi ben ngoai) nen phai
    // tim voi state:'attached' - neu doi 'visible' se KHONG BAO GIO tim
    // thay du input van ton tai that trong DOM (day la nguyen nhan loi
    // "Khong tim thay nut/o tai anh len" du giao dien co hien nut do).
    const fileInput = await findFirst(page, selectors.composer.fileInput, { timeoutPerCandidate: 4000, state: 'attached' })
    if (!fileInput) {
      await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, 'Không tìm thấy nút/ô tải ảnh lên.', 'media-upload-failed')
    }
    try {
      await fileInput.setInputFiles(mediaPaths)
      await page.waitForTimeout(1000)
      await findFirst(page, selectors.composer.imageThumbnail, { timeoutPerCandidate: T.mediaUpload })
    } catch (err) {
      await fail(ERROR_CODES.MEDIA_UPLOAD_FAILED, `Tải ảnh lên thất bại: ${err.message}`, 'media-upload-failed')
    }
  }

  // Buoc 10: Kiem tra noi dung truoc khi dang
  const typedText = await editable.innerText().catch(() => '')
  if (!typedText || !typedText.trim()) {
    await fail(ERROR_CODES.CONTENT_INPUT_FAILED, 'Nội dung sau khi điền vẫn trống, có thể đã nhập thất bại.', 'content-empty-after-type')
  }

  if (dryRun) {
    log('INFO', 'DRY_RUN: đã điền nội dung/ảnh, KHÔNG nhấn nút đăng.')
    const shot = await captureFailureScreenshot('dry-run-preview')
    return { status: JOB_STATUS.DRY_RUN_OK, facebookPostUrl: null, screenshotPath: shot, dryRunChecked: true }
  }

  // Buoc 11: Nhan nut dang bai
  log('INFO', 'Đang nhấn nút đăng bài...')
  const submitBtn = await findFirst(page, selectors.composer.submitButton, { timeoutPerCandidate: 4000 })
  if (!submitBtn) {
    await fail(ERROR_CODES.SUBMIT_BUTTON_NOT_FOUND, 'Không tìm thấy nút Đăng.', 'submit-button-not-found')
  }
  await submitBtn.click()
  await page.waitForTimeout(3000)
  await assertNoManualInterventionNeeded('sau khi nhấn đăng')

  // Buoc 12-13: Doc thong bao phan hoi, xac dinh trang thai ban dau
  const isPending = await existsAny(page, selectors.postResult.pendingApprovalText, { timeout: 4000 })
  if (isPending) {
    log('INFO', 'Bài viết đang chờ quản trị viên duyệt.')
    return { status: JOB_STATUS.PENDING_APPROVAL, facebookPostUrl: null, screenshotPath: null }
  }

  const genericError = await existsAny(page, selectors.postResult.genericError, { timeout: 1500 })
  if (genericError) {
    await fail(ERROR_CODES.POST_SUBMIT_FAILED, 'Facebook báo không thể đăng bài viết này.', 'post-submit-failed')
  }

  // Buoc 14: Lay link bai neu co (bai hien thi ngay = PUBLISHED)
  let postUrl = null
  try {
    const linkLocator = await findFirst(page, selectors.postResult.publishedLink, { timeoutPerCandidate: 5000 })
    if (linkLocator) postUrl = await linkLocator.getAttribute('href')
  } catch (err) {
    // Khong lay duoc link - van coi la da dang, chi khong xac dinh duoc URL
  }

  if (postUrl) {
    log('INFO', `Bài viết đã hiển thị: ${postUrl}`)
    return { status: JOB_STATUS.PUBLISHED, facebookPostUrl: postUrl, screenshotPath: null }
  }

  log('INFO', 'Facebook đã tiếp nhận thao tác đăng nhưng chưa xác định được bài đã hiển thị hay chưa.')
  return { status: JOB_STATUS.POSTED, facebookPostUrl: null, screenshotPath: null }
}

/**
 * Kiem tra lai trang thai duyet bai sau khi da dang (muc 11).
 * LUU Y: Facebook khong co API chinh thuc cho trang thai duyet bai trong
 * nhom - ket qua duoc suy ra tu giao dien hien thi va co the khong chinh
 * xac tuyet doi.
 */
async function recheckJobStatus({ page, facebookPostUrl, groupUrl, screenshotDir, log }) {
  const target = facebookPostUrl || groupUrl
  try {
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)

    if (await existsAny(page, selectors.checkpointIndicators, { timeout: 800 })) {
      throw new ManualInterventionError(ERROR_CODES.CHECKPOINT_DETECTED, 'Phát hiện checkpoint khi kiểm tra lại trạng thái.')
    }

    if (facebookPostUrl) {
      const stillThere = await existsAny(page, ['article', 'div[role="article"]'], { timeout: 3000 })
      if (stillThere) {
        log('INFO', 'Bài viết vẫn hiển thị công khai -> APPROVED.')
        return JOB_STATUS.APPROVED
      }
      log('INFO', 'Bài viết không còn hiển thị -> REJECTED hoặc đã bị xóa.')
      return JOB_STATUS.REJECTED
    }

    const stillPending = await existsAny(page, selectors.postResult.pendingApprovalText, { timeout: 2000 })
    if (stillPending) return JOB_STATUS.PENDING_APPROVAL

    return JOB_STATUS.UNKNOWN
  } catch (err) {
    if (err instanceof ManualInterventionError) throw err
    if (screenshotDir) await safeScreenshot(page, screenshotDir, 'recheck-failed').catch(() => {})
    return JOB_STATUS.UNKNOWN
  }
}

module.exports = { executeJob, recheckJobStatus, ManualInterventionError, JobExecutionError }
