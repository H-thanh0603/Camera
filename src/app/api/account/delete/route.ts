import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { deleteOwnAccount, AccountError } from "@/lib/server/account";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { zodFieldErrors } from "@/lib/schemas";

/**
 * POST /api/account/delete — tự xóa tài khoản (GDPR).
 * Tài khoản mật khẩu: xác nhận bằng password. Tài khoản Google OAuth:
 * nhập lại email. Không xóa được admin cuối cùng. 3 lần/phút/IP.
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 3 });

const schema = z.object({
  password: z.string().min(1).optional(),
  confirmEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  const limit = await limiter.check(`account-delete:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  try {
    await deleteOwnAccount(user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
