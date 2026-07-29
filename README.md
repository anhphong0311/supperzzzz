# FB Multi Poster (MVP)

Công cụ desktop hỗ trợ soạn **một** bài viết và đăng tuần tự lên **nhiều nhóm Facebook**
bằng **2–3 tài khoản Facebook** do bạn sở hữu/được phép quản lý, mỗi tài khoản dùng một
Chrome Profile (phiên đăng nhập) riêng biệt.

> ⚠️ **Đọc trước khi dùng — giới hạn & rủi ro**
> - Facebook không cung cấp API chính thức để đăng bài vào Groups theo cách này. Tool
>   dùng browser automation (Playwright) mô phỏng thao tác người dùng thật, dựa trên các
>   selector CSS/DOM hiện tại của giao diện Facebook — **selector này có thể lỗi thời bất
>   cứ lúc nào** khi Facebook đổi giao diện.
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
      postAutomation.js          # Luồng 15 bước đăng 1 bài vào 1 nhóm + DRY_RUN
      statusCodes.js              # Enum trạng thái & mã lỗi dùng chung
    queue/
      postQueue.js               # Hàng đợi xử lý tuần tự theo tài khoản -> nhóm
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

1. Vào menu **Tài khoản Facebook** → **+ Thêm tài khoản**.
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

## 5. Gán tài khoản vào nhóm

Vào **Danh sách nhóm** → **+ Thêm nhóm** (dán 1 hoặc nhiều URL nhóm, mỗi dòng một URL) →
với mỗi nhóm, bấm **Gán tài khoản** và tick chọn đúng những tài khoản **thật sự đã là
thành viên** của nhóm đó. Tool **không tự động** tham gia nhóm hộ bạn — bạn phải tự tham
gia nhóm bằng Facebook thật trước, rồi mới đánh dấu trong tool.

Nút **Kiểm tra truy cập** sẽ mở nhóm bằng một tài khoản cụ thể để xác nhận tài khoản đó
có xem/đăng bài được trong nhóm hay không, và tự cập nhật trạng thái.

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
2. Nhập nội dung, chọn ảnh (nếu có), chọn tài khoản, chọn nhóm tương ứng cho từng tài
   khoản (chỉ nhóm mà tài khoản đó đã được gán ở bước 5 mới chọn được).
3. Thiết lập thời gian chờ giữa hai lần đăng (giây) — nên để tối thiểu vài chục giây,
   tránh đăng dồn dập.
4. Bấm **Đăng bài**. Tool xử lý **tuần tự**: xong toàn bộ nhóm của tài khoản 1 rồi mới
   sang tài khoản 2, v.v. Theo dõi tiến trình + nhật ký thời gian thực ngay trong màn
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
| `POST_COMPOSER_NOT_FOUND` / `CONTENT_INPUT_FAILED` / `SUBMIT_BUTTON_NOT_FOUND` | Không tìm thấy phần tử trên giao diện — khả năng cao do Facebook đổi giao diện, xem mục 8 |
| `MEDIA_UPLOAD_FAILED` | Tải ảnh lên thất bại |
| `POST_SUBMIT_FAILED` | Facebook từ chối/báo lỗi khi đăng |
| `PENDING_STATUS_NOT_DETECTED` / `POST_URL_NOT_FOUND` | Không xác định được kết quả sau khi đăng |
| `FACEBOOK_LAYOUT_CHANGED` | Giao diện Facebook thay đổi khiến tool không nhận diện được |
| `NETWORK_ERROR` / `TIMEOUT` | Lỗi mạng / hết thời gian chờ |
| `UNKNOWN_ERROR` | Lỗi không xác định |

Toàn bộ enum nằm ở [`src/main/automation/statusCodes.js`](src/main/automation/statusCodes.js).

## 10. Đóng gói thành file cài đặt Windows

```bash
npm run dist:win
```

electron-builder sẽ tạo file cài đặt NSIS (`.exe`) trong thư mục `release/` (cấu hình ở
khoá `"build"` trong `package.json`). Có thể chỉnh `appId`, `productName`, icon... trong đó.

## 11. Giới hạn của bản MVP hiện tại

- Chỉ xử lý **tuần tự** (1 tài khoản tại một thời điểm), chưa hỗ trợ chạy song song nhiều
  tài khoản.
- Chưa có cơ chế tự động lên lịch (đăng vào một thời điểm định trước) — bấm "Đăng bài" là
  chạy ngay.
- Chưa có nội dung riêng theo từng tài khoản (chỉ dùng chung một nội dung cho tất cả, theo
  đúng yêu cầu bản đầu tiên).
- Tự động kiểm tra lại bài chờ duyệt theo lịch (`auto_recheck_pending`) mới có cấu hình,
  chưa có bộ lập lịch chạy nền — hiện tại phải bấm "Kiểm tra lại" thủ công trong Lịch sử.
- Selector Facebook có thể lỗi thời theo thời gian — xem mục 8 để tự cập nhật.
