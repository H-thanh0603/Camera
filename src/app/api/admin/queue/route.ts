import { NextResponse } from "next/server";
import { adminGuardResponse } from "@/lib/server/admin";
import { adminRateLimit } from "@/lib/server/rate-limit-redis";
import { getSessionUser } from "@/lib/server/session";
import { emailQueueDepths, getQueueRedis } from "@/lib/server/email-queue";
import { listDeadOutbox, outboxDepths, retryDeadOutbox } from "@/lib/server/email-outbox";
import { isRedisConfigured } from "@/lib/server/rate-limit-redis";
import { logAudit } from "@/lib/server/audit";

/** GET /api/admin/queue — độ sâu email queue (Redis fast-lane + DB outbox) + mail dead mới nhất. */
export async function GET() {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  return NextResponse.json({
    redis: isRedisConfigured(),
    email: await emailQueueDepths(getQueueRedis()),
    outbox: await outboxDepths(),
    dead: await listDeadOutbox(20),
  });
}

/**
 * POST /api/admin/queue {action: "retry-dead"} — hồi sinh mail dead (hết lượt)
 * để worker gửi lại. Admin-only, ghi audit.
 */
export async function POST(request: Request) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const limited = await adminRateLimit(request, "queue-post");
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  if ((body as { action?: string })?.action !== "retry-dead") {
    return NextResponse.json({ error: "Action không hỗ trợ." }, { status: 422 });
  }
  const { revived } = await retryDeadOutbox(20);
  const user = await getSessionUser();
  await logAudit(
    user ? { id: user.id, name: user.name, email: user.email } : null,
    "email.dead_retried",
    "EmailOutbox",
    "dead",
    { revived },
  );
  return NextResponse.json({ ok: true, revived, outbox: await outboxDepths() });
}
