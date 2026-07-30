const { getDb } = require('../db/database')

function nowIso() {
  return new Date().toISOString()
}

function list() {
  const db = getDb()
  return db.prepare('SELECT * FROM facebook_accounts ORDER BY id DESC').all()
}

function get(id) {
  const db = getDb()
  return db.prepare('SELECT * FROM facebook_accounts WHERE id = ?').get(id)
}

function create(data) {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO facebook_accounts
      (display_name, profile_name, browser_profile_path, login_status, account_status, notes, fanpage_url)
    VALUES (@display_name, @profile_name, @browser_profile_path, @login_status, @account_status, @notes, @fanpage_url)
  `)
  const info = stmt.run({
    display_name: data.display_name,
    profile_name: data.profile_name || data.display_name,
    browser_profile_path: data.browser_profile_path,
    login_status: data.login_status || 'CHUA_DANG_NHAP',
    account_status: data.account_status || 'HOAT_DONG',
    notes: data.notes || null,
    fanpage_url: data.fanpage_url || null
  })
  return get(info.lastInsertRowid)
}

function update(id, data) {
  const db = getDb()
  const current = get(id)
  if (!current) throw new Error(`Khong tim thay tai khoan id=${id}`)
  const merged = { ...current, ...data, id, updated_at: nowIso() }
  db.prepare(`
    UPDATE facebook_accounts SET
      display_name = @display_name,
      profile_name = @profile_name,
      browser_profile_path = @browser_profile_path,
      login_status = @login_status,
      account_status = @account_status,
      posts_today = @posts_today,
      last_posted_at = @last_posted_at,
      last_checked_at = @last_checked_at,
      notes = @notes,
      fanpage_url = @fanpage_url,
      updated_at = @updated_at
    WHERE id = @id
  `).run(merged)
  return get(id)
}

function remove(id) {
  const db = getDb()
  db.prepare('DELETE FROM facebook_accounts WHERE id = ?').run(id)
  return true
}

function setLoginStatus(id, loginStatus) {
  return update(id, { login_status: loginStatus, last_checked_at: nowIso() })
}

function setAccountStatus(id, accountStatus) {
  return update(id, { account_status: accountStatus })
}

function incrementPostsToday(id) {
  const db = getDb()
  db.prepare(`
    UPDATE facebook_accounts
    SET posts_today = posts_today + 1, last_posted_at = @now, updated_at = @now
    WHERE id = @id
  `).run({ id, now: nowIso() })
  return get(id)
}

function resetDailyCounters() {
  const db = getDb()
  db.prepare('UPDATE facebook_accounts SET posts_today = 0, updated_at = @now').run({ now: nowIso() })
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  setLoginStatus,
  setAccountStatus,
  incrementPostsToday,
  resetDailyCounters
}
