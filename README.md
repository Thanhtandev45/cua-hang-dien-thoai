# NOVA Mobile — Frontend cửa hàng điện thoại

Giao diện khách hàng bằng **HTML5, CSS3 và JavaScript ES modules thuần**, chạy trực tiếp trên Apache/XAMPP, không cần bước build hoặc Node.js để vận hành. Chuẩn bị tích hợp PHP 8.x + MySQL/MariaDB của thành viên backend qua lớp API riêng.

**Trạng thái:** bản frontend với dữ liệu phát triển; chưa có backend, database hay giao dịch thực tế. Không giả lập đăng nhập, lưu đơn hoặc gửi liên hệ thành công.

## Chạy bằng XAMPP

1. Đặt thư mục dự án vào `htdocs/cua-hang-dien-thoai` của XAMPP, hoặc cấu hình Apache VirtualHost trỏ đến checkout hiện tại.
2. Mở XAMPP Control Panel và bật **Apache**.
3. Truy cập `http://localhost/cua-hang-dien-thoai/`.

Không mở HTML trực tiếp bằng `file://`: ES modules và fetch JSON cần HTTP. Chế độ mẫu không cần bật MySQL. Khi backend được tích hợp, bật MySQL và làm theo cấu hình do thành viên backend cung cấp.

## Những gì đã triển khai

- Trang chủ, thương hiệu, điện thoại nổi bật, mới và ưu đãi.
- Danh sách: tìm tên có/không dấu, thương hiệu, khoảng giá, dung lượng, tồn kho; sắp xếp và phân trang. Bộ lọc được lưu trong URL.
- Chi tiết: thư viện ảnh, chọn dung lượng/màu, cập nhật giá/tồn kho và kiểm soát số lượng.
- Giỏ hàng: thêm, tăng/giảm, xóa, duy trì qua tải lại; chỉ lưu ID sản phẩm, ID biến thể và số lượng. Kiểm tra lại dữ liệu khi mở giỏ/checkout.
- Checkout COD: kiểm tra thông tin, tổng tạm tính, trạng thái chờ backend; giữ giỏ khi lỗi.
- Đăng nhập/đăng ký, tài khoản, lịch sử/chi tiết đơn: giao diện và controller gọi API; dữ liệu cá nhân chỉ hiển thị khi có phiên thật.
- Tin tức, chi tiết bài, tìm kiếm và liên hệ; trang chính sách minh họa.
- Menu mobile, thông báo toast, loading, trạng thái trống/lỗi, focus bàn phím, ảnh dự phòng và hỗ trợ giảm chuyển động.

## Cấu trúc

```text
*.html                  Các trang khách hàng, dùng chung shell qua app.js
assets/css/             Tokens, nền tảng, components, layout và responsive
assets/js/app.js        Header/footer, navigation, khởi tạo đúng trang
assets/js/ui.js         Components dùng chung, định dạng và escape dữ liệu
assets/js/config.js     Nguồn dữ liệu, base URL, timeout tập trung
assets/js/api.js        Fetch, JSON envelope, lỗi, CSRF, mock adapter
assets/js/catalog-model.js Chọn biến thể/giá hiển thị thống nhất với bộ lọc
assets/js/home.js        Trang chủ
assets/js/products.js    Danh sách và chi tiết điện thoại
assets/js/cart.js        Giỏ hàng, localStorage và kiểm tra biến thể
assets/js/checkout.js    Giao diện checkout và tạo request
assets/js/auth.js        Form tài khoản và validation dùng chung
assets/js/customer.js    Tài khoản, đơn hàng, liên hệ, chính sách
assets/js/news.js        Tin tức và chi tiết bài
assets/images/          SVG gốc minh họa, không cần CDN
mock/                   250 model, 1.485 biến thể, 14 hãng, 6 bài mẫu
docs/                   Tiến độ, UI spec, contract, kiểm thử, deploy
tools/                  Công cụ kiểm tra dành cho phát triển
tests/                  Kiểm tra API adapter và giỏ hàng
```

Các HTML dùng `data-page` để chọn controller. Header/footer được dựng ở một nơi; các vùng giao diện có thể chuyển thành PHP partials mà vẫn tái sử dụng CSS và modules JavaScript. Không có PHP nghiệp vụ, admin hoặc SQL được tạo trong phạm vi frontend.

## Tích hợp với thành viên backend

