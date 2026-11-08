# API Contract — đề xuất tích hợp frontend/PHP

**Trạng thái: ĐỀ XUẤT, chưa có backend PHP/MySQL để kiểm chứng.** Ngày 08/11/2026. Hai thành viên cần thống nhất contract trước khi triển khai thật. Tài liệu này mô tả giao diện tích hợp; không tự quy định schema MySQL hay thay phần việc backend.

## Quy ước chung

- Base URL cấu hình tại `assets/js/config.js`: `./api/`; tương thích website đặt trong thư mục con của Apache/XAMPP. Không hardcode host.
- JSON UTF-8; `Content-Type: application/json; charset=utf-8`. Request có body dùng JSON và `Accept: application/json`.
- Thành công: `{ "success": true, "data": ... }`. `api.js` trả phần `data` cho controller.
- Lỗi: `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Vui lòng kiểm tra dữ liệu.", "fields": { "email": "Email không hợp lệ." } } }`.
- ID dùng số nguyên dương hoặc chuỗi định danh ổn định; frontend so sánh dưới dạng chuỗi khi nhận query URL. Không dùng tên để định danh.
- Tiền là số nguyên VND, không chứa dấu phân cách; số lượng là số nguyên. Múi giờ timestamp có offset hoặc UTC ISO 8601. Ngày bài viết: `YYYY-MM-DD`.
- Phân trang: `{ "items": [], "pagination": { "page": 1, "per_page": 12, "total": 20, "total_pages": 2 } }`. `page >= 1`, `1 <= per_page <= 50`; không tải cả database về trình duyệt trong chế độ API.
- Không trả mật khẩu, password hash, thông tin nội bộ hay lỗi SQL về frontend. Nội dung bài viết và mô tả là **plain text**, không phải HTML tùy ý.
- Đường dẫn ảnh do backend xác thực: relative cùng website hoặc HTTPS từ CDN được cho phép. Ảnh phải tồn tại. Frontend có ảnh dự phòng cục bộ.
- Lớp API không tự chuyển về mock khi API thật lỗi. Timeout mặc định 12 giây, có thông báo lỗi để thử lại.

## Session, CSRF và bảo mật cần phối hợp

- Xác thực bằng PHP session cookie; `fetch` dùng `credentials: 'same-origin'`. Frontend không lưu token, mật khẩu hay quyền admin trong localStorage.
- Cookie session cấu hình `HttpOnly`, `Secure` khi HTTPS, `SameSite=Lax` hoặc chính sách đã thống nhất. Backend xác thực quyền trên từng endpoint đơn hàng/tài khoản.
- `GET auth/session.php` luôn có thể tạo phiên ẩn danh và trả `csrf_token`; `user:null` khi chưa đăng nhập.
- Mọi POST, bao gồm login/register/contact/đặt hàng, gửi `X-CSRF-Token`. `api.js` gọi session để lấy token nếu chưa có; token chỉ ở bộ nhớ tab. Backend kiểm tra token và xoay token khi thay phiên. Không tự retry POST sau lỗi mạng để tránh gửi trùng.
- Backend dùng PDO/prepared statements, kiểm tra mọi dữ liệu, mã hóa mật khẩu, giới hạn thử đăng nhập và chống gửi form liên tục. Đây là trách nhiệm backend, chưa được triển khai trong phiên frontend.
- Backend kiểm tra lại giá và tồn kho từ MySQL, khóa/cập nhật tồn kho phù hợp khi tạo đơn. Không tin giá hiển thị hoặc tổng tiền từ trình duyệt.
- Cần thống nhất cơ chế chống tạo trùng đơn khi mất kết nối (ví dụ idempotency key) trước khi đưa hệ thống bán hàng lên Internet; contract hiện chưa có retry tự động.

## Model dữ liệu dùng chung

### Brand

```json
{ "id": 1, "name": "Apple", "slug": "apple" }
```

### Product và variant

```json
{
  "id": 1,
  "slug": "iphone-16-pro-max",
  "name": "iPhone 16 Pro Max",
  "brand": { "id": 1, "name": "Apple", "slug": "apple" },
  "summary": "Mô tả ngắn dạng văn bản.",
  "description": "Mô tả chi tiết dạng văn bản.",
  "images": ["assets/images/apple-titanium.svg", "assets/images/phone-front.svg"],
  "specs": { "Màn hình": "Thông số đã xác minh", "Bộ nhớ": "256GB / 512GB" },
  "featured": true,
  "is_new": true,
  "created_at": "2026-10-28T08:00:00+07:00",
  "variants": [
    { "id": 101, "color": "Titan sa mạc", "color_hex": "#c6b5a4", "storage": "256GB", "price": 29990000, "original_price": 31490000, "stock": 9, "image": "assets/images/apple-titanium.svg" }
  ]
}
```

