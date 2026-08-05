const { getDb } = require('../db/database')

function nowIso() {
  return new Date().toISOString()
}

function todayLocalDate() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function nowLocalHHMM() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function listTargets(scheduleId) {
  const db = getDb()
  return db.prepare(`
    SELECT t.*, a.display_name AS account_name, g.group_name, g.group_url
    FROM post_schedule_targets t
    JOIN facebook_accounts a ON a.id = t.account_id
    LEFT JOIN facebook_groups g ON g.id = t.group_id
    WHERE t.schedule_id = ?
    ORDER BY t.id ASC
  `).all(scheduleId)
}

function list() {
  const db = getDb()
  const schedules = db.prepare('SELECT * FROM post_schedules ORDER BY time_of_day ASC').all()
  return schedules.map((s) => ({ ...s, targets: listTargets(s.id) }))
}

function get(id) {
  const db = getDb()
  const schedule = db.prepare('SELECT * FROM post_schedules WHERE id = ?').get(id)
  if (!schedule) return null
  return { ...schedule, targets: listTargets(id) }
}

/**
 * payload: { time_of_day: 'HH:MM', label, dry_run, targets: [{account_id, target_type, group_id}] }
 */
function create(payload) {
  if (!payload.time_of_day || !/^\d{2}:\d{2}$/.test(payload.time_of_day)) {
    throw new Error('Giờ đăng không hợp lệ, cần định dạng HH:MM.')
  }
  if (!payload.targets || payload.targets.length === 0) {
    throw new Error('Chưa chọn đích đăng nào cho lịch này.')
  }

  const db = getDb()
  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO post_schedules (time_of_day, label, enabled, dry_run)
      VALUES (@time_of_day, @label, 1, @dry_run)
    `).run({
      time_of_day: payload.time_of_day,
      label: payload.label || null,
      dry_run: payload.dry_run ? 1 : 0
    })
    const scheduleId = info.lastInsertRowid
    const insertTarget = db.prepare(`
      INSERT INTO post_schedule_targets (schedule_id, account_id, target_type, group_id)
      VALUES (@schedule_id, @account_id, @target_type, @group_id)
    `)
    payload.targets.forEach((t) => {
      insertTarget.run({
        schedule_id: scheduleId,
        account_id: t.account_id,
        target_type: t.target_type || 'GROUP',
        group_id: t.target_type === 'GROUP' ? t.group_id : null
      })
    })
    return scheduleId
  })
  const scheduleId = tx()
  return get(scheduleId)
}

function update(id, data) {
  const db = getDb()
  const current = db.prepare('SELECT * FROM post_schedules WHERE id = ?').get(id)
  if (!current) throw new Error(`Không tìm thấy lịch id=${id}`)
  const merged = { ...current, ...data, id, updated_at: nowIso() }
  db.prepare(`
    UPDATE post_schedules SET
      time_of_day = @time_of_day,
      label = @label,
      enabled = @enabled,
      dry_run = @dry_run,
      last_fired_date = @last_fired_date,
      last_fired_status = @last_fired_status,
      last_fired_message = @last_fired_message,
      updated_at = @updated_at
    WHERE id = @id
  `).run(merged)
  return get(id)
}

function setTargets(id, targets) {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM post_schedule_targets WHERE schedule_id = ?').run(id)
    const insertTarget = db.prepare(`
      INSERT INTO post_schedule_targets (schedule_id, account_id, target_type, group_id)
      VALUES (@schedule_id, @account_id, @target_type, @group_id)
    `)
    targets.forEach((t) => {
      insertTarget.run({
        schedule_id: id,
        account_id: t.account_id,
        target_type: t.target_type || 'GROUP',
        group_id: t.target_type === 'GROUP' ? t.group_id : null
      })
    })
  })
  tx()
  return get(id)
}

function setEnabled(id, enabled) {
  return update(id, { enabled: enabled ? 1 : 0 })
}

function recordFireResult(id, { status, message }) {
  return update(id, {
    last_fired_date: todayLocalDate(),
    last_fired_status: status,
    last_fired_message: message || null
  })
}

function remove(id) {
  const db = getDb()
  db.prepare('DELETE FROM post_schedules WHERE id = ?').run(id)
  return true
}

/**
 * Danh sach lich DANG BAT va KHOP voi phut hien tai (theo gio may dang
 * chay) ma CHUA chay trong ngay hom nay - dung cho vong lap kiem tra moi
 * phut cua scheduler engine.
 */
function findDueSchedules() {
  const db = getDb()
  const hhmm = nowLocalHHMM()
  const today = todayLocalDate()
  const due = db.prepare(`
    SELECT * FROM post_schedules
    WHERE enabled = 1 AND time_of_day = @hhmm AND (last_fired_date IS NULL OR last_fired_date != @today)
  `).all({ hhmm, today })
  return due.map((s) => ({ ...s, targets: listTargets(s.id) }))
}

module.exports = {
  list,
  get,
  create,
  update,
  setTargets,
  setEnabled,
  recordFireResult,
  remove,
  findDueSchedules,
  todayLocalDate,
  nowLocalHHMM
}
