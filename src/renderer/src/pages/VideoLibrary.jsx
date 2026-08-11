import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast.js'
import { VIDEO_STATUS_LABEL_VI, VIDEO_STATUS_COLOR } from '../constants/statusMap'
import { useAuth } from '../context/AuthContext.jsx'

// Cai dat Google Sheet ID/tab/file khoa la du lieu CUC BO tren TUNG MAY (giong
// het cach Chrome Profile la cuc bo) - trang "Cai dat" chi Admin vao duoc, nen
// truoc day Nhan vien khong co cach nao tu cau hinh tren may cua ho, du IPC
// settings:* khong thuc su chan theo vai tro. Them khoi cau hinh rut gon
// ngay tai day de Nhan vien tu lam duoc, khong can quyen Admin.
function GoogleSheetInlineConfig({ onConfigured }) {
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingConn, setTestingConn] = useState(false)

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

  async function pickKeyFile() {
    const filePath = await window.api.settings.pickServiceAccountKeyFile()
    if (filePath) setField('google_service_account_key_path', filePath)
  }

  async function save() {
    setSaving(true)
    try {
      await window.api.settings.setMany(values)
      toast.info('Đã lưu cấu hình đồng bộ.')
      onConfigured?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function testConnection() {
    setTestingConn(true)
    try {
      await window.api.settings.setMany(values)
      const result = await window.api.videoLibrary.testConnection()
      toast.info(`Kết nối thành công tới "${result.spreadsheetTitle}" (tab "${result.tabName}").`)
      onConfigured?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setTestingConn(false)
    }
  }

  if (loading) return null

  return (
    <div className="card">
      <h3>Cấu hình đồng bộ Google Sheet (chỉ cần làm 1 lần trên máy này)</h3>
      <p className="hint">Xin thông tin từ Quản trị viên: Google Sheet ID, tên tab, và file khoá Service Account (JSON).</p>
      <div className="field">
        <label>Google Sheet ID</label>
        <input
          type="text"
          value={values.google_sheet_id ?? ''}
          placeholder="Lấy từ URL: docs.google.com/spreadsheets/d/{SHEET_ID}/edit"
          onChange={(e) => setField('google_sheet_id', e.target.value)}
        />
      </div>
      <div className="field">
        <label>Tên tab (sheet con) chứa dữ liệu</label>
        <input
          type="text"
          value={values.google_sheet_tab_name ?? ''}
          placeholder="Sheet1"
          onChange={(e) => setField('google_sheet_tab_name', e.target.value)}
        />
      </div>
      <div className="field">
        <label>File khoá Service Account (JSON)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" readOnly value={values.google_service_account_key_path ?? ''} placeholder="Chưa chọn file..." />
          <button className="btn btn-sm" onClick={pickKeyFile}>Chọn file...</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</button>
        <button className="btn" disabled={testingConn} onClick={testConnection}>{testingConn ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</button>
      </div>
    </div>
  )
}

export default function VideoLibrary() {
  const { role } = useAuth()
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [needsConfig, setNeedsConfig] = useState(false)
  const navigate = useNavigate()

  async function checkConfig() {
    try {
      const settings = await window.api.settings.getAll()
      setNeedsConfig(!settings.google_sheet_id || !settings.google_service_account_key_path)
    } catch (err) {
      // Bo qua - khong chan luong chinh vi 1 loi phu
    }
  }

  async function load() {
    setLoading(true)
    try {
      setVideos(await window.api.videoLibrary.list())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (role !== 'admin') checkConfig()
  }, [])

  async function sync() {
    setSyncing(true)
    try {
      const result = await window.api.videoLibrary.sync()
      toast.info(`Đã đồng bộ ${result.syncedCount} video từ Google Sheet.`)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSyncing(false)
    }
  }

  async function download(video) {
    setBusyId(video.id)
    try {
      await window.api.videoLibrary.download(video.id)
      toast.info('Đã tải video về máy.')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  function useForPost(video) {
    if (!video.local_file_path) {
      toast.error('Chưa tải video này về máy. Bấm "Tải về" trước.')
      return
    }
    navigate('/create-post', {
      state: {
        videoLibraryId: video.id,
        videoPath: video.local_file_path,
        captionHint: video.caption_hint || ''
      }
    })
  }

  async function writeBack(video) {
    setBusyId(video.id)
    try {
      await window.api.videoLibrary.writeBackToSheet(video.id)
      toast.info('Đã ghi kết quả lên Google Sheet.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function removeRow(video) {
    if (!confirm('Xóa video này khỏi danh sách trong tool? (Không xóa file trên Google Drive, không xóa dòng trên Sheet)')) return
    try {
      await window.api.videoLibrary.remove(video.id)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Kho video</h1>
          <p>Đồng bộ danh sách video từ Google Sheet, tải về máy và dùng để tạo bài đăng.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" disabled={syncing} onClick={sync}>
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Google Sheet'}
          </button>
        </div>
      </div>

      <div className="warning-banner">
        Đọc cột A (tên video) và B (link video) trên Google Sheet, ghi lại cột C (link kết quả)
        và D (tick khi đăng xong). Cần cấu hình Google Sheet ID + file khoá Service Account trước
        khi đồng bộ (Admin: vào "Cài đặt"; Nhân viên: điền ở khối bên dưới, chỉ cần làm 1 lần trên
        máy này). Video Google Drive phải được chia sẻ cho email Service Account (hoặc bật "Anyone
        with the link").
      </div>

      {role !== 'admin' && needsConfig && (
        <GoogleSheetInlineConfig onConfigured={() => { setNeedsConfig(false); checkConfig() }} />
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dòng</th>
              <th>Tên video</th>
              <th>Link video</th>
              <th>Trạng thái</th>
              <th>Đã tải về máy</th>
              <th>Link kết quả</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="empty-state">Đang tải...</td></tr>}
            {!loading && videos.length === 0 && (
              <tr><td colSpan={7} className="empty-state">Chưa có video nào. Bấm "Đồng bộ từ Google Sheet" để lấy dữ liệu.</td></tr>
            )}
            {videos.map((v) => (
              <tr key={v.id}>
                <td className="text-muted">{v.sheet_row_number}</td>
                <td style={{ maxWidth: 200 }}>{v.caption_hint || <span className="text-muted">—</span>}</td>
                <td className="text-muted" style={{ maxWidth: 200, wordBreak: 'break-all' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); window.api.system.openExternal(v.video_url) }}>{v.video_url}</a>
                </td>
                <td><span className={`badge badge-${VIDEO_STATUS_COLOR[v.status] || 'gray'}`}>{VIDEO_STATUS_LABEL_VI[v.status] || v.status}</span></td>
                <td>{v.local_file_path ? <span className="badge badge-green">Đã tải</span> : <span className="text-muted">Chưa tải</span>}</td>
                <td className="text-muted" style={{ maxWidth: 160 }}>
                  {v.facebook_post_url && <div><a href="#" onClick={(e) => { e.preventDefault(); window.api.system.openExternal(v.facebook_post_url) }}>Facebook</a></div>}
                  {v.instagram_post_url && <div><a href="#" onClick={(e) => { e.preventDefault(); window.api.system.openExternal(v.instagram_post_url) }}>Instagram</a></div>}
                  {v.threads_post_url && <div><a href="#" onClick={(e) => { e.preventDefault(); window.api.system.openExternal(v.threads_post_url) }}>Threads</a></div>}
                  {v.tiktok_post_url && <div><a href="#" onClick={(e) => { e.preventDefault(); window.api.system.openExternal(v.tiktok_post_url) }}>TikTok</a></div>}
                  {!v.facebook_post_url && !v.instagram_post_url && !v.threads_post_url && !v.tiktok_post_url && '—'}
                  {v.error_message && <div style={{ color: 'var(--red)' }}>{v.error_message}</div>}
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-sm" disabled={busyId === v.id} onClick={() => download(v)}>
                      {busyId === v.id ? 'Đang xử lý...' : 'Tải về'}
                    </button>
                    <button className="btn btn-sm" onClick={() => useForPost(v)}>Dùng để tạo bài đăng</button>
                    <button className="btn btn-sm" disabled={busyId === v.id} onClick={() => writeBack(v)}>Ghi lại lên Sheet</button>
                    <button className="btn btn-sm btn-danger" onClick={() => removeRow(v)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
