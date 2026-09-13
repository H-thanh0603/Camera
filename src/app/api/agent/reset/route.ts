/**
 * POST /api/agent/reset — xoá phiên chat server-side (nút "hội thoại mới").
 * Xoá row theo cookie agent_sid và clear cookie. Idempotent, không lỗi khi
 * session không tồn tại.
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { AGENT_SID_COOKIE, deleteAgentSession } from "@/lib/server/agent-session";

export const runtime = "nodejs";

export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const sid = cookieStore.get(AGENT_SID_COOKIE)?.value;
  await deleteAgentSession(sid);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AGENT_SID_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
