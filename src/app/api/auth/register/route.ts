import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { hashPassword } from "@/lib/server/password";
import { createSession } from "@/lib/server/session";
import { registerSchema, zodFieldErrors } from "@/lib/schemas";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

/**
 * POST /api/auth/register — tạo user + phiên đăng nhập.
 * Trả 202 chung cho cả email mới và email đã tồn tại (chống enumerate —
 * không phân biệt được qua status/body/timing, M7).
 */

// 5 lần/phút/IP — chống spam đăng ký (Redis đa instance, fallback memory)
const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

/**
 * Response đăng ký: luôn 202 + body Y HỆT NHAU (user:null + message chung).
 * Trả object user khi tạo mới là oracle enumerate email (F1) — client tự
 * nhận diện phiên mới qua GET /api/auth/me thay vì đọc body.
 */
function registerResponse() {
  return NextResponse.json(
    { user: null, message: "Nếu email chưa được dùng, tài khoản đã được tạo. Kiểm tra email để xác nhận." },
    { status: 202 },
  );
}

export async function POST(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const ip = getClientIp(request.headers);
  if (!(await limiter.check(`register:${ip}`)).allowed) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu. Thử lại sau một phút." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Email đã tồn tại: TRẢ Y HỆT response thành công (202 + message chung,
    // không session mới) — attacker không phân biệt được qua status/body (M7).
    return registerResponse();
  }

  let user;
  try {
    user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
  } catch (error) {
    // P2002 = unique constraint — 2 request cùng email chạm DB đồng thời
    if ((error as { code?: string }).code === "P2002") {
      return registerResponse();
    }
    throw error;
  }

  await createSession(user.id);
  return registerResponse();
}
