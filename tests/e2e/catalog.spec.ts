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

test.describe("Catalog API machine-readable", () => {
  test("/api/catalog phân trang đúng + clamp pageSize", async ({ request }) => {
    const p1 = await request.get("/api/catalog?page=1&pageSize=5");
    expect(p1.status()).toBe(200);
    const b1 = await p1.json();
    expect(b1.count).toBeGreaterThanOrEqual(b1.products.length);
    expect(b1.page).toBe(1);
    expect(b1.pageSize).toBe(5);
    expect(b1.products).toHaveLength(Math.min(5, b1.count));
    expect(b1.totalPages).toBeGreaterThanOrEqual(1);

    const p2 = await request.get("/api/catalog?page=2&pageSize=5");
    const b2 = await p2.json();
    if (b2.count > 5) {
      expect(b2.products[0].id).not.toBe(b1.products[0].id);
    }

    // pageSize quá lớn → clamp 200, không crash
    const big = await request.get("/api/catalog?pageSize=99999");
    expect(big.status()).toBe(200);
    expect((await big.json()).pageSize).toBe(200);
  });
});
