import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Test chạm dev.db chung (SQLite single-writer) — chạy file tuần tự
    // để tx dài (concurrency/cancel) không làm đói socket file khác.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
