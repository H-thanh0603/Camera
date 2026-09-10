/**
 * Cổng kiểm tra env trước deploy — fail-fast với message rõ ràng.
 * Dùng: NODE_ENV=production npx tsx scripts/check-prod-env.ts
 * (Gắn vào CD pipeline trước khi mở traffic.)
 */
import { existsSync, readFileSync } from "node:fs";
import { getEnv } from "../src/lib/server/env";

/** Nạp .env tối giản (không thêm dep): KEY="value" / KEY=value, bỏ # comment. */
function loadDotEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

try {
  const env = getEnv();
  const checks = {
    demoOff: env.PAYMENT_DEMO_MODE === "false",
    adminPassword: Boolean(env.ADMIN_PASSWORD),
    webhookSecret: Boolean(env.PAYMENT_WEBHOOK_SECRET),
    redis: Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
    proxy: Number(env.TRUST_PROXY_COUNT ?? 0) > 0 || Boolean(process.env.VERCEL),
    email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    sentry: Boolean(env.SENTRY_DSN),
  };
   
  console.log(JSON.stringify({ event: "prod_env.ok", checks }, null, 2));
  const optional = (["email", "sentry"] as const).filter((k) => !checks[k]);
  if (optional.length > 0) {
     
    console.warn(`CẢNH BÁO (không chặn): thiếu optional: ${optional.join(", ")}`);
  }
} catch (error) {
   
  console.error(`PROD ENV FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
