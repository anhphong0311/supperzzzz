const path = require('path')
const { EventEmitter } = require('events')

const postService = require('../services/postService')
const accountService = require('../services/accountService')
const settingsService = require('../services/settingsService')
const logService = require('../services/logService')
const { launchProfile, safeScreenshot } = require('../automation/browserManager')
const facebookAutomation = require('../automation/postAutomation')
const instagramAutomation = require('../automation/instagramAutomation')
const tiktokAutomation = require('../automation/tiktokAutomation')
const { ManualInterventionError, JobExecutionError } = require('../automation/postAutomation')
const { JOB_STATUS } = require('../automation/statusCodes')
const { getDataDir } = require('../db/database')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Moi nen tang co 1 module automation rieng (DOM hoan toan khac nhau), dung
// chung 1 chu ky ham executeJob({page, target, content, mediaPaths, dryRun,
// timeouts, screenshotDir, log}) va nem chung ManualInterventionError/
// JobExecutionError de logic hang doi ben duoi khong can biet nen tang nao.
const AUTOMATION_BY_PLATFORM = {
  facebook: facebookAutomation,
  instagram: instagramAutomation,
  tiktok: tiktokAutomation
}

/**
 * Quy doi 1 PostJob (+ tai khoan cua no) thanh doi tuong target ma cac
 * module automation can: { type, url, name }.
 */
function buildTarget(job, account) {
  if (job.target_type === 'TIMELINE') {
    return { type: 'TIMELINE', url: 'https://www.facebook.com/', name: 'Trang cá nhân' }
  }
  if (job.target_type === 'PAGE') {
    return { type: 'PAGE', url: account.fanpage_url, name: 'Fanpage' }
  }
  if (job.target_type === 'INSTAGRAM_POST') {
    return { type: 'INSTAGRAM_POST', url: 'https://www.instagram.com/', name: 'Instagram' }
  }
  if (job.target_type === 'TIKTOK_POST') {
    return { type: 'TIKTOK_POST', url: 'https://www.tiktok.com/upload', name: 'TikTok' }
  }
  return { type: 'GROUP', url: job.group_url, name: job.group_name }
}

/**
 * Xu ly hang doi dang bai TUAN TU: hoan thanh toan bo nhom cua 1 tai khoan
 * roi moi chuyen sang tai khoan tiep theo (muc 8). KHONG chay dong thoi
 * nhieu tai khoan trong phien ban dau tien.
 */
class PostQueue extends EventEmitter {
  constructor() {
    super()
    this.state = 'IDLE' // IDLE | RUNNING | PAUSED | STOPPED
    this.currentPostId = null
    this._stopRequested = false
    this._pauseRequested = false
  }

  isBusy() {
    return this.state === 'RUNNING' || this.state === 'PAUSED'
  }

  async _waitWhilePaused() {
    while (this._pauseRequested && !this._stopRequested) {
      await sleep(500)
    }
  }

  pause() {
    if (this.state !== 'RUNNING') return
    this._pauseRequested = true
    this.state = 'PAUSED'
    this.emit('state-changed', { state: this.state })
  }

  resume() {
    if (this.state !== 'PAUSED') return
    this._pauseRequested = false
    this.state = 'RUNNING'
    this.emit('state-changed', { state: this.state })
  }

  stop() {
    this._stopRequested = true
    this._pauseRequested = false
  }

