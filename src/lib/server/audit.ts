import type { SessionUser } from "@/lib/types";
import { prisma } from "./prisma";

/**
 * Audit log — ghi lại mọi hành động quản trị (ai, làm gì, với cái gì, lúc nào).
 * Không bao giờ throw: audit thất bại không được phá vỡ thao tác chính.
 */

export async function logAudit(
  user: SessionUser | null,
  action: string,
  targetType: string,
  targetId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: user?.id ?? null,
        action,
        targetType,
        targetId,
        meta: (meta ?? null) as never,
      },
    });
  } catch (error) {
    console.error(JSON.stringify({ type: "audit", level: "error", action, error: String(error) }));
  }
}

export async function recentAuditLogs(limit = 10) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
}
