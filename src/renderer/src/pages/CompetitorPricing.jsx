import React, { useEffect, useState } from 'react'
import { toast } from '../lib/toast.js'

function formatMoney(v) {
  if (v === null || v === undefined) return '—'
  return Number(v).toLocaleString('vi-VN') + 'đ'
}

const emptyForm = { product_name: '', product_url: '' }
const emptyEntry = { listed_price: '', final_price: '' }

export default function CompetitorPricing() {
  const [enabled, setEnabled] = useState(null) // null = dang tai
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [entryProduct, setEntryProduct] = useState(null)
  const [entryForm, setEntryForm] = useState(emptyEntry)
  const [savingEntry, setSavingEntry] = useState(false)
  const [batchQueue, setBatchQueue] = useState(null) // null = khong o che do hang loat, [] = het hang cho
  const [batchDone, setBatchDone] = useState(0)
  const [historyProduct, setHistoryProduct] = useState(null)
  const [history, setHistory] = useState([])

  async function load() {
    setLoading(true)
    try {
      const settings = await window.api.settings.getAll()
      setEnabled(String(settings.price_tracking_enabled) === 'true')
      setProducts(await window.api.competitor.list())
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function save() {
    if (!form.product_name.trim()) return toast.error('Vui lòng nhập tên sản phẩm.')
    if (!form.product_url.trim()) return toast.error('Vui lòng nhập URL sản phẩm.')
    try {
      await window.api.competitor.create(form)
      toast.info('Đã thêm sản phẩm theo dõi.')
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function openEntry(p) {
    setBatchQueue(null)
    setEntryProduct(p)
    setEntryForm(emptyEntry)
  }

  // Che do hang loat: mo lien tiep form ghi nhan gia cho tung san pham, khong
  // can dong/mo lai modal tu bang danh sach moi lan.
  function startBatch() {
    if (products.length === 0) return toast.error('Chưa có sản phẩm nào để ghi nhận giá.')
    setBatchDone(0)
    const queue = products.slice(1).map((p) => p.id)
    setBatchQueue(queue)
    setEntryProduct(products[0])
    setEntryForm(emptyEntry)
  }

  function advanceBatch() {
    setBatchDone((n) => n + 1)
    if (!batchQueue || batchQueue.length === 0) {
      setBatchQueue(null)
      setEntryProduct(null)
      toast.info('Đã ghi nhận xong toàn bộ danh sách.')
      return
    }
    const [nextId, ...rest] = batchQueue
    const nextProduct = products.find((p) => p.id === nextId)
    setBatchQueue(rest)
    setEntryProduct(nextProduct || null)
    setEntryForm(emptyEntry)
  }

  async function saveEntry() {
    if (!entryForm.final_price) return toast.error('Vui lòng nhập giá thực tế phải trả.')
    setSavingEntry(true)
    try {
      await window.api.competitor.addPriceEntry(entryProduct.id, entryForm)
      toast.info(`Đã ghi nhận giá cho "${entryProduct.product_name}".`)
      if (batchQueue !== null) {
        advanceBatch()
        load()
      } else {
        setEntryProduct(null)
        load()
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingEntry(false)
    }
  }

  async function openHistory(p) {
    setHistoryProduct(p)
    try {
      setHistory(await window.api.competitor.priceHistory(p.id))
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function remove(p) {
    if (!confirm(`Xóa sản phẩm "${p.product_name}" khỏi danh sách theo dõi?`)) return
    try {
      await window.api.competitor.remove(p.id)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (enabled === false) {
    return (
      <div>
        <div className="page-header">
          <div>
            <h1>Theo dõi giá đối thủ</h1>
          </div>
        </div>
        <div className="warning-banner">
          Tính năng này đang tắt. Vào <strong>Cài đặt</strong> → bật "Theo dõi giá đối thủ" để dùng.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Theo dõi giá đối thủ (Shopee)</h1>
          <p>Ghi nhận thủ công giá niêm yết, voucher và giá thực tế của sản phẩm đối thủ theo thời gian.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={startBatch} disabled={products.length === 0}>Ghi nhận giá hàng loạt</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Thêm sản phẩm</button>
        </div>
      </div>

      <div className="warning-banner">
        Không có crawler tự động — Shopee chặn cửa sổ trình duyệt tự động ngay ở bước đăng nhập, nên
        tool không tự thu thập giá được. Bạn tự vào Shopee bằng trình duyệt thật, xem giá đối thủ,
        rồi bấm "Ghi nhận giá" để nhập lại vào đây.
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tên sản phẩm</th>
              <th>Giá gần nhất</th>
              <th>Lần ghi nhận cuối</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="empty-state">Đang tải...</td></tr>}
            {!loading && products.length === 0 && (
              <tr><td colSpan={4} className="empty-state">Chưa có sản phẩm nào. Nhấn "+ Thêm sản phẩm" để bắt đầu.</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.product_name}</strong>
                  <div className="text-muted" style={{ maxWidth: 260, wordBreak: 'break-all' }}>
                    <a href="#" onClick={(e) => { e.preventDefault(); window.api.system.openExternal(p.product_url) }}>{p.product_url}</a>
                  </div>
                </td>
                <td>
                  {p.latest_final_price == null ? (
                    <span className="text-muted">Chưa có dữ liệu</span>
                  ) : (
                    <>
                      <strong>{formatMoney(p.latest_final_price)}</strong>
                      {p.latest_listed_price != null && p.latest_listed_price > p.latest_final_price && (
                        <div className="text-muted" style={{ textDecoration: 'line-through', fontSize: 12 }}>
                          {formatMoney(p.latest_listed_price)}
                        </div>
                      )}
                      {p.latest_voucher_amount > 0 && (
                        <div className="hint">Giảm {formatMoney(p.latest_voucher_amount)}</div>
                      )}
                    </>
                  )}
                </td>
                <td className="text-muted">{p.last_checked_at ? new Date(p.last_checked_at).toLocaleString('vi-VN') : '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => openEntry(p)}>Ghi nhận giá</button>
                    <button className="btn btn-sm" onClick={() => openHistory(p)}>Xem lịch sử giá</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm sản phẩm đối thủ</h3>
              <button className="btn btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="field">
              <label>Tên sản phẩm (để tự nhận biết)</label>
              <input type="text" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} placeholder="Ví dụ: Áo thun nam - Shop ABC" />
            </div>
            <div className="field">
              <label>URL sản phẩm trên Shopee</label>
              <input type="text" value={form.product_url} onChange={(e) => setForm({ ...form, product_url: e.target.value })} placeholder="https://shopee.vn/..." />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowForm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={save}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {entryProduct && (
        <div className="modal-backdrop" onClick={() => { setEntryProduct(null); setBatchQueue(null) }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ghi nhận giá — {entryProduct.product_name}</h3>
              <button className="btn btn-sm" onClick={() => { setEntryProduct(null); setBatchQueue(null) }}>✕</button>
            </div>
            {batchQueue !== null && (
              <p className="hint">
                Chế độ hàng loạt: đã xong {batchDone}/{batchDone + 1 + batchQueue.length} sản phẩm.
              </p>
            )}
            <p className="hint">Tự vào trang sản phẩm trên Shopee bằng trình duyệt thật, xem giá rồi nhập lại đây.</p>
            <div className="field">
              <label>Giá gốc (để trống nếu không có giảm giá)</label>
              <input type="number" value={entryForm.listed_price} onChange={(e) => setEntryForm({ ...entryForm, listed_price: e.target.value })} placeholder="Ví dụ: 150000" autoFocus />
            </div>
            <div className="field">
              <label>Giá thực tế phải trả (sau voucher, nếu có)</label>
              <input type="number" value={entryForm.final_price} onChange={(e) => setEntryForm({ ...entryForm, final_price: e.target.value })} placeholder="Ví dụ: 119000" />
            </div>
            <div className="hint" style={{ marginBottom: 10 }}>Số tiền giảm sẽ tự tính từ 2 giá trên (giá gốc trừ giá thực tế).</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => { setEntryProduct(null); setBatchQueue(null) }}>
                {batchQueue !== null ? 'Dừng hàng loạt' : 'Hủy'}
              </button>
              {batchQueue !== null && (
                <button className="btn" onClick={advanceBatch}>Bỏ qua sản phẩm này</button>
              )}
              <button className="btn btn-primary" disabled={savingEntry} onClick={saveEntry}>
                {savingEntry ? 'Đang lưu...' : (batchQueue !== null && batchQueue.length > 0 ? 'Lưu & tiếp theo' : 'Lưu')}
              </button>
            </div>
          </div>
        </div>
      )}

      {historyProduct && (
        <div className="modal-backdrop" onClick={() => setHistoryProduct(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Lịch sử giá — {historyProduct.product_name}</h3>
              <button className="btn btn-sm" onClick={() => setHistoryProduct(null)}>✕</button>
            </div>
            {history.length === 0 && <p className="text-muted">Chưa có dữ liệu giá nào được ghi nhận.</p>}
            {history.length > 0 && (
              <table>
                <thead>
                  <tr>
                    <th>Thời điểm</th>
                    <th>Giá gốc</th>
                    <th>Voucher</th>
                    <th>Giá thực</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="text-muted">{new Date(h.recorded_at).toLocaleString('vi-VN')}</td>
                      <td>{formatMoney(h.listed_price)}</td>
                      <td>{h.voucher_amount ? formatMoney(h.voucher_amount) : '—'}</td>
                      <td><strong>{formatMoney(h.final_price)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
