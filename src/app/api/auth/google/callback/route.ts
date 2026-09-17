import { NextResponse, type NextRequest } from "next/server";
import { finishGoogleLogin, isGoogleConfigured, OAuthError } from "@/lib/server/oauth";
import { logger } from "@/lib/server/logger";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

/**
 * GET /api/auth/google/callback — Google redirect về: verify, tạo session.
 * Tài khoản bật 2FA → redirect `?oauth=2fa` (challenge nằm trong cookie
 * httpOnly, account page poll qua API rồi mở form nhập code).
 */
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Đăng nhập Google chưa được cấu hình." }, { status: 503 });
  }
  const limit = await limiter.check(`oauth-cb:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const googleError = request.nextUrl.searchParams.get("error");
  if (googleError || !code || !state) {
    return NextResponse.redirect(`${site}/account?oauth=denied`);
  }
  try {
    const { challengeToken } = await finishGoogleLogin(code, state);
    if (challengeToken) {
      return NextResponse.redirect(`${site}/account?oauth=2fa`);
    }
    return NextResponse.redirect(`${site}/account?oauth=success`);
  } catch (error) {
    if (error instanceof OAuthError) {
      logger.warn("oauth.callback_failed", { error: error.message });
      return NextResponse.redirect(
        `${site}/account?oauth=${error.code === "BANNED" ? "banned" : "error"}`,
      );
    }
    logger.error("oauth.callback_error", { error: String(error) });
    return NextResponse.redirect(`${site}/account?oauth=error`);
  }
}
