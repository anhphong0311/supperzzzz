/**
 * ============================================================================
 * KHO SELECTOR TRUNG TAM CHO INSTAGRAM
 * ============================================================================
 * CANH BAO: khac voi selectors.js (Facebook) da duoc nguoi dung test thuc te
 * nhieu lan, cac selector Instagram duoi day la BEST-EFFORT DUA TREN CAU
 * TRUC GIAO DIEN INSTAGRAM PHO BIEN, CHUA duoc kiem chung tren tai khoan
 * that. Gan nhu chac chan can chinh sua sau khi chay DRY_RUN lan dau - xem
 * huong dan sua selector trong README muc 8 (ap dung tuong tu cho Instagram).
 *
 * Instagram dang bai qua nhieu buoc (wizard): chon file -> cat/chinh anh ->
 * bo loc -> caption + chia se. Moi buoc co nut "Tiep theo"/"Next" giong
 * nhau ve mat DOM nhung khac ngu canh, nen dung chung 1 selector "nextButton"
 * cho ca 2 buoc dau.
 */
module.exports = {
  loginIndicators: {
    loggedIn: [
      'svg[aria-label="New post"]',
      'svg[aria-label="Tạo bài viết mới"]',
      'a[href="/direct/inbox/"]',
      'svg[aria-label="Home"]'
    ],
    loggedOut: [
      'input[name="username"]',
      'button:has-text("Log in")',
      'button:has-text("Đăng nhập")'
    ]
  },

  checkpointIndicators: [
    'text=/we suspect automated behavior/i',
    'text=/nghi ngờ có hoạt động tự động/i',
    'text=/confirm your identity/i',
    'text=/xác minh danh tính/i',
    'text=/help us confirm it/'
  ],

  captchaIndicators: [
    'iframe[src*="captcha"]',
    'text=/enter the characters you see/i'
  ],

  composer: {
    // Nut mo trinh tao bai viet (thuong o thanh dieu huong ben trai). Da xac
    // nhan thuc te: cua so trinh duyet tu dong doi khi hien thanh dieu
    // huong DANG CHI CO ICON (khong co chu "Create" nhu luc nguoi dung tu
    // mo), nen KHONG duoc chi dua vao selector doi hoi co chu - phai co them
    // cac selector khop rong theo aria-label cua the <svg> (van con du du
    // khi thu gon icon-only).
    openTrigger: [
      'svg[aria-label="New post"]',
      'svg[aria-label="Create"]',
      'svg[aria-label="Tạo bài viết mới"]',
      'svg[aria-label="Tạo"]',
      'a[role="link"]:has-text("Create")',
      'a[role="link"]:has-text("Tạo")',
      'div[role="button"]:has-text("Create")',
      'svg[aria-label*="new post" i]',
      'svg[aria-label*="create" i]',
      'svg[aria-label*="tạo" i]'
    ],
    dialog: ['div[role="dialog"]'],
    // Sau khi bam "Create" (openTrigger), Instagram hien menu phu ngay
    // TRONG THANH DIEU HUONG (khong phai popup roi) voi 2 muc "Post"/"AI" -
    // da xac nhan qua anh chup thuc te. Uu tien tim trong <nav>/thanh dieu
    // huong truoc de tranh khop nham nut "Post" cua 1 khung binh luan nao do
    // dang ton tai an trong DOM o cho khac tren trang.
    postMenuItem: [
      'nav :text-is("Post")',
      'div[role="navigation"] :text-is("Post")',
      'a[role="link"]:has-text("Post")',
      'div[role="button"]:has-text("Post")',
      ':text-is("Post")'
    ],
    // Nut "Chon tu may tinh" - bam vao se kich hoat input file AN
    selectFromComputerButton: [
      'button:has-text("Select from computer")',
      'button:has-text("Chọn từ máy tính")'
    ],
    // input[type=file] luon bi an bang CSS, PHAI tim voi state:'attached'
    fileInput: [
      'div[role="dialog"] input[type="file"]'
    ],
    // Nut "Next" o man Crop va man Edit (Filters) - xac nhan qua anh chup
    // thuc te hien thi dang CHU MAU XANH o goc tren phai, CO THE khong phai
    // the <button> (vi vay selector cuoi dung :text-is khong rang buoc tag).
    nextButton: [
      'div[role="dialog"] :text-is("Next")',
      'div[role="dialog"] :text-is("Tiếp")',
      'div[role="dialog"] button:has-text("Next")',
      'div[role="dialog"] div[role="button"]:has-text("Next")'
    ],
    // O nhap caption o man cuoi cung (chua xac dinh chinh xac, xem ghi chu
    // trong README muc 8 neu buoc nay bi loi)
    captionInput: [
      'div[role="dialog"] textarea[aria-label*="caption" i]',
      'div[role="dialog"] div[aria-label*="caption" i][contenteditable="true"]',
      'div[role="dialog"] div[contenteditable="true"][role="textbox"]',
      'div[role="dialog"] textarea'
    ],
    // Nut chia se bai viet (buoc cuoi cung) - cung la CHU MAU XANH goc tren
    // phai giong "Next", khong chac chan la the <button>.
    shareButton: [
      'div[role="dialog"] :text-is("Share")',
      'div[role="dialog"] :text-is("Chia sẻ")',
      'div[role="dialog"] button:has-text("Share")',
      'div[role="dialog"] div[role="button"]:has-text("Share")'
    ],
    // Thanh tien trinh khi Instagram dang xu ly/upload video
    processingIndicator: [
      'div[role="dialog"] [role="progressbar"]',
      'div[role="dialog"] text=/uploading/i',
      'div[role="dialog"] text=/đang tải lên/i'
    ]
  },

  postResult: {
    // Sau khi chia se thanh cong, Instagram thuong hien thong bao ngan
    sharedConfirmation: [
      'text=/your post has been shared/i',
      'text=/đã chia sẻ bài viết/i'
    ],
    genericError: [
      'text=/couldn\'t (post|share) this/i',
      'text=/không thể chia sẻ bài viết này/i'
    ]
  }
}
