const { verifyToken } = require('../services/authRepo')

// Danh cho cac route ma BAT KY nguoi dang nhap nao (Admin hoac Nhan vien)
// cung duoc phep goi - vi du dong bo Kho video, khong lien quan quan tri.
function requireAnyAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' })
  }
  try {
    req.user = verifyToken(token)
    next()
  } catch (err) {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' })
  }
}

module.exports = requireAnyAuth
