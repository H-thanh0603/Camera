import { prisma } from "@/lib/server/prisma";
import { dbQueryProducts } from "@/lib/server/product-db";
import { StockAdmin } from "@/components/admin/stock-admin";
import type { Product } from "@/lib/types";

export const metadata = { title: "Quản trị kho hàng" };

export default async function AdminStockPage() {
  const [{ items }, rows] = await Promise.all([
    dbQueryProducts({ pageSize: 60 }),
    prisma.stockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  // Date → ISO string (props qua client component phải serializable)
  const movements = rows.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
  return <StockAdmin initialProducts={items as Product[]} initialMovements={movements} />;
}
