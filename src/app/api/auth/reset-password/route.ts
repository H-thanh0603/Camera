import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PasswordResetError, resetPasswordWithToken } from "@/lib/server/password-reset";
import { zodFieldErrors } from "@/lib/schemas";

const schema = z.object({
  token: z.string().min(16, "Token không hợp lệ."),
  password: z.string().min(8, "Mật khẩu cần tối thiểu 8 ký tự."),
});

/** POST /api/auth/reset-password — đặt mật khẩu mới bằng token 1 lần. */
export async function POST(request: NextRequest) {
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
    await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    return NextResponse.json({ ok: true, message: "Mật khẩu đã được đặt lại. Hãy đăng nhập." });
  } catch (error) {
    if (error instanceof PasswordResetError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Không thể đặt lại mật khẩu." }, { status: 500 });
  }
}
