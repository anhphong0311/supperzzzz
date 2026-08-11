const fs = require('fs')
const { chromium } = require('playwright')
const selectors = require('./selectors')
const { existsAny } = require('./domHelper')

/**
 * Mo dung Chrome Profile cua mot tai khoan bang launchPersistentContext.
 * Moi tai khoan phai co mot browser_profile_path RIENG (muc 3) - day chinh
 * la co che dam bao moi tai khoan dung mot phien dang nhap doc lap, KHONG
 * chia se cookie/session giua cac tai khoan.
 *
 * Tool KHONG tu dong nhap mat khau: nguoi dung phai tu dang nhap Facebook
 * thu cong trong dung Chrome Profile nay it nhat mot lan truoc khi dung tool.
 */
async function launchProfile(browserProfilePath, { headless = false, executablePath } = {}) {
  if (!fs.existsSync(browserProfilePath)) {
    fs.mkdirSync(browserProfilePath, { recursive: true })
  }

  const baseOptions = {
    headless,
    viewport: null,
    args: ['--start-maximized'],
    executablePath: executablePath || undefined
  }

  try {
    // Uu tien dung Chrome that da cai tren may (channel 'chrome') vi Facebook
    // it gay kho khan hon so voi Chromium mac dinh cua Playwright.
    return await chromium.launchPersistentContext(browserProfilePath, {
      ...baseOptions,
      channel: executablePath ? undefined : 'chrome'
    })
  } catch (err) {
    // Neu may khong co Chrome that hoac channel loi -> dung Chromium di kem Playwright
    return await chromium.launchPersistentContext(browserProfilePath, baseOptions)
  }
}

/**
 * Mo profile o che do co giao dien de nguoi dung tu dang nhap thu cong.
 * Tra ve context de UI co the bao nguoi dung dong cua so khi xong.
 *
 * Dieu huong sang facebook.com CHI la tien ich (da so tai khoan dung de dang
 * Facebook) - neu tai bi cham/treo vi bat ky ly do gi (mang, tai khoan chi
 * dung cho TikTok/Instagram khong lien quan facebook.com...), KHONG duoc de
 * treo vo han - nguoi dung van co the tu go dia chi khac trong chinh cua so
 * that nay. Vi vay luon co gioi han thoi gian cho va bo qua loi neu co.
 */
async function openProfileForManualLogin(browserProfilePath) {
  const context = await launchProfile(browserProfilePath, { headless: false })
  const page = context.pages()[0] || (await context.newPage())
  try {
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 15000 })
  } catch (err) {
    // Bo qua - cua so van mo binh thuong, nguoi dung tu go dia chi can vao.
  }
  return context
}

/**
 * Kiem tra trang thai dang nhap cua mot tai khoan bang cach mo facebook.com
 * va tim dau hieu da/chua dang nhap hoac checkpoint.
 * Tra ve: 'DA_DANG_NHAP' | 'CHUA_DANG_NHAP' | 'HET_PHIEN' | 'YEU_CAU_XAC_MINH' | 'KHONG_XAC_DINH'
 */
async function checkLoginStatus(browserProfilePath, { headless = true, screenshotDir } = {}) {
  let context
  try {
    context = await launchProfile(browserProfilePath, { headless })
    const page = context.pages()[0] || (await context.newPage())
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)

    const hasCheckpoint = await existsAny(page, selectors.checkpointIndicators)
    if (hasCheckpoint) {
      if (screenshotDir) await safeScreenshot(page, screenshotDir, 'checkpoint')
      return 'YEU_CAU_XAC_MINH'
    }

    const isLoggedIn = await existsAny(page, selectors.loginIndicators.loggedIn)
    if (isLoggedIn) return 'DA_DANG_NHAP'

    const isLoggedOut = await existsAny(page, selectors.loginIndicators.loggedOut)
    if (isLoggedOut) return 'CHUA_DANG_NHAP'

    return 'KHONG_XAC_DINH'
  } catch (err) {
    return 'KHONG_XAC_DINH'
  } finally {
    if (context) await context.close().catch(() => {})
  }
}

/**
 * Kiem tra dang nhap TikTok RIENG (khong dung chung voi checkLoginStatus vi
 * ham do chi kiem tra Facebook) - dung cho tai khoan chi dung TikTok, khong
 * lien quan Facebook. Thay vi do tim selector DOM (de lech theo giao dien
 * TikTok doi), kiem tra qua URL sau khi dieu huong: TikTok Studio la khu vuc
 * chi vao duoc khi da dang nhap, se tu redirect ve trang dang nhap neu chua.
 * Tra ve: 'DA_DANG_NHAP' | 'CHUA_DANG_NHAP' | 'KHONG_XAC_DINH'
 */
async function checkTiktokLoginStatus(browserProfilePath, { headless = true } = {}) {
  let context
  try {
    context = await launchProfile(browserProfilePath, { headless })
    const page = context.pages()[0] || (await context.newPage())
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?lang=vi-VN', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })
    await page.waitForTimeout(2000)
    const url = page.url()
    if (url.includes('/login')) return 'CHUA_DANG_NHAP'
    if (url.includes('tiktokstudio')) return 'DA_DANG_NHAP'
    return 'KHONG_XAC_DINH'
  } catch (err) {
    return 'KHONG_XAC_DINH'
  } finally {
    if (context) await context.close().catch(() => {})
  }
}

/**
 * Kiem tra kha nang truy cap mot nhom bang dung tai khoan (Chrome Profile)
 * cu the. Dung cho nut "Kiem tra kha nang truy cap nhom" (muc 6).
 * Tra ve: 'HOAT_DONG' | 'KHONG_TRUY_CAP_DUOC' | 'CHUA_THAM_GIA' | 'HET_PHIEN' | 'KHONG_XAC_DINH'
 */
async function checkGroupAccess(browserProfilePath, groupUrl, { headless = true } = {}) {
  let context
  try {
    context = await launchProfile(browserProfilePath, { headless })
    const page = context.pages()[0] || (await context.newPage())
    await page.goto(groupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(1500)

    if (await existsAny(page, selectors.checkpointIndicators, { timeout: 800 })) return 'KHONG_XAC_DINH'

    const loggedOut = await existsAny(page, selectors.loginIndicators.loggedOut, { timeout: 1000 })
    if (loggedOut) return 'HET_PHIEN'

    const unavailable = await existsAny(page, selectors.groupAccessIndicators.unavailable, { timeout: 1000 })
    if (unavailable) return 'KHONG_TRUY_CAP_DUOC'

    const notMember = await existsAny(page, selectors.groupAccessIndicators.notAMember, { timeout: 1000 })
    if (notMember) return 'CHUA_THAM_GIA'

    return 'HOAT_DONG'
  } catch (err) {
    return 'KHONG_XAC_DINH'
  } finally {
    if (context) await context.close().catch(() => {})
  }
}

async function safeScreenshot(page, dir, prefix) {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const filePath = `${dir}/${prefix}-${Date.now()}.png`
    await page.screenshot({ path: filePath, fullPage: false })
    return filePath
  } catch (err) {
    return null
  }
}

module.exports = { launchProfile, openProfileForManualLogin, checkLoginStatus, checkTiktokLoginStatus, checkGroupAccess, safeScreenshot }
