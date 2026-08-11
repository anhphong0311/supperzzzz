import React, { useEffect, useState } from 'react'
import { toast } from '../lib/toast.js'
import { TARGET_TYPE_LABEL_VI } from '../constants/statusMap'
import { useAuth } from '../context/AuthContext.jsx'

const FIRE_STATUS_LABEL_VI = {
  DANG_CHAY: 'Đang chạy...',
  OK: 'Thành công',
  NO_VIDEO: 'Không có video',
  FAILED: 'Thất bại',
  MANUAL_INTERVENTION: 'Cần xử lý thủ công'
}

const FIRE_STATUS_COLOR = {
  DANG_CHAY: 'blue',
  OK: 'green',
  NO_VIDEO: 'gray',
  FAILED: 'red',
  MANUAL_INTERVENTION: 'amber'
}

export default function Schedule() {
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [runningId, setRunningId] = useState(null)
  const [logLines, setLogLines] = useState([])

  async function load() {
    setLoading(true)
    try {
      setSchedules(await window.api.schedules.list())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const offLog = window.api.schedules.onLog((data) => setLogLines((prev) => [...prev.slice(-200), data]))
    const offFired = window.api.schedules.onFired(() => load())
    return () => { offLog(); offFired() }
  }, [])

  function openCreate() {
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(schedule) {
    setEditingId(schedule.id)
    setShowForm(true)
  }

  async function toggleEnabled(schedule) {
    try {
      await window.api.schedules.setEnabled(schedule.id, !schedule.enabled)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function removeSchedule(schedule) {
    if (!confirm(`Xóa lịch đăng lúc ${schedule.time_of_day}?`)) return
    try {
      await window.api.schedules.remove(schedule.id)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function runNow(schedule) {
    setRunningId(schedule.id)
    try {
      toast.info(`Đang chạy thử lịch #${schedule.id}...`)
      const result = await window.api.schedules.runNow(schedule.id)
      toast.info(`Kết quả: ${FIRE_STATUS_LABEL_VI[result.status] || result.status} - ${result.message}`)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setRunningId(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Lịch đăng tự động</h1>
          <p>Đến giờ cài đặt, tool tự lấy video kế tiếp trong Kho video, tự đăng, tự ghi link kết quả về Google Sheet.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openCreate}>+ Thêm lịch</button>
        </div>
      </div>

      <div className="warning-banner">
        Lịch chỉ chạy khi <strong>app đang mở</strong> (không phải dịch vụ chạy nền 24/7 của hệ điều hành).
        Khi gặp CAPTCHA/checkpoint, lịch vẫn <strong>dừng lại</strong> và báo cho bạn xử lý thủ công như bình
        thường — không tự động vượt qua.
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Giờ đăng</th>
              <th>Nhãn</th>
              <th>Số đích đăng</th>
              <th>DRY_RUN</th>
              <th>Bật/tắt</th>
              <th>Lần chạy gần nhất</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="empty-state">Đang tải...</td></tr>}
            {!loading && schedules.length === 0 && (
              <tr><td colSpan={7} className="empty-state">Chưa có lịch nào. Bấm "+ Thêm lịch" để bắt đầu.</td></tr>
            )}
            {schedules.map((s) => (
              <tr key={s.id}>
                <td><strong>{s.time_of_day}</strong></td>
                <td>{s.label || <span className="text-muted">—</span>}</td>
                <td>{s.targets.length}</td>
                <td>{s.dry_run ? <span className="badge badge-blue">DRY_RUN</span> : <span className="text-muted">Đăng thật</span>}</td>
                <td>
                  <button className={`btn btn-sm ${s.enabled ? '' : 'btn-danger'}`} onClick={() => toggleEnabled(s)}>
                    {s.enabled ? 'Đang bật' : 'Đang tắt'}
                  </button>
                </td>
                <td className="text-muted">
                  {s.last_fired_date ? (
                    <>
                      {s.last_fired_date} —{' '}
                      <span className={`badge badge-${FIRE_STATUS_COLOR[s.last_fired_status] || 'gray'}`}>
                        {FIRE_STATUS_LABEL_VI[s.last_fired_status] || s.last_fired_status}
                      </span>
                      {s.last_fired_message && <div style={{ maxWidth: 220 }}>{s.last_fired_message}</div>}
                    </>
                  ) : 'Chưa chạy lần nào'}
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-sm" disabled={runningId === s.id} onClick={() => runNow(s)}>
                      {runningId === s.id ? 'Đang chạy...' : 'Chạy thử ngay'}
                    </button>
                    <button className="btn btn-sm" onClick={() => openEdit(s)}>Sửa</button>
                    <button className="btn btn-sm btn-danger" onClick={() => removeSchedule(s)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Nhật ký lịch đăng</h3>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {logLines.length === 0 && <p className="text-muted">Chưa có hoạt động nào.</p>}
          {logLines.map((l, idx) => (
            <div key={idx} className="log-line">[{new Date(l.at).toLocaleTimeString('vi-VN')}] {l.message}</div>
          ))}
        </div>
      </div>

      {showForm && (
        <ScheduleForm
          scheduleId={editingId}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load() }}
        />
      )}
    </div>
  )
}

function ScheduleForm({ scheduleId, onClose, onSaved }) {
  const { role } = useAuth()
  const [timeOfDay, setTimeOfDay] = useState('08:00')
  const [label, setLabel] = useState('')
  const [dryRun, setDryRun] = useState(true)
  const [videoMode, setVideoMode] = useState('auto') // 'auto' | 'specific'
  const [videoLibraryId, setVideoLibraryId] = useState('')
  const [customContent, setCustomContent] = useState('')
  const [videos, setVideos] = useState([])
  const [accounts, setAccounts] = useState([])
  const [selectedAccountIds, setSelectedAccountIds] = useState(new Set())
  const [groupsByAccount, setGroupsByAccount] = useState({})
  const [selectedGroupsByAccount, setSelectedGroupsByAccount] = useState({})
  const [selectedTimelineAccounts, setSelectedTimelineAccounts] = useState(new Set())
  const [selectedPageAccounts, setSelectedPageAccounts] = useState(new Set())
  const [selectedInstagramAccounts, setSelectedInstagramAccounts] = useState(new Set())
  const [selectedTiktokAccounts, setSelectedTiktokAccounts] = useState(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.accounts.list().then(setAccounts).catch((err) => toast.error(err.message))
    window.api.videoLibrary.list().then(setVideos).catch((err) => toast.error(err.message))
  }, [])

  useEffect(() => {
    if (!scheduleId) return
    window.api.schedules.get(scheduleId).then(async (s) => {
      setTimeOfDay(s.time_of_day)
      setLabel(s.label || '')
      setDryRun(!!s.dry_run)
      setVideoMode(s.video_library_id ? 'specific' : 'auto')
      setVideoLibraryId(s.video_library_id || '')
      setCustomContent(s.custom_content || '')
      const accIds = new Set()
      const groupSel = {}
      const timelineSel = new Set()
      const pageSel = new Set()
      const instagramSel = new Set()
      const tiktokSel = new Set()
      for (const t of s.targets) {
        accIds.add(t.account_id)
        if (t.target_type === 'GROUP') {
          if (!groupSel[t.account_id]) groupSel[t.account_id] = new Set()
          groupSel[t.account_id].add(t.group_id)
        } else if (t.target_type === 'TIMELINE') {
          timelineSel.add(t.account_id)
        } else if (t.target_type === 'PAGE') {
          pageSel.add(t.account_id)
        } else if (t.target_type === 'INSTAGRAM_POST') {
          instagramSel.add(t.account_id)
        } else if (t.target_type === 'TIKTOK_POST') {
          tiktokSel.add(t.account_id)
        }
      }
      setSelectedAccountIds(accIds)
      setSelectedGroupsByAccount(groupSel)
      setSelectedTimelineAccounts(timelineSel)
      setSelectedPageAccounts(pageSel)
      setSelectedInstagramAccounts(instagramSel)
      setSelectedTiktokAccounts(tiktokSel)
      for (const accountId of accIds) {
        const rows = await window.api.accountGroups.listForAccount(accountId)
        setGroupsByAccount((prev) => ({ ...prev, [accountId]: rows }))
      }
    }).catch((err) => toast.error(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId])

  async function toggleAccount(accountId) {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
    if (!groupsByAccount[accountId]) {
      const rows = await window.api.accountGroups.listForAccount(accountId)
      setGroupsByAccount((prev) => ({ ...prev, [accountId]: rows }))
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

  function toggleTimeline(accountId) {
    setSelectedTimelineAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  function togglePage(accountId) {
    setSelectedPageAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  function toggleInstagram(accountId) {
    setSelectedInstagramAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  function toggleTiktok(accountId) {
    setSelectedTiktokAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  function buildTargets() {
    const targets = []
    selectedAccountIds.forEach((accountId) => {
      if (selectedTimelineAccounts.has(accountId)) targets.push({ account_id: accountId, target_type: 'TIMELINE' })
      if (selectedPageAccounts.has(accountId)) targets.push({ account_id: accountId, target_type: 'PAGE' })
      if (selectedInstagramAccounts.has(accountId)) targets.push({ account_id: accountId, target_type: 'INSTAGRAM_POST' })
      if (selectedTiktokAccounts.has(accountId)) targets.push({ account_id: accountId, target_type: 'TIKTOK_POST' })
    })
    Object.entries(selectedGroupsByAccount).forEach(([accountId, groupSet]) => {
      groupSet.forEach((groupId) => targets.push({ account_id: Number(accountId), target_type: 'GROUP', group_id: groupId }))
    })
    return targets
  }

  async function save() {
    if (!/^\d{2}:\d{2}$/.test(timeOfDay)) return toast.error('Giờ đăng không hợp lệ.')
    if (videoMode === 'specific' && !videoLibraryId) return toast.error('Vui lòng chọn video cụ thể cho lịch này.')
    const targets = buildTargets()
    if (targets.length === 0) return toast.error('Chưa chọn đích đăng nào.')
    setSaving(true)
    const videoFields = {
      video_library_id: videoMode === 'specific' ? Number(videoLibraryId) : null,
      custom_content: customContent.trim() || null
    }
    try {
      if (scheduleId) {
        await window.api.schedules.update(scheduleId, { time_of_day: timeOfDay, label, dry_run: dryRun ? 1 : 0, ...videoFields })
        await window.api.schedules.setTargets(scheduleId, targets)
        toast.info('Đã cập nhật lịch.')
      } else {
        await window.api.schedules.create({ time_of_day: timeOfDay, label, dry_run: dryRun, targets, ...videoFields })
        toast.info('Đã tạo lịch mới.')
      }
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{scheduleId ? 'Sửa lịch đăng' : 'Thêm lịch đăng'}</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="field">
          <label>Giờ đăng (HH:MM, theo giờ máy đang chạy app)</label>
          <input type="time" value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} style={{ maxWidth: 160 }} />
        </div>
        <div className="field">
          <label>Nhãn (tuỳ chọn)</label>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ví dụ: Ca sáng" />
        </div>
        <div className="checkbox-row">
          <input type="checkbox" id="sched-dry-run" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          <label htmlFor="sched-dry-run" style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>
            Chạy thử DRY_RUN (chưa đăng thật - dùng để kiểm tra lịch trước)
          </label>
        </div>

        <div className="section-title">Video sẽ đăng</div>
        <div className="checkbox-row">
          <input type="radio" id="sched-video-auto" name="sched-video-mode" checked={videoMode === 'auto'} onChange={() => setVideoMode('auto')} />
          <label htmlFor="sched-video-auto" style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>
            Tự động lấy video kế tiếp trong Kho video (như trước)
          </label>
        </div>
        <div className="checkbox-row">
          <input type="radio" id="sched-video-specific" name="sched-video-mode" checked={videoMode === 'specific'} onChange={() => setVideoMode('specific')} />
          <label htmlFor="sched-video-specific" style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>
            Chọn đúng 1 video cụ thể
          </label>
        </div>
        {videoMode === 'specific' && (
          <div className="field" style={{ marginLeft: 24 }}>
            <label>Video</label>
            <select value={videoLibraryId} onChange={(e) => setVideoLibraryId(e.target.value)}>
              <option value="">-- Chọn video --</option>
              {videos.map((v) => (
                <option key={v.id} value={v.id}>{v.caption_hint || `Video #${v.id}`} ({v.status})</option>
              ))}
            </select>
            <div className="hint">Sau khi đăng thật thành công, lịch này sẽ tự tắt để không đăng lặp lại đúng video đó.</div>
          </div>
        )}
        <div className="field">
          <label>Nội dung tuỳ chỉnh cho lịch này (tuỳ chọn)</label>
          <textarea
            rows={3}
            value={customContent}
            onChange={(e) => setCustomContent(e.target.value)}
            placeholder="Để trống sẽ dùng gợi ý nội dung từ cột &quot;Tên video&quot; trên Google Sheet"
          />
        </div>

        <div className="section-title">Đích đăng</div>
        {accounts.map((acc) => (
          <div key={acc.id} className="checkbox-row">
            <input type="checkbox" id={`sched-acc-${acc.id}`} checked={selectedAccountIds.has(acc.id)} onChange={() => toggleAccount(acc.id)} />
            <label htmlFor={`sched-acc-${acc.id}`} style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>{acc.display_name}</label>
          </div>
        ))}

        {[...selectedAccountIds].map((accountId) => {
          const acc = accounts.find((a) => a.id === accountId)
          const rows = groupsByAccount[accountId] || []
          return (
            <div key={accountId} style={{ marginLeft: 16, marginBottom: 10 }}>
              <div className="section-title">{acc?.display_name}</div>
              <div className="checkbox-row">
                <input type="checkbox" id={`sched-tl-${accountId}`} checked={selectedTimelineAccounts.has(accountId)} onChange={() => toggleTimeline(accountId)} />
                <label htmlFor={`sched-tl-${accountId}`} style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>{TARGET_TYPE_LABEL_VI.TIMELINE}</label>
              </div>
              <div className="checkbox-row">
                <input type="checkbox" id={`sched-pg-${accountId}`} disabled={!acc?.fanpage_url} checked={selectedPageAccounts.has(accountId)} onChange={() => togglePage(accountId)} />
                <label htmlFor={`sched-pg-${accountId}`} style={{ margin: 0, fontWeight: 400, color: acc?.fanpage_url ? 'var(--text)' : 'var(--text-muted)' }}>
                  {TARGET_TYPE_LABEL_VI.PAGE}{!acc?.fanpage_url && ' (chưa gắn Fanpage)'}
                </label>
              </div>
              {role === 'admin' && (
                <div className="checkbox-row">
                  <input type="checkbox" id={`sched-ig-${accountId}`} checked={selectedInstagramAccounts.has(accountId)} onChange={() => toggleInstagram(accountId)} />
                  <label htmlFor={`sched-ig-${accountId}`} style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>
                    {TARGET_TYPE_LABEL_VI.INSTAGRAM_POST} <span className="badge badge-amber">đang lỗi - chỉ Admin thấy</span>
                  </label>
                </div>
              )}
              <div className="checkbox-row">
                <input type="checkbox" id={`sched-tt-${accountId}`} checked={selectedTiktokAccounts.has(accountId)} onChange={() => toggleTiktok(accountId)} />
                <label htmlFor={`sched-tt-${accountId}`} style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>
                  {TARGET_TYPE_LABEL_VI.TIKTOK_POST} <span className="badge badge-amber">mới</span>
                </label>
              </div>
              {rows.map((r) => (
                <div className="checkbox-row" key={r.group_id}>
                  <input
                    type="checkbox"
                    id={`sched-grp-${accountId}-${r.group_id}`}
                    disabled={!r.can_post}
                    checked={(selectedGroupsByAccount[accountId] || new Set()).has(r.group_id)}
                    onChange={() => toggleGroup(accountId, r.group_id)}
                  />
                  <label htmlFor={`sched-grp-${accountId}-${r.group_id}`} style={{ margin: 0, fontWeight: 400, color: r.can_post ? 'var(--text)' : 'var(--text-muted)' }}>
                    {r.group_name}
                  </label>
                </div>
              ))}
            </div>
          )
        })}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  )
}
