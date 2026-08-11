import React, { useState } from 'react'
import { toast } from '../lib/toast.js'
import { useAuth } from '../context/AuthContext.jsx'
import ToastHost from './ToastHost.jsx'

const PENDING_MESSAGE = 'Tài khoản đang chờ Quản trị viên phê duyệt.'
const SLOW_LABEL = 'Máy chủ đang khởi động, vui lòng đợi...'

// Cac buoc: chon vai tro -> (Admin) kiem tra da co mat khau tren may chu
// chua -> thiet lap lan dau/dang nhap -> (Nhan vien) dang nhap/dang ky.
//
// Mat khau Admin gio la 1 su that TOAN CUC tren may chu trung tam, KHONG
// con la "lan dau mo phan mem tren may nay" nhu truoc - vi vay KHONG duoc
// chan ca man hinh dau tien theo no nua (se khien nhan vien tren mot may
// moi khong co loi vao "Dang ky"). Chi kiem tra khi nguoi dung THAT SU chon
// vao vai tro Admin.
export default function LoginGate() {
  const { login } = useAuth()
  const [mode, setMode] = useState('choose-role') // setup-admin | choose-role | staff-login | staff-register | registered-pending | admin-password
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pendingNotice, setPendingNotice] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [slow, setSlow] = useState(false)

  function resetFields() {
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setDisplayName('')
    setPendingNotice(false)
  }

  // May chu mien phi co the "ngu" sau thoi gian khong dung - lan goi dau
  // tien sau khi ngu co the mat 10-60 giay de thuc day. Sau 4 giay van chua
  // xong, doi nhan nut sang thong bao ro rang thay vi de nguoi dung tuong
  // app bi treo.
  async function runWithSlowIndicator(task) {
    setSubmitting(true)
    setSlow(false)
    const slowTimer = setTimeout(() => setSlow(true), 4000)
    try {
      await task()
    } finally {
      clearTimeout(slowTimer)
      setSlow(false)
      setSubmitting(false)
    }
  }

  function busyLabel(busyText, idleText) {
    if (!submitting) return idleText
    return slow ? SLOW_LABEL : busyText
  }

  async function enterAdminFlow() {
    resetFields()
    await runWithSlowIndicator(async () => {
      try {
        const hasAdmin = await window.api.auth.hasAdminPassword()
        setMode(hasAdmin ? 'admin-password' : 'setup-admin')
      } catch (err) {
        toast.error(err.message)
      }
    })
  }

  async function submitSetupAdmin(e) {
    e.preventDefault()
    if (password.length < 4) {
      toast.error('Mật khẩu Admin cần ít nhất 4 ký tự.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Hai lần nhập mật khẩu không khớp.')
      return
    }
    await runWithSlowIndicator(async () => {
      try {
        await window.api.auth.setAdminPassword(null, password)
        login('admin')
      } catch (err) {
        toast.error(err.message)
      }
    })
  }

  async function submitStaffLogin(e) {
    e.preventDefault()
    setPendingNotice(false)
    await runWithSlowIndicator(async () => {
      try {
        const identity = await window.api.auth.loginStaff(username, password)
        login(identity.role === 'ADMIN' ? 'admin' : 'staff', identity)
      } catch (err) {
        if (err.message === PENDING_MESSAGE) {
          setPendingNotice(true)
        } else {
          toast.error(err.message)
        }
      }
    })
  }

  async function submitRegister(e) {
    e.preventDefault()
    if (password.length < 4) {
      toast.error('Mật khẩu cần ít nhất 4 ký tự.')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Hai lần nhập mật khẩu không khớp.')
      return
    }
    await runWithSlowIndicator(async () => {
      try {
        await window.api.auth.registerStaff({ username, display_name: displayName, password })
        setMode('registered-pending')
      } catch (err) {
        toast.error(err.message)
      }
    })
  }

  async function submitAdminPassword(e) {
    e.preventDefault()
    await runWithSlowIndicator(async () => {
      try {
        await window.api.auth.loginAdmin(password)
        login('admin')
      } catch (err) {
        toast.error(err.message)
      }
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <ToastHost />
      <div className="card" style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 28 }}>📣</div>
          <h2 style={{ margin: '4px 0 0' }}>FB Multi Poster</h2>
        </div>

        {mode === 'setup-admin' && (
          <form onSubmit={submitSetupAdmin}>
            <p className="hint">Chưa có mật khẩu Quản trị (Admin) nào trên máy chủ. Vui lòng thiết lập trước khi sử dụng.</p>
            <div className="field">
              <label>Mật khẩu Admin mới</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Nhập lại mật khẩu</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {busyLabel('Đang lưu...', 'Thiết lập & vào ứng dụng')}
            </button>
            <button type="button" className="btn btn-sm" disabled={submitting} onClick={() => setMode('choose-role')} style={{ width: '100%', marginTop: 10 }}>
              Quay lại
            </button>
          </form>
        )}

        {mode === 'choose-role' && (
          <div>
            <p className="hint">Chọn vai trò để tiếp tục.</p>
            <button
              className="btn btn-primary"
              disabled={submitting}
              onClick={() => { setMode('staff-login'); resetFields() }}
              style={{ width: '100%', marginBottom: 10 }}
            >
              Vào với vai trò Nhân viên
            </button>
            <button className="btn" disabled={submitting} onClick={enterAdminFlow} style={{ width: '100%', marginBottom: 10 }}>
              {busyLabel('Đang kiểm tra...', 'Vào với vai trò Quản trị (Admin)')}
            </button>
            <p style={{ textAlign: 'center', fontSize: 13 }}>
              Chưa có tài khoản?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('staff-register'); resetFields() }}>Đăng ký</a>
            </p>
          </div>
        )}

        {mode === 'staff-login' && (
          <form onSubmit={submitStaffLogin}>
            {pendingNotice && (
              <div className="hint" style={{ color: 'var(--amber)', marginBottom: 10 }}>
                {PENDING_MESSAGE} Vui lòng thử đăng nhập lại sau khi được duyệt.
              </div>
            )}
            <div className="field">
              <label>Tên đăng nhập</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Mật khẩu</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginBottom: 10 }}>
              {busyLabel('Đang kiểm tra...', 'Đăng nhập')}
            </button>
            <button type="button" className="btn btn-sm" disabled={submitting} onClick={() => setMode('choose-role')} style={{ width: '100%' }}>
              Quay lại
            </button>
          </form>
        )}

        {mode === 'staff-register' && (
          <form onSubmit={submitRegister}>
            <p className="hint">Đăng ký tài khoản Nhân viên — sau khi đăng ký, cần Quản trị viên phê duyệt trước khi đăng nhập được.</p>
            <div className="field">
              <label>Tên đăng nhập</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Tên hiển thị</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="field">
              <label>Mật khẩu</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="field">
              <label>Nhập lại mật khẩu</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginBottom: 10 }}>
              {busyLabel('Đang đăng ký...', 'Đăng ký')}
            </button>
            <button type="button" className="btn btn-sm" disabled={submitting} onClick={() => setMode('choose-role')} style={{ width: '100%' }}>
              Quay lại
            </button>
          </form>
        )}

        {mode === 'registered-pending' && (
          <div>
            <p className="hint" style={{ color: 'var(--amber)' }}>
              Đã đăng ký thành công! Tài khoản của bạn đang chờ Quản trị viên phê duyệt.
              Vui lòng thử đăng nhập lại sau.
            </p>
            <button className="btn btn-primary" onClick={() => { setMode('choose-role'); resetFields() }} style={{ width: '100%' }}>
              Quay lại
            </button>
          </div>
        )}

        {mode === 'admin-password' && (
          <form onSubmit={submitAdminPassword}>
            <div className="field">
              <label>Mật khẩu Admin</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginBottom: 10 }}>
              {busyLabel('Đang kiểm tra...', 'Đăng nhập')}
            </button>
            <button type="button" className="btn btn-sm" disabled={submitting} onClick={() => setMode('choose-role')} style={{ width: '100%' }}>
              Quay lại
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
