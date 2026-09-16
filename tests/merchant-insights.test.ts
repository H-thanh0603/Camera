import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { rmSync } from "node:fs";

const state = vi.hoisted(() => ({ dir: "", role: "admin" as string | null }));
vi.mock("@/lib/server/admin", async () => {
  const { NextResponse } = await import("next/server");
  return { staffGuardResponse: async () => ["admin", "staff"].includes(state.role ?? "") ? null : NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
});
vi.mock("@/lib/server/prisma", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const { PrismaClient } = await import("@/generated/prisma/client");
  const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
  state.dir = mkdtempSync(join(tmpdir(), "merchant-insights-"));
  const url = `file:${join(state.dir, "test.db")}`;
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  return { prisma: new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) }) };
});
import { prisma } from "@/lib/server/prisma";
import { getInventoryHealth } from "@/lib/server/merchant-insights";

beforeEach(async () => {
  state.role = "admin";
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
});
afterAll(async () => { await prisma.$disconnect(); rmSync(state.dir, { recursive: true, force: true }); });

async function product(id: string, stock: number) {
  return prisma.product.create({ data: {
    id, sku: id, slug: id, name: id, brand: "Test", category: "camera", subcategory: "camera",
    description: "", shortDescription: "", price: 100, stock, images: [], thumbnail: {}, specifications: {}, tags: [], badges: [],
  } });
}

it("reports current low-stock evidence without inventing a depletion forecast", async () => {
  await product("empty", 0); await product("low", 5); await product("healthy", 6);
  const health = await getInventoryHealth(new Date("2026-09-17T05:00:00Z"));
  expect(health.counts).toEqual({ critical: 1, low: 1, healthy: 1 });
  expect(health.items.map((p) => [p.id, p.stock, p.daysRemaining])).toEqual([["empty", 0, null], ["low", 5, null]]);
  expect(health.threshold).toBe(5);
});

it("exposes evidence to staff/admin and denies unauthenticated/customer requests", async () => {
  const { GET } = await import("@/app/api/admin/merchant/inventory/route");
  await product("low", 2);
  for (const role of [null, "customer"]) {
    state.role = role;
    expect((await GET()).status).toBe(403);
  }
  for (const role of ["admin", "staff"]) {
    state.role = role;
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).inventory.items).toEqual([
      { id: "low", name: "low", sku: "low", stock: 2, daysRemaining: null },
    ]);
  }
});

it("reports empty inventory and caps evidence without hiding the total", async () => {
  expect((await getInventoryHealth()).counts).toEqual({ critical: 0, low: 0, healthy: 0 });
  await Promise.all(Array.from({ length: 23 }, (_, i) => product(`p-${i}`, 1)));
  const inventory = await getInventoryHealth();
  expect(inventory.counts.low).toBe(23);
  expect(inventory.items).toHaveLength(20);
  expect(inventory.truncated).toBe(true);
});



