import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests chạy trên production build.
 * Cách chạy: npm run build && npx playwright test
 * Server tự khởi động qua webServer (reuse nếu đã chạy).
 *
 * E2E_PORT: đổi port khi 3000 bị chiếm (vd project khác).
 *   E2E_PORT=3100 npx playwright test
 *
 * DB isolation: global-setup.ts copy dev.db → .test.db,
 * webServer dùng .test.db, global-teardown xóa sau khi xong.
 *
 * NEXT_PUBLIC_*_FAILURE_RATE = 0: tắt injection lỗi mạng giả lập
 * trong placeOrder/submitReview để test ổn định.
 */
const E2E_PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    port: E2E_PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: String(E2E_PORT),
      DATABASE_URL: "file:../tests/e2e/.test.db",
      NEXT_PUBLIC_ORDER_FAILURE_RATE: "0",
      NEXT_PUBLIC_REVIEW_FAILURE_RATE: "0",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
