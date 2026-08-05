const { getDb } = require('../db/database')
const { hashPassword, verifyPassword } = require('./passwordUtil')

function nowIso() {
  return new Date().toISOString()
}

function list() {
  const db = getDb()
  return db.prepare('SELECT id, username, display_name, status, role, wizard_completed, created_at FROM staff_users ORDER BY id DESC').all()
}

function get(id) {
  const db = getDb()
  return db.prepare('SELECT id, username, display_name, status, role, wizard_completed, created_at FROM staff_users WHERE id = ?').get(id)
}

function getByUsername(username) {
  const db = getDb()
  return db.prepare('SELECT * FROM staff_users WHERE username = ?').get(username)
}

function insert({ username, display_name, password, status }) {
  if (!username || !username.trim()) throw new Error('Vui lòng nhập tên đăng nhập.')
  if (!display_name || !display_name.trim()) throw new Error('Vui lòng nhập tên hiển thị.')
  if (!password) throw new Error('Vui lòng nhập mật khẩu.')
  const db = getDb()
  try {
    const info = db.prepare(`
      INSERT INTO staff_users (username, display_name, password_hash, status)
      VALUES (@username, @display_name, @password_hash, @status)
    `).run({
      username: username.trim(),
      display_name: display_name.trim(),
      password_hash: hashPassword(password),
      status
    })
    return get(info.lastInsertRowid)
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
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
function register({ username, display_name, password }) {
  return insert({ username, display_name, password, status: 'PENDING' })
}

function approve(id) {
  return setStatus(id, 'ACTIVE')
}

function setStatus(id, status) {
  const db = getDb()
  const current = get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  db.prepare('UPDATE staff_users SET status = @status, updated_at = @updated_at WHERE id = @id')
    .run({ id, status, updated_at: nowIso() })
  return get(id)
}

function setRole(id, role) {
  if (role !== 'STAFF' && role !== 'ADMIN') throw new Error('Vai trò không hợp lệ.')
  const db = getDb()
  const current = get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  db.prepare('UPDATE staff_users SET role = @role, updated_at = @updated_at WHERE id = @id')
    .run({ id, role, updated_at: nowIso() })
  return get(id)
}

function markWizardDone(id) {
  const db = getDb()
  const current = get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  db.prepare('UPDATE staff_users SET wizard_completed = 1, updated_at = @updated_at WHERE id = @id')
    .run({ id, updated_at: nowIso() })
  return get(id)
}

function update(id, { display_name }) {
  const db = getDb()
  const current = get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  db.prepare('UPDATE staff_users SET display_name = @display_name, updated_at = @updated_at WHERE id = @id')
    .run({ id, display_name: (display_name || '').trim() || current.display_name, updated_at: nowIso() })
  return get(id)
}

function resetPassword(id, newPassword) {
  if (!newPassword) throw new Error('Vui lòng nhập mật khẩu mới.')
  const db = getDb()
  const current = get(id)
  if (!current) throw new Error(`Không tìm thấy nhân viên id=${id}`)
  db.prepare('UPDATE staff_users SET password_hash = @password_hash, updated_at = @updated_at WHERE id = @id')
    .run({ id, password_hash: hashPassword(newPassword), updated_at: nowIso() })
  return get(id)
}

function remove(id) {
  const db = getDb()
  db.prepare('DELETE FROM staff_users WHERE id = ?').run(id)
  return true
}

function login(username, password) {
  const row = getByUsername((username || '').trim())
  const invalid = () => new Error('Sai tên đăng nhập hoặc mật khẩu.')
  if (!row) throw invalid()
  if (row.status === 'PENDING') throw new Error('Tài khoản đang chờ Quản trị viên phê duyệt.')
  if (row.status !== 'ACTIVE') throw invalid()
  if (!verifyPassword(password || '', row.password_hash)) throw invalid()
  return { id: row.id, username: row.username, display_name: row.display_name, wizard_completed: row.wizard_completed, role: row.role }
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
