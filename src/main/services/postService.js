const { getDb } = require('../db/database')
const { canAccountPostToGroup } = require('./accountGroupService')
const { JOB_STATUS } = require('../automation/statusCodes')

function nowIso() {
  return new Date().toISOString()
}

/**
 * Kiem tra dieu kien toi thieu truoc khi tao chien dich (muc 8, buoc 1-3).
 */
function validateCampaignPayload(payload) {
  const errors = []
  if (!payload.content || !payload.content.trim()) {
    errors.push('Nội dung bài viết không được để trống.')
  }
  const selections = payload.selections || []
  const accountIds = new Set(selections.map((s) => s.account_id))
  if (accountIds.size === 0) {
    errors.push('Chưa chọn tài khoản Facebook nào.')
  }
  if (selections.length === 0) {
    errors.push('Chưa chọn nhóm nào để đăng.')
  }
  return errors
}

/**
 * Tao mot chien dich dang bai: 1 Post + N PostMedia + N PostJob (muc 8, buoc 5-7).
 * payload: {
 *   campaign_name, content, dry_run, delay_seconds,
 *   media: [{ file_path, file_type }],
 *   selections: [{ account_id, group_id }]
 * }
 */
function createCampaign(payload) {
  const errors = validateCampaignPayload(payload)
  if (errors.length) {
    const err = new Error(errors.join(' '))
    err.validationErrors = errors
    throw err
  }

  const db = getDb()
  const insertPost = db.prepare(`
    INSERT INTO posts (campaign_name, content, status, dry_run, delay_seconds)
    VALUES (@campaign_name, @content, 'QUEUED', @dry_run, @delay_seconds)
  `)
  const insertMedia = db.prepare(`
    INSERT INTO post_media (post_id, file_path, file_type, sort_order)
    VALUES (@post_id, @file_path, @file_type, @sort_order)
  `)
  const insertJob = db.prepare(`
    INSERT INTO post_jobs (post_id, account_id, group_id, status, error_code, error_message)
    VALUES (@post_id, @account_id, @group_id, @status, @error_code, @error_message)
  `)

  const tx = db.transaction(() => {
    const postInfo = insertPost.run({
      campaign_name: payload.campaign_name || `Chiến dịch ${new Date().toLocaleString('vi-VN')}`,
      content: payload.content,
      dry_run: payload.dry_run ? 1 : 0,
      delay_seconds: payload.delay_seconds ?? 30
    })
    const postId = postInfo.lastInsertRowid

    ;(payload.media || []).forEach((m, idx) => {
      insertMedia.run({ post_id: postId, file_path: m.file_path, file_type: m.file_type || 'image', sort_order: idx })
    })

    payload.selections.forEach((sel) => {
      // Khong cho phep tao job neu tai khoan chua tham gia nhom (muc 4)
      const allowed = canAccountPostToGroup(sel.account_id, sel.group_id)
      insertJob.run({
        post_id: postId,
        account_id: sel.account_id,
        group_id: sel.group_id,
        status: allowed ? JOB_STATUS.QUEUED : JOB_STATUS.NOT_A_MEMBER,
        error_code: allowed ? null : 'ACCOUNT_NOT_MEMBER',
        error_message: allowed ? null : 'Tài khoản chưa tham gia nhóm này.'
      })
    })

    return postId
  })

  const postId = tx()
  return getCampaign(postId)
}

function getCampaign(postId) {
  const db = getDb()
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)
  if (!post) return null
  const media = db.prepare('SELECT * FROM post_media WHERE post_id = ? ORDER BY sort_order ASC').all(postId)
  const jobs = db.prepare(`
    SELECT pj.*, a.display_name AS account_name, g.group_name, g.group_url
    FROM post_jobs pj
    JOIN facebook_accounts a ON a.id = pj.account_id
    JOIN facebook_groups g ON g.id = pj.group_id
    WHERE pj.post_id = ?
    ORDER BY a.id ASC, pj.id ASC
  `).all(postId)
  return { ...post, media, jobs }
}

function listCampaigns() {
  const db = getDb()
  return db.prepare('SELECT * FROM posts ORDER BY id DESC').all()
}

/**
 * filters: { status, accountId, groupId, campaign, keyword, dateFrom, dateTo }
 */
