# Danh mục mở rộng và ánh xạ PHP/MySQL

Ngày cập nhật: 08/11/2026. Đây là dữ liệu phát triển, không phải danh mục hàng hóa đã sẵn sàng mở bán.

## Quy mô trước và sau

| Chỉ tiêu | Trước | Sau |
| --- | ---: | ---: |
| Model điện thoại khác nhau | 20 | 250 |
| Thương hiệu | 6 | 14 |
| Biến thể có ID/SKU riêng | 80 (chưa có SKU) | 1.485 |
| Tổng tồn kho demo | 368 | 16.420 |
| Biến thể hết hàng | Có | 117 |

Không tính màu hoặc dung lượng thành model mới. Nothing có 6 model trong bộ tham khảo này thay cho mục tiêu 10; Samsung có 39 thay cho 35 để tổng vẫn đạt 250 mà không thêm model giả. Đây không phải tuyên bố rằng thương hiệu chỉ sản xuất từng đó model.

| Thương hiệu | Model |
| --- | ---: |
| Apple | 30 |
| Samsung | 39 |
| Xiaomi / Redmi / POCO | 35 |
| OPPO | 25 |
| vivo | 25 |
| realme | 20 |
| HONOR | 15 |
| Google Pixel | 15 |
| OnePlus | 15 |
| Motorola | 10 |
| Nothing | 6 |
| ASUS | 5 |
| Sony Xperia | 5 |
| TECNO | 5 |

## Nguồn chuẩn và artifacts

- `mock/products.json`: master đầy đủ, giữ cấu trúc product/brand/variants cũ. Đây vẫn là nguồn dữ liệu mẫu có thẩm quyền trong repository.
- `mock/brands.json`: giữ nguyên 6 ID/slug cũ, thêm ID 7–14 cho các hãng mới.
- `mock/catalog/index.json`: chỉ mục gọn dùng tìm kiếm/lọc/sắp xếp ở chế độ mock; không chứa mô tả, specs hay gallery. Khoảng 172 KB với bộ dữ liệu hiện tại.
- `mock/catalog/products/{id}.json`: chi tiết từng model; trang danh sách chỉ hydrate trang hiện tại, mặc định 9 model.
- `mock/catalog/home/*.json`: các nhóm 4 model dành riêng cho trang chủ và từng tab thương hiệu. Trang chủ không fetch master hoặc chỉ mục toàn danh mục.
- `tools/catalog_models.csv`: danh sách seed 230 model bổ sung, dung lượng/màu tham khảo, phân khúc và mức giá demo. Không phải bảng giá thị trường.
- `tools/build_catalog.py`: thêm model chưa có, bổ sung SKU còn thiếu và sinh lại index, chi tiết, các nhóm trang chủ. Không thay ID/SKU hoặc nội dung sản phẩm cũ.
- `tests/fixtures/catalog-original.json`: bản chụp 20 sản phẩm/6 thương hiệu trước khi mở rộng, dùng bảo vệ tương thích.
- `docs/catalog-report.json`, `catalog-validation.json`, `catalog-source-audit.json`: số liệu, kiểm tra cấu trúc và chẩn đoán nguồn.

Các artifacts sinh ra đã có sẵn trong repository. Apache/XAMPP phục vụ trực tiếp, không chạy Python/Node lúc khách truy cập. Chỉ cần chạy lại builder khi sửa dữ liệu trong giai đoạn phát triển.

```text
python tools/build_catalog.py
python tools/validate_catalog.py
python tools/verify_frontend.py
node --test tests/api-cart.test.mjs
```

Builder có tính cộng thêm: CSV chỉ thêm model chưa tồn tại, không tự ghi đè model đã có. Muốn sửa thông tin một model mới, sửa master rồi chạy builder để đồng bộ artifacts; rà soát lại test và nguồn. Builder chủ động từ chối khi phát hiện trường dữ liệu gốc của 20 sản phẩm ban đầu bị thay đổi. Chạy lại không sinh thêm ID/SKU trùng.

## Trường dữ liệu và đề xuất ánh xạ

Đây là gợi ý phối hợp, không thay thế schema MySQL của thành viên backend và không thực hiện import database.

