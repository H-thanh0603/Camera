import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AgentRuntime } from "@/lib/ai/agent/runtime";
import { ToolExecutor, ToolRunError, type CommerceTool } from "@/lib/ai/agent/executor";
import { streamWithFallback } from "@/lib/ai/fallback";
import { MockAIProvider, toolCall } from "./ai-mock";
import { ProviderUnavailableError } from "@/lib/ai/errors";

const SYSTEM = [{ role: "system", content: "sys" } as const];

function executorWith(tools?: CommerceTool[]): ToolExecutor {
  const echo: CommerceTool = {
    name: "echo_lookup",
    description: "echo",
    input: z.object({ q: z.string().default("") }),
    run: (input) => ({ echoed: (input as { q: string }).q }),
  };
  return new ToolExecutor([...(tools ?? []), echo]);
}

describe("ToolExecutor failure ladder", () => {
  it("chạy tool và trả value khi args hợp lệ", async () => {
    const ex = executorWith();
    const out = await ex.dispatch("echo_lookup", { q: "x1" }, { requestId: "r" });
    expect(out).toEqual({ ok: true, value: { echoed: "x1" } });
  });

  it("invalid args → kind invalid, không ném", async () => {
    const strict: CommerceTool = {
      name: "strict",
      description: "s",
      input: z.object({ n: z.number() }),
      run: () => "never",
    };
    const ex = executorWith([strict]);
    const out = await ex.dispatch("strict", { n: "not-a-number" }, { requestId: "r" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.kind).toBe("invalid");
  });

  it("tool không tồn tại → error an toàn", async () => {
    const out = await executorWith().dispatch("ghost_tool", {}, { requestId: "r" });
    expect(out.ok).toBe(false);
  });

  it("ToolRunError not_found → relay message thân thiện", async () => {
    const nf: CommerceTool = {
      name: "nf",
      description: "s",
      input: z.object({}),
      run: () => {
        throw new ToolRunError("not_found", "Không tìm thấy X.");
      },
    };
    const out = await executorWith([nf]).dispatch("nf", {}, { requestId: "r" });
    expect(out).toEqual({ ok: false, kind: "not_found", message: "Không tìm thấy X." });
  });

  it("lỗi hệ thống bất ngờ → generic, không lộ nội bộ", async () => {
    const boom: CommerceTool = {
      name: "boom",
      description: "s",
      input: z.object({}),
      run: () => {
        throw new Error("ECONNREFUSED secret-internal-stack");
      },
    };
    const out = await executorWith([boom]).dispatch("boom", {}, { requestId: "r" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.kind).toBe("error");
      expect(out.message).not.toContain("ECONNREFUSED");
    }
  });

  it("specs() cho providers là JSON Schema hợp lệ", () => {
    const specs = executorWith().specs();
    const echo = specs.find((s) => s.name === "echo_lookup")!;
    expect(echo.parameters).toMatchObject({ type: "object" });
  });
describe("AgentRuntime tool loop (không cần mạng)", () => {
  it("gọi tool rồi trả lời cuối — agent logic độc lập provider", async () => {
    const provider = new MockAIProvider([
      { toolCalls: [toolCall("c1", "echo_lookup", { q: "lens" })] },
      { content: "Có 1 gợi ý cho bạn." },
    ]);
    const runtime = new AgentRuntime(provider, executorWith(), { requestId: "t1", maxIterations: 4 });
    const res = await runtime.run([...SYSTEM, { role: "user", content: "tìm lens" }]);
    expect(res.finished).toBe(true);
    expect(res.text).toContain("gợi ý");
    expect(provider.requests).toHaveLength(2);
    const round2 = provider.requests[1]!.messages;
    expect(round2.some((m) => m.role === "tool" && m.toolCallId === "c1")).toBe(true);
  });

  it("streamRun phát text + tool_call + done", async () => {
    const provider = new MockAIProvider([
      { content: "Chào", toolCalls: [toolCall("c1", "echo_lookup", { q: "a" })] },
      { content: " xong." },
    ]);
    const runtime = new AgentRuntime(provider, executorWith(), { requestId: "t2", maxIterations: 4 });
    const events = [];
    for await (const ev of runtime.streamRun([...SYSTEM, { role: "user", content: "hi" }])) events.push(ev);
    expect(events[0]).toMatchObject({ type: "text", text: "Chào" });
    expect(events).toContainEqual({ type: "tool_call", call: toolCall("c1", "echo_lookup", { q: "a" }) });
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });

  it("maxIterations chặn vòng lặp vô hạn", async () => {
    const provider = new MockAIProvider(
      Array.from({ length: 10 }, (_, i) => ({ toolCalls: [toolCall(`c${i}`, "echo_lookup", {})] })),
    );
    const runtime = new AgentRuntime(provider, executorWith(), { requestId: "t3", maxIterations: 2 });
    const events = [];
    for await (const ev of runtime.streamRun([...SYSTEM, { role: "user", content: "loop" }])) events.push(ev);
    expect(events).toContainEqual({ type: "max_iterations" });
    expect(provider.requests).toHaveLength(2);
  });
});

describe("streamWithFallback", () => {
  it("provider chính lỗi trước khi stream → dùng fallback", async () => {
    const failing = new MockAIProvider([]);
    failing.stream = async function* () {
      throw new ProviderUnavailableError("primary");
      yield { type: "done" as const, toolCalls: [] };
    };
    const good = new MockAIProvider([{ content: "Xin chào từ fallback." }]);
    const events = [];
    for await (const ev of streamWithFallback(
      { providers: [failing, good], executor: executorWith(), requestId: "fb1" },
      [...SYSTEM, { role: "user", content: "hi" }],
    )) {
      events.push(ev);
    }
    expect(events).toContainEqual({ type: "text", text: "Xin chào từ fallback." });
    expect(events[events.length - 1]).toEqual({ type: "done" });
  });

  it("đã bắt đầu stream thì commit provider", async () => {
    const partial = new MockAIProvider([{ content: "nửa chừng" }]);
    const backup = new MockAIProvider([{ content: "backup" }]);
    const events = [];
    for await (const ev of streamWithFallback(
      { providers: [partial, backup], executor: executorWith(), requestId: "fb2" },
      [...SYSTEM, { role: "user", content: "hi" }],
    )) {
      events.push(ev);
    }
    expect(events).toContainEqual({ type: "text", text: "nửa chừng" });
    expect(backup.requests).toHaveLength(0);
  });
});
describe("commerce tools trên seed source", () => {
  it("có đủ 8 tool thương mại cần thiết", async () => {
    const { seedCommerceSource } = await import("@/lib/ai/tools/seed-source");
    const { createCommerceTools } = await import("@/lib/ai/tools/commerce-tools");
    const { compareProductsTool, recommendProductsTool } = await import("@/lib/ai/tools/compare-recommend");
    const ex = new ToolExecutor([
      ...createCommerceTools({ source: seedCommerceSource }),
      compareProductsTool(seedCommerceSource),
      recommendProductsTool(seedCommerceSource),
    ]);
    expect(ex.names().sort()).toEqual(
      [
        "search_products",
        "get_product_details",
        "get_product_availability",
        "get_product_price",
        "list_categories",
        "get_top_products",
        "compare_products",
        "recommend_products",
      ].sort(),
    );
  });

  it("search_products tìm được sản phẩm", async () => {
    const { seedCommerceSource } = await import("@/lib/ai/tools/seed-source");
    const { createCommerceTools } = await import("@/lib/ai/tools/commerce-tools");
    const ex = new ToolExecutor(createCommerceTools({ source: seedCommerceSource }));
    const out = await ex.dispatch("search_products", { limit: 5 }, { requestId: "s" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      const v = out.value as { products: unknown[] };
      expect(v.products.length).toBeGreaterThan(0);
    }
  });

  it("compare_products báo not_found khi id sai", async () => {
    const { seedCommerceSource } = await import("@/lib/ai/tools/seed-source");
    const { compareProductsTool } = await import("@/lib/ai/tools/compare-recommend");
    const ex = new ToolExecutor([compareProductsTool(seedCommerceSource)]);
    const a = await ex.dispatch("compare_products", { productIds: ["nope-1", "nope-2"] }, { requestId: "s" });
    expect(a.ok).toBe(false);
  });

  it("recommend_products trả matchPercent 0..100", async () => {
    const { seedCommerceSource } = await import("@/lib/ai/tools/seed-source");
    const { recommendProductsTool } = await import("@/lib/ai/tools/compare-recommend");
    const ex = new ToolExecutor([recommendProductsTool(seedCommerceSource)]);
    const out = await ex.dispatch("recommend_products", { budgetMax: 250_000_000, limit: 3 }, { requestId: "s" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      const v = out.value as { recommendations: { matchPercent: number }[] };
      for (const r of v.recommendations) {
        expect(r.matchPercent).toBeGreaterThan(0);
        expect(r.matchPercent).toBeLessThanOrEqual(100);
      }
    }
  });
});
});