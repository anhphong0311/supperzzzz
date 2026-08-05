# FB Multi Poster (MVP)

Công cụ desktop hỗ trợ soạn **một** bài viết (kèm ảnh và/hoặc video) và đăng tuần tự lên
**nhiều Nhóm Facebook, Trang cá nhân, và Fanpage** bằng **2–3 tài khoản Facebook** do bạn
sở hữu/được phép quản lý, mỗi tài khoản dùng một Chrome Profile (phiên đăng nhập) riêng biệt.

> ⚠️ **Đọc trước khi dùng — giới hạn & rủi ro**
> - Facebook không cung cấp API chính thức để đăng bài theo cách này. Tool dùng browser
>   automation (Playwright) mô phỏng thao tác người dùng thật, dựa trên các selector
>   CSS/DOM hiện tại của giao diện Facebook — **selector này có thể lỗi thời bất cứ lúc
>   nào** khi Facebook đổi giao diện.
> - Đăng "với tư cách Fanpage" phụ thuộc vào nút chuyển danh tính mà Facebook hiển thị khi
>   mở đúng Fanpage bạn quản trị — đây là selector **dễ lỗi thời nhất** trong tool. Nếu
>   không tìm thấy nút này, tool sẽ đăng tiếp với danh tính hiện tại thay vì dừng lại, nên
>   **luôn kiểm tra bằng DRY_RUN trước** khi đăng thật lên Fanpage.
> - Chỉ dùng với tài khoản/nhóm bạn **sở hữu hoặc được phép quản lý**. Đăng nội dung trùng
>   lặp hàng loạt vẫn có thể bị Facebook coi là spam và hạn chế/khoá tài khoản — tool có
>   giới hạn số bài/ngày và độ trễ giữa các lần đăng để giảm rủi ro, nhưng **không thể đảm
>   bảo tài khoản an toàn tuyệt đối**.
> - Tool **không** và **sẽ không** hỗ trợ vượt CAPTCHA, vượt checkpoint, giả mạo thiết bị/
>   vân tay trình duyệt, đổi proxy tự động để né phát hiện. Khi gặp các tình huống này,
>   tool dừng lại và yêu cầu bạn xử lý thủ công.
> - Trạng thái "đã duyệt / chờ duyệt / bị từ chối" được suy luận từ giao diện hiển thị
>   (Facebook không có API chính thức cho việc này) nên **có thể không chính xác tuyệt đối**.

---

## 1. Công nghệ sử dụng

| Thành phần        | Công nghệ |
|--------------------|-----------|
| Ứng dụng desktop   | Electron + electron-vite |
| Giao diện          | React 18 + React Router (không dùng UI kit ngoài, CSS thuần) |
| Automation trình duyệt | Playwright (điều khiển Chrome qua Chrome Profile có sẵn) |
| Cơ sở dữ liệu      | SQLite chạy qua `sql.js` (SQLite biên dịch WASM) — **không cần** cài Visual Studio Build Tools/`node-gyp` như `better-sqlite3` |
| Đóng gói Windows   | electron-builder (NSIS installer) |

## 2. Cấu trúc thư mục

```
src/
  main/                     # Tiến trình chính Electron (Node.js, CommonJS)
    index.js                # Entry point: tạo cửa sổ, đăng ký IPC
    db/
      schema.sql             # Schema SQL - CHỈ để tham khảo/đọc
      schema.js               # Schema SQL dạng chuỗi JS - nguồn thật sự được nạp
      database.js             # Lớp bọc sql.js (giả lập API kiểu better-sqlite3)
      initDb.js / seed.js      # Script khởi tạo DB / seed dữ liệu mẫu
    services/                 # CRUD: accounts, groups, account-group, posts, settings, logs
    automation/
      selectors.js             # !! KHO SELECTOR FACEBOOK TẬP TRUNG - xem mục 6 !!
      domHelper.js              # Helper thử nhiều selector dự phòng
      browserManager.js          # Mở đúng Chrome Profile, kiểm tra đăng nhập/truy cập nhóm
      postAutomation.js          # Luồng 15 bước đăng 1 bài vào 1 đích (Nhóm/Trang cá nhân/Fanpage) + DRY_RUN
      statusCodes.js              # Enum trạng thái & mã lỗi dùng chung
    queue/
      postQueue.js               # Hàng đợi xử lý tuần tự theo tài khoản -> đích đăng
  preload/
    index.js                  # contextBridge - expose window.api an toàn cho renderer
  renderer/
    src/
      pages/                   # Tổng quan, Tài khoản, Nhóm, Tạo bài, Lịch sử, Cài đặt...
      components/               # Sidebar, StatusBadge, HistoryView, ToastHost...
      constants/statusMap.js     # Nhãn tiếng Việt cho trạng thái (bản sao nhẹ của statusCodes.js)
data/                        # (gitignored) DB + ảnh chụp màn hình khi chạy `node` trực tiếp
```

