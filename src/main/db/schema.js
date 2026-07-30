/**
 * Noi dung nay PHAI GIONG HET voi schema.sql trong cung thu muc.
 * Ly do ton tai file .js nay: khi electron-vite bundle main process thanh
 * MOT file duy nhat (out/main/index.js), duong dan tuong doi toi schema.sql
 * (fs.readFileSync) se khong con hop le vi file .sql khong duoc dong goi
 * theo. Xuat SQL duoi dang chuoi JS thi Rollup se tu dong nhung thang vao
 * bundle, hoat dong dung trong ca 3 truong hop: `electron-vite dev`,
 * `electron-vite build`, va chay truc tiep bang `node` (script db:init/db:seed).
 *
 * Neu sua schema.sql, NHO sua ca file nay.
 */
module.exports = `
-- Schema cho FB Multi Poster (MVP)
-- Quy uoc: thoi gian luu dang ISO string (UTC), boolean luu duoi dang INTEGER 0/1

CREATE TABLE IF NOT EXISTS facebook_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  browser_profile_path TEXT NOT NULL,
  login_status TEXT NOT NULL DEFAULT 'CHUA_DANG_NHAP',
  account_status TEXT NOT NULL DEFAULT 'HOAT_DONG',
  posts_today INTEGER NOT NULL DEFAULT 0,
  last_posted_at TEXT,
  last_checked_at TEXT,
  notes TEXT,
  fanpage_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS facebook_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name TEXT NOT NULL,
  group_url TEXT NOT NULL UNIQUE,
  facebook_group_id TEXT,
  requires_approval INTEGER NOT NULL DEFAULT -1, -- -1 = chua ro, 0 = khong, 1 = co
  group_status TEXT NOT NULL DEFAULT 'CHUA_XAC_DINH',
  notes TEXT,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS account_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES facebook_accounts(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES facebook_groups(id) ON DELETE CASCADE,
  membership_status TEXT NOT NULL DEFAULT 'THANH_VIEN',
  can_post INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(account_id, group_id)
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_name TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NHAP',
  dry_run INTEGER NOT NULL DEFAULT 0,
  delay_seconds INTEGER NOT NULL DEFAULT 30,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES facebook_accounts(id),
  target_type TEXT NOT NULL DEFAULT 'GROUP',
  group_id INTEGER REFERENCES facebook_groups(id),
  status TEXT NOT NULL DEFAULT 'CHUA_XU_LY',
  facebook_post_url TEXT,
  posted_at TEXT,
  last_checked_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_job_id INTEGER REFERENCES post_jobs(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL DEFAULT 'INFO',
  message TEXT NOT NULL,
  screenshot_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_account_groups_account ON account_groups(account_id);
CREATE INDEX IF NOT EXISTS idx_account_groups_group ON account_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_post_jobs_post ON post_jobs(post_id);
CREATE INDEX IF NOT EXISTS idx_post_jobs_account ON post_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_post_jobs_group ON post_jobs(group_id);
CREATE INDEX IF NOT EXISTS idx_post_jobs_status ON post_jobs(status);
CREATE INDEX IF NOT EXISTS idx_post_logs_job ON post_logs(post_job_id);
`