`original_price` có thể bằng `price` khi không giảm. `stock=0` là hết hàng. Cặp màu/dung lượng xác định một variant có ID riêng; không suy ra tồn kho chung cho cả sản phẩm. Danh sách sản phẩm hiện cần các trường trên để tái sử dụng product card và biến thể; backend có thể tối ưu payload sau khi hai bên thống nhất thay đổi.

### Post

```json
{ "id": 1, "slug": "chon-dien-thoai-phu-hop", "title": "Chọn điện thoại phù hợp", "excerpt": "Giới thiệu ngắn.", "category": "Tư vấn", "published_at": "2026-11-01", "image": "assets/images/editorial-guide.svg", "content": ["Đoạn văn thứ nhất.", "Đoạn văn thứ hai."] }
```

### User

```json
{ "id": 42, "name": "Nguyễn An", "email": "an@example.com", "phone": "0901234567" }
```

### Order

```json
{
  "id": 123,
  "code": "NOVA-000123",
  "status": "pending",
  "created_at": "2026-11-08T14:00:00+07:00",
  "total": 29990000,
  "shipping": { "name": "Nguyễn An", "phone": "0901234567", "address": "Địa chỉ giao hàng đầy đủ", "note": "Gọi trước khi giao" },
  "items": [ { "product_name": "iPhone 16 Pro Max", "color": "Titan sa mạc", "storage": "256GB", "quantity": 1, "unit_price": 29990000 } ]
}
```

Trạng thái đề xuất: `pending`, `confirmed`, `shipping`, `delivered`, `cancelled`. Tên hiển thị do giao diện ánh xạ; backend quyết định trạng thái hợp lệ. Có thể thêm `variant_id`, `product_id`, `payment_method`, `subtotal`, `shipping_fee` sau khi thống nhất. Lịch sử giữ tên và đơn giá tại thời điểm mua.

## Endpoint đọc công khai

### 1. GET `products.php` — danh sách/tìm kiếm/lọc sản phẩm

- Xác thực: không. Request body: không có.
- Query: `q` (tên, hỗ trợ tiếng Việt), `brand` (slug/ID, nhiều giá trị phân cách dấu phẩy), `min_price`, `max_price` (VND), `storage` (ví dụ `128GB,256GB`), `in_stock=1`, `featured=1`, `is_new=1`, `on_sale=1`, `sort=newest|price_asc|price_desc|name_asc`, `page=1`, `per_page=12`.
- Ví dụ: `products.php?brand=apple&storage=256GB&in_stock=1&sort=price_asc&page=1&per_page=12`.
- Điều kiện giá/dung lượng/tồn kho/giảm giá (`on_sale`) phải cùng thỏa trên ít nhất một variant; tránh trả sản phẩm chỉ thỏa từng điều kiện ở các variant khác nhau. Trong các variant khớp bộ lọc, chọn variant **còn hàng có giá thấp nhất**; nếu không có variant còn hàng, chọn variant khớp có giá thấp nhất (hiển thị hết hàng). Khi `in_stock=1`, không có trường hợp dự phòng hết hàng. `price_asc`/`price_desc` sắp theo **giá của chính variant đại diện này**, giống giá trên product card; không sắp theo giá của một dung lượng khác hoặc variant hết hàng rẻ hơn. Nếu không còn variant khớp thì loại sản phẩm khỏi kết quả. Frontend dùng chung `representativeVariant()` trong `catalog-model.js` cho mock API và product card; backend cần thực hiện cùng quy tắc trước khi phân trang.
- 200: `{ "success": true, "data": { "items": ["<Product>"], "pagination": { "page": 1, "per_page": 12, "total": 1, "total_pages": 1 } } }`. Mảng rỗng là kết quả hợp lệ.
- Lỗi: 422 query không hợp lệ; 500 lỗi máy chủ.

### 2. GET `product.php?id=1` — chi tiết một sản phẩm

- Xác thực: không. Query `id` bắt buộc, có thể hỗ trợ slug nếu backend thống nhất. Body: không.
- 200: `{ "success": true, "data": "<Product>" }` với đầy đủ ảnh, mô tả, specs, variants.
- Lỗi: 422 thiếu/sai ID, 404 sản phẩm không tồn tại hoặc không công khai, 500 lỗi máy chủ.

### 3. GET `brands.php` — danh mục thương hiệu

- Xác thực: không. Không có query bắt buộc/body.
- 200: `{ "success": true, "data": [ { "id": 1, "name": "Apple", "slug": "apple" } ] }`.
- Lỗi: 500 lỗi máy chủ. Mảng rỗng là trạng thái danh mục chưa có dữ liệu.

### 4. GET `posts.php` — danh sách và tìm kiếm tin tức