Khi chạy trong Electron đóng gói, dữ liệu thật (`app.db`, ảnh chụp lỗi) nằm trong thư mục
`userData` của hệ điều hành (Windows: `%APPDATA%\fb-multi-poster`), **không** nằm trong
thư mục cài đặt.

## 3. Cài đặt

Yêu cầu: Node.js 18+ (khuyến nghị 20+), npm. Không cần Visual Studio Build Tools.

```bash
npm install
npm run db:init     # tạo file database + toàn bộ bảng
npm run db:seed     # (tuỳ chọn) nạp dữ liệu mẫu để xem thử giao diện: 3 tài khoản, 5 nhóm
npm run dev          # chạy ứng dụng ở chế độ phát triển (hot reload)
```

Build & xem thử bản đóng gói:

```bash
npm run build        # build main/preload/renderer vào out/
npm run start          # chạy thử bản build (electron-vite preview)
```

### Chạy nhanh trên Desktop (bấm vào chạy thẳng, không cần mở terminal)

Đã tạo sẵn file **"FB Multi Poster.bat"** trên Desktop — bấm đúp vào để mở ứng dụng ngay,
không cần mở terminal.

> Vì tên thư mục dự án có ký tự `Đ` (`TOOL-ĐB`), tạo shortcut `.lnk` kiểu thông thường qua
> Windows bị lỗi encode (Windows tự đổi `Đ` thành `Ð` khi lưu shortcut, khiến file đích
> "biến mất" — báo lỗi "Missing Shortcut"). Vì vậy đã dùng file `.bat` với đường dẫn ngắn
> (8.3, dạng `TOOL-B~1`) để tránh lỗi này thay vì tạo `.lnk`.

- Bấm đúp `FB Multi Poster.bat` trên Desktop để mở ứng dụng (có một cửa sổ dòng lệnh đen
  hiện lên chớp nhoáng rồi tự đóng — bình thường, không phải lỗi).
- **Lưu ý:** file này chạy bản đã build sẵn trong `out/`, KHÔNG tự build lại khi bạn sửa
  code. Sau khi sửa code, phải chạy `npm run build` lại rồi mới bấm file `.bat` để thấy
  thay đổi mới.
- Nếu di chuyển/đổi tên thư mục dự án, hoặc có thư mục khác cũng bắt đầu bằng `TOOL-`
  khiến đường dẫn ngắn (8.3) `TOOL-B~1` bị đổi số thứ tự, file `.bat` sẽ không chạy được
  nữa — khi đó cần tạo lại file (xem đường dẫn ngắn hiện tại bằng lệnh
  `cmd /c for %I in ("<đường dẫn thư mục dự án>") do @echo %~sI`), hoặc — cách bền vững
  nhất — đổi tên thư mục dự án sang tên không dấu (ví dụ `TOOL-DB`) rồi đóng gói installer
  thật bằng `npm run dist:win` (xem mục 10), installer NSIS sẽ tự tạo shortcut chuẩn không
  gặp lỗi encode này.

## 4. Hướng dẫn thêm Chrome Profile / đăng nhập tài khoản

1. Vào menu **Tài khoản MXH** → **+ Thêm tài khoản**.
2. Đặt "Tên hiển thị" (ví dụ: Nick 1) và bấm **Chọn thư mục** để chọn (hoặc tạo mới) một
   thư mục **riêng biệt** cho tài khoản này — đây chính là "Chrome Profile" mà Playwright
   sẽ dùng (`launchPersistentContext`). **Mỗi tài khoản một thư mục riêng, không dùng
   chung.**
3. Lưu tài khoản, sau đó bấm **Mở để đăng nhập** — tool sẽ mở một cửa sổ Chrome thật gắn
   với đúng thư mục profile đó. **Tự tay đăng nhập Facebook** trong cửa sổ này (nhập email/
   mật khẩu, xử lý 2FA nếu có) rồi đóng cửa sổ lại.
