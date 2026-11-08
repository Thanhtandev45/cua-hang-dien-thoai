# Kiểm thử frontend NOVA Mobile

Ngày: 08/11/2026. Phạm vi nghiệm thu: giao diện và dữ liệu phát triển, chưa có backend PHP/MySQL thật.

## Phân biệt kết quả

| Mức | Ý nghĩa |
| --- | --- |
| UI | Trang và tương tác frontend được triển khai |
| Mock | Hành vi đã thử với JSON mẫu hoặc phản hồi API giả lập |
| API tích hợp | Chỉ ghi sau khi gọi endpoint PHP thật thành công |
| End-to-end | Chỉ ghi sau khi xác thực, tạo đơn, kiểm tra MySQL và quyền truy cập thực tế |

Hiện không có endpoint nào đạt mức “API tích hợp” hoặc “End-to-end”. Kiểm tra adapter bằng phản hồi giả lập không chứng minh backend tồn tại.

## Kết quả đã chạy

- Kiểm tra tĩnh: **PASS**, không lỗi hoặc cảnh báo về đường dẫn/modules/fixtures/SVG/cú pháp trong phạm vi công cụ.
- `node --test tests/api-cart.test.mjs`: **17/17 PASS**. Bao gồm dữ liệu giỏ bị sửa, storage bị chặn, stock/variant không hợp lệ, lọc/sort/phân trang, CSRF, envelope, validation, lỗi mạng và timeout.
- `node tools/browser-smoke.mjs`: **72/72 PASS** trên Chrome headless. Đã mở 14 trang tại mỗi chiều rộng 360/768/1024/1440px, thử các tương tác phía dưới và kiểm tra thêm giỏ/checkout có sản phẩm trên mobile.
- Không ghi nhận JavaScript exception, console error, HTTP tài nguyên lỗi, ảnh hỏng hoặc tràn ngang trong các trường hợp đã chạy; đã kiểm tra từ khóa 120 ký tự trên mobile.
- Đã xem ảnh desktop/mobile cho trang chủ, giỏ, checkout và danh mục mở rộng để rà soát bố cục. Báo cáo máy đọc: `.qa/browser-report.json`; 9 ảnh PNG trong `.qa/`. Những file này được Git bỏ qua.

## Công cụ kiểm tra lặp lại

Chạy tại root repository:

```text
python tools/verify_frontend.py
node --test tests/api-cart.test.mjs
```

`verify_frontend.py` chỉ đọc file; kiểm tra 14 HTML, assets, import modules, cú pháp JavaScript nếu có Node, dữ liệu JSON và tính hợp lệ SVG. `api-cart.test.mjs` dùng Node test runner để kiểm tra bộ lọc, phân trang, dữ liệu giỏ, storage và fetch adapter bằng phản hồi giả lập. Các công cụ này không phải phụ thuộc vận hành website.

Kiểm thử trình duyệt sử dụng Chrome headless đang bật CDP tại cổng 9222 và website được phục vụ tại `http://127.0.0.1:8080`. Khởi động server kiểm thử bằng:

```text
python -m http.server 8080 --bind 127.0.0.1
```

Mở một PowerShell riêng, chạy Chrome với profile kiểm thử riêng và chỉ lắng nghe loopback:

```powershell
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' --headless=new --disable-gpu --no-first-run --no-default-browser-check --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --user-data-dir="$env:TEMP\nova-mobile-browser-qa" about:blank
```

Sau đó chạy:

```text
node tools/browser-smoke.mjs
```

Chrome có thể nằm ở đường dẫn khác tùy máy. Công cụ dùng fetch/WebSocket tích hợp trong Node hiện đại, không cần Playwright hoặc thư viện ngoài. Dữ liệu giỏ trên profile kiểm thử sẽ được thay đổi trong quá trình test; dùng profile riêng. Ảnh và kết quả kiểm thử nằm trong `.qa/`, đã bỏ qua bởi Git. Dừng server và Chrome profile kiểm thử sau khi hoàn tất.

## Checklist giao diện và mock

