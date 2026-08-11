const { getDb } = require('../db/database')

function nowIso() {
  return new Date().toISOString()
}

function list() {
  const db = getDb()
  return db.prepare(`
    SELECT cp.*,
      (SELECT final_price FROM competitor_price_history WHERE competitor_product_id = cp.id ORDER BY recorded_at DESC LIMIT 1) AS latest_final_price,
      (SELECT listed_price FROM competitor_price_history WHERE competitor_product_id = cp.id ORDER BY recorded_at DESC LIMIT 1) AS latest_listed_price,
      (SELECT voucher_amount FROM competitor_price_history WHERE competitor_product_id = cp.id ORDER BY recorded_at DESC LIMIT 1) AS latest_voucher_amount
    FROM competitor_products cp
    ORDER BY cp.id DESC
  `).all()
}

function get(id) {
  const db = getDb()
  return db.prepare('SELECT * FROM competitor_products WHERE id = ?').get(id)
}

function create({ product_name, product_url }) {
  if (!product_name || !product_name.trim()) throw new Error('Vui lòng nhập tên sản phẩm.')
  if (!product_url || !product_url.trim()) throw new Error('Vui lòng nhập URL sản phẩm.')
  const db = getDb()
  try {
    const info = db.prepare(`
      INSERT INTO competitor_products (product_name, product_url)
      VALUES (@product_name, @product_url)
    `).run({ product_name: product_name.trim(), product_url: product_url.trim() })
    return get(info.lastInsertRowid)
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      throw new Error('Sản phẩm này đã có trong danh sách theo dõi.')
    }
    throw err
  }
}

function remove(id) {
  const db = getDb()
  db.prepare('DELETE FROM competitor_products WHERE id = ?').run(id)
  return true
}

function listPriceHistory(competitorProductId) {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM competitor_price_history
    WHERE competitor_product_id = ?
    ORDER BY recorded_at DESC
  `).all(competitorProductId)
}

// Ghi nhan 1 lan xem gia THU CONG (nguoi dung tu vao Shopee bang trinh
// duyet that, tu doc gia/voucher, roi nhap lai vao day) - khong bao gio
// ghi de/xoa lich su cu, chi them dong moi.
function addPriceEntry(id, { listed_price, voucher_amount, final_price }) {
  const db = getDb()
  const current = get(id)
  if (!current) throw new Error(`Không tìm thấy sản phẩm id=${id}`)
  if (final_price === undefined || final_price === null || final_price === '') {
    throw new Error('Vui lòng nhập giá thực tế phải trả.')
  }

  const listedPrice = listed_price === '' || listed_price === undefined ? null : Number(listed_price)
  const finalPrice = Number(final_price)
  const voucherAmount = voucher_amount === '' || voucher_amount === undefined
    ? (listedPrice && listedPrice > finalPrice ? listedPrice - finalPrice : null)
    : Number(voucher_amount)

  db.prepare(`
    INSERT INTO competitor_price_history (competitor_product_id, listed_price, voucher_amount, final_price)
    VALUES (@id, @listedPrice, @voucherAmount, @finalPrice)
  `).run({ id, listedPrice, voucherAmount, finalPrice })

  db.prepare('UPDATE competitor_products SET last_checked_at = @now, updated_at = @now WHERE id = @id')
    .run({ id, now: nowIso() })

  return get(id)
}

module.exports = { list, get, create, remove, listPriceHistory, addPriceEntry }
