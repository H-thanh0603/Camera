import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { disableTotp, TwoFactorError } from "@/lib/server/two-factor";

/** POST /api/auth/2fa/disable {code} — tắt 2FA bằng code hiện tại. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Đăng nhập để tiếp tục." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = z.object({ code: z.string().min(1).max(32) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Thiếu mã xác thực." }, { status: 422 });
  try {
    await disableTotp(user.id, parsed.data.code);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
