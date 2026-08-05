import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from '../lib/toast.js'
import { JOB_STATUS_LABEL_VI, JOB_STATUS_COLOR, ALL_JOB_STATUSES } from '../constants/statusMap'

function startOfTodayIso() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function Dashboard() {
  const [todayCounts, setTodayCounts] = useState({})
  const [allCounts, setAllCounts] = useState({})
  const [accountsTotal, setAccountsTotal] = useState(0)
  const [groupsTotal, setGroupsTotal] = useState(0)
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [today, all, accounts, groups, logs] = await Promise.all([
        window.api.posts.statusCounts({ dateFrom: startOfTodayIso() }),
        window.api.posts.statusCounts({}),
        window.api.accounts.list(),
        window.api.groups.list(),
        window.api.logs.listRecent(20)
      ])
      setTodayCounts(today)
      setAllCounts(all)
      setAccountsTotal(accounts.length)
      setGroupsTotal(groups.length)
      setRecentLogs(logs)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const approvedToday = (todayCounts.APPROVED || 0) + (todayCounts.PUBLISHED || 0)
  const pendingToday = todayCounts.PENDING_APPROVAL || 0
  const failedToday = todayCounts.FAILED || 0
  const totalToday = todayCounts.__total || 0
  const maxAllCount = Math.max(1, ...ALL_JOB_STATUSES.map((s) => allCounts[s] || 0))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tổng quan</h1>
          <p>Số liệu tổng hợp về hoạt động đăng bài trong tool.</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-primary" to="/create-post">+ Tạo bài đăng mới</Link>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card stat-accent-primary"><div className="stat-value">{totalToday}</div><div className="stat-label">Tổng bài hôm nay</div></div>
        <div className="stat-card stat-accent-green"><div className="stat-value" style={{ color: 'var(--green)' }}>{approvedToday}</div><div className="stat-label">Đã duyệt / hiển thị</div></div>
        <div className="stat-card stat-accent-amber"><div className="stat-value" style={{ color: 'var(--amber)' }}>{pendingToday}</div><div className="stat-label">Chờ duyệt</div></div>
        <div className="stat-card stat-accent-red"><div className="stat-value" style={{ color: 'var(--red)' }}>{failedToday}</div><div className="stat-label">Đăng thất bại</div></div>
        <div className="stat-card stat-accent-blue"><div className="stat-value">{groupsTotal}</div><div className="stat-label">Tổng nhóm</div></div>
        <div className="stat-card stat-accent-purple"><div className="stat-value">{accountsTotal}</div><div className="stat-label">Tổng tài khoản</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Biểu đồ trạng thái bài (toàn bộ lịch sử)</h3>
          {loading && <p className="text-muted">Đang tải...</p>}
          {!loading && ALL_JOB_STATUSES.every((s) => !allCounts[s]) && (
            <p className="text-muted">Chưa có dữ liệu.</p>
          )}
          {!loading && ALL_JOB_STATUSES.filter((s) => allCounts[s] > 0).map((s) => {
            const value = allCounts[s] || 0
            const pct = (value / maxAllCount) * 100
            return (
              <div key={s} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <span>{JOB_STATUS_LABEL_VI[s]}</span>
                  <span>{value}</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${pct}%`, background: `var(--${JOB_STATUS_COLOR[s]})` }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <h3>Hoạt động gần đây</h3>
          {recentLogs.length === 0 && <p className="text-muted">Chưa có hoạt động nào.</p>}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {recentLogs.map((l) => (
              <div key={l.id} className={`log-line ${l.log_level}`}>
                [{new Date(l.created_at).toLocaleString('vi-VN')}]{l.performed_by ? ` (${l.performed_by})` : ''} {l.message}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
