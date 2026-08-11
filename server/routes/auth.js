const express = require('express')
const staffRepo = require('../services/staffRepo')
const authRepo = require('../services/authRepo')

const router = express.Router()

const PENDING_MESSAGE = 'Tài khoản đang chờ Quản trị viên phê duyệt.'

router.get('/has-admin-password', async (req, res) => {
  try {
    const hasAdminPassword = await authRepo.hasAdminPassword()
    res.json({ hasAdminPassword })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/register', async (req, res) => {
  const { username, display_name, password } = req.body || {}
  try {
    const staff = await staffRepo.register({ username, display_name, password })
    res.status(201).json(staff)
  } catch (err) {
    const status = String(err.message).includes('đã tồn tại') ? 409 : 400
    res.status(status).json({ error: err.message })
  }
})

router.post('/login/staff', async (req, res) => {
  const { username, password } = req.body || {}
  try {
    const identity = await staffRepo.login(username, password)
    res.json(identity)
  } catch (err) {
    const status = err.message === PENDING_MESSAGE ? 403 : 401
    res.status(status).json({ error: err.message })
  }
})

router.post('/login/admin', async (req, res) => {
  const { password } = req.body || {}
  try {
    const result = await authRepo.loginAdmin(password)
    res.json(result)
  } catch (err) {
    res.status(401).json({ error: err.message })
  }
})

// KHONG yeu cau JWT - tu bao ve bang currentPassword (giong het hanh vi cuc
// bo truoc day), va day cung la cach duy nhat de thiet lap mat khau Admin
// LAN DAU TIEN tren server con trong (chua co JWT nao ma cap).
router.post('/admin-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  try {
    const result = await authRepo.setAdminPassword(currentPassword, newPassword)
    res.json({ ok: true, token: result.token })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router
