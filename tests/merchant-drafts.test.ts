import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { rmSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  chat: vi.fn(), actor: { id: "admin", name: "Admin", email: "admin@test.invalid" } as { id: string; name: string; email: string } | null,
  dir: "", budget: vi.fn(async () => ({ capped: false, used: 0, blocked: false, usedPercent: 0 })),
}));
vi.mock("@/lib/server/session", () => ({ getSessionUser: async () => mocks.actor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn() }));
vi.mock("@/lib/ai/providers/factory", () => ({ createProvider: () => ({
  meta: { provider: "offline", model: "test", capabilities: { structuredOutput: true, toolCalls: true } },
  chat: mocks.chat, stream: vi.fn(),
}) }));
vi.mock("@/lib/ai/budget", () => ({ getBudgetUsage: mocks.budget, addBudgetUsage: vi.fn() }));
// Never connects to DATABASE_URL/dev.db. Apply the real migration chain to a
// throwaway SQLite database, then exercise real Prisma transactions/constraints.
vi.mock("@/lib/server/prisma", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  mocks.dir = mkdtempSync(join(tmpdir(), "merchant-drafts-test-"));
  const url = `file:${join(mocks.dir, "test.db")}`;
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url }, stdio: "pipe",
  });
  return { prisma: new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) }) };
});

import { prisma } from "@/lib/server/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { generateMerchantDraft, listMerchantDrafts, decideMerchantDraft } from "@/lib/server/merchant-drafts";
import { GET, POST } from "@/app/api/admin/merchant/drafts/route";
import { PATCH } from "@/app/api/admin/merchant/drafts/[id]/route";

