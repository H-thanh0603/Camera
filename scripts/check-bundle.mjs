#!/usr/bin/node
/**
 * Bundle budget check — chạy sau `next build`.
 * Chặn CI nếu tổng JS client vượt ngân sách (bytes). Heuristic đơn giản:
 * tổng kích thước các chunk tĩnh; nếu cần chi tiết hơn dùng @next/bundle-analyzer.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BUDGET_BYTES = Number(process.env.BUNDLE_BUDGET_BYTES ?? 1_500_000);
const chunksDir = ".next/static/chunks";

let total = 0;
try {
  for (const file of readdirSync(chunksDir)) {
    if (file.endsWith(".js")) total += statSync(join(chunksDir, file)).size;
  }
} catch {
  console.error("✗ Không tìm thấy .next/static/chunks — hãy chạy `next build` trước.");
  process.exit(1);
}

const mb = (n) => (n / 1_048_576).toFixed(2);
console.log(`Bundle JS tổng: ${mb(total)} MB (ngân sách ${mb(BUDGET_BYTES)} MB)`);
if (total > BUDGET_BYTES) {
  console.error("✗ Vượt bundle budget — xem lại dependency/code-splitting trước khi merge.");
  process.exit(1);
}
console.log("✓ Trong ngân sách.");
