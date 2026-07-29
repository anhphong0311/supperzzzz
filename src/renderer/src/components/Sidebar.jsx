import React from 'react'
import { NavLink } from 'react-router-dom'

const MENU = [
  { to: '/', label: 'Tổng quan', icon: '📊', end: true },
  { to: '/create-post', label: 'Tạo bài đăng', icon: '📝' },
  { to: '/accounts', label: 'Tài khoản Facebook', icon: '👤' },
  { to: '/groups', label: 'Danh sách nhóm', icon: '👥' },
  { to: '/history', label: 'Lịch sử đăng', icon: '🕒' },
  { to: '/pending-approval', label: 'Bài chờ duyệt', icon: '⏳' },
  { to: '/settings', label: 'Cài đặt', icon: '⚙️' },
  { to: '/logs', label: 'Nhật ký hệ thống', icon: '🧾' }
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">📣</span>
        <span>FB Multi Poster</span>
      </div>
      <nav className="sidebar-nav">
        {MENU.map((item) => (
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
      </div>
    </aside>
  )
}
