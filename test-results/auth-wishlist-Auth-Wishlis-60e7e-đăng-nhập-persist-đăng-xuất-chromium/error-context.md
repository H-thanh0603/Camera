# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-wishlist.spec.ts >> Auth & Wishlist >> đăng ký tài khoản, đăng nhập persist, đăng xuất
- Location: tests/e2e/auth-wishlist.spec.ts:4:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('tab', { name: 'Đăng ký' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - link "LUMINA Optics Logo LUMINA OPTICS PRECISION CINEMA APPARATUS" [ref=e5] [cursor=pointer]:
          - /url: /
          - img "LUMINA Optics Logo" [ref=e6]
          - generic [ref=e7]:
            - generic [ref=e8]: LUMINA OPTICS
            - generic [ref=e9]: PRECISION CINEMA APPARATUS
        - generic [ref=e10]: SENSOR 61MP RAW ONLINE
      - generic [ref=e13]:
        - 'generic "Đơn vị tiền tệ: VND" [ref=e14]':
          - button "VND" [pressed] [ref=e15] [cursor=pointer]
          - generic [ref=e16]: /
          - button "USD" [ref=e17] [cursor=pointer]
        - button "Tìm kiếm sản phẩm" [ref=e18] [cursor=pointer]:
          - generic [ref=e19]: search
          - generic [ref=e20]: ⌘K
        - link "Wishlist" [ref=e21] [cursor=pointer]:
          - /url: /wishlist
          - generic [ref=e22]: favorite
        - button "Giỏ hàng trống" [ref=e23] [cursor=pointer]:
          - generic [ref=e24]: shopping_bag
        - link "Tư vấn chuyên gia" [ref=e25] [cursor=pointer]:
          - /url: /account
          - generic [ref=e26]: support_agent
        - link "Đăng nhập / Tài khoản" [ref=e28] [cursor=pointer]:
          - /url: /account
          - generic [ref=e29]: person_outline
    - navigation "Điều hướng chính" [ref=e30]:
      - generic [ref=e31]:
        - link "Máy ảnh Flagship" [ref=e32] [cursor=pointer]:
          - /url: /products?category=camera&tag=flagship
        - link "Ống kính Cine & Prime" [ref=e33] [cursor=pointer]:
          - /url: /products?category=lens
        - link "Hệ thống Medium Format" [ref=e34] [cursor=pointer]:
          - /url: /products?category=camera&tag=medium_format
        - link "Phụ kiện Studio" [ref=e35] [cursor=pointer]:
          - /url: /products?category=lighting
        - link "Dịch vụ Đổi mới & Thu cũ" [ref=e36] [cursor=pointer]:
          - /url: /#concierge
        - link "Lumina Journal" [ref=e37] [cursor=pointer]:
          - /url: /journal
  - main [ref=e38]:
    - generic [ref=e40]:
      - generic [ref=e41]: hourglass_empty
      - heading "Đang tải..." [level=2] [ref=e43]
  - contentinfo [ref=e44]:
    - generic [ref=e45]:
      - generic [ref=e46]:
        - generic [ref=e47]:
          - generic [ref=e48]: LUMINA OPTICS
          - paragraph [ref=e50]: Không gian trưng bày và phân phối thiết bị quang học cine, medium format cao cấp hàng đầu Việt Nam. Mỗi thành phẩm đều trải qua quy trình kiểm chuẩn quang sai nghiêm ngặt với hệ chuẩn collimator công nghiệp.
          - generic [ref=e51]:
            - generic [ref=e52]: "Bảo chứng đối tác ủy quyền:"
            - generic [ref=e53]:
              - generic [ref=e54]: LEICA
              - generic [ref=e55]: "|"
              - generic [ref=e56]: HASSELBLAD
              - generic [ref=e57]: "|"
              - generic [ref=e58]: SONY CINE
        - generic [ref=e59]:
          - generic [ref=e60]: Phân hệ Tuyệt tác
          - list [ref=e61]:
            - listitem [ref=e62]:
              - link "Máy ảnh Medium Format 100MP" [ref=e63] [cursor=pointer]:
                - /url: /products?category=camera&tag=medium_format
            - listitem [ref=e64]:
              - link "Ống kính Cine Anamorphic 2x" [ref=e65] [cursor=pointer]:
                - /url: /products?category=lens&tag=cine
            - listitem [ref=e66]:
              - link "Hệ thống T* Coating Prime T1.3" [ref=e67] [cursor=pointer]:
                - /url: /products?category=lens
            - listitem [ref=e68]:
              - link "Chân máy Carbon Hàng không" [ref=e69] [cursor=pointer]:
                - /url: /products?category=tripod
            - listitem [ref=e70]:
              - link "Thiết bị lưu trữ 8K RAW" [ref=e71] [cursor=pointer]:
                - /url: /products?category=storage
        - generic [ref=e72]:
          - generic [ref=e73]: Đặc quyền Concierge
          - list [ref=e74]:
            - listitem [ref=e75]:
              - link "Lên lịch Trải nghiệm Studio 1:1" [ref=e76] [cursor=pointer]:
                - /url: /camera-finder
            - listitem [ref=e77]:
              - link "Đo quang sai chuẩn MTF" [ref=e78] [cursor=pointer]:
                - /url: /products?category=lens
            - listitem [ref=e79]:
              - link "So sánh hệ thống máy ảnh" [ref=e80] [cursor=pointer]:
                - /url: /compare
            - listitem [ref=e81]:
              - link "Tìm máy ảnh phù hợp" [ref=e82] [cursor=pointer]:
                - /url: /camera-finder
            - listitem [ref=e83]:
              - link "Bảo hành toàn cầu Lumina Care+" [ref=e84] [cursor=pointer]:
                - /url: /#concierge
        - generic [ref=e85]:
          - generic [ref=e86]: Masterclass & Journal
          - paragraph [ref=e87]: Nhận thư tin độc quyền về kỹ thuật điện ảnh và mời tham dự các buổi thẩm định quang học giới hạn.
          - generic [ref=e88]:
            - generic [ref=e89]: Email nhận thư Masterclass
            - textbox "Email nhận thư Masterclass" [ref=e90]:
              - /placeholder: nhập email của bạn...
            - button "Gửi" [ref=e91] [cursor=pointer]
          - generic [ref=e92]:
            - generic [ref=e93]: verified
            - generic [ref=e94]: 100% NHẬP KHẨU CHÍNH NGẠCH NGUYÊN SEAL
      - generic [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]: PATENT NO. VN-OPTIC-8842-X
          - generic [ref=e98]: ISO 9001:2015 CERTIFIED BENCH
          - generic [ref=e99]: CALIBRATED TO ZERO RUNOUT
        - generic [ref=e100]:
          - link "Bảo mật" [ref=e101] [cursor=pointer]:
            - /url: /legal/privacy
          - link "Điều khoản" [ref=e102] [cursor=pointer]:
            - /url: /legal/terms
          - link "Đổi trả" [ref=e103] [cursor=pointer]:
            - /url: /legal/returns
          - generic [ref=e104]: © 2024–2026 LUMINA OPTICS. TOÀN BỘ QUYỀN ĐƯỢC BẢO LƯU. KIẾN TẠO CHO ĐIỆN ẢNH ĐỈNH CAO.
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test.describe("Auth & Wishlist", () => {
  4  |   test("đăng ký tài khoản, đăng nhập persist, đăng xuất", async ({ page }) => {
  5  |     const email = `e2e-${Date.now()}@lumina.vn`;
  6  |     await page.goto("/account");
  7  |     await page.waitForLoadState("networkidle");
  8  | 
> 9  |     await page.getByRole("tab", { name: "Đăng ký" }).click();
     |                                                      ^ Error: locator.click: Test timeout of 60000ms exceeded.
  10 |     await page.getByLabel("Họ và tên").fill("E2E Tester");
  11 |     await page.getByLabel("Email", { exact: true }).fill(email);
  12 |     await page.getByLabel(/Mật khẩu/).fill("matkhau-an-toan-123");
  13 |     await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  14 | 
  15 |     // Header hiện tên user; account page chào mừng
  16 |     await expect(page.getByRole("heading", { name: /Xin chào, E2E Tester/ })).toBeVisible({ timeout: 10_000 });
  17 | 
  18 |     // Persist sau reload
  19 |     await page.reload();
  20 |     await expect(page.getByRole("heading", { name: /Xin chào, E2E Tester/ })).toBeVisible();
  21 | 
  22 |     // Đăng xuất
  23 |     await page.getByRole("button", { name: "Đăng xuất" }).click();
  24 |     await expect(page.getByRole("heading", { name: "Đăng Nhập" })).toBeVisible();
  25 |   });
  26 | 
  27 |   test("wishlist: lưu từ card, hiển thị trong trang wishlist", async ({ page }) => {
  28 |     await page.goto("/products?category=camera");
  29 |     const firstCard = page.getByRole("article").first();
  30 |     const productName = await firstCard.getByRole("heading").textContent();
  31 |     await firstCard.getByRole("button", { name: /Lưu .* vào yêu thích/ }).click();
  32 | 
  33 |     await page.goto("/wishlist");
  34 |     const list = page.getByRole("list").filter({ hasText: "Chuyển vào giỏ" });
  35 |     await expect(list).toBeVisible();
  36 |     await expect(list.getByRole("link", { name: productName! }).first()).toBeVisible();
  37 |     await expect(list.getByText(/Chuyển vào giỏ/)).toBeVisible();
  38 |   });
  39 | });
  40 | 
```