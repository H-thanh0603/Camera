/**
 * POST /api/agent/action — user duyệt (hoặc từ chối) hành động agent đã đề xuất.
 *
 * Body: { actionKey, decision: "approve" | "reject" }. Payload hành động
 * KHÔNG bao giờ nằm ở client — chỉ key; server lấy data đã lưu trong
 * AgentAction (TTL 10 phút) rồi dispatch tool với approvedActions.
 *
 * Approve add_to_cart: tool xác thực tồn kho rồi trả payload cho widget
 * tự thêm vào giỏ client — server không ghi giỏ thay client.
 * Approve watch_price: tạo PriceWatch thật (nhiệm vụ nền).
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getClientIp } from "@/lib/server/client-ip";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { logger } from "@/lib/server/logger";
import { AGENT_SID_COOKIE } from "@/lib/server/agent-session";
import { getPendingAction, markActionExecuted } from "@/lib/server/agent-action";
import { buildExecutor } from "@/lib/ai";
import { getDbCommerceSource } from "@/lib/ai/tools/db-source";

export const runtime = "nodejs";

const bodySchema = z.object({
  actionKey: z.string().trim().min(3).max(80),
  decision: z.enum(["approve", "reject"]),
});

const limiter = getRequestLimiter({ windowMs: 60_000, max: 20 });

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  if (!(await limiter.check(`agent-action:${ip}`)).allowed) {
    return NextResponse.json({ error: "Quá nhiều thao tác. Thử lại sau." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Yêu cầu chưa hợp lệ." }, { status: 422 });
  }

  const cookieStore = await cookies();
  const sid = cookieStore.get(AGENT_SID_COOKIE)?.value;
  if (!sid) return NextResponse.json({ error: "Phiên đã hết. Hãy hỏi trợ lý lại." }, { status: 404 });

  const { actionKey, decision } = parsed.data;
  if (decision === "reject") {
    // Từ chối: xoá pending — model thấy hành động bị huỷ khi user hỏi tiếp.
    const pending = await getPendingAction(sid, actionKey);
    if (pending) {
      const { prisma } = await import("@/lib/server/prisma");
      await prisma.agentAction.deleteMany({ where: { id: pending.id } }).catch(() => undefined);
    }
    logger.info("agent.action_rejected", { route: "agent/action", actionKey });
    return NextResponse.json({ ok: true, decision: "reject" });
  }

  // Approve: nạp tool executor với approval cho đúng actionKey rồi chạy.
  const pending = await getPendingAction(sid, actionKey);
  if (!pending) {
    return NextResponse.json({ error: "Yêu cầu đã hết hạn. Hãy nhờ trợ lý đề xuất lại." }, { status: 404 });
  }

  const executor = buildExecutor(getDbCommerceSource(), { rawSid: sid });
  const approved = new Set([actionKey]);
  const outcome = await executor.dispatch(pending.tool, pending.data, {
    requestId: `approve-${actionKey}`,
    approvedActions: approved,
    rawSid: sid,
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.message }, { status: 409 });
  }
  await markActionExecuted(pending.id);
  logger.info("agent.action_approved", { route: "agent/action", actionKey, tool: pending.tool });

  // outcome.value có thể chứa payload client cần áp dụng (add_to_cart).
  return NextResponse.json({ ok: true, decision: "approve", result: outcome.value });
}
