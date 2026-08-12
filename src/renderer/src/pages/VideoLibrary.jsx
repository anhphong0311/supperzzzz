import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast.js'
import { VIDEO_STATUS_LABEL_VI, VIDEO_STATUS_COLOR } from '../constants/statusMap'

export default function VideoLibrary() {
  const [videos, setVideos] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [linkPickerVideo, setLinkPickerVideo] = useState(null)
  const [pickedAccountId, setPickedAccountId] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const navigate = useNavigate()

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
    window.api.accounts.list().then(setAccounts).catch(() => {})
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

  async function doWriteBack(id) {
    setBusyId(id)
    try {
      await window.api.videoLibrary.writeBackToSheet(id)
      toast.info('Đã ghi kết quả lên Google Sheet.')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  function writeBack(video) {
    const hasAnyLink = video.facebook_post_url || video.instagram_post_url || video.threads_post_url || video.tiktok_post_url
    // Neu chua co link nao ma da dang xong roi - rat co the day la bai TikTok
    // (nen tang duy nhat khong tu lay duoc link) dang tu truoc khi co tinh
    // nang lay link nay - hoi chon tai khoan de thu lay link that truoc khi ghi.
    if (!hasAnyLink && video.status === 'DA_DANG') {
      setPickedAccountId('')
      setLinkPickerVideo(video)
      return
    }
    doWriteBack(video.id)
  }

  async function confirmFetchLink() {
    const video = linkPickerVideo
    const accountId = Number(pickedAccountId)
    setLinkPickerVideo(null)
    if (!accountId) {
      await doWriteBack(video.id)
      return
    }
    setBusyId(video.id)
    try {
      toast.info('Đang mở Chrome Profile để lấy link TikTok...')
      const result = await window.api.videoLibrary.fetchTiktokLink(video.id, accountId)
      toast.info(result.postUrl ? 'Đã lấy được link bài đăng TikTok.' : 'Không tự lấy được link (best-effort) - sẽ ghi Sheet không kèm link.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
    await doWriteBack(video.id)
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
          <button className="btn" onClick={() => setShowGuide(true)}>📖 Hướng dẫn</button>
          <button className="btn btn-primary" disabled={syncing} onClick={sync}>
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ từ Google Sheet'}
          </button>
        </div>
      </div>

      <div className="warning-banner">
        Đọc cột A (tên video) và B (link video) trên Google Sheet, ghi lại cột C (link kết quả)
        và D (tick khi đăng xong). Bấm "Đồng bộ" là dùng được ngay — không cần cấu hình gì thêm,
        Google Sheet/Drive đã được kết nối sẵn qua máy chủ chung.
      </div>

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

      {linkPickerVideo && (
        <div className="modal-backdrop" onClick={() => setLinkPickerVideo(null)}>
          <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Lấy link bài đăng TikTok?</h3>
              <button className="btn btn-sm" onClick={() => setLinkPickerVideo(null)}>✕</button>
            </div>
            <p className="hint">
              Video "{linkPickerVideo.caption_hint}" đã đăng xong nhưng chưa có link. Chọn tài khoản
              đã dùng để đăng video này — tool sẽ mở Chrome Profile của tài khoản đó và thử lấy link
              thật (best-effort) trước khi ghi lên Sheet.
            </p>
            <div className="field">
              <label>Tài khoản</label>
              <select value={pickedAccountId} onChange={(e) => setPickedAccountId(e.target.value)}>
                <option value="">-- Bỏ qua, ghi luôn không kèm link --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.display_name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setLinkPickerVideo(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={confirmFetchLink}>Tiếp tục</button>
            </div>
          </div>
        </div>
      )}

      {showGuide && (
        <div className="modal-backdrop" onClick={() => setShowGuide(false)}>
          <div className="modal" style={{ width: 560, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Hướng dẫn dùng Kho video</h3>
              <button className="btn btn-sm" onClick={() => setShowGuide(false)}>✕</button>
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
              <li>
                Bấm <strong>"Đồng bộ từ Google Sheet"</strong> — tool tự lấy danh sách video mới nhất
                từ Google Sheet chung của công ty về (cột "Tên video" và "Link video"). Không cần cấu
                hình gì cả, đã kết nối sẵn qua máy chủ chung.
              </li>
              <li>
                Ở dòng video muốn dùng, bấm <strong>"Tải về"</strong> để tải file video từ Google Drive
                xuống máy (chờ vài giây tới vài phút tuỳ dung lượng video). Tải xong sẽ thấy nhãn xanh
                <strong> "Đã tải"</strong>.
              </li>
              <li>
                Bấm <strong>"Dùng để tạo bài đăng"</strong> — tool chuyển sang trang <strong>Tạo bài
                đăng</strong> và tự điền sẵn video + nội dung gợi ý. Chọn tài khoản/nhóm muốn đăng vào,
                kiểm tra lại nội dung.
              </li>
              <li>
                <strong>Nên bật DRY_RUN</strong> để chạy thử trước (không đăng thật), kiểm tra ảnh/video/nội
                dung điền đúng chưa. Ưng ý rồi mới tắt DRY_RUN và bấm đăng thật.
              </li>
              <li>
                Đăng xong, quay lại <strong>Kho video</strong>, bấm <strong>"Ghi lại lên Sheet"</strong>{' '}
                để ghi lại kết quả (link bài đăng + đánh dấu "Đã đăng") ngược về Google Sheet cho mọi
                người cùng xem.
                <div className="hint" style={{ marginTop: 4 }}>
                  Riêng <strong>TikTok</strong> không tự đưa ra link ngay khi đăng — nếu bấm "Ghi lại
                  lên Sheet" mà chưa có link, tool sẽ hỏi bạn chọn đúng tài khoản đã dùng để đăng video
                  đó, rồi tự mở Chrome tìm link giúp (có thể mất khoảng 10-20 giây).
                </div>
              </li>
              <li>
                Muốn bỏ 1 video khỏi danh sách trong tool (không xoá gì trên Google Sheet/Drive), bấm{' '}
                <strong>"Xóa"</strong> ở dòng đó.
              </li>
            </ol>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn btn-primary" onClick={() => setShowGuide(false)}>Đã hiểu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
