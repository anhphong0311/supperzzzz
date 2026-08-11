/**
 * ============================================================================
 * KHO SELECTOR TRUNG TAM CHO TIKTOK
 * ============================================================================
 * CANH BAO: BEST-EFFORT, CHUA duoc kiem chung tren tai khoan that (giong
 * tinh trang ban dau cua Instagram). Nhieu selector duoi day dua tren thuoc
 * tinh `data-e2e` - day la quy uoc TikTok hay dung cho test noi bo, kha on
 * dinh hon class CSS ngau nhien, nhung KHONG duoc dam bao chinh xac 100%.
 * Nen chay DRY_RUN va kiem tra ky truoc khi dang that - xem README muc 8.
 *
 * Khac voi Instagram (menu nhieu buoc de bam truot), TikTok di THANG toi
 * trang tai video (khong qua menu "Create" nao ca), nen it rui ro hon o
 * buoc mo trinh soan bai.
 */
module.exports = {
  loginIndicators: {
    loggedOut: [
      'text=/log in to tiktok/i',
      'text=/đăng nhập vào tiktok/i',
      'div[class*="login-card"]',
      'input[name="username"]'
    ]
  },

  checkpointIndicators: [
    'text=/verify to continue/i',
    'text=/xác minh để tiếp tục/i',
    'text=/unusual activity/i',
    'text=/hoạt động bất thường/i'
  ],

  captchaIndicators: [
    'iframe[src*="captcha"]',
    'div[id*="captcha" i]',
    'text=/verify you are human/i'
  ],

  upload: {
    // input[type=file] thuong co san ngay tren trang upload (khong can bam
    // nut nao truoc) - van phai tim voi state:'attached' vi bi an bang CSS.
    fileInput: [
      'input[type="file"][accept*="video"]',
      'input[type="file"]'
    ],
    // Thanh tien trinh khi TikTok dang tai/xu ly video - PHAI bien mat
    // truoc khi dien caption/bam Post. KHONG dung selector class chung chung
    // nhu '[class*="progress"]' - da xac nhan qua thuc te no khop nham voi
    // thanh tua (scrubber) cua khung xem truoc video, von LUON hien dien sau
    // khi video xu ly xong, khien vong lap cho "xu ly video" treo vinh vien.
    processingIndicator: [
      'text=/uploading/i',
      'text=/đang tải lên/i',
      'text=/processing/i',
      'text=/đang xử lý/i'
    ],
    // Hop thoai TikTok Studio hay hien SAU KHI tai video xong, hoi bat/tat
    // kiem tra ban quyen/noi dung tu dong - che mat o nhap caption/nut Dang
    // neu khong dong lai. Uu tien bam "Huy"/nut dong (X) de KHONG tu y doi
    // cai dat kiem tra noi dung cua tai khoan nguoi dung.
    contentCheckDialogDismiss: [
      'div[role="dialog"] button:has-text("Hủy")',
      'div[role="dialog"] button:has-text("Cancel")',
      'div[role="dialog"] button[aria-label*="close" i]',
      'div[role="dialog"] button[aria-label*="đóng" i]'
    ],
    // TikTok Studio hay hien them 1 khung gioi thieu tinh nang moi ("Bo sung
    // tinh nang chinh sua moi"...) voi lop phu (overlay) trong suot chan het
    // thao tac click vao trang cho toi khi bam nut xac nhan nay - phai dong
    // truoc khi bam duoc vao o caption/nut Dang.
    onboardingTooltipDismiss: [
      'button:has-text("Đã hiểu")',
      'button:has-text("Got it")',
      'button:has-text("Understood")'
    ],
    // O nhap caption/mo ta video
    captionInput: [
      'div[data-e2e="video-caption"] div[contenteditable="true"]',
      'div[data-e2e*="caption" i][contenteditable="true"]',
      'div[aria-label*="caption" i][contenteditable="true"]',
      'div[contenteditable="true"][role="combobox"]',
      'div[contenteditable="true"]'
    ],
    // Nut dang bai (thuong o goc duoi/phai trang, doi khi can cuon xuong).
    // QUAN TRONG: dung :text-is() (khop CHINH XAC toan bo chu, khong phai
    // chi can CHUA chuoi do) - da xac nhan qua thuc te ':has-text("Đăng")'
    // (khop kieu "chua chuoi") bi nham sang muc menu "Bai dang" o thanh ben
    // (vi "Bai dang" cung CHUA chu "dang"), khien tool bam nham vao do thay
    // vi nut Dang that, nen bai khong bao gio duoc dang du log bao thanh cong.
    postButton: [
      'button[data-e2e="post-button"]',
      'button:text-is("Post")',
      'button:text-is("Đăng")',
      'div[role="button"]:text-is("Post")',
      'div[role="button"]:text-is("Đăng")'
    ]
  },

  postResult: {
    successIndicators: [
      'text=/your video has been uploaded/i',
      'text=/video của bạn đã được đăng/i',
      'text=/manage your post/i',
      'text=/quản lý bài đăng/i',
      'text=/view post/i'
    ],
    genericError: [
      'text=/failed to upload/i',
      'text=/tải lên không thành công/i',
      'text=/something went wrong/i'
    ]
  }
}
