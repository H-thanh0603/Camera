import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { prisma } from "@/lib/server/prisma";
import { formatVND } from "@/lib/utils/format";

/**
 * POST /api/kit/share-email — gửi tóm tắt kit trong giỏ qua email user.
 * User chủ động bấm (không spam). Tối đa 20 món, enqueue qua email queue.
 */

const schema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(10) })).min(1).max(20),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Đăng nhập để gửi kit qua email." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Danh sách kit chưa hợp lệ." }, { status: 422 });

  const ids = [...new Set(parsed.data.items.map((i) => i.productId))];
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, price: true } });
  if (!rows.length) return NextResponse.json({ error: "Không tìm thấy sản phẩm nào." }, { status: 422 });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lines = parsed.data.items.flatMap((i) => {
    const p = byId.get(i.productId);
    return p ? [{ ...p, quantity: i.quantity }] : [];
  });
  const total = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const rowsHtml = lines.map((l) => `<tr><td>${l.name} × ${l.quantity}</td><td style="text-align:right">${formatVND(l.price * l.quantity)}</td></tr>`).join("");

  const { enqueueEmail, getQueueRedis } = await import("@/lib/server/email-queue");
  const { sendEmail } = await import("@/lib/server/email");
  const mail = {
    kind: "kit-share",
    to: user.email,
    subject: `Bộ kit của bạn tại Lumina Optics (${lines.length} món)`,
    html: `<div style="font-family:sans-serif;max-width:560px"><h2>Bộ kit bạn đang ráp</h2><table style="width:100%">${rowsHtml}</table><p><strong>Tổng: ${formatVND(total)}</strong></p><p>Kit được giữ trong giỏ — quay lại bất cứ lúc nào để thanh toán.</p></div>`,
  };
  const { queued } = await enqueueEmail(getQueueRedis(), mail);
  if (!queued) await sendEmail(mail);
  return NextResponse.json({ ok: true, emailed: lines.length });
}