4. Bấm **Kiểm tra đăng nhập** để tool xác nhận trạng thái (Đã đăng nhập / Chưa đăng nhập /
   Yêu cầu xác minh...).
5. Lặp lại cho 2–3 tài khoản còn lại, mỗi tài khoản một thư mục profile khác nhau.

Tool **không bao giờ** lưu email/mật khẩu Facebook — chỉ dựa vào cookie/session đã có sẵn
trong thư mục Chrome Profile mà bạn tự đăng nhập.

## 5. Gán tài khoản vào nhóm / Fanpage

Vào **Danh sách nhóm** → **+ Thêm nhóm** (dán 1 hoặc nhiều URL nhóm, mỗi dòng một URL) →
với mỗi nhóm, bấm **Gán tài khoản** và tick chọn đúng những tài khoản **thật sự đã là
thành viên** của nhóm đó. Tool **không tự động** tham gia nhóm hộ bạn — bạn phải tự tham
gia nhóm bằng Facebook thật trước, rồi mới đánh dấu trong tool.

Nút **Kiểm tra truy cập** sẽ mở nhóm bằng một tài khoản cụ thể để xác nhận tài khoản đó
có xem/đăng bài được trong nhóm hay không, và tự cập nhật trạng thái.

**Fanpage**: mỗi tài khoản chỉ gắn được đúng **một** Fanpage — nhập URL Fanpage ở màn hình
**Tài khoản MXH** (field "Fanpage URL"), với điều kiện tài khoản đó là quản trị viên
của Fanpage đó. Không cần bước gán riêng như Nhóm. **Trang cá nhân** thì luôn khả dụng
cho mọi tài khoản, không cần cấu hình gì thêm.

## 6. Chạy thử DRY_RUN (bắt buộc trước khi đăng thật)

Ở màn hình **Tạo bài đăng**, mục "Thiết lập đăng bài" có tuỳ chọn **DRY_RUN**
(mặc định bật). Khi bật:

- Tool vẫn mở nhóm, mở khung soạn bài, điền nội dung, tải ảnh lên như bình thường.
- Tool **KHÔNG** bấm nút "Đăng" thật.
- Job được đánh dấu `DRY_RUN_OK` ("Kiểm tra thành công (DRY_RUN)") kèm ảnh chụp màn hình
  xem trước.

Dùng chế độ này để kiểm tra selector còn khớp với giao diện Facebook hiện tại hay không,
trước khi tắt DRY_RUN để đăng thật.

## 7. Đăng bài thật

1. Tắt DRY_RUN ở màn hình Tạo bài đăng.
2. Nhập nội dung, chọn ảnh/video (nếu có), chọn tài khoản, sau đó với mỗi tài khoản chọn
   đích đăng: Trang cá nhân / Fanpage (nếu đã gắn) / các Nhóm tương ứng (chỉ nhóm mà tài
   khoản đó đã được gán ở bước 5 mới chọn được) — có thể chọn nhiều loại cùng lúc cho cùng
   một tài khoản.
3. Thiết lập thời gian chờ giữa hai lần đăng (giây) — nên để tối thiểu vài chục giây,
   tránh đăng dồn dập.
4. Bấm **Đăng bài**. Tool xử lý **tuần tự**: xong toàn bộ đích đăng của tài khoản 1 rồi
   mới sang tài khoản 2, v.v. Theo dõi tiến trình + nhật ký thời gian thực ngay trong màn
   hình. Có thể **Tạm dừng / Tiếp tục / Dừng** bất cứ lúc nào.
5. Nếu gặp CAPTCHA / checkpoint / yêu cầu xác minh / hết phiên đăng nhập, **toàn bộ hàng
   đợi tự dừng** — mở đúng Chrome Profile của tài khoản đó (nút "Mở để đăng nhập" ở màn
   hình Tài khoản) để xử lý thủ công, sau đó có thể tạo lại chiến dịch hoặc dùng nút
   "Đăng lại" ở Lịch sử cho từng job thất bại.

## 8. Sửa selector khi Facebook đổi giao diện

