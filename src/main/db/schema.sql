-- Schema cho FB Multi Poster (MVP)
-- Quy uoc: thoi gian luu dang ISO string (UTC), boolean luu duoi dang INTEGER 0/1
--
-- LUU Y: file nay chi de THAM KHAO/DOC. Ung dung thuc te load schema tu
-- schema.js (chuoi JS) de tuong thich voi qua trinh bundle cua electron-vite.
-- Neu sua doi o day, nho sua ca schema.js cho khop.

CREATE TABLE IF NOT EXISTS facebook_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  profile_name TEXT NOT NULL,
  browser_profile_path TEXT NOT NULL,
  login_status TEXT NOT NULL DEFAULT 'CHUA_DANG_NHAP', -- trang thai dang nhap Facebook
  tiktok_login_status TEXT, -- trang thai dang nhap TikTok rieng (NULL = chua kiem tra)
  account_status TEXT NOT NULL DEFAULT 'HOAT_DONG',
  posts_today INTEGER NOT NULL DEFAULT 0,
  last_posted_at TEXT,
  last_checked_at TEXT,
  notes TEXT,
  fanpage_url TEXT, -- URL Fanpage duy nhat cua tai khoan nay (tuy chon, dung khi dang len Fanpage)
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
  platform TEXT NOT NULL DEFAULT 'facebook', -- 'facebook' | 'instagram' | 'tiktok' | 'threads'
  target_type TEXT NOT NULL DEFAULT 'GROUP', -- FB: GROUP|TIMELINE|PAGE, IG: INSTAGRAM_POST
  group_id INTEGER REFERENCES facebook_groups(id), -- chi dung khi target_type = 'GROUP'
  status TEXT NOT NULL DEFAULT 'CHUA_XU_LY',
  post_url TEXT, -- link ket qua sau khi dang
  posted_at TEXT,
  last_checked_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  performed_by TEXT, -- ten hien thi nguoi tao bai (nhan vien/Quan tri vien/Tu dong (Lich)), luu dang snapshot
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

-- Tai khoan Nhan vien rieng (dang nhap bang username/password), de gan
-- "nguoi thuc hien" vao tung bai dang - xem post_jobs.performed_by
CREATE TABLE IF NOT EXISTS staff_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- PENDING (cho tu dang ky) | ACTIVE | LOCKED
  role TEXT NOT NULL DEFAULT 'STAFF', -- STAFF | ADMIN - Admin tu trang Tai khoan Nhan vien
  wizard_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Kho video dong bo tu Google Sheet (Giai doan 1 - tich hop Google Sheets)
CREATE TABLE IF NOT EXISTS video_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_row_number INTEGER NOT NULL UNIQUE, -- so dong tren Google Sheet (de ghi lai dung dong)
  video_url TEXT NOT NULL, -- link Google Drive
  caption_hint TEXT, -- mo ta/goi y noi dung (cot rieng tren sheet, AI se dung lam ngu canh)
  target_platforms TEXT, -- vd 'facebook,instagram' - rong = tat ca nen tang da bat
  status TEXT NOT NULL DEFAULT 'CHUA_DANG', -- CHUA_DANG | DANG_TAI | DA_TAI | DANG_DANG | DA_DANG | LOI
  local_file_path TEXT, -- duong dan file video da tai ve tam
  facebook_post_url TEXT,
  instagram_post_url TEXT,
  threads_post_url TEXT,
  tiktok_post_url TEXT,
  error_message TEXT,
  synced_at TEXT, -- lan dong bo tu sheet gan nhat
  posted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lich dang tu dong theo gio (Giai doan 3)
CREATE TABLE IF NOT EXISTS post_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time_of_day TEXT NOT NULL, -- 'HH:MM' 24h
  label TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  dry_run INTEGER NOT NULL DEFAULT 0,
  video_library_id INTEGER REFERENCES video_library(id),
  custom_content TEXT,
  last_fired_date TEXT,
  last_fired_status TEXT,
  last_fired_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS post_schedule_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  schedule_id INTEGER NOT NULL REFERENCES post_schedules(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES facebook_accounts(id),
  target_type TEXT NOT NULL DEFAULT 'GROUP',
  group_id INTEGER REFERENCES facebook_groups(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Theo doi gia san pham doi thu (module doc lap - xem src/main/priceTracking/)
CREATE TABLE IF NOT EXISTS competitor_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'shopee',
  last_checked_at TEXT,
  last_status TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS competitor_price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competitor_product_id INTEGER NOT NULL REFERENCES competitor_products(id) ON DELETE CASCADE,
  listed_price INTEGER,
  voucher_amount INTEGER,
  final_price INTEGER,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_schedule_targets_schedule ON post_schedule_targets(schedule_id);
CREATE INDEX IF NOT EXISTS idx_video_library_status ON video_library(status);
CREATE INDEX IF NOT EXISTS idx_account_groups_account ON account_groups(account_id);
CREATE INDEX IF NOT EXISTS idx_account_groups_group ON account_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_competitor_price_history_product ON competitor_price_history(competitor_product_id);
CREATE INDEX IF NOT EXISTS idx_post_jobs_post ON post_jobs(post_id);
CREATE INDEX IF NOT EXISTS idx_post_jobs_account ON post_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_post_jobs_group ON post_jobs(group_id);
CREATE INDEX IF NOT EXISTS idx_post_jobs_status ON post_jobs(status);
CREATE INDEX IF NOT EXISTS idx_post_logs_job ON post_logs(post_job_id);
