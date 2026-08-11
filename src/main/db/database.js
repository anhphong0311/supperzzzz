const path = require('path')
const fs = require('fs')
const initSqlJs = require('sql.js')

/**
 * Dung sql.js (SQLite bien dich san sang WASM) thay vi better-sqlite3 de
 * KHONG can Visual Studio Build Tools / node-gyp tren may nguoi dung khi
 * cai dat. Doi lai, sql.js hoat dong hoan toan trong bo nho va can duoc
 * "persist" (ghi de) ra file thu cong sau moi thao tac ghi - xem ham
 * persist() ben duoi.
 *
 * File nay bao boc sql.js thanh mot API dong bo, giong voi tap con API cua
 * better-sqlite3 ma cac service dang su dung (prepare().run()/all()/get(),
 * transaction()), de khong phai sua lai toan bo services/*.js.
 */

function resolveDataDir() {
  try {
    // eslint-disable-next-line global-require
    const { app } = require('electron')
    if (app && app.getPath) {
      return app.getPath('userData')
    }
  } catch (err) {
    // Khong chay trong Electron (vi du: script db:init/db:seed chay bang node) -> dung fallback
  }
  return path.join(__dirname, '..', '..', '..', 'data')
}

let rawDb = null
let dbFilePath = null
let wrapper = null
// export()/persist() giua chung mot giao dich BEGIN...COMMIT thu cong se lam
// sql.js ket thuc giao dich do som mot cach am tham (roi COMMIT sau do bao
// loi "no transaction is active"). Vi vay khi dang trong transaction(), chi
// persist DUY NHAT MOT LAN sau khi COMMIT xong.
let inTransaction = false

function persist() {
  if (!rawDb || !dbFilePath || inTransaction) return
  const data = rawDb.export()
  fs.writeFileSync(dbFilePath, Buffer.from(data))
}

/**
 * Chuan hoa tham so truyen vao giong better-sqlite3:
 * - Khong tham so -> undefined (khong bind)
 * - 1 tham so la object (khong phai array) -> bind theo ten voi tien to '@'
 * - Con lai -> bind theo vi tri (danh cho placeholder '?')
 */
function normalizeBindArgs(args) {
  if (args.length === 0) return undefined
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const obj = args[0]
    const bound = {}
    Object.keys(obj).forEach((k) => {
      bound[`@${k}`] = obj[k] === undefined ? null : obj[k]
    })
    return bound
  }
  return args.map((v) => (v === undefined ? null : v))
}

class Statement {
  constructor(sql) {
    this.sql = sql
  }

  run(...args) {
    const stmt = rawDb.prepare(this.sql)
    try {
      const bound = normalizeBindArgs(args)
      if (bound !== undefined) stmt.bind(bound)
      stmt.step()
    } finally {
      stmt.free()
    }
    let lastInsertRowid
    try {
      const res = rawDb.exec('SELECT last_insert_rowid() AS id')
      lastInsertRowid = res[0] ? res[0].values[0][0] : undefined
    } catch (err) {
      lastInsertRowid = undefined
    }
    const changes = rawDb.getRowsModified()
    persist()
    return { lastInsertRowid, changes }
  }

  all(...args) {
    const stmt = rawDb.prepare(this.sql)
    try {
      const bound = normalizeBindArgs(args)
      if (bound !== undefined) stmt.bind(bound)
      const rows = []
      while (stmt.step()) rows.push(stmt.getAsObject())
      return rows
    } finally {
      stmt.free()
    }
  }

  get(...args) {
    return this.all(...args)[0]
  }
}

