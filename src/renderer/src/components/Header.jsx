import React from 'react'
import { useAuth } from '../context/AuthContext.jsx'

// Thanh header ngang phia tren noi dung trang - THUAN TRINH BAY, khong them
// logic tim kiem/thong bao that (o tim kiem chi trang tri, chuong thong bao
// la icon tinh) - chi doc lai performedByLabel/role da co san tu AuthContext
// de hien avatar/ten, khong tao them state hay goi API nao moi.
export default function Header() {
  const { performedByLabel, role } = useAuth()
  const initial = (performedByLabel || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="topbar">
      <div className="topbar-search">
        <span aria-hidden="true">🔍</span>
        <input type="text" placeholder="Tìm kiếm..." disabled />
      </div>
      <button type="button" className="topbar-icon-btn" title="Thông báo">
        🔔
        <span className="dot" />
      </button>
      <div className="topbar-avatar">{initial}</div>
      <div className="topbar-user">
        <span className="topbar-user-name">{performedByLabel}</span>
        <span className="topbar-user-role">{role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</span>
      </div>
    </div>
  )
}
