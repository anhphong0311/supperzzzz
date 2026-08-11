const path = require('path')
const fs = require('fs')
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')

const accountService = require('./services/accountService')
const groupService = require('./services/groupService')
const accountGroupService = require('./services/accountGroupService')
const postService = require('./services/postService')
const settingsService = require('./services/settingsService')
const authService = require('./services/authService')
const staffService = require('./services/staffService')
const logService = require('./services/logService')
const videoLibraryService = require('./services/videoLibraryService')
const scheduleService = require('./services/scheduleService')
const browserManager = require('./automation/browserManager')
const postAutomation = require('./automation/postAutomation')
const instagramAutomation = require('./automation/instagramAutomation')
const tiktokAutomation = require('./automation/tiktokAutomation')
const postQueue = require('./queue/postQueue')
const schedulerEngine = require('./scheduler/schedulerEngine')
const notifier = require('./notifier')
const updater = require('./updater')
const competitorPriceService = require('./priceTracking/competitorPriceService')
const { initDb, getDataDir } = require('./db/database')

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function registerQueueEventForwarding() {
  postQueue.on('progress', (data) => sendToRenderer('queue:progress', data))
  postQueue.on('log', (data) => sendToRenderer('queue:log', data))
  postQueue.on('state-changed', (data) => sendToRenderer('queue:state-changed', data))
  postQueue.on('manual-intervention', (data) => {
    sendToRenderer('queue:manual-intervention', data)
    notifier.notify('FB Multi Poster - Cần xử lý thủ công', data.message)
  })
  postQueue.on('campaign-finished', (data) => sendToRenderer('queue:campaign-finished', data))

  schedulerEngine.on('log', (data) => sendToRenderer('scheduler:log', data))
  schedulerEngine.on('fire-start', (data) => sendToRenderer('scheduler:fire-start', data))
  schedulerEngine.on('fired', (data) => sendToRenderer('scheduler:fired', data))
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      const result = await fn(...args)
      return { ok: true, data: result }
    } catch (err) {
      return { ok: false, error: err.message || String(err) }
    }
  })
}

