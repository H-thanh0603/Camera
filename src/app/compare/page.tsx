"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProductsByIds } from "@/lib/repositories/product-repository";
import { useStore } from "@/state/store";
import { formatVND, cn } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/states";
import { RatingStars } from "@/components/ui/rating-stars";
import type { Product } from "@/lib/types";

/**
 * So sánh 2–4 sản phẩm, đồng bộ với URL (?ids=) và store.
 * Highlight better/worse/same trên từng thông số có thể so sánh.
 */

interface Metric {
  key: string;
  label: string;
  get: (p: Product) => string;
  /** Trả về số để so sánh; direction: 1 = cao hơn tốt, -1 = thấp hơn tốt */
  num?: (p: Product) => number | undefined;
  direction?: 1 | -1;
}

const METRICS: Metric[] = [
  { key: "price", label: "Giá", get: (p) => formatVND(p.price), num: (p) => p.price, direction: -1 },
  { key: "rating", label: "Đánh giá", get: (p) => `${p.rating.toFixed(1)}/5 (${p.reviewCount})`, num: (p) => p.rating, direction: 1 },
  { key: "sensor", label: "Cảm biến", get: (p) => p.specifications.sensor ?? "—" },
  { key: "resolution", label: "Độ phân giải", get: (p) => p.specifications.resolution ?? "—", num: (p) => parseNumber(p.specifications.resolution), direction: 1 },
  { key: "iso", label: "Dải ISO", get: (p) => p.specifications.iso ?? "—" },
  { key: "autofocus", label: "Lấy nét tự động", get: (p) => p.specifications.autofocus ?? "—" },
  { key: "burst", label: "Chụp liên tiếp", get: (p) => p.specifications.burst ?? "—", num: (p) => parseNumber(p.specifications.burst), direction: 1 },
  { key: "video", label: "Quay video", get: (p) => p.specifications.video ?? "—" },
  { key: "ibis", label: "Chống rung IBIS", get: (p) => p.specifications.ibis ?? "—", num: (p) => parseNumber(p.specifications.ibis), direction: 1 },
  { key: "battery", label: "Pin", get: (p) => p.specifications.battery ?? "—", num: (p) => parseNumber(p.specifications.battery), direction: 1 },
  { key: "weight", label: "Trọng lượng", get: (p) => p.specifications.weight ?? "—", num: (p) => parseNumber(p.specifications.weight), direction: -1 },
  { key: "dimensions", label: "Kích thước", get: (p) => p.specifications.dimensions ?? "—" },
  { key: "mount", label: "Ngàm mount", get: (p) => p.specifications.mount ?? "—" },
];

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/[\d.]+/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : undefined;
}

function verdictFor(metric: Metric, products: Product[], target: Product): "better" | "worse" | "same" | null {
  if (!metric.num || !metric.direction) return null;
  const values = products.map((p) => metric.num!(p)).filter((v): v is number => v !== undefined);
  if (values.length < 2) return null;
  const targetVal = metric.num(target);
  if (targetVal === undefined) return null;
  const best = metric.direction === 1 ? Math.max(...values) : Math.min(...values);
  const allSame = values.every((v) => v === values[0]);
  if (allSame) return "same";
  if (targetVal === best) return "better";
  return "worse";
}

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { compare, toggleCompare, hydrated } = useStore();
  // Import lần đầu từ URL (khi user mở link ?ids=...) — sau đó store là source of truth
  const importedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || importedRef.current) return;
    importedRef.current = true;
    const urlIds = (searchParams.get("ids")?.split(",").filter(Boolean) ?? []).slice(0, 4);
    if (compare.length === 0 && urlIds.length > 0) {
      for (const id of urlIds) toggleCompare(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Store → URL: mọi thay đổi từ card/PDP phản ánh vào query string
  useEffect(() => {
    if (!hydrated) return;
    const desired = compare.length ? compare.join(",") : "";
    if ((searchParams.get("ids") ?? "") !== desired) {
      router.replace(desired ? `/compare?ids=${desired}` : "/compare", { scroll: false });
    }
  }, [hydrated, compare, searchParams, router]);

  if (!hydrated) {
    return <div className="container-page py-space-3xl"><EmptyState icon="hourglass_empty" title="Đang tải..." /></div>;
  }

  const products = getProductsByIds(compare);

  return (
    <div className="container-page flex flex-col gap-space-xl py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">SIDE-BY-SIDE OPTICAL DUEL</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">So Sánh Thiết Bị</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Tối đa 4 thiết bị. Thêm từ nút “So sánh” trên card sản phẩm.</p>
      </header>

      {products.length === 0 ? (
        <EmptyState
          icon="compare_arrows"
          title="Chưa chọn thiết bị nào"
          description="Thêm 2–4 sản phẩm từ catalogue để bắt đầu màn so sánh thông số chi tiết."
          action={
            <Link href="/products?category=camera" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary">
              Chọn máy ảnh
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface-container shadow-xl">
          <table className="w-full min-w-[720px] border-collapse">
            <caption className="sr-only">Bảng so sánh thông số {products.map((p) => p.name).join(", ")}</caption>
            <thead>
              <tr>
                <th scope="col" className="w-44 p-space-md text-left font-telemetry-xs text-telemetry-xs uppercase text-outline">Thông số</th>
                {products.map((p) => (
                  <th key={p.id} scope="col" className="p-space-md text-left align-top">
                    <div className="flex flex-col gap-space-2xs">
                      <Link href={`/products/${p.slug}`} className="font-headline-sm text-headline-sm text-on-surface transition-colors hover:text-primary">{p.name}</Link>
                      <span className="font-telemetry-xs text-telemetry-xs text-outline">{p.brand}</span>
                      <RatingStars rating={p.rating} size={14} />
                      <button
                        type="button"
                        onClick={() => toggleCompare(p.id)}
                        className="w-fit font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-error"
                      >
                        Bỏ khỏi so sánh
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((metric) => (
                <tr key={metric.key} className="border-t border-surface-container-high">
                  <th scope="row" className="p-space-md text-left font-telemetry-xs text-telemetry-xs uppercase text-on-surface-variant">{metric.label}</th>
                  {products.map((p) => {
                    const verdict = verdictFor(metric, products, p);
                    return (
                      <td
                        key={p.id}
                        className={cn(
                          "p-space-md font-telemetry-data text-telemetry-data text-on-surface",
                          verdict === "better" && "bg-primary/10 font-bold text-primary",
                          verdict === "worse" && "text-on-surface-variant",
                        )}
                      >
                        {metric.get(p)}
                        {verdict === "better" && <span className="ml-space-2xs font-telemetry-xs text-telemetry-xs uppercase" title="Ưu thế hơn">▲</span>}
                        {verdict === "worse" && <span className="ml-space-2xs font-telemetry-xs text-telemetry-xs text-outline" title="Kém hơn">▽</span>}
                        {verdict === "same" && <span className="ml-space-2xs font-telemetry-xs text-telemetry-xs text-outline">=</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
