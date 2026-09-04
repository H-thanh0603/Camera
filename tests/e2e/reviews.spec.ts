import { expect, test } from "@playwright/test";

test.describe("Review submission", () => {
  test("gửi review hợp lệ → hiện trạng thái chờ kiểm duyệt", async ({ page }) => {
    await page.goto("/products/lumina-x1-monolith");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Viết đánh giá" }).click();
    await page.getByRole("button", { name: "4 sao" }).click();
    await page.getByLabel("Tiêu đề").fill("Trải nghiệm rất tốt");
    await page.getByLabel(/Nội dung/).fill("Máy dùng ổn định, lấy nét nhanh, đáng đầu tư cho công việc chuyên nghiệp.");
    await page.getByLabel(/Tên của bạn/).fill("E2E Reviewer");

    await page.getByRole("button", { name: "Gửi đánh giá" }).click();

    await expect(page.getByText("đang chờ kiểm duyệt")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("CHỜ KIỂM DUYỆT").first()).toBeVisible();
  });

  test("validation chặn review không hợp lệ", async ({ page }) => {
    await page.goto("/products/lumina-x1-monolith");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Viết đánh giá" }).click();
    await page.getByRole("button", { name: "Gửi đánh giá" }).click();

    await expect(page.getByText("Vui lòng chọn số sao từ 1 đến 5.")).toBeVisible();
    await expect(page.getByText("Tiêu đề cần tối thiểu 4 ký tự.")).toBeVisible();
  });
});
