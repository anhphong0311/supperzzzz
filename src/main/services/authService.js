const settingsService = require('./settingsService')
const { hashPassword, verifyPassword } = require('./passwordUtil')

const ADMIN_KEY = 'admin_password_hash'

function hasAdminPassword() {
  return !!settingsService.get(ADMIN_KEY)
}

function setAdminPassword(currentPassword, newPassword) {
  if (!newPassword) throw new Error('Mật khẩu Admin mới không được để trống.')
  const existing = settingsService.get(ADMIN_KEY)
  if (existing) {
    if (!verifyPassword(currentPassword || '', existing)) {
      throw new Error('Mật khẩu Admin hiện tại không đúng.')
    }
  }
  settingsService.set(ADMIN_KEY, hashPassword(newPassword))
  return true
}

function loginAdmin(password) {
  const stored = settingsService.get(ADMIN_KEY)
  if (!verifyPassword(password || '', stored)) {
    throw new Error('Mật khẩu Admin không đúng.')
  }
  return { role: 'admin' }
}

module.exports = {
  hasAdminPassword,
  setAdminPassword,
  loginAdmin
}
