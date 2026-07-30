const { getDb } = require('../db/database')

// Gia tri mac dinh cho toan bo cau hinh he thong (muc 15)
const DEFAULTS = {
  delay_between_posts_seconds: '30',
  page_load_timeout_ms: '30000',
  media_upload_timeout_ms: '60000',
  video_processing_timeout_ms: '90000',
  max_retry_count: '2',
  temp_media_dir: '',
  browser_executable_path: '',
  headless_mode: 'false',
  auto_close_tab: 'true',
  auto_recheck_pending: 'true',
  recheck_interval_minutes: '60',
  daily_post_limit_per_account: '20',
  notifications_enabled: 'true',
  dry_run_default: 'true'
}

function nowIso() {
  return new Date().toISOString()
}

function getAll() {
  const db = getDb()
  const rows = db.prepare('SELECT setting_key, setting_value FROM settings').all()
  const stored = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]))
  return { ...DEFAULTS, ...stored }
}

function get(key) {
  const all = getAll()
  return all[key]
}

function set(key, value) {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM settings WHERE setting_key = ?').get(key)
  if (existing) {
    db.prepare('UPDATE settings SET setting_value = @value, updated_at = @now WHERE setting_key = @key')
      .run({ key, value: String(value), now: nowIso() })
  } else {
    db.prepare('INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (@key, @value, @now)')
      .run({ key, value: String(value), now: nowIso() })
  }
  return getAll()
}

function setMany(entries) {
  const db = getDb()
  const tx = db.transaction((obj) => {
    Object.entries(obj).forEach(([key, value]) => set(key, value))
  })
  tx(entries)
  return getAll()
}

module.exports = { DEFAULTS, getAll, get, set, setMany }
