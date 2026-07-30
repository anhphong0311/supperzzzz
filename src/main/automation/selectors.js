/**
 * ============================================================================
 * KHO SELECTOR TRUNG TAM CHO FACEBOOK
 * ============================================================================
 * Ap dung cho CA 3 ngu canh dang bai: Nhom, Trang ca nhan (Timeline), Fanpage.
 * Dialog soan bai (composer) cua Meta dung chung 1 bo giao dien giua 3 ngu
 * canh nay, nen phan lon selector composer.* duoc dung chung - chi rieng
 * openTrigger la co them cac cau chao khac nhau theo ngu canh (vd "Bạn đang
 * nghĩ gì?" tren trang chu/Trang ca nhan, "Bạn viết gì đi..." trong nhom).
 *
 * Giao dien Facebook thay doi thuong xuyen va khac nhau theo ngon ngu, loai
 * tai khoan, A/B test... Vi vay MOI selector duoc khai bao la MOT MANG cac
 * "ung vien" (candidates) thay vi mot chuoi duy nhat. He thong se thu tung
 * ung vien theo thu tu cho den khi tim thay phan tu phu hop (xem
 * automation/domHelper.js -> findFirst()).
 *
 * KHI FACEBOOK DOI GIAO DIEN VA TOOL BAO LOI "FACEBOOK_LAYOUT_CHANGED":
 *   1. Mo man hinh dang bai that (khong phai DRY_RUN) de xem anh chup man
 *      hinh loi trong thu muc data/screenshots.
 *   2. Dung DevTools (F12) tren chinh Chrome Profile do de xac dinh selector
 *      moi cho phan tu bi loi.
 *   3. Them selector moi vao DAU mang tuong ung trong file nay (KHONG xoa
 *      selector cu ngay, de lam phuong an du phong).
 *   4. Bat che do DRY_RUN va chay lai de kiem tra truoc khi dang that.
 *
 * File nay la NOI DUY NHAT chua selector Facebook trong toan bo du an -
 * khong hard-code selector o noi khac.
 */

