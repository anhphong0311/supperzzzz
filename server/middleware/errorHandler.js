// Bat cac loi KHONG duoc route tu xu ly (vi du mat ket noi DB) - cac loi
// nghiep vu da biet (sai mat khau, trung ten dang nhap...) da duoc tung
// route tu bat va tra ve status code phu hop, khong roi toi day.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('Loi khong xu ly:', err)
  res.status(500).json({ error: 'Đã xảy ra lỗi không xác định ở máy chủ.' })
}

module.exports = errorHandler
