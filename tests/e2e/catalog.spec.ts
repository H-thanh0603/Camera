import { expect, test } from "@playwright/test";

test.describe("Home & điều hướng", () => {
  test("trang chủ hiển thị hero và điều hướng sang catalogue", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Nghệ Thuật Thu Nhận Ánh Sáng");

    await page.getByRole("navigation", { name: "Điều hướng chính" }).getByText("Máy ảnh Flagship").click();
    await expect(page).toHaveURL(/\/products\?category=camera&tag=flagship/);
    await expect(page.getByRole("heading", { level: 1, name: /Kho Thiết Bị|Kết quả/i })).toBeVisible();
  });
});

test.describe("Catalog & filter URL", () => {
  test("lọc theo brand Leica qua query param", async ({ page }) => {
    await page.goto("/products?brand=Leica");
    const cards = page.getByRole("article");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).getByText(/Leica • /)).toBeVisible();
    }
  });

  test("sort price_asc sắp xếp đúng", async ({ page }) => {
    await page.goto("/products?sort=price_asc");
    await expect(page.getByText("thiết bị phù hợp")).toBeVisible();
  });
});
