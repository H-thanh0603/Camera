# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> Admin panel >> không đăng nhập → màn khóa; customer thường → vẫn bị chặn
- Location: tests/e2e/admin.spec.ts:15:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Chỉ Admin Mới Vào Được')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Chỉ Admin Mới Vào Được')

```

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2]'
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | const ADMIN = { email: "admin@lumina.vn", password: "admin-lumina-2026" };
  4  | 
  5  | async function adminLogin(page: import("@playwright/test").Page) {
  6  |   await page.goto("/account");
  7  |   await page.waitForLoadState("networkidle");
  8  |   await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  9  |   await page.getByLabel(/Mật khẩu/).fill(ADMIN.password);
  10 |   await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  11 |   await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible({ timeout: 10_000 });
  12 | }
  13 | 
  14 | test.describe("Admin panel", () => {
  15 |   test("không đăng nhập → màn khóa; customer thường → vẫn bị chặn", async ({ page }) => {
  16 |     await page.goto("/admin");
> 17 |     await expect(page.getByText("Chỉ Admin Mới Vào Được")).toBeVisible();
     |                                                            ^ Error: expect(locator).toBeVisible() failed
  18 | 
  19 |     // customer thường (không phải admin) cũng bị chặn
  20 |     const email = `cust-${Date.now()}@lumina.vn`;
  21 |     await page.goto("/account");
  22 |     await page.waitForLoadState("networkidle");
  23 |     await page.getByRole("tab", { name: "Đăng ký" }).click();
  24 |     await page.getByLabel("Họ và tên").fill("Khach Thuong");
  25 |     await page.getByLabel("Email", { exact: true }).fill(email);
  26 |     await page.getByLabel(/Mật khẩu/).fill("matkhau-12345");
  27 |     await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  28 |     await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible({ timeout: 10_000 });
  29 | 
  30 |     await page.goto("/admin");
  31 |     await expect(page.getByText("Chỉ Admin Mới Vào Được")).toBeVisible();
  32 |   });
  33 | 
  34 |   test("admin: dashboard → tạo sản phẩm mới → hiện trên catalogue → xóa", async ({ page }) => {
  35 |     await adminLogin(page);
  36 | 
  37 |     await page.goto("/admin");
  38 |     await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
  39 | 
  40 |     const slug = `test-product-${Date.now()}`;
  41 |     await page.goto("/admin/products");
  42 |     await page.getByRole("button", { name: "+ Thêm mới" }).click();
  43 |     await page.getByLabel("Tên", { exact: true }).fill("Máy Ảnh Test E2E");
  44 |     await page.getByLabel("Slug", { exact: true }).fill(slug);
  45 |     await page.getByLabel("SKU", { exact: true }).fill(`E2E-${Date.now()}`);
  46 |     await page.getByLabel("Giá (₫)", { exact: true }).fill("99000000");
  47 |     await page.getByLabel("Mô tả ngắn", { exact: true }).fill("Sản phẩm test từ E2E admin suite.");
  48 |     await page.getByLabel("Mô tả đầy đủ", { exact: true }).fill("Mô tả đầy đủ cho sản phẩm test E2E — dùng để xác minh luồng admin CRUD.");
  49 |     await page.getByRole("button", { name: "Lưu sản phẩm" }).click();
  50 | 
  51 |     await expect(page.getByText("Đã tạo sản phẩm mới.")).toBeVisible({ timeout: 10_000 });
  52 | 
  53 |     // Sản phẩm mới hiện trên catalogue (revalidatePath)
  54 |     await page.goto(`/products/${slug}`);
  55 |     await expect(page.getByRole("heading", { level: 1, name: "Máy Ảnh Test E2E" })).toBeVisible({ timeout: 15_000 });
  56 | 
  57 |     // Xóa
  58 |     await page.goto("/admin/products");
  59 |     const row = page.getByRole("row").filter({ hasText: "Máy Ảnh Test E2E" });
  60 |     page.once("dialog", (dialog) => dialog.accept());
  61 |     await row.getByRole("button", { name: "Xóa" }).click();
  62 |     await expect(page.getByText("Đã xóa sản phẩm.")).toBeVisible({ timeout: 10_000 });
  63 |   });
  64 | 
  65 |   test("admin: đổi trạng thái đơn hàng trong quản trị đơn", async ({ page }) => {
  66 |     await adminLogin(page);
  67 |     await page.goto("/admin/orders");
  68 |     await page.waitForLoadState("networkidle");
  69 | 
  70 |     const selects = page.getByRole("combobox");
  71 |     const count = await selects.count();
  72 |     if (count > 0) {
  73 |       await selects.first().selectOption("processing");
  74 |       // select giữ giá trị mới
  75 |       await expect(selects.first()).toHaveValue("processing");
  76 |     }
  77 |   });
  78 | });
  79 | 
```