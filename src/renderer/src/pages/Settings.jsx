import React, { useEffect, useState } from 'react'
import { toast } from '../lib/toast.js'

const FIELDS = [
  { key: 'delay_between_posts_seconds', label: 'Thời gian chờ giữa hai bài đăng (giây)', type: 'number' },
  { key: 'page_load_timeout_ms', label: 'Thời gian chờ tải trang (ms)', type: 'number' },
  { key: 'media_upload_timeout_ms', label: 'Thời gian chờ tải ảnh (ms)', type: 'number' },
  { key: 'video_processing_timeout_ms', label: 'Thời gian chờ Facebook xử lý video (ms)', type: 'number' },
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

export default function Settings() {
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

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
    </div>
  )
}
