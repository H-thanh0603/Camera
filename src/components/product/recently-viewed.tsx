"use client";

import { useStore } from "@/state/store";
import { getFromHistory } from "@/lib/services/recommendation-service";
import { ProductCard } from "@/components/product/product-card";

export function RecentlyViewedClient({ excludeId }: { excludeId?: string }) {
  const { recent, hydrated } = useStore();
  if (!hydrated) return null;

  const recommendations = getFromHistory(recent.filter((id) => id !== excludeId), 4);
  if (recommendations.length === 0) return null;

  return (
    <section className="flex flex-col gap-space-md" aria-label="Đã xem gần đây">
      <span className="section-telemetry">DẤU VẾT KHÁM PHÁ</span>
      <h2 className="font-headline-md text-headline-md text-on-surface">Đã Xem Gần Đây</h2>
      <div className="grid grid-cols-1 gap-space-xl md:grid-cols-3 xl:grid-cols-4">
        {recommendations.map((r) => (
          <ProductCard key={r.product.id} product={r.product} />
        ))}
      </div>
    </section>
  );
}
