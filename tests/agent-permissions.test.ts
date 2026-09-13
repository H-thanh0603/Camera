import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    priceWatch: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    agentAction: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("tool permission system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executor lọc tool theo policy — guest thấy tất cả, policy hẹp lược bớt", async () => {
    const { ToolExecutor } = await import("@/lib/ai/agent/executor");
    const { seedCommerceSource } = await import("@/lib/ai/tools/seed-source");
    const { buildExecutor } = await import("@/lib/ai");

    const guest = buildExecutor(seedCommerceSource);
    expect(guest.names()).toContain("add_to_cart");
    expect(guest.names()).toContain("watch_price");
    expect(guest.names()).toContain("check_shipping_fee");

    // Policy chỉ cho read: write tools biến mất khỏi specs — model không biết.
    const readOnlyPolicy = { allowed: (perm: unknown) => perm === undefined || perm === "read" } as never;
    const all = new ToolExecutor(
      (await import("@/lib/ai/tools/commerce-tools")).createCommerceTools({ source: seedCommerceSource }),
      readOnlyPolicy,
    );
    expect(all.names()).not.toContain("add_to_cart");
    expect(all.names()).toContain("search_products");
  });

  it("add_to_cart chưa duyệt → action_required, không chạy run", async () => {
    const { seedCommerceSource } = await import("@/lib/ai/tools/seed-source");
    const { addToCartTool } = await import("@/lib/ai/tools/write-tools");
    const { ToolExecutor } = await import("@/lib/ai/agent/executor");
    const seed = (await import("@/lib/repositories/product-repository")).queryProducts({ pageSize: 1 }).items[0]!;
    const persisted: Array<{ actionKey: string; tool: string }> = [];
    const ex = new ToolExecutor([addToCartTool(seedCommerceSource)]);

    const out = await ex.dispatch(
      "add_to_cart",
      { productId: seed.id, quantity: 1 },
      {
        requestId: "t",
        persistAction: async (a) => {
          persisted.push(a);
        },
      },
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      const v = out.value as { action_required: string; summary: string };
      expect(v.action_required).toMatch(/^cart:/);
      expect(v.summary).toContain("1 món");
    }
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!.tool).toBe("add_to_cart");
  });

  it("add_to_cart đã duyệt → chạy thật, hết hàng thì unavailable", async () => {
    const { seedCommerceSource } = await import("@/lib/ai/tools/seed-source");
    const { addToCartTool } = await import("@/lib/ai/tools/write-tools");
    const { ToolExecutor } = await import("@/lib/ai/agent/executor");
    const seed = (await import("@/lib/repositories/product-repository")).queryProducts({ pageSize: 1 }).items[0]!;

    const key = `cart:${Buffer.from(`${seed.id}||1`).toString("base64url").slice(0, 40)}`;
    const ex = new ToolExecutor([addToCartTool(seedCommerceSource)]);
    const approved = await ex.dispatch(
      "add_to_cart",
      { productId: seed.id, quantity: 1 },
      { requestId: "t", approvedActions: new Set([key]) },
    );
    expect(approved.ok).toBe(true);
    if (approved.ok) {
      const v = approved.value as { clientApply: string; productId: string };
      expect(v.clientApply).toBe("add_to_cart");
      expect(v.productId).toBe(seed.id);
    }

    // Sản phẩm không tồn tại → unavailable dù đã duyệt.
    const ghost = await ex.dispatch(
      "add_to_cart",
      { productId: "ghost-id" },
      { requestId: "t", approvedActions: new Set([`cart:${Buffer.from("ghost-id||1").toString("base64url").slice(0, 40)}`]) },
    );
    expect(ghost.ok).toBe(false);
    if (!ghost.ok) expect(ghost.kind).toBe("not_found");
  });

  it("watch_price chưa duyệt → action_required; duyệt rồi thì upsert PriceWatch", async () => {
    const { seedCommerceSource } = await import("@/lib/ai/tools/seed-source");
    const { watchPriceTool } = await import("@/lib/ai/tools/write-tools");
    const { ToolExecutor } = await import("@/lib/ai/agent/executor");
    const { prisma } = await import("@/lib/server/prisma");
    const seed = (await import("@/lib/repositories/product-repository")).queryProducts({ pageSize: 1 }).items[0]!;
    const ex = new ToolExecutor([watchPriceTool(seedCommerceSource)]);

    const pending = await ex.dispatch(
      "watch_price",
      { productId: seed.id, email: "khach@test.vn", targetPrice: seed.price },
      { requestId: "t" },
    );
    expect(pending.ok).toBe(true);
    if (pending.ok) {
      expect((pending.value as { action_required: string }).action_required).toMatch(/^watch:/);
    }

    const key = `watch:${Buffer.from(`${seed.id}|${seed.price}`).toString("base64url").slice(0, 40)}`;
    const done = await ex.dispatch(
      "watch_price",
      { productId: seed.id, email: "khach@test.vn", targetPrice: seed.price },
      { requestId: "t", approvedActions: new Set([key]), rawSid: "a".repeat(64) },
    );
    expect(done.ok).toBe(true);
    expect(prisma.priceWatch.upsert).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(prisma.priceWatch.upsert).mock.calls[0]![0];
    expect(arg.create?.email).toBe("khach@test.vn");
    expect(arg.create?.startPrice).toBe(seed.price);
  });

  it("check_shipping_fee chưa cấu hình GHN → unavailable thân thiện", async () => {
    const { seedCommerceSource } = await import("@/lib/ai/tools/seed-source");
    const { checkShippingFeeTool } = await import("@/lib/ai/tools/shipping-fee");
    const { ToolExecutor } = await import("@/lib/ai/agent/executor");
    const seed = (await import("@/lib/repositories/product-repository")).queryProducts({ pageSize: 1 }).items[0]!;
    const ex = new ToolExecutor([checkShippingFeeTool(seedCommerceSource)]);
    const out = await ex.dispatch("check_shipping_fee", { productId: seed.id, toDistrictId: 1444 }, { requestId: "t" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.kind).toBe("unavailable");
      expect(out.message).toContain("GHN");
    }
  });
});
