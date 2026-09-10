import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { startTotpSetup, TwoFactorError } from "@/lib/server/two-factor";

/** POST /api/auth/2fa/setup — bắt đầu bật 2FA, trả secret + otpauth URL để quét app. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Đăng nhập để tiếp tục." }, { status: 401 });
  try {
    const result = await startTotpSetup(user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TwoFactorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
