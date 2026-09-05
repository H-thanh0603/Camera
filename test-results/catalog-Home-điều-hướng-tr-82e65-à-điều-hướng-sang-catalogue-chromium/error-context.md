# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: catalog.spec.ts >> Home & điều hướng >> trang chủ hiển thị hero và điều hướng sang catalogue
- Location: tests/e2e/catalog.spec.ts:4:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /Kho Thiết Bị|Kết quả/i, level: 1 })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /Kho Thiết Bị|Kết quả/i, level: 1 })

```

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2]'
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test.describe("Home & điều hướng", () => {
  4  |   test("trang chủ hiển thị hero và điều hướng sang catalogue", async ({ page }) => {
  5  |     await page.goto("/");
  6  |     await expect(page.getByRole("heading", { level: 1 })).toContainText("Nghệ Thuật Thu Nhận Ánh Sáng");
  7  | 
  8  |     await page.getByRole("navigation", { name: "Điều hướng chính" }).getByText("Máy ảnh Flagship").click();
  9  |     await expect(page).toHaveURL(/\/products\?category=camera&tag=flagship/);
> 10 |     await expect(page.getByRole("heading", { level: 1, name: /Kho Thiết Bị|Kết quả/i })).toBeVisible();
     |                                                                                          ^ Error: expect(locator).toBeVisible() failed
  11 |   });
  12 | });
  13 | 
  14 | test.describe("Catalog & filter URL", () => {
  15 |   test("lọc theo brand Leica qua query param", async ({ page }) => {
  16 |     await page.goto("/products?brand=Leica");
  17 |     const cards = page.getByRole("article");
  18 |     const count = await cards.count();
  19 |     expect(count).toBeGreaterThan(0);
  20 |     for (let i = 0; i < count; i++) {
  21 |       await expect(cards.nth(i).getByText(/Leica • /)).toBeVisible();
  22 |     }
  23 |   });
  24 | 
  25 |   test("sort price_asc sắp xếp đúng", async ({ page }) => {
  26 |     await page.goto("/products?sort=price_asc");
  27 |     await expect(page.getByText("thiết bị phù hợp")).toBeVisible();
  28 |   });
  29 | });
  30 | 
```