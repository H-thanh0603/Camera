import Link from "next/link";
import { ProductCard } from "@/components/product/product-card";
import { applyQuery } from "@/lib/repositories/product-repository";
import { dbAllProducts } from "@/lib/server/product-db";

/** Section 5 — Curated Bestsellers & Precision Vault: dữ liệu từ DB. */
export async function VaultBestsellers() {
  const catalog = await dbAllProducts();
  const bestsellers = applyQuery(catalog, { sort: "best_selling", pageSize: 3 }).items;

  return (
    <section className="relative w-full bg-surface py-space-4xl">
      <div className="mx-auto flex w-full max-w-container-max flex-col gap-space-3xl px-gutter-mobile lg:px-gutter-desktop">
        <div className="flex flex-col justify-between gap-space-md md:flex-row md:items-end">
          <div className="flex max-w-2xl flex-col gap-space-2xs">
            <p className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-on-surface-variant/70">
              Kho thiết bị nguyên bản — cân chỉnh collimator trước bàn giao
            </p>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Tuyệt Tác Sẵn Hàng Tại Vault</h2>
          </div>
          <p className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-outline">
            Hỗ trợ trả góp 0% qua thẻ tín dụng VIP
          </p>
        </div>

        <div className="grid grid-cols-1 gap-space-xl md:grid-cols-3">
          {bestsellers.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i === 0} />
          ))}
        </div>

        <div className="flex justify-center">
          <Link
            href="/products"
            className="flex items-center gap-space-xs rounded-lg bg-surface-container-high px-space-xl py-space-sm font-headline-sm text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest hover:text-primary"
          >
            <span>Xem toàn bộ kho Vault</span>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