const after = "Máy ảnh Test Camera sử dụng cảm biến 24 MP, với ngàm E theo thông số sản phẩm.";
const request = (method: string, body: unknown, origin = "http://localhost:3000") => new NextRequest("http://localhost:3000/api/admin/merchant/drafts", {
  method, headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
});
const patch = (id: string, body: unknown) => PATCH(request("PATCH", body), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("AI_PROVIDER", "openai");
  vi.stubEnv("AI_API_KEY", "offline-test-key");
  vi.stubEnv("AI_MONTHLY_TOKEN_CAP", "0");
  vi.stubEnv("MERCHANT_DRAFT_MONTHLY_TOKEN_CAP", "200000");
  mocks.actor = { id: "admin", name: "Admin", email: "admin@test.invalid" };
  mocks.budget.mockResolvedValue({ capped: false, used: 0, blocked: false, usedPercent: 0 });
  mocks.chat.mockReset().mockResolvedValue({ content: "", toolCalls: [{ id: "out", name: "merchant_description", arguments: { description: after } }] });
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "fail_merchant_audit"');
  await prisma.auditLog.deleteMany();
  await prisma.merchantDescriptionDraft.deleteMany();
  await prisma.merchantDraftBudget.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({ data: { id: "admin", name: "Admin", email: "admin@test.invalid", passwordHash: "unused", role: "admin" } });
  await prisma.product.create({ data: {
    id: "camera", sku: "TEST", slug: "test-camera", name: "Test Camera", brand: "Test", category: "camera", subcategory: "mirrorless",
    description: "Mô tả cũ của sản phẩm.", shortDescription: "Giữ nguyên", price: 123456, stock: 7,
    images: [], thumbnail: {}, specifications: { sensor: "24 MP", mount: "E" }, tags: [], badges: [],
  } });
});
afterAll(async () => {
  await prisma.$disconnect();
  rmSync(mocks.dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

describe("merchant description drafts (offline provider, isolated real DB)", () => {
  it("generates/list previews through API without publishing; only DB facts reach provider", async () => {
    const before = await prisma.product.findUniqueOrThrow({ where: { id: "camera" } });
    const response = await POST(request("POST", { productId: "camera" }));
    expect(response.status).toBe(201);
    const { draft } = await response.json();
    expect(Object.keys(draft).sort()).toEqual(["id", "productId", "productName", "before", "after", "status", "createdAt"].sort());
    expect(draft).toMatchObject({ productId: "camera", productName: "Test Camera", before: before.description, after, status: "pending" });
    expect((await (await GET()).json()).drafts).toEqual([draft]);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: "camera" } })).toEqual(before);
    const messages = mocks.chat.mock.calls[0][0];
    expect(JSON.parse(messages[1].content)).toEqual({ name: "Test Camera", brand: "Test", specifications: { sensor: "24 MP", mount: "E" } });
    expect(mocks.chat.mock.calls[0][1].maxTokens).toBeLessThanOrEqual(2048);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("approves only stored description, audits atomically and invalidates catalogue", async () => {
    const original = await prisma.product.findUniqueOrThrow({ where: { id: "camera" } });
    const draft = await generateMerchantDraft({ productId: "camera" });
    const response = await patch(draft.id, { decision: "approve" });
    expect(response.status).toBe(200);
    expect((await response.json()).draft.status).toBe("approved");
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: "camera" } });
    expect(updated).toEqual({ ...original, description: after, updatedAt: expect.any(Date) });
    expect(await prisma.auditLog.count({ where: { action: "merchant.draft.approve" } })).toBe(1);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(revalidateTag).toHaveBeenCalledWith("catalog", "max");
    expect((await patch(draft.id, { decision: "approve" })).status).toBe(409);
    expect((await patch(draft.id, { decision: "reject" })).status).toBe(409);
  });

  it("rejects without changing product; rejection cannot subsequently publish", async () => {
    const original = await prisma.product.findUniqueOrThrow({ where: { id: "camera" } });
    const draft = await generateMerchantDraft({ productId: "camera" });
    expect((await decideMerchantDraft(draft.id, { decision: "reject" })).status).toBe("rejected");
    expect(await prisma.product.findUniqueOrThrow({ where: { id: "camera" } })).toEqual(original);
    await expect(decideMerchantDraft(draft.id, { decision: "approve" })).rejects.toMatchObject({ status: 409 });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each(["description", "specifications", "delete"])("rejects stale %s and rolls claim back", async (change) => {
    const draft = await generateMerchantDraft({ productId: "camera" });
    if (change === "delete") await prisma.product.delete({ where: { id: "camera" } });
    else await prisma.product.update({ where: { id: "camera" }, data: change === "description"
      ? { description: "Sửa bởi admin khác" } : { specifications: { sensor: "48 MP" }, updatedAt: new Date(Date.now() + 1000) } });
    expect((await patch(draft.id, { decision: "approve" })).status).toBe(409);
    expect((await prisma.merchantDescriptionDraft.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("pending");
    expect(await prisma.auditLog.count({ where: { action: "merchant.draft.approve" } })).toBe(0);
    expect(revalidateTag).not.toHaveBeenCalled();
    expect((await decideMerchantDraft(draft.id, { decision: "reject" })).status).toBe("rejected");
  });

  it("rolls product and claim back if mandatory audit fails", async () => {
    const draft = await generateMerchantDraft({ productId: "camera" });
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "fail_merchant_audit" BEFORE INSERT ON "AuditLog"
      WHEN NEW.action = 'merchant.draft.approve' BEGIN SELECT RAISE(ABORT, 'audit offline'); END`);
    expect((await patch(draft.id, { decision: "approve" })).status).toBe(500);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: "camera" } })).description).toBe(draft.before);
    expect((await prisma.merchantDescriptionDraft.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("pending");
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("concurrent approve/reject allows exactly one winner and one decision audit", async () => {
    const draft = await generateMerchantDraft({ productId: "camera" });
    const results = await Promise.allSettled([
      decideMerchantDraft(draft.id, { decision: "approve" }), decideMerchantDraft(draft.id, { decision: "reject" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: { in: ["merchant.draft.approve", "merchant.draft.reject"] } } })).toBe(1);
  });

  it.each([null, "staff", "customer"])("blocks %s at every endpoint and service before AI", async (role) => {
    if (role === null) mocks.actor = null;
    else await prisma.user.update({ where: { id: "admin" }, data: { role } });
    expect((await GET()).status).toBe(403);
    expect((await POST(request("POST", { productId: "camera" }))).status).toBe(403);
    expect((await patch("missing", { decision: "approve" })).status).toBe(403);
    await expect(listMerchantDrafts()).rejects.toMatchObject({ status: 403 });
    await expect(generateMerchantDraft({ productId: "camera" })).rejects.toMatchObject({ status: 403 });
    await expect(decideMerchantDraft("missing", { decision: "approve" })).rejects.toMatchObject({ status: 403 });
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it("strict payloads, CSRF, missing resources and invalid JSON", async () => {
    for (const body of [null, {}, { productId: "camera", price: 1 }, { productId: "camera", after }]) {
      expect((await POST(request("POST", body))).status).toBe(422);
    }
    expect((await POST(request("POST", { productId: "missing" }))).status).toBe(404);
    expect((await POST(request("POST", { productId: "camera" }, "https://evil.invalid"))).status).toBe(403);
    const invalid = new NextRequest("http://localhost:3000/api/admin/merchant/drafts", { method: "POST", headers: { origin: "http://localhost:3000" }, body: "{" });
    expect((await POST(invalid)).status).toBe(400);
    expect((await patch("missing", { decision: "approve" })).status).toBe(404);
    expect((await patch("missing", { decision: "approve", after })).status).toBe(422);
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it("fails closed for unavailable AI, missing specs and exhausted budgets", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    expect((await POST(request("POST", { productId: "camera" }))).status).toBe(503);
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("MERCHANT_DRAFT_MONTHLY_TOKEN_CAP", "0");
    expect((await POST(request("POST", { productId: "camera" }))).status).toBe(503);
    vi.stubEnv("MERCHANT_DRAFT_MONTHLY_TOKEN_CAP", "200000");
    vi.stubEnv("AI_MONTHLY_TOKEN_CAP", "100");
    mocks.budget.mockResolvedValue({ capped: true, used: 100, blocked: true, usedPercent: 100 });
    expect((await POST(request("POST", { productId: "camera" }))).status).toBe(503);
    await prisma.product.update({ where: { id: "camera" }, data: { specifications: {} } });
    expect((await POST(request("POST", { productId: "camera" }))).status).toBe(422);
    expect(mocks.chat).not.toHaveBeenCalled();
  });

  it.each(["failure", "invalid", "html", "extra"])("never fabricates drafts for provider %s", async (kind) => {
    if (kind === "failure") mocks.chat.mockRejectedValue(new Error("secret provider response"));
    else mocks.chat.mockResolvedValue({ content: "", toolCalls: [{ name: "merchant_description", arguments:
      kind === "invalid" ? { description: "" } : kind === "html" ? { description: "<script>alert('bad')</script>" } : { description: after, price: 1 },
    }] });
    const response = await POST(request("POST", { productId: "camera" }));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("secret provider response");
    expect(await prisma.merchantDescriptionDraft.count()).toBe(0);
    expect((await prisma.merchantDraftBudget.findFirstOrThrow()).reservedTokens).toBeGreaterThan(0);
  });

  it("charges structured fallback attempts and stops retries at the durable cap", async () => {
    mocks.chat.mockResolvedValue({ content: "not json", toolCalls: [] });
    vi.stubEnv("MERCHANT_DRAFT_MONTHLY_TOKEN_CAP", "10000");
    expect((await POST(request("POST", { productId: "camera" }))).status).toBe(503);
    expect(mocks.chat).toHaveBeenCalledTimes(1);
    expect((await prisma.merchantDraftBudget.findFirstOrThrow()).reservedTokens).toBeLessThanOrEqual(10000);
  });

  it("rechecks banned actor during approval", async () => {
    const draft = await generateMerchantDraft({ productId: "camera" });
    await prisma.user.update({ where: { id: "admin" }, data: { isBanned: true } });
    expect((await patch(draft.id, { decision: "approve" })).status).toBe(403);
    expect((await prisma.merchantDescriptionDraft.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("pending");
  });

});
