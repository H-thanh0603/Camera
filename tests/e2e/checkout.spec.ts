import { expect, test } from "@playwright/test";

test.describe("PDP → Cart → Checkout", () => {
  test("thêm variant vào giỏ, đổi số lượng, tổng đúng", async ({ page }) => {
    await page.goto("/products/lumina-x1-monolith");

    // Chọn variant kit (giá 259.000.000)
    await page.getByRole("button", { name: /Body \+ 50mm f\/1.2 ASPH/ }).click();
    await expect(page.getByText("SKU: LUM-X1-K50")).toBeVisible();

    // Tăng số lượng lên 2 rồi thêm vào giỏ (CTA chính trong panel mua hàng)
    await page.getByRole("button", { name: "Tăng số lượng" }).click();
    await page.getByRole("button", { name: /Thêm Vào Giỏ/ }).first().click();

    const drawer = page.getByRole("dialog", { name: "Giỏ hàng" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Lumina X-1 Monolith")).toBeVisible();
    await expect(drawer.getByText("518.000.000 ₫").first()).toBeVisible();

    await drawer.getByRole("link", { name: "Xem giỏ hàng" }).click();
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.getByText("518.000.000 ₫").first()).toBeVisible();

    // Giảm về 1
    await page.getByRole("button", { name: /Giảm số lượng/ }).click();
    await expect(page.getByText("259.000.000 ₫").first()).toBeVisible();
  });

  test("checkout đủ 5 bước với validation, ra trang thành công", async ({ page }) => {
    await page.goto("/products/lumina-x1-monolith");
    await page.getByRole("button", { name: /Thêm Vào Giỏ/ }).first().click();

    const drawer = page.getByRole("dialog", { name: "Giỏ hàng" });
    await drawer.getByRole("link", { name: "Thanh toán" }).click();
    await expect(page).toHaveURL(/\/checkout/);

    // Step 1: validation chặn submit rỗng
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByText("Vui lòng nhập họ tên.")).toBeVisible();

    await page.getByLabel("Họ và tên").fill("Nguyễn Testing");
    await page.getByLabel("Email", { exact: true }).fill("testing@lumina.vn");
    await page.getByLabel("Số điện thoại").fill("0901234567");
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Step 2: địa chỉ
    await page.getByLabel("Địa chỉ").fill("123 Lê Lợi");
    await page.getByLabel("Phường/xã").fill("Bến Nghé");
    await page.getByLabel("Quận/huyện").fill("Quận 1");
    await page.getByLabel("Tỉnh/thành").fill("TP. Hồ Chí Minh");
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Step 3: giao nhận (mặc định Giao chuẩn)
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Step 4: thanh toán (mặc định chuyển khoản)
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Step 5: xác nhận
    await expect(page.getByText("Nguyễn Testing")).toBeVisible();
    await page.getByRole("button", { name: /Xác nhận đặt hàng/ }).click();

    // Chấp nhận trường hợp lỗi mạng giả lập → bấm "Thử lại" (cũng test luôn UX retry)
    const success = page.getByText("Đơn hàng đã được ghi nhận");
    const networkError = page.getByRole("alert").filter({ hasText: "Không thể đặt hàng" });
    for (let i = 0; i < 5; i++) {
      if (await success.isVisible().catch(() => false)) break;
      if (await networkError.isVisible().catch(() => false)) {
        await page.getByRole("button", { name: "Thử lại" }).click();
        continue;
      }
      await page.waitForTimeout(500);
    }
    await expect(success).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/LUM-/).first()).toBeVisible();
  });
});
