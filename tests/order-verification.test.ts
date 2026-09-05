import { describe, expect, it } from "vitest";
import { verifyAndPriceLines, EXPRESS_FEE } from "@/lib/server/place-order";
import { getProductById } from "@/lib/repositories/product-repository";
const resolveProduct = async (id: string) => getProductById(id) ?? null;

describe("verifyAndPriceLines — server-side price verification", () => {
  it("lấy giá từ catalogue server, bỏ qua bất cứ giá nào client gửi", async () => {
    const { finalLines, totals } = await verifyAndPriceLines(
      [{ productId: "p-lumina-x1", variantId: "v-x1-kit", quantity: 2 }],
      "standard",
      resolveProduct,
    );
    expect(finalLines[0]!.unitPrice).toBe(259_000_000); // giá catalogue, KHÔNG phải giá client
    expect(totals.subtotal).toBe(518_000_000);
    expect(totals.total).toBe(518_000_000); // standard → free shipping
  });

  it("express cộng phí vận chuyển", async () => {
    const { totals } = await verifyAndPriceLines([{ productId: "p-filter-kit", quantity: 1 }], "express", resolveProduct);
    expect(totals.shipping).toBe(350_000 + EXPRESS_FEE);
  });

  it("kẹp quantity theo stock thực tế", async () => {
    // kit stock = 6, yêu cầu 50 → chỉ được 6 (cap 10 của cart-service)
    const { finalLines } = await verifyAndPriceLines([{ productId: "p-lumina-x1", variantId: "v-x1-kit", quantity: 50 }], "standard", resolveProduct);
    expect(finalLines[0]!.quantity).toBe(6);
  });

  it("từ chối sản phẩm contact-only / pre_order", async () => {
    await expect(verifyAndPriceLines([{ productId: "p-cooke-ana-50", quantity: 1 }], "standard", resolveProduct)).rejects.toThrow(/không thể mua/);
    await expect(verifyAndPriceLines([{ productId: "p-lumina-x1", variantId: "v-x1-cine", quantity: 1 }], "standard", resolveProduct)).rejects.toThrow(/không thể mua/);
  });

  it("từ chối sản phẩm/variant không tồn tại", async () => {
    await expect(verifyAndPriceLines([{ productId: "p-khong-ton-tai", quantity: 1 }], "standard", resolveProduct)).rejects.toThrow(/không còn tồn tại/);
    await expect(verifyAndPriceLines([{ productId: "p-lumina-x1", variantId: "v-fake", quantity: 1 }], "standard", resolveProduct)).rejects.toThrow(/không còn hợp lệ/);
  });

  it("từ chối quantity âm / không nguyên", async () => {
    await expect(verifyAndPriceLines([{ productId: "p-lumina-x1", quantity: -1 }], "standard", resolveProduct)).rejects.toThrow(/không hợp lệ/);
    await expect(verifyAndPriceLines([{ productId: "p-lumina-x1", quantity: 1.5 }], "standard", resolveProduct)).rejects.toThrow(/không hợp lệ/);
  });

  it("gộp line trùng product+variant", async () => {
    const { finalLines } = await verifyAndPriceLines(
      [
        { productId: "p-lumina-x1", variantId: "v-x1-body", quantity: 1 },
        { productId: "p-lumina-x1", variantId: "v-x1-body", quantity: 2 },
      ],
      "standard",
      resolveProduct,
    );
    expect(finalLines).toHaveLength(1);
    expect(finalLines[0]!.quantity).toBe(3);
  });
});
