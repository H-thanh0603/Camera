import { NextResponse } from "next/server";
import { takeOAuth2faChallenge } from "@/lib/server/oauth";

/**
 * GET /api/auth/google/challenge — đọc challenge 2FA do OAuth callback set
 * (cookie httpOnly, đọc 1 lần rồi xóa). Account page poll sau redirect
 * `?oauth=2fa` rồi mở form nhập code như login password.
 */
export async function GET() {
  const challengeToken = await takeOAuth2faChallenge();
  if (!challengeToken) return NextResponse.json({ error: "Không có phiên xác thực." }, { status: 404 });
  return NextResponse.json({ challengeToken });
}
