# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: checkout.spec.ts >> PDP → Cart → Checkout >> thêm variant vào giỏ, đổi số lượng, tổng đúng
- Location: tests/e2e/checkout.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('SKU: LUM-X1-K50')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('SKU: LUM-X1-K50')

```

```yaml
- banner:
  - link "LUMINA Optics Logo LUMINA OPTICS PRECISION CINEMA APPARATUS":
    - /url: /
    - img "LUMINA Optics Logo"
    - text: LUMINA OPTICS PRECISION CINEMA APPARATUS
  - text: SENSOR 61MP RAW ONLINE
  - button "VND" [pressed]
  - text: /
  - button "USD"
  - button "Tìm kiếm sản phẩm": ⌘K
  - link "Wishlist":
    - /url: /wishlist
  - button "Giỏ hàng trống"
  - link "Tư vấn chuyên gia":
    - /url: /account
  - link "Đăng nhập / Tài khoản":
    - /url: /account
  - navigation "Điều hướng chính":
    - link "Máy ảnh Flagship":
      - /url: /products?category=camera&tag=flagship
    - link "Ống kính Cine & Prime":
      - /url: /products?category=lens
    - link "Hệ thống Medium Format":
      - /url: /products?category=camera&tag=medium_format
    - link "Phụ kiện Studio":
      - /url: /products?category=lighting
    - link "Dịch vụ Đổi mới & Thu cũ":
      - /url: /#concierge
    - link "Lumina Journal":
      - /url: /journal
