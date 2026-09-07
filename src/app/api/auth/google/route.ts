import { NextResponse, type NextRequest } from "next/server";
import { beginGoogleLogin, isGoogleConfigured } from "@/lib/server/oauth";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

/** GET /api/auth/google — bắt đầu OAuth: redirect sang Google. */
export async function GET(request: NextRequest) {
  const limit = await limiter.check(`oauth:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Đăng nhập Google chưa được cấu hình." }, { status: 503 });
  }
  return NextResponse.redirect(await beginGoogleLogin());
}
