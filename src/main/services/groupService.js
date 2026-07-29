const { getDb } = require('../db/database')

function nowIso() {
  return new Date().toISOString()
}

/**
 * filters: { search, accountId, groupStatus, requiresApproval }
 */
function list(filters = {}) {
  const db = getDb()
  const clauses = []
  const params = {}

  if (filters.search) {
    clauses.push('(g.group_name LIKE @search OR g.group_url LIKE @search)')
    params.search = `%${filters.search}%`
  }
  if (filters.groupStatus) {
    clauses.push('g.group_status = @groupStatus')
    params.groupStatus = filters.groupStatus
  }
  if (filters.requiresApproval !== undefined && filters.requiresApproval !== null) {
    clauses.push('g.requires_approval = @requiresApproval')
    params.requiresApproval = filters.requiresApproval
  }
  if (filters.accountId) {
    clauses.push(`g.id IN (SELECT group_id FROM account_groups WHERE account_id = @accountId)`)
    params.accountId = filters.accountId
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT g.* FROM facebook_groups g ${where} ORDER BY g.id DESC`).all(params)

  const memberStmt = db.prepare(`
    SELECT a.id, a.display_name
    FROM account_groups ag
    JOIN facebook_accounts a ON a.id = ag.account_id
    WHERE ag.group_id = ?
  `)
  return rows.map((g) => ({ ...g, member_accounts: memberStmt.all(g.id) }))
}

function get(id) {
  const db = getDb()
  const group = db.prepare('SELECT * FROM facebook_groups WHERE id = ?').get(id)
  if (!group) return null
  const members = db.prepare(`
    SELECT a.id, a.display_name, ag.membership_status, ag.can_post
    FROM account_groups ag
    JOIN facebook_accounts a ON a.id = ag.account_id
    WHERE ag.group_id = ?
  `).all(id)
  return { ...group, member_accounts: members }
}

function create(data) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO facebook_groups (group_name, group_url, facebook_group_id, requires_approval, group_status, notes)
    VALUES (@group_name, @group_url, @facebook_group_id, @requires_approval, @group_status, @notes)
  `)
  const info = stmt.run({
    group_name: data.group_name || data.group_url,
    group_url: data.group_url,
    facebook_group_id: data.facebook_group_id || null,
    requires_approval: data.requires_approval ?? -1,
    group_status: data.group_status || 'CHUA_XAC_DINH',
    notes: data.notes || null
  })
  return get(info.lastInsertRowid)
}

/**
 * Them nhieu nhom cung luc bang danh sach URL. Bo qua URL trung (da ton tai).
 */
function createMany(urls) {
  const db = getDb()
  const insertOne = db.prepare(`
    INSERT OR IGNORE INTO facebook_groups (group_name, group_url, requires_approval, group_status)
    VALUES (@group_name, @group_url, -1, 'CHUA_XAC_DINH')
  `)
  const tx = db.transaction((list) => {
    const created = []
    list.forEach((rawUrl) => {
      const url = rawUrl.trim()
      if (!url) return
      const info = insertOne.run({ group_name: url, group_url: url })
      if (info.changes > 0) created.push(info.lastInsertRowid)
    })
    return created
  })
  const createdIds = tx(urls)
  return createdIds.map((id) => get(id))
}

function update(id, data) {
  const db = getDb()
  const current = db.prepare('SELECT * FROM facebook_groups WHERE id = ?').get(id)
  if (!current) throw new Error(`Khong tim thay nhom id=${id}`)
  const merged = { ...current, ...data, id, updated_at: nowIso() }
  db.prepare(`
    UPDATE facebook_groups SET
      group_name = @group_name,
      group_url = @group_url,
      facebook_group_id = @facebook_group_id,
      requires_approval = @requires_approval,
      group_status = @group_status,
      notes = @notes,
      last_checked_at = @last_checked_at,
      updated_at = @updated_at
    WHERE id = @id
  `).run(merged)
  return get(id)
}

function remove(id) {
  const db = getDb()
  db.prepare('DELETE FROM facebook_groups WHERE id = ?').run(id)
  return true
}

function setStatus(id, groupStatus) {
  return update(id, { group_status: groupStatus, last_checked_at: nowIso() })
}

module.exports = { list, get, create, createMany, update, remove, setStatus }
