import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import { isRedisConfigured } from "@/lib/server/rate-limit-redis";
import { isAdmin } from "@/lib/server/admin";

/**
 * GET /api/health — liveness + readiness gộp cho uptime monitor.
 * Read-only: KHÔNG side-effect (sweep session hết hạn đã chuyển sang
 * `npm run db:sweep` chạy bằng cron — xem scripts/backup.cron.example).
 * 200 khi app + DB sống; 503 khi DB không phản hồi.
 * Công khai chỉ: status/db/latency/ready (M3 — chi tiết kênh nào bật/tắt là
 * reconnaissance cho attacker). Chi tiết cấu hình + resource chỉ admin xem.
 */

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const admin = await isAdmin();
    const ready =
      Boolean(process.env.VNPAY_TMN_CODE && process.env.VNPAY_HASH_SECRET) &&
      isRedisConfigured();
    if (!admin) {
      return NextResponse.json({
        status: "ok",
        db: "up",
        latencyMs: Date.now() - startedAt,
        // Sẵn sàng nhận traffic production: VNPay keys + redis.
        ready,
        timestamp: new Date().toISOString(),
      });
    }
    const mem = process.memoryUsage();
    return NextResponse.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rssMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      },
      env: process.env.NODE_ENV ?? "development",
      paymentVnpay: Boolean(process.env.VNPAY_TMN_CODE && process.env.VNPAY_HASH_SECRET),
      paymentWebhook: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
      email: Boolean(process.env.RESEND_API_KEY),
      sentry: Boolean(process.env.SENTRY_DSN),
      redis: isRedisConfigured() ? "upstash" : "memory",
      ready,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("health.db_down", { error: String(error) });
    return NextResponse.json(
      { status: "degraded", db: "down", timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