| Nội dung | Cách kiểm tra | Kết quả hiện tại |
| --- | --- | --- |
| Trang chủ | Hero, thương hiệu, các nhóm sản phẩm/tin, ảnh | Đạt Chrome/mock và rà soát ảnh |
| Header và menu | Search GET, liên kết, mở/đóng mobile, Escape | Đạt Chrome; kiểm tra đường dẫn tĩnh |
| Danh sách | Tìm có/không dấu, thương hiệu, giá, dung lượng, tồn kho | Đạt logic/mock và tương tác Chrome; URL tùy chỉnh/64GB giữ đúng |
| Sort/phân trang | Giá tăng/giảm, tên, mới nhất, đổi trang và URL | Đạt; có hồi quy giá hiển thị theo 256GB ở cả hai chiều |
| Chi tiết | ID đúng/sai, thumbnail, màu/dung lượng, giá/stock | Đạt mock/Chrome; phiên bản hết hàng khóa nút mua |
| Giỏ | Thêm, gộp đúng variant, số lượng, xóa, tải lại | Đạt; modal Giữ lại/Escape/Xác nhận hoạt động |
| Dữ liệu giỏ lỗi | Stock thiếu, variant không tồn tại, storage bị chặn | Đạt test logic; không âm thầm xóa mục lỗi |
| Tổng tiền | Đơn giá × số lượng, tổng các mục, định dạng VND | Đạt logic và Chrome với dữ liệu mẫu |
| Checkout | Form bắt buộc, số điện thoại, địa chỉ, COD, chờ backend | Đạt UI; submit mẫu không tạo đơn hoặc xóa giỏ |
| Auth | Label, invalid, hiện/ẩn mật khẩu, không giả xác thực | Đạt UI; mật khẩu/xác nhận giữ nguyên khoảng trắng |
| Tài khoản/đơn | Trạng thái chờ backend, không dữ liệu cá nhân giả | Đạt trạng thái chờ; dữ liệu thật chưa kiểm chứng |
| Tin tức/liên hệ | Search bài, đọc chi tiết, validation, không báo gửi giả | Đạt; thử từ khóa camera và lựa chọn Tư vấn sản phẩm |
| Responsive | 360px, tablet, laptop, desktop; không tràn ngang | Đạt các viewport đã nêu, gồm giỏ/checkout có sản phẩm |
| Console/tài nguyên | Lỗi JavaScript, ảnh hỏng, HTTP lỗi | Không ghi nhận trong lượt kiểm tra cuối |

## Kiểm thử bắt buộc khi có PHP/MySQL

1. Đổi cấu hình sang `api` trên môi trường Apache tích hợp; xác minh không request fixtures.
2. Tìm/lọc/phân trang bằng query gửi tới PHP với số lượng sản phẩm lớn, không tải toàn database.
3. Đăng ký, trùng email, đăng nhập sai/đúng, session hết hạn, CSRF và đăng xuất. Kiểm tra cookie và quyền ở server.
4. Kiểm tra giá/tồn kho server khác dữ liệu vừa xem; backend từ chối hoặc yêu cầu xác nhận lại. Frontend giữ giỏ khi lỗi.
5. Tạo đơn COD thật; xác minh response ID/code, dữ liệu đã lưu MySQL, tổng/phí do server tính và tồn kho đã cập nhật.
6. Kiểm tra lịch sử/chi tiết đơn của chính user; tài khoản khác không xem được đơn bằng cách đổi ID URL.
7. Gửi liên hệ; xác minh việc lưu/tiếp nhận ở backend trước khi UI hiển thị thành công.
8. Thử 401/403/404/409/422/429/500, mất mạng, timeout, trả HTML thay JSON và nhấn gửi lặp. Không tự giả định đơn chưa lưu sau lỗi mạng.
9. Kiểm tra trên Chrome, Edge, Firefox, Safari/iOS và thiết bị cảm ứng thật; kiểm tra zoom 200%, Tab/Shift+Tab và trình đọc màn hình.

## Giới hạn nghiệm thu

Chưa thử XAMPP/PHP/MySQL thật trong môi trường hiện tại; chưa xác thực quy trình bán hàng hoặc giao dịch. Không dùng kết quả frontend để ghi nhận công việc backend đã hoàn thành. Giá/thông số, chính sách, liên hệ và ảnh hiện là mẫu; phải xác minh trước phát hành.

## Kiểm tra bổ sung khi mở rộng danh mục

`python tools/validate_catalog.py` xác nhận đủ 250 model/14 hãng/1.485 biến thể, ID/slug/SKU không trùng, không giá/tồn kho âm, ảnh tồn tại, JSON chi tiết/index/home khớp master và mọi trường gốc của 20 sản phẩm được giữ nguyên. Cảnh báo có chủ đích: 4 model cũ ID 4/13/14/20 có tuple màu/dung lượng trùng nhưng ID khác, được giữ để không làm hỏng giỏ cũ. Xem `catalog-validation.json`.

Test Node duyệt toàn bộ 250 model qua 5 trang API mock (50 model/trang), kiểm tra đủ 14 bộ lọc hãng, các slug cũ, sắp xếp trên nhiều trang, giỏ chứa đồng thời model cũ/mới và giới hạn tải dữ liệu: trang chủ chỉ lấy JSON nhóm nhỏ, trang 28 chỉ hydrate 7 model. Tổng **17/17 đạt**.

Smoke Chrome mở 14 trang × 4 chiều rộng, kiểm tra bổ sung 8 hãng mới, chi tiết mới, tổng kết quả 250, 7 kết quả trang cuối, OnePlus vào giỏ/cập nhật số lượng/checkout demo và tab Nothing trên trang chủ. Tổng **72/72 đạt**. Ảnh toàn trang được chờ decode để tránh nhầm ảnh lazy chưa vào viewport là ảnh hỏng.

Nghiên cứu nguồn là công việc tách biệt: `tools/check_catalog_sources.py` thử URL HTTPS của hãng và lưu chẩn đoán. HTTP thành công hoặc tìm thấy chuỗi màu/dung lượng không chứng minh đúng cấu hình vùng hay hàng đang bán. Không xem kiểm tra dữ liệu/demo là xác minh thương mại của 1.485 SKU.
