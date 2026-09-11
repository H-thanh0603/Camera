import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import type { Prisma } from "@/generated/prisma/client";

/** GET /api/admin/orders — đơn mới nhất trước (?status=&page=&pageSize=). */

const VALID_STATUS = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

export async function GET(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const status = params.get("status") ?? "all";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(60, Math.max(1, Number(params.get("pageSize")) || 20));
  const where: Prisma.OrderWhereInput =
    status !== "all" && VALID_STATUS.includes(status) ? { status } : {};

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: { lines: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return NextResponse.json({
    orders,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
