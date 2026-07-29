/**
 * Script khoi tao database. Chay bang: npm run db:init
 * Tao file data/app.db va toan bo bang theo schema.sql neu chua ton tai.
 */
const { initDb, getDb, getDataDir } = require('./database')

;(async () => {
  await initDb()
  const db = getDb()
  console.log(`Database da san sang tai: ${getDataDir()}`)

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name)

  console.log('Cac bang hien co:', tables.join(', '))
})()
