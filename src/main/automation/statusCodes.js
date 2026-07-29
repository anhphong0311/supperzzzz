/**
 * Ma trang thai chuan hoa cho tung PostJob (muc 10 & 17 trong dac ta).
 * KHONG duoc gop "Da dang" va "Da duyet" thanh mot trang thai.
 */
const JOB_STATUS = {
  QUEUED: 'QUEUED', // Chua xu ly / dang cho trong hang doi
  WAITING: 'WAITING', // Dang cho den luot dang
  IN_PROGRESS: 'IN_PROGRESS', // Dang dang
  POSTED: 'POSTED', // Dang thanh cong (Facebook da tiep nhan thao tac)
  PUBLISHED: 'PUBLISHED', // Da hien thi ngay cong khai trong nhom
  PENDING_APPROVAL: 'PENDING_APPROVAL', // Cho quan tri vien duyet
  APPROVED: 'APPROVED', // Da duoc duyet (xac nhan khi kiem tra lai)
  REJECTED: 'REJECTED', // Bi tu choi
  REMOVED: 'REMOVED', // Bi xoa sau khi da tung hien thi
  FAILED: 'FAILED', // Dang that bai
  GROUP_UNAVAILABLE: 'GROUP_UNAVAILABLE', // Khong truy cap duoc nhom
  NOT_A_MEMBER: 'NOT_A_MEMBER', // Tai khoan chua tham gia nhom
  LOGIN_EXPIRED: 'LOGIN_EXPIRED', // Phien dang nhap het han
  CHECKPOINT_REQUIRED: 'CHECKPOINT_REQUIRED', // Yeu cau xac minh / checkpoint / captcha
  UNKNOWN: 'UNKNOWN', // Khong xac dinh duoc trang thai
  STOPPED: 'STOPPED', // Da dung boi nguoi dung
  DRY_RUN_OK: 'DRY_RUN_OK' // Che do DRY_RUN: da dien noi dung/anh thanh cong, KHONG dang that
}

const JOB_STATUS_LABEL_VI = {
  QUEUED: 'Chưa xử lý',
  WAITING: 'Đang chờ đăng',
  IN_PROGRESS: 'Đang đăng',
  POSTED: 'Đăng thành công',
  PUBLISHED: 'Đã hiển thị ngay',
  PENDING_APPROVAL: 'Chờ quản trị viên duyệt',
  APPROVED: 'Đã được duyệt',
  REJECTED: 'Bị từ chối',
  REMOVED: 'Bị xóa',
  FAILED: 'Đăng thất bại',
  GROUP_UNAVAILABLE: 'Không truy cập được nhóm',
  NOT_A_MEMBER: 'Tài khoản chưa tham gia nhóm',
  LOGIN_EXPIRED: 'Phiên đăng nhập hết hạn',
  CHECKPOINT_REQUIRED: 'Yêu cầu xác minh',
  UNKNOWN: 'Không xác định được trạng thái',
  STOPPED: 'Đã dừng bởi người dùng',
  DRY_RUN_OK: 'Kiểm tra thành công (DRY_RUN)'
}

const ERROR_CODES = {
  ACCOUNT_NOT_LOGGED_IN: 'ACCOUNT_NOT_LOGGED_IN',
  LOGIN_SESSION_EXPIRED: 'LOGIN_SESSION_EXPIRED',
  CHECKPOINT_DETECTED: 'CHECKPOINT_DETECTED',
  CAPTCHA_DETECTED: 'CAPTCHA_DETECTED',
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  GROUP_ACCESS_DENIED: 'GROUP_ACCESS_DENIED',
  ACCOUNT_NOT_MEMBER: 'ACCOUNT_NOT_MEMBER',
  POST_COMPOSER_NOT_FOUND: 'POST_COMPOSER_NOT_FOUND',
  CONTENT_INPUT_FAILED: 'CONTENT_INPUT_FAILED',
  MEDIA_UPLOAD_FAILED: 'MEDIA_UPLOAD_FAILED',
  SUBMIT_BUTTON_NOT_FOUND: 'SUBMIT_BUTTON_NOT_FOUND',
  POST_SUBMIT_FAILED: 'POST_SUBMIT_FAILED',
  PENDING_STATUS_NOT_DETECTED: 'PENDING_STATUS_NOT_DETECTED',
  POST_URL_NOT_FOUND: 'POST_URL_NOT_FOUND',
  FACEBOOK_LAYOUT_CHANGED: 'FACEBOOK_LAYOUT_CHANGED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}

// Trang thai duoc coi la "da hoan tat", khong can xu ly them trong hang doi
const TERMINAL_STATUSES = new Set([
  JOB_STATUS.POSTED,
  JOB_STATUS.PUBLISHED,
  JOB_STATUS.PENDING_APPROVAL,
  JOB_STATUS.APPROVED,
  JOB_STATUS.REJECTED,
  JOB_STATUS.REMOVED,
  JOB_STATUS.FAILED,
  JOB_STATUS.GROUP_UNAVAILABLE,
  JOB_STATUS.NOT_A_MEMBER,
  JOB_STATUS.LOGIN_EXPIRED,
  JOB_STATUS.CHECKPOINT_REQUIRED,
  JOB_STATUS.UNKNOWN,
  JOB_STATUS.STOPPED,
  JOB_STATUS.DRY_RUN_OK
])

module.exports = { JOB_STATUS, JOB_STATUS_LABEL_VI, ERROR_CODES, TERMINAL_STATUSES }
