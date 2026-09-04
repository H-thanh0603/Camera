"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Facets, SortOption } from "@/lib/types";
import { buildCatalogQuery, type CatalogParsed } from "@/lib/utils/catalog-params";
import { formatCompactVND } from "@/lib/utils/format";
import { cn } from "@/lib/utils/format";

const CATEGORY_LABELS: Record<string, string> = {
  camera: "Máy ảnh",
  lens: "Ống kính",
  lighting: "Ánh sáng",
  tripod: "Chân máy",
  storage: "Thẻ nhớ",
  battery: "Pin & Grip",
  bag: "Balo & Túi",
  accessory: "Phụ kiện",
};

const SORT_OPTIONS: { value: SortOption | ""; label: string }[] = [
  { value: "", label: "Nổi bật" },
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá thấp → cao" },
  { value: "price_desc", label: "Giá cao → thấp" },
  { value: "best_selling", label: "Bán chạy nhất" },
  { value: "rating_desc", label: "Đánh giá cao nhất" },
];

interface Props {
  facets: Facets;
  total: number;
  current: Omit<CatalogParsed, "page">;
}

export function CatalogControls({ facets, total, current }: Props) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(current.minPrice?.toString() ?? "");
  const [maxPrice, setMaxPrice] = useState(current.maxPrice?.toString() ?? "");

  const navigate = (updates: Partial<CatalogParsed>) => {
    router.push(`/products${buildCatalogQuery({ ...current, page: 1 } as CatalogParsed, updates)}`, { scroll: false });
  };

  const toggleValue = (list: string[] | undefined, value: string): string[] | undefined => {
    const set = new Set(list ?? []);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return set.size ? [...set] : undefined;
  };

  const activeCount =
    (current.brands?.length ?? 0) +
    (current.categories?.length ?? 0) +
    (current.minPrice ? 1 : 0) +
    (current.maxPrice ? 1 : 0) +
    (current.minRating ? 1 : 0) +
    (current.inStockOnly ? 1 : 0) +
    (current.tag ? 1 : 0);

  const panel = (
    <div className="flex flex-col gap-space-lg rounded-xl bg-surface-container p-space-lg shadow-xl">
      <div className="flex items-center justify-between">
        <span className="font-telemetry-xs text-telemetry-xs font-bold uppercase tracking-wider text-primary">BỘ LỌC {activeCount > 0 && `(${activeCount})`}</span>
        {activeCount > 0 && (
          <button type="button" onClick={() => router.push("/products")} className="font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-error">
            Xóa tất cả
          </button>
        )}
      </div>

      {/* Danh mục */}
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="mb-space-xs font-telemetry-xs text-telemetry-xs uppercase text-outline">Danh mục</legend>
        {facets.categories.map(({ value, count }) => {
          const checked = current.categories?.includes(value) ?? false;
          return (
            <label key={value} className="flex cursor-pointer items-center justify-between rounded-lg px-space-xs py-space-2xs transition-colors hover:bg-surface-container-high">
              <span className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => navigate({ categories: toggleValue(current.categories, value) })}
                  className="h-4 w-4 accent-primary"
                />
                {CATEGORY_LABELS[value] ?? value}
              </span>
              <span className="font-telemetry-xs text-telemetry-xs text-outline">{count}</span>
            </label>
          );
        })}
      </fieldset>

      {/* Thương hiệu */}
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="mb-space-xs font-telemetry-xs text-telemetry-xs uppercase text-outline">Thương hiệu</legend>
        {facets.brands.map(({ value, count }) => {
          const checked = current.brands?.includes(value) ?? false;
          return (
            <label key={value} className="flex cursor-pointer items-center justify-between rounded-lg px-space-xs py-space-2xs transition-colors hover:bg-surface-container-high">
              <span className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => navigate({ brands: toggleValue(current.brands, value) })}
                  className="h-4 w-4 accent-primary"
                />
                {value}
              </span>
              <span className="font-telemetry-xs text-telemetry-xs text-outline">{count}</span>
            </label>
          );
        })}
      </fieldset>

      {/* Giá */}
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="mb-space-xs font-telemetry-xs text-telemetry-xs uppercase text-outline">Khoảng giá (triệu ₫)</legend>
        <div className="flex items-center gap-space-xs">
          <label className="sr-only" htmlFor="min-price">Giá thấp nhất</label>
          <input
            id="min-price"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={Math.round(facets.priceRange.min / 1_000_000).toString()}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-full rounded-lg bg-surface-container-low px-space-xs py-space-2xs font-telemetry-data text-telemetry-data text-on-surface outline-none placeholder:text-outline"
          />
          <span className="text-outline">–</span>
          <label className="sr-only" htmlFor="max-price">Giá cao nhất</label>
          <input
            id="max-price"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={Math.round(facets.priceRange.max / 1_000_000).toString()}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-full rounded-lg bg-surface-container-low px-space-xs py-space-2xs font-telemetry-data text-telemetry-data text-on-surface outline-none placeholder:text-outline"
          />
          <button
            type="button"
            onClick={() =>
              navigate({
                minPrice: minPrice ? Number(minPrice) * 1_000_000 : undefined,
                maxPrice: maxPrice ? Number(maxPrice) * 1_000_000 : undefined,
              })
            }
            className="rounded-lg bg-primary px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-primary"
          >
            Áp dụng
          </button>
        </div>
        <span className="font-telemetry-xs text-[10px] text-outline">
          Hiện có: {formatCompactVND(facets.priceRange.min)} – {formatCompactVND(facets.priceRange.max)}
        </span>
      </fieldset>

      {/* Rating + availability */}
      <fieldset className="flex flex-col gap-space-xs">
        <legend className="mb-space-xs font-telemetry-xs text-telemetry-xs uppercase text-outline">Đánh giá & Tình trạng</legend>
        <label className="flex cursor-pointer items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
          <input
            type="checkbox"
            checked={current.inStockOnly ?? false}
            onChange={() => navigate({ inStockOnly: !current.inStockOnly })}
            className="h-4 w-4 accent-primary"
          />
          Chỉ hiện sẵn hàng
        </label>
        <div className="flex gap-space-xs">
          {[
            { value: 4.5, label: "4.5★+" },
            { value: 4.0, label: "4.0★+" },
            { value: 0, label: "Tất cả" },
          ].map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate({ minRating: value || undefined })}
              aria-pressed={(current.minRating ?? 0) === value}
              className={cn(
                "flex-1 rounded-lg px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase transition-colors",
                (current.minRating ?? 0) === value ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant hover:text-on-surface",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {current.tag && (
        <div className="flex items-center justify-between rounded-lg bg-primary/10 px-space-xs py-space-2xs">
          <span className="font-telemetry-xs text-telemetry-xs uppercase text-primary">Tag: {current.tag}</span>
          <button type="button" onClick={() => navigate({ tag: undefined })} aria-label="Bỏ tag" className="text-outline hover:text-error">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex items-center justify-between gap-space-sm">
        <label className="sr-only" htmlFor="sort-select">Sắp xếp</label>
        <select
          id="sort-select"
          value={current.sort ?? ""}
          onChange={(e) => navigate({ sort: (e.target.value || undefined) as SortOption | undefined })}
          className="flex-1 rounded-lg bg-surface-container px-space-sm py-space-xs font-telemetry-data text-telemetry-data text-on-surface outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex items-center gap-space-2xs rounded-lg bg-surface-container px-space-sm py-space-xs font-telemetry-data text-telemetry-data uppercase text-on-surface lg:hidden"
          aria-expanded={mobileOpen}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">tune</span>
          Lọc {activeCount > 0 && `(${activeCount})`}
        </button>
      </div>

      <div className="hidden lg:block">{panel}</div>
      {mobileOpen && <div className="lg:hidden">{panel}</div>}

      <p className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-outline" aria-live="polite">
        {total} thiết bị phù hợp
      </p>
    </div>
  );
}
