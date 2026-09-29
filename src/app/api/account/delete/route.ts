import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/session";
import { deleteOwnAccount, AccountError } from "@/lib/server/account";
import { sendEmailOtp } from "@/lib/server/email-otp";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { zodFieldErrors } from "@/lib/schemas";

/**
 * POST /api/account/delete — tự xóa tài khoản (GDPR).
 * Tài khoản mật khẩu: xác nhận bằng password. Tài khoản Google OAuth: OTP
 * email 2 bước (requestOtp:true → gửi mã; otp → xác nhận xóa, F7).
 * Không xóa được admin cuối cùng. 3 lần/phút/IP.
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 3 });

const schema = z.object({
  password: z.string().min(1).optional(),
  otp: z.string().trim().regex(/^\d{6}$/, "Mã xác nhận 6 số.").optional(),
  requestOtp: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
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
    // Bước 1 luồng OAuth: gửi OTP xác nhận xóa tới email sở hữu tài khoản.
    if (parsed.data.requestOtp) {
      const row = await prisma.user.findUnique({ where: { id: user.id } });
      if (!row) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
      if (!row.passwordHash.startsWith("oauth:")) {
        return NextResponse.json(
          { error: "Tài khoản mật khẩu xác nhận bằng mật khẩu, không cần mã email." },
          { status: 422 },
        );
      }
      await sendEmailOtp(
        user.id,
        row.email,
        "account-delete",
        "Mã xác nhận xóa tài khoản — Lumina Optics",
        "account-delete-otp",
        "Nhập mã dưới đây để xác nhận xóa tài khoản",
      );
      return NextResponse.json({ otpSent: true });
    }
    await deleteOwnAccount(user.id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
