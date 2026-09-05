# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-wishlist.spec.ts >> Auth & Wishlist >> wishlist: lưu từ card, hiển thị trong trang wishlist
- Location: tests/e2e/auth-wishlist.spec.ts:27:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('list').filter({ hasText: 'Chuyển vào giỏ' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('list').filter({ hasText: 'Chuyển vào giỏ' })

```

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2]'
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
  9  |     await page.getByRole("tab", { name: "Đăng ký" }).click();
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
> 35 |     await expect(list).toBeVisible();
     |                        ^ Error: expect(locator).toBeVisible() failed
  36 |     await expect(list.getByRole("link", { name: productName! }).first()).toBeVisible();
  37 |     await expect(list.getByText(/Chuyển vào giỏ/)).toBeVisible();
  38 |   });
  39 | });
  40 | 
```