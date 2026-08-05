import React, { useEffect, useState } from 'react'
import { toast } from '../lib/toast.js'

const emptyForm = { username: '', display_name: '', password: '' }

export default function StaffAccounts() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingStaff, setEditingStaff] = useState(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [resettingStaff, setResettingStaff] = useState(null)
  const [newPassword, setNewPassword] = useState('')

  async function load() {
    setLoading(true)
    try {
      setStaff(await window.api.staff.list())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function openCreate() {
    setForm(emptyForm)
    setShowForm(true)
  }

  async function save() {
    if (!form.username.trim()) return toast.error('Vui lòng nhập tên đăng nhập.')
    if (!form.display_name.trim()) return toast.error('Vui lòng nhập tên hiển thị.')
    if (!form.password) return toast.error('Vui lòng nhập mật khẩu.')
    try {
      await window.api.staff.create(form)
      toast.info('Đã thêm tài khoản nhân viên.')
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function openEdit(s) {
    setEditingStaff(s)
    setEditDisplayName(s.display_name)
  }

  async function saveEdit() {
    if (!editDisplayName.trim()) return toast.error('Vui lòng nhập tên hiển thị.')
    try {
      await window.api.staff.update(editingStaff.id, { display_name: editDisplayName })
      toast.info('Đã cập nhật tên hiển thị.')
      setEditingStaff(null)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function openReset(s) {
    setResettingStaff(s)
    setNewPassword('')
  }

  async function saveReset() {
    if (!newPassword) return toast.error('Vui lòng nhập mật khẩu mới.')
    try {
      await window.api.staff.resetPassword(resettingStaff.id, newPassword)
      toast.info(`Đã đặt lại mật khẩu cho "${resettingStaff.display_name}".`)
      setResettingStaff(null)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function toggleActive(s) {
    try {
      await window.api.staff.setStatus(s.id, s.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function toggleRole(s) {
    const next = s.role === 'ADMIN' ? 'STAFF' : 'ADMIN'
    if (next === 'ADMIN' && !confirm(`Đặt "${s.display_name}" làm Admin? Người này sẽ có toàn quyền như bạn, kể cả vào Cài đặt và quản lý tài khoản nhân viên khác.`)) return
    try {
      await window.api.staff.setRole(s.id, next)
      toast.info(next === 'ADMIN' ? `Đã đặt "${s.display_name}" làm Admin.` : `Đã đặt "${s.display_name}" về Nhân viên.`)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function approve(s) {
    try {
      await window.api.staff.approve(s.id)
      toast.info(`Đã duyệt tài khoản "${s.display_name}".`)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function remove(s) {
    const verb = s.status === 'PENDING' ? 'Từ chối' : 'Xóa'
    if (!confirm(`${verb} tài khoản nhân viên "${s.display_name}" (${s.username})? Không thể hoàn tác.`)) return
    try {
      await window.api.staff.remove(s.id)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tài khoản Nhân viên</h1>
          <p>Mỗi nhân viên có tên đăng nhập/mật khẩu riêng — bài đăng họ tạo ra sẽ ghi lại đúng tên họ trong Lịch sử.
            Có thể đặt một số tài khoản làm <strong>Admin</strong> để họ tự quản lý được (mật khẩu Admin chung vẫn luôn dùng được như phương án dự phòng).</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>+ Thêm nhân viên</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên đăng nhập</th>
              <th>Tên hiển thị</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="empty-state">Đang tải...</td></tr>
            )}
            {!loading && staff.length === 0 && (
              <tr><td colSpan={6} className="empty-state">Chưa có tài khoản nhân viên nào. Nhấn "+ Thêm nhân viên" để bắt đầu.</td></tr>
            )}
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.username}</td>
                <td><strong>{s.display_name}</strong></td>
                <td>
                  <span className={`badge badge-${s.role === 'ADMIN' ? 'blue' : 'gray'}`}>
                    {s.role === 'ADMIN' ? 'Admin' : 'Nhân viên'}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${s.status === 'PENDING' ? 'amber' : s.status === 'LOCKED' ? 'amber' : 'green'}`}>
                    {s.status === 'PENDING' ? 'Chờ duyệt' : s.status === 'LOCKED' ? 'Đã khóa' : 'Hoạt động'}
                  </span>
                </td>
                <td className="text-muted">{s.created_at ? new Date(s.created_at).toLocaleString('vi-VN') : '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {s.status === 'PENDING' && (
                      <button className="btn btn-sm btn-primary" onClick={() => approve(s)}>Duyệt</button>
                    )}
                    <button className="btn btn-sm" onClick={() => toggleRole(s)}>
                      {s.role === 'ADMIN' ? 'Đặt về Nhân viên' : 'Đặt làm Admin'}
                    </button>
                    <button className="btn btn-sm" onClick={() => openEdit(s)}>Sửa tên hiển thị</button>
                    <button className="btn btn-sm" onClick={() => openReset(s)}>Đặt lại mật khẩu</button>
                    {s.status !== 'PENDING' && (
                      <button className="btn btn-sm" onClick={() => toggleActive(s)}>
                        {s.status === 'LOCKED' ? 'Mở khóa' : 'Khóa'}
                      </button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s)}>
                      {s.status === 'PENDING' ? 'Từ chối' : 'Xóa'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm nhân viên</h3>
              <button className="btn btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="field">
              <label>Tên đăng nhập</label>
              <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Ví dụ: long" />
            </div>
            <div className="field">
              <label>Tên hiển thị</label>
              <input type="text" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Ví dụ: Long" />
            </div>
            <div className="field">
              <label>Mật khẩu</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {editingStaff && (
        <div className="modal-backdrop" onClick={() => setEditingStaff(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Sửa tên hiển thị</h3>
              <button className="btn btn-sm" onClick={() => setEditingStaff(null)}>✕</button>
            </div>
            <div className="field">
              <label>Tên hiển thị</label>
              <input type="text" value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setEditingStaff(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={saveEdit}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {resettingStaff && (
        <div className="modal-backdrop" onClick={() => setResettingStaff(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Đặt lại mật khẩu — {resettingStaff.display_name}</h3>
              <button className="btn btn-sm" onClick={() => setResettingStaff(null)}>✕</button>
            </div>
            <div className="field">
              <label>Mật khẩu mới</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoFocus />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setResettingStaff(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={saveReset}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
