const serverClient = require('./serverClient')

// Doi tu settings.admin_password_hash cuc bo sang goi HTTP toi may chu
// trung tam - GIU NGUYEN 3 ham xuat ra de src/main/index.js khong can sua gi.

function hasAdminPassword() {
  return serverClient
    .apiFetch('/api/auth/has-admin-password')
    .then((res) => res.hasAdminPassword)
}

async function setAdminPassword(currentPassword, newPassword) {
  const res = await serverClient.apiFetch('/api/auth/admin-password', {
    method: 'POST',
    body: { currentPassword, newPassword }
  })
  if (res.token) serverClient.setToken(res.token)
  return true
}

async function loginAdmin(password) {
  const res = await serverClient.apiFetch('/api/auth/login/admin', {
    method: 'POST',
    body: { password }
  })
  serverClient.setToken(res.token)
  return { role: 'admin' }
}

module.exports = {
  hasAdminPassword,
  setAdminPassword,
  loginAdmin
}
