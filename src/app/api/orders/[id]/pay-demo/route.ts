import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getOwnOrder } from "@/lib/server/order-mapper";

/**
 * POST /api/orders/:id/pay-demo — XÁC NHẬN THANH TOÁN DEMO.
 *
 * Chỉ bật khi PAYMENT_DEMO_MODE=true (mặc định cho đồ án). Đây là chỗ
 * duy nhất "giả lập" tiền: không có giao dịch thật, chỉ đánh dấu đơn
 * thành `paid` để demo luồng order tracking.
 *
 * SẢN XUẤT: thay bằng webhook của cổng thanh toán (VNPay/MoMo/Stripe) —
 * webhook verify chữ ký HMAC rồi mới chuyển trạng thái. Endpoint này bị xóa.
 */

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (process.env.PAYMENT_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo payment đang tắt." }, { status: 403 });
  }

  const { id } = await params;
  const order = await getOwnOrder(id);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  if (order.status !== "pending") {
    return NextResponse.json({ error: "Đơn hàng không ở trạng thái chờ thanh toán." }, { status: 409 });
  }

  await prisma.order.update({ where: { id }, data: { status: "paid" } });
  return NextResponse.json({ order: { ...order, status: "paid" as const } });
}
