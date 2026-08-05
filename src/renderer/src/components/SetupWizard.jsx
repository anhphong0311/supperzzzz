import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '../lib/toast.js'
import { useAuth } from '../context/AuthContext.jsx'
import ToastHost from './ToastHost.jsx'

// Trinh huong dan thiet lap lan dau cho tai khoan Nhan vien: them tai khoan
// MXH (tu tao Chrome Profile) -> them 1 nhom Facebook (tuy chon) -> dua sang
// man Tao bai dang de thu DRY_RUN. Chi hien 1 lan (staff_users.wizard_completed).
export default function SetupWizard() {
  const { staffId, dismissWizard } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  const [accountForm, setAccountForm] = useState({ display_name: '', fanpage_url: '' })
  const [account, setAccount] = useState(null) // { id, display_name, browser_profile_path }
  const [checkingLogin, setCheckingLogin] = useState(false)

  const [groupUrl, setGroupUrl] = useState('')
  const [addedGroups, setAddedGroups] = useState([])
  const [addingGroup, setAddingGroup] = useState(false)

  async function finishWizard() {
    try {
      await window.api.staff.markWizardDone(staffId)
    } catch (err) {
      toast.error(err.message)
    }
    dismissWizard()
  }

  async function createAccount(e) {
    e.preventDefault()
    if (!accountForm.display_name.trim()) return toast.error('Vui lòng nhập tên hiển thị.')
    setSubmitting(true)
    try {
      const acc = await window.api.accounts.create({
        display_name: accountForm.display_name,
        fanpage_url: accountForm.fanpage_url
      })
      setAccount(acc)
      toast.info('Đã tạo tài khoản. Bấm "Mở để đăng nhập" để tự đăng nhập Facebook/TikTok.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function openForLogin() {
    try {
      toast.info('Đang mở Chrome để đăng nhập thủ công...')
      await window.api.accounts.openProfileForLogin(account.id)
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function checkLogin() {
    setCheckingLogin(true)
    try {
      await window.api.accounts.checkLoginStatus(account.id)
      toast.info('Đã kiểm tra trạng thái đăng nhập.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCheckingLogin(false)
    }
  }

  async function addGroup() {
    const url = groupUrl.trim()
    if (!url) return toast.error('Vui lòng nhập URL nhóm.')
    setAddingGroup(true)
    try {
      const created = await window.api.groups.createMany([url])
      let group = created[0]
      if (!group) {
        const found = await window.api.groups.list({ search: url })
        group = found.find((g) => g.group_url === url)
      }
      if (!group) throw new Error('Không tìm thấy hoặc không thêm được nhóm này.')
      await window.api.accountGroups.setMembership({
        account_id: account.id,
        group_id: group.id,
        membership_status: 'THANH_VIEN',
        can_post: 1
      })
      setAddedGroups((prev) => [...prev, group])
      setGroupUrl('')
      toast.info(`Đã thêm nhóm "${group.group_name}".`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAddingGroup(false)
    }
  }

  async function goCreateTestPost() {
    await window.api.staff.markWizardDone(staffId).catch((err) => toast.error(err.message))
    dismissWizard()
    navigate('/create-post', { state: { wizardAccountId: account?.id, forceDryRun: true } })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
      <ToastHost />
      <div className="card" style={{ width: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 28 }}>👋</div>
          <h2 style={{ margin: '4px 0 0' }}>Chào mừng bạn!</h2>
          <p className="text-muted" style={{ marginTop: 4 }}>Bước {step}/3 — thiết lập nhanh trước khi sử dụng</p>
        </div>

        {step === 1 && (
          <div>
            <h3>Bước 1: Thêm tài khoản mạng xã hội</h3>
            {!account ? (
              <form onSubmit={createAccount}>
                <div className="field">
                  <label>Tên hiển thị</label>
                  <input type="text" value={accountForm.display_name} onChange={(e) => setAccountForm({ ...accountForm, display_name: e.target.value })} placeholder="Ví dụ: Nick 1" autoFocus />
                </div>
                <div className="field">
                  <label>Fanpage URL (tuỳ chọn)</label>
                  <input type="text" value={accountForm.fanpage_url} onChange={(e) => setAccountForm({ ...accountForm, fanpage_url: e.target.value })} placeholder="https://www.facebook.com/ten-fanpage" />
                </div>
                <p className="hint">Tool sẽ tự tạo một Chrome Profile riêng cho tài khoản này — không cần chọn thư mục thủ công.</p>
                <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
                  {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </form>
            ) : (
              <div>
                <p>Đã tạo tài khoản <strong>{account.display_name}</strong>.</p>
                <p className="hint mono" style={{ wordBreak: 'break-all' }}>{account.browser_profile_path}</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <button className="btn btn-sm" onClick={openForLogin}>Mở để đăng nhập</button>
                  <button className="btn btn-sm" disabled={checkingLogin} onClick={checkLogin}>
                    {checkingLogin ? 'Đang kiểm tra...' : 'Kiểm tra đăng nhập'}
                  </button>
                </div>
                <p className="hint">Hãy tự đăng nhập Facebook và/hoặc TikTok trong cửa sổ Chrome vừa mở, rồi bấm Tiếp theo.</p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button className="btn btn-sm" onClick={() => setStep(2)}>Bỏ qua bước này</button>
              <button className="btn btn-primary" disabled={!account} onClick={() => setStep(2)}>Tiếp theo</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3>Bước 2: Thêm nhóm Facebook (tuỳ chọn)</h3>
            <p className="hint">Chỉ cần nếu bạn dùng tài khoản này để đăng vào Nhóm Facebook. Bỏ qua nếu chỉ đăng TikTok/Trang cá nhân.</p>
            <div className="field">
              <label>URL nhóm Facebook</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={groupUrl} onChange={(e) => setGroupUrl(e.target.value)} placeholder="https://www.facebook.com/groups/..." disabled={!account} />
                <button className="btn btn-sm" disabled={!account || addingGroup} onClick={addGroup}>
                  {addingGroup ? 'Đang thêm...' : 'Thêm'}
                </button>
              </div>
              {!account && <div className="hint" style={{ color: 'var(--amber)' }}>Cần có tài khoản ở Bước 1 mới gán nhóm được — quay lại nếu muốn dùng bước này.</div>}
            </div>
            {addedGroups.length > 0 && (
              <ul>
                {addedGroups.map((g) => <li key={g.id}>{g.group_name}</li>)}
              </ul>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button className="btn btn-sm" onClick={() => setStep(1)}>Quay lại</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm" onClick={() => setStep(3)}>Bỏ qua bước này</button>
                <button className="btn btn-primary" onClick={() => setStep(3)}>Tiếp theo</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3>Bước 3: Thử tạo bài đăng đầu tiên</h3>
            <p className="hint">
              Xong rồi! Hãy thử tạo 1 bài đăng ở chế độ DRY_RUN (kiểm tra, chưa đăng thật) để chắc chắn
              mọi thứ hoạt động đúng trước khi đăng thật.
            </p>
            <button className="btn btn-primary" onClick={goCreateTestPost} style={{ width: '100%', marginBottom: 10 }}>
              Tạo bài đăng thử (DRY_RUN)
            </button>
            <button className="btn btn-sm" onClick={finishWizard} style={{ width: '100%' }}>
              Bỏ qua, vào thẳng ứng dụng
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
