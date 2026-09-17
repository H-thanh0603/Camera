/**
 * POST /api/agent/feedback — ghi nhận đánh giá câu trả lời của trợ lý.
 *
 * Widget gửi { rating: "up" | "down", requestId, message? }. Không lưu nội
 * dung hội thoại — chỉ log (Sentry khi error-level không áp dụng ở đây vì
 * feedback xấu là tín hiệu chất lượng, không phải sự cố) kèm snippet ngắn
 * để trace về request gốc qua X-Request-Id của /api/agent/chat.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/lib/server/client-ip";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";

const bodySchema = z.object({
  rating: z.enum(["up", "down"]),
  requestId: z.string().trim().min(4).max(32),
  snippet: z.string().trim().max(280).optional(),
});

const limiter = getRequestLimiter({ windowMs: 60_000, max: 20 });

export async function POST(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const ip = getClientIp(request.headers);
  if (!(await limiter.check(`agent-fb:${ip}`)).allowed) {
    return NextResponse.json({ error: "Quá nhiều đánh giá trong thời gian ngắn." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Đánh giá chưa hợp lệ." }, { status: 422 });
  }

  const { rating, requestId, snippet } = parsed.data;
  logger.info("agent.feedback", {
    route: "agent/feedback",
    rating,
    requestId,
    snippet: snippet || undefined,
  });
  return NextResponse.json({ ok: true });
}