- Xác thực: không. Query: `q`, `category`, `page`, `per_page`; sắp ngày đăng giảm dần. Body: không.
- 200: `{ "success": true, "data": { "items": ["<Post>"], "pagination": { "page": 1, "per_page": 6, "total": 1, "total_pages": 1 } } }`.
- Lỗi: 422 query không hợp lệ, 500 lỗi máy chủ. Không có kết quả: `items:[]`.

### 5. GET `post.php?id=1` — chi tiết bài viết

- Xác thực: không. Query `id` bắt buộc. Body: không.
- 200: `{ "success": true, "data": "<Post>" }`; `content` là mảng đoạn văn plain text.
- Lỗi: 422 thiếu/sai ID, 404 bài không tồn tại/chưa công khai, 500 lỗi máy chủ.

## Endpoint tài khoản

### 6. GET `auth/session.php` — kiểm tra phiên, lấy CSRF

- Xác thực: không bắt buộc; không body/query. Không cache dữ liệu cá nhân (`Cache-Control: no-store`).
- 200 đã đăng nhập: `{ "success": true, "data": { "user": "<User>", "csrf_token": "<random-session-bound-token>" } }`.
- 200 chưa đăng nhập: `{ "success": true, "data": { "user": null, "csrf_token": "<anonymous-session-token>" } }`.
- Lỗi: 500 không thể tạo/đọc phiên. Không trả 401 chỉ vì user chưa đăng nhập; các trang tài khoản xử lý `user:null` để mời đăng nhập.

### 7. POST `auth/register.php` — đăng ký

- Xác thực: phiên ẩn danh được phép; bắt buộc CSRF header.
- Request: `{ "name": "Nguyễn An", "email": "an@example.com", "phone": "0901234567", "password": "<user-input>", "password_confirmation": "<same-user-input>" }`.
- Kiểm tra bắt buộc, độ dài, định dạng email/số điện thoại, xác nhận mật khẩu; frontend giới hạn tối thiểu 8 ký tự, backend quyết định chính sách cuối cùng.
- 201: `{ "success": true, "data": { "user": "<User>", "csrf_token": "<new-token>" } }` và phiên đăng nhập sau đăng ký theo đề xuất này.
- Lỗi: 422 dữ liệu sai, 409 email đã tồn tại, 403 CSRF, 429 giới hạn tần suất, 500 lỗi máy chủ.

### 8. POST `auth/login.php` — đăng nhập

- Xác thực: phiên ẩn danh được phép; bắt buộc CSRF header.
- Request: `{ "email": "an@example.com", "password": "<user-input>" }`.
- 200: `{ "success": true, "data": { "user": "<User>", "csrf_token": "<new-token>" } }`, backend tái tạo session ID.
- Lỗi: 401 thông tin đăng nhập không đúng (thông báo chung), 422 thiếu/sai dữ liệu, 403 CSRF/tài khoản không được phép, 429 giới hạn tần suất, 500 lỗi máy chủ.

### 9. POST `auth/logout.php` — đăng xuất

- Xác thực: có phiên đăng nhập; bắt buộc CSRF. Request `{}`.
- 200: `{ "success": true, "data": { "message": "Đã đăng xuất." } }`. Backend vô hiệu hóa phiên đăng nhập; API layer xóa CSRF cache trong tab.
- Lỗi: 401 phiên hết hạn, 403 CSRF, 500 lỗi máy chủ.

## Endpoint đơn hàng

### 10. POST `orders.php` — tạo đơn COD

- Xác thực đề xuất: người dùng đăng nhập. Cần thống nhất có cho khách vãng lai mua hàng hay không. CSRF bắt buộc. Không gửi giá/tổng tiền quyết định từ trình duyệt.
- Request:

```json
{
  "items": [ { "variant_id": 101, "quantity": 1 } ],
  "shipping": { "name": "Nguyễn An", "phone": "0901234567", "address": "Địa chỉ giao hàng đầy đủ", "note": "Gọi trước khi giao" },
  "payment_method": "cod"
}
```

- Backend kiểm tra variant tồn tại, đang bán, số lượng nguyên hợp lệ và tồn kho; tính giá/tổng/phí giao hàng từ dữ liệu server; lưu đơn và cập nhật tồn kho trong transaction.
- 201 sau khi lưu thành công thực sự: `{ "success": true, "data": { "id": 123, "code": "NOVA-000123", "status": "pending", "total": 29990000 } }`.
- Lỗi: 401 cần đăng nhập, 403 CSRF, 409 `OUT_OF_STOCK`/giá hoặc tình trạng thay đổi cần xác nhận lại, 422 thông tin giao hàng/sản phẩm sai, 429 giới hạn tần suất, 500 lỗi máy chủ. Có thể trả `error.fields.items`/`error.fields.phone`...
- Frontend chỉ xóa giỏ và chuyển trang xác nhận khi có response thành công chứa mã/ID đơn. Lỗi mạng không được giả định đơn đã hoặc chưa lưu; backend cần cơ chế tra cứu/chống trùng trước production.

