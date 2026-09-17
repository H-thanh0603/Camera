import { describe, expect, it } from "vitest";
import { csvCell } from "@/app/api/admin/orders/export/route";
import { idempotencyKeySchema, MAX_ORDER_LINES, placeOrderSchema } from "@/lib/schemas";
import { parseVnpayPayDate } from "@/lib/server/vnpay";
import { verifyAndPriceLines } from "@/lib/server/place-order";
import { getProductById } from "@/lib/repositories/product-repository";

const resolveProduct = async (id: string) => getProductById(id) ?? null;

describe("idempotency key schema (L10)", () => {
  it("nhận UUID, từ chối rác/ngắn/dài", () => {
    expect(idempotencyKeySchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    expect(idempotencyKeySchema.safeParse("short").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("x".repeat(65)).success).toBe(false);
    expect(idempotencyKeySchema.safeParse("key with spaces").success).toBe(false);
    expect(idempotencyKeySchema.safeParse("key'; DROP--").success).toBe(false);
  });
});

describe("order lines cap (M9)", () => {
  it("schema chặn >50 dòng", () => {
    const lines = Array.from({ length: 51 }, () => ({ productId: "p-x", quantity: 1 }));
    const parsed = placeOrderSchema.safeParse({
      contact: { fullName: "Nguyen Van A", email: "a@b.vn", phone: "0901234567" },
      shipping: { address: "1 Test", ward: "P1", district: "Q1", city: "HCM" },
      delivery: "standard",
      payment: "cod",
      lines,
    });
    expect(parsed.success).toBe(false);
    expect(MAX_ORDER_LINES).toBe(50);
  });

  it("gộp trùng không vượt trần: 5 line × 10 → clamp về stock/trần", async () => {
    // p-filter-kit stock thật trong seed; gửi 5 line trùng quantity 10
    const { finalLines } = await verifyAndPriceLines(
      Array.from({ length: 5 }, () => ({ productId: "p-filter-kit", quantity: 10 })),
      "standard",
      resolveProduct,
    );
    expect(finalLines).toHaveLength(1);
    // Trần line = min(10 policy, stock) — tổng gộp không vượt trần từng line
    expect(finalLines[0]!.quantity).toBeLessThanOrEqual(10);
  });
});

describe("CSV formula neutralization (M12)", () => {
  it("prefix ' cho ô mở đầu = + - @", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\",\"x\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\",\"\"x\"\")\"");
    expect(csvCell("+cmd|'/c calc'!A0")).toBe("'+cmd|'/c calc'!A0");
    expect(csvCell("-2+3")).toBe("'-2+3");
    expect(csvCell("@SUM(1:1)")).toBe("'@SUM(1:1)");
  });
  it("text thường và số giữ nguyên", () => {
    expect(csvCell("Nguyen Van A")).toBe("Nguyen Van A");
    expect(csvCell(1_500_000)).toBe("1500000");
    expect(csvCell("a,b")).toBe('"a,b"');
  });
});

describe("VNPay PayDate parse (L9)", () => {
  it("parse yyyyMMddHHmmss GMT+7 → epoch", () => {
    // 20260911120000 +07 = 20260911T050000Z
    expect(parseVnpayPayDate("20260911120000")).toBe(Date.UTC(2026, 8, 11, 5, 0, 0) / 1000);
  });
  it("sai format → null", () => {
    expect(parseVnpayPayDate(undefined)).toBeNull();
    expect(parseVnpayPayDate("not-a-date")).toBeNull();
    expect(parseVnpayPayDate("20260911")).toBeNull();
  });
});
