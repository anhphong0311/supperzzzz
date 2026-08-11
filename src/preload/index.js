const { contextBridge, ipcRenderer } = require('electron')

/**
 * Goi 1 kenh IPC dang invoke/handle va tra ve du lieu, nem loi neu ok=false.
 * Chuan hoa cach xu ly loi cho toan bo renderer.
 */
async function call(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args)
  if (!res || res.ok === undefined) return res
  if (!res.ok) throw new Error(res.error || 'Đã xảy ra lỗi không xác định.')
  return res.data
}

function on(channel, callback) {
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  auth: {
    hasAdminPassword: () => call('auth:hasAdminPassword'),
    loginStaff: (username, password) => call('auth:loginStaff', username, password),
    loginAdmin: (password) => call('auth:loginAdmin', password),
    setAdminPassword: (currentPassword, newPassword) => call('auth:setAdminPassword', currentPassword, newPassword),
    registerStaff: (data) => call('auth:registerStaff', data)
  },
  staff: {
    list: () => call('staff:list'),
    create: (data) => call('staff:create', data),
    update: (id, data) => call('staff:update', id, data),
    setStatus: (id, status) => call('staff:setStatus', id, status),
    setRole: (id, role) => call('staff:setRole', id, role),
    approve: (id) => call('staff:approve', id),
    markWizardDone: (id) => call('staff:markWizardDone', id),
    resetPassword: (id, newPassword) => call('staff:resetPassword', id, newPassword),
    remove: (id) => call('staff:remove', id)
  },
  accounts: {
    list: () => call('accounts:list'),
    create: (data) => call('accounts:create', data),
    update: (id, data) => call('accounts:update', id, data),
    remove: (id) => call('accounts:remove', id),
    setStatus: (id, status) => call('accounts:setStatus', id, status),
    pickProfileFolder: () => call('accounts:pickProfileFolder'),
    openProfileForLogin: (id, platform) => call('accounts:openProfileForLogin', id, platform),
    checkLoginStatus: (id) => call('accounts:checkLoginStatus', id),
    checkTiktokLoginStatus: (id) => call('accounts:checkTiktokLoginStatus', id)
  },
  groups: {
    list: (filters) => call('groups:list', filters),
    get: (id) => call('groups:get', id),
    create: (data) => call('groups:create', data),
    createMany: (urls) => call('groups:createMany', urls),
    update: (id, data) => call('groups:update', id, data),
    remove: (id) => call('groups:remove', id),
    checkAccess: (groupId, accountId) => call('groups:checkAccess', groupId, accountId)
  },
  accountGroups: {
    listForAccount: (accountId) => call('accountGroups:listForAccount', accountId),
    listForGroup: (groupId) => call('accountGroups:listForGroup', groupId),
    setMembership: (data) => call('accountGroups:setMembership', data),
    remove: (accountId, groupId) => call('accountGroups:remove', accountId, groupId)
  },
  posts: {
    createCampaign: (payload) => call('posts:createCampaign', payload),
    getCampaign: (id) => call('posts:getCampaign', id),
    listCampaigns: () => call('posts:listCampaigns'),
    listJobs: (filters) => call('posts:listJobs', filters),
    statusCounts: (filters) => call('posts:statusCounts', filters),
    retryJob: (jobId) => call('posts:retryJob', jobId),
    deleteJob: (jobId) => call('posts:deleteJob', jobId),
    stopCampaign: (postId) => call('posts:stopCampaign', postId),
    exportHistoryCsv: (filters) => call('posts:exportHistoryCsv', filters),
    recheckJob: (jobId) => call('posts:recheckJob', jobId)
  },
  media: {
    pickImages: () => call('media:pickImages'),
    pickVideos: () => call('media:pickVideos')
  },
  settings: {
    getAll: () => call('settings:getAll'),
    setMany: (entries) => call('settings:setMany', entries)
  },
  videoLibrary: {
    list: () => call('videoLibrary:list'),
    testConnection: () => call('videoLibrary:testConnection'),
    sync: () => call('videoLibrary:sync'),
    download: (id) => call('videoLibrary:download', id),
    writeBackToSheet: (id) => call('videoLibrary:writeBackToSheet', id),
    markPlatformResult: (id, platform, result) => call('videoLibrary:markPlatformResult', id, platform, result),
    fetchTiktokLink: (id, accountId) => call('videoLibrary:fetchTiktokLink', id, accountId),
    remove: (id) => call('videoLibrary:remove', id)
  },
  schedules: {
    list: () => call('schedules:list'),
    get: (id) => call('schedules:get', id),
    create: (payload) => call('schedules:create', payload),
    setTargets: (id, targets) => call('schedules:setTargets', id, targets),
    setEnabled: (id, enabled) => call('schedules:setEnabled', id, enabled),
    update: (id, data) => call('schedules:update', id, data),
    remove: (id) => call('schedules:remove', id),
    runNow: (id) => call('schedules:runNow', id),
    onLog: (cb) => on('scheduler:log', cb),
    onFireStart: (cb) => on('scheduler:fire-start', cb),
    onFired: (cb) => on('scheduler:fired', cb)
  },
  logs: {
    listForJob: (jobId) => call('logs:listForJob', jobId),
    listRecent: (limit) => call('logs:listRecent', limit)
  },
  queue: {
    start: (postId) => call('queue:start', postId),
    pause: () => call('queue:pause'),
    resume: () => call('queue:resume'),
    stop: () => call('queue:stop'),
    getState: () => call('queue:getState'),
    onProgress: (cb) => on('queue:progress', cb),
    onLog: (cb) => on('queue:log', cb),
    onStateChanged: (cb) => on('queue:state-changed', cb),
    onManualIntervention: (cb) => on('queue:manual-intervention', cb),
    onCampaignFinished: (cb) => on('queue:campaign-finished', cb)
  },
  system: {
    openExternal: (url) => call('system:openExternal', url),
    getDataDir: () => call('system:getDataDir')
  },
  competitor: {
    list: () => call('competitor:list'),
    create: (data) => call('competitor:create', data),
    remove: (id) => call('competitor:remove', id),
    priceHistory: (id) => call('competitor:priceHistory', id),
    addPriceEntry: (id, data) => call('competitor:addPriceEntry', id, data)
  }
}

contextBridge.exposeInMainWorld('api', api)
