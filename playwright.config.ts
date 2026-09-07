import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests chạy trên production build.
 * Cách chạy: npm run build && npx playwright test
 * Server tự khởi động qua webServer (port 3000, reuse nếu đã chạy).
 *
 * DB isolation: global-setup.ts copy dev.db → .test.db,
 * webServer dùng .test.db, global-teardown xóa sau khi xong.
 *
 * NEXT_PUBLIC_*_FAILURE_RATE = 0: tắt injection lỗi mạng giả lập
 * trong placeOrder/submitReview để test ổn định.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // Prisma resolve file: tương đối theo thư mục prisma/ → ../ ra root
      DATABASE_URL: "file:../tests/e2e/.test.db",
      PAYMENT_DEMO_MODE: "true",
      NEXT_PUBLIC_PAYMENT_DEMO_MODE: "true",
      NEXT_PUBLIC_ORDER_FAILURE_RATE: "0",
      NEXT_PUBLIC_REVIEW_FAILURE_RATE: "0",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
