import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";

/** GET /api/admin/orders — toàn bộ đơn hàng mới nhất trước. */

export async function GET() {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const orders = await prisma.order.findMany({ include: { lines: true }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ orders });
}
