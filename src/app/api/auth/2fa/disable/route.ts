import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { disableTotp, TwoFactorError } from "@/lib/server/two-factor";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

// 5 lần/phút/IP — disable verify code 6 số (M5).
const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

/** POST /api/auth/2fa/disable {code} — tắt 2FA bằng code hiện tại. */
export async function POST(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const limit = await limiter.check(`2fa-disable:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều lần thử. Thử lại sau một phút." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Đăng nhập để tiếp tục." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = z.object({ code: z.string().min(1).max(32) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Thiếu mã xác thực." }, { status: 422 });
  try {
    await disableTotp(user.id, parsed.data.code);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