function buildWrapper() {
  return {
    prepare(sql) {
      return new Statement(sql)
    },
    exec(sql) {
      rawDb.run(sql)
      persist()
    },
    transaction(fn) {
      return (...args) => {
        rawDb.run('BEGIN')
        inTransaction = true
        try {
          const result = fn(...args)
          rawDb.run('COMMIT')
          inTransaction = false
          persist()
          return result
        } catch (err) {
          inTransaction = false
          try {
            rawDb.run('ROLLBACK')
          } catch (rollbackErr) {
            // Giao dich co the da tu ket thuc (vi du do loi truoc do) - bo qua loi rollback,
            // uu tien nem loi goc de de debug.
          }
          throw err
        }
      }
    }
  }
}

function tableHasColumn(db, table, column) {
  const res = db.exec(`PRAGMA table_info(${table})`)
  if (!res[0]) return false
  const nameIdx = res[0].columns.indexOf('name')
  return res[0].values.some((row) => row[nameIdx] === column)
}

/**
 * Migrate cac DB da ton tai tu truoc khi co tinh nang dang video/trang ca
 * nhan/fanpage. CREATE TABLE IF NOT EXISTS trong schema.js KHONG tu them cot
 * hay doi rang buoc cho bang da co san, nen phai tu xu ly o day. Idempotent:
 * chi chay khi cot con thieu, an toan goi lai nhieu lan.
 */
