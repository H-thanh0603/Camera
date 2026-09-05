import { expect, test } from "@playwright/test";

const ADMIN = { email: "admin@lumina.vn", password: "admin-lumina-2026" };

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/account");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
  await page.getByLabel(/Mật khẩu/).fill(ADMIN.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible({ timeout: 10_000 });
}

test.describe("Admin panel", () => {
  test("không đăng nhập → redirect /account; customer thường → cũng bị chặn", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/account/);

    // customer thường (không phải admin) cũng bị chặn
    const email = `cust-${Date.now()}@lumina.vn`;
    await page.getByRole("tab", { name: "Đăng ký" }).click();
    await page.getByLabel("Họ và tên").fill("Khach Thuong");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel(/Mật khẩu/).fill("matkhau-12345");
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible({ timeout: 10_000 });

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/account/);
  });

  test("admin: dashboard → tạo sản phẩm mới → hiện trên catalogue → xóa", async ({ page }) => {
    await adminLogin(page);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();

    const slug = `test-product-${Date.now()}`;
    await page.goto("/admin/products");
    await page.getByRole("button", { name: "+ Thêm mới" }).click();
    await page.getByLabel("Tên", { exact: true }).fill("Máy Ảnh Test E2E");
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await page.getByLabel("SKU", { exact: true }).fill(`E2E-${Date.now()}`);
    await page.getByLabel("Giá (₫)", { exact: true }).fill("99000000");
    await page.getByLabel("Mô tả ngắn", { exact: true }).fill("Sản phẩm test từ E2E admin suite.");
    await page.getByLabel("Mô tả đầy đủ", { exact: true }).fill("Mô tả đầy đủ cho sản phẩm test E2E — dùng để xác minh luồng admin CRUD.");
    await page.getByRole("button", { name: "Lưu sản phẩm" }).click();

    await expect(page.getByText("Đã tạo sản phẩm mới.")).toBeVisible({ timeout: 10_000 });

    // Sản phẩm mới hiện trên catalogue (revalidatePath)
    await page.goto(`/products/${slug}`);
    await expect(page.getByRole("heading", { level: 1, name: "Máy Ảnh Test E2E" })).toBeVisible({ timeout: 15_000 });

    // Xóa
    await page.goto("/admin/products");
    const row = page.getByRole("row").filter({ hasText: "Máy Ảnh Test E2E" });
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Xóa" }).click();
    await expect(page.getByText("Đã xóa sản phẩm.")).toBeVisible({ timeout: 10_000 });
  });

  test("admin: đổi trạng thái đơn hàng trong quản trị đơn", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/orders");
    await page.waitForLoadState("networkidle");

    const selects = page.getByRole("combobox");
    const count = await selects.count();
    if (count > 0) {
      await selects.first().selectOption("processing");
      // select giữ giá trị mới
      await expect(selects.first()).toHaveValue("processing");
    }
  });
});
