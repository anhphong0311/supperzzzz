const express = require('express')
const staffRepo = require('../services/staffRepo')
const requireAdminAuth = require('../middleware/requireAdminAuth')
const requireSelfOrAdmin = require('../middleware/requireSelfOrAdmin')

const router = express.Router()

// wizard-done duoc phep goi boi CHINH nhan vien do (khong chi Admin) - dang
// ky truoc router.use(requireAdminAuth) o duoi de khoi bi chan nham.
router.post('/:id/wizard-done', requireSelfOrAdmin, async (req, res) => {
  try {
    res.json(await staffRepo.markWizardDone(Number(req.params.id)))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.use(requireAdminAuth)

router.get('/', async (req, res) => {
  try {
    res.json(await staffRepo.list())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    res.status(201).json(await staffRepo.create(req.body || {}))
  } catch (err) {
    const status = String(err.message).includes('đã tồn tại') ? 409 : 400
    res.status(status).json({ error: err.message })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    res.json(await staffRepo.update(Number(req.params.id), req.body || {}))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/status', async (req, res) => {
  try {
    res.json(await staffRepo.setStatus(Number(req.params.id), req.body?.status))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/role', async (req, res) => {
  try {
    res.json(await staffRepo.setRole(Number(req.params.id), req.body?.role))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/approve', async (req, res) => {
  try {
    res.json(await staffRepo.approve(Number(req.params.id)))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/:id/reset-password', async (req, res) => {
  try {
    res.json(await staffRepo.resetPassword(Number(req.params.id), req.body?.newPassword))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    res.json(await staffRepo.remove(Number(req.params.id)))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router