module.exports = {
  // Dau hieu nhan biet tai khoan da/chua dang nhap khi mo facebook.com
  loginIndicators: {
    loggedIn: [
      '[aria-label="Trang cá nhân của bạn"]',
      '[aria-label="Your profile"]',
      'div[role="navigation"] div[aria-label*="Tài khoản" i]',
      'div[role="navigation"] div[aria-label*="Account" i]',
      'a[href="/me/"]'
    ],
    loggedOut: [
      'form[data-testid="royal_login_form"]',
      '#loginform',
      'input[name="email"][id="email"]',
      'button[name="login"]'
    ]
  },

  // Dau hieu checkpoint / xac minh danh tinh / doi mat khau
  checkpointIndicators: [
    'text=/checkpoint/i',
    'text=/xác minh danh tính/i',
    'text=/confirm your identity/i',
    'text=/we suspect automated behavior/i',
    'text=/nghi ngờ có hoạt động tự động/i',
    'text=/đổi mật khẩu/i',
    'text=/change your password/i',
    'div[data-testid="checkpoint_title"]'
  ],

  // Dau hieu CAPTCHA
  captchaIndicators: [
    'iframe[src*="captcha"]',
    'text=/nhập các ký tự bạn nhìn thấy/i',
    'text=/enter the characters you see/i',
    'img[id*="captcha" i]'
  ],

  // Dau hieu khong the truy cap nhom (rieng tu, da bi xoa, bi chan...)
  groupAccessIndicators: {
    notAMember: [
      'text=/tham gia nhóm/i',
      'text=/join group/i',
      'div[aria-label*="Tham gia nhóm" i]'
    ],
    unavailable: [
      'text=/nội dung này hiện không có sẵn/i',
      'text=/this content isn\'t available/i',
      'text=/trang này không khả dụng/i'
    ]
  },

  // Khu vuc tao bai viet - dung chung cho Nhom / Trang chu (Trang ca nhan) / Fanpage
  composer: {
    openTrigger: [
      'div[role="button"]:has-text("Bạn viết gì đi...")',
      'div[role="button"]:has-text("Viết gì đó...")',
      'div[role="button"]:has-text("Write something")',
      'div[role="button"]:has-text("Bạn đang nghĩ gì")',
      'div[role="button"]:has-text("What\'s on your mind")',
      'div[role="button"][aria-label*="Tạo bài viết" i]',
      'div[role="button"][aria-label*="Write a post" i]',
      'div[role="button"][aria-label*="viết gì" i]',
      'div[role="button"][aria-label*="mind" i]'
    ],
    // Uu tien dialog co chua san o contenteditable (tranh khop nham dialog
    // khac dang mo tren trang, vi du popup thong bao). Selector cuoi cung
    // (khong dieu kien) la phuong an du phong khi khong loc duoc.
    dialog: [
      'div[role="dialog"]:has([contenteditable="true"])',
      'div[role="dialog"]:has-text("Đăng")',
      'div[role="dialog"]'
    ],
    // Nhieu lop du phong tu cu the -> tong quat, vi Facebook hay doi
    // aria-label/role va co the dung framework Lexical (data-lexical-editor)
    // thay vi chi dua vao contenteditable don gian. Lop cuoi cung tim TOAN
    // TRANG (khong gioi han trong dialog) de xu ly truong hop khung soan bai
    // hien thi INLINE ngay tren feed nhom thay vi mo popup rieng.
    contentEditable: [
      'div[role="dialog"] div[aria-label*="chia sẻ" i][contenteditable="true"]',
      'div[role="dialog"] div[aria-label*="mind" i][contenteditable="true"]',
      'div[role="dialog"] div[contenteditable="true"][role="textbox"]',
      'div[role="dialog"] [data-lexical-editor="true"]',
      'div[role="dialog"] [contenteditable="true"][role="textbox"]',
      'div[role="dialog"] div[contenteditable="true"]',
      'div[role="dialog"] [contenteditable="true"]',
      'form [contenteditable="true"][role="textbox"]',
      '[data-lexical-editor="true"]',
      '[contenteditable="true"][role="textbox"]'
    ],
    // KHONG dung selector nay de bam (click) - bam vao nut hien thi that co
    // the kich hoat hop thoai chon file cua he dieu hanh (ngoai tam kiem
    // soat cua Playwright, se lam tool "treo"). Chi giu de tham khao/debug.
    addPhotoButton: [
      'div[aria-label="Ảnh/video"][role="button"]',
      'div[aria-label="Photo/video"][role="button"]',
      'div[aria-label*="Add to your post" i][role="button"]'
    ],
    // Luu y: input[type=file] cua Facebook luon bi an bang CSS - phai tim voi
    // state:'attached' (xem domHelper.js), KHONG duoc doi 'visible'.
    fileInput: [
      'div[role="dialog"] input[type="file"][accept*="image"]',
      'div[role="dialog"] input[type="file"]',
      'form input[type="file"]',
      'input[type="file"]'
    ],
    imageThumbnail: [
      'div[role="dialog"] img[referrerpolicy]'
    ],
    // Video hien thi bang the <video> (khong phai <img>) sau khi tai len.
    videoThumbnail: [
      'div[role="dialog"] video'
    ],
    // Thanh tien trinh/spinner khi Facebook dang xu ly video da tai len -
    // PHAI cho phan tu nay BIEN MAT truoc khi bam nut Dang, neu khong video
    // co the bi dang thieu/loi. Facebook thuong hien % hoac vong xoay.
    mediaProcessingIndicator: [
      'div[role="dialog"] [role="progressbar"]',
      'div[role="dialog"] text=/đang tải lên/i',
      'div[role="dialog"] text=/uploading/i',
      'div[role="dialog"] text=/đang xử lý/i',
      'div[role="dialog"] text=/processing/i'
    ],
    submitButton: [
      'div[role="dialog"] div[aria-label="Đăng"][role="button"]',
      'div[role="dialog"] div[aria-label="Post"][role="button"]',
      'div[role="dialog"] div[role="button"]:has-text("Đăng")',
      'div[role="dialog"] div[role="button"]:has-text("Post")'
    ]
  },

  // Nut chuyen danh tinh dang bai sang Fanpage khi mo composer tren trang
  // Fanpage ma tai khoan quan tri (chi ap dung cho target_type = 'PAGE').
  // BEST-EFFORT: nhieu giao dien Facebook tu dong dang voi tu cach Trang ma
  // khong can buoc nay - neu khong tim thay selector nao trong danh sach,
  // automation SE BO QUA (khong coi la loi) va dang tiep voi danh tinh hien
  // tai. Neu bai dang bi sai danh tinh (dang bang tai khoan ca nhan thay vi
  // Trang), can bo sung selector moi vao day sau khi kiem tra bang DevTools.
  pageIdentitySwitch: [
    'div[role="dialog"] div[aria-label*="Chuyển đổi" i][role="button"]',
    'div[role="dialog"] div[role="button"]:has-text("Đăng với tư cách")',
    'div[role="dialog"] div[role="button"]:has-text("Switch now")',
    'div[role="dialog"] div[role="button"]:has-text("Post as")'
  ],

  // Ket qua sau khi nhan Dang
  postResult: {
    pendingApprovalText: [
      'text=/bài viết của bạn đang chờ (được )?phê duyệt/i',
      'text=/đang chờ quản trị viên duyệt/i',
      'text=/your post is pending approval/i',
      'text=/pending admin approval/i'
    ],
    publishedLink: [
      'a[href*="/groups/"][href*="/posts/"]',
      'a[href*="/groups/"][href*="/permalink/"]',
      'a[href*="/posts/"]',
      'a[href*="/videos/"]',
      'a[href*="/permalink.php"]',
      'a[href*="/watch/"]'
    ],
    genericError: [
      'text=/không thể đăng bài viết này/i',
      'text=/we couldn\'t post this/i'
    ]
  }
}
