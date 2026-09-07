# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: a11y.spec.ts >> a11y: Camera Finder không có vi phạm nghiêm trọng
- Location: tests/e2e/a11y.spec.ts:16:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/camera-finder
Call log:
  - navigating to "http://localhost:3000/camera-finder", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import AxeBuilder from "@axe-core/playwright";
  3  | 
  4  | /** Kiểm tra accessibility tự động với axe-core — giữ chuẩn a11y 100. */
  5  | 
  6  | const PAGES = [
  7  |   { path: "/", name: "Trang chủ" },
  8  |   { path: "/products", name: "Catalogue" },
  9  |   { path: "/products/lumina-x1-monolith", name: "PDP" },
  10 |   { path: "/cart", name: "Giỏ hàng" },
  11 |   { path: "/camera-finder", name: "Camera Finder" },
  12 |   { path: "/journal", name: "Journal" },
  13 | ];
  14 | 
  15 | for (const { path, name } of PAGES) {
  16 |   test(`a11y: ${name} không có vi phạm nghiêm trọng`, async ({ page }) => {
> 17 |     await page.goto(path);
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/camera-finder
  18 |     await page.waitForLoadState("networkidle");
  19 |     const results = await new AxeBuilder({ page })
  20 |       .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  21 |       .analyze();
  22 |     const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  23 |     if (serious.length > 0) {
  24 |       const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`).join("; ");
  25 |       throw new Error(`Vi phạm a11y nghiêm trọng trên ${name}: ${summary}`);
  26 |     }
  27 |   });
  28 | }
  29 | 
```