- main:
  - navigation "Breadcrumb":
    - link "Trang chủ":
      - /url: /
    - text: /
    - link "Kho thiết bị":
      - /url: /products
    - text: /Lumina X-1 Monolith
  - button "Phóng to ảnh sản phẩm (NHẤP ĐỂ ZOOM)":
    - img "Lumina X-1 Monolith — thân máy flagship nhìn trực diện"
    - text: NHẤP ĐỂ ZOOM
  - tablist "Ảnh sản phẩm":
    - tab "Lumina X-1 Monolith — thân máy flagship nhìn trực diện" [selected]:
      - img "Lumina X-1 Monolith — thân máy flagship nhìn trực diện"
    - tab "Lumina X-1 trên phiến đá đen với ánh sáng studio":
      - img "Lumina X-1 trên phiến đá đen với ánh sáng studio"
    - tab "Cấu trúc quang học và cảm biến của Lumina X-1":
      - img "Cấu trúc quang học và cảm biến của Lumina X-1"
  - text: Lumina • Mirrorless Flagship
  - heading "Lumina X-1 Monolith" [level=1]
  - img "Đánh giá 4.9 trên 5 sao"
  - text: 4.9 • 47 đánh giá ● Còn hàng
  - paragraph: Flagship 61.2MP BSI, IBIS 8.5 stops, quay 8K 60p ProRes HQ — đỉnh cao quang học thuần khiết.
  - text: "185.000.000 ₫ Trả góp 0% từ 7.700.000 ₫/tháng qua thẻ tín dụng VIP SKU: LUM-X1-BODY"
  - group "Phiên bản":
    - text: Phiên bản
    - button "Body only LUM-X1-BODY 185.000.000 ₫ Còn hàng" [pressed]
    - button "Body + 50mm f/1.2 ASPH LUM-X1-K50 259.000.000 ₫ Còn hàng"
    - button "Cine Pro Kit (RAW 16-bit, PL mount) LUM-X1-CINE 428.000.000 ₫ Đặt trước"
  - button "Giảm số lượng" [disabled]: −
  - spinbutton "Số lượng": "1"
  - button "Tăng số lượng": +
  - button "Thêm Vào Giỏ"
  - button "Mua Ngay"
  - button "Yêu thích"
  - button "So sánh"
  - list:
    - listitem: Bảo hành 5 năm tận nơi, vệ sinh sensor trọn đời
    - listitem: Đổi mới 30 ngày không cần lý do
    - listitem: Đặt lịch test 1:1 tại Studio Quận 1 & Hoàn Kiếm
  - region "Giới thiệu sản phẩm":
    - text: PRODUCT STORYTELLING
    - heading "Vì Sao Nó Sinh Ra" [level=2]
    - paragraph: "Chiến hạm ghi hình của Lumina: cảm biến 61.2MP BSI CMOS full-frame, ngàm hợp kim Magie hàng không, dải tương phản động 15+ EV và hệ thống lấy nét AI 759 điểm. Chế tác thủ công tại Wetzlar & Kyoto cho nhiếp ảnh gia thương mại và điện ảnh hybrid."
    - list:
      - listitem: Độ phân giải 61.2MP cho in ấn cỡ lớn và crop linh hoạt
      - listitem: 8K 60p ProRes HQ — chuẩn điện ảnh trong một thân máy
      - listitem: IBIS 8.5 stops quay tay lúc hoàng hôn không cần gimbal
  - region "Thông số kỹ thuật":
    - heading "Thông Số Kỹ Thuật" [level=2]
    - text: Việt Nam / Wetzlar & Kyoto
    - term: Cảm biến
    - definition: Full-frame BSI CMOS 35.7 × 23.8mm
    - term: Độ phân giải
    - definition: 61.2 MP
    - term: Dải ISO
    - definition: Dual Native ISO 100–102,400 (800/3200)
    - term: Lấy nét tự động
    - definition: 759 điểm phase-detect AI, 0.02s lock
    - term: Chụp liên tiếp
    - definition: 10 fps (máy cơ) / 120 fps (crop APSC)
    - term: Quay video
    - definition: 8K 60p ProRes HQ 16-bit RAW, 2,200 Mbps
    - term: Chống rung IBIS
    - definition: 8.5 stops, 5 trục
    - term: Pin
    - definition: NP-FZ100h — 720 ảnh
    - term: Trọng lượng
    - definition: 712 g (thân máy)
    - term: Kích thước
    - definition: 136 × 97 × 82 mm
    - term: Ngàm mount
    - definition: Lumina LM (PL qua adapter)
    - term: Đường kính filter
    - definition: —
    - heading "What's in the box" [level=3]
    - list:
      - listitem: Thân máy Lumina X-1
      - listitem: Pin NP-FZ100h ×2
      - listitem: Sạc nhanh BC-QZ1
      - listitem: Dai cổ tay nhung
      - listitem: Sách hướng dẫn kỷ niệm Wetzlar
  - region "Đánh giá của khách hàng":
    - heading "Đánh Giá Từ Chủ Nhân (47)" [level=2]
    - img "Đánh giá 4.9 trên 5 sao"
    - text: 4.9/5
    - button "Viết đánh giá"
    - heading "Chưa có đánh giá chi tiết" [level=2]
    - paragraph: Trở thành chủ nhân đầu tiên chia sẻ trải nghiệm về Lumina X-1 Monolith.
  - region "Hoàn thiện bộ thiết bị":
    - text: COMPLETE YOUR SETUP
    - heading "Phụ Kiện Đồng Bộ Khuyến Nghị" [level=2]
    - article:
      - link "Xem chi tiết Lumina 50mm f/1.2 ASPH":
        - /url: /products/lumina-50mm-f12-asph
        - img "Lumina 50mm f/1.2 ASPH"
      - text: MASTER PRIME Còn hàng
      - button "Lưu Lumina 50mm f/1.2 ASPH vào yêu thích"
      - button "Thêm Lumina 50mm f/1.2 ASPH vào so sánh"
      - text: Lumina • Prime
      - img "Đánh giá 4.9 trên 5 sao"
      - text: (38)
      - heading "Lumina 50mm f/1.2 ASPH" [level=3]:
        - link "Lumina 50mm f/1.2 ASPH":
          - /url: /products/lumina-50mm-f12-asph
      - paragraph: Prime 50mm f/1.2, bokeh 11 lá tròn, phủ nano T* truyền sáng 99.8%.
      - text: 62.000.000 ₫ Từ 2.580.000 ₫/tháng
      - button "Thêm Vào Giỏ"
      - link "Chi Tiết":
        - /url: /products/lumina-50mm-f12-asph
    - article:
      - link "Xem chi tiết Lumina 24-70mm f/2.8 Zoom":
        - /url: /products/lumina-24-70mm-f28-zoom
        - img "Lumina 24-70mm f/2.8 Zoom"
      - text: GIẢM 13% Còn hàng
      - button "Lưu Lumina 24-70mm f/2.8 Zoom vào yêu thích"
      - button "Thêm Lumina 24-70mm f/2.8 Zoom vào so sánh"
      - text: Lumina • Zoom
      - img "Đánh giá 4.6 trên 5 sao"
      - text: (41)
      - heading "Lumina 24-70mm f/2.8 Zoom" [level=3]:
        - link "Lumina 24-70mm f/2.8 Zoom":
          - /url: /products/lumina-24-70mm-f28-zoom
      - paragraph: Zoom 24-70mm f/2.8, chống thời tiết IP54, lấy nét tuyến tính.
      - text: 45.500.000 ₫ Từ 1.890.000 ₫/tháng
      - button "Thêm Vào Giỏ"
      - link "Chi Tiết":
        - /url: /products/lumina-24-70mm-f28-zoom
    - article:
      - link "Xem chi tiết CFexpress Type B 512GB (Duo Pack)":
        - /url: /products/cfexpress-type-b-512gb-duo
        - img "CFexpress Type B 512GB"
      - text: Còn hàng
      - button "Lưu CFexpress Type B 512GB (Duo Pack) vào yêu thích"
      - button "Thêm CFexpress Type B 512GB (Duo Pack) vào so sánh"
      - text: Lumina • Thẻ nhớ
      - img "Đánh giá 4.8 trên 5 sao"
      - text: (45)
      - heading "CFexpress Type B 512GB (Duo Pack)" [level=3]:
        - link "CFexpress Type B 512GB (Duo Pack)":
          - /url: /products/cfexpress-type-b-512gb-duo
      - paragraph: Đọc 1,750MB/s, ghi 1,500MB/s — đủ cho 8K RAW.
      - text: 9.800.000 ₫ Từ 408.000 ₫/tháng
      - button "Thêm Vào Giỏ"
      - link "Chi Tiết":
        - /url: /products/cfexpress-type-b-512gb-duo
    - article:
      - link "Xem chi tiết Lumina X-1 Battery Grip":
        - /url: /products/lumina-x1-battery-grip
        - img "Lumina X-1 Battery Grip"
      - text: Còn hàng
      - button "Lưu Lumina X-1 Battery Grip vào yêu thích"
      - button "Thêm Lumina X-1 Battery Grip vào so sánh"
      - text: Lumina • Pin & Grip
      - img "Đánh giá 4.7 trên 5 sao"
      - text: (19)
      - heading "Lumina X-1 Battery Grip" [level=3]:
        - link "Lumina X-1 Battery Grip":
          - /url: /products/lumina-x1-battery-grip
      - paragraph: Grip 2 pin cho X-1, quay 8K gấp đôi thời lượng.
      - text: 7.200.000 ₫ Từ 300.000 ₫/tháng
      - button "Thêm Vào Giỏ"
      - link "Chi Tiết":
        - /url: /products/lumina-x1-battery-grip
  - region "Sản phẩm tương tự":
    - text: YOU MAY ALSO LIKE
    - heading "Tương Tự & Cùng Hệ Sinh Thái" [level=2]
    - article:
      - link "Xem chi tiết Lumina Cine 8K PL":
        - /url: /products/lumina-cine-8k-pl
        - img "Lumina Cine 8K PL"
      - text: CINE MASTER Đặt trước
      - button "Lưu Lumina Cine 8K PL vào yêu thích"
      - button "Thêm Lumina Cine 8K PL vào so sánh"
      - text: Lumina • Cine Camera
      - img "Đánh giá 4.9 trên 5 sao"
      - text: (11)
      - heading "Lumina Cine 8K PL" [level=3]:
        - link "Lumina Cine 8K PL":
          - /url: /products/lumina-cine-8k-pl
      - paragraph: 8K RAW 16-bit, PL mount, genlock timecode cho set phim chuyên nghiệp.
      - text: 360.000.000 ₫ Từ 15.000.000 ₫/tháng
      - button "Đặt Trước"
      - link "Chi Tiết":
        - /url: /products/lumina-cine-8k-pl
    - article:
      - link "Xem chi tiết Sony Alpha 1 II":
        - /url: /products/sony-alpha-1-ii
        - img "Sony Alpha 1 II"
      - text: MỚI 2025 Còn hàng
      - button "Lưu Sony Alpha 1 II vào yêu thích"
      - button "Thêm Sony Alpha 1 II vào so sánh"
      - text: Sony • Mirrorless Flagship
      - img "Đánh giá 4.8 trên 5 sao"
      - text: (54)
      - heading "Sony Alpha 1 II" [level=3]:
        - link "Sony Alpha 1 II":
          - /url: /products/sony-alpha-1-ii
      - paragraph: 30fps blackout-free, AI subject recognition, 8K 60p.
      - text: 169.500.000 ₫ Từ 7.050.000 ₫/tháng
      - button "Thêm Vào Giỏ"
      - link "Chi Tiết":
        - /url: /products/sony-alpha-1-ii
    - article:
      - link "Xem chi tiết Hasselblad 907X & CFV 100C":
        - /url: /products/hasselblad-907x-cfv-100c
        - img "Hasselblad 907X & CFV 100C"
      - text: SẴN HÀNG VAULT Còn hàng
      - button "Lưu Hasselblad 907X & CFV 100C vào yêu thích"
      - button "Thêm Hasselblad 907X & CFV 100C vào so sánh"
      - text: Hasselblad • Medium Format
      - img "Đánh giá 4.9 trên 5 sao"
      - text: (18)
      - heading "Hasselblad 907X & CFV 100C" [level=3]:
        - link "Hasselblad 907X & CFV 100C":
          - /url: /products/hasselblad-907x-cfv-100c
      - paragraph: Back 100MP gắn trên thân cơ khí cổ điển, 1TB SSD tích hợp.
      - text: 215.000.000 ₫ Từ 8.950.000 ₫/tháng
      - button "Thêm Vào Giỏ"
      - link "Chi Tiết":
        - /url: /products/hasselblad-907x-cfv-100c
