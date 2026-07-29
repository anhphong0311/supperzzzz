const { getDb } = require('../db/database')

function addLog(postJobId, logLevel, message, screenshotPath = null) {
  const db = getDb()
  const info = db.prepare(`
    INSERT INTO post_logs (post_job_id, log_level, message, screenshot_path)
    VALUES (@post_job_id, @log_level, @message, @screenshot_path)
  `).run({ post_job_id: postJobId, log_level: logLevel, message, screenshot_path: screenshotPath })
  return info.lastInsertRowid
}

function listForJob(postJobId) {
  const db = getDb()
  return db.prepare('SELECT * FROM post_logs WHERE post_job_id = ? ORDER BY id ASC').all(postJobId)
}

function listRecent(limit = 200) {
  const db = getDb()
  return db.prepare(`
    SELECT pl.*, pj.account_id, pj.group_id
    FROM post_logs pl
    LEFT JOIN post_jobs pj ON pj.id = pl.post_job_id
    ORDER BY pl.id DESC
    LIMIT ?
  `).all(limit)
}

module.exports = { addLog, listForJob, listRecent }
