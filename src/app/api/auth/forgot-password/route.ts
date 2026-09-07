import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/server/password-reset";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";

const schema = z.object({ email: z.string().trim().email("Email không hợp lệ.") });
const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

/** POST /api/auth/forgot-password — luôn trả ok (chống enumerate email). */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await limiter.check(`forgot:${ip}`);
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
  if (!parsed.success) return NextResponse.json({ error: "Email không hợp lệ." }, { status: 422 });
  await requestPasswordReset(parsed.data.email);
  return NextResponse.json({ ok: true, message: "Nếu email tồn tại, link đặt lại đã được gửi." });
}
