const { Notification } = require('electron')
const settingsService = require('./services/settingsService')

/**
 * Thong bao cap he dieu hanh (Windows toast) - dung khi lich dang tu dong
 * gap loi hoac can nguoi dung xu ly thu cong (checkpoint/CAPTCHA), vi luc
 * do co the khong ai dang nhin man hinh app.
 */
function notify(title, body) {
  try {
    const settings = settingsService.getAll()
    if (String(settings.notifications_enabled) === 'false') return
    if (!Notification.isSupported()) return
    new Notification({ title, body }).show()
  } catch (err) {
    // Khong de loi thong bao lam hong luong chinh
  }
}

module.exports = { notify }
