import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { confirmTotpSetup, TwoFactorError } from "@/lib/server/two-factor";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

// 5 lần/phút/IP — confirm verify code 6 số, không cho đoán unbounded (M5).
const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

/**
 * POST /api/auth/2fa/confirm {code} — xác nhận bật 2FA, nhận backup codes (1 lần).
 * Nhận session thường HOẶC { challengeToken } bootstrap (luồng admin setup
 * lần đầu — xong là login lại bình thường qua verify TOTP).
 */
export async function POST(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const limit = await limiter.check(`2fa-confirm:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều lần thử. Thử lại sau một phút." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  let user = await getSessionUser();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = z
    .object({
      code: z.string().min(1).max(16),
      challengeToken: z.string().min(32).max(128).optional(),
      // OTP gửi tới email — bắt buộc khi enroll lần đầu qua challenge (L4),
      // không cần khi user đã login session (đã qua 1 factor + sở hữu phiên).
      emailOtp: z.string().trim().min(6).max(16).optional(),
    })
    .safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Thiếu mã xác thực." }, { status: 422 });
  const viaChallenge = !user;
  if (!user) {
    if (!parsed.data.challengeToken) return NextResponse.json({ error: "Đăng nhập để tiếp tục." }, { status: 401 });
    try {
      const { resolveTotpChallenge } = await import("@/lib/server/two-factor");
      user = await resolveTotpChallenge(parsed.data.challengeToken);
    } catch (error) {
      if (error instanceof TwoFactorError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }
  try {
    // Enroll lần đầu qua challenge: phải có OTP email (kẻ chỉ biết password
    // không enroll được authenticator của mình vào tài khoản nạn nhân).
    if (viaChallenge) {
      if (!parsed.data.emailOtp) {
        return NextResponse.json(
          { error: "Cần mã gửi tới email để bật 2FA lần đầu.", emailOtpRequired: true },
          { status: 422 },
        );
      }
      const { verifyBootstrapOtp } = await import("@/lib/server/email-otp");
      await verifyBootstrapOtp(user.id, parsed.data.emailOtp);
    }
    const result = await confirmTotpSetup(user.id, parsed.data.code);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
