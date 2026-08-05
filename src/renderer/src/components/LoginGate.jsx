import React, { useEffect, useState } from 'react'
import { toast } from '../lib/toast.js'
import { useAuth } from '../context/AuthContext.jsx'
import ToastHost from './ToastHost.jsx'

const PENDING_MESSAGE = 'Tài khoản đang chờ Quản trị viên phê duyệt.'

// Cac buoc: dang kiem tra -> thiet lap mat khau Admin lan dau (neu chua co)
// -> chon vai tro -> (neu can) nhap thong tin cho vai tro da chon.
export default function LoginGate() {
  const { login } = useAuth()
  const [checking, setChecking] = useState(true)
  const [mode, setMode] = useState('choose-role') // setup-admin | choose-role | staff-login | staff-register | registered-pending | admin-password
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pendingNotice, setPendingNotice] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const hasAdmin = await window.api.auth.hasAdminPassword()
        setMode(hasAdmin ? 'choose-role' : 'setup-admin')
      } catch (err) {
        toast.error(err.message)
      } finally {
        setChecking(false)
      }
    })()
  }, [])

  function resetFields() {
    setUsername('')
    setPassword('')
    setConfirmPassword('')
    setDisplayName('')
    setPendingNotice(false)
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
    setSubmitting(true)
    try {
      await window.api.auth.setAdminPassword(null, password)
      login('admin')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitStaffLogin(e) {
    e.preventDefault()
    setSubmitting(true)
    setPendingNotice(false)
    try {
      const identity = await window.api.auth.loginStaff(username, password)
      login(identity.role === 'ADMIN' ? 'admin' : 'staff', identity)
    } catch (err) {
      if (err.message === PENDING_MESSAGE) {
        setPendingNotice(true)
      } else {
        toast.error(err.message)
      }
    } finally {
      setSubmitting(false)
    }
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
    setSubmitting(true)
    try {
      await window.api.auth.registerStaff({ username, display_name: displayName, password })
      setMode('registered-pending')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function submitAdminPassword(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await window.api.auth.loginAdmin(password)
      login('admin')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <ToastHost />
      <div className="card" style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 28 }}>📣</div>
          <h2 style={{ margin: '4px 0 0' }}>FB Multi Poster</h2>
        </div>

        {checking && <p className="text-muted">Đang kiểm tra...</p>}

        {!checking && mode === 'setup-admin' && (
          <form onSubmit={submitSetupAdmin}>
            <p className="hint">Đây là lần đầu mở phần mềm trên máy này. Vui lòng thiết lập mật khẩu Quản trị (Admin) trước khi sử dụng.</p>
            <div className="field">
              <label>Mật khẩu Admin mới</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Nhập lại mật khẩu</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Đang lưu...' : 'Thiết lập & vào ứng dụng'}
            </button>
          </form>
        )}

        {!checking && mode === 'choose-role' && (
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
            <button className="btn" disabled={submitting} onClick={() => { setMode('admin-password'); setPassword('') }} style={{ width: '100%', marginBottom: 10 }}>
              Vào với vai trò Quản trị (Admin)
            </button>
            <p style={{ textAlign: 'center', fontSize: 13 }}>
              Chưa có tài khoản?{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('staff-register'); resetFields() }}>Đăng ký</a>
            </p>
          </div>
        )}

        {!checking && mode === 'staff-login' && (
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
              {submitting ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setMode('choose-role')} style={{ width: '100%' }}>
              Quay lại
            </button>
          </form>
        )}

        {!checking && mode === 'staff-register' && (
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
              {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setMode('choose-role')} style={{ width: '100%' }}>
              Quay lại
            </button>
          </form>
        )}

        {!checking && mode === 'registered-pending' && (
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

        {!checking && mode === 'admin-password' && (
          <form onSubmit={submitAdminPassword}>
            <div className="field">
              <label>Mật khẩu Admin</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%', marginBottom: 10 }}>
              {submitting ? 'Đang kiểm tra...' : 'Đăng nhập'}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setMode('choose-role')} style={{ width: '100%' }}>
              Quay lại
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
