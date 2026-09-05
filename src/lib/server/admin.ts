import { NextResponse } from "next/server";
import { getSessionUser } from "./session";
import type { SessionUser } from "@/lib/types";

/**
 * Admin guard cho API routes. Role nằm trong DB — không thể tự gán từ client.
 * Admin UI (server layout) dùng isAdmin() để chặn truy cập trang.
 */

export async function getSessionUserWithRole(): Promise<(SessionUser & { role: string }) | null> {
  const user = await getSessionUser();
  if (!user) return null;
  // getSessionUser chỉ trả {id,name,email} — tra role từ DB theo id
  const { prisma } = await import("./prisma");
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  return dbUser ? { ...user, role: dbUser.role } : null;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUserWithRole();
  return user?.role === "admin";
}

/** Dùng trong route handler: trả 403 response nếu không phải admin, ngược lại null. */
export async function adminGuardResponse(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ error: "Chỉ admin mới có quyền này." }, { status: 403 });
}