Toàn bộ selector CSS/DOM của Facebook được gom **một chỗ duy nhất**:
[`src/main/automation/selectors.js`](src/main/automation/selectors.js). Mỗi phần tử được
khai báo là **một mảng các selector dự phòng** (thử lần lượt cho tới khi khớp), vì Facebook
hay đổi class/thuộc tính theo A/B test hoặc theo ngôn ngữ.

Khi tool báo lỗi `FACEBOOK_LAYOUT_CHANGED` / `POST_COMPOSER_NOT_FOUND` / tương tự:

1. Vào **Lịch sử đăng bài** hoặc **Nhật ký hệ thống**, xem lỗi + đường dẫn ảnh chụp màn
   hình (thư mục `screenshots` trong `userData`, xem đường dẫn qua `system:getDataDir`).
2. Mở đúng Chrome Profile của tài khoản đó (nút "Mở để đăng nhập"), vào đúng trang bị lỗi,
   bấm F12 mở DevTools, xác định selector mới cho phần tử tương ứng.
3. Mở `selectors.js`, thêm selector mới vào **đầu mảng** tương ứng (giữ lại selector cũ
   làm phương án dự phòng).
4. Bật lại **DRY_RUN**, chạy thử để xác nhận selector mới hoạt động, rồi mới tắt DRY_RUN.

## 9. Danh sách mã lỗi

| Mã lỗi | Ý nghĩa |
|---|---|
| `ACCOUNT_NOT_LOGGED_IN` / `LOGIN_SESSION_EXPIRED` | Tài khoản chưa/không còn đăng nhập |
| `CHECKPOINT_DETECTED` / `CAPTCHA_DETECTED` | Facebook yêu cầu xác minh — cần xử lý thủ công |
| `GROUP_NOT_FOUND` / `GROUP_ACCESS_DENIED` | Không truy cập được nhóm |
| `ACCOUNT_NOT_MEMBER` | Tài khoản chưa tham gia nhóm |
| `TARGET_NOT_CONFIGURED` / `PAGE_URL_NOT_SET` | Đã chọn đăng lên Fanpage nhưng tài khoản chưa gắn Fanpage URL |
| `POST_COMPOSER_NOT_FOUND` / `CONTENT_INPUT_FAILED` / `SUBMIT_BUTTON_NOT_FOUND` | Không tìm thấy phần tử trên giao diện — khả năng cao do Facebook đổi giao diện, xem mục 8 |
| `MEDIA_UPLOAD_FAILED` | Tải ảnh/video lên thất bại, hoặc video xử lý quá lâu (quá thời gian chờ) |
| `POST_SUBMIT_FAILED` | Facebook từ chối/báo lỗi khi đăng |
| `PENDING_STATUS_NOT_DETECTED` / `POST_URL_NOT_FOUND` | Không xác định được kết quả sau khi đăng |
| `FACEBOOK_LAYOUT_CHANGED` | Giao diện Facebook thay đổi khiến tool không nhận diện được |
| `NETWORK_ERROR` / `TIMEOUT` | Lỗi mạng / hết thời gian chờ |
| `UNKNOWN_ERROR` | Lỗi không xác định |

Toàn bộ enum nằm ở [`src/main/automation/statusCodes.js`](src/main/automation/statusCodes.js).

## 10. Kho video (Google Sheets + Google Drive) — Giai đoạn 1 lộ trình mở rộng

Cho phép đồng bộ danh sách video (link Google Drive) từ 1 Google Sheet, tải video về máy,
dùng để tạo bài đăng, và tự ghi lại link kết quả ngược về Sheet sau khi đăng xong.

### Cấu trúc cột (tuỳ chỉnh theo sheet thật đang dùng — xem `COL` trong
[`src/main/services/googleSheetsService.js`](src/main/services/googleSheetsService.js) nếu cần đổi)

Hàng 1 là tiêu đề có sẵn (tool không tự động ghi/sửa). Dữ liệu bắt đầu từ hàng 2. Tool
**chỉ đọc/ghi đúng 4 cột dưới đây**, không đụng tới các cột khác trong sheet:

| Cột | Nội dung | Ai điền |
|---|---|---|
| A | Tên video | Bạn |
| B | Link video (Google Drive) | Bạn |
| C | Link kết quả sau khi đăng | Tool |
| D | Đã đăng xong (tick TRUE) | Tool |

Dùng 1 Google Sheet **riêng, sạch** cho tool này (không dùng chung với sheet sản xuất nội
dung phức tạp khác của bạn nếu có, để tránh nhầm lẫn/ghi đè cột không liên quan).

