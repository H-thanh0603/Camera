import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { verifyPassword } from "@/lib/server/password";
import { createSession } from "@/lib/server/session";
import { createRateLimiter } from "@/lib/utils/rate-limit";

/** POST /api/auth/login — xác thực + tạo phiên. */

// 10 lần/phút/IP — chống brute-force
const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiter.check(`login:${ip}`).allowed) {
    return NextResponse.json({ error: "Quá nhiều lần thử. Thử lại sau một phút." }, { status: 429 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu." }, { status: 422 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Thông báo lỗi chung — không tiết lộ email tồn tại hay không
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
  }

  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}
