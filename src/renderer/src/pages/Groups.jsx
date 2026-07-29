import React, { useEffect, useMemo, useState } from 'react'
import { toast } from '../lib/toast.js'
import { GROUP_STATUS_LABEL_VI } from '../constants/statusMap'

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('')
  const [selected, setSelected] = useState(new Set())

  const [showAddModal, setShowAddModal] = useState(false)
  const [bulkUrls, setBulkUrls] = useState('')

  const [memberModalGroup, setMemberModalGroup] = useState(null)
  const [checkingId, setCheckingId] = useState(null)
  // Tai khoan duoc chon de "Kiem tra truy cap" cho tung dong nhom (khi nhom co
  // nhieu hon 1 tai khoan da gan) - PHAI la tai khoan da duoc gan cho dung
  // nhom do (qua "Gan tai khoan"), khong dung 1 lua chon dung chung cho ca bang
  // (truoc day dung chung nen bam "Kiem tra" o nhom nao cung chay nham tai khoan).
  const [checkAccountByGroup, setCheckAccountByGroup] = useState({})

  async function load() {
    setLoading(true)
    try {
      const filters = {}
      if (search) filters.search = search
      if (accountFilter) filters.accountId = Number(accountFilter)
      if (statusFilter) filters.groupStatus = statusFilter
      if (approvalFilter !== '') filters.requiresApproval = Number(approvalFilter)
      const [g, a] = await Promise.all([window.api.groups.list(filters), window.api.accounts.list()])
      setGroups(g)
      setAccounts(a)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, accountFilter, statusFilter, approvalFilter])

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === groups.length) setSelected(new Set())
    else setSelected(new Set(groups.map((g) => g.id)))
  }

  async function addBulk() {
    const urls = bulkUrls.split('\n').map((u) => u.trim()).filter(Boolean)
    if (urls.length === 0) return toast.error('Vui lòng nhập ít nhất 1 URL nhóm.')
    try {
      const created = await window.api.groups.createMany(urls)
      toast.info(`Đã thêm ${created.length} nhóm mới (${urls.length - created.length} trùng lặp đã bỏ qua).`)
      setBulkUrls('')
      setShowAddModal(false)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function renameGroup(g) {
    const name = prompt('Tên nhóm mới:', g.group_name)
    if (name === null) return
    try {
      await window.api.groups.update(g.id, { group_name: name })
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function removeGroup(g) {
    if (!confirm(`Xóa nhóm "${g.group_name}" khỏi tool?`)) return
    try {
      await window.api.groups.remove(g.id)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function checkAccess(g, accountId) {
    if (!accountId) return toast.error('Chọn một tài khoản để kiểm tra.')
    setCheckingId(g.id)
    try {
      const result = await window.api.groups.checkAccess(g.id, Number(accountId))
      toast.info(`Kết quả kiểm tra nhóm "${g.group_name}": ${result}`)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCheckingId(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Danh sách nhóm</h1>
          <p>Thêm nhóm bằng URL, gán tài khoản đã tham gia trước khi có thể chọn nhóm khi tạo bài đăng.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Thêm nhóm</button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="field">
          <label>Tìm theo tên/URL</label>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm..." />
        </div>
        <div className="field">
          <label>Lọc theo tài khoản</label>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Trạng thái hoạt động</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="HOAT_DONG">Hoạt động</option>
            <option value="KHONG_HOAT_DONG">Không hoạt động</option>
            <option value="CHUA_XAC_DINH">Chưa xác định</option>
          </select>
        </div>
        <div className="field">
          <label>Yêu cầu duyệt bài</label>
          <select value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)}>
            <option value="">Tất cả</option>
            <option value="1">Có</option>
            <option value="0">Không</option>
            <option value="-1">Chưa rõ</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" checked={groups.length > 0 && selected.size === groups.length} onChange={toggleSelectAll} /></th>
              <th>Tên nhóm</th>
              <th>URL</th>
              <th>Tài khoản tham gia</th>
              <th>Yêu cầu duyệt</th>
              <th>Trạng thái</th>
              <th>Lần kiểm tra cuối</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="empty-state">Đang tải...</td></tr>}
            {!loading && groups.length === 0 && <tr><td colSpan={8} className="empty-state">Chưa có nhóm nào.</td></tr>}
            {groups.map((g) => (
              <tr key={g.id}>
                <td><input type="checkbox" checked={selected.has(g.id)} onChange={() => toggleSelect(g.id)} /></td>
                <td><strong>{g.group_name}</strong></td>
                <td className="text-muted" style={{ maxWidth: 220, wordBreak: 'break-all' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); window.api.system.openExternal(g.group_url) }}>{g.group_url}</a>
                </td>
                <td>
                  {g.member_accounts.length === 0
                    ? <span className="text-muted">Chưa gán</span>
                    : g.member_accounts.map((m) => <span key={m.id} className="badge badge-blue" style={{ marginRight: 4 }}>{m.display_name}</span>)}
                  <div><button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setMemberModalGroup(g)}>Gán tài khoản</button></div>
                </td>
                <td>{g.requires_approval === 1 ? 'Có' : g.requires_approval === 0 ? 'Không' : 'Chưa rõ'}</td>
                <td><span className={`badge badge-${g.group_status === 'HOAT_DONG' ? 'green' : g.group_status === 'KHONG_HOAT_DONG' ? 'red' : 'gray'}`}>{GROUP_STATUS_LABEL_VI[g.group_status] || g.group_status}</span></td>
                <td className="text-muted">{g.last_checked_at ? new Date(g.last_checked_at).toLocaleString('vi-VN') : '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {g.member_accounts.length === 0 ? (
                      <button className="btn btn-sm" disabled title="Gán tài khoản cho nhóm này trước khi kiểm tra">
                        Kiểm tra truy cập
                      </button>
                    ) : g.member_accounts.length === 1 ? (
                      <button
                        className="btn btn-sm"
                        disabled={checkingId === g.id}
                        onClick={() => checkAccess(g, g.member_accounts[0].id)}
                      >
                        {checkingId === g.id ? 'Đang kiểm tra...' : `Kiểm tra (${g.member_accounts[0].display_name})`}
                      </button>
                    ) : (
                      <>
                        <select
                          value={checkAccountByGroup[g.id] ?? g.member_accounts[0].id}
                          onChange={(e) => setCheckAccountByGroup((prev) => ({ ...prev, [g.id]: Number(e.target.value) }))}
                        >
                          {g.member_accounts.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                        </select>
                        <button
                          className="btn btn-sm"
                          disabled={checkingId === g.id}
                          onClick={() => checkAccess(g, checkAccountByGroup[g.id] ?? g.member_accounts[0].id)}
                        >
                          {checkingId === g.id ? 'Đang kiểm tra...' : 'Kiểm tra truy cập'}
                        </button>
                      </>
                    )}
                    <button className="btn btn-sm" onClick={() => renameGroup(g)}>Sửa tên</button>
                    <button className="btn btn-sm btn-danger" onClick={() => removeGroup(g)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm nhóm bằng URL</h3>
              <button className="btn btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="field">
              <label>Nhập một hoặc nhiều URL (mỗi dòng một URL)</label>
              <textarea rows={8} value={bulkUrls} onChange={(e) => setBulkUrls(e.target.value)} placeholder={'https://www.facebook.com/groups/...\nhttps://www.facebook.com/groups/...'} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowAddModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={addBulk}>Thêm nhóm</button>
            </div>
          </div>
        </div>
      )}

      {memberModalGroup && (
        <MemberModal group={memberModalGroup} accounts={accounts} onClose={() => setMemberModalGroup(null)} onSaved={load} />
      )}
    </div>
  )
}

function MemberModal({ group, accounts, onClose, onSaved }) {
  const memberIds = useMemo(() => new Set(group.member_accounts.map((m) => m.id)), [group])
  const [selectedIds, setSelectedIds] = useState(memberIds)

  function toggle(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    try {
      const toAdd = accounts.filter((a) => selectedIds.has(a.id) && !memberIds.has(a.id))
      const toRemove = accounts.filter((a) => !selectedIds.has(a.id) && memberIds.has(a.id))
      await Promise.all([
        ...toAdd.map((a) => window.api.accountGroups.setMembership({ account_id: a.id, group_id: group.id, membership_status: 'THANH_VIEN', can_post: 1 })),
        ...toRemove.map((a) => window.api.accountGroups.remove(a.id, group.id))
      ])
      toast.info('Đã cập nhật tài khoản tham gia nhóm.')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Tài khoản tham gia: {group.group_name}</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <p className="hint">Chỉ đánh dấu tài khoản THẬT SỰ đã là thành viên của nhóm này. Tool không tự động thêm thành viên.</p>
        {accounts.map((a) => (
          <div className="checkbox-row" key={a.id}>
            <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggle(a.id)} id={`member-${a.id}`} />
            <label htmlFor={`member-${a.id}`} style={{ margin: 0, fontWeight: 400, color: 'var(--text)' }}>{a.display_name}</label>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={save}>Lưu</button>
        </div>
      </div>
    </div>
  )
}