function registerIpcHandlers() {
  // --- Tai khoan Facebook ---
  handle('accounts:list', () => accountService.list())
  handle('accounts:create', (data) => accountService.create(data))
  handle('accounts:update', (id, data) => accountService.update(id, data))
  handle('accounts:remove', (id) => accountService.remove(id))
  handle('accounts:setStatus', (id, status) => accountService.setAccountStatus(id, status))
  handle('accounts:pickProfileFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] })
    if (result.canceled || !result.filePaths[0]) return null
    return result.filePaths[0]
  })
  handle('accounts:openProfileForLogin', async (id, platform) => {
    const account = accountService.get(id)
    if (!account) throw new Error('Không tìm thấy tài khoản.')
    await browserManager.openProfileForManualLogin(account.browser_profile_path, platform)
    return true
  })
  handle('accounts:checkLoginStatus', async (id) => {
    const account = accountService.get(id)
    if (!account) throw new Error('Không tìm thấy tài khoản.')
    const settings = settingsService.getAll()
    const headless = String(settings.headless_mode) === 'true'
    const status = await browserManager.checkLoginStatus(account.browser_profile_path, {
      headless,
      screenshotDir: path.join(getDataDir(), 'screenshots')
    })
    return accountService.setLoginStatus(id, status)
  })
  handle('accounts:checkTiktokLoginStatus', async (id) => {
    const account = accountService.get(id)
    if (!account) throw new Error('Không tìm thấy tài khoản.')
    const settings = settingsService.getAll()
    const headless = String(settings.headless_mode) === 'true'
    const status = await browserManager.checkTiktokLoginStatus(account.browser_profile_path, { headless })
    return accountService.setTiktokLoginStatus(id, status)
  })

  // --- Nhom Facebook ---
  handle('groups:list', (filters) => groupService.list(filters))
  handle('groups:get', (id) => groupService.get(id))
  handle('groups:create', (data) => groupService.create(data))
  handle('groups:createMany', (urls) => groupService.createMany(urls))
  handle('groups:update', (id, data) => groupService.update(id, data))
  handle('groups:remove', (id) => groupService.remove(id))
  handle('groups:checkAccess', async (groupId, accountId) => {
    const group = groupService.get(groupId)
    const account = accountService.get(accountId)
    if (!group || !account) throw new Error('Không tìm thấy nhóm hoặc tài khoản.')
    const settings = settingsService.getAll()
    const headless = String(settings.headless_mode) === 'true'
    const result = await browserManager.checkGroupAccess(account.browser_profile_path, group.group_url, { headless })
    const groupStatus = result === 'HOAT_DONG' ? 'HOAT_DONG' : result === 'KHONG_TRUY_CAP_DUOC' ? 'KHONG_HOAT_DONG' : group.group_status
    groupService.setStatus(groupId, groupStatus)
    if (result === 'HOAT_DONG' || result === 'CHUA_THAM_GIA') {
      accountGroupService.setMembership({
        account_id: accountId,
        group_id: groupId,
        membership_status: result === 'HOAT_DONG' ? 'THANH_VIEN' : 'KHONG_PHAI_THANH_VIEN',
        can_post: result === 'HOAT_DONG' ? 1 : 0
      })
    }
    return result
  })

  // --- Quan he tai khoan - nhom ---
  handle('accountGroups:listForAccount', (accountId) => accountGroupService.listForAccount(accountId))
  handle('accountGroups:listForGroup', (groupId) => accountGroupService.listForGroup(groupId))
  handle('accountGroups:setMembership', (data) => accountGroupService.setMembership(data))
  handle('accountGroups:remove', (accountId, groupId) => accountGroupService.removeMembership(accountId, groupId))

  // --- Bai dang / chien dich ---
  handle('posts:createCampaign', (payload) => postService.createCampaign(payload))
  handle('posts:getCampaign', (id) => postService.getCampaign(id))
  handle('posts:listCampaigns', () => postService.listCampaigns())
  handle('posts:listJobs', (filters) => postService.listJobs(filters))
  handle('posts:statusCounts', (filters) => postService.statusCounts(filters))
  handle('posts:retryJob', (jobId) => postService.retryJob(jobId))
  handle('posts:deleteJob', (jobId) => postService.deleteJob(jobId))
  handle('posts:stopCampaign', (postId) => {
    postQueue.stop()
    postService.stopCampaign(postId)
    return true
  })
  handle('posts:exportHistoryCsv', async (filters) => {
    const csv = postService.exportHistoryCsv(filters)
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `lich-su-dang-bai-${Date.now()}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return null
    fs.writeFileSync(result.filePath, `﻿${csv}`, 'utf-8')
    return result.filePath
  })
  handle('posts:recheckJob', async (jobId) => {
    const jobs = postService.listJobs({})
    const job = jobs.find((j) => j.id === jobId)
    if (!job) throw new Error('Không tìm thấy job.')
    const account = accountService.get(job.account_id)
    const settings = settingsService.getAll()
    const headless = String(settings.headless_mode) === 'true'
    const context = await browserManager.launchProfile(account.browser_profile_path, { headless })
    try {
      const page = context.pages()[0] || (await context.newPage())
      const automation = job.platform === 'instagram' ? instagramAutomation : job.platform === 'tiktok' ? tiktokAutomation : postAutomation
      const status = await automation.recheckJobStatus({
        page,
        postUrl: job.post_url,
        targetUrl: job.target_url,
        screenshotDir: path.join(getDataDir(), 'screenshots'),
        log: (level, message) => logService.addLog(jobId, level, message)
      })
      return postService.updateJob(jobId, { status, last_checked_at: new Date().toISOString() })
    } finally {
      await context.close().catch(() => {})
    }
  })

  // --- Anh/video dinh kem ---
  handle('media:pickImages', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Hình ảnh', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }]
    })
    if (result.canceled) return []
    return result.filePaths
  })
  handle('media:pickVideos', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }]
    })
    if (result.canceled) return []
    return result.filePaths
  })

  // --- Dang nhap / phan quyen ---
  handle('auth:hasAdminPassword', () => authService.hasAdminPassword())
  handle('auth:loginStaff', (username, password) => staffService.login(username, password))
  handle('auth:loginAdmin', (password) => authService.loginAdmin(password))
  handle('auth:setAdminPassword', (currentPassword, newPassword) => authService.setAdminPassword(currentPassword, newPassword))
  handle('auth:registerStaff', (data) => staffService.register(data))

  // --- Tai khoan Nhan vien ---
  handle('staff:list', () => staffService.list())
  handle('staff:create', (data) => staffService.create(data))
  handle('staff:update', (id, data) => staffService.update(id, data))
  handle('staff:setStatus', (id, status) => staffService.setStatus(id, status))
  handle('staff:setRole', (id, role) => staffService.setRole(id, role))
  handle('staff:approve', (id) => staffService.approve(id))
  handle('staff:markWizardDone', (id) => staffService.markWizardDone(id))
  handle('staff:resetPassword', (id, newPassword) => staffService.resetPassword(id, newPassword))
  handle('staff:remove', (id) => staffService.remove(id))

  // --- Cai dat ---
  handle('settings:getAll', () => settingsService.getAll())
  handle('settings:setMany', (entries) => settingsService.setMany(entries))

  // --- Kho video (Google Sheets + Drive) ---
  handle('videoLibrary:list', () => videoLibraryService.list())
  handle('videoLibrary:testConnection', () => videoLibraryService.testConnection())
  handle('videoLibrary:sync', () => videoLibraryService.syncFromSheet())
  handle('videoLibrary:download', (id) => videoLibraryService.downloadVideo(id))
  handle('videoLibrary:writeBackToSheet', (id) => videoLibraryService.writeBackToSheet(id))
  handle('videoLibrary:markPlatformResult', (id, platform, result) => videoLibraryService.markPlatformResult(id, platform, result))
  handle('videoLibrary:fetchTiktokLink', (id, accountId) => videoLibraryService.fetchTiktokLink(id, accountId))
  handle('videoLibrary:remove', (id) => videoLibraryService.remove(id))

  // --- Lich dang tu dong ---
  handle('schedules:list', () => scheduleService.list())
  handle('schedules:get', (id) => scheduleService.get(id))
  handle('schedules:create', (payload) => scheduleService.create(payload))
  handle('schedules:setTargets', (id, targets) => scheduleService.setTargets(id, targets))
  handle('schedules:setEnabled', (id, enabled) => scheduleService.setEnabled(id, enabled))
  handle('schedules:update', (id, data) => scheduleService.update(id, data))
  handle('schedules:remove', (id) => scheduleService.remove(id))
  handle('schedules:runNow', (id) => schedulerEngine.runNow(id))

  // --- Nhat ky ---
  handle('logs:listForJob', (jobId) => logService.listForJob(jobId))
  handle('logs:listRecent', (limit) => logService.listRecent(limit))

  // --- Hang doi dang bai ---
  handle('queue:start', (postId) => postQueue.run(postId))
  handle('queue:pause', () => postQueue.pause())
  handle('queue:resume', () => postQueue.resume())
  handle('queue:stop', () => postQueue.stop())
  handle('queue:getState', () => ({ state: postQueue.state, currentPostId: postQueue.currentPostId }))

  // --- He thong ---
  handle('system:openExternal', (url) => shell.openExternal(url))
  handle('system:getDataDir', () => getDataDir())

  // --- Theo doi gia doi thu (module doc lap - xem src/main/priceTracking/).
  // Ghi nhan gia THU CONG - khong co crawler tu dong (Shopee chan cua so
  // trinh duyet tu dong ngay o buoc dang nhap, xem ghi chu trong settingsService.js).
  handle('competitor:list', () => competitorPriceService.list())
  handle('competitor:create', (data) => competitorPriceService.create(data))
  handle('competitor:remove', (id) => competitorPriceService.remove(id))
  handle('competitor:priceHistory', (id) => competitorPriceService.listPriceHistory(id))
  handle('competitor:addPriceEntry', (id, data) => competitorPriceService.addPriceEntry(id, data))
}

app.whenReady().then(async () => {
  await initDb()
  accountService.resetDailyCountersIfNewDay()
  registerIpcHandlers()
  registerQueueEventForwarding()
  createWindow()
  schedulerEngine.start()

  // Kiem tra cap nhat qua GitHub Releases - chi khi da dong goi thuc su (bo
  // qua khi chay electron-vite dev/preview, vi latest.yml chi ton tai o ban build).
  if (app.isPackaged) {
    updater.init(mainWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  schedulerEngine.stop()
  if (process.platform !== 'darwin') app.quit()
})
