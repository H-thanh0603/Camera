import { prisma } from "./prisma";

const LOW_STOCK_THRESHOLD = 5;
const ALERT_LIMIT = 20;

/** Current product-level inventory, not a sales-velocity forecast. */
export async function getInventoryHealth(now = new Date()) {
  const lowWhere = { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } };
  const [critical, low, healthy, items] = await prisma.$transaction([
    prisma.product.count({ where: { stock: { lte: 0 } } }),
    prisma.product.count({ where: lowWhere }),
    prisma.product.count({ where: { stock: { gt: LOW_STOCK_THRESHOLD } } }),
    prisma.product.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD } },
      select: { id: true, sku: true, name: true, stock: true },
      orderBy: [{ stock: "asc" }, { id: "asc" }], take: ALERT_LIMIT,
    }),
  ]);
  return {
    observedAt: now.toISOString(),
    threshold: LOW_STOCK_THRESHOLD,
    counts: { critical, low, healthy },
    items: items.map((item) => ({ ...item, daysRemaining: null })),
    truncated: critical + low > items.length,
  };
}

export type InventoryHealth = Awaited<ReturnType<typeof getInventoryHealth>>;
