import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/session";
import { verifyPassword, hashPassword } from "@/lib/server/password";
import { revokeOtherSessions } from "@/lib/server/session";
import { logAudit } from "@/lib/server/audit";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { zodFieldErrors } from "@/lib/schemas";

/**
 * POST /api/account/password — đổi mật khẩu khi đang đăng nhập.
 * Bắt buộc mật khẩu hiện tại (yếu tố 1); xong đá mọi phiên KHÁC (thiết bị lạ
 * mất quyền), giữ phiên hiện tại. Tài khoản Google OAuth chưa có mật khẩu:
 * hướng sang "Quên mật khẩu" để đặt lần đầu.
 */

const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

const schema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
  newPassword: z.string().min(8, "Mật khẩu cần tối thiểu 8 ký tự."),
});

export async function POST(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const limit = await limiter.check(`account-password:${getClientIp(request.headers)}`);
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

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
  if (row.passwordHash.startsWith("oauth:")) {
    return NextResponse.json(
      { error: "Tài khoản Google chưa có mật khẩu. Dùng Quên mật khẩu để đặt lần đầu." },
      { status: 409 },
    );
  }
  if (!(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) {
    return NextResponse.json(
      { error: "Mật khẩu hiện tại không đúng.", fieldErrors: { currentPassword: "Mật khẩu hiện tại không đúng." } },
      { status: 401 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  const revoked = await revokeOtherSessions(user.id);
  await logAudit(user, "user.password_changed", "User", user.id, { revokedOtherSessions: revoked });
  return NextResponse.json({ ok: true, revokedOtherSessions: revoked });
}
