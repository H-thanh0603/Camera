# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reviews.spec.ts >> Review submission >> gửi review hợp lệ → hiện trạng thái chờ kiểm duyệt
- Location: tests/e2e/reviews.spec.ts:4:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Viết đánh giá' })

```

# Page snapshot

```yaml
- 'heading "Application error: a client-side exception has occurred while loading localhost (see the browser console for more information)." [level=2] [ref=e4]'
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | test.describe("Review submission", () => {
  4  |   test("gửi review hợp lệ → hiện trạng thái chờ kiểm duyệt", async ({ page }) => {
  5  |     await page.goto("/products/lumina-x1-monolith");
  6  |     await page.waitForLoadState("networkidle");
  7  | 
> 8  |     await page.getByRole("button", { name: "Viết đánh giá" }).click();
     |                                                               ^ Error: locator.click: Test timeout of 60000ms exceeded.
  9  |     await page.getByRole("button", { name: "4 sao" }).click();
  10 |     await page.getByLabel("Tiêu đề").fill("Trải nghiệm rất tốt");
  11 |     await page.getByLabel(/Nội dung/).fill("Máy dùng ổn định, lấy nét nhanh, đáng đầu tư cho công việc chuyên nghiệp.");
  12 |     await page.getByLabel(/Tên của bạn/).fill("E2E Reviewer");
  13 | 
  14 |     await page.getByRole("button", { name: "Gửi đánh giá" }).click();
  15 | 
  16 |     await expect(page.getByText("đang chờ kiểm duyệt")).toBeVisible({ timeout: 15_000 });
  17 |     await expect(page.getByText("CHỜ KIỂM DUYỆT").first()).toBeVisible();
  18 |   });
  19 | 
  20 |   test("validation chặn review không hợp lệ", async ({ page }) => {
  21 |     await page.goto("/products/lumina-x1-monolith");
  22 |     await page.waitForLoadState("networkidle");
  23 | 
  24 |     await page.getByRole("button", { name: "Viết đánh giá" }).click();
  25 |     await page.getByRole("button", { name: "Gửi đánh giá" }).click();
  26 | 
  27 |     await expect(page.getByText("Vui lòng chọn số sao từ 1 đến 5.")).toBeVisible();
  28 |     await expect(page.getByText("Tiêu đề cần tối thiểu 4 ký tự.")).toBeVisible();
  29 |   });
  30 | });
  31 | 
```