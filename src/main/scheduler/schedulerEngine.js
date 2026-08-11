const { EventEmitter } = require('events')

const scheduleService = require('../services/scheduleService')
const videoLibraryService = require('../services/videoLibraryService')
const postService = require('../services/postService')
const settingsService = require('../services/settingsService')
const postQueue = require('../queue/postQueue')
const notifier = require('../notifier')

const TICK_INTERVAL_MS = 20000
const SUCCESS_STATUSES = ['POSTED', 'PUBLISHED', 'PENDING_APPROVAL', 'APPROVED']

/**
 * Dong ho lich dang tu dong (Giai doan 3). Chi hoat dong trong khi APP DANG
 * MO - khong phai dich vu chay nen 24/7 tren he dieu hanh. Neu app dong,
 * lich hom do se khong chay - dieu nay duoc ghi ro trong README/UI.
 *
 * Nguyen tac an toan giu nguyen: khi executeJob gap CAPTCHA/checkpoint,
 * postQueue van DUNG LAI va bao qua notifier - KHONG co co che tu dong
 * vuot qua duoi bat ky hinh thuc nao.
 */
class SchedulerEngine extends EventEmitter {
  constructor() {
    super()
    this._timer = null
    this._ticking = false
  }

  start() {
    if (this._timer) return
    this._timer = setInterval(() => this.tick().catch(() => {}), TICK_INTERVAL_MS)
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  log(message) {
    this.emit('log', { message, at: new Date().toISOString() })
  }

  async tick() {
    if (this._ticking) return
    this._ticking = true
    try {
      if (postQueue.isBusy()) return // co chien dich dang chay (co the do nguoi dung tu bam) - doi tick sau

      const due = scheduleService.findDueSchedules()
      for (const schedule of due) {
        // Danh dau da "chay" hom nay NGAY LAP TUC de tranh bi tick ke tiep
        // (neu qua trinh dang mat nhieu thoi gian) nhan trung lich nay lan nua.
        scheduleService.recordFireResult(schedule.id, { status: 'DANG_CHAY', message: null })
        this.emit('fire-start', { scheduleId: schedule.id, timeOfDay: schedule.time_of_day })
        this.log(`Đến giờ ${schedule.time_of_day} (lịch #${schedule.id}) - bắt đầu xử lý...`)

        const result = await this.fireSchedule(schedule).catch((err) => ({
          status: 'FAILED',
          message: `Lỗi không xác định: ${err.message}`
        }))

        scheduleService.recordFireResult(schedule.id, result)
        this.emit('fired', { scheduleId: schedule.id, ...result })
        this.log(`Lịch #${schedule.id} (${schedule.time_of_day}): ${result.status} - ${result.message}`)

        if (result.status === 'MANUAL_INTERVENTION' || result.status === 'FAILED') {
          notifier.notify('FB Multi Poster - Cần chú ý', result.message)
        } else if (result.status === 'OK') {
          notifier.notify('FB Multi Poster - Đã đăng tự động', result.message)
        }

        if (postQueue.isBusy()) break // an toan, khong nen xay ra vi da await xong postQueue.run()
      }
    } finally {
      this._ticking = false
    }
  }

  /**
   * Chay thu 1 lich NGAY LAP TUC (bo qua kiem tra gio/da chay hom nay chua) -
   * dung cho nut "Chạy thử ngay" trong UI de kiem tra cau hinh lich dung
   * chua ma khong can doi den dung gio.
   */
  async runNow(scheduleId) {
    if (postQueue.isBusy()) {
      throw new Error('Đang có một chiến dịch khác chạy trong hàng đợi. Vui lòng đợi hoặc dừng trước.')
    }
    const schedule = scheduleService.get(scheduleId)
    if (!schedule) throw new Error(`Không tìm thấy lịch id=${scheduleId}`)
    const result = await this.fireSchedule(schedule)
    scheduleService.recordFireResult(scheduleId, result)
    this.emit('fired', { scheduleId, ...result })
    return result
  }

  /**
   * Thuc hien 1 lan len lich: lay video ke tiep, tao chien dich, chay hang
   * doi, ghi ket qua nguoc ve Kho video + Google Sheet.
   */
  async fireSchedule(schedule) {
    try {
      await videoLibraryService.syncFromSheet()
    } catch (err) {
      this.log(`Không đồng bộ được Google Sheet trước khi đăng: ${err.message} (vẫn tiếp tục với dữ liệu cũ)`)
    }

    // Neu lich da gan san 1 video cu the (khong phai "tu dong lay video ke
    // tiep") thi luon dung dung video do, khong lay tu hang cho chung.
    let video
    if (schedule.video_library_id) {
      video = videoLibraryService.get(schedule.video_library_id)
      if (!video) {
        return { status: 'FAILED', message: 'Video đã gán cho lịch này không còn tồn tại trong Kho video.' }
      }
    } else {
      video = videoLibraryService.pickNextPending()
      if (!video) {
        return { status: 'NO_VIDEO', message: 'Không có video nào sẵn sàng để đăng trong Kho video.' }
      }
    }

    if (!video.local_file_path) {
      this.log(`Đang tải video "${video.caption_hint || video.id}" từ Google Drive...`)
      try {
        video = await videoLibraryService.downloadVideo(video.id)
      } catch (err) {
        return { status: 'FAILED', message: `Tải video thất bại: ${err.message}` }
      }
    }

    const settings = settingsService.getAll()
    const payload = {
      campaign_name: `Lịch tự động ${schedule.time_of_day} - ${video.caption_hint || `Video #${video.id}`}`,
      content: schedule.custom_content || video.caption_hint || '',
      dry_run: !!schedule.dry_run,
      delay_seconds: Number(settings.delay_between_posts_seconds || 30),
      performed_by: 'Tự động (Lịch)',
      media: [{ file_path: video.local_file_path, file_type: 'video' }],
      selections: schedule.targets.map((t) => ({
        account_id: t.account_id,
        platform: t.target_type === 'INSTAGRAM_POST' ? 'instagram' : t.target_type === 'TIKTOK_POST' ? 'tiktok' : 'facebook',
        target_type: t.target_type,
        group_id: t.target_type === 'GROUP' ? t.group_id : undefined
      }))
    }

    let campaign
    try {
      campaign = postService.createCampaign(payload)
    } catch (err) {
      return { status: 'FAILED', message: `Không tạo được chiến dịch: ${err.message}` }
    }

    let manualIntervention = false
    const onManual = () => {
      manualIntervention = true
    }
    postQueue.once('manual-intervention', onManual)
    try {
      await postQueue.run(campaign.id)
    } catch (err) {
      postQueue.removeListener('manual-intervention', onManual)
      return { status: 'FAILED', message: `Lỗi khi chạy hàng đợi: ${err.message}` }
    }
    postQueue.removeListener('manual-intervention', onManual)

    const finalCampaign = postService.getCampaign(campaign.id)
    const successJob = finalCampaign.jobs.find((j) => SUCCESS_STATUSES.includes(j.status))
    const failedJob = finalCampaign.jobs.find((j) => !SUCCESS_STATUSES.includes(j.status))

    if (!schedule.dry_run) {
      try {
        // Ghi ket qua rieng cho TUNG nen tang co trong chien dich nay (1 lich
        // co the dang cung luc len Facebook + Instagram...).
        const platforms = [...new Set(finalCampaign.jobs.map((j) => j.platform || 'facebook'))]
        platforms.forEach((platform) => {
          const platformJobs = finalCampaign.jobs.filter((j) => (j.platform || 'facebook') === platform)
          const platformSuccess = platformJobs.find((j) => SUCCESS_STATUSES.includes(j.status))
          const platformFailed = platformJobs.find((j) => !SUCCESS_STATUSES.includes(j.status))
          if (platformSuccess) {
            videoLibraryService.markPlatformResult(video.id, platform, { success: true, url: platformSuccess.post_url })
          } else if (platformFailed) {
            videoLibraryService.markPlatformResult(video.id, platform, { success: false, errorMessage: platformFailed.error_message })
          }
        })
        await videoLibraryService.writeBackToSheet(video.id)
      } catch (err) {
        this.log(`Không ghi lại được kết quả vào Kho video/Sheet: ${err.message}`)
      }
    }

    if (manualIntervention) {
      return { status: 'MANUAL_INTERVENTION', message: 'Gặp checkpoint/yêu cầu xác minh khi đăng tự động - cần mở tài khoản để xử lý thủ công.' }
    }
    if (schedule.dry_run) {
      return { status: 'OK', message: `Đã chạy thử DRY_RUN cho video "${video.caption_hint || video.id}".` }
    }
    if (successJob) {
      // Lich gan voi 1 video CU THE (khong phai "tu dong lay video ke tiep")
      // thi tu tat sau khi da dang that thanh cong, tranh dang lap lai dung
      // video do vao lan chay ke tiep.
      if (schedule.video_library_id) {
        try {
          scheduleService.setEnabled(schedule.id, false)
        } catch (err) {
          this.log(`Không tự tắt được lịch sau khi đăng xong: ${err.message}`)
        }
      }
      return { status: 'OK', message: `Đã đăng thành công video "${video.caption_hint || video.id}".` }
    }
    return { status: 'FAILED', message: failedJob ? (failedJob.error_message || 'Đăng thất bại.') : 'Không xác định được kết quả.' }
  }
}

module.exports = new SchedulerEngine()
