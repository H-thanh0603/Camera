import { NextResponse } from "next/server";
import { adminGuardResponse } from "@/lib/server/admin";
import { emailQueueDepths, getQueueRedis } from "@/lib/server/email-queue";
import { outboxDepths } from "@/lib/server/email-outbox";
import { isRedisConfigured } from "@/lib/server/rate-limit-redis";

/** GET /api/admin/queue — độ sâu email queue (Redis fast-lane + DB outbox). */
export async function GET() {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  return NextResponse.json({
    redis: isRedisConfigured(),
    email: await emailQueueDepths(getQueueRedis()),
    outbox: await outboxDepths(),
  });
}
