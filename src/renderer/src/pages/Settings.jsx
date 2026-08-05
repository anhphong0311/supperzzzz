import React, { useEffect, useState } from 'react'
import { toast } from '../lib/toast.js'

const FIELDS = [
  { key: 'delay_between_posts_seconds', label: 'Thời gian chờ giữa hai bài đăng (giây)', type: 'number' },
  { key: 'page_load_timeout_ms', label: 'Thời gian chờ tải trang (ms)', type: 'number' },
  { key: 'media_upload_timeout_ms', label: 'Thời gian chờ tải ảnh (ms)', type: 'number' },
  { key: 'video_processing_timeout_ms', label: 'Thời gian chờ Facebook xử lý video (ms)', type: 'number' },
  { key: 'video_download_timeout_ms', label: 'Thời gian chờ tải video từ Google Drive (ms)', type: 'number' },
  { key: 'max_retry_count', label: 'Số lần thử lại khi lỗi', type: 'number' },
  { key: 'daily_post_limit_per_account', label: 'Giới hạn bài đăng mỗi tài khoản/ngày', type: 'number' },
  { key: 'recheck_interval_minutes', label: 'Thời gian giữa các lần tự kiểm tra trạng thái (phút)', type: 'number' },
  { key: 'browser_executable_path', label: 'Đường dẫn trình duyệt (để trống = tự dò Chrome đã cài)', type: 'text' },
  { key: 'temp_media_dir', label: 'Thư mục lưu ảnh tạm (để trống = dùng mặc định)', type: 'text' },
  { key: 'headless_mode', label: 'Ẩn cửa sổ trình duyệt khi chạy (headless)', type: 'bool' },
  { key: 'auto_close_tab', label: 'Tự đóng tab/trình duyệt sau khi đăng xong 1 tài khoản', type: 'bool' },
  { key: 'auto_recheck_pending', label: 'Tự động kiểm tra lại bài đang chờ duyệt', type: 'bool' },
  { key: 'notifications_enabled', label: 'Bật thông báo', type: 'bool' },
  { key: 'dry_run_default', label: 'Mặc định bật DRY_RUN khi tạo bài mới', type: 'bool' }
]

const GOOGLE_FIELDS = [
  { key: 'google_sheet_id', label: 'Google Sheet ID', placeholder: 'Lấy từ URL: docs.google.com/spreadsheets/d/{SHEET_ID}/edit' },
  { key: 'google_sheet_tab_name', label: 'Tên tab (sheet con) chứa dữ liệu', placeholder: 'Sheet1' }
]

export default function Settings() {
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingConn, setTestingConn] = useState(false)

  const [adminCurrentPw, setAdminCurrentPw] = useState('')
  const [adminNewPw, setAdminNewPw] = useState('')
  const [adminConfirmPw, setAdminConfirmPw] = useState('')
  const [savingAdminPw, setSavingAdminPw] = useState(false)

  async function load() {
    setLoading(true)
    try {
      setValues(await window.api.settings.getAll())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function setField(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    try {
      await window.api.settings.setMany(values)
      toast.info('Đã lưu cài đặt.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function pickKeyFile() {
    const filePath = await window.api.settings.pickServiceAccountKeyFile()
    if (filePath) setField('google_service_account_key_path', filePath)
  }

  async function saveAdminPassword() {
    if (!adminNewPw || adminNewPw.length < 4) {
      toast.error('Mật khẩu Admin mới cần ít nhất 4 ký tự.')
      return
    }
    if (adminNewPw !== adminConfirmPw) {
      toast.error('Hai lần nhập mật khẩu mới không khớp.')
      return
    }
    setSavingAdminPw(true)
    try {
      await window.api.auth.setAdminPassword(adminCurrentPw, adminNewPw)
      toast.info('Đã đổi mật khẩu Admin.')
      setAdminCurrentPw('')
      setAdminNewPw('')
      setAdminConfirmPw('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingAdminPw(false)
    }
  }

  async function testGoogleConnection() {
    setTestingConn(true)
    try {
      // Luu cai dat truoc de dam bao test dung voi gia tri vua nhap (chua bam Luu)
      await window.api.settings.setMany(values)
      const result = await window.api.videoLibrary.testConnection()
      toast.info(`Kết nối thành công tới "${result.spreadsheetTitle}" (tab "${result.tabName}").`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setTestingConn(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Cài đặt</h1>
          <p>Cấu hình chung cho toàn bộ hệ thống.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" disabled={saving || loading} onClick={save}>{saving ? 'Đang lưu...' : 'Lưu cài đặt'}</button>
        </div>
      </div>

      <div className="warning-banner">
        Tool không cung cấp và không được dùng để né tránh hệ thống phát hiện của Facebook (đổi IP, giả mạo thiết bị/vân tay trình duyệt, vượt CAPTCHA/checkpoint...).
      </div>

      {loading ? (
        <p className="text-muted">Đang tải...</p>
      ) : (
        <div className="card">
          {FIELDS.map((f) => (
            <div className="field" key={f.key}>
              {f.type === 'bool' ? (
                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id={f.key}
                    checked={String(values[f.key]) === 'true'}
                    onChange={(e) => setField(f.key, e.target.checked ? 'true' : 'false')}
                  />
                  <label htmlFor={f.key} style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>{f.label}</label>
                </div>
              ) : (
                <>
                  <label>{f.label}</label>
                  <input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <div className="card">
          <h3>Kết nối Google Sheets (Kho video)</h3>
          <p className="hint">
            Xem hướng dẫn tạo Service Account trong README. Sau khi điền đủ 3 mục dưới, bấm "Kiểm tra kết nối" để xác nhận.
          </p>
          {GOOGLE_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label>{f.label}</label>
              <input
                type="text"
                value={values[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={(e) => setField(f.key, e.target.value)}
              />
            </div>
          ))}
          <div className="field">
            <label>File khoá Service Account (JSON)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" readOnly value={values.google_service_account_key_path ?? ''} placeholder="Chưa chọn file..." />
              <button className="btn btn-sm" onClick={pickKeyFile}>Chọn file...</button>
            </div>
          </div>
          <button className="btn" disabled={testingConn} onClick={testGoogleConnection}>
            {testingConn ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
          </button>
        </div>
      )}

      {!loading && (
        <div className="card">
          <h3>Đổi mật khẩu Admin</h3>
          <p className="hint">Mật khẩu Admin dùng để vào phần Cài đặt này. Cần nhập đúng mật khẩu hiện tại mới đổi được.</p>
          <div className="field">
            <label>Mật khẩu Admin hiện tại</label>
            <input type="password" value={adminCurrentPw} onChange={(e) => setAdminCurrentPw(e.target.value)} />
          </div>
          <div className="field">
            <label>Mật khẩu Admin mới</label>
            <input type="password" value={adminNewPw} onChange={(e) => setAdminNewPw(e.target.value)} />
          </div>
          <div className="field">
            <label>Nhập lại mật khẩu mới</label>
            <input type="password" value={adminConfirmPw} onChange={(e) => setAdminConfirmPw(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={savingAdminPw} onClick={saveAdminPassword}>
            {savingAdminPw ? 'Đang lưu...' : 'Đổi mật khẩu Admin'}
          </button>
          <p className="hint" style={{ marginTop: 10 }}>
            Quản lý tài khoản đăng nhập của từng nhân viên ở trang "Tài khoản Nhân viên" riêng.
          </p>
        </div>
      )}
    </div>
  )
}
