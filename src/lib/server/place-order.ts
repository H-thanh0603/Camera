import type { CartTotals, ContactInfo, Order, OrderLine, ShippingInfo } from "@/lib/types";
import { calculateTotals, maxQuantityOf, resolveVariant, unitPriceOf, unitCompareAtPriceOf } from "@/lib/services/cart-service";
import { getProductById, getProductsByIds } from "@/lib/repositories/product-repository";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getSessionUser } from "./session";

/**
 * Đặt hàng phía SERVER — điểm verify cuối cùng:
 * 1. Giá/variant/stock lấy từ catalogue server (client gửi chỉ id + quantity).
 * 2. Totals tính lại từ đầu — client không được tin giá tự tính.
 * 3. Order ghi vào DB, gắn user nếu có phiên.
 */

export const EXPRESS_FEE = 500_000;

const DELIVERY_OPTIONS = new Set(["standard", "express", "pickup"]);
const PAYMENT_OPTIONS = new Set(["bank_transfer", "cod", "card_on_delivery"]);

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
}

function orderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0");
  return `LUM-${stamp}${rand}`;
}

export async function placeOrderServer(input: PlaceOrderInput): Promise<Order> {
  const { contact, shipping, delivery, payment } = input;

  if (!DELIVERY_OPTIONS.has(delivery)) throw new OrderValidationError("Phương thức giao nhận không hợp lệ.");
  if (!PAYMENT_OPTIONS.has(payment)) throw new OrderValidationError("Phương thức thanh toán không hợp lệ.");
  if (!contact?.fullName?.trim() || !contact?.email || !contact?.phone) {
    throw new OrderValidationError("Thông tin liên hệ chưa đầy đủ.");
  }
  if (!shipping?.address?.trim() || !shipping?.ward?.trim() || !shipping?.district?.trim() || !shipping?.city?.trim()) {
    throw new OrderValidationError("Địa chỉ giao hàng chưa đầy đủ.");
  }
  if (!input.lines?.length) throw new OrderValidationError("Đơn hàng trống.");

  // Verify từng line với catalogue server
  const lines: OrderLine[] = [];
  const productIds = [...new Set(input.lines.map((l) => l.productId))];
  const resolved = getProductsByIds(productIds);
  if (resolved.length !== productIds.length) {
    throw new OrderValidationError("Một số sản phẩm không còn tồn tại. Vui lòng xóa khỏi giỏ và thử lại.");
  }

  for (const line of input.lines) {
    const product = getProductById(line.productId);
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
    const product = getProductById(l.productId)!;
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

  const user = await getSessionUser();
  const dbOrder = await prisma.order.create({
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
      lines: {
        create: finalLines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId ?? null,
          name: l.name,
          variantName: l.variantName ?? null,
          unitPrice: l.unitPrice,
          quantity: l.quantity,
          image: l.image,
          sku: resolveVariant(getProductById(l.productId)!, l.variantId)?.sku ?? getProductById(l.productId)!.sku,
        })),
      },
    },
    include: { lines: true },
  });

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
  };
}
