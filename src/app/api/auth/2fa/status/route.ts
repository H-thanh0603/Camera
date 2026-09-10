import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/session";

/** GET /api/auth/2fa/status — phiên hiện tại đã bật 2FA chưa (banner admin). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ enabled: false });
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { totpEnabled: true } });
  return NextResponse.json({ enabled: row?.totpEnabled ?? false });
}
