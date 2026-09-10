import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { verifyTotpChallenge, TwoFactorError } from "@/lib/server/two-factor";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { zodFieldErrors } from "@/lib/schemas";

/**
 * POST /api/auth/2fa/verify {challengeToken, code} — bước 2 của login.
 * 5 lần/phút/IP (ngang hàng reset password) chống brute-force 6 số.
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

const schema = z.object({
  challengeToken: z.string().min(32).max(128),
  code: z.string().min(1).max(32),
});

export async function POST(request: NextRequest) {
  const limit = await limiter.check(`2fa:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều lần thử. Thử lại sau một phút." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  try {
    const user = await verifyTotpChallenge(parsed.data.challengeToken, parsed.data.code);
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
