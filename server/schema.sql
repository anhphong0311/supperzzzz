-- Mirror cua staff_users trong src/main/db/schema.js (may chu, dung chung cho
-- toan bo cac may cai app - khong con moi may 1 ban rieng nua).
CREATE TABLE IF NOT EXISTS staff_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- PENDING (cho tu dang ky) | ACTIVE | LOCKED
  role TEXT NOT NULL DEFAULT 'STAFF', -- STAFF | ADMIN
  wizard_completed INTEGER NOT NULL DEFAULT 0,
  -- Dung strftime voi hau to 'Z' (khong dung datetime('now') tho) - chuoi
  -- "YYYY-MM-DD HH:MM:SS" khong co timezone se bi JS Date() hieu NHAM la
  -- gio dia phuong thay vi UTC khi hien thi o renderer, gay lech gio hien
  -- thi (da xac nhan qua thuc te: hien "08:31" trong khi gio that la "15:31").
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Bang key/value don gian, chi dung de luu 1 dong duy nhat: mat khau Admin
-- CHUNG cho toan cong ty (thay cho settings.admin_password_hash cuc bo truoc day).
CREATE TABLE IF NOT EXISTS admin_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT
);
