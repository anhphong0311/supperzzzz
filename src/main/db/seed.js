/**
 * Du lieu mau de kiem tra giao dien. Chay bang: npm run db:seed
 * Khong chua mat khau hay session that - chi la du lieu demo.
 */
const path = require('path')
const { initDb, getDb, getDataDir } = require('./database')

;(async () => {
  await initDb()
  const db = getDb()
  const dataDir = getDataDir()

  const insertAccount = db.prepare(`
    INSERT INTO facebook_accounts
      (display_name, profile_name, browser_profile_path, login_status, account_status, notes)
    VALUES (@display_name, @profile_name, @browser_profile_path, @login_status, @account_status, @notes)
  `)

  const insertGroup = db.prepare(`
    INSERT INTO facebook_groups
      (group_name, group_url, requires_approval, group_status, notes)
    VALUES (@group_name, @group_url, @requires_approval, @group_status, @notes)
  `)

  const insertAccountGroup = db.prepare(`
    INSERT INTO account_groups (account_id, group_id, membership_status, can_post)
    VALUES (@account_id, @group_id, @membership_status, @can_post)
  `)

  const insertPost = db.prepare(`
    INSERT INTO posts (campaign_name, content, status, dry_run, delay_seconds)
    VALUES (@campaign_name, @content, @status, @dry_run, @delay_seconds)
  `)

  const seed = db.transaction(() => {
    const existing = db.prepare('SELECT COUNT(*) AS c FROM facebook_accounts').get().c
    if (existing > 0) {
      console.log('Da co du lieu, bo qua seed. (Xoa data/app.db neu muon seed lai tu dau)')
      return
    }

    const accounts = [
      {
        display_name: 'Nick 1',
        profile_name: 'Nick 1 - Ban chinh',
        browser_profile_path: path.join(dataDir, 'profiles', 'nick1'),
        login_status: 'CHUA_DANG_NHAP',
        account_status: 'HOAT_DONG',
        notes: 'Demo - can dang nhap thu cong vao Chrome Profile nay'
      },
      {
        display_name: 'Nick 2',
        profile_name: 'Nick 2 - Ho tro',
        browser_profile_path: path.join(dataDir, 'profiles', 'nick2'),
        login_status: 'CHUA_DANG_NHAP',
        account_status: 'HOAT_DONG',
        notes: 'Demo'
      },
      {
        display_name: 'Nick 3',
        profile_name: 'Nick 3 - Du phong',
        browser_profile_path: path.join(dataDir, 'profiles', 'nick3'),
        login_status: 'CHUA_DANG_NHAP',
        account_status: 'HOAT_DONG',
        notes: 'Demo'
      }
    ]
    const accountIds = accounts.map((a) => insertAccount.run(a).lastInsertRowid)

    const groups = [
      { group_name: 'Nhom A - Mua ban do cu', group_url: 'https://www.facebook.com/groups/demo-group-a', requires_approval: 1, group_status: 'HOAT_DONG', notes: 'Demo' },
      { group_name: 'Nhom B - Rao vat dia phuong', group_url: 'https://www.facebook.com/groups/demo-group-b', requires_approval: 0, group_status: 'HOAT_DONG', notes: 'Demo' },
      { group_name: 'Nhom C - Cong dong khoi nghiep', group_url: 'https://www.facebook.com/groups/demo-group-c', requires_approval: 1, group_status: 'HOAT_DONG', notes: 'Demo' },
      { group_name: 'Nhom D - Review san pham', group_url: 'https://www.facebook.com/groups/demo-group-d', requires_approval: 0, group_status: 'HOAT_DONG', notes: 'Demo' },
      { group_name: 'Nhom E - Du lich Tay Bac', group_url: 'https://www.facebook.com/groups/demo-group-e', requires_approval: 1, group_status: 'HOAT_DONG', notes: 'Demo' }
    ]
    const groupIds = groups.map((g) => insertGroup.run(g).lastInsertRowid)
    const [A, B, C, D, E] = groupIds
    const [nick1, nick2, nick3] = accountIds

    const memberships = [
      [nick1, A], [nick1, B], [nick1, C],
      [nick2, B], [nick2, C], [nick2, D],
      [nick3, A], [nick3, D], [nick3, E]
    ]
    memberships.forEach(([account_id, group_id]) => {
      insertAccountGroup.run({ account_id, group_id, membership_status: 'THANH_VIEN', can_post: 1 })
    })

    insertPost.run({
      campaign_name: 'Demo - Khuyen mai thang 7',
      content: 'Day la noi dung bai dang mau de kiem tra giao dien. Vui long thay bang noi dung that truoc khi dang.',
      status: 'NHAP',
      dry_run: 1,
      delay_seconds: 30
    })

    console.log(`Da tao ${accounts.length} tai khoan, ${groups.length} nhom, ${memberships.length} lien ket, 1 bai dang mau.`)
  })

  seed()
})()
