import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getOwnOrder } from "@/lib/server/order-mapper";
import { CANCELLABLE_STATUSES } from "@/lib/server/order-status";

/** POST /api/orders/:id/cancel — hủy đơn (chỉ chủ sở hữu, ở trạng thái cho phép). */

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOwnOrder(id);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return NextResponse.json({ error: "Đơn hàng đang giao không thể hủy." }, { status: 409 });
  }

  await prisma.order.update({ where: { id }, data: { status: "cancelled" } });
  return NextResponse.json({ order: { ...order, status: "cancelled" } });
}
