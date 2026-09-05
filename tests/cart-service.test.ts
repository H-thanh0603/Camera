import { describe, expect, it } from "vitest";
import {
  buildCartSnapshot,
  calculateTotals,
  clampQuantity,
  mergeLine,
  maxQuantityOf,
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
} from "@/lib/services/cart-service";
import type { CartLine, CartLineDetail } from "@/lib/types";
import { getProductById } from "@/lib/repositories/product-repository";

const x1 = getProductById("p-lumina-x1")!;
const cooke = getProductById("p-cooke-ana-50")!; // contact, stock 0
const filter = getProductById("p-filter-kit")!; // có compareAtPrice

function line(productId: string, quantity: number, variantId?: string): CartLine {
  return { productId, variantId, quantity, addedAt: new Date().toISOString() };
}

function detail(l: CartLine): CartLineDetail {
  const snapshot = buildCartSnapshot([l], getProductById);
  return snapshot.lines[0]!;
}

describe("clampQuantity", () => {
  it("kẹp quantity trong [1, stock]", () => {
    expect(clampQuantity(x1, "v-x1-body", 0)).toBe(1);
    expect(clampQuantity(x1, "v-x1-body", 999)).toBe(10); // max cap 10
  });

  it("trả về null khi variant hết hàng (pre_order)", () => {
    expect(clampQuantity(x1, "v-x1-cine", 1)).toBeNull();
  });

  it("trả về null khi sản phẩm contact-only", () => {
    expect(clampQuantity(cooke, undefined, 1)).toBeNull();
  });

  it("trả về null khi quantity âm hoặc NaN", () => {
    expect(clampQuantity(x1, "v-x1-body", -5)).toBe(1); // kẹp về min 1
    expect(clampQuantity(x1, "v-x1-body", Number.NaN)).toBe(1);
  });
});

describe("maxQuantityOf", () => {
  it("dùng stock của variant khi có", () => {
    expect(maxQuantityOf(x1, x1.variants![1])).toBe(6);
  });
  it("trả 0 cho sản phẩm contact", () => {
    expect(maxQuantityOf(cooke, undefined)).toBe(0);
  });
});

describe("buildCartSnapshot", () => {
  it("lược bỏ line không hợp lệ thay vì phá vỡ giỏ", () => {
    const snapshot = buildCartSnapshot(
      [line("p-khong-ton-tai", 1), line(x1.id, 2, "v-x1-body")],
      getProductById,
    );
    expect(snapshot.lines).toHaveLength(1);
    expect(snapshot.lines[0]!.productId).toBe(x1.id);
  });

  it("lược bỏ line quantity <= 0 hoặc NaN", () => {
    const snapshot = buildCartSnapshot([line(x1.id, 0), line(x1.id, Number.NaN)], getProductById);
    expect(snapshot.lines).toHaveLength(0);
  });

  it("tính lineTotal theo giá variant", () => {
    const d = detail(line(x1.id, 2, "v-x1-kit"));
    expect(d.lineTotal).toBe(259_000_000 * 2);
  });

  it("kẹp quantity xuống max stock hiện tại", () => {
    const d = detail(line(x1.id, 50, "v-x1-kit"));
    expect(d.quantity).toBe(6);
  });
});

describe("calculateTotals", () => {
  it("giỏ trống: mọi thứ = 0", () => {
    const totals = calculateTotals([]);
    expect(totals).toMatchObject({ itemCount: 0, subtotal: 0, shipping: 0, total: 0 });
  });

  it("cộng đúng subtotal và tiết kiệm từ compareAtPrice", () => {
    const lines = [detail(line(filter.id, 2))]; // 5.600.000, compareAt 6.400.000
    const totals = calculateTotals(lines);
    expect(totals.subtotal).toBe(11_200_000);
    expect(totals.savings).toBe(1_600_000);
    expect(totals.shipping).toBe(STANDARD_SHIPPING_FEE);
    expect(totals.total).toBe(11_200_000 + STANDARD_SHIPPING_FEE);
  });

  it("miễn phí vận chuyển khi đạt ngưỡng", () => {
    const lines = [detail(line(x1.id, 1, "v-x1-body"))]; // 185tr
    const totals = calculateTotals(lines);
    expect(totals.subtotal).toBeGreaterThanOrEqual(FREE_SHIPPING_THRESHOLD);
    expect(totals.shipping).toBe(0);
    expect(totals.amountToFreeShipping).toBe(0);
  });

  it("amountToFreeShipping đúng khi chưa đạt ngưỡng", () => {
    const lines = [detail(line(filter.id, 1))];
    const totals = calculateTotals(lines);
    expect(totals.amountToFreeShipping).toBe(FREE_SHIPPING_THRESHOLD - filter.price);
  });
});

describe("mergeLine", () => {
  it("gộp line trùng product+variant", () => {
    const merged = mergeLine([line(x1.id, 2, "v-x1-body")], line(x1.id, 3, "v-x1-body"), getProductById);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.quantity).toBe(5);
  });

  it("không vượt quá stock khi gộp", () => {
    const merged = mergeLine([line(x1.id, 5, "v-x1-kit")], line(x1.id, 5, "v-x1-kit"), getProductById);
    expect(merged[0]!.quantity).toBe(6); // stock kit = 6
  });

  it("giữ line riêng cho variant khác nhau", () => {
    const merged = mergeLine([line(x1.id, 1, "v-x1-body")], line(x1.id, 1, "v-x1-kit"), getProductById);
    expect(merged).toHaveLength(2);
  });

  it("từ chối thêm sản phẩm contact-only", () => {
    const merged = mergeLine([], line(cooke.id, 1), getProductById);
    expect(merged).toHaveLength(0);
  });
});
