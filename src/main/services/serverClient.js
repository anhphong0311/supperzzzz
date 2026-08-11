const { app } = require('electron')

// TODO: dien URL Render THAT vao day sau khi trien khai xong (xem
// server/README.md) roi build lai ban dong goi. Cho toi luc do, ban dong
// goi se bao loi ket noi ro rang thay vi im lang - dung gia tri placeholder.
const PROD_URL = 'https://REPLACE_WITH_RENDER_URL.onrender.com'

// Che do dev (npm run dev/start, chua dong goi): mac dinh tro vao server
// chay cuc bo (server/README.md), co the doi qua bien moi truong AUTH_SERVER_URL.
const DEV_URL = process.env.AUTH_SERVER_URL || 'http://localhost:4000'

function getBaseUrl() {
  return app.isPackaged ? PROD_URL : DEV_URL
}

// JWT chi giu trong bo nho tien trinh MAIN, khong bao gio di qua IPC ra
// preload/renderer - mat khi tat app (nguoi dung dang nhap lai, dung nhu
// hanh vi hien tai vi chua co "remember me").
let adminToken = null

function setToken(token) {
  adminToken = token
}

function clearToken() {
  adminToken = null
}

const SLOW_AFTER_MS = 4000
const TIMEOUT_MS = 65000 // du cho server free-tier "thuc day" sau khi ngu

/**
 * Goi API server trung tam. `auth: true` -> dinh kem Bearer token hien co.
 * `onSlow` (tuy chon) duoc goi neu request chay qua SLOW_AFTER_MS - dung de
 * UI hien thong bao "May chu dang khoi dong..." trong luc van cho tiep.
 */
async function apiFetch(path, { method = 'GET', body, auth = false, onSlow } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    if (!adminToken) throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')
    headers.Authorization = `Bearer ${adminToken}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const slowTimer = onSlow ? setTimeout(onSlow, SLOW_AFTER_MS) : null

  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })
    let data = null
    try {
      data = await res.json()
    } catch (err) {
      data = null
    }
    if (!res.ok) {
      throw new Error((data && data.error) || `Máy chủ trả về lỗi (mã ${res.status}).`)
    }
    return data
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Không thể kết nối máy chủ (quá thời gian chờ). Vui lòng kiểm tra Internet và thử lại.')
    }
    if (err instanceof TypeError) {
      throw new Error('Không thể kết nối máy chủ. Vui lòng kiểm tra Internet và thử lại.')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
    if (slowTimer) clearTimeout(slowTimer)
  }
}

module.exports = { apiFetch, setToken, clearToken }
