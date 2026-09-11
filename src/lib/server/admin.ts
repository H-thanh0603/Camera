import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSessionUser } from "./session";
import type { SessionUser } from "@/lib/types";

/**
 * Phân quyền quản trị:
 * - admin: toàn quyền (catalogue, tiền, user, nội dung, vận hành).
 * - staff: vận hành (đơn hàng, kho, đổi trả, kiểm duyệt review).
 * - customer: không vào /admin.
 * Tiền (refund) và user/role giữ admin-only. Role nằm trong DB.
 */

export const STAFF_ROLES = ["admin", "staff"] as const;

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

/** Nhân sự vận hành: admin hoặc staff. */
export async function isStaff(): Promise<boolean> {
  const user = await getSessionUserWithRole();
  return user?.role === "admin" || user?.role === "staff";
}

/** Dùng trong route handler: trả 403 response nếu không phải admin, ngược lại null. */
export async function adminGuardResponse(): Promise<NextResponse | null> {
  if (await isAdmin()) return null;
  return NextResponse.json({ error: "Chỉ admin mới có quyền này." }, { status: 403 });
}

/** Dùng trong route handler vận hành: admin hoặc staff, ngược lại 403. */
export async function staffGuardResponse(): Promise<NextResponse | null> {
  if (await isStaff()) return null;
  return NextResponse.json({ error: "Chỉ nhân sự vận hành mới có quyền này." }, { status: 403 });
}

/** Dùng trong server page: redirect về /account nếu không phải admin. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect("/account");
}