### 11. GET `orders.php?page=1&per_page=10` — lịch sử đơn hàng

- Xác thực: bắt buộc. Query phân trang; không body. Backend chỉ lấy đơn của user trong session, không tin user_id do frontend gửi.
- 200: `{ "success": true, "data": { "items": ["<Order>"], "pagination": { "page": 1, "per_page": 10, "total": 1, "total_pages": 1 } } }`.
- Lỗi: 401 phiên hết hạn, 422 query sai, 500 lỗi máy chủ. Không có đơn: `items:[]`.

### 12. GET `order.php?id=123` — chi tiết/theo dõi đơn

- Xác thực: bắt buộc; backend kiểm tra quyền sở hữu. Query `id` bắt buộc; không body.
- 200: `{ "success": true, "data": "<Order>" }`.
- Lỗi: 401 phiên hết hạn, 404 không tồn tại hoặc không thuộc user (tránh tiết lộ đơn người khác), 422 ID sai, 500 lỗi máy chủ.

## Endpoint liên hệ

### 13. POST `contact.php` — gửi lời nhắn

- Xác thực: không bắt buộc; CSRF và kiểm soát tần suất bắt buộc.
- Request: `{ "name": "Nguyễn An", "email": "an@example.com", "phone": "0901234567", "subject": "product", "message": "Tôi cần tư vấn dung lượng bộ nhớ." }`.
- `subject` là enum: `product` (tư vấn sản phẩm), `order` (đơn hàng), `warranty` (bảo hành), `other` (khác). Backend kiểm tra enum; nhãn tiếng Việt chỉ để hiển thị.
- 201 hoặc 200: `{ "success": true, "data": { "message": "Đã nhận lời nhắn của bạn.", "id": 456 } }` sau khi backend ghi nhận thật.
- Lỗi: 422 thiếu/sai trường, 403 CSRF, 429 giới hạn tần suất, 500 lỗi máy chủ. Backend thống nhất cách lưu/gửi mail; frontend không gửi email trực tiếp.

## Mã trạng thái và lỗi dùng chung

| HTTP/code | Ý nghĩa và hành vi frontend |
| --- | --- |
| 200/201 | Thành công; kiểm tra envelope và dữ liệu cần thiết |
| 400 | Request JSON không đọc được |
| 401 `UNAUTHENTICATED` | Mời đăng nhập, giữ giỏ hàng |
| 403 `CSRF_INVALID` / `FORBIDDEN` | Hiển thị lỗi phiên/quyền; không tự gửi lại POST |
| 404 `NOT_FOUND` | Trạng thái không tìm thấy, có đường quay lại |
| 409 `OUT_OF_STOCK` / `EMAIL_EXISTS` | Giữ dữ liệu form/giỏ, thông báo để điều chỉnh |
| 422 `VALIDATION_ERROR` | Hiển thị lỗi theo `error.fields` và thông báo tổng |
| 429 `RATE_LIMITED` | Thông báo chờ và thử lại; backend có thể kèm Retry-After |
| 500/503 | Thông báo dịch vụ chưa sẵn sàng; không coi là thành công |
| 0 `TIMEOUT` / `NETWORK_ERROR` | Lỗi phía kết nối; giữ thông tin nhập và giỏ |
| 0 `INVALID_RESPONSE` | Backend không trả JSON/envelope hợp lệ; không fallback mock |
| 503 `API_NOT_CONFIGURED` | Chế độ mock chưa tích hợp ghi/đọc dữ liệu cá nhân |

## Chế độ mock hiện có

`config.dataSource = 'mock'` đọc `mock/products.json` (250 model, 1.485 variants), `brands.json` (14 thương hiệu), `posts.json` (6 bài). Mock chỉ phục vụ đọc công khai, lọc và phân trang. **Không mô phỏng đăng nhập, đăng ký, session, đặt hàng, lịch sử đơn hay gửi liên hệ thành công.** Các thao tác đó trả `API_NOT_CONFIGURED`; không có tài khoản/đơn MySQL nào được tạo. localStorage chỉ lưu các ID và số lượng giỏ.

Đổi `dataSource` thành `'api'` sau khi backend sẵn sàng, kiểm tra tất cả endpoint dưới Apache/PHP, thử lỗi phiên, CSRF, validation, tồn kho và toàn bộ luồng đặt hàng trước khi xác nhận tích hợp end-to-end. Không dùng dữ liệu mẫu làm nguồn sản phẩm chính trên website bán hàng online.
