import { NextResponse } from "next/server";
import { beginGoogleLogin, isGoogleConfigured } from "@/lib/server/oauth";

/** GET /api/auth/google — bắt đầu OAuth: redirect sang Google. */
export async function GET() {
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Đăng nhập Google chưa được cấu hình." }, { status: 503 });
  }
  return NextResponse.redirect(await beginGoogleLogin());
}
