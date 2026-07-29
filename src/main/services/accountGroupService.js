const { getDb } = require('../db/database')

function nowIso() {
  return new Date().toISOString()
}

function listForAccount(accountId) {
  const db = getDb()
  return db.prepare(`
    SELECT ag.*, g.group_name, g.group_url
    FROM account_groups ag
    JOIN facebook_groups g ON g.id = ag.group_id
    WHERE ag.account_id = ?
  `).all(accountId)
}

function listForGroup(groupId) {
  const db = getDb()
  return db.prepare(`
    SELECT ag.*, a.display_name
    FROM account_groups ag
    JOIN facebook_accounts a ON a.id = ag.account_id
    WHERE ag.group_id = ?
  `).all(groupId)
}

/**
 * Gan (hoac cap nhat) quan he tai khoan <-> nhom. Day la thao tac nguoi dung
 * xac nhan thu cong rang tai khoan da la thanh vien cua nhom - tool khong tu
 * dong them thanh vien vao nhom.
 */
function setMembership({ account_id, group_id, membership_status = 'THANH_VIEN', can_post = 1 }) {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM account_groups WHERE account_id = ? AND group_id = ?').get(account_id, group_id)
  if (existing) {
    db.prepare(`
      UPDATE account_groups SET membership_status = @membership_status, can_post = @can_post, last_checked_at = @now
      WHERE id = @id
    `).run({ id: existing.id, membership_status, can_post: can_post ? 1 : 0, now: nowIso() })
    return existing.id
  }
  const info = db.prepare(`
    INSERT INTO account_groups (account_id, group_id, membership_status, can_post, last_checked_at)
    VALUES (@account_id, @group_id, @membership_status, @can_post, @now)
  `).run({ account_id, group_id, membership_status, can_post: can_post ? 1 : 0, now: nowIso() })
  return info.lastInsertRowid
}

function removeMembership(account_id, group_id) {
  const db = getDb()
  db.prepare('DELETE FROM account_groups WHERE account_id = ? AND group_id = ?').run(account_id, group_id)
  return true
}

/**
 * Tra ve true neu tai khoan duoc phep dang vao nhom (da la thanh vien va can_post=1).
 * Dung de chan viec chon tai khoan dang vao nhom chua tham gia (yeu cau muc 4).
 */
function canAccountPostToGroup(account_id, group_id) {
  const db = getDb()
  const row = db.prepare('SELECT can_post, membership_status FROM account_groups WHERE account_id = ? AND group_id = ?').get(account_id, group_id)
  if (!row) return false
  return !!row.can_post && row.membership_status !== 'KHONG_PHAI_THANH_VIEN'
}

module.exports = { listForAccount, listForGroup, setMembership, removeMembership, canAccountPostToGroup }
