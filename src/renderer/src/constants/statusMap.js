// Ban sao nhe cua statusCodes.js (main process) danh rieng cho renderer -
// giu doc lap ve dinh dang module (ESM) voi main process (CommonJS).
// Khi them/sua trang thai, nho cap nhat dong bo voi
// src/main/automation/statusCodes.js

export const JOB_STATUS_LABEL_VI = {
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
  TARGET_NOT_CONFIGURED: 'Đích đăng chưa được cấu hình',
  LOGIN_EXPIRED: 'Phiên đăng nhập hết hạn',
  CHECKPOINT_REQUIRED: 'Yêu cầu xác minh',
  UNKNOWN: 'Không xác định được trạng thái',
  STOPPED: 'Đã dừng bởi người dùng',
  DRY_RUN_OK: 'Kiểm tra thành công (DRY_RUN)'
}

export const JOB_STATUS_COLOR = {
  QUEUED: 'gray',
  WAITING: 'gray',
  IN_PROGRESS: 'blue',
  POSTED: 'green',
  PUBLISHED: 'green',
  PENDING_APPROVAL: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  REMOVED: 'red',
  FAILED: 'red',
  GROUP_UNAVAILABLE: 'red',
  NOT_A_MEMBER: 'red',
  TARGET_NOT_CONFIGURED: 'red',
  LOGIN_EXPIRED: 'amber',
  CHECKPOINT_REQUIRED: 'amber',
  UNKNOWN: 'gray',
  STOPPED: 'gray',
  DRY_RUN_OK: 'blue'
}

export const ALL_JOB_STATUSES = Object.keys(JOB_STATUS_LABEL_VI)

// Cac trang thai duoc phep bam "Dang lai" - moi trang thai "khong thanh cong"
// va da ket thuc (khong con dang cho/dang chay). KHONG bao gom cac trang thai
// da thanh cong (POSTED/PUBLISHED/PENDING_APPROVAL/APPROVED/DRY_RUN_OK) hay
// dang hoat dong (QUEUED/WAITING/IN_PROGRESS).
export const RETRYABLE_STATUSES = new Set([
  'FAILED',
  'STOPPED',
  'GROUP_UNAVAILABLE',
  'NOT_A_MEMBER',
  'TARGET_NOT_CONFIGURED',
  'LOGIN_EXPIRED',
  'CHECKPOINT_REQUIRED',
  'UNKNOWN',
  'REJECTED',
  'REMOVED'
])

export const LOGIN_STATUS_LABEL_VI = {
  DA_DANG_NHAP: 'Đã đăng nhập',
  CHUA_DANG_NHAP: 'Chưa đăng nhập',
  HET_PHIEN: 'Hết phiên đăng nhập',
  YEU_CAU_XAC_MINH: 'Yêu cầu xác minh',
  KHONG_XAC_DINH: 'Không xác định'
}

export const ACCOUNT_STATUS_LABEL_VI = {
  HOAT_DONG: 'Hoạt động',
  TAM_DUNG: 'Tạm dừng'
}

export const GROUP_STATUS_LABEL_VI = {
  HOAT_DONG: 'Hoạt động',
  KHONG_HOAT_DONG: 'Không hoạt động',
  CHUA_XAC_DINH: 'Chưa xác định'
}

export const TARGET_TYPE_LABEL_VI = {
  GROUP: 'Nhóm',
  TIMELINE: 'Trang cá nhân',
  PAGE: 'Fanpage',
  INSTAGRAM_POST: 'Instagram',
  TIKTOK_POST: 'TikTok'
}

export const PLATFORM_LABEL_VI = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  threads: 'Threads'
}

export const VIDEO_STATUS_LABEL_VI = {
  CHUA_DANG: 'Chưa đăng',
  DANG_TAI: 'Đang tải video...',
  DA_TAI: 'Đã tải về máy',
  DANG_DANG: 'Đang đăng',
  DA_DANG: 'Đã đăng',
  LOI: 'Lỗi'
}

export const VIDEO_STATUS_COLOR = {
  CHUA_DANG: 'gray',
  DANG_TAI: 'blue',
  DA_TAI: 'blue',
  DANG_DANG: 'blue',
  DA_DANG: 'green',
  LOI: 'red'
}