function migrate(db) {
  if (!tableHasColumn(db, 'facebook_accounts', 'fanpage_url')) {
    db.run('ALTER TABLE facebook_accounts ADD COLUMN fanpage_url TEXT')
  }

  if (!tableHasColumn(db, 'post_jobs', 'target_type')) {
    // SQLite khong ho tro sua NOT NULL/them cot co rang buoc phu thuoc bang
    // khac truc tiep -> phai dung ky thuat rebuild bang chuan cua SQLite:
    // tao bang moi -> copy du lieu (job cu mac dinh la GROUP) -> xoa bang cu
    // -> doi ten bang moi. Tat foreign_keys trong luc rebuild de tranh loi
    // tam thoi khi bang post_jobs khong ton tai.
    db.run('PRAGMA foreign_keys = OFF')
    db.run(`
      CREATE TABLE post_jobs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES facebook_accounts(id),
        target_type TEXT NOT NULL DEFAULT 'GROUP',
        group_id INTEGER REFERENCES facebook_groups(id),
        status TEXT NOT NULL DEFAULT 'CHUA_XU_LY',
        facebook_post_url TEXT,
        posted_at TEXT,
        last_checked_at TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.run(`
      INSERT INTO post_jobs_new
        (id, post_id, account_id, target_type, group_id, status, facebook_post_url,
         posted_at, last_checked_at, retry_count, error_code, error_message, created_at, updated_at)
      SELECT id, post_id, account_id, 'GROUP', group_id, status, facebook_post_url,
             posted_at, last_checked_at, retry_count, error_code, error_message, created_at, updated_at
      FROM post_jobs
    `)
    db.run('DROP TABLE post_jobs')
    db.run('ALTER TABLE post_jobs_new RENAME TO post_jobs')
    db.run('CREATE INDEX IF NOT EXISTS idx_post_jobs_post ON post_jobs(post_id)')
    db.run('CREATE INDEX IF NOT EXISTS idx_post_jobs_account ON post_jobs(account_id)')
    db.run('CREATE INDEX IF NOT EXISTS idx_post_jobs_group ON post_jobs(group_id)')
    db.run('CREATE INDEX IF NOT EXISTS idx_post_jobs_status ON post_jobs(status)')
    db.run('PRAGMA foreign_keys = ON')
  }

  if (tableHasColumn(db, 'video_library', 'video_url') && !tableHasColumn(db, 'video_library', 'tiktok_post_url')) {
    db.run('ALTER TABLE video_library ADD COLUMN tiktok_post_url TEXT')
  }

  // Da nen tang (Instagram/TikTok/Threads): them cot platform, doi ten
  // facebook_post_url -> post_url cho dung nghia (khong chi rieng Facebook nua).
  if (tableHasColumn(db, 'post_jobs', 'target_type') && !tableHasColumn(db, 'post_jobs', 'platform')) {
    db.run("ALTER TABLE post_jobs ADD COLUMN platform TEXT NOT NULL DEFAULT 'facebook'")
  }
  if (tableHasColumn(db, 'post_jobs', 'facebook_post_url') && !tableHasColumn(db, 'post_jobs', 'post_url')) {
    db.run('ALTER TABLE post_jobs RENAME COLUMN facebook_post_url TO post_url')
  }

  // Tai khoan Nhan vien rieng: gan "nguoi thuc hien" vao tung job.
  if (!tableHasColumn(db, 'post_jobs', 'performed_by')) {
    db.run('ALTER TABLE post_jobs ADD COLUMN performed_by TEXT')
  }

  // Dang ky tu phuc vu + cho duyet + wizard thiet lap lan dau: gop trang
  // thai tai khoan Nhan vien ve 1 cot 'status' duy nhat (thay vi 2 cot
  // is_active/status cung anh huong logic dang nhap), backfill tu is_active cu.
  if (!tableHasColumn(db, 'staff_users', 'status')) {
    db.run("ALTER TABLE staff_users ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE'")
    if (tableHasColumn(db, 'staff_users', 'is_active')) {
      db.run("UPDATE staff_users SET status = CASE WHEN is_active = 1 THEN 'ACTIVE' ELSE 'LOCKED' END")
    }
  }
  if (!tableHasColumn(db, 'staff_users', 'wizard_completed')) {
    db.run('ALTER TABLE staff_users ADD COLUMN wizard_completed INTEGER NOT NULL DEFAULT 0')
  }
  if (!tableHasColumn(db, 'staff_users', 'role')) {
    db.run("ALTER TABLE staff_users ADD COLUMN role TEXT NOT NULL DEFAULT 'STAFF'")
  }

  // Lich dang tu dong: cho phep gan dung 1 video cu the + noi dung rieng,
  // thay vi luon tu lay "video ke tiep" trong Kho video.
  if (!tableHasColumn(db, 'post_schedules', 'video_library_id')) {
    db.run('ALTER TABLE post_schedules ADD COLUMN video_library_id INTEGER REFERENCES video_library(id)')
  }
  if (!tableHasColumn(db, 'post_schedules', 'custom_content')) {
    db.run('ALTER TABLE post_schedules ADD COLUMN custom_content TEXT')
  }

  // Kiem tra dang nhap TikTok rieng (khong dung chung voi login_status von
  // chi kiem tra Facebook).
  if (!tableHasColumn(db, 'facebook_accounts', 'tiktok_login_status')) {
    db.run('ALTER TABLE facebook_accounts ADD COLUMN tiktok_login_status TEXT')
  }
}

/**
 * Phai duoc goi (va cho hoan tat) MOT LAN khi ung dung khoi dong, truoc khi
 * bat ky service nao goi getDb(). Vi sql.js can nap module WASM bat dong bo.
 */
async function initDb() {
  if (wrapper) return wrapper

  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`)
  })

  const dataDir = resolveDataDir()
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  dbFilePath = path.join(dataDir, 'app.db')

  rawDb = fs.existsSync(dbFilePath) ? new SQL.Database(fs.readFileSync(dbFilePath)) : new SQL.Database()
  rawDb.run('PRAGMA foreign_keys = ON')

  // require (khong phai fs.readFileSync) de Rollup nhung noi dung schema
  // truc tiep vao bundle khi dong goi cho Electron - xem ghi chu trong schema.js
  const schemaSql = require('./schema')
  rawDb.run(schemaSql)
  migrate(rawDb)

  wrapper = buildWrapper()
  persist()
  return wrapper
}

function getDb() {
  if (!wrapper) {
    throw new Error('Database chưa được khởi tạo. Cần gọi và chờ initDb() trước khi dùng getDb().')
  }
  return wrapper
}

function getDataDir() {
  return resolveDataDir()
}

module.exports = { initDb, getDb, getDataDir }
