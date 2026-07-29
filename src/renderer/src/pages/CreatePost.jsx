import React, { useEffect, useMemo, useState } from 'react'
import { toast } from '../lib/toast.js'
import StatusBadge from '../components/StatusBadge.jsx'

const MAX_CONTENT_LENGTH = 5000

export default function CreatePost() {
  const [campaignName, setCampaignName] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState([])
  const [delaySeconds, setDelaySeconds] = useState(30)
  const [dryRun, setDryRun] = useState(true)

  const [accounts, setAccounts] = useState([])
  const [selectedAccountIds, setSelectedAccountIds] = useState(new Set())
  const [groupsByAccount, setGroupsByAccount] = useState({})
  const [selectedGroupsByAccount, setSelectedGroupsByAccount] = useState({})
  const [groupSearch, setGroupSearch] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [running, setRunning] = useState(null) // { postId, totalJobs, completedCount, jobs: [], queueState }
  const [logLines, setLogLines] = useState([])

  useEffect(() => {
    window.api.accounts.list().then(setAccounts).catch((err) => toast.error(err.message))
    window.api.settings.getAll().then((s) => {
      setDryRun(String(s.dry_run_default) === 'true')
      setDelaySeconds(Number(s.delay_between_posts_seconds || 30))
    })
  }, [])

  useEffect(() => {
    const offProgress = window.api.queue.onProgress((data) => {
      setRunning((prev) => {
        if (!prev || prev.postId !== data.postId) return prev
        const jobs = prev.jobs.map((j) => (j.id === data.jobId ? { ...j, status: data.status } : j))
        return { ...prev, jobs, completedCount: data.completedCount, totalJobs: data.totalJobs }
      })
    })
    const offLog = window.api.queue.onLog((data) => {
      setLogLines((prev) => [...prev.slice(-200), data])
    })
    const offState = window.api.queue.onStateChanged((data) => {
      setRunning((prev) => (prev ? { ...prev, queueState: data.state } : prev))
    })
    const offManual = window.api.queue.onManualIntervention((data) => {
      toast.error(`Cần xử lý thủ công: ${data.message}`)
    })
    const offFinished = window.api.queue.onCampaignFinished((data) => {
      setRunning((prev) => (prev && prev.postId === data.postId ? { ...prev, finished: true } : prev))
      toast.info(data.stopped ? 'Chiến dịch đã dừng.' : 'Chiến dịch đã hoàn tất.')
    })
    return () => { offProgress(); offLog(); offState(); offManual(); offFinished() }
  }, [])

  async function pickImages() {
    const paths = await window.api.media.pickImages()
    if (paths?.length) {
      setImages((prev) => [...prev, ...paths.map((p) => ({ path: p }))])
    }
  }

  function removeImage(idx) {
    setImages((prev) => prev.filter((_, i) => i !== idx))
  }

  function moveImage(idx, dir) {
    setImages((prev) => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  async function toggleAccount(accountId) {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
    if (!groupsByAccount[accountId]) {
      try {
        const rows = await window.api.accountGroups.listForAccount(accountId)
        setGroupsByAccount((prev) => ({ ...prev, [accountId]: rows }))
      } catch (err) {
        toast.error(err.message)
      }
    }
  }

  function toggleGroup(accountId, groupId) {
    setSelectedGroupsByAccount((prev) => {
      const set = new Set(prev[accountId] || [])
      if (set.has(groupId)) set.delete(groupId)
      else set.add(groupId)
      return { ...prev, [accountId]: set }
    })
  }

  function selectAllGroups() {
    const next = {}
    selectedAccountIds.forEach((accountId) => {
      const rows = groupsByAccount[accountId] || []
      next[accountId] = new Set(rows.filter((r) => r.can_post).map((r) => r.group_id))
    })
    setSelectedGroupsByAccount(next)
  }

  function clearAllGroups() {
    setSelectedGroupsByAccount({})
  }

  const totalSelectedJobs = useMemo(() => {
    return Object.values(selectedGroupsByAccount).reduce((sum, set) => sum + set.size, 0)
  }, [selectedGroupsByAccount])

  function buildSelections() {
    const selections = []
    Object.entries(selectedGroupsByAccount).forEach(([accountId, groupSet]) => {
      groupSet.forEach((groupId) => selections.push({ account_id: Number(accountId), group_id: groupId }))
    })
    return selections
  }

  function buildPayload() {
    return {
      campaign_name: campaignName,
      content,
      dry_run: dryRun,
      delay_seconds: Number(delaySeconds) || 0,
      media: images.map((img) => ({ file_path: img.path, file_type: 'image' })),
      selections: buildSelections()
    }
  }

  function validate() {
    if (!content.trim()) return 'Nội dung bài viết không được để trống.'
    if (selectedAccountIds.size === 0) return 'Chưa chọn tài khoản Facebook nào.'
    if (totalSelectedJobs === 0) return 'Chưa chọn nhóm nào để đăng.'
    return null
  }

  async function saveDraft() {
    const err = validate()
    if (err) return toast.error(err)
    setSubmitting(true)
    try {
      const campaign = await window.api.posts.createCampaign(buildPayload())
      toast.info(`Đã lưu bản nháp "${campaign.campaign_name}" với ${campaign.jobs.length} nhóm.`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function startPosting() {
    const err = validate()
    if (err) return toast.error(err)
    setSubmitting(true)
    setLogLines([])
    try {
      const campaign = await window.api.posts.createCampaign(buildPayload())
      setRunning({ postId: campaign.id, totalJobs: campaign.jobs.length, completedCount: 0, jobs: campaign.jobs, queueState: 'RUNNING' })
      window.api.queue.start(campaign.id).catch((e) => toast.error(e.message))
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function pauseQueue() { await window.api.queue.pause().catch((e) => toast.error(e.message)) }
  async function resumeQueue() { await window.api.queue.resume().catch((e) => toast.error(e.message)) }
  async function stopQueue() {
    if (!running) return
    await window.api.posts.stopCampaign(running.postId).catch((e) => toast.error(e.message))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tạo bài đăng</h1>
          <p>Nhập nội dung một lần, chọn tài khoản và nhóm tương ứng, sau đó đăng tuần tự.</p>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="card">
            <h3>Nội dung bài viết</h3>
            <div className="field">
              <label>Tên chiến dịch / bài đăng</label>
              <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ví dụ: Khuyến mãi tháng 7" />
            </div>
            <div className="field">
              <label>Nội dung (dùng chung cho tất cả nhóm)</label>
              <textarea rows={8} maxLength={MAX_CONTENT_LENGTH} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Nhập nội dung bài viết..." />
              <div className="hint">{content.length}/{MAX_CONTENT_LENGTH} ký tự</div>
            </div>
            <div className="field">
              <label>Ảnh đính kèm</label>
              <button className="btn btn-sm" onClick={pickImages}>+ Chọn ảnh</button>
              <div className="image-thumb-row">
                {images.map((img, idx) => (
                  <div className="image-thumb" key={img.path + idx}>
                    <img src={`file:///${img.path.replace(/\\/g, '/')}`} alt="" />
                    <button className="remove-btn" onClick={() => removeImage(idx)}>✕</button>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.5)' }}>
                      <button className="remove-btn" style={{ position: 'static', borderRadius: 0 }} onClick={() => moveImage(idx, -1)}>‹</button>
                      <button className="remove-btn" style={{ position: 'static', borderRadius: 0 }} onClick={() => moveImage(idx, 1)}>›</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Xem trước</label>
              <div className="card" style={{ background: '#fafbfd' }}>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5 }}>{content || <span className="text-muted">(Chưa có nội dung)</span>}</div>
                {images.length > 0 && <div className="hint" style={{ marginTop: 8 }}>{images.length} ảnh đính kèm</div>}
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Thiết lập đăng bài</h3>
            <div className="field">
              <label>Thời gian chờ giữa hai lần đăng (giây)</label>
              <input type="number" min={0} value={delaySeconds} onChange={(e) => setDelaySeconds(e.target.value)} style={{ maxWidth: 160 }} />
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="dryRun" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              <label htmlFor="dryRun" style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>
                Chạy thử DRY_RUN (điền nội dung/ảnh nhưng KHÔNG nhấn nút đăng thật)
              </label>
            </div>
            <p className="hint">Nên bật DRY_RUN trước để kiểm tra selector/quy trình, tắt đi khi đã chắc chắn để đăng thật.</p>
          </div>
        </div>

        <div>
          <div className="card">
            <h3>Chọn tài khoản Facebook</h3>
            {accounts.length === 0 && <p className="text-muted">Chưa có tài khoản nào. Vào mục "Tài khoản Facebook" để thêm.</p>}
            {accounts.map((acc) => (
              <div key={acc.id} className="checkbox-row">
                <input type="checkbox" id={`acc-${acc.id}`} checked={selectedAccountIds.has(acc.id)} onChange={() => toggleAccount(acc.id)} />
                <label htmlFor={`acc-${acc.id}`} style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>
                  {acc.display_name} {acc.login_status !== 'DA_DANG_NHAP' && <span className="badge badge-amber">chưa xác nhận đăng nhập</span>}
                </label>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Chọn nhóm theo từng tài khoản</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-sm" onClick={selectAllGroups}>Chọn tất cả</button>
                <button className="btn btn-sm" onClick={clearAllGroups}>Bỏ chọn tất cả</button>
              </div>
            </div>
            <div className="field">
              <input type="search" placeholder="Tìm nhóm..." value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)} />
            </div>
            {selectedAccountIds.size === 0 && <p className="text-muted">Chọn ít nhất một tài khoản ở trên để hiển thị danh sách nhóm.</p>}
            {[...selectedAccountIds].map((accountId) => {
              const acc = accounts.find((a) => a.id === accountId)
              const rows = (groupsByAccount[accountId] || []).filter((r) =>
                r.group_name.toLowerCase().includes(groupSearch.toLowerCase())
              )
              return (
                <div key={accountId} style={{ marginBottom: 14 }}>
                  <div className="section-title">{acc?.display_name}</div>
                  {rows.length === 0 && <p className="text-muted" style={{ fontSize: 12.5 }}>Tài khoản này chưa được gán nhóm nào (vào "Danh sách nhóm" để gán).</p>}
                  {rows.map((r) => (
                    <div className="checkbox-row" key={r.group_id}>
                      <input
                        type="checkbox"
                        id={`grp-${accountId}-${r.group_id}`}
                        disabled={!r.can_post}
                        checked={(selectedGroupsByAccount[accountId] || new Set()).has(r.group_id)}
                        onChange={() => toggleGroup(accountId, r.group_id)}
                      />
                      <label htmlFor={`grp-${accountId}-${r.group_id}`} style={{ margin: 0, fontWeight: 400, color: r.can_post ? 'var(--text)' : 'var(--text-muted)' }}>
                        {r.group_name} {!r.can_post && '(chưa xác nhận tham gia)'}
                      </label>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          <div className="card">
            <p><strong>{totalSelectedJobs}</strong> lượt đăng sẽ được tạo ({selectedAccountIds.size} tài khoản).</p>
            <div className="page-actions">
              <button className="btn" disabled={submitting} onClick={saveDraft}>Lưu bản nháp</button>
              <button className="btn btn-primary" disabled={submitting || running?.queueState === 'RUNNING'} onClick={startPosting}>
                {dryRun ? 'Chạy thử (DRY_RUN)' : 'Đăng bài'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {running && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Tiến trình đăng bài</h3>
            <div className="page-actions">
              {running.queueState === 'RUNNING' && <button className="btn btn-sm" onClick={pauseQueue}>Tạm dừng</button>}
              {running.queueState === 'PAUSED' && <button className="btn btn-sm" onClick={resumeQueue}>Tiếp tục</button>}
              <button className="btn btn-sm btn-danger" onClick={stopQueue}>Dừng</button>
            </div>
          </div>
          <p>Đang đăng bài {running.completedCount}/{running.totalJobs}</p>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${running.totalJobs ? (running.completedCount / running.totalJobs) * 100 : 0}%` }} />
          </div>
          <div className="section-title">Chi tiết từng nhóm</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tài khoản</th><th>Nhóm</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {running.jobs.map((j) => (
                  <tr key={j.id}>
                    <td>{j.account_name}</td>
                    <td>{j.group_name}</td>
                    <td><StatusBadge status={j.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="section-title">Nhật ký thời gian thực</div>
          <div className="card" style={{ maxHeight: 220, overflowY: 'auto', background: '#fafbfd' }}>
            {logLines.length === 0 && <p className="text-muted">Chưa có nhật ký.</p>}
            {logLines.map((l, idx) => (
              <div key={idx} className={`log-line ${l.level}`}>[{new Date(l.at).toLocaleTimeString('vi-VN')}] {l.message}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
