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
