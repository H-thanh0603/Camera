import type { CartTotals, ContactInfo, Order, OrderLine, Product, ShippingInfo } from "@/lib/types";
import { calculateTotals, maxQuantityOf, resolveVariant, unitPriceOf, unitCompareAtPriceOf } from "@/lib/services/cart-service";
import { applyCouponToSubtotal, normalizeCouponCode } from "@/lib/services/coupon-service";
import { dbGetProductById } from "./product-db";
import { hashGuestToken, newGuestToken } from "./guest-token";
import { getCouponByCode } from "./coupons";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { getSessionUser } from "./session";
import { logger } from "./logger";
import { logAudit } from "./audit";

/**
 * Đặt hàng phía SERVER — điểm verify cuối cùng:
 * 1. Giá/variant/stock lấy từ catalogue server (client gửi chỉ id + quantity).
 * 2. Totals tính lại từ đầu — client không được tin giá tự tính.
 * 3. Order ghi vào DB, gắn user nếu có phiên.
 */

export const EXPRESS_FEE = 500_000;


export class OrderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

export interface IncomingLine {
  productId: string;
  variantId?: string;
  quantity: number;
}

export interface PlaceOrderInput {
  contact: ContactInfo;
  shipping: ShippingInfo;
  delivery: string;
  payment: string;
  lines: IncomingLine[];
  /** Chống double-submit: key trùng → trả về đơn đã tạo thay vì tạo mới. */
  idempotencyKey?: string;
  couponCode?: string;
  /**
   * Token sở hữu đơn guest do CLIENT sinh 1 lần/intent (cùng vòng đời với
   * idempotencyKey). Server chỉ lưu SHA-256. Retry cùng intent gửi lại token
   * cũ để server đối chiếu — response mất mạng vẫn không bị khóa đơn.
   * Bỏ trống → server tự sinh và trả về 1 lần.
   */
  guestToken?: string;
}

function orderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  // 3 random bytes (16M combo) — tránh va chạm unique khi nhiều đơn cùng ms
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `LUM-${stamp}${rand}`;
}

