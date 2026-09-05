import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** Kiểm tra accessibility tự động với axe-core — giữ chuẩn a11y 100. */

const PAGES = [
  { path: "/", name: "Trang chủ" },
  { path: "/products", name: "Catalogue" },
  { path: "/products/lumina-x1-monolith", name: "PDP" },
  { path: "/cart", name: "Giỏ hàng" },
  { path: "/camera-finder", name: "Camera Finder" },
  { path: "/journal", name: "Journal" },
];

for (const { path, name } of PAGES) {
  test(`a11y: ${name} không có vi phạm nghiêm trọng`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    if (serious.length > 0) {
      const summary = serious.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`).join("; ");
      throw new Error(`Vi phạm a11y nghiêm trọng trên ${name}: ${summary}`);
    }
  });
}
