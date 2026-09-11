import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { staffGuardResponse } from "@/lib/server/admin";
import { getSessionUser } from "@/lib/server/session";
import { logAudit } from "@/lib/server/audit";

/**
 * GET  /api/admin/stock?productId=&take= — lịch sử biến động kho (mới nhất trước).
 * POST /api/admin/stock — phiếu nhập/xuất/chốt tồn tay:
 *   { productId, variantId?, mode: "in"|"out"|"set", quantity, reason }
 * Áp tồn + ghi ledger cùng tx. Variant thì cộng dồn cả tổng product
 * (giữ quy ước "tồn product = hiển thị" như luồng đặt hàng).
 */

const MODES = ["in", "out", "set"] as const;

export async function GET(request: NextRequest) {
  const denied = await staffGuardResponse();
  if (denied) return denied;
  const params = request.nextUrl.searchParams;
  const productId = params.get("productId")?.trim() || undefined;
  const take = Math.min(200, Math.max(1, Number(params.get("take")) || 50));
  const movements = await prisma.stockMovement.findMany({
    where: productId ? { productId } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json({ movements });
}

export async function POST(request: NextRequest) {
  const denied = await staffGuardResponse();
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const productId = String(body.productId ?? "").trim();
  const variantId = String(body.variantId ?? "").trim() || null;
  const mode = String(body.mode ?? "");
  const quantity = Number(body.quantity);
  const reason = String(body.reason ?? "").trim();
  if (!productId) return NextResponse.json({ error: "Thiếu sản phẩm." }, { status: 422 });
  if (!(MODES as readonly string[]).includes(mode)) {
    return NextResponse.json({ error: "mode phải là in|out|set." }, { status: 422 });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Số lượng phải là số nguyên dương." }, { status: 422 });
  }
  if (reason.length < 3) {
    return NextResponse.json({ error: "Lý do tối thiểu 3 ký tự (vd: nhập NCC, kiểm kê)." }, { status: 422 });
  }
  const actor = await getSessionUser();

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (variantId) {
        const vari = await tx.productVariant.findUnique({ where: { id: variantId } });
        if (!vari || vari.productId !== productId) {
          throw new Response("Variant không thuộc sản phẩm.", { status: 422 });
        }
        const next = mode === "set" ? quantity : mode === "in" ? vari.stock + quantity : vari.stock - quantity;
        if (next < 0) throw new Response("Tồn variant không đủ để xuất.", { status: 409 });
        await tx.productVariant.update({ where: { id: variantId }, data: { stock: next } });
        // Cộng dồn tổng product theo delta
        const delta = next - vari.stock;
        const prod = await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: delta } },
          select: { stock: true },
        });
        const movement = await tx.stockMovement.create({
          data: {
            productId,
            variantId,
            type: mode === "set" ? "adjust" : mode,
            quantity: delta,
            balanceAfter: next,
            reason,
            createdBy: actor?.id ?? null,
          },
        });
        return { variantStock: next, productStock: prod.stock, movement };
      }
      const prod = await tx.product.findUnique({ where: { id: productId }, select: { stock: true } });
      if (!prod) throw new Response("Không tìm thấy sản phẩm.", { status: 404 });
      const next = mode === "set" ? quantity : mode === "in" ? prod.stock + quantity : prod.stock - quantity;
      if (next < 0) throw new Response("Tồn kho không đủ để xuất.", { status: 409 });
      await tx.product.update({ where: { id: productId }, data: { stock: next } });
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          variantId: null,
          type: mode === "set" ? "adjust" : mode,
          quantity: next - prod.stock,
          balanceAfter: next,
          reason,
          createdBy: actor?.id ?? null,
        },
      });
      return { productStock: next, movement };
    });
    await logAudit(actor, "stock.adjusted", "product", productId, { mode, quantity, reason });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Response) {
      const message = await error.text();
      return NextResponse.json({ error: message || "Không ghi được phiếu kho." }, { status: error.status });
    }
    throw error;
  }
}
