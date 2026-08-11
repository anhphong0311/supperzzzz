const fs = require('fs')
const path = require('path')
const { createClient } = require('@libsql/client')

// DATABASE_URL:
//   - "file:./local.db"        -> SQLite nhung, dung khi phat trien cuc bo, khong can tai khoan cloud
//   - "libsql://xxx.turso.io"  -> Turso that, dung o production (can them DATABASE_AUTH_TOKEN)
const client = createClient({
  url: process.env.DATABASE_URL || 'file:./local.db',
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined
})

// Tu chay schema.sql moi khi server khoi dong - idempotent nho CREATE TABLE
// IF NOT EXISTS, giup Turso DB rong tu khoi tao ma khong can buoc "migrate"
// thu cong nao rieng.
async function initSchema() {
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await client.executeMultiple(schemaSql)
}

module.exports = { client, initSchema }
