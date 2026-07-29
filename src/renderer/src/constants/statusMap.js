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
  LOGIN_EXPIRED: 'amber',
  CHECKPOINT_REQUIRED: 'amber',
  UNKNOWN: 'gray',
  STOPPED: 'gray',
  DRY_RUN_OK: 'blue'
}

export const ALL_JOB_STATUSES = Object.keys(JOB_STATUS_LABEL_VI)

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
