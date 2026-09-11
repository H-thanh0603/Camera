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

  test("admin: SP giảm giá có hạn → PDP có priceValidUntil → xóa", async ({ page }) => {
    await adminLogin(page);

    const slug = `test-sale-${Date.now()}`;
    await page.goto("/admin/products");
    await page.getByRole("button", { name: "+ Thêm mới" }).click();
    await page.getByLabel("Tên", { exact: true }).fill("Máy Ảnh KM Test E2E");
    await page.getByLabel("Slug", { exact: true }).fill(slug);
    await page.getByLabel("SKU", { exact: true }).fill(`E2E-SALE-${Date.now()}`);
    await page.getByLabel("Giá (₫)", { exact: true }).fill("80000000");
    await page.getByLabel("Giá trước giảm (₫)", { exact: true }).fill("100000000");
    await page.getByLabel("KM đến ngày", { exact: true }).fill("2026-12-31T23:59");
    await page.getByLabel("Mô tả ngắn", { exact: true }).fill("SP khuyến mãi test từ E2E admin suite.");
    await page.getByLabel("Mô tả đầy đủ", { exact: true }).fill("Mô tả đầy đủ cho SP khuyến mãi test E2E.");
    await page.getByRole("button", { name: "Lưu sản phẩm" }).click();

    await expect(page.getByText("Đã tạo sản phẩm mới.")).toBeVisible({ timeout: 10_000 });

    // Offer JSON-LD có priceValidUntil vì vừa có giá sale vừa có hạn KM tương lai.
    // (assert trên HTML thô: text-engine của locator không thấy nội dung <script>)
    await page.goto(`/products/${slug}`);
    await expect
      .poll(async () => (await page.content()).includes("priceValidUntil"), { timeout: 15_000 })
      .toBe(true);

    // Xóa
    await page.goto("/admin/products");
    const row = page.getByRole("row").filter({ hasText: "Máy Ảnh KM Test E2E" });
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
      // Máy trạng thái chỉ cho đi tiến: pending → paid (rồi paid → processing)
      await selects.first().selectOption("paid");
      // select giữ giá trị mới
      await expect(selects.first()).toHaveValue("paid");
    }
  });

  test("admin: ẩn UI mua sắm — không giỏ hàng, không CTA, checkout bị chặn", async ({ page }) => {
    await adminLogin(page);

    // Header không có nút giỏ hàng
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /Giỏ hàng/ })).toHaveCount(0);

    // PDP không có CTA mua, có ghi chú admin
    await page.goto("/products/lumina-x1-monolith");
    await expect(page.getByRole("button", { name: /Thêm Vào Giỏ|Mua Ngay/ })).toHaveCount(0);
    await expect(page.getByText(/đăng nhập tài khoản.*admin/)).toBeVisible();

    // Checkout chặn bằng màn hình riêng
    await page.goto("/checkout");
    await expect(page.getByText("Kênh Dành Cho Khách Mua Hàng")).toBeVisible({ timeout: 10_000 });
  });

  test("admin: console shell — sidebar, active state, lối về cửa hàng", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/products");
    const nav = page.getByRole("navigation", { name: "Điều hướng admin" });
    await expect(nav.getByRole("link", { name: /Sản phẩm/ })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /Đơn hàng/ })).not.toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Về cửa hàng" })).toBeVisible();
  });

  test("admin: phiếu nhập kho +5 → tồn tăng, lịch sử có dòng", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/stock");
    await page.getByLabel("Sản phẩm", { exact: true }).selectOption({ index: 0 });
    await page.getByLabel("Số lượng").fill("5");
    await page.getByLabel("Lý do (bắt buộc)").fill("Nhập NCC test E2E");
    await page.getByRole("button", { name: "Ghi phiếu kho" }).click();
    await expect(page.getByText(/Đã ghi phiếu/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("cell", { name: "Nhập NCC test E2E" }).first()).toBeVisible();
  });

  test("admin: refund VNPay 503 khi chưa cấu hình keys", async ({ page }) => {
    await adminLogin(page);
    // Keys check trước cả order lookup → fail-closed (page.request chia sẻ session admin)
    const origin = new URL(page.url()).origin;
    const res = await page.request.post("/api/admin/orders/no-such-order/refund", {
      headers: { Origin: origin },
    });
    expect(res.status()).toBe(503);
  });

  test("admin: xuất CSV đơn hàng đúng định dạng", async ({ page }) => {
    await adminLogin(page);
    const res = await page.request.get("/api/admin/orders/export?status=all");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("Mã đơn");
    expect(text.split("\n").length).toBeGreaterThan(1);
  });

  test("admin: CSV dry-run validate đúng/sai", async ({ page }) => {
    await adminLogin(page);
    const origin = new URL(page.url()).origin;
    const good = await page.request.post("/api/admin/products/import", {
      headers: { Origin: origin },
      data: { csv: "slug,name,brand,category,price,stock\ntest-csv-1,Máy Test CSV,Lumina,camera,1000000,3", dryRun: true },
    });
    expect(good.status()).toBe(200);
    expect((await good.json()).valid).toBe(1);
    const bad = await page.request.post("/api/admin/products/import", {
      headers: { Origin: origin },
      data: { csv: "slug,name,brand,category,price\nBad Slug,Máy X,Lumina,camera,100", dryRun: true },
    });
    expect(bad.status()).toBe(200);
    expect((await bad.json()).issues.length).toBeGreaterThan(0);
  });

  test("admin: bật banner site → trang chủ hiện, tắt → ẩn", async ({ page }) => {
    await adminLogin(page);
    await page.goto("/admin/content");
    await page.getByLabel("Nội dung banner", { exact: true }).fill("Banner test E2E — ưu đãi đặc biệt");
    await page.getByRole("checkbox", { name: "Hiển thị banner" }).check();
    await page.getByRole("button", { name: "Lưu banner" }).click();
    await expect(page.getByText("Đã lưu banner site.")).toBeVisible({ timeout: 10_000 });

    await page.goto("/");
    await expect(page.getByText("Banner test E2E — ưu đãi đặc biệt")).toBeVisible({ timeout: 10_000 });

    await page.goto("/admin/content");
    await page.getByRole("checkbox", { name: "Hiển thị banner" }).uncheck();
    await page.getByRole("button", { name: "Lưu banner" }).click();
    await expect(page.getByText("Đã lưu banner site.")).toBeVisible({ timeout: 10_000 });
    await page.goto("/");
    await expect(page.getByText("Banner test E2E — ưu đãi đặc biệt")).toHaveCount(0);
  });

  test("staff: vào được ops (đơn/kho), bị chặn trang admin-only", async ({ page }) => {
    const email = `staff-${Date.now()}@lumina.vn`;
    const password = "matkhau-12345";
    await page.goto("/account");
    await page.getByRole("tab", { name: "Đăng ký" }).click();
    await page.getByLabel("Họ và tên").fill("Nhan Vien Test");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel(/Mật khẩu/).fill(password);
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible({ timeout: 10_000 });

    // Admin cấp role staff qua API
    await page.context().clearCookies();
    await adminLogin(page);
    const origin = new URL(page.url()).origin;
    const list = await page.request.get(`/api/admin/users?q=${encodeURIComponent(email)}`, {
      headers: { Origin: origin },
    });
    expect(list.status()).toBe(200);
    const staffId = (await list.json()).users[0]?.id as string | undefined;
    expect(staffId).toBeTruthy();
    const promote = await page.request.patch(`/api/admin/users/${staffId}`, {
      headers: { Origin: origin },
      data: { role: "staff" },
    });
    expect(promote.status()).toBe(200);

    // Đăng nhập lại bằng staff
    await page.context().clearCookies();
    await page.goto("/account");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel(/Mật khẩu/).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible({ timeout: 10_000 });

    // Vào được ops
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Quản Trị Đơn Hàng" })).toBeVisible({ timeout: 10_000 });
    await page.goto("/admin/stock");
    await expect(page.getByRole("heading", { name: "Quản Trị Kho Hàng" })).toBeVisible({ timeout: 10_000 });

    // Bị chặn trang admin-only + sidebar không có link
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/account/);
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Điều hướng admin" });
    await expect(nav.getByRole("link", { name: /Sản phẩm/ })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: /Đơn hàng/ })).toBeVisible();
  });
});
