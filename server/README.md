# Máy chủ đăng nhập/duyệt Nhân viên — FB Multi Poster

Server nhỏ (Express + Turso) chỉ phục vụ 1 việc: đăng ký/đăng nhập/duyệt tài khoản Nhân viên dùng
chung cho toàn công ty, để nhân viên đăng ký từ máy riêng của họ và Admin duyệt được từ máy của mình
mà không cần chạm vào máy nhân viên. Phần còn lại của app (tài khoản MXH, lịch đăng, kho video...)
vẫn hoàn toàn cục bộ trên từng máy, không liên quan tới server này.

## Chạy thử cục bộ (không cần tài khoản cloud)

```bash
cd server
npm install
cp .env.example .env
npm start
```
Mặc định dùng file SQLite nhúng (`DATABASE_URL=file:./local.db`) — không cần Turso/Render gì cả, chỉ
để phát triển/kiểm tra trên máy bạn. `GET http://localhost:4000/api/health` phải trả về `200`.

## Triển khai thật (để nhân viên ở máy khác dùng được)

### 1. Tạo database Turso (miễn phí, không cần thẻ)

1. Vào https://turso.tech → Sign up (có thể đăng nhập bằng GitHub).
2. Cài Turso CLI theo hướng dẫn trên trang, hoặc dùng luôn giao diện web "Create database".
3. Tạo 1 database mới, đặt tên tuỳ ý (ví dụ `fb-multi-poster-auth`).
4. Lấy 2 giá trị: **Database URL** (dạng `libsql://ten-db-xxxx.turso.io`) và **Auth Token** (tạo token
   mới nếu chưa có) — giữ lại, sẽ dán vào Render ở bước 3.

### 2. Đẩy code lên GitHub

Thư mục `server/` này có thể đẩy chung với repo hiện tại của app (không cần tách repo riêng).

### 3. Tạo Web Service trên Render (miễn phí, không cần thẻ)

1. Vào https://render.com → Sign up → New → **Web Service** → chọn repo GitHub chứa thư mục `server/`.
2. **Root Directory**: `server`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Instance Type**: Free
6. Vào tab **Environment**, thêm các biến:
   - `DATABASE_URL` = URL Turso lấy ở bước 1 (dạng `libsql://...`)
   - `DATABASE_AUTH_TOKEN` = token Turso lấy ở bước 1
   - `JWT_SECRET` = một chuỗi ngẫu nhiên dài (xem gợi ý bên dưới)
   - `NODE_ENV` = `production`
7. Bấm **Create Web Service** — Render tự build & chạy. Đợi vài phút tới khi thấy "Live".
8. Lấy URL dạng `https://<tên-service>.onrender.com` — báo lại URL này để điền vào app.

> Lưu ý: gói miễn phí sẽ "ngủ" sau ~15 phút không có ai gọi tới. Lần gọi đầu tiên sau khi ngủ có thể
> mất 10–60 giây để "thức dậy" — đây là đánh đổi đã biết trước khi chọn gói miễn phí.

### Gợi ý JWT_SECRET (dán thẳng vào ô Environment Variable trên Render)

```
f1e6f915c8769242820d8d056b713131507fc546bdb4121cd3de5eb373ae5f75
```

(Chuỗi ngẫu nhiên tạo sẵn — dùng được luôn, không cần tự nghĩ. Nếu muốn tạo chuỗi khác: chạy
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.)

### 4. Sau khi có URL Render thật

Báo URL đó lại — sẽ được điền vào `src/main/services/serverClient.js` (hằng số `PROD_URL`), sau đó
build lại app (`npm run build` / `npm run dist:win`) để bản đóng gói trỏ đúng vào server thật.

### 5. Bootstrap lần đầu

Mở app bản mới (đã trỏ server thật) → chọn vai trò **Admin** → vì server thật chưa có mật khẩu Admin
nào → sẽ hiện màn hình thiết lập lần đầu → đặt mật khẩu Admin thật. Đây là bước "khai sinh" duy nhất,
chỉ làm 1 lần cho toàn bộ công ty (không phải theo từng máy).