- contentinfo:
  - text: LUMINA OPTICS
  - paragraph: Không gian trưng bày và phân phối thiết bị quang học cine, medium format cao cấp hàng đầu Việt Nam. Mỗi thành phẩm đều trải qua quy trình kiểm chuẩn quang sai nghiêm ngặt với hệ chuẩn collimator công nghiệp.
  - text: "Bảo chứng đối tác ủy quyền: LEICA | HASSELBLAD | SONY CINE Phân hệ Tuyệt tác"
  - list:
    - listitem:
      - link "Máy ảnh Medium Format 100MP":
        - /url: /products?category=camera&tag=medium_format
    - listitem:
      - link "Ống kính Cine Anamorphic 2x":
        - /url: /products?category=lens&tag=cine
    - listitem:
      - link "Hệ thống T* Coating Prime T1.3":
        - /url: /products?category=lens
    - listitem:
      - link "Chân máy Carbon Hàng không":
        - /url: /products?category=tripod
    - listitem:
      - link "Thiết bị lưu trữ 8K RAW":
        - /url: /products?category=storage
  - text: Đặc quyền Concierge
  - list:
    - listitem:
      - link "Lên lịch Trải nghiệm Studio 1:1":
        - /url: /camera-finder
    - listitem:
      - link "Đo quang sai chuẩn MTF":
        - /url: /products?category=lens
    - listitem:
      - link "So sánh hệ thống máy ảnh":
        - /url: /compare
    - listitem:
      - link "Tìm máy ảnh phù hợp":
        - /url: /camera-finder
    - listitem:
      - link "Bảo hành toàn cầu Lumina Care+":
        - /url: /#concierge
  - text: Masterclass & Journal
  - paragraph: Nhận thư tin độc quyền về kỹ thuật điện ảnh và mời tham dự các buổi thẩm định quang học giới hạn.
  - text: Email nhận thư Masterclass
  - textbox "Email nhận thư Masterclass":
    - /placeholder: nhập email của bạn...
  - button "Gửi"
  - text: 100% NHẬP KHẨU CHÍNH NGẠCH NGUYÊN SEAL PATENT NO. VN-OPTIC-8842-X ISO 9001:2015 CERTIFIED BENCH CALIBRATED TO ZERO RUNOUT
  - link "Bảo mật":
    - /url: /legal/privacy
  - link "Điều khoản":
    - /url: /legal/terms
  - link "Đổi trả":
    - /url: /legal/returns
  - text: © 2024–2026 LUMINA OPTICS. TOÀN BỘ QUYỀN ĐƯỢC BẢO LƯU. KIẾN TẠO CHO ĐIỆN ẢNH ĐỈNH CAO.
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test.describe("PDP → Cart → Checkout", () => {
  4  |   test("thêm variant vào giỏ, đổi số lượng, tổng đúng", async ({ page }) => {
  5  |     await page.goto("/products/lumina-x1-monolith");
  6  | 
  7  |     // Chọn variant kit (giá 259.000.000)
  8  |     await page.getByRole("button", { name: /Body \+ 50mm f\/1.2 ASPH/ }).click();
> 9  |     await expect(page.getByText("SKU: LUM-X1-K50")).toBeVisible();
     |                                                     ^ Error: expect(locator).toBeVisible() failed
  10 | 
  11 |     // Tăng số lượng lên 2 rồi thêm vào giỏ (CTA chính trong panel mua hàng)
  12 |     await page.getByRole("button", { name: "Tăng số lượng" }).click();
  13 |     await page.getByRole("button", { name: /Thêm Vào Giỏ/ }).first().click();
  14 | 
  15 |     const drawer = page.getByRole("dialog", { name: "Giỏ hàng" });
  16 |     await expect(drawer).toBeVisible();
  17 |     await expect(drawer.getByText("Lumina X-1 Monolith")).toBeVisible();
  18 |     await expect(drawer.getByText("518.000.000 ₫").first()).toBeVisible();
  19 | 
  20 |     await drawer.getByRole("link", { name: "Xem giỏ hàng" }).click();
  21 |     await expect(page).toHaveURL(/\/cart/);
  22 |     await expect(page.getByText("518.000.000 ₫").first()).toBeVisible();
  23 | 
  24 |     // Giảm về 1
  25 |     await page.getByRole("button", { name: /Giảm số lượng/ }).click();
  26 |     await expect(page.getByText("259.000.000 ₫").first()).toBeVisible();
  27 |   });
  28 | 
  29 |   test("checkout đủ 5 bước với validation, ra trang thành công", async ({ page }) => {
  30 |     await page.goto("/products/lumina-x1-monolith");
  31 |     await page.getByRole("button", { name: /Thêm Vào Giỏ/ }).first().click();
  32 | 
  33 |     const drawer = page.getByRole("dialog", { name: "Giỏ hàng" });
  34 |     await drawer.getByRole("link", { name: "Thanh toán" }).click();
  35 |     await expect(page).toHaveURL(/\/checkout/);
  36 | 
  37 |     // Step 1: validation chặn submit rỗng
  38 |     await page.getByRole("button", { name: "Tiếp tục" }).click();
  39 |     await expect(page.getByText("Họ tên là bắt buộc.")).toBeVisible();
  40 | 
  41 |     await page.getByLabel("Họ và tên").fill("Nguyễn Testing");
  42 |     await page.getByLabel("Email", { exact: true }).fill("testing@lumina.vn");
  43 |     await page.getByLabel("Số điện thoại").fill("0901234567");
  44 |     await page.getByRole("button", { name: "Tiếp tục" }).click();
  45 | 
  46 |     // Step 2: địa chỉ
  47 |     await page.getByLabel("Địa chỉ").fill("123 Lê Lợi");
  48 |     await page.getByLabel("Phường/xã").fill("Bến Nghé");
  49 |     await page.getByLabel("Quận/huyện").fill("Quận 1");
  50 |     await page.getByLabel("Tỉnh/thành").fill("TP. Hồ Chí Minh");
  51 |     await page.getByRole("button", { name: "Tiếp tục" }).click();
  52 | 
  53 |     // Step 3: giao nhận (mặc định Giao chuẩn)
  54 |     await page.getByRole("button", { name: "Tiếp tục" }).click();
  55 | 
  56 |     // Step 4: thanh toán (mặc định chuyển khoản)
  57 |     await page.getByRole("button", { name: "Tiếp tục" }).click();
  58 | 
  59 |     // Step 5: xác nhận
  60 |     await expect(page.getByText("Nguyễn Testing")).toBeVisible();
  61 |     await page.getByRole("button", { name: /Xác nhận đặt hàng/ }).click();
  62 | 
  63 |     // Chấp nhận trường hợp lỗi mạng giả lập → bấm "Thử lại" (cũng test luôn UX retry)
  64 |     const success = page.getByText("Đơn hàng đã được ghi nhận");
  65 |     const networkError = page.getByRole("alert").filter({ hasText: "Không thể đặt hàng" });
  66 |     for (let i = 0; i < 5; i++) {
  67 |       if (await success.isVisible().catch(() => false)) break;
  68 |       if (await networkError.isVisible().catch(() => false)) {
  69 |         await page.getByRole("button", { name: "Thử lại" }).click();
  70 |         continue;
  71 |       }
  72 |       await page.waitForTimeout(500);
  73 |     }
  74 |     await expect(success).toBeVisible({ timeout: 15_000 });
  75 |     await expect(page.getByText(/LUM-/).first()).toBeVisible();
  76 |   });
  77 | });
  78 | 
```