Trạng thái chi tiết, lỗi, ngày giờ đăng... được lưu trong database nội bộ và xem trực tiếp
ở màn hình **Kho video** trong tool — không ghi ra Sheet vì sheet không có cột dành riêng
cho các thông tin này.

### Cách kết nối (làm 1 lần)

1. Tạo project tại [console.cloud.google.com](https://console.cloud.google.com), bật **Google
   Sheets API** và **Google Drive API** (APIs & Services → Library).
2. Tạo **Service Account** (APIs & Services → Credentials → Create Credentials → Service
   Account), sau đó vào tab **Keys** của Service Account đó → **Add Key → Create new key →
   JSON** → tải file `.json` về, lưu ở nơi an toàn.
3. Mở file JSON, copy giá trị `client_email`.
4. **Share** Google Sheet cho email đó với quyền **Editor**.
5. **Share** file/thư mục video trên Google Drive cho email đó (Viewer là đủ), hoặc bật
   "Anyone with the link" — nếu không, tool sẽ không tải được video (lỗi 403/404).
6. Vào **Cài đặt** trong tool → nhập **Google Sheet ID** (lấy từ URL Sheet), **tên tab**, và
   chọn **file khoá JSON** vừa tải → bấm **Kiểm tra kết nối**.

### Cách dùng

Vào **Kho video** → **Đồng bộ từ Google Sheet** → bấm **Tải về** cho video muốn dùng → bấm
**Dùng để tạo bài đăng** (tự điền sẵn video + nội dung gợi ý sang màn hình Tạo bài đăng) →
đăng như bình thường. Sau khi đăng thật (không phải DRY_RUN) xong, tool tự ghi trạng thái +
link bài viết ngược lại Kho video và Google Sheet — không cần copy tay.

Đây là **Giai đoạn 1** trong lộ trình mở rộng đa nền tảng (Google Sheets → AI viết caption →
lịch đăng tự động cho Facebook → Instagram → TikTok → Threads). AI viết caption/Instagram/
TikTok/Threads **chưa có** trong bản này.

## 11. Lịch đăng tự động — Giai đoạn 3

Cho phép đặt sẵn khung giờ trong ngày; đến giờ, tool **tự động** (không cần bấm gì):

1. Đồng bộ lại Google Sheet.
2. Lấy video kế tiếp trong Kho video (ưu tiên video đã tải sẵn, chưa tải thì tự tải).
3. Tạo chiến dịch với đúng tài khoản/đích đăng đã cấu hình cho khung giờ đó.
4. Chạy hàng đợi đăng bài.
5. Ghi kết quả về Kho video + Google Sheet.

**Giới hạn quan trọng cần biết:**

- Lịch **chỉ chạy khi app đang mở** — đây không phải dịch vụ nền 24/7 của Windows. Tắt app =
  lịch hôm đó không chạy.
- Khi gặp CAPTCHA/checkpoint/hết phiên đăng nhập, lịch **vẫn dừng lại** và gửi thông báo hệ
  điều hành (Windows toast) để bạn xử lý thủ công — **không có** cơ chế tự động vượt qua dưới
  bất kỳ hình thức nào, giữ đúng nguyên tắc an toàn xuyên suốt của tool.
- Nếu 2 lịch trùng đúng giờ, lịch chạy sau sẽ đợi lịch trước xong (xử lý tuần tự, không chạy
  song song).
- Vào **Lịch đăng tự động** trong app để thêm/sửa/xoá lịch, bật/tắt, hoặc bấm **"Chạy thử
  ngay"** để kiểm tra một lịch mà không cần chờ đúng giờ.

## 12. Đăng Instagram — Giai đoạn 4 (mới, best-effort)

Đăng lên Instagram bằng **giả lập trình duyệt** (Playwright điều khiển instagram.com), không
dùng API chính thức của Meta.

- **Dùng lại đúng tài khoản/Chrome Profile hiện có** — không cần tạo tài khoản riêng cho
  Instagram. Bạn phải **tự đăng nhập Instagram thủ công** trong đúng Chrome Profile của tài
  khoản đó (Tài khoản MXH → "Mở để đăng nhập" → tự đăng nhập thêm Instagram trong cùng
  cửa sổ đó).
- Ở màn hình **Tạo bài đăng** và **Lịch đăng tự động**, mỗi tài khoản có thêm checkbox
  **"Đăng lên Instagram"**.
- ⚠️ **Selector Instagram (`src/main/automation/instagramSelectors.js`) là best-effort, CHƯA
  được kiểm chứng trên tài khoản thật** (khác với selector Facebook đã qua nhiều lần chỉnh
  sửa thực tế). Gần như chắc chắn cần chạy DRY_RUN và chỉnh sửa selector vài lần trước khi
  dùng thật — xem lại mục 8 (cách sửa selector), áp dụng tương tự cho file này.
- Instagram không phải lúc nào cũng trả về link bài viết ngay sau khi đăng — job có thể dừng
  ở trạng thái "Đăng thành công" (`POSTED`) mà không có link, khác với Facebook (`PUBLISHED`
  kèm link).
- Instagram bắt buộc phải có ảnh/video đính kèm (không đăng được bài chỉ có chữ).

## 13. Đóng gói thành file cài đặt Windows

```bash
npm run dist:win
```

electron-builder sẽ tạo file cài đặt NSIS (`.exe`) trong thư mục `dist/` (cấu hình ở
khoá `"build"` trong `package.json`). Có thể chỉnh `appId`, `productName`, icon... trong đó.

## 14. Phát hành bản cập nhật mới (tự động cập nhật cho máy nhân viên)

App tự kiểm tra bản mới mỗi khi mở lên (qua GitHub Releases của repo `anhphong0311/supperzzzz`), hỏi
trước khi tải và hỏi lại trước khi cài đặt — không tự động ép nhân viên cập nhật ngầm. Cơ chế này chỉ
hoạt động ở bản **đã đóng gói thật** (không hoạt động khi chạy `npm run dev`/`npm run start`).

Quy trình phát hành bản mới (quản trị viên thực hiện):

1. Tăng số `"version"` trong `package.json` (ví dụ `"0.1.0"` → `"0.2.0"`) — **bắt buộc**, app so sánh
   version này để biết có bản mới hay không.
2. Chạy `npm run dist:win` — lấy 2 file trong thư mục `dist/`: file cài đặt `.exe` và file
   `latest.yml`.
3. Vào trang GitHub của repo → tab **Releases** → **Draft a new release** → đặt tag đúng dạng
   `v0.2.0` (phải khớp chính xác version vừa tăng, có chữ `v` ở đầu) → kéo thả **cả 2 file** (`.exe`
   và `latest.yml`) vào phần đính kèm release → **Publish release**.
4. Xong — không cần làm gì thêm phía nhân viên. Lần mở app tiếp theo trên từng máy, app tự phát hiện
   bản mới và hỏi có muốn tải/cài không.

> Vì app chưa được ký số (code-signed), Windows SmartScreen có thể vẫn hiện cảnh báo khi cài bản cập
> nhật, tương tự như khi cài đặt lần đầu — không phải lỗi, cứ chọn "More info" → "Run anyway".

## 15. Đăng nhập & phân quyền (Admin / Nhân viên)

Mỗi lần mở app, người dùng phải chọn vai trò:

- **Quản trị (Admin)**: toàn quyền, bao gồm cả trang **Cài đặt** (khoá Google Service
  Account, giới hạn bài/ngày, thời gian chờ, mật khẩu...).
- **Nhân viên**: dùng được mọi màn hình còn lại (Tạo bài đăng, Tài khoản, Nhóm, Kho video,
  Lịch đăng tự động, Lịch sử...) để tự mở Chrome Profile đăng nhập tài khoản của mình và tự
  đăng bài, nhưng **không** vào được trang Cài đặt.

Mật khẩu Admin và Nhân viên là **2 mật khẩu độc lập**, riêng cho từng máy (mỗi máy có
database riêng, không đồng bộ giữa các máy — xem mục 17).

## 16. Phần dành cho Nhân viên

1. Nhận file cài đặt (`.exe`) từ quản trị viên, cài đặt bình thường như mọi phần mềm Windows
   khác (hoặc dùng cách chạy nhanh qua file `.bat` nếu quản trị viên hướng dẫn — xem mục 3).
2. Mở ứng dụng lần đầu trên máy của mình:
   - Nếu máy **chưa được quản trị viên thiết lập mật khẩu Admin**, màn hình sẽ bắt thiết lập
     mật khẩu Admin trước — báo lại cho quản trị viên xử lý bước này, không tự đặt mật khẩu
     Admin nếu bạn là nhân viên.
   - Nếu máy đã thiết lập xong, chọn **"Vào với vai trò Nhân viên"** (nhập mật khẩu Nhân
     viên nếu quản trị viên đã đặt).
3. Vào menu **Tài khoản MXH**, với mỗi tài khoản mình phụ trách: bấm **"Mở để đăng
   nhập"**, tự tay đăng nhập Facebook (và Instagram/TikTok trong cùng cửa sổ nếu có dùng) —
   xem chi tiết mục 4. Đây là bước bắt buộc, tool không lưu mật khẩu Facebook thay bạn.
4. Vào **Danh sách nhóm** kiểm tra các nhóm mình đã được gán quyền đăng (mục 5).
5. Vào **Tạo bài đăng**, **luôn bật DRY_RUN trước** để kiểm tra (mục 6) trước khi tắt DRY_RUN
   để đăng thật (mục 7).
6. **Nguyên tắc an toàn bắt buộc**: nếu tool báo gặp CAPTCHA/checkpoint/yêu cầu xác minh,
   **dừng lại ngay, không cố tự vượt qua bằng bất kỳ cách nào**, báo cho quản trị viên biết
   để xử lý thủ công trên đúng tài khoản đó.

## 17. Phần dành cho Quản trị viên

- **Đóng gói installer để gửi cho nhân viên**: chạy `npm run dist:win` (mục 13), lấy file
  `.exe` trong thư mục `dist/` gửi cho từng nhân viên tự cài trên máy của họ.
- **Thiết lập mật khẩu Admin lần đầu trên máy nhân viên**: mở app lần đầu trên máy đó, làm
  theo màn hình thiết lập — nên là người trực tiếp làm bước này (không giao cho nhân viên),
  vì ai thiết lập trước sẽ là người biết mật khẩu Admin của máy đó.
- **Tạo/khoá/đặt lại mật khẩu tài khoản Nhân viên**: vào trang **Tài khoản Nhân viên** (chỉ
  Admin thấy được), mỗi nhân viên có tên đăng nhập + mật khẩu riêng — bài họ tạo ra sẽ ghi lại
  đúng tên họ trong cột "Người thực hiện" ở Lịch sử.
- **Đổi mật khẩu Admin**: vào trang Cài đặt, mục "Đổi mật khẩu Admin".
- **Lưu ý quan trọng**: mỗi máy có **database riêng, độc lập hoàn toàn** — không có nơi tập
  trung để xem lại hoạt động của tất cả nhân viên cùng lúc. Muốn biết tình hình đăng bài của
  một nhân viên, cần xem trực tiếp trên máy của người đó (màn hình Lịch sử/Nhật ký hệ thống).
- **Chưa có cơ chế cập nhật tự động** giữa các máy nhân viên — mỗi khi có bản sửa lỗi/tính
  năng mới, quản trị viên phải build lại (`npm run dist:win`) và gửi lại file cài đặt mới cho
  từng nhân viên tự cài đè lên bản cũ.

## 18. Chuyển một tài khoản MXH giữa nhiều máy (dùng luân phiên)

> ⚠️ **Chỉ nên dùng khi thật sự cần thiết.** Facebook/TikTok theo dõi thiết bị đăng nhập vào
> từng tài khoản. Một tài khoản đổi qua đổi lại giữa nhiều máy vật lý (mỗi máy có dấu vân tay
> trình duyệt khác nhau) là dấu hiệu điển hình khiến nền tảng yêu cầu xác minh hoặc khoá tạm
> tài khoản. Tool **không** và **sẽ không** có cơ chế tự động né tránh việc này. Cách an toàn
> nhất vẫn là mỗi tài khoản MXH gắn cố định với một máy — chỉ dùng quy trình dưới đây khi bắt
> buộc phải luân phiên, và hiểu rõ rủi ro có thể xảy ra.

Nếu vẫn cần chuyển một tài khoản (Chrome Profile) từ máy A sang máy B:

1. **Trên máy A**: đóng hẳn ứng dụng, đảm bảo không có chiến dịch nào đang chạy cho tài khoản
   đó (xem Lịch sử/Tổng quan để chắc chắn hàng đợi đã dừng).
2. Copy **toàn bộ thư mục** Chrome Profile của tài khoản đó (đường dẫn xem ở trang Tài khoản
   Facebook) sang USB hoặc ổ mạng dùng chung.
3. **Đổi tên** thư mục gốc trên máy A (ví dụ thêm hậu tố `-DA_CHUYEN_SANG_MAY_B`) thay vì để
   nguyên tên cũ — tránh vô tình bấm "Mở để đăng nhập" nhầm bản cũ đã lỗi thời sau này.
4. **Trên máy B**: dán thư mục vừa copy vào một vị trí trên máy, vào **Tài khoản MXH** →
   **+ Thêm tài khoản** (hoặc **Sửa** nếu tài khoản đã tồn tại trong DB của máy B) → trỏ đúng
   **Đường dẫn Chrome Profile** tới thư mục vừa dán.
5. Chỉ đăng bài cho tài khoản đó **từ máy B** kể từ lúc này. Muốn chuyển ngược lại máy A, lặp
   lại đúng quy trình theo chiều ngược lại.
6. **Tuyệt đối không** để cả 2 máy cùng có bản Chrome Profile "sống" và cùng chạy đăng bài cho
   cùng tài khoản đó trong cùng một khoảng thời gian — đây là tình huống rủi ro cao nhất.

Đây là quy trình **thủ công, không có gì trong tool tự động kiểm soát hay ngăn chặn việc dùng
đồng thời** — an toàn hay không phụ thuộc hoàn toàn vào việc người thực hiện tuân thủ đúng các
bước trên.

## 19. Giới hạn của bản MVP hiện tại

- Chỉ xử lý **tuần tự** (1 tài khoản tại một thời điểm), chưa hỗ trợ chạy song song nhiều
  tài khoản.
- Lịch đăng tự động chỉ chạy khi app đang mở, không phải dịch vụ nền 24/7 — xem mục 11.
- Chưa có nội dung riêng theo từng tài khoản (chỉ dùng chung một nội dung cho tất cả, theo
  đúng yêu cầu bản đầu tiên).
- Tự động kiểm tra lại bài chờ duyệt theo lịch (`auto_recheck_pending`) mới có cấu hình,
  chưa có cơ chế tự chạy — hiện tại phải bấm "Kiểm tra lại" thủ công trong Lịch sử.
- Selector Facebook có thể lỗi thời theo thời gian — xem mục 8 để tự cập nhật. Selector cho
  bước chuyển danh tính sang Fanpage là selector **dễ lỗi thời nhất**.
- Mỗi tài khoản chỉ gắn được **một** Fanpage (không hỗ trợ nhiều Fanpage/tài khoản như
  Nhóm) — đủ dùng cho quy mô cá nhân/hộ kinh doanh nhỏ của bản MVP này.
- Instagram (mục 12) dùng selector best-effort chưa kiểm chứng thực tế — nhiều khả năng cần
  chỉnh sửa qua vài lần DRY_RUN. Chưa hỗ trợ TikTok, Threads, YouTube.
- Chưa có AI tự viết caption — nội dung khi đăng từ Kho video lấy từ cột "Tên video" trên
  Sheet (do người dùng tự điền), tool không tự sinh nội dung.
- Instagram chưa được lịch đăng tự động (mục 11) hỗ trợ tách giới hạn bài/ngày riêng — dùng
  chung bộ đếm giới hạn bài/ngày với Facebook của cùng tài khoản.
- Đăng nhập/phân quyền (mục 15-17) chỉ có 2 vai trò cố định (Admin/Nhân viên) trên từng máy
  độc lập — chưa có nơi quản lý/theo dõi tập trung nhiều máy.
- Tự động cập nhật (mục 14) chưa được ký số (code-signed) — Windows SmartScreen có thể vẫn cảnh
  báo khi cài đặt bản cập nhật, giống hệt lần cài đặt đầu tiên; việc phát hành bản mới lên GitHub
  Releases vẫn cần quản trị viên làm thủ công (chưa tự động hoá bước upload).
- Chuyển tài khoản MXH giữa nhiều máy (mục 18) là quy trình **thủ công hoàn toàn** — tool
  không có cơ chế khoá/kiểm tra để ngăn 2 máy cùng dùng 1 tài khoản đồng thời, rủi ro bị nền
  tảng gắn cờ "thiết bị lạ" phụ thuộc vào việc tuân thủ đúng quy trình.
