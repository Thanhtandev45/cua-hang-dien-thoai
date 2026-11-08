# Tiến độ frontend NOVA Mobile

Ngày bắt đầu: 08/11/2026. Phạm vi: frontend của thành viên 1; không ghi nhận đóng góp thay thành viên backend.

## Kiểm tra ban đầu

- Repository Git có duy nhất README.md; nhánh ban đầu main; working tree sạch.
- Không có mã backend, schema SQL, API hay cấu trúc frontend tồn tại để ghi đè.
- Công nghệ: HTML5, CSS3, JavaScript ES modules, không cần build; tương thích Apache/XAMPP.
- Tên NOVA Mobile, giá, sản phẩm và nội dung trong chế độ mẫu chỉ phục vụ phát triển.
- Đã chuyển sang nhánh `feature/frontend-storefront`. Không commit, merge hoặc push trong phiên này.

## Kế hoạch và trạng thái

| Giai đoạn | Phạm vi | Trạng thái |
| --- | --- | --- |
| A | Kiểm tra repository, phân chia frontend/backend | Xong |
| B | Design tokens, shell chung, responsive components | UI hoàn thành; đã QA Chrome |
| C | Trang chủ, thương hiệu, sản phẩm, tin tức | UI + mock đã triển khai |
| D | Danh sách, bộ lọc, phân trang, chi tiết, biến thể | UI + mock đã triển khai |
| E | Giỏ hàng, checkout và validation | UI + giỏ mẫu đã triển khai; tạo đơn chờ backend |
| F | Tài khoản, đơn hàng, tin tức, liên hệ | UI đã triển khai; chức năng cá nhân/ghi dữ liệu chờ backend |
| G | Lớp API, dữ liệu mẫu, contract đề xuất | Đã triển khai adapter và tài liệu đề xuất |
| H | Kiểm thử, sửa lỗi, tài liệu bàn giao | Đạt kiểm tra tĩnh, 17 test logic và 72 kiểm tra Chrome |

## Kết quả triển khai và kiểm chứng

- 14 trang HTML: trang chủ, danh sách/chi tiết sản phẩm, giỏ, checkout, đăng nhập, đăng ký, tài khoản, danh sách/chi tiết đơn, tin tức/bài viết, liên hệ và chính sách mẫu.
- Tạo `assets/css/` cho tokens, components, layout và responsive; `assets/js/` cho shell, UI, model chọn biến thể, adapter API và controllers.
- `mock/` có 20 điện thoại, 80 biến thể, 6 thương hiệu, 6 bài viết; SVG minh họa gốc nằm trong `assets/images/`.
- Tạo contract, UI spec, tài liệu kiểm thử/deploy, công cụ kiểm tra tĩnh/trình duyệt và tests API/giỏ; cập nhật README hướng dẫn XAMPP và bàn giao.
- Bộ lọc và thứ tự giá dùng cùng biến thể hiển thị; URL giữ dung lượng/khoảng giá tùy chỉnh. Các bản sửa hồi quy gồm 64GB, từ khóa dài trên mobile, accessibility liên kết tài khoản, mật khẩu có khoảng trắng và option form liên hệ.
- Giỏ lưu ID/variant/quantity; có kiểm tra tồn kho, dữ liệu lỗi, xóa từng mục hoặc xóa giỏ qua modal. Checkout giữ giỏ khi lỗi/chưa có backend; không lưu thông tin cá nhân vào localStorage.
- Đã kiểm thử 14 trang ở 360, 768, 1024 và 1440px trên Chrome headless; kiểm tra thêm giỏ/checkout có sản phẩm ở mobile, modal, forms, navigation và console/tài nguyên. Kết quả: **72/72 đạt**.
- `node --test tests/api-cart.test.mjs`: **17/17 đạt**; adapter live chỉ dùng response giả lập, không phải endpoint PHP thật.

Chi tiết cách chạy lại và giới hạn: `docs/FRONTEND_TESTING.md`. Ảnh/báo cáo QA nằm trong `.qa/` và được Git bỏ qua.

## Chờ backend

Chưa có endpoint PHP/MySQL nào được cung cấp. Không mô phỏng xác thực hoặc tạo đơn thành công. Contract sẽ là đề xuất, cần hai thành viên thống nhất trước khi kết nối thật.

**API tích hợp: chưa có. End-to-end PHP/MySQL: chưa thực hiện.** Frontend không thay đổi hoặc tạo nghiệp vụ backend, admin, PDO hoặc schema SQL. Cần thành viên backend triển khai endpoint/session/CSRF, xác nhận giá/tồn kho server, lưu đơn/liên hệ và kiểm tra quyền sở hữu đơn. Sau đó chuyển cấu hình sang `api` và kiểm thử trên XAMPP/hosting thật theo tài liệu triển khai.

Chưa kiểm tra trên Firefox, Safari/iOS, thiết bị cảm ứng thật hoặc qua trình đọc màn hình. Chưa kiểm chứng bán hàng/hosting production; ảnh, thông số, giá và chính sách mẫu cần thay thế/xác minh trước khi vận hành.

## Cập nhật mở rộng danh mục

- Từ 20 lên 250 model, 6 lên 14 thương hiệu, 80 lên 1.485 biến thể; tồn kho demo từ 368 lên 16.420, gồm 117 biến thể stock=0.
- Bảo toàn mọi trường gốc/ID/slug/variant ID của 20 sản phẩm ban đầu; thêm SKU khi thiếu. Baseline được lưu tại `tests/fixtures/catalog-original.json` để test hồi quy.
- Bổ sung 230 model từ các dòng máy thực tế, phân khúc phổ thông tới flagship, gaming và màn hình gập. Điều chỉnh phân bổ Nothing 6/Samsung 39 để không phải tạo model giả.
- Sinh SVG riêng cho model/màu, index gọn, JSON chi tiết theo ID và 17 nhóm trang chủ. Trang chủ không tải toàn catalog; UI/header/footer/checkout/tài khoản giữ kiến trúc cũ.
- Bộ test logic hiện 17 case, kiểm tra được toàn bộ 250 model qua phân trang/API mock, đủ 14 hãng, SKU/giỏ cũ và mới cùng tồn tại, giới hạn dữ liệu trang chủ và số file chi tiết tải theo trang.
- Kiểm thử Chrome hiện 72/72, gồm danh mục trang 28, các hãng mới, model mới, giỏ/checkout mới, responsive và tài nguyên. Không coi đó là tích hợp PHP/MySQL.
- `tools/validate_catalog.py` kiểm tra cấu trúc; cảnh báo giữ nguyên tùy chọn legacy trùng tại ID 4/13/14/20. Đối chiếu nguồn tự động có giới hạn, không chứng nhận mọi SKU vùng; thông số mới chưa xác minh để trống.
- Chi tiết phân bổ, nguồn, artifacts và đề xuất import: `docs/CATALOG_DATA_MAPPING.md`.