function listJobs(filters = {}) {
  const db = getDb()
  const clauses = []
  const params = {}

  if (filters.status) {
    clauses.push('pj.status = @status')
    params.status = filters.status
  }
  if (filters.accountId) {
    clauses.push('pj.account_id = @accountId')
    params.accountId = filters.accountId
  }
  if (filters.groupId) {
    clauses.push('pj.group_id = @groupId')
    params.groupId = filters.groupId
  }
  if (filters.campaign) {
    clauses.push('p.campaign_name LIKE @campaign')
    params.campaign = `%${filters.campaign}%`
  }
  if (filters.keyword) {
    clauses.push('p.content LIKE @keyword')
    params.keyword = `%${filters.keyword}%`
  }
  if (filters.dateFrom) {
    clauses.push('pj.created_at >= @dateFrom')
    params.dateFrom = filters.dateFrom
  }
  if (filters.dateTo) {
    clauses.push('pj.created_at <= @dateTo')
    params.dateTo = filters.dateTo
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  return db.prepare(`
    SELECT pj.*, p.campaign_name, p.content, p.dry_run,
           a.display_name AS account_name,
           g.group_name, g.group_url
    FROM post_jobs pj
    JOIN posts p ON p.id = pj.post_id
    JOIN facebook_accounts a ON a.id = pj.account_id
    JOIN facebook_groups g ON g.id = pj.group_id
    ${where}
    ORDER BY pj.id DESC
  `).all(params)
}

function statusCounts(filters = {}) {
  const rows = listJobs(filters)
  const counts = {}
  rows.forEach((r) => {
    counts[r.status] = (counts[r.status] || 0) + 1
  })
  counts.__total = rows.length
  return counts
}

function updateJob(jobId, data) {
  const db = getDb()
  const current = db.prepare('SELECT * FROM post_jobs WHERE id = ?').get(jobId)
  if (!current) throw new Error(`Khong tim thay job id=${jobId}`)
  const merged = { ...current, ...data, id: jobId, updated_at: nowIso() }
  db.prepare(`
    UPDATE post_jobs SET
      status = @status,
      facebook_post_url = @facebook_post_url,
      posted_at = @posted_at,
      last_checked_at = @last_checked_at,
      retry_count = @retry_count,
      error_code = @error_code,
      error_message = @error_message,
      updated_at = @updated_at
    WHERE id = @id
  `).run(merged)
  return db.prepare('SELECT * FROM post_jobs WHERE id = ?').get(jobId)
}

function retryJob(jobId) {
  const db = getDb()
  const current = db.prepare('SELECT * FROM post_jobs WHERE id = ?').get(jobId)
  if (!current) throw new Error(`Khong tim thay job id=${jobId}`)
  return updateJob(jobId, {
    status: JOB_STATUS.QUEUED,
    error_code: null,
    error_message: null,
    retry_count: current.retry_count + 1
  })
}

function setPostStatus(postId, status) {
  const db = getDb()
  db.prepare('UPDATE posts SET status = @status, updated_at = @now WHERE id = @id')
    .run({ id: postId, status, now: nowIso() })
}

/**
 * Dung toan bo cac job dang QUEUED/WAITING/IN_PROGRESS cua mot chien dich.
 */
function stopCampaign(postId) {
  const db = getDb()
  const stoppable = [JOB_STATUS.QUEUED, JOB_STATUS.WAITING, JOB_STATUS.IN_PROGRESS]
  const placeholders = stoppable.map(() => '?').join(',')
  db.prepare(`UPDATE post_jobs SET status = ?, updated_at = ? WHERE post_id = ? AND status IN (${placeholders})`)
    .run(JOB_STATUS.STOPPED, nowIso(), postId, ...stoppable)
  setPostStatus(postId, 'STOPPED')
}

/**
 * Xoa mot dong lich su (1 PostJob). Neu day la job cuoi cung cua Post, xoa
 * luon Post (va PostMedia lien quan qua ON DELETE CASCADE).
 */
function deleteJob(jobId) {
  const db = getDb()
  const job = db.prepare('SELECT * FROM post_jobs WHERE id = ?').get(jobId)
  if (!job) return true
  db.prepare('DELETE FROM post_jobs WHERE id = ?').run(jobId)
  const remaining = db.prepare('SELECT COUNT(*) AS c FROM post_jobs WHERE post_id = ?').get(job.post_id).c
  if (remaining === 0) {
    db.prepare('DELETE FROM posts WHERE id = ?').run(job.post_id)
  }
  return true
}

function toCsv(rows) {
  const headers = [
    'campaign_name', 'account_name', 'group_name', 'group_url', 'status',
    'facebook_post_url', 'posted_at', 'error_code', 'error_message', 'created_at'
  ]
  const escape = (v) => {
    if (v === null || v === undefined) return ''
    const s = String(v).replace(/"/g, '""')
    return `"${s}"`
  }
  const lines = [headers.join(',')]
  rows.forEach((r) => {
    lines.push(headers.map((h) => escape(r[h])).join(','))
  })
  return lines.join('\n')
}

function exportHistoryCsv(filters = {}) {
  return toCsv(listJobs(filters))
}

module.exports = {
  validateCampaignPayload,
  createCampaign,
  getCampaign,
  listCampaigns,
  listJobs,
  statusCounts,
  updateJob,
  retryJob,
  setPostStatus,
  stopCampaign,
  deleteJob,
  exportHistoryCsv
}
