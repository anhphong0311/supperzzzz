import React, { useEffect, useState } from 'react'
import { toast } from '../lib/toast.js'

export default function Logs() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState('')

  async function load() {
    setLoading(true)
    try {
      setLogs(await window.api.logs.listRecent(300))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = levelFilter ? logs.filter((l) => l.log_level === levelFilter) : logs

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Nhật ký hệ thống</h1>
          <p>Ghi lại toàn bộ hoạt động của quá trình đăng bài để phục vụ debug.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={load}>Làm mới</button>
        </div>
      </div>

      <div className="chip-row">
        <span className={`filter-chip ${levelFilter === '' ? 'active' : ''}`} onClick={() => setLevelFilter('')}>Tất cả</span>
        <span className={`filter-chip ${levelFilter === 'INFO' ? 'active' : ''}`} onClick={() => setLevelFilter('INFO')}>INFO</span>
        <span className={`filter-chip ${levelFilter === 'WARN' ? 'active' : ''}`} onClick={() => setLevelFilter('WARN')}>WARN</span>
        <span className={`filter-chip ${levelFilter === 'ERROR' ? 'active' : ''}`} onClick={() => setLevelFilter('ERROR')}>ERROR</span>
      </div>

      <div className="card">
        {loading && <p className="text-muted">Đang tải...</p>}
        {!loading && filtered.length === 0 && <p className="text-muted">Chưa có nhật ký.</p>}
        {filtered.map((l) => (
          <div key={l.id} className={`log-line ${l.log_level}`}>
            [{new Date(l.created_at).toLocaleString('vi-VN')}] [{l.log_level}] (job #{l.post_job_id ?? '—'}) {l.message}
          </div>
        ))}
      </div>
    </div>
  )
}
