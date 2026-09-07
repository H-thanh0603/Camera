import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/lib/server/logger";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { isAdmin } from "@/lib/server/admin";
import { isProduction } from "@/lib/server/env";

/**
 * POST /api/metrics — điểm nhận event analytics + web vitals + client error.
 * Hiện ghi ra console có cấu trúc (grep được khi vận hành); chưa persist.
 * Production: đổi thân hàm này thành client của GA4 Measurement Protocol /
 * Plausible API / tự lưu vào DB — instrumentation phía UI không đổi.
 *
 * GET trả về counters in-memory (tính từ lúc server start) cho demo giám sát —
 * production chỉ admin xem được.
 */

const counters = new Map<string, number>();

// Route bị middleware skip rate limit (tần suất telemetry cao) nên tự limiter
// riêng: spam client_error không dồn được Sentry/log.
const postLimiter = getRequestLimiter({ windowMs: 60_000, max: 120 });
const getLimiter = getRequestLimiter({ windowMs: 60_000, max: 60 });

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function limited(
  request: NextRequest,
  limiter: ReturnType<typeof getRequestLimiter>,
): Promise<NextResponse | null> {
  const result = await limiter.check(clientIp(request));
  return result.allowed
    ? null
    : NextResponse.json({ error: "Quá nhiều yêu cầu." }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
}

export async function POST(request: NextRequest) {
  const denied = await limited(request, postLimiter);
  if (denied) return denied;
  try {
    const body = (await request.json()) as { event?: string; props?: Record<string, unknown> };
    if (!body.event || typeof body.event !== "string" || body.event.length > 64) {
      return NextResponse.json({ error: "Event không hợp lệ." }, { status: 422 });
    }
    counters.set(body.event, (counters.get(body.event) ?? 0) + 1);
    // Lỗi client đi qua logger.error để forward sang Sentry (server-side,
    // không tốn bundle client) — event thường chỉ info.
    if (body.event === "client_error") {
      logger.error("client_error", { props: body.props ?? {} });
    } else {
      logger.info("analytics_event", { event: body.event, props: body.props ?? {} });
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const denied = await limited(request, getLimiter);
  if (denied) return denied;
  if (isProduction() && !(await isAdmin())) {
    return NextResponse.json({ error: "Chỉ admin mới có quyền này." }, { status: 403 });
  }
  return NextResponse.json({ events: Object.fromEntries(counters) });
}
