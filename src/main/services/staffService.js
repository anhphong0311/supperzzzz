const serverClient = require('./serverClient')

// Doi tu doc SQLite cuc bo sang goi HTTP toi may chu trung tam - GIU NGUYEN
// ten/chu ky ham xuat ra de src/main/index.js (IPC handlers) khong can sua gi.
// Xem plan: C:\Users\Admin\.claude\plans\velvet-imagining-petal.md

function list() {
  return serverClient.apiFetch('/api/staff', { auth: true })
}

function get(id) {
  return list().then((rows) => rows.find((r) => r.id === id) || null)
}

// Admin tao truc tiep (trang Tai khoan Nhan vien) - vao thang duoc ngay.
function create(data) {
  return serverClient.apiFetch('/api/staff', { method: 'POST', body: data, auth: true })
}

// Nhan vien tu dang ky tu man hinh dang nhap - phai cho Admin duyet.
function register(data) {
  return serverClient.apiFetch('/api/auth/register', { method: 'POST', body: data })
}

function approve(id) {
  return serverClient.apiFetch(`/api/staff/${id}/approve`, { method: 'POST', auth: true })
}

function update(id, data) {
  return serverClient.apiFetch(`/api/staff/${id}`, { method: 'PATCH', body: data, auth: true })
}

function setStatus(id, status) {
  return serverClient.apiFetch(`/api/staff/${id}/status`, { method: 'POST', body: { status }, auth: true })
}

function setRole(id, role) {
  return serverClient.apiFetch(`/api/staff/${id}/role`, { method: 'POST', body: { role }, auth: true })
}

// Nhan vien tu goi cho CHINH HO sau khi hoan tat wizard - server chap nhan
// ca token Admin lan token cua chinh nhan vien do (khong bat buoc phai la
// Admin), nen van goi voi auth:true (dinh kem token dang co, du la loai nao).
function markWizardDone(id) {
  return serverClient.apiFetch(`/api/staff/${id}/wizard-done`, { method: 'POST', auth: true })
}

function resetPassword(id, newPassword) {
  return serverClient.apiFetch(`/api/staff/${id}/reset-password`, {
    method: 'POST',
    body: { newPassword },
    auth: true
  })
}

function remove(id) {
  return serverClient.apiFetch(`/api/staff/${id}`, { method: 'DELETE', auth: true })
}

async function login(username, password) {
  const identity = await serverClient.apiFetch('/api/auth/login/staff', {
    method: 'POST',
    body: { username, password }
  })
  // Nhan vien duoc thang vai tro ADMIN (setRole) van dang nhap qua day (khong
  // qua man Admin) - token cua ho van dung de goi cac route quan tri, vi
  // server tu cap dung quyen theo role luu trong DB, khong phai theo cach
  // dang nhap. Luu token nay lam token "hien hanh" de cac thao tac quan tri
  // tiep theo (vi du StaffAccounts.jsx) hoat dong duoc trong phien nay.
  if (identity.token) serverClient.setToken(identity.token)
  return identity
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
