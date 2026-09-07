import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import { isRedisConfigured } from "@/lib/server/rate-limit-redis";

/**
 * GET /api/health — liveness + readiness gộp cho uptime monitor.
 * Read-only: KHÔNG side-effect (sweep session hết hạn đã chuyển sang
 * `npm run db:sweep` chạy bằng cron — xem scripts/backup.cron.example).
 * 200 khi app + DB sống; 503 khi DB không phản hồi.
 */

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;

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
      paymentDemoMode: process.env.PAYMENT_DEMO_MODE === "true",
      paymentWebhook: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
      email: Boolean(process.env.RESEND_API_KEY),
      sentry: Boolean(process.env.SENTRY_DSN),
      redis: isRedisConfigured() ? "upstash" : "memory",
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
