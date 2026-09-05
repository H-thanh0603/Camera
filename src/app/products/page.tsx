import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { applyQuery } from "@/lib/repositories/product-repository";
import { dbAllProducts } from "@/lib/server/product-db";
import type { Category, ProductQuery } from "@/lib/types";
import { ProductCard } from "@/components/product/product-card";
import { EmptyState, CardSkeletonGrid } from "@/components/ui/states";
import { CatalogControls } from "@/components/catalog/catalog-controls";
import { parseCatalogParams } from "@/lib/utils/catalog-params";
import { getFacets as buildFacets } from "@/lib/repositories/product-repository";

export const metadata: Metadata = {
  title: "Kho Thiết Bị — Máy Ảnh, Ống Kính & Phụ Kiện",
  description: "Duyệt toàn bộ catalogue Lumina Optics: flagship, medium format, cine prime, phụ kiện — filter theo brand, giá, rating và tình trạng hàng.",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const parsed = parseCatalogParams(params);

  const query: ProductQuery = {
    brands: parsed.brands,
    categories: parsed.categories as Category[] | undefined,
    minPrice: parsed.minPrice,
    maxPrice: parsed.maxPrice,
    minRating: parsed.minRating,
    inStockOnly: parsed.inStockOnly,
    search: parsed.search,
    tags: parsed.tag ? [parsed.tag] : undefined,
    sort: parsed.sort,
    page: parsed.page,
    pageSize: 9,
  };

  const catalog = await dbAllProducts();
  const result = applyQuery(catalog, query);
  const facets = buildFacets({ ...query, page: undefined, brands: undefined, categories: undefined }, catalog);

  return (
    <div className="container-page flex flex-col gap-space-xl py-space-xl">
      <nav aria-label="Breadcrumb" className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-outline">
        <Link href="/" className="transition-colors hover:text-primary">Trang chủ</Link>
        <span className="px-space-2xs">/</span>
        <span className="text-on-surface-variant">Kho thiết bị</span>
      </nav>

      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">PRECISION VAULT • {result.total} THIẾT BỊ</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          {parsed.search ? `Kết quả cho "${parsed.search}"` : "Kho Thiết Bị Nguyên Bản"}
        </h1>
        <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
          Mỗi thiết bị được cân chỉnh collimator và bảo lưu chứng nhận quang học độc bản trước khi bàn giao.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <Suspense fallback={<CardSkeletonGrid count={1} />}>
            <CatalogControls
              facets={facets}
              total={result.total}
              current={{
                brands: parsed.brands ?? [],
                categories: parsed.categories ?? [],
                minPrice: parsed.minPrice,
                maxPrice: parsed.maxPrice,
                minRating: parsed.minRating,
                inStockOnly: parsed.inStockOnly,
                search: parsed.search,
                tag: parsed.tag,
                sort: parsed.sort,
              }}
            />
          </Suspense>
        </aside>

        <div className="flex flex-col gap-space-xl lg:col-span-9">
          {result.items.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="Không tìm thấy thiết bị phù hợp"
              description="Thử bỏ một vài bộ lọc hoặc tìm với từ khóa khác như “Leica”, “anamorphic”, “medium format”."
              action={
                <Link href="/products" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
                  Xóa tất cả bộ lọc
                </Link>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-space-xl md:grid-cols-2 xl:grid-cols-3">
                {result.items.map((product, i) => (
                  <ProductCard key={product.id} product={product} priority={i < 3} />
                ))}
              </div>

              {result.totalPages > 1 && (
                <nav className="flex items-center justify-center gap-space-xs" aria-label="Phân trang">
                  {Array.from({ length: result.totalPages }).map((_, i) => {
                    const pageNum = i + 1;
                    const sp = new URLSearchParams();
                    if (parsed.brands?.length) sp.set("brand", parsed.brands.join(","));
                    if (parsed.categories?.length) sp.set("category", parsed.categories.join(","));
                    if (parsed.minPrice) sp.set("minPrice", String(parsed.minPrice));
                    if (parsed.maxPrice) sp.set("maxPrice", String(parsed.maxPrice));
                    if (parsed.minRating) sp.set("minRating", String(parsed.minRating));
                    if (parsed.inStockOnly) sp.set("inStock", "1");
                    if (parsed.search) sp.set("search", parsed.search);
                    if (parsed.tag) sp.set("tag", parsed.tag);
                    if (parsed.sort) sp.set("sort", parsed.sort);
                    if (pageNum > 1) sp.set("page", String(pageNum));
                    const href = sp.toString() ? `/products?${sp.toString()}` : "/products";
                    return (
                      <Link
                        key={pageNum}
                        href={href}
                        aria-current={pageNum === result.page ? "page" : undefined}
                        className={
                          pageNum === result.page
                            ? "flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-telemetry-data text-telemetry-data text-on-primary"
                            : "flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container font-telemetry-data text-telemetry-data text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
                        }
                      >
                        {pageNum}
                      </Link>
                    );
                  })}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
