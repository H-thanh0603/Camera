import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/server/logger";

/**
 * GET /api/health — health check cho uptime monitor (UptimeRobot, K8s probe…).
 * 200 khi app + DB sống; 503 khi DB không phản hồi.
 */

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "up",
      latencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.round(process.uptime()),
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
