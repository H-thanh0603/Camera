import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse, getSessionUserWithRole } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";

/** GET /api/admin/users — danh sách tài khoản (?q=&page=&pageSize=). */

export async function GET(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(60, Math.max(1, Number(params.get("pageSize")) || 20));
  const where = q
    ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] }
    : {};

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBanned: true,
        createdAt: true,
        _count: { select: { orders: true, reviews: true } },
      },
    }),
  ]);
  return NextResponse.json({
    users: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