/** Verify line với catalogue server (DB) + tính totals. */
export async function verifyAndPriceLines(
  inputLines: IncomingLine[],
  delivery: string,
  resolveProduct: (id: string) => Promise<Product | null>,
): Promise<{ finalLines: OrderLine[]; totals: CartTotals }> {
  // Verify từng line với catalogue server
  const lines: OrderLine[] = [];
  const productIds = [...new Set(inputLines.map((l) => l.productId))];
  const resolved = (await Promise.all(productIds.map((id) => resolveProduct(id)))).filter(
    (p): p is Product => Boolean(p),
  );
  if (resolved.length !== productIds.length) {
    throw new OrderValidationError("Một số sản phẩm không còn tồn tại. Vui lòng xóa khỏi giỏ và thử lại.");
  }

  for (const line of inputLines) {
    const product = await resolveProduct(line.productId);
    if (!product) throw new OrderValidationError(`Sản phẩm ${line.productId} không còn tồn tại.`);
    const variant = resolveVariant(product, line.variantId);
    if (line.variantId && !variant) throw new OrderValidationError(`Phiên bản của "${product.name}" không còn hợp lệ.`);

    const max = maxQuantityOf(product, variant);
    if (max <= 0) throw new OrderValidationError(`"${product.name}" hiện không thể mua trực tuyến.`);
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new OrderValidationError(`Số lượng của "${product.name}" không hợp lệ.`);
    }
    const quantity = Math.min(line.quantity, max);

    lines.push({
      productId: product.id,
      variantId: variant?.id,
      name: product.name,
      variantName: variant?.name,
      unitPrice: unitPriceOf(product, variant),
      quantity,
      image: product.thumbnail.url,
    });
  }

  // Gộp line trùng (product + variant) trước khi tính tiền
  const merged = new Map<string, OrderLine>();
  for (const l of lines) {
    const key = `${l.productId}::${l.variantId ?? ""}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += l.quantity;
    else merged.set(key, l);
  }
  const finalLines = [...merged.values()];

  // Server tính totals: express cộng phí vào shipping
  const detailLines = finalLines.map((l) => {
    const product = resolved.find((p) => p.id === l.productId)!;
    const variant = resolveVariant(product, l.variantId);
    return {
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      unitCompareAtPrice: unitCompareAtPriceOf(product, variant),
    };
  });
  const totals: CartTotals = calculateTotals(detailLines as never);
  if (delivery === "express") {
    totals.shipping += EXPRESS_FEE;
    totals.total += EXPRESS_FEE;
  }
  return { finalLines, totals };
}

const GUEST_TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

export async function placeOrderServer(input: PlaceOrderInput): Promise<Order> {
  const { contact, shipping, delivery, payment } = input;

  if (input.guestToken && !GUEST_TOKEN_RE.test(input.guestToken)) {
    throw new OrderValidationError("Token bảo mật đơn hàng không hợp lệ.");
  }

  // Idempotency: request trùng key (retry mạng, double-click) trả lại đơn cũ.
  // Đơn guest: đối chiếu token chống chiếm đơn — token sai → 403, không lộ đơn.
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { lines: true },
    });
    if (existing) {
      const { dbOrderToDomain, OrderForbidden } = await import("./order-mapper");
      const { verifyGuestToken } = await import("./guest-token");
      const row = existing as unknown as { userId?: string | null; guestTokenHash?: string | null };
      if (!row.userId && row.guestTokenHash) {
        if (!verifyGuestToken(input.guestToken ?? "", row.guestTokenHash)) {
          throw new OrderForbidden("Token bảo mật đơn hàng không đúng.");
        }
      }
      const order = dbOrderToDomain(existing);
      // Trả lại token caller đã gửi để client persist (server không lưu raw).
      if (!row.userId && input.guestToken) order.guestToken = input.guestToken;
      return order;
    }
  }

  const finalProducts: Product[] = [];
  const { finalLines, totals: baseTotals } = await verifyAndPriceLines(input.lines, delivery, async (id) => {
    const p = await dbGetProductById(id);
    if (p) finalProducts.push(p);
    return p;
  });

  // Coupon: server verify từ DB, tính discount trên subtotal (trước phí ship)
  let totals: CartTotals = baseTotals;
  let appliedCoupon: string | undefined;
  let appliedCouponMaxUses: number | null = null;
  const rawCoupon = input.couponCode?.trim();
  if (rawCoupon) {
    const code = normalizeCouponCode(rawCoupon);
    const coupon = await getCouponByCode(code);
    if (!coupon) throw new OrderValidationError(`Mã "${code}" không tồn tại.`);
    const { discount, reason } = applyCouponToSubtotal(baseTotals.subtotal, coupon);
    if (reason) throw new OrderValidationError(reason);
    if (discount <= 0) throw new OrderValidationError(`Mã "${code}" không áp dụng được cho đơn này.`);
    if (coupon.kind === "fixed" || coupon.kind === "percent") {
      // kiểm tra giới hạn lượt dùng
      const row = await prisma.coupon.findUnique({ where: { code } });
      if (!row?.active) throw new OrderValidationError(`Mã "${code}" đã bị vô hiệu.`);
      if (row.maxUses != null && row.usedCount >= row.maxUses) {
        throw new OrderValidationError(`Mã "${code}" đã hết lượt sử dụng.`);
      }
      appliedCouponMaxUses = row.maxUses;
    }
    totals = {
      ...baseTotals,
      discount,
      couponCode: code,
      total: baseTotals.total - discount,
    };
    appliedCoupon = code;
  }

  const productById = (id: string) => finalProducts.find((p) => p.id === id)!;
  const user = await getSessionUser();
  // Đơn guest: token client gửi (hoặc server sinh) — DB chỉ lưu hash.
  const rawGuestToken = user ? undefined : (input.guestToken ?? newGuestToken());
  const guestTokenHash = rawGuestToken ? hashGuestToken(rawGuestToken) : null;

  // Transaction: trừ kho nguyên tử + tạo đơn. Chống oversell khi 2 người
  // mua cùng lúc: updateMany có điều kiện stock >= qty, affected==0 → hết hàng.
  // Trùng idempotencyKey đồng thời (P2002): trả về đơn đã tạo thay vì 500.
  let dbOrder;
  let outboxId: string | null = null;
  try {
    dbOrder = await prisma.$transaction(async (tx) => {
    for (const l of finalLines) {
      if (l.variantId) {
        const res = await tx.productVariant.updateMany({
          where: { id: l.variantId, stock: { gte: l.quantity } },
          data: { stock: { decrement: l.quantity } },
        });
        if (res.count === 0) {
          throw new OrderValidationError(`"${l.name}" vừa hết hàng. Vui lòng giảm số lượng.`);
        }
        // trừ kho tổng của product để số hiển thị khớp
        await tx.product.updateMany({
          where: { id: l.productId, stock: { gte: l.quantity } },
          data: { stock: { decrement: l.quantity } },
        });
      } else {
        const res = await tx.product.updateMany({
          where: { id: l.productId, stock: { gte: l.quantity } },
          data: { stock: { decrement: l.quantity } },
        });
        if (res.count === 0) {
          throw new OrderValidationError(`"${l.name}" vừa hết hàng. Vui lòng giảm số lượng.`);
        }
      }
    }

    if (appliedCoupon) {
      // Điều kiện usedCount < maxUses ngay trong UPDATE — chống race vượt
      // giới hạn lượt dùng khi 2 request cộng gộp đồng thời.
      const res = await tx.coupon.updateMany({
        where: appliedCouponMaxUses
          ? { code: appliedCoupon, usedCount: { lt: appliedCouponMaxUses } }
          : { code: appliedCoupon },
        data: { usedCount: { increment: 1 } },
      });
      if (res.count === 0) {
        throw new OrderValidationError(`Mã "${appliedCoupon}" vừa hết lượt sử dụng.`);
      }
    }

    const created = await tx.order.create({
      data: {
        number: orderNumber(),
        userId: user?.id ?? null,
        status: "pending",
        currentStep: "confirmed",
        contact: contact as unknown as Prisma.InputJsonValue,
        shipping: shipping as unknown as Prisma.InputJsonValue,
        delivery,
        payment,
        totals: totals as unknown as Prisma.InputJsonValue,
        totalAmount: totals.total,
        idempotencyKey: input.idempotencyKey ?? null,
        guestTokenHash,
        lines: {
          create: finalLines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId ?? null,
            name: l.name,
            variantName: l.variantName ?? null,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
            image: l.image,
            sku: resolveVariant(productById(l.productId), l.variantId)?.sku ?? productById(l.productId)!.sku,
          })),
        },
      },
      include: { lines: true },
    });
    // Outbox mail ghi CÙNG tx đặt hàng — đơn commit thì mail không mất.
    const { saveOutboxEmail } = await import("./email-outbox");
    const { orderConfirmationHtml } = await import("./email");
    outboxId = await saveOutboxEmail(
      {
        kind: "order-confirmation",
        to: contact.email,
        subject: `Xác nhận đơn hàng ${created.number} — Lumina Optics`,
        html: orderConfirmationHtml(created.number, totals.total, contact.fullName),
      },
      tx,
    );
    return created;
  });
  } catch (error) {
    // Trùng key đồng thời: tx thua đã ROLLBACK toàn bộ (kể cả trừ kho) khi
    // P2002 — chỉ cần trả về đơn của bên thắng.
    if (
      input.idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { lines: true },
      });
      if (existing) {
        const { dbOrderToDomain, OrderForbidden } = await import("./order-mapper");
        const { verifyGuestToken } = await import("./guest-token");
        const row = existing as unknown as { userId?: string | null; guestTokenHash?: string | null };
        if (!row.userId && row.guestTokenHash) {
          if (!verifyGuestToken(input.guestToken ?? "", row.guestTokenHash)) {
            throw new OrderForbidden("Token bảo mật đơn hàng không đúng.");
          }
        }
        const order = dbOrderToDomain(existing);
        if (!row.userId && input.guestToken) order.guestToken = input.guestToken;
        return order;
      }
    }
    throw error;
  }

  logger.info("order.placed", {
    orderId: dbOrder.id,
    number: dbOrder.number,
    total: totals.total,
    coupon: appliedCoupon ?? null,
    userId: user?.id ?? "guest",
  });
  await logAudit(user ? { id: user.id, name: user.name, email: user.email } : null, "order.placed", "Order", dbOrder.id, {
    number: dbOrder.number,
    total: totals.total,
    coupon: appliedCoupon ?? null,
  });

  // Dispatch mail xác nhận best-effort (không chặn response). Job đã nằm
  // trong outbox cùng tx đặt hàng nên gửi fail vẫn còn worker quét lại.
  if (outboxId) {
    const id = outboxId;
    void import("./email-outbox")
      .then(({ dispatchOutboxSoon }) => dispatchOutboxSoon(id))
      .catch(() => undefined);
  }

  return {
    id: dbOrder.id,
    number: dbOrder.number,
    createdAt: dbOrder.createdAt.toISOString(),
    status: "pending",
    currentStep: "confirmed",
    contact,
    shipping,
    delivery: delivery as Order["delivery"],
    payment: payment as Order["payment"],
    totals,
    lines: finalLines,
    // Raw token trả đúng 1 lần — client lưu ngay, server không bao giờ trả lại.
    ...(rawGuestToken ? { guestToken: rawGuestToken } : {}),
  };
}
