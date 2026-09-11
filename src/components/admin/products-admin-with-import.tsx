"use client";

import type { Product } from "@/lib/types";
import { ProductsAdmin } from "@/components/admin/products-admin";
import { CsvImport } from "@/components/admin/csv-import";

/** Trang SP: import CSV xong reload để danh sách hiện hàng mới (đơn giản, chắc). */
export function ProductsAdminWithImport({ initialProducts }: { initialProducts: Product[] }) {
  return (
    <div className="flex flex-col gap-space-lg">
      <CsvImport onDone={() => window.location.reload()} />
      <ProductsAdmin initialProducts={initialProducts} />
    </div>
  );
}
