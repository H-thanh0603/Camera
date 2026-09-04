import type { CartLine, CartLineDetail, CartSnapshot, CartTotals, Product, ProductVariant } from "@/lib/types";

/**
 * CartService — logic tính toán giỏ hàng thuần hàm (pure functions).
 * Được test trực tiếp bằng unit test; UI chỉ gọi, không tự tính tiền.
 * LƯU Ý BẢO MẬT: giá/stock/discount cuối cùng phải được backend xác minh
 * khi đặt hàng — số tiền ở đây chỉ mang tính dự kiến hiển thị.
 */

export const FREE_SHIPPING_THRESHOLD = 20_000_000;
export const STANDARD_SHIPPING_FEE = 350_000;

export function resolveVariant(product: Product, variantId?: string): ProductVariant | undefined {
  if (!variantId) return undefined;
  return product.variants?.find((v) => v.id === variantId);
}

export function unitPriceOf(product: Product, variant?: ProductVariant): number {
  return variant?.price ?? product.price;
}

export function unitCompareAtPriceOf(product: Product, variant?: ProductVariant): number | undefined {
  return variant?.compareAtPrice ?? product.compareAtPrice;
}

/** Stock tối đa được phép đặt của một line. */
export function maxQuantityOf(product: Product, variant?: ProductVariant): number {
  const stock = variant?.stock ?? product.stock;
  if (product.availability === "contact" || product.availability === "pre_order") return 0;
  return Math.max(0, Math.min(stock, 10));
}

/** Chuẩn hoá số lượng: min 1, không vượt quá stock. Trả về null nếu không thể mua. */
export function clampQuantity(product: Product, variantId: string | undefined, quantity: number): number | null {
  const variant = resolveVariant(product, variantId);
  const max = maxQuantityOf(product, variant);
  if (max <= 0) return null;
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.min(quantity, max));
}

function buildLineDetail(line: CartLine, product: Product): CartLineDetail | null {
  const variant = resolveVariant(product, line.variantId);
  const maxQuantity = maxQuantityOf(product, variant);
  if (maxQuantity <= 0) return null; // sản phẩm hết hàng / xoá khỏi catalogue

  const unitPrice = unitPriceOf(product, variant);
  const quantity = Math.max(1, Math.min(line.quantity, maxQuantity));
  return {
    ...line,
    quantity,
    product,
    variant,
    unitPrice,
    unitCompareAtPrice: unitCompareAtPriceOf(product, variant),
    lineTotal: unitPrice * quantity,
    maxQuantity,
  };
}

/**
 * Resolve danh sách line thô (persisted) thành chi tiết đầy đủ.
 * Line không hợp lệ (product đã xoá, variant hết hàng, quantity <= 0)
 * sẽ bị lược bỏ thay vì phá vỡ giỏ hàng.
 */
export function buildCartSnapshot(lines: CartLine[], resolveProduct: (id: string) => Product | undefined): CartSnapshot {
  const details: CartLineDetail[] = [];
  for (const line of lines) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) continue;
    const product = resolveProduct(line.productId);
    if (!product) continue;
    const detail = buildLineDetail(line, product);
    if (detail) details.push(detail);
  }

  return { lines: details, totals: calculateTotals(details) };
}

export function calculateTotals(lines: CartLineDetail[]): CartTotals {
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const savings = lines.reduce(
    (sum, l) => sum + Math.max(0, ((l.unitCompareAtPrice ?? l.unitPrice) - l.unitPrice) * l.quantity),
    0,
  );
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  return {
    itemCount,
    subtotal,
    savings,
    shipping,
    total: subtotal + shipping,
    amountToFreeShipping: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
  };
}

/** Gộp line trùng product+variant khi thêm vào giỏ. */
export function mergeLine(
  lines: CartLine[],
  incoming: CartLine,
  resolveProduct: (id: string) => Product | undefined,
): CartLine[] {
  const product = resolveProduct(incoming.productId);
  if (!product) return lines;
  const variant = resolveVariant(product, incoming.variantId);
  const max = maxQuantityOf(product, variant);
  if (max <= 0) return lines;

  const key = (l: CartLine) => `${l.productId}::${l.variantId ?? ""}`;
  const existing = lines.find((l) => key(l) === key(incoming));
  if (!existing) {
    return [...lines, { ...incoming, quantity: Math.max(1, Math.min(incoming.quantity, max)) }];
  }
  return lines.map((l) =>
    key(l) === key(incoming)
      ? { ...l, quantity: Math.max(1, Math.min(l.quantity + incoming.quantity, max)) }
      : l,
  );
}
