/**
 * Ho tro thu lan luot nhieu selector "ung vien" cho cung mot phan tu,
 * vi giao dien Facebook hay thay doi (xem selectors.js).
 */

/**
 * Thu tung selector trong danh sach, tra ve Locator dau tien khop.
 * Tra ve null neu khong co selector nao khop trong thoi gian cho.
 *
 * state mac dinh la 'visible' - phu hop cho da so phan tu (nut, o nhap...).
 * Rieng input[type=file] cua Facebook LUON bi an bang CSS (nguoi dung bam
 * vao 1 nut hien thi khac, nut do moi kich hoat input an nay) nen phai goi
 * voi state:'attached' (chi can ton tai trong DOM, khong can nhin thay),
 * neu khong waitFor({state:'visible'}) se timeout vinh vien du input van co that.
 */
async function findFirst(page, candidates, { timeoutPerCandidate = 1500, state = 'visible' } = {}) {
  for (const selector of candidates) {
    try {
      const locator = page.locator(selector).first()
      await locator.waitFor({ state, timeout: timeoutPerCandidate })
      return locator
    } catch (err) {
      // Thu selector tiep theo
    }
  }
  return null
}

/**
 * Kiem tra nhanh xem co selector nao trong danh sach dang hien dien tren
 * trang hay khong (khong nem loi neu khong thay).
 */
async function existsAny(page, candidates, { timeout = 1200 } = {}) {
  const locator = await findFirst(page, candidates, { timeoutPerCandidate: timeout })
  return !!locator
}

module.exports = { findFirst, existsAny }
