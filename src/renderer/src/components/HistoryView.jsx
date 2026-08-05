import React, { useEffect, useMemo, useState } from 'react'
import { toast } from '../lib/toast.js'
import StatusBadge from './StatusBadge.jsx'
import { ALL_JOB_STATUSES, JOB_STATUS_LABEL_VI, TARGET_TYPE_LABEL_VI, RETRYABLE_STATUSES } from '../constants/statusMap'

export default function HistoryView({ title, description, initialStatus = '' }) {
  const [rows, setRows] = useState([])
  const [counts, setCounts] = useState({})
  const [accounts, setAccounts] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)

  const [status, setStatus] = useState(initialStatus)
  const [accountId, setAccountId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [campaign, setCampaign] = useState('')
  const [keyword, setKeyword] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [detailJob, setDetailJob] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [retryingId, setRetryingId] = useState(null)

  function buildFilters(withStatus = true) {
    const f = {}
    if (withStatus && status) f.status = status
    if (accountId) f.accountId = Number(accountId)
    if (groupId) f.groupId = Number(groupId)
    if (campaign) f.campaign = campaign
    if (keyword) f.keyword = keyword
    if (dateFrom) f.dateFrom = new Date(dateFrom).toISOString()
    if (dateTo) f.dateTo = new Date(dateTo + 'T23:59:59').toISOString()
    return f
  }

  async function load() {
    setLoading(true)
    try {
      const [jobRows, countRows] = await Promise.all([
        window.api.posts.listJobs(buildFilters(true)),
        window.api.posts.statusCounts(buildFilters(false))
      ])
      setRows(jobRows)
      setCounts(countRows)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    window.api.accounts.list().then(setAccounts).catch(() => {})
    window.api.groups.list().then(setGroups).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, accountId, groupId, campaign, keyword, dateFrom, dateTo])

  async function recheck(job) {
    setBusyId(job.id)
    try {
      await window.api.posts.recheckJob(job.id)
      toast.info('Đã kiểm tra lại trạng thái.')
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function retry(job) {
    setRetryingId(job.id)
    try {
      await window.api.posts.retryJob(job.id)
      toast.info(`Đang đăng lại vào "${job.target_name}"...`)
      // queue:start cho ca chien dich (post_id) - vi chi job nay dang o
      // trang thai QUEUED (cac job khac cua chien dich da xong tu truoc),
      // hang doi se chi xu ly dung job vua duoc dat lai nay.
      await window.api.queue.start(job.post_id)
      toast.info('Đã đăng lại xong, xem kết quả trong bảng bên dưới.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRetryingId(null)
      load()
    }
  }

  async function removeRow(job) {
    if (!confirm('Xóa dòng lịch sử này?')) return
    try {
      await window.api.posts.deleteJob(job.id)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function copyContent(job) {
    navigator.clipboard.writeText(job.content)
    toast.info('Đã sao chép nội dung.')
  }

  function openOnFacebook(job) {
    if (!job.post_url) return toast.error('Chưa có link bài viết.')
    window.api.system.openExternal(job.post_url)
  }

  async function exportCsv() {
    try {
      const filePath = await window.api.posts.exportHistoryCsv(buildFilters(true))
      if (filePath) toast.info(`Đã xuất báo cáo: ${filePath}`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const totalCount = counts.__total || 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={exportCsv}>Xuất CSV</button>
        </div>
      </div>

      <div className="warning-banner">
        Trạng thái duyệt bài được xác định dựa trên thông tin hiển thị trên Facebook và có thể không chính xác tuyệt đối.
      </div>

      <div className="chip-row">
        <span className={`filter-chip ${status === '' ? 'active' : ''}`} onClick={() => setStatus('')}>Tất cả ({totalCount})</span>
        {ALL_JOB_STATUSES.map((s) => (
          <span key={s} className={`filter-chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
            {JOB_STATUS_LABEL_VI[s]} ({counts[s] || 0})
          </span>
        ))}
      </div>

      <div className="filter-bar">
        <div className="field">
          <label>Tài khoản</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Tất cả</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Nhóm (chỉ áp dụng cho đích loại Nhóm)</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">Tất cả</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.group_name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Chiến dịch</label>
          <input type="text" value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="Tên chiến dịch..." />
        </div>
        <div className="field">
          <label>Từ khóa nội dung</label>
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Tìm trong nội dung..." />
        </div>
        <div className="field">
          <label>Từ ngày</label>
          <input type="text" placeholder="yyyy-mm-dd" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>Đến ngày</label>
          <input type="text" placeholder="yyyy-mm-dd" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Chiến dịch</th>
              <th>Người thực hiện</th>
              <th>Tài khoản</th>
              <th>Đích đăng</th>
              <th>Nội dung</th>
              <th>Bắt đầu</th>
              <th>Đăng lúc</th>
              <th>Trạng thái</th>
              <th>Link bài</th>
              <th>Lỗi</th>
              <th>KT cuối</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={12} className="empty-state">Đang tải...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={12} className="empty-state">Không có dữ liệu phù hợp bộ lọc.</td></tr>}
            {rows.map((job) => (
              <tr key={job.id}>
                <td>{job.campaign_name}</td>
                <td className="text-muted">{job.performed_by || '—'}</td>
                <td>{job.account_name}</td>
                <td>
                  <span className="badge badge-blue" style={{ marginRight: 6 }}>{TARGET_TYPE_LABEL_VI[job.target_type] || job.target_type}</span>
                  {job.target_name}
                </td>
                <td style={{ maxWidth: 220 }}>
                  <span title={job.content}>{job.content?.slice(0, 60)}{job.content?.length > 60 ? '…' : ''}</span>
                </td>
                <td className="text-muted">{job.created_at ? new Date(job.created_at).toLocaleString('vi-VN') : '—'}</td>
                <td className="text-muted">{job.posted_at ? new Date(job.posted_at).toLocaleString('vi-VN') : '—'}</td>
                <td><StatusBadge status={job.status} /></td>
                <td>{job.post_url ? <a href="#" onClick={(e) => { e.preventDefault(); openOnFacebook(job) }}>Mở link</a> : '—'}</td>
                <td className="text-muted" style={{ maxWidth: 160 }}>{job.error_message || '—'}</td>
                <td className="text-muted">{job.last_checked_at ? new Date(job.last_checked_at).toLocaleString('vi-VN') : '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => setDetailJob(job)}>Chi tiết</button>
                    <button className="btn btn-sm" disabled={busyId === job.id} onClick={() => recheck(job)}>Kiểm tra lại</button>
                    {RETRYABLE_STATUSES.has(job.status) && (
                      <button className="btn btn-sm" disabled={retryingId !== null} onClick={() => retry(job)}>
                        {retryingId === job.id ? 'Đang đăng lại...' : 'Đăng lại'}
                      </button>
                    )}
                    <button className="btn btn-sm" onClick={() => copyContent(job)}>Sao chép ND</button>
                    <button className="btn btn-sm btn-danger" onClick={() => removeRow(job)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detailJob && (
        <div className="modal-backdrop" onClick={() => setDetailJob(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết bài đăng</h3>
              <button className="btn btn-sm" onClick={() => setDetailJob(null)}>✕</button>
            </div>
            <p><strong>Chiến dịch:</strong> {detailJob.campaign_name}</p>
            <p><strong>Tài khoản:</strong> {detailJob.account_name}</p>
            <p><strong>Đích đăng:</strong> {TARGET_TYPE_LABEL_VI[detailJob.target_type] || detailJob.target_type} — {detailJob.target_name} ({detailJob.target_url})</p>
            <p><strong>Trạng thái:</strong> <StatusBadge status={detailJob.status} /></p>
            <p><strong>Nội dung:</strong></p>
            <div className="card" style={{ whiteSpace: 'pre-wrap', background: '#fafbfd' }}>{detailJob.content}</div>
            {detailJob.error_message && <p style={{ color: 'var(--red)' }}><strong>Lỗi:</strong> {detailJob.error_message} ({detailJob.error_code})</p>}
          </div>
        </div>
      )}
    </div>
  )
}
