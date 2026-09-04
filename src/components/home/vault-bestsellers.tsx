import Link from "next/link";
import { ProductCard } from "@/components/product/product-card";
import { queryProducts } from "@/lib/repositories/product-repository";

/** Section 5 — Curated Bestsellers & Precision Vault: dữ liệu thật từ repository. */
export function VaultBestsellers() {
  const bestsellers = queryProducts({ sort: "best_selling", pageSize: 3 }).items;

  return (
    <section className="relative w-full bg-surface py-space-4xl">
      <div className="mx-auto flex w-full max-w-container-max flex-col gap-space-3xl px-gutter-mobile lg:px-gutter-desktop">
        <div className="flex flex-col justify-between gap-space-md md:flex-row md:items-end">
          <div>
            <span className="section-telemetry block">KHO THIẾT BỊ NGUYÊN BẢN</span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Tuyệt Tác Sẵn Hàng Tại Vault</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Mỗi thiết bị đều được cân chỉnh collimator và bảo lưu chứng nhận quang học độc bản trước khi bàn giao.</p>
          </div>
          <div className="flex items-center gap-space-xs font-telemetry-xs text-telemetry-xs text-outline">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            <span>HỖ TRỢ TRẢ GÓP 0% QUA THẺ TÍN DỤNG VIP</span>
          </div>
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
