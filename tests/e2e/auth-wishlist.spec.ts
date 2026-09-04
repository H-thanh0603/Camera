import { expect, test } from "@playwright/test";

test.describe("Auth & Wishlist", () => {
  test("đăng ký tài khoản, đăng nhập persist, đăng xuất", async ({ page }) => {
    const email = `e2e-${Date.now()}@lumina.vn`;
    await page.goto("/account");
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: "Đăng ký" }).click();
    await page.getByLabel("Họ và tên").fill("E2E Tester");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel(/Mật khẩu/).fill("matkhau-an-toan-123");
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();

    // Header hiện tên user; account page chào mừng
    await expect(page.getByRole("heading", { name: /Xin chào, E2E Tester/ })).toBeVisible({ timeout: 10_000 });

    // Persist sau reload
    await page.reload();
    await expect(page.getByRole("heading", { name: /Xin chào, E2E Tester/ })).toBeVisible();

    // Đăng xuất
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page.getByRole("heading", { name: "Đăng Nhập" })).toBeVisible();
  });

  test("wishlist: lưu từ card, hiển thị trong trang wishlist", async ({ page }) => {
    await page.goto("/products?category=camera");
    const firstCard = page.getByRole("article").first();
    const productName = await firstCard.getByRole("heading").textContent();
    await firstCard.getByRole("button", { name: /Lưu .* vào yêu thích/ }).click();

    await page.goto("/wishlist");
    const list = page.getByRole("list").filter({ hasText: "Chuyển vào giỏ" });
    await expect(list).toBeVisible();
    await expect(list.getByRole("link", { name: productName! }).first()).toBeVisible();
    await expect(list.getByText(/Chuyển vào giỏ/)).toBeVisible();
  });
});
