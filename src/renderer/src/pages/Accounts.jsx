import React, { useEffect, useState } from 'react'
import { toast } from '../lib/toast.js'
import { LOGIN_STATUS_LABEL_VI, ACCOUNT_STATUS_LABEL_VI } from '../constants/statusMap'

const emptyForm = { display_name: '', profile_name: '', browser_profile_path: '', notes: '', fanpage_url: '' }

export default function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [checkingId, setCheckingId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      setAccounts(await window.api.accounts.list())
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
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(acc) {
    setForm({
      display_name: acc.display_name,
      profile_name: acc.profile_name,
      browser_profile_path: acc.browser_profile_path,
      notes: acc.notes || '',
      fanpage_url: acc.fanpage_url || ''
    })
    setEditingId(acc.id)
    setShowForm(true)
  }

  async function pickFolder() {
    const dir = await window.api.accounts.pickProfileFolder()
    if (dir) setForm((f) => ({ ...f, browser_profile_path: dir }))
  }

  async function save() {
    if (!form.display_name.trim()) return toast.error('Vui lòng nhập tên hiển thị.')
    if (!form.browser_profile_path.trim()) return toast.error('Vui lòng chọn đường dẫn Chrome Profile.')
    try {
      if (editingId) {
        await window.api.accounts.update(editingId, form)
        toast.info('Đã cập nhật tài khoản.')
      } else {
        await window.api.accounts.create(form)
        toast.info('Đã thêm tài khoản.')
      }
      setShowForm(false)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function remove(acc) {
    if (!confirm(`Xóa tài khoản "${acc.display_name}" khỏi tool? (Không ảnh hưởng tới tài khoản Facebook thật)`)) return
    try {
      await window.api.accounts.remove(acc.id)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function togglePause(acc) {
    const next = acc.account_status === 'TAM_DUNG' ? 'HOAT_DONG' : 'TAM_DUNG'
    try {
      await window.api.accounts.setStatus(acc.id, next)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function openForLogin(acc) {
    try {
      toast.info(`Đang mở Chrome Profile của "${acc.display_name}" để đăng nhập thủ công...`)
      await window.api.accounts.openProfileForLogin(acc.id)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function checkLogin(acc) {
    setCheckingId(acc.id)
    try {
      await window.api.accounts.checkLoginStatus(acc.id)
      toast.info(`Đã kiểm tra trạng thái đăng nhập cho "${acc.display_name}".`)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCheckingId(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tài khoản Facebook</h1>
          <p>Mỗi tài khoản dùng một Chrome Profile riêng. Bạn cần tự đăng nhập Facebook thủ công trên từng profile.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>+ Thêm tài khoản</button>
        </div>
      </div>

      <div className="warning-banner">
        Tool không lưu mật khẩu Facebook. Mỗi tài khoản chỉ dùng đúng phiên đăng nhập (Chrome Profile) mà bạn đã tự đăng nhập trước đó.
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên hiển thị</th>
              <th>Chrome Profile</th>
              <th>Đăng nhập</th>
              <th>Hoạt động</th>
              <th>Bài đã đăng hôm nay</th>
              <th>Đăng gần nhất</th>
              <th>Fanpage</th>
              <th>Ghi chú</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} className="empty-state">Đang tải...</td></tr>
            )}
            {!loading && accounts.length === 0 && (
              <tr><td colSpan={9} className="empty-state">Chưa có tài khoản nào. Nhấn "+ Thêm tài khoản" để bắt đầu.</td></tr>
            )}
            {accounts.map((acc) => (
              <tr key={acc.id}>
                <td><strong>{acc.display_name}</strong><div className="text-muted">{acc.profile_name}</div></td>
                <td className="mono text-muted" style={{ maxWidth: 220, wordBreak: 'break-all' }}>{acc.browser_profile_path}</td>
                <td>
                  <span className={`badge badge-${acc.login_status === 'DA_DANG_NHAP' ? 'green' : acc.login_status === 'YEU_CAU_XAC_MINH' || acc.login_status === 'HET_PHIEN' ? 'amber' : 'gray'}`}>
                    {LOGIN_STATUS_LABEL_VI[acc.login_status] || acc.login_status}
                  </span>
                </td>
                <td>
                  <span className={`badge badge-${acc.account_status === 'TAM_DUNG' ? 'amber' : 'green'}`}>
                    {ACCOUNT_STATUS_LABEL_VI[acc.account_status] || acc.account_status}
                  </span>
                </td>
                <td>{acc.posts_today}</td>
                <td className="text-muted">{acc.last_posted_at ? new Date(acc.last_posted_at).toLocaleString('vi-VN') : '—'}</td>
                <td className="text-muted" style={{ maxWidth: 180, wordBreak: 'break-all' }}>
                  {acc.fanpage_url
                    ? <a href="#" onClick={(e) => { e.preventDefault(); window.api.system.openExternal(acc.fanpage_url) }}>{acc.fanpage_url}</a>
                    : '—'}
                </td>
                <td className="text-muted">{acc.notes || '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => openForLogin(acc)}>Mở để đăng nhập</button>
                    <button className="btn btn-sm" disabled={checkingId === acc.id} onClick={() => checkLogin(acc)}>
                      {checkingId === acc.id ? 'Đang kiểm tra...' : 'Kiểm tra đăng nhập'}
                    </button>
                    <button className="btn btn-sm" onClick={() => openEdit(acc)}>Sửa</button>
                    <button className="btn btn-sm" onClick={() => togglePause(acc)}>
                      {acc.account_status === 'TAM_DUNG' ? 'Bỏ tạm dừng' : 'Tạm dừng'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(acc)}>Xóa</button>
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
              <h3>{editingId ? 'Sửa tài khoản' : 'Thêm tài khoản'}</h3>
              <button className="btn btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="field">
              <label>Tên hiển thị</label>
              <input type="text" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Ví dụ: Nick 1" />
            </div>
            <div className="field">
              <label>Tên nhận biết (tùy chọn)</label>
              <input type="text" value={form.profile_name} onChange={(e) => setForm({ ...form, profile_name: e.target.value })} placeholder="Ví dụ: Nick 1 - Bán chính" />
            </div>
            <div className="field">
              <label>Đường dẫn Chrome Profile</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={form.browser_profile_path} onChange={(e) => setForm({ ...form, browser_profile_path: e.target.value })} placeholder="Chọn thư mục..." />
                <button className="btn btn-sm" onClick={pickFolder}>Chọn thư mục</button>
              </div>
              <div className="hint">Mỗi tài khoản cần một thư mục riêng biệt để lưu phiên đăng nhập độc lập.</div>
            </div>
            <div className="field">
              <label>Fanpage URL (tuỳ chọn)</label>
              <input type="text" value={form.fanpage_url} onChange={(e) => setForm({ ...form, fanpage_url: e.target.value })} placeholder="https://www.facebook.com/ten-fanpage" />
              <div className="hint">Chỉ nhập nếu tài khoản này là quản trị viên của một Fanpage bạn muốn đăng bài lên.</div>
            </div>
            <div className="field">
              <label>Ghi chú</label>
              <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
