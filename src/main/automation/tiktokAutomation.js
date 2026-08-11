const selectors = require('./tiktokSelectors')
const { findFirst, existsAny } = require('./domHelper')
const { safeScreenshot } = require('./browserManager')
const { JOB_STATUS, ERROR_CODES } = require('./statusCodes')
const { ManualInterventionError, JobExecutionError } = require('./postAutomation')

/**
 * Sau khi dang xong, thu vao trang "Quan ly bai dang" cua TikTok Studio de
 * lay link video VUA dang (video moi nhat, o dau danh sach). BEST-EFFORT -
 * CHUA kiem chung tren giao dien that, va du that bai cung KHONG duoc lam
 * hong ket qua da dang thanh cong (chi de postUrl = null nhu truoc gio).
 */
async function tryFetchLatestPostUrl(page, log) {
  try {
    await page.goto('https://www.tiktok.com/tiktokstudio/content?lang=vi-VN', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    })
    await page.waitForTimeout(2000)

    // Cach 1 (hiem gap trong thuc te): dong video co san the <a> tro thang
    // toi link that.
    const link = await findFirst(page, selectors.postsManagement.firstPostLink, { timeoutPerCandidate: 3000 })
    if (link) {
      const href = await link.getAttribute('href')
      if (href) return href.startsWith('http') ? href : `https://www.tiktok.com${href}`
    }

    // Cach 2: dong video la 1 hang trong bang, khong co the <a> - phai bam
    // nut "..." (more actions) roi chon "Sao chep lien ket", sau do doc
    // clipboard he thong (Electron doc truc tiep, khong can quyen trinh duyet).
    const moreBtn = await findFirst(page, selectors.postsManagement.firstPostMoreButton, { timeoutPerCandidate: 3000 })
    if (!moreBtn) return null
    await moreBtn.click()
    await page.waitForTimeout(500)
    const copyItem = await findFirst(page, selectors.postsManagement.copyLinkMenuItem, { timeoutPerCandidate: 3000 })
    if (!copyItem) return null
    const { clipboard } = require('electron')
    clipboard.writeText('') // xoa truoc de chac chan gia tri doc duoc la MOI copy, khong phai rac cu
    await copyItem.click()
    await page.waitForTimeout(500)
    const text = clipboard.readText()
    if (text && text.includes('tiktok.com')) return text.trim()
    return null
  } catch (err) {
    log?.('INFO', 'Không tự lấy được link bài đăng TikTok thật (best-effort) - để trống link.')
    return null
  }
}

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

  // TikTok Studio doi khi hien hop thoai hoi bat/tat kiem tra ban quyen/noi
  // dung tu dong ngay sau khi tai xong video - dong lai (neu co) truoc khi
  // thao tac tiep, khong thi no se che mat o caption/nut Dang.
  const dismissBtn = await findFirst(page, selectors.upload.contentCheckDialogDismiss, { timeoutPerCandidate: 1500 })
  if (dismissBtn) {
    await dismissBtn.click().catch(() => {})
    await page.waitForTimeout(500)
  }
  // Khung gioi thieu tinh nang moi (neu co) cung phai dong tuong tu - lop
  // phu trong suot cua no chan click vao ca cac phan khac cua trang.
  const tooltipBtn = await findFirst(page, selectors.upload.onboardingTooltipDismiss, { timeoutPerCandidate: 1500 })
  if (tooltipBtn) {
    await tooltipBtn.click().catch(() => {})
    await page.waitForTimeout(500)
  }

  // Buoc 3: Dien caption
  log('INFO', 'Đang điền nội dung...')
  const captionBox = await findFirst(page, selectors.upload.captionInput, { timeoutPerCandidate: 8000 })
  if (!captionBox) {
    await fail(ERROR_CODES.CONTENT_INPUT_FAILED, 'Không tìm thấy ô nhập nội dung trên TikTok.', 'tt-caption-not-found')
  }
  if (content) {
    // Du da co buoc dong cac lop phu o tren, van du phong: neu con 1 lop phu
    // la khong luong truoc duoc nao do chan click binh thuong (het thoi gian
    // cho), thu lai bang force:true - bo qua kiem tra "co nhan duoc click
    // hay khong" cua Playwright, vi vi tri phan tu tren man hinh van dung.
    try {
      await captionBox.click({ timeout: 10000 })
    } catch (err) {
      log('INFO', 'Không bấm được vào ô nội dung theo cách thường, đang thử lại...')
      await captionBox.click({ force: true })
    }
    // TikTok caption box thuong da co san hashtag/mo ta goi y - chon het va
    // ghi de bang noi dung that de tranh bi dinh vao van ban mac dinh.
    await page.keyboard.press('Control+A').catch(() => {})
    await page.keyboard.type(content, { delay: 8 })
    await page.waitForTimeout(500)

    // Kiem tra lai: noi dung vua go co THAT SU nam trong o caption hay
    // khong. Da tung xay ra truong hop captionBox khop NHAM 1 phan tu khac
    // tren trang (vd khung ngay/gio "Len lich"), khien noi dung go vao sai
    // cho, o caption that van con nguyen text mac dinh cua TikTok - PHAI
    // phat hien som o day thay vi de bam Dang voi noi dung sai.
    const typedText = await captionBox.innerText().catch(() => '')
    const expectedSnippet = content.slice(0, Math.min(15, content.length)).trim()
    if (expectedSnippet && !typedText.includes(expectedSnippet)) {
      await fail(
        ERROR_CODES.CONTENT_INPUT_FAILED,
        `Nội dung gõ vào có vẻ không đúng ô caption thật của TikTok (ô hiện đang có: "${typedText.slice(0, 60)}"). Cần kiểm tra lại giao diện TikTok, KHÔNG bấm Đăng để tránh đăng sai nội dung.`,
        'tt-caption-mismatch'
      )
    }
  }

  if (dryRun) {
    log('INFO', 'DRY_RUN: đã điền nội dung/video TikTok, KHÔNG bấm Đăng.')
    const shot = await captureFailureScreenshot('tt-dry-run-preview')
    return { status: JOB_STATUS.DRY_RUN_OK, postUrl: null, screenshotPath: shot, dryRunChecked: true }
  }

  // Buoc 4: Dang bai
  log('INFO', 'Đang bấm Đăng...')
  // Dung getByRole (tim theo VAI TRO + TEN HIEN THI ma trinh doc man hinh se
  // doc, theo dung chuan accessibility) thay vi so khop text tho qua CSS
  // pseudo-selector - da xac nhan qua thuc te ca ':has-text' (khop kieu
  // "chua chuoi", bi nham sang muc menu "Bai dang") lan ':text-is' (khop
  // CHINH XAC toan bo text node, that bai vi nut that co the chua them van
  // ban an phuc vu accessibility) deu KHONG dang tin cay bang getByRole.
  const postButtonLocator = page
    .getByRole('button', { name: 'Đăng', exact: true })
    .or(page.getByRole('button', { name: 'Post', exact: true }))
    .or(page.locator('button[data-e2e="post-button"]'))
  let postButtonFound = true
  try {
    await postButtonLocator.first().waitFor({ state: 'visible', timeout: 8000 })
  } catch (err) {
    postButtonFound = false
  }
  if (!postButtonFound) {
    await fail(ERROR_CODES.SUBMIT_BUTTON_NOT_FOUND, 'Không tìm thấy nút Đăng trên TikTok.', 'tt-post-button-not-found')
  }
  const postButton = postButtonLocator.first()
  // Chup lai man hinh NGAY TRUOC khi bam Dang - de neu ket qua sau do van
  // sai, co bang chung xem luc do trang dang hien gi (o caption dung/sai,
  // co lop phu nao con che khong...).
  await captureFailureScreenshot('tt-before-post-click')
  try {
    await postButton.click({ timeout: 10000 })
  } catch (err) {
    log('INFO', 'Không bấm được vào nút Đăng theo cách thường, đang thử lại...')
    await postButton.click({ force: true })
  }
  // Va chup ngay SAU khi bam, truoc khi cho xac nhan (buoc cho co the mat
  // toi hang chuc giay) - de biet chinh xac cu click co lam trang thay doi
  // gi khong.
  await page.waitForTimeout(800)
  await captureFailureScreenshot('tt-after-post-click')
  await page.waitForTimeout(4000)
  await assertNoManualInterventionNeeded('sau khi bấm Đăng')

  const genericError = await existsAny(page, selectors.postResult.genericError, { timeout: 2000 })
  if (genericError) {
    await fail(ERROR_CODES.POST_SUBMIT_FAILED, 'TikTok báo không thể đăng video này.', 'tt-submit-failed')
  }

  // Luu y: existsAny() thu LAN LUOT tung selector trong danh sach, MOI cai
  // deu cho toi "timeout" neu khong khop - voi 5 ung vien va timeout 15s se
  // mat toi 75s trong truong hop xau nhat. Dung 4s/ung vien (~20s toi da) de
  // khong lam nguoi dung cho qua lau ma van du thoi gian cho trang phan hoi.
  const success = await existsAny(page, selectors.postResult.successIndicators, { timeout: 4000 })
  if (success) {
    log('INFO', 'TikTok đã xác nhận đăng video thành công.')
    const postUrl = await tryFetchLatestPostUrl(page, log)
    return { status: JOB_STATUS.POSTED, postUrl, screenshotPath: null }
  }

  // Khong thay thong bao xac nhan RO RANG - truoc day code mac dinh coi day
  // la thanh cong (chi can khong co loi), nhung thuc te da gap truong hop
  // bam Dang khong thuc su an (vi du bi lop phu chan) ma van bi bao "thanh
  // cong" sai. Kiem tra them: neu trang VAN CON hien form tai video (nut
  // Dang van con do) thi nhieu kha nang thao tac Dang CHUA thanh cong that -
  // tra ve UNKNOWN thay vi POSTED, kem anh chup de nguoi dung tu kiem tra
  // lai tren TikTok Studio, tranh bao sai ket qua.
  const stillOnUploadForm = await existsAny(page, selectors.upload.postButton, { timeout: 2000 })
  if (stillOnUploadForm) {
    const shot = await captureFailureScreenshot('tt-post-unconfirmed')
    log('ERROR', 'Không xác nhận được TikTok đã đăng thành công (trang vẫn còn hiện form tải video) - vui lòng tự kiểm tra lại trên TikTok Studio.')
    return { status: JOB_STATUS.UNKNOWN, postUrl: null, screenshotPath: shot }
  }

  log('INFO', 'Không thấy thông báo xác nhận rõ ràng, nhưng trang đã rời khỏi form đăng - coi như đã tiếp nhận thao tác đăng.')
  const postUrl = await tryFetchLatestPostUrl(page, log)
  return { status: JOB_STATUS.POSTED, postUrl, screenshotPath: null }
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
