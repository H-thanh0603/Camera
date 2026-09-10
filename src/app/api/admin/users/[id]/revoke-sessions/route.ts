import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse, getSessionUserWithRole } from "@/lib/server/admin";
import { revokeUserSessions } from "@/lib/server/session";
import { logAudit } from "@/lib/server/audit";

/**
 * POST /api/admin/users/:id/revoke-sessions — đá toàn bộ phiên của 1 tài
 * khoản (mất máy, nghi lộ session). Không tự đá chính mình (dùng logout).
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const actor = await getSessionUserWithRole();
  const { id } = await params;
  if (actor && actor.id === id) {
    return NextResponse.json({ error: "Muốn đăng xuất chính mình, dùng Đăng xuất." }, { status: 409 });
  }
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
  const revoked = await revokeUserSessions(id);
  await logAudit(actor, "user.sessions_revoked", "User", id, { email: target.email, revoked });
  return NextResponse.json({ ok: true, revoked });
}
