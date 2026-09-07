import { NextResponse, type NextRequest } from "next/server";
import { finishGoogleLogin, isGoogleConfigured, OAuthError } from "@/lib/server/oauth";
import { logger } from "@/lib/server/logger";

/** GET /api/auth/google/callback — Google redirect về: verify, tạo session. */
export async function GET(request: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Đăng nhập Google chưa được cấu hình." }, { status: 503 });
  }
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const googleError = request.nextUrl.searchParams.get("error");
  if (googleError || !code || !state) {
    return NextResponse.redirect(`${site}/account?oauth=denied`);
  }
  try {
    await finishGoogleLogin(code, state);
    return NextResponse.redirect(`${site}/account?oauth=success`);
  } catch (error) {
    if (error instanceof OAuthError) {
      logger.warn("oauth.callback_failed", { error: error.message });
      return NextResponse.redirect(`${site}/account?oauth=error`);
    }
    logger.error("oauth.callback_error", { error: String(error) });
    return NextResponse.redirect(`${site}/account?oauth=error`);
  }
}
