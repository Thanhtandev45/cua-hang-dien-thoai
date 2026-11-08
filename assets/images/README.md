# Hình ảnh minh họa NOVA Mobile

Các SVG trong thư mục này được tạo riêng bằng mã vector cho bản frontend demo. Không dùng ảnh ngoài, logo hãng, script, font từ xa hoặc dữ liệu raster nhúng.

Các hình thể hiện thiết bị và màu sắc theo cách minh họa, không phải ảnh chụp chính thức, bản vẽ kỹ thuật, hoặc cam kết về thiết kế thực tế của nhà sản xuất. Dữ liệu sản phẩm mẫu có thể sử dụng chung hình minh họa. Khi tích hợp dữ liệu thật, backend cần trả URL ảnh sản phẩm đã có quyền sử dụng.

- `*-*.svg`: hình sản phẩm, nền trong suốt.
- `hero-phones.svg`: ảnh banner, nền trong suốt.
- `phone-front.svg`: góc nhìn màn hình.
- `editorial-*.svg`: hình minh họa nội dung biên tập.
- `fallback.svg`: ảnh thay thế an toàn khi nguồn ảnh không hợp lệ.

# Danh mục mở rộng

Thư mục `catalog/` bổ sung SVG riêng cho từng model/màu mới, sinh bởi hàm `illustration` trong `tools/build_catalog.py`. Đây là vector gốc với bố cục thống nhất, kiểu cụm camera, màu và màn hình minh họa khác nhau theo dòng máy; không chứa ảnh chụp, logo hãng hoặc tài nguyên ngoài.

Chú thích `NOVA · MINH HỌA` và title SVG xác định đây không phải ảnh chính hãng. Các hình cũ ngoài thư mục `catalog/` được giữ nguyên. Không suy ra thông số phần cứng hoặc màu vật liệu chính xác từ hình minh họa.

