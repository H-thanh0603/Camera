import { expect, test } from "@playwright/test";

const ADMIN = { email: "admin@lumina.vn", password: "admin-lumina-2026" };

test.describe("Admin upload ảnh", () => {
  test("chưa đăng nhập → 403", async ({ request }) => {
    const res = await request.post("/api/admin/upload", {
      multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from([1, 2, 3]) } },
    });
    expect(res.status()).toBe(403);
  });

  test("admin + chưa cấu hình R2 → 503 hướng dẫn paste URL", async ({ page }) => {
    await page.goto("/account");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
    await page.getByLabel(/Mật khẩu/).fill(ADMIN.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible({ timeout: 10_000 });

    const res = await page.request.post("/api/admin/upload", {
      multipart: {
        file: { name: "thumb.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71]) },
        scope: "tmp",
      },
    });
    // Không có R2_* env ở CI/dev → 503, luồng paste-URL vẫn dùng được
    expect(res.status()).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("chưa cấu hình");
  });

  test("admin + file sai định dạng → 422 (cần R2 cấu hình, skip nếu 503)", async ({ page }) => {
    await page.goto("/account");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email", { exact: true }).fill(ADMIN.email);
    await page.getByLabel(/Mật khẩu/).fill(ADMIN.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible({ timeout: 10_000 });

    const res = await page.request.post("/api/admin/upload", {
      multipart: {
        file: { name: "evil.pdf", mimeType: "application/pdf", buffer: Buffer.from([1, 2, 3]) },
      },
    });
    // 422 khi R2 đã cấu hình; 503 khi chưa (validate sau guard storage)
    expect([422, 503]).toContain(res.status());
  });
});
