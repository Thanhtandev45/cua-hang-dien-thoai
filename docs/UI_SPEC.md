# Đặc tả giao diện NOVA Mobile

Tài liệu cho frontend phát triển ngày 08/11/2026. NOVA Mobile là nhận diện mẫu của dự án nhóm; sản phẩm, giá, hình minh họa và chính sách trong chế độ `mock` không phải thông tin bán hàng đã xác minh.

## Hệ thống thiết kế

Nguồn token: `assets/css/variables.css`.

| Token | Giá trị | Vai trò |
| --- | --- | --- |
| `--primary` | `#153A68` | Navy nhận diện, tiêu đề và thanh thông báo |
| `--accent` | `#2563EB` | Hành động chính, liên kết và lựa chọn |
| `--accent-dark` | `#1D4ED8` | Tương tác với hành động chính |
| `--background` | `#FFFFFF` | Nền chính |
| `--surface` | `#F3F6FA` | Nền phụ, khối lọc và vùng sản phẩm |
| `--text` | `#172033` | Nội dung chính |
| `--muted` | `#64748B` | Thông tin phụ |
| `--sale` | `#D73740` | Giá ưu đãi và thông báo lỗi |
| `--success` | `#157347` | Trạng thái tích cực |
| `--border` | `#E4E9F0` | Ranh giới và viền |
| `--radius` / `--radius-sm` | `14px` / `8px` | Card, panel và control |
| `--container` | `1240px` | Chiều rộng nội dung tối đa |

Font hệ thống `Segoe UI, Arial, sans-serif` hỗ trợ tiếng Việt, không tải font bên ngoài. Nội dung cơ bản `15px/1.6`; `h1` dùng `clamp(30px, 3.5vw, 46px)`, `h2` dùng `clamp(24px, 2.4vw, 30px)`. Giá sản phẩm được định dạng VND bằng JavaScript. Font nhỏ chỉ dành cho nhãn và thông tin phụ.

`base.css` chứa reset, typography, container, hỗ trợ focus và reduced motion; `layout.css` chứa header, navigation, footer và bố cục chia cột; `components.css` chứa control và trạng thái dùng chung; `pages.css` chứa home/catalog/detail; `customer.css` bổ sung giao diện tài khoản, checkout và nội dung; `responsive.css` điều chỉnh màn hình nhỏ. Không cần biên dịch CSS.

## Thành phần chung

- Shell do `assets/js/app.js` dựng vào `#site-header` và `#site-footer`; mỗi trang có `main#main`, skip link và `body[data-page]` để chọn controller.
- Header gồm nhận diện, form tìm kiếm GET tới `products.html`, tài khoản, giỏ hàng có số lượng, navigation và menu mobile.
- Chế độ mẫu hiển thị dải “BẢN TRẢI NGHIỆM”; không mô tả việc đăng nhập, gửi liên hệ hoặc đặt hàng là đã hoàn thành khi chưa gọi backend thật.
- `ui.js` cung cấp icon SVG nội bộ, breadcrumb, product card, tiền tệ, toast, skeleton, empty state, lỗi, modal xác nhận và helper escape dữ liệu. Modal dùng `dialog` gốc để giữ focus, hỗ trợ Escape và trả focus về thao tác mở khi đóng.
- Product card dùng hình minh họa chứa trọn thiết bị, thông tin thương hiệu, tên, phiên bản, giá, ưu đãi, tồn kho và thao tác thêm giỏ. Mã định danh sản phẩm/biến thể phục vụ giỏ hàng.
- `catalog-model.js` chọn biến thể khớp đồng thời bộ lọc, ưu tiên phiên bản còn hàng có giá thấp nhất; card và thứ tự giá dùng cùng quy tắc. Liên kết chi tiết giữ ID biến thể đã hiển thị.
- Lỗi tải dữ liệu có thông báo dễ hiểu và thao tác thử lại. Kết quả rỗng hướng người dùng thay đổi bộ lọc hoặc quay về sản phẩm.
- Form có label, input type phù hợp, trạng thái invalid và thông báo chờ khi gửi. Mật khẩu có điều khiển hiện/ẩn; không lưu thông tin xác thực vào localStorage.

## Trang và luồng sử dụng

| Trang | Thành phần chính |
| --- | --- |
| `index.html` | Hero, thương hiệu, bộ sưu tập sản phẩm, ưu đãi và bài viết |
| `products.html` | Tìm kiếm, thương hiệu, khoảng giá, dung lượng, tồn kho, sắp xếp và phân trang |
| `product.html?id=…` | Gallery, màu/dung lượng, giá/tồn kho theo biến thể, số lượng, mua ngay, thông số và liên quan |
| `cart.html` | Sản phẩm/biến thể, số lượng, xóa, tổng hiển thị và trạng thái trống |
| `checkout.html` | Thông tin giao hàng, COD, kiểm tra form và tóm tắt giỏ |
| `login.html`, `register.html` | Form tài khoản, validation và lỗi từ API |
| `account.html` | Phiên người dùng từ server và điều hướng tài khoản |
| `orders.html`, `order.html?id=…` | Danh sách/chi tiết đơn do backend xác thực quyền |
| `news.html`, `article.html?id=…` | Tìm bài viết, phân trang và nội dung chi tiết |
| `contact.html` | Thông tin hỗ trợ mẫu và form liên hệ |
| `policy.html` | Chính sách minh họa với anchor giao hàng, bảo hành và bảo mật |

Thông tin động chỉ được chèn sau khi escape, hoặc thông qua DOM/textContent. Ảnh được giới hạn nguồn phù hợp và có ảnh fallback. SVG sản phẩm là hình minh họa riêng, không chứa logo hãng; xem `assets/images/README.md`.

## Responsive và bàn phím

Các breakpoint hiện tại: `1150px`, `900px`, `640px`; điều chỉnh từ desktop xuống mobile, mục tiêu nhỏ nhất `360px`.

- Desktop có header rộng, danh sách sản phẩm nhiều cột và sidebar bộ lọc; tóm tắt giỏ có thể sticky.
- Tablet giảm số cột, ẩn nội dung header phụ và đưa checkout/giỏ về một cột khi cần.
- Mobile chuyển tìm kiếm xuống hàng riêng, menu thu gọn, bộ lọc có nút mở/đóng, lưới sản phẩm hai cột, trang chi tiết một cột và form một cột.
- Nội dung dài cần xuống dòng, ảnh không vượt container, không dùng chiều rộng cố định gây cuộn ngang.
- Tương tác chính dùng `button`, `a`, input/select gốc; focus có outline, menu có `aria-expanded`/`aria-controls` và hỗ trợ Escape; toast dùng live region.
- `prefers-reduced-motion` giảm chuyển động. Tôn trọng phóng to văn bản, độ tương phản và thao tác Tab/Shift+Tab khi nghiệm thu.

## Phân biệt trạng thái nghiệm thu

Đặc tả này mô tả thiết kế và hành vi cần duy trì. Không phải bằng chứng đã chạy trình duyệt hoặc đã tích hợp PHP/MySQL. Kết quả kiểm tra thực tế và những bước cần thử thủ công được ghi tại `docs/FRONTEND_TESTING.md`; tình trạng API nằm trong `docs/FRONTEND_PROGRESS.md`.