1. Thống nhất [API Contract đề xuất](docs/API_CONTRACT.md), gồm endpoint PHP, models, JSON response, session và CSRF.
2. Backend triển khai các endpoint theo contract hoặc thống nhất điều chỉnh tại `api.js`; giữ URL tập trung.
3. Trong `assets/js/config.js`, đổi `dataSource: 'mock'` thành `'api'` và đặt `apiBaseUrl` tương đối theo vị trí endpoint.
4. Kiểm thử dưới Apache/PHP với session thật, quyền truy cập đơn, validation, lỗi mạng và tồn kho trước khi đưa lên hosting.

Chế độ API gửi các tham số lọc/phân trang đến server; không tải toàn database để lọc trong trình duyệt. Không tự fallback sang dữ liệu mẫu khi API lỗi. Giá, phí vận chuyển và tồn kho cuối cùng luôn phải do backend xác nhận. Mật khẩu, thông tin giao hàng và quyền truy cập không lưu vào localStorage.

## Kiểm tra và bàn giao

- `python tools/verify_frontend.py`: đường dẫn, imports, JSON mẫu, SVG và cú pháp JavaScript nếu có Node.
- `node --test tests/api-cart.test.mjs`: kiểm tra logic và phản hồi API giả lập; không phải kiểm thử PHP/MySQL.
- `python tools/validate_catalog.py`: kiểm tra ID/slug/SKU, bảo toàn dữ liệu cũ, ảnh và các artifacts sinh từ master.
- Kiểm tra trình duyệt bằng `node tools/browser-smoke.mjs` theo hướng dẫn trong [FRONTEND_TESTING](docs/FRONTEND_TESTING.md).

Python và Node chỉ phục vụ kiểm tra, không phải phụ thuộc chạy website. Xem [tiến độ](docs/FRONTEND_PROGRESS.md), [UI spec](docs/UI_SPEC.md), [kiểm thử](docs/FRONTEND_TESTING.md) và [lưu ý triển khai](docs/FRONTEND_DEPLOYMENT_NOTES.md) trước khi bàn giao.

## Giới hạn hiện tại

Chưa tích hợp PHP/MySQL, xác thực/session, lưu liên hệ và xử lý đơn thật; chưa kiểm thử end-to-end với backend. Tên cửa hàng, ảnh minh họa, giá/thông số và chính sách là dữ liệu phát triển, cần thay bằng dữ liệu đã xác minh trước khi mở bán. Không đưa mock thành nguồn sản phẩm chính trên website hoạt động.

Mã nguồn đang làm việc trên nhánh `feature/frontend-storefront`; chưa commit, merge hoặc push tự động. Phạm vi triển khai chỉ là frontend, không ghi nhận đóng góp thay thành viên nào.

## Danh mục mở rộng

Danh mục hiện có **250 model, 14 thương hiệu, 1.485 biến thể và 16.420 máy tồn kho demo**. Giữ nguyên 20 model/80 biến thể ban đầu, bổ sung SKU khi chưa có; các ID và liên kết giỏ cũ được bảo toàn. Thương hiệu mới: HONOR, Google Pixel, OnePlus, Motorola, Nothing, ASUS, Sony Xperia, TECNO. Giá, khuyến mãi và tồn kho đều là demo.

Trang chủ lấy ba nhóm riêng, mỗi nhóm 4 sản phẩm; không tải master/index của 250 model. Trang danh sách dùng chỉ mục mock gọn và chỉ tải chi tiết cho trang đang xem. Chế độ API vẫn phân trang tại PHP, không thay endpoint hoặc JSON contract.

Master nằm tại `mock/products.json`. Sau khi sửa master hoặc thêm seed trong `tools/catalog_models.csv`, chạy `python tools/build_catalog.py` để đồng bộ các JSON phục vụ giao diện. Builder chỉ thêm model chưa tồn tại; không tự ghi đè model từ seed đã có.

Xem [ánh xạ dữ liệu và nguồn](docs/CATALOG_DATA_MAPPING.md), [số liệu](docs/catalog-report.json) và [kiểm tra cấu trúc](docs/catalog-validation.json). **Số biến thể demo không phải số SKU thị trường đã được xác nhận:** thông số chưa xác minh để trống, tổ hợp màu/dung lượng cần duyệt theo thị trường; dữ liệu cũ có 4 model chứa tùy chọn trùng nhưng được giữ để bảo toàn ID. Báo cáo nguồn ghi rõ những trang đã/không truy cập được. Không import giá/tồn kho mẫu vào MySQL production.
