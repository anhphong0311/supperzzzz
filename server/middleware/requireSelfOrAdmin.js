const { verifyToken } = require('../services/authRepo')

// Danh rieng cho POST /api/staff/:id/wizard-done - nhan vien tu goi cho
// CHINH HO sau khi hoan tat wizard (khong can quyen Admin), nhung van phai
// co token hop le va id trong token phai khop id trong URL. Admin cung goi
// duoc (vi du xu ly thay).
function requireSelfOrAdmin(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' })
  }
  try {
    const payload = verifyToken(token)
    const targetId = Number(req.params.id)
    if (payload.role === 'admin' || (payload.role === 'staff' && payload.id === targetId)) {
      return next()
    }
    return res.status(403).json({ error: 'Không có quyền thực hiện thao tác này.' })
  } catch (err) {
    res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' })
  }
}

module.exports = requireSelfOrAdmin
