import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { resolveTotpChallenge, startTotpSetup, TwoFactorError } from "@/lib/server/two-factor";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

// 5 lần/phút/IP — setup trả secret TOTP, không cho probe unbounded (M5).
const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

/**
 * POST /api/auth/2fa/setup — bắt đầu bật 2FA, trả secret + otpauth URL để quét app.
 * Nhận session thường HOẶC { challengeToken } bootstrap (admin chưa bật 2FA
 * không login được — login trả challenge 403 để setup ngay).
 */
export async function POST(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const limit = await limiter.check(`2fa-setup:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều lần thử. Thử lại sau một phút." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  let user = await getSessionUser();
  let viaChallenge = false;
  if (!user) {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const parsed = z.object({ challengeToken: z.string().min(32).max(128) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Đăng nhập để tiếp tục." }, { status: 401 });
    try {
      user = await resolveTotpChallenge(parsed.data.challengeToken);
      viaChallenge = true;
    } catch (error) {
      if (error instanceof TwoFactorError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
  try {
    const result = await startTotpSetup(user.id);
    // Enroll lần đầu qua challenge: gửi OTP tới email (confirm bắt buộc kèm
    // OTP — kẻ chỉ biết password không enroll được authenticator, L4).
    if (viaChallenge) {
      const { sendBootstrapOtp } = await import("@/lib/server/email-otp");
      await sendBootstrapOtp(user.id, user.email);
      return NextResponse.json({ ...result, emailOtpSent: true });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
