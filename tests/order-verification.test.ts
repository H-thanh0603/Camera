import { describe, expect, it } from "vitest";
import { verifyAndPriceLines, verifyInput, OrderValidationError, EXPRESS_FEE } from "@/lib/server/place-order";
import type { ContactInfo, ShippingInfo } from "@/lib/types";

const contact: ContactInfo = { fullName: "Test", email: "t@lumina.vn", phone: "0901234567" };
const shipping: ShippingInfo = { address: "1 Lê Lợi", ward: "Bến Nghé", district: "Quận 1", city: "TP.HCM" };

describe("verifyInput", () => {
  it("chấp nhận input hợp lệ", () => {
    expect(() => verifyInput(contact, shipping, "standard", "bank_transfer", [{ productId: "p-lumina-x1", quantity: 1 }])).not.toThrow();
  });

  it("từ chối delivery/payment không hợp lệ", () => {
    expect(() => verifyInput(contact, shipping, "drone", "bank_transfer", [{ productId: "p-lumina-x1", quantity: 1 }])).toThrow(OrderValidationError);
    expect(() => verifyInput(contact, shipping, "standard", "crypto", [{ productId: "p-lumina-x1", quantity: 1 }])).toThrow(OrderValidationError);
  });

  it("từ chối thiếu địa chỉ hoặc giỏ trống", () => {
    expect(() => verifyInput(contact, { ...shipping, city: "" }, "standard", "cod", [{ productId: "p-lumina-x1", quantity: 1 }])).toThrow(/địa chỉ/i);
    expect(() => verifyInput(contact, shipping, "standard", "cod", [])).toThrow(/trống/i);
  });
});

describe("verifyAndPriceLines — server-side price verification", () => {
  it("lấy giá từ catalogue server, bỏ qua bất cứ giá nào client gửi", () => {
    const { finalLines, totals } = verifyAndPriceLines(
      [{ productId: "p-lumina-x1", variantId: "v-x1-kit", quantity: 2 }],
      "standard",
    );
    expect(finalLines[0]!.unitPrice).toBe(259_000_000); // giá catalogue, KHÔNG phải giá client
    expect(totals.subtotal).toBe(518_000_000);
    expect(totals.total).toBe(518_000_000); // standard → free shipping
  });

  it("express cộng phí vận chuyển", () => {
    const { totals } = verifyAndPriceLines([{ productId: "p-filter-kit", quantity: 1 }], "express");
    expect(totals.shipping).toBe(350_000 + EXPRESS_FEE);
  });

  it("kẹp quantity theo stock thực tế", () => {
    // kit stock = 6, yêu cầu 50 → chỉ được 6 (cap 10 của cart-service)
    const { finalLines } = verifyAndPriceLines([{ productId: "p-lumina-x1", variantId: "v-x1-kit", quantity: 50 }], "standard");
    expect(finalLines[0]!.quantity).toBe(6);
  });

  it("từ chối sản phẩm contact-only / pre_order", () => {
    expect(() => verifyAndPriceLines([{ productId: "p-cooke-ana-50", quantity: 1 }], "standard")).toThrow(/không thể mua/);
    expect(() => verifyAndPriceLines([{ productId: "p-lumina-x1", variantId: "v-x1-cine", quantity: 1 }], "standard")).toThrow(/không thể mua/);
  });

  it("từ chối sản phẩm/variant không tồn tại", () => {
    expect(() => verifyAndPriceLines([{ productId: "p-khong-ton-tai", quantity: 1 }], "standard")).toThrow(/không còn tồn tại/);
    expect(() => verifyAndPriceLines([{ productId: "p-lumina-x1", variantId: "v-fake", quantity: 1 }], "standard")).toThrow(/không còn hợp lệ/);
  });

  it("từ chối quantity âm / không nguyên", () => {
    expect(() => verifyAndPriceLines([{ productId: "p-lumina-x1", quantity: -1 }], "standard")).toThrow(/không hợp lệ/);
    expect(() => verifyAndPriceLines([{ productId: "p-lumina-x1", quantity: 1.5 }], "standard")).toThrow(/không hợp lệ/);
  });

  it("gộp line trùng product+variant", () => {
    const { finalLines } = verifyAndPriceLines(
      [
        { productId: "p-lumina-x1", variantId: "v-x1-body", quantity: 1 },
        { productId: "p-lumina-x1", variantId: "v-x1-body", quantity: 2 },
      ],
      "standard",
    );
    expect(finalLines).toHaveLength(1);
    expect(finalLines[0]!.quantity).toBe(3);
  });
});
