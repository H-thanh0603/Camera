import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { createSession } from "@/lib/server/session";
import { createTotpChallenge } from "@/lib/server/two-factor";
import { loginSchema, zodFieldErrors } from "@/lib/schemas";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { clearLoginFails, isAccountLocked, recordLoginFail } from "@/lib/server/login-attempt";
import { getClientIp } from "@/lib/server/client-ip";

/** POST /api/auth/login — xác thực + tạo phiên (2FA: trả challenge bước 2). */

// 10 lần/phút/IP — chống brute-force (Redis đa instance, fallback memory)
const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

// Hash scrypt hằng định cho email không tồn tại — verify dummy tốn đúng
// 1 lần scrypt như user thật nên timing không phân biệt được (L1).
// Cache theo process; chi phí CPU nằm trong budget của limiter+lockout.
let dummyHash: string | null = null;
async function dummyPasswordHash(): Promise<string> {
  dummyHash ??= await hashPassword(`lumina-dummy-${randomUUID()}`);
  return dummyHash;
}

export async function POST(request: NextRequest) {
  // Production thiếu Redis → rate-limit memory fail-open đa instance:
  // chặn brute-force bằng 503 thay vì cho qua.
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
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

  // Lockout theo tài khoản (chống credential stuffing xoay IP vào 1 email).
  // Check TRƯỚC khi verify password — không tiết lộ email tồn tại (lockout
  // cũng áp cho email chưa đăng ký vì key theo email string).
  const lock = await isAccountLocked(parsed.data.email);
  if (lock.locked) {
    return NextResponse.json(
      { error: "Tài khoản tạm khóa do thử sai quá nhiều. Thử lại sau ít phút." },
      { status: 429, headers: { "Retry-After": String(lock.retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Thông báo lỗi chung + thời gian hằng định: email không tồn tại vẫn
  // chạy 1 lần scrypt với hash dummy (random salt mỗi process) nên timing
  // không phân biệt được tồn tại/không (L1).
  const ok = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : await verifyPassword(parsed.data.password, await dummyPasswordHash());
  if (!user || !ok) {
    await recordLoginFail(parsed.data.email);
    return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
  }
  if (user.isBanned) {
    return NextResponse.json({ error: "Tài khoản đã bị khóa. Liên hệ concierge để được hỗ trợ." }, { status: 403 });
  }
  // Admin BẮT BUỘC 2FA: password đúng nhưng chưa bật TOTP → không cho session,
  // trả challenge bootstrap (5 phút) để setup 2FA ngay (trước đây chỉ banner
  // cảnh báo, vẫn login bình thường — nghĩa là không bắt buộc gì cả).
  if (user.role === "admin" && !user.totpEnabled) {
    await clearLoginFails(parsed.data.email);
    const challengeToken = await createTotpChallenge(user.id);
    return NextResponse.json(
      { error: "Tài khoản quản trị phải bật xác thực 2 bước trước khi đăng nhập.", adminRequires2fa: true, challengeToken },
      { status: 403 },
    );
  }
  await clearLoginFails(parsed.data.email);

  // 2FA bật: không tạo session vội — trả challenge 5 phút cho bước 2.
  if (user.totpEnabled) {
    const challengeToken = await createTotpChallenge(user.id);
    return NextResponse.json({ twoFactorRequired: true, challengeToken });
  }
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
}
