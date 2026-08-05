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
    // truoc khi dien caption/bam Post.
    processingIndicator: [
      'text=/uploading/i',
      'text=/đang tải lên/i',
      'text=/processing/i',
      'text=/đang xử lý/i',
      '[class*="progress" i]'
    ],
    // O nhap caption/mo ta video
    captionInput: [
      'div[data-e2e="video-caption"] div[contenteditable="true"]',
      'div[data-e2e*="caption" i][contenteditable="true"]',
      'div[aria-label*="caption" i][contenteditable="true"]',
      'div[contenteditable="true"][role="combobox"]',
      'div[contenteditable="true"]'
    ],
    // Nut dang bai (thuong o goc duoi/phai trang, doi khi can cuon xuong)
    postButton: [
      'button[data-e2e="post-button"]',
      'button:has-text("Post")',
      'button:has-text("Đăng")',
      'div[role="button"]:has-text("Post")',
      'div[role="button"]:has-text("Đăng")'
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
