const express = require('express')
const sheetsRepo = require('../services/sheetsRepo')
const driveProxy = require('../services/driveProxy')
const requireAnyAuth = require('../middleware/requireAnyAuth')

const router = express.Router()

router.use(requireAnyAuth)

router.get('/status', async (req, res) => {
  try {
    res.json(await sheetsRepo.getStatus())
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/videos', async (req, res) => {
  try {
    res.json(await sheetsRepo.readVideoRows())
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/videos/:rowNumber/result', async (req, res) => {
  try {
    const { resultUrl, done } = req.body || {}
    await sheetsRepo.writeRowResult(Number(req.params.rowNumber), { resultUrl, done })
    res.json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Chuyen tiep truc tiep byte video tu Drive qua server (nhan vien khong can
// key rieng). Dung stream, KHONG buffer ca file vao bo nho, tranh tran RAM
// tren goi Render mien phi voi video lon.
router.get('/download', async (req, res) => {
  const driveUrl = req.query.url
  if (!driveUrl) {
    return res.status(400).json({ error: 'Thiếu tham số url.' })
  }
  try {
    const { stream, fileName, mimeType, size } = await driveProxy.openVideoStream(driveUrl)
    res.setHeader('Content-Type', mimeType)
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
    if (size) res.setHeader('Content-Length', size)
    stream.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: `Lỗi khi tải video: ${err.message}` })
      else res.destroy()
    })
    stream.pipe(res)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

module.exports = router
