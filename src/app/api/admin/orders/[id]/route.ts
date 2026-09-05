import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import type { OrderStatus } from "@/lib/types";

/**
 * PATCH /api/admin/orders/:id — đổi trạng thái đơn.
 * currentStep đồng bộ theo status (timeline 7 bước).
 */

const VALID: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

const STATUS_TO_STEP: Partial<Record<OrderStatus, string>> = {
  pending: "confirmed",
  paid: "confirmed",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "confirmed",
  refunded: "confirmed",
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const { id } = await params;
  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const status = body.status as OrderStatus | undefined;
  if (!status || !VALID.includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 422 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { lines: true } });
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn." }, { status: 404 });

  const currentStep = STATUS_TO_STEP[status] ?? order.currentStep;
  await prisma.order.update({ where: { id }, data: { status, currentStep } });
  await logAudit(await getSessionUser(), "order.status", "order", id, { from: order.status, to: status });
  return NextResponse.json({ ok: true, status, currentStep });
}
