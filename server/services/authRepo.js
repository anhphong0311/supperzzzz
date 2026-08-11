const jwt = require('jsonwebtoken')
const { client } = require('../db')
const { hashPassword, verifyPassword } = require('./passwordUtil')

const ADMIN_KEY = 'admin_password_hash'
const JWT_EXPIRES_IN = '12h'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Server chưa cấu hình JWT_SECRET.')
  return secret
}

function issueAdminToken() {
  return jwt.sign({ role: 'admin' }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN })
}

// Dung cho nhan vien tu goi hanh dong cua CHINH HO (hien tai chi
// markWizardDone) - khong duoc phep goi cac route quan tri khac.
function issueStaffToken(staffId) {
  return jwt.sign({ role: 'staff', id: staffId }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN })
}

function verifyAdminToken(token) {
  const payload = jwt.verify(token, getJwtSecret())
  if (payload.role !== 'admin') throw new Error('Không có quyền Quản trị.')
  return payload
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret())
}

async function getSetting(key) {
  const res = await client.execute({ sql: 'SELECT setting_value FROM admin_settings WHERE setting_key = ?', args: [key] })
  return res.rows[0] ? res.rows[0].setting_value : null
}

async function setSetting(key, value) {
  await client.execute({
    sql: `INSERT INTO admin_settings (setting_key, setting_value) VALUES (?, ?)
          ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value`,
    args: [key, value]
  })
}

async function hasAdminPassword() {
  return !!(await getSetting(ADMIN_KEY))
}

async function setAdminPassword(currentPassword, newPassword) {
  if (!newPassword) throw new Error('Mật khẩu Admin mới không được để trống.')
  const existing = await getSetting(ADMIN_KEY)
  if (existing) {
    if (!verifyPassword(currentPassword || '', existing)) {
      throw new Error('Mật khẩu Admin hiện tại không đúng.')
    }
  }
  await setSetting(ADMIN_KEY, hashPassword(newPassword))
  return { token: issueAdminToken() }
}

async function loginAdmin(password) {
  const stored = await getSetting(ADMIN_KEY)
  if (!verifyPassword(password || '', stored)) {
    throw new Error('Mật khẩu Admin không đúng.')
  }
  return { role: 'admin', token: issueAdminToken() }
}

module.exports = {
  hasAdminPassword,
  setAdminPassword,
  loginAdmin,
  issueAdminToken,
  issueStaffToken,
  verifyAdminToken,
  verifyToken
}
