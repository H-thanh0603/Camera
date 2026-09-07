import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PasswordResetError, resetPasswordWithToken } from "@/lib/server/password-reset";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { zodFieldErrors } from "@/lib/schemas";

const schema = z.object({
  token: z.string().min(16, "Token không hợp lệ."),
  password: z.string().min(8, "Mật khẩu cần tối thiểu 8 ký tự."),
});

// 5 lần/phút/IP — token 256-bit nhưng vẫn cần chống spam/probe
const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

/** POST /api/auth/reset-password — đặt mật khẩu mới bằng token 1 lần. */
export async function POST(request: NextRequest) {
  const limit = await limiter.check(`reset:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
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
    await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    return NextResponse.json({ ok: true, message: "Mật khẩu đã được đặt lại. Hãy đăng nhập." });
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Không thể đặt lại mật khẩu." }, { status: 500 });
  }
}
