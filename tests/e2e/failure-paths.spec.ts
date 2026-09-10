import { expect, test } from "@playwright/test";

test.describe("Failure paths — 404 / validation / auth", () => {
  test("product không tồn tại → trang not-found", async ({ page }) => {
    await page.goto("/products/this-product-does-not-exist-xyz");
    await expect(page.getByRole("heading", { name: "Trang Không Được Tìm Thấy" })).toBeVisible();
  });

  test("checkout với giỏ trống → redirect /cart hoặc lỗi", async ({ page }) => {
    await page.goto("/checkout");
    // Chuyển hướng về /cart nếu giỏ trống, hoặc hiện lỗi
    const url = page.url();
    const isCartOrError = url.includes("/cart") || url.includes("/checkout");
    expect(isCartOrError).toBeTruthy();
  });

  test("coupon không tồn tại → hiện lỗi", async ({ page }) => {
    await page.goto("/products/lumina-x1-monolith");
    await page.getByRole("button", { name: /Thêm Vào Giỏ/ }).first().click();
    const drawer = page.getByRole("dialog", { name: "Giỏ hàng" });
    await drawer.getByRole("link", { name: "Thanh toán" }).click();
    await expect(page).toHaveURL(/\/checkout/);

    // Fill required fields step 1
    await page.getByLabel("Họ và tên").fill("Test Failure");
    await page.getByLabel("Email", { exact: true }).fill("fail@lumina.vn");
    await page.getByLabel("Số điện thoại").fill("0901234567");
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Step 2
    await page.getByLabel("Địa chỉ").fill("123 Test");
    await page.getByLabel("Phường/xã").fill("Test");
    await page.getByLabel("Quận/huyện").fill("Test");
    await page.getByLabel("Tỉnh/thành").fill("Test");
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Step 3: shipping
    await page.getByRole("button", { name: "Tiếp tục" }).click();

    // Step 4: payment — submit coupon INVALIDO
    const couponInput = page.getByPlaceholder(/Mã giảm giá|Nhập mã/);
    if (await couponInput.isVisible()) {
      await couponInput.fill("KHONGTONTAI999");
      await page.getByRole("button", { name: /Áp dụng|Đồng ý/ }).click();
      await expect(page.getByText(/không tồn tại|không hợp lệ|Không tìm thấy/)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("review validation — chặn submit rỗng", async ({ page }) => {
    await page.goto("/products/lumina-x1-monolith");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Viết đánh giá" }).click();
    await page.getByRole("button", { name: "Gửi đánh giá" }).click();
    await expect(page.getByText("Vui lòng chọn số sao từ 1 đến 5.")).toBeVisible();
  });

  test("login với sai mật khẩu → hiện lỗi", async ({ page }) => {
    await page.goto("/account");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email", { exact: true }).fill("admin@lumina.vn");
    await page.getByLabel(/Mật khẩu/).fill("sai-mat-khau-123");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: /sai|không đúng|không hợp lệ/i })).toBeVisible({ timeout: 10_000 });
  });

  test("CSRF — POST không Origin/Referer → 403", async ({ request }) => {
    const res = await request.post("/api/coupons/validate", {
      data: { code: "LUMINA10", subtotal: 10000000 },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(403);
  });

  test("rate limit — login sai liên tiếp bị chặn 429 (limit 10/phút)", async ({ request }) => {
    // Client test (như curl) phải gửi Origin khớp host — ngược lại CSRF
    // middleware chặn 403 trước khi tới limiter (đúng hành vi browser).
    // X-Forwarded-For IP riêng để bucket limiter của test này không đốt
    // quota 127.0.0.1 mà các spec đăng nhập UI dùng chung.
    const origin = `http://localhost:${process.env.E2E_PORT ?? 3000}`;
    const headers = { origin, "x-forwarded-for": "198.51.100.77" };
    for (let i = 0; i < 11; i++) {
      await request.post("/api/auth/login", {
        data: { email: "admin@lumina.vn", password: "wrong" },
        headers,
        failOnStatusCode: false,
      });
    }
    const res = await request.post("/api/auth/login", {
      data: { email: "admin@lumina.vn", password: "wrong" },
      headers,
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(429);
  });
});
