import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";
import { isRedisConfigured } from "@/lib/server/rate-limit-redis";

/**
 * GET /api/health — health check cho uptime monitor (UptimeRobot, K8s probe…).
 * 200 khi app + DB sống; 503 khi DB không phản hồi.
 * Uptime monitor ping mỗi phút nên nhờ nó dọn session/reset-token hết hạn
 * (1 lần/giờ — dùng flag in-memory, không cần cron riêng).
 */

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let lastSweep = 0;

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;

    let swept = 0;
    if (Date.now() - lastSweep >= SWEEP_INTERVAL_MS) {
      lastSweep = Date.now();
      const expired = { lt: new Date() };
      const sessions = await prisma.session.deleteMany({ where: { expiresAt: expired } });
      const tokens = await prisma.passwordResetToken.deleteMany({ where: { expiresAt: expired } });
      swept = sessions.count + tokens.count;
      if (swept > 0) logger.info("auth.sweep_expired", { sessions: sessions.count, tokens: tokens.count });
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
      paymentDemoMode: process.env.PAYMENT_DEMO_MODE === "true",
      paymentWebhook: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
      email: Boolean(process.env.RESEND_API_KEY),
      sentry: Boolean(process.env.SENTRY_DSN),
      redis: isRedisConfigured() ? "upstash" : "memory",
      swept,
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
