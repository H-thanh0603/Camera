import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/password";
import { createSession } from "@/lib/server/session";
import { createTotpChallenge } from "@/lib/server/two-factor";
import { loginSchema, zodFieldErrors } from "@/lib/schemas";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

/** POST /api/auth/login — xác thực + tạo phiên (2FA: trả challenge bước 2). */

// 10 lần/phút/IP — chống brute-force (Redis đa instance, fallback memory)
const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  if (!(await limiter.check(`login:${ip}`)).allowed) {
    return NextResponse.json({ error: "Quá nhiều lần thử. Thử lại sau một phút." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Thông báo lỗi chung — không tiết lộ email tồn tại hay không
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Tài khoản đã bị khóa. Liên hệ concierge để được hỗ trợ." }, { status: 403 });
  }

  // 2FA bật: không tạo session vội — trả challenge 5 phút cho bước 2.
  if (user.totpEnabled) {
    const challengeToken = await createTotpChallenge(user.id);
    return NextResponse.json({ twoFactorRequired: true, challengeToken });
  }
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}
