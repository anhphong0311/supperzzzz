const { dialog } = require('electron')
const { autoUpdater } = require('electron-updater')

// Kiem tra cap nhat qua GitHub Releases (build.publish trong package.json).
// Hoi truoc khi tai VA hoi truoc khi cai - khong tu dong ep nhan vien.
autoUpdater.autoDownload = false

function init(mainWindow) {
  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Có bản cập nhật mới',
      message: `Đã có bản cập nhật ${info.version}. Tải và cài đặt ngay?`,
      buttons: ['Tải và cài đặt', 'Để sau'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) autoUpdater.downloadUpdate()
    })
  })

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Sẵn sàng cài đặt',
      message: 'Đã tải xong bản cập nhật. Khởi động lại ứng dụng để cài đặt ngay?',
      buttons: ['Khởi động lại ngay', 'Để sau'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall()
    })
  })

  // Kiem tra cap nhat la best-effort (mat mang, chua co release moi...) -
  // chi ghi log, khong lam phien nguoi dung bang dialog loi.
  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err)
  })

  autoUpdater.checkForUpdates().catch((err) => console.error('checkForUpdates error:', err))
}

module.exports = { init }
