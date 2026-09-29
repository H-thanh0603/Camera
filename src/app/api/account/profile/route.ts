import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/session";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { zodFieldErrors } from "@/lib/schemas";

/**
 * PATCH /api/account/profile — cập nhật hồ sơ (hiện tại: tên hiển thị).
 * Đổi email không làm ở đây vì đăng ký chưa có bước xác minh email —
 * đổi email = cần flow verify riêng để không mở surface chiếm tài khoản.
 */

const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

const schema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên.").max(80, "Tên tối đa 80 ký tự."),
});

export async function PATCH(request: NextRequest) {
  const limit = await limiter.check(`account-profile:${getClientIp(request.headers)}`);
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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
    select: { id: true, name: true, email: true },
  });
  return NextResponse.json({ user: updated });
}
