import { expect, test } from "@playwright/test";

test.describe("Trade-in thu cũ đổi mới", () => {
  test("validation chặn form rỗng, submit hợp lệ → thành công", async ({ page }) => {
    await page.goto("/trade-in");
    await expect(page.getByRole("heading", { name: "Đổi Máy Cũ Lên Đời" })).toBeVisible();

    await page.getByRole("button", { name: "Gửi yêu cầu định giá" }).click();
    await expect(page.getByText("Vui lòng nhập họ tên.")).toBeVisible();

    await page.getByLabel(/Họ và tên/).fill("Nguyễn Trade");
    await page.getByLabel(/Số điện thoại/).fill("0901234567");
    await page.getByLabel(/Hãng máy/).fill("Sony");
    await page.getByLabel(/Model/).fill("A7 III");
    await page.getByRole("button", { name: "Gửi yêu cầu định giá" }).click();

    await expect(page.getByText("Đã nhận thông tin!")).toBeVisible({ timeout: 10_000 });
  });
});