  async run(postId) {
    if (this.isBusy()) {
      throw new Error('Đang có một chiến dịch khác đang chạy. Vui lòng dừng trước khi bắt đầu chiến dịch mới.')
    }

    // Bat truong hop app da mo lien tuc qua nua dem - luc app khoi dong co
    // the van con "hom qua", nen kiem tra lai ngay truoc moi lan chay.
    accountService.resetDailyCountersIfNewDay()

    this.currentPostId = postId
    this._stopRequested = false
    this._pauseRequested = false
    this.state = 'RUNNING'
    this.emit('state-changed', { state: this.state, postId })

    const settings = settingsService.getAll()
    const screenshotDir = path.join(getDataDir(), 'screenshots')
    const delayMs = Number(settings.delay_between_posts_seconds || 30) * 1000
    const dailyLimit = Number(settings.daily_post_limit_per_account || 20)
    const timeouts = {
      pageLoadMs: Number(settings.page_load_timeout_ms || 30000),
      mediaUploadMs: Number(settings.media_upload_timeout_ms || 60000),
      videoProcessingMs: Number(settings.video_processing_timeout_ms || 90000)
    }
    const headless = String(settings.headless_mode) === 'true'
    const autoCloseTab = String(settings.auto_close_tab) !== 'false'

    const campaign = postService.getCampaign(postId)
    if (!campaign) throw new Error(`Không tìm thấy chiến dịch id=${postId}`)

    postService.setPostStatus(postId, 'IN_PROGRESS')

    // Nhom job theo tai khoan, giu nguyen thu tu chon ban dau (muc 8, buoc 8-9)
    const jobsByAccount = new Map()
    campaign.jobs
      .filter((j) => j.status === JOB_STATUS.QUEUED)
      .forEach((j) => {
        if (!jobsByAccount.has(j.account_id)) jobsByAccount.set(j.account_id, [])
        jobsByAccount.get(j.account_id).push(j)
      })

    const totalJobs = campaign.jobs.length
    let completedCount = 0
    const mediaPaths = campaign.media.map((m) => m.file_path)

    const log = (jobId, level, message) => {
      logService.addLog(jobId, level, message)
      this.emit('log', { postId, jobId, level, message, at: new Date().toISOString() })
    }

    for (const [accountId, jobs] of jobsByAccount) {
      if (this._stopRequested) break
      await this._waitWhilePaused()
      if (this._stopRequested) break

      const account = accountService.get(accountId)
      if (!account) continue

      if (account.account_status === 'TAM_DUNG') {
        jobs.forEach((j) => postService.updateJob(j.id, { status: JOB_STATUS.STOPPED, error_message: 'Tài khoản đang tạm dừng.' }))
        continue
      }

      let context
      let page
      try {
        context = await launchProfile(account.browser_profile_path, { headless })
        page = context.pages()[0] || (await context.newPage())
      } catch (err) {
        jobs.forEach((j) =>
          postService.updateJob(j.id, {
            status: JOB_STATUS.FAILED,
            error_code: 'NETWORK_ERROR',
            error_message: `Không mở được trình duyệt cho tài khoản: ${err.message}`
          })
        )
        continue
      }

      for (const job of jobs) {
        if (this._stopRequested) {
          postService.updateJob(job.id, { status: JOB_STATUS.STOPPED })
          continue
        }
        await this._waitWhilePaused()
        if (this._stopRequested) {
          postService.updateJob(job.id, { status: JOB_STATUS.STOPPED })
          continue
        }

        if (account.posts_today >= dailyLimit) {
          postService.updateJob(job.id, {
            status: JOB_STATUS.STOPPED,
            error_message: `Đã đạt giới hạn ${dailyLimit} bài/ngày cho tài khoản này.`
          })
          continue
        }

        postService.updateJob(job.id, { status: JOB_STATUS.IN_PROGRESS })
        this.emit('progress', {
          postId,
          jobId: job.id,
          accountName: account.display_name,
          targetName: job.target_name,
          status: JOB_STATUS.IN_PROGRESS,
          completedCount,
          totalJobs
        })

        const target = buildTarget(job, account)
        const automation = AUTOMATION_BY_PLATFORM[job.platform || 'facebook'] || facebookAutomation

        try {
          const result = await automation.executeJob({
            page,
            target,
            content: campaign.content,
            mediaPaths,
            dryRun: !!campaign.dry_run,
            timeouts,
            screenshotDir,
            log: (level, message) => log(job.id, level, message)
          })

          postService.updateJob(job.id, {
            status: result.status,
            post_url: result.postUrl || null,
            posted_at: new Date().toISOString(),
            last_checked_at: new Date().toISOString()
          })

          if ([JOB_STATUS.POSTED, JOB_STATUS.PUBLISHED, JOB_STATUS.PENDING_APPROVAL].includes(result.status)) {
            accountService.incrementPostsToday(accountId)
            account.posts_today += 1
          }
        } catch (err) {
          if (err instanceof ManualInterventionError) {
            postService.updateJob(job.id, {
              status:
                err.code === 'LOGIN_SESSION_EXPIRED'
                  ? JOB_STATUS.LOGIN_EXPIRED
                  : JOB_STATUS.CHECKPOINT_REQUIRED,
              error_code: err.code,
              error_message: err.message
            })
            log(job.id, 'ERROR', `CẦN XỬ LÝ THỦ CÔNG: ${err.message}`)
            this.emit('manual-intervention', { postId, jobId: job.id, accountId, code: err.code, message: err.message })
            this._stopRequested = true
            break
          } else if (err instanceof JobExecutionError) {
            postService.updateJob(job.id, { status: JOB_STATUS.FAILED, error_code: err.errorCode, error_message: err.message })
            log(job.id, 'ERROR', err.message)
          } else {
            postService.updateJob(job.id, { status: JOB_STATUS.FAILED, error_code: 'UNKNOWN_ERROR', error_message: err.message })
            log(job.id, 'ERROR', `Lỗi không xác định: ${err.message}`)
            await safeScreenshot(page, screenshotDir, 'unknown-error').catch(() => {})
          }
        }

        completedCount += 1
        this.emit('progress', {
          postId,
          jobId: job.id,
          accountName: account.display_name,
          targetName: job.target_name,
          status: postService.getCampaign(postId).jobs.find((j) => j.id === job.id)?.status,
          completedCount,
          totalJobs
        })

        if (!this._stopRequested && job !== jobs[jobs.length - 1]) {
          await sleep(delayMs)
        }
      }

      if (autoCloseTab && context) {
        await context.close().catch(() => {})
      }
    }

    this.state = this._stopRequested ? 'STOPPED' : 'IDLE'
    postService.setPostStatus(postId, this._stopRequested ? 'STOPPED' : 'COMPLETED')
    this.emit('state-changed', { state: this.state, postId })
    this.emit('campaign-finished', { postId, stopped: this._stopRequested })
    this.currentPostId = null
    return { stopped: this._stopRequested }
  }
}

module.exports = new PostQueue()
