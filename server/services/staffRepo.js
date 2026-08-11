const { client } = require('../db')
const { hashPassword, verifyPassword } = require('./passwordUtil')
const { issueAdminToken, issueStaffToken } = require('./authRepo')

// Mirror 1:1 logic cua src/main/services/staffService.js (ban cuc bo cu),
// chi khac o cho dung @libsql/client (async) thay vi sql.js (dong bo).

function nowIso() {
  return new Date().toISOString()
}

async function list() {
  const res = await client.execute(
    'SELECT id, username, display_name, status, role, wizard_completed, created_at FROM staff_users ORDER BY id DESC'
  )
  return res.rows
}

async function get(id) {
  const res = await client.execute({
    sql: 'SELECT id, username, display_name, status, role, wizard_completed, created_at FROM staff_users WHERE id = ?',
    args: [id]
  })
  return res.rows[0] || null
}

async function getByUsername(username) {
  const res = await client.execute({ sql: 'SELECT * FROM staff_users WHERE username = ?', args: [username] })
  return res.rows[0] || null
}

async function insert({ username, display_name, password, status }) {
  if (!username || !username.trim()) throw new Error('Vui lòng nhập tên đăng nhập.')
  if (!display_name || !display_name.trim()) throw new Error('Vui lòng nhập tên hiển thị.')
  if (!password) throw new Error('Vui lòng nhập mật khẩu.')
  try {
    const res = await client.execute({
      sql: `INSERT INTO staff_users (username, display_name, password_hash, status)
            VALUES (?, ?, ?, ?)`,
      args: [username.trim(), display_name.trim(), hashPassword(password), status]
    })
    return get(Number(res.lastInsertRowid))
  } catch (err) {
    if (String(err.message).toUpperCase().includes('UNIQUE')) {
      throw new Error('Tên đăng nhập đã tồn tại.')
    }
    throw err
  }
}

// Admin tao truc tiep (trang Tai khoan Nhan vien) - vao thang duoc ngay.
function create({ username, display_name, password }) {
  return insert({ username, display_name, password, status: 'ACTIVE' })
}

// Nhan vien tu dang ky tu man hinh dang nhap - phai cho Admin duyet.
// registration_code duoc kiem tra o tang route (routes/auth.js), khong o day.
function register({ username, display_name, password }) {
  return insert({ username, display_name, password, status: 'PENDING' })
}

function approve(id) {
  return setStatus(id, 'ACTIVE')
}

async function setStatus(id, status) {
  const current = await get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  await client.execute({
    sql: 'UPDATE staff_users SET status = ?, updated_at = ? WHERE id = ?',
    args: [status, nowIso(), id]
  })
  return get(id)
}

async function setRole(id, role) {
  if (role !== 'STAFF' && role !== 'ADMIN') throw new Error('Vai trò không hợp lệ.')
  const current = await get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  await client.execute({
    sql: 'UPDATE staff_users SET role = ?, updated_at = ? WHERE id = ?',
    args: [role, nowIso(), id]
  })
  return get(id)
}

async function markWizardDone(id) {
  const current = await get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  await client.execute({
    sql: 'UPDATE staff_users SET wizard_completed = 1, updated_at = ? WHERE id = ?',
    args: [nowIso(), id]
  })
  return get(id)
}

async function update(id, { display_name }) {
  const current = await get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  const nextName = (display_name || '').trim() || current.display_name
  await client.execute({
    sql: 'UPDATE staff_users SET display_name = ?, updated_at = ? WHERE id = ?',
    args: [nextName, nowIso(), id]
  })
  return get(id)
}

async function resetPassword(id, newPassword) {
  if (!newPassword) throw new Error('Vui lòng nhập mật khẩu mới.')
  const current = await get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  await client.execute({
    sql: 'UPDATE staff_users SET password_hash = ?, updated_at = ? WHERE id = ?',
    args: [hashPassword(newPassword), nowIso(), id]
  })
  return get(id)
}

async function remove(id) {
  await client.execute({ sql: 'DELETE FROM staff_users WHERE id = ?', args: [id] })
  return true
}

async function login(username, password) {
  const row = await getByUsername((username || '').trim())
  const invalid = () => new Error('Sai tên đăng nhập hoặc mật khẩu.')
  if (!row) throw invalid()
  if (row.status === 'PENDING') throw new Error('Tài khoản đang chờ Quản trị viên phê duyệt.')
  if (row.status !== 'ACTIVE') throw invalid()
  if (!verifyPassword(password || '', row.password_hash)) throw invalid()
  // Nhan vien duoc thang vai tro ADMIN (qua setRole) phai nhan token loai
  // "admin" thi moi goi duoc cac route quan tri (GET /api/staff, duyet,
  // xoa...) - dung dung theo cot role trong DB, khong phai theo cach dang
  // nhap (ho van dang nhap qua /login/staff nhu binh thuong).
  const token = row.role === 'ADMIN' ? issueAdminToken() : issueStaffToken(row.id)
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    wizard_completed: row.wizard_completed,
    role: row.role,
    token
  }
}

module.exports = {
  list,
  get,
  create,
  register,
  approve,
  update,
  setStatus,
  setRole,
  markWizardDone,
  resetPassword,
  remove,
  login
}
