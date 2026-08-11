import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const MENU = [
  { to: '/', label: 'Tổng quan', icon: '📊', end: true },
  { to: '/create-post', label: 'Tạo bài đăng', icon: '📝' },
  { to: '/accounts', label: 'Tài khoản MXH', icon: '👤' },
  { to: '/groups', label: 'Danh sách nhóm', icon: '👥' },
  { to: '/video-library', label: 'Kho video', icon: '🎬' },
  { to: '/schedule', label: 'Lịch đăng tự động', icon: '⏰' },
  { to: '/history', label: 'Lịch sử đăng', icon: '🕒' },
  { to: '/pending-approval', label: 'Bài chờ duyệt', icon: '⏳' },
  { to: '/staff-accounts', label: 'Tài khoản Nhân viên', icon: '🧑‍💼', adminOnly: true },
  { to: '/competitor-pricing', label: 'Theo dõi giá đối thủ', icon: '🛒', adminOnly: true, requiresFlag: 'price_tracking_enabled' },
  { to: '/settings', label: 'Cài đặt', icon: '⚙️', adminOnly: true },
  { to: '/logs', label: 'Nhật ký hệ thống', icon: '🧾' }
]

export default function Sidebar() {
  const { role, logout } = useAuth()
  const [settings, setSettings] = useState({})

  useEffect(() => {
    window.api.settings.getAll().then(setSettings).catch(() => {})
  }, [])

  const items = MENU.filter((item) => {
    if (item.adminOnly && role !== 'admin') return false
    if (item.requiresFlag && String(settings[item.requiresFlag]) !== 'true') return false
    return true
  })

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">📣</span>
        <span>FB Multi Poster</span>
      </div>
      <nav className="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        Chỉ dùng với tài khoản &amp; nhóm bạn được phép quản lý.
        <br />
        <button className="btn btn-sm" onClick={logout} style={{ marginTop: 8, width: '100%' }}>
          Đăng xuất ({role === 'admin' ? 'Quản trị' : 'Nhân viên'})
        </button>
      </div>
    </aside>
  )
}
