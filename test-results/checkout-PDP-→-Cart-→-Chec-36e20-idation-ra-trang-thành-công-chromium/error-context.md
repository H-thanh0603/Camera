# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: checkout.spec.ts >> PDP → Cart → Checkout >> checkout đủ 5 bước với validation, ra trang thành công
- Location: tests/e2e/checkout.spec.ts:29:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Đơn hàng đã được ghi nhận')
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText('Đơn hàng đã được ghi nhận')

```

```yaml
- banner:
  - link "LUMINA Optics Logo LUMINA OPTICS PRECISION CINEMA APPARATUS":
    - /url: /
    - img "LUMINA Optics Logo"
    - text: LUMINA OPTICS PRECISION CINEMA APPARATUS
  - text: SENSOR 61MP RAW ONLINE
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
  - button "VND" [pressed]
  - text: /
  - button "USD"
  - button "Tìm kiếm sản phẩm": ⌘K
  - link "Wishlist":
    - /url: /wishlist
  - button "Giỏ hàng — 1 sản phẩm": "1"
  - link "Tư vấn chuyên gia":
    - /url: /account
  - link "Đăng nhập / Tài khoản":
    - /url: /account
- main:
  - text: SECURE CHECKOUT
  - heading "Thanh Toán Bảo Vệ" [level=1]
  - list "Các bước thanh toán":
    - listitem:
      - button "1 Liên hệ"
    - listitem:
      - button "2 Vận chuyển"
    - listitem:
      - button "3 Giao nhận"
    - listitem:
      - button "4 Thanh toán"
    - listitem:
      - button "5 Xác nhận"
  - region "Xác nhận đơn hàng":
    - heading "Xem lại đơn hàng" [level=2]
    - heading "Liên hệ" [level=3]
    - button "Sửa"
    - paragraph: Nguyễn Testing
    - paragraph: testing@lumina.vn
    - paragraph: "0901234567"
    - heading "Vận chuyển" [level=3]
    - button "Sửa"
    - paragraph: 123 Lê Lợi, Bến Nghé
    - paragraph: Quận 1, TP. Hồ Chí Minh
    - paragraph: —
    - heading "Giao nhận" [level=3]
    - button "Sửa"
    - paragraph: Giao chuẩn
    - heading "Thanh toán" [level=3]
    - button "Sửa"
    - paragraph: Chuyển khoản ngân hàng
    - list:
      - listitem: Lumina X-1 Monolith — Body only × 1 185.000.000 ₫
    - alert:
      - paragraph: Không thể đặt hàng do lỗi mạng. Vui lòng thử lại — nếu tiếp tục lỗi, liên hệ concierge qua hotline.
      - button "Thử lại"
    - button "Xác nhận đặt hàng — 185.000.000 ₫"
  - button "Bước trước"
  - complementary "Tổng kết":
    - heading "TỔNG KẾT ĐƠN" [level=2]
    - text: Tạm tính (1 sp) 185.000.000 ₫ Vận chuyển Miễn phí Tổng cộng 185.000.000 ₫
    - paragraph: Bước thanh toán được mã hóa TLS. Đơn hàng chưa được ghi nhận cho đến khi bạn bấm “Xác nhận đặt hàng”.
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
- alert: LUMINA Optics — Thiết Bị Quang Học Cine & Medium Format Cao Cấp
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
  9  |     await expect(page.getByText("SKU: LUM-X1-K50")).toBeVisible();
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
> 63 |     await expect(page.getByText("Đơn hàng đã được ghi nhận")).toBeVisible({ timeout: 15_000 });
     |                                                               ^ Error: expect(locator).toBeVisible() failed
  64 |     await expect(page.getByText(/LUM-/).first()).toBeVisible();
  65 |   });
  66 | });
  67 | 
```