import { NextResponse } from "next/server";
import { adminGuardResponse } from "@/lib/server/admin";
import { emailQueueDepths, getQueueRedis } from "@/lib/server/email-queue";
import { isRedisConfigured } from "@/lib/server/rate-limit-redis";

/** GET /api/admin/queue — độ sâu email queue (pending/delayed/dead). */
export async function GET() {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  return NextResponse.json({
    redis: isRedisConfigured(),
    email: await emailQueueDepths(getQueueRedis()),
  });
}
