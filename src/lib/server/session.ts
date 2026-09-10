import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { SessionUser } from "@/lib/types";
import { prisma } from "./prisma";

/**
 * Session management: cookie httpOnly chứa token ngẫu nhiên; DB chỉ lưu
 * SHA-256(token) — lộ DB không đủ để mạo danh phiên.
 */

export const SESSION_COOKIE = "lumina.session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày sliding
const SESSION_ABSOLUTE_MAX_MS = 90 * 24 * 60 * 60 * 1000; // trần tuyệt đối 90 ngày
const MAX_SESSIONS_PER_USER = 5; // quá → thu hồi phiên cũ nhất (chống session farm)

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  // Giới hạn số phiên đồng thời: xóa phiên cũ nhất vượt quota.
  const ids = await prisma.session.findMany({
    where: { userId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    skip: MAX_SESSIONS_PER_USER,
  });
  if (ids.length > 0) {
    await prisma.session.deleteMany({ where: { id: { in: ids.map((s) => s.id) } } });
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
  });
}

/** Admin đá toàn bộ phiên của 1 tài khoản (mất máy, nghi lộ session). */
export async function revokeUserSessions(userId: string): Promise<number> {
  const res = await prisma.session.deleteMany({ where: { userId } });
  return res.count;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  const now = new Date();
  if (session.expiresAt < now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Trần tuyệt đối từ lúc tạo — sliding không gia hạn mãi được.
  if (now.getTime() - session.createdAt.getTime() > SESSION_ABSOLUTE_MAX_MS) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Sliding: còn dưới nửa TTL thì gia hạn thêm 1 TTL (không chạm DB mỗi request).
  if (session.expiresAt.getTime() - now.getTime() < SESSION_TTL_MS / 2) {
    await prisma.session
      .update({ where: { id: session.id }, data: { expiresAt: new Date(now.getTime() + SESSION_TTL_MS) } })
      .catch(() => undefined);
  }
  // Tài khoản bị khóa sau khi đã login → đá phiên ngay
  if (session.user.isBanned) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return { id: session.user.id, name: session.user.name, email: session.user.email };
}
