# Bàn giao triển khai frontend

Ngày: 08/11/2026. Phạm vi hiện tại chỉ là giao diện HTML/CSS/JavaScript thuần. Không có PHP API, schema MySQL, tài khoản quản trị hoặc nghiệp vụ backend được triển khai thay thành viên 2.

## Chạy tại XAMPP

1. Cài XAMPP có Apache và PHP 8.x. MySQL/MariaDB cần cho backend sau khi thành viên 2 cung cấp.
2. Đặt bản checkout dùng phát triển trong `htdocs/cua-hang-dien-thoai`, hoặc cấu hình Apache trỏ tới bản checkout. Ví dụ XAMPP mặc định: `C:\xampp\htdocs\cua-hang-dien-thoai`.
3. Bật Apache trong XAMPP Control Panel và mở `http://localhost/cua-hang-dien-thoai/`.
4. Giữ `dataSource: 'mock'` khi kiểm tra giao diện với fixtures. Không mở trực tiếp bằng `file://` vì ES modules và fetch JSON cần HTTP.

Không cần `npm install`, build Node.js hoặc server Node.js. Node chỉ có thể dùng tùy chọn để kiểm tra cú pháp trong công cụ kiểm chứng. Các URL trong JavaScript là tương đối; không cố định tên host hoặc đường dẫn máy cá nhân.

## Cấu hình kết nối backend

Toàn bộ cấu hình nằm ở `assets/js/config.js`:

```js
export const config = Object.freeze({
  dataSource: 'api',
  apiBaseUrl: './api/',
  mockBaseUrl: './mock/',
  timeoutMs: 12000,
});
```

Chỉ chuyển sang `api` sau khi hai thành viên thống nhất `docs/API_CONTRACT.md`, endpoint PHP thật có mặt và phản hồi đúng schema. `apiBaseUrl` cần kết thúc bằng `/` và được giải quyết tương đối với trang hiện tại. Dự án có thể nằm dưới thư mục con của hosting. Khi đổi vị trí URL các trang, cần kiểm tra lại `document.baseURI`, đường dẫn assets và API.

`assets/js/api.js` tập trung endpoint, fetch JSON, timeout, lỗi, cookie cùng origin và CSRF. Không có cơ chế tự quay về dữ liệu mẫu khi API thật lỗi. Giữ frontend/API cùng origin là phương án tích hợp mặc định; cấu hình CORS khác origin phải được hai thành viên thống nhất riêng.

## Điều kiện trước khi công khai bán hàng

- Thay toàn bộ dữ liệu, ảnh và nội dung chính sách mẫu bằng thông tin đã xác minh. Đổi thông tin nhận diện/liên hệ phù hợp đơn vị thực tế; có quyền sử dụng ảnh.
- Bật `dataSource: 'api'`; không xuất bản `mock/` làm nguồn sản phẩm. Loại fixtures phát triển khỏi bản phát hành nếu không còn cần.
- Backend phải xác thực phiên, phân quyền và quyền xem từng đơn. Không lấy quyền tài khoản từ JavaScript/localStorage.
- Backend kiểm tra lại ID biến thể, số lượng, tồn kho, giá, phí và tổng đơn từ MySQL trong giao dịch phù hợp. Frontend chỉ gửi ID/số lượng và thông tin giao hàng cần thiết.
- Chỉ hiển thị thành công/xóa giỏ khi nhận kết quả tạo đơn hợp lệ có mã đơn từ API thật. Lỗi API không làm mất giỏ hoặc báo đã lưu MySQL.
- Backend phát token CSRF qua session endpoint; kiểm tra token cho mọi mutation. Cấu hình cookie phiên HttpOnly, SameSite phù hợp và Secure trên HTTPS; tái tạo session sau đăng nhập và thu hồi khi đăng xuất.
- Cấu hình HTTPS, charset UTF-8 và MIME đúng: `.js` là JavaScript, `.json` là `application/json`, `.svg` là `image/svg+xml`. API trả JSON kể cả khi lỗi; không chèn PHP warning/HTML vào phản hồi.
- Thực hiện validation phía server, prepared statements PDO, giới hạn gửi form/đăng nhập và ghi log phù hợp. Đây là phần phối hợp backend, chưa được frontend hiện tại triển khai.

## Phạm vi file public và cấu hình hosting

File frontend cần phục vụ là các trang `.html` ở root và `assets/`. Khi tích hợp sẽ có thêm API do thành viên backend quản lý. Không đưa `.git`, `.env`, khóa, database dump, backup, tài liệu nội bộ hoặc công cụ phát triển vào thư mục public. Nếu repository nằm trong webroot, cấu hình Apache chặn các đường dẫn nhạy cảm và tắt directory listing; kiểm tra thực tế bằng HTTP trước khi mở truy cập.

Giữ bí mật database ngoài file JavaScript và ngoài Git. Vị trí secrets/config PDO thuộc cấu trúc backend thống nhất, không tự tạo bản cấu hình trùng. Cấu hình rewrite không được chuyển các endpoint API hoặc đường dẫn file tĩnh về `index.html`; đây là website nhiều trang, không cần SPA fallback.

Cache HTML và `config.js` vừa phải để tránh giữ nhầm chế độ mẫu sau phát hành; có chiến lược invalidation hoặc version URL khi cập nhật assets. Dùng hosting Apache/PHP/MySQL để kiểm thử quy trình thực, không xem việc phục vụ HTML tĩnh là đã hoàn tất backend.

## Kiểm tra trước và sau triển khai

Chạy từ thư mục repository:

```text
python tools/verify_frontend.py
```

Công cụ chỉ đọc file, kiểm tra đường dẫn, module, fixtures, SVG và cú pháp JavaScript khi có Node. Nó không gọi PHP/MySQL, không xác thực nghiệp vụ và không thay thế rà soát bảo mật hoặc kiểm thử trình duyệt.

Tiếp theo chạy checklist trong `docs/FRONTEND_TESTING.md`: desktop/tablet/mobile từ 360px, điều hướng, biến thể, giỏ, validation, trạng thái lỗi, session, đặt đơn thật và lịch sử đơn. Cần kiểm tra phản hồi lỗi `401/403/404/409/422/429/500`, ngắt mạng và hết thời gian chờ. Với production, xác minh không có request tới `/mock/`, không lộ file nhạy cảm và không có lỗi console/ảnh hỏng.

## Trình tự phối hợp thành viên 2

1. Chốt contract, schema dữ liệu trả về, tên endpoint, session/CSRF, cách xử lý giá/tồn kho và giỏ chính thức.
2. Backend triển khai PHP/PDO/MySQL trên nhánh của mình; frontend không ghi đè file nghiệp vụ.
3. Cung cấp môi trường tích hợp và dữ liệu hợp lệ; chuyển cấu hình frontend sang API thật.
4. Chạy toàn bộ luồng đăng ký/đăng nhập, duyệt hàng, đặt COD, kiểm tra lưu MySQL và quyền xem đơn.
5. Ghi rõ lỗi thuộc mỗi phần, sửa và kiểm tra lại trước khi phát hành. Không tự merge hoặc push từ phiên frontend này.