| JSON | Ý nghĩa | Ánh xạ đề xuất |
| --- | --- | --- |
| `brand.id`, `brand.name`, `brand.slug` | Thương hiệu; POCO/Redmi thuộc nhóm Xiaomi hiện có | Bảng thương hiệu, unique slug |
| `product.id` | ID model ổn định | Khóa sản phẩm; giữ hoặc lập bảng mapping khi import |
| `slug`, `name` | URL và tên model | Unique slug, quy tắc unique model theo hãng |
| `segment` | budget/midrange/upper-midrange/flagship/gaming/foldable | Thuộc tính/phân khúc sản phẩm |
| `summary`, `description` | Plain text | Trường mô tả; escape khi render |
| `images` | Đường dẫn ảnh minh họa cục bộ | Bảng ảnh hoặc cấu trúc đã thống nhất |
| `specs` | Các thông số dạng key/value | Bảng thuộc tính hoặc JSON; ô trống thành NULL khi phù hợp |
| `featured`, `is_new`, `status` | Cờ trưng bày của danh mục demo | Không coi `is_new` là năm phát hành của nhà sản xuất |
| `variants[].id` | ID biến thể toàn cục | Khóa biến thể, FK tới sản phẩm chứa nó |
| `variants[].sku` | Mã nội bộ NOVA, không phải part number của hãng | Unique SKU; không tái sử dụng cho biến thể khác |
| `color`, `storage` | Cặp lựa chọn của biến thể | Thuộc tính biến thể; giữ ID khi đổi tên hiển thị |
| `price`, `original_price` | Số nguyên VND demo | Giá server sau khi xác minh; không import nguyên để mở bán |
| `stock` | Tồn kho demo theo biến thể | Kho/biến động kho do backend quản lý, transaction khi bán |
| `source_url`, `verification`, `data_quality`, `is_demo` | Nguồn và mức độ kiểm chứng | Metadata hỗ trợ nhập liệu/duyệt dữ liệu |

Không thêm `product_id` lặp lại vào từng variant vì quan hệ cha đã nằm trong JSON lồng nhau. Khi import, lấy ID product hiện tại làm khóa ngoại cho các variant của nó. ID mới tiếp tục quy ước `product_id * 100 + thứ tự`; SKU dạng `NOVA-0021-002101`. SKU chỉ được thêm khi trước đó chưa tồn tại.

## Tương thích dữ liệu cũ

Giữ nguyên tên, slug, ID, variant ID, giá, tồn kho, mô tả, ảnh và thông số gốc. Hai slug cũ có ý nghĩa không rõ ràng do bỏ dấu `+` (`samsung-galaxy-s24`, `realme-12-pro-5g`) vẫn trỏ đúng sản phẩm cũ. Model mới có slug riêng để không chiếm liên kết cũ.

Giỏ hàng vẫn lưu `{product_id, variant_id, quantity}` trong cùng localStorage key, không đổi phiên bản hoặc xóa dữ liệu. Không dùng tên hoặc SKU mới để thay ID giỏ cũ. Các sản phẩm mới và cũ có thể cùng nằm trong một giỏ.

Bộ dữ liệu cũ có 4 model ID **4, 13, 14, 20** chứa các biến thể trùng cặp màu/dung lượng nhưng ID khác nhau. Chúng được giữ nguyên và gắn `data_quality: legacy_unverified`; validator báo cảnh báo riêng. Không gộp/xóa chúng vì giỏ hiện hữu có thể tham chiếu từng ID. Cần thành viên phụ trách dữ liệu duyệt và có phương án mapping trước khi chuyển dữ liệu này sang production.

## Nguồn tham khảo và giới hạn xác minh

Tên model được chọn từ các dòng điện thoại có thật. Cấu hình tham khảo có thể khác theo quốc gia, nhà mạng hoặc đợt bán; **1.485 là số biến thể demo hợp lệ về cấu trúc, không phải 1.485 SKU thị trường đã được xác nhận chính thức**.

Một số nguồn chính đã mở để đối chiếu:

- [Apple: nhận diện các model iPhone, màu và dung lượng](https://support.apple.com/en-gb/108044).
- [Google: thông số phần cứng các đời Pixel](https://support.google.com/pixelphone/answer/7158570?hl=en).
- [Samsung: Galaxy Z Fold6 và Flip6](https://news.samsung.com/global/samsung-galaxy-z-fold-6-and-z-flip-6-elevate-galaxy-ai-to-new-heights).
- [Xiaomi 13: cấu hình và màu](https://www.mi.com/global/product/xiaomi-13/specs/).
- [OPPO Reno11 5G](https://www.oppo.com/en/smartphones/series-reno/reno11/specs/).
- [vivo X100](https://www.vivo.com/en/products/param/x100).
- [realme GT 2 Pro](https://www.realme.com/global/realme-gt-2-pro/specs).
- [HONOR 90](https://www.honor.com/global/phones/honor-90/spec/).
- [OnePlus 12](https://www.oneplus.com/global/12/specs).
- [Motorola edge 50 pro](https://en-us.support.motorola.com/app/answers/detail/a_id/178982/~/specifications---motorola-edge-50-pro).
- [Nothing Phone (1): lựa chọn màu/dung lượng](https://checkout.nothing.tech/products/phone-1).
- [ASUS Zenfone 10](https://www.asus.com/mobile-handhelds/phones/zenfone/zenfone-10/techspec/).
- [Sony Xperia 10 VI](https://www.sony.co.uk/electronics/support/mobile-phones-tablets-mobile-phones/xperia-10-vi/specifications).
- [TECNO POVA 6 Pro 5G](https://www.tecno-mobile.com/phones/tech-specs/techspecs/pova-6-pro-5g/).

Script `tools/check_catalog_sources.py` đã thử 191 URL tham khảo cho 230 model mới: 135 model có trang tải được, 110 có chuỗi tên model xuất hiện; 95 model chưa tải được trang qua URL được thử. Việc tìm thấy một chuỗi không chứng minh đúng từng tổ hợp màu/dung lượng hoặc thị trường; `catalog-source-audit.json` giữ chẩn đoán chi tiết, không gắn cờ “đã xác minh chính hãng” tự động. Các URL chưa truy cập được vẫn là tham chiếu cần rà soát, không phải nguồn đã xác minh.

Thông số màn hình/chip/RAM/pin/camera của model mới chưa được xác minh đầy đủ nên để trống, UI hiển thị “Chưa xác minh”. Giá/khuyến mãi/tồn kho được tạo có chủ đích để thử lọc, giỏ và checkout, tuyệt đối không phải giá bán hiện tại hay tồn kho thật. Mã màu hex phục vụ minh họa SVG, không đại diện mã màu vật liệu chính thức.

## Ảnh minh họa

Các model mới có hình SVG riêng theo model, màu và họ thiết kế tại `assets/images/catalog/`, không dùng ảnh hãng khác gắn tên. Có 680 SVG đang được tham chiếu, tổng khoảng 1,9 MB; mỗi ảnh chỉ vài KB và có tiêu đề/note minh họa. Đây là vector gốc, không lấy ảnh chụp từ hãng hoặc cửa hàng khác. Trang chi tiết không tự gắn thêm ảnh front chung khi model đã có gallery riêng.

## Khi chuyển sang PHP/MySQL

Giữ nguyên endpoint/query/JSON response trong API contract hiện tại. Tham số thứ hai `{homeSection: ...}` của `getProducts` là tối ưu nội bộ mock, không gửi tới PHP. Chế độ `api` tiếp tục để server tìm kiếm, lọc, sắp xếp và phân trang; không tải index/master demo.

Trước khi mở bán: xác minh model và các tổ hợp cấu hình theo thị trường mục tiêu; thay ảnh nếu cần; điền specs có nguồn; duyệt giá, khuyến mãi và tồn kho thật; giải quyết ID legacy bằng mapping; nhập qua quy trình của thành viên backend. Không tự import hoặc ghi đè MySQL trong phiên này. Backend phải tính lại giá, phí và stock, xác thực quyền/session và chỉ trả mã đơn khi đã lưu thành công.
