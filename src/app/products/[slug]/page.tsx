import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ALL_PRODUCTS, getProductBySlug } from "@/lib/repositories/product-repository";
import { getCompleteSetup, getSimilarProducts } from "@/lib/services/recommendation-service";
import { brandOrigin } from "@/lib/data/products";
import { formatDate } from "@/lib/utils/format";
import { ProductPurchasePanel } from "@/components/product/product-purchase-panel";
import { ProductCard } from "@/components/product/product-card";
import { RecentlyViewedClient } from "@/components/product/recently-viewed";
import { EmptyState } from "@/components/ui/states";
import { RatingStars } from "@/components/ui/rating-stars";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return ALL_PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Không tìm thấy sản phẩm" };
  return {
    title: `${product.name} — ${product.brand}`,
    description: product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      images: [{ url: product.thumbnail.url, alt: product.thumbnail.alt }],
      type: "website",
    },
  };
}

const SPEC_LABELS: Record<string, string> = {
  sensor: "Cảm biến",
  resolution: "Độ phân giải",
  iso: "Dải ISO",
  shutter: "Cửa trập",
  autofocus: "Lấy nét tự động",
  burst: "Chụp liên tiếp",
  video: "Quay video",
  ibis: "Chống rung IBIS",
  screen: "Màn hình",
  battery: "Pin",
  weight: "Trọng lượng",
  dimensions: "Kích thước",
  mount: "Ngàm mount",
  focalLength: "Tiêu cự",
  aperture: "Khẩu độ",
  filterThread: "Đường kính filter",
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const completeSetup = getCompleteSetup(product);
  const similar = getSimilarProducts(product, 3);

  // Product structured data (SEO)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    description: product.shortDescription,
    image: product.images.map((i) => i.url),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency,
      price: product.price,
      availability:
        product.availability === "in_stock" || product.availability === "low_stock"
          ? "https://schema.org/InStock"
          : product.availability === "pre_order"
            ? "https://schema.org/PreOrder"
            : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="container-page flex flex-col gap-space-xl pb-24 pt-space-lg lg:pb-space-xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="font-telemetry-xs text-telemetry-xs uppercase tracking-widest text-outline">
        <Link href="/" className="transition-colors hover:text-primary">Trang chủ</Link>
        <span className="px-space-2xs">/</span>
        <Link href="/products" className="transition-colors hover:text-primary">Kho thiết bị</Link>
        <span className="px-space-2xs">/</span>
        <span className="text-on-surface-variant">{product.name}</span>
      </nav>

      <ProductPurchasePanel product={product} />

      {/* Story + Specs + In the box */}
      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-12">
        <section className="flex flex-col gap-space-md lg:col-span-7" aria-label="Giới thiệu sản phẩm">
          <span className="section-telemetry">PRODUCT STORYTELLING</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">Vì Sao Nó Sinh Ra</h2>
          <p className="font-body-lg text-body-lg leading-relaxed text-on-surface-variant">{product.description}</p>
          {product.highlights && product.highlights.length > 0 && (
            <ul className="flex flex-col gap-space-xs pt-space-sm">
              {product.highlights.map((h) => (
                <li key={h} className="flex items-start gap-space-xs font-body-md text-body-md text-on-surface">
                  <span className="material-symbols-outlined mt-0.5 text-[18px] text-primary" aria-hidden="true">check_circle</span>
                  {h}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-space-md rounded-xl bg-surface-container p-space-xl shadow-xl lg:col-span-5" aria-label="Thông số kỹ thuật">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Thông Số Kỹ Thuật</h2>
            <span className="rounded-lg bg-primary/20 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold uppercase text-primary">
              {brandOrigin[product.brand] ?? "CHUẨN STUDIO"}
            </span>
          </div>
          <dl className="flex flex-col gap-space-2xs font-body-sm text-body-sm">
            {Object.entries(product.specifications).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-space-sm border-b border-surface-container-high py-space-2xs last:border-b-0">
                <dt className="text-on-surface-variant">{SPEC_LABELS[key] ?? key}</dt>
                <dd className="text-right font-telemetry-data text-telemetry-data font-semibold text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
          {product.inTheBox && (
            <div className="pt-space-sm">
              <h3 className="mb-space-xs font-telemetry-xs text-telemetry-xs uppercase text-outline">{"What's in the box"}</h3>
              <ul className="flex flex-col gap-space-2xs font-body-sm text-body-sm text-on-surface-variant">
                {product.inTheBox.map((item) => (
                  <li key={item} className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">inventory_2</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* Reviews */}
      <section className="flex flex-col gap-space-md" aria-label="Đánh giá của khách hàng">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">Đánh Giá Từ Chủ Nhân ({product.reviewCount})</h2>
          <span className="flex items-center gap-space-xs">
            <RatingStars rating={product.rating} />
            <span className="font-telemetry-data text-telemetry-data text-primary">{product.rating.toFixed(1)}/5</span>
          </span>
        </div>
        {product.reviews && product.reviews.length > 0 ? (
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
            {product.reviews.map((review) => (
              <article key={review.id} className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-lg">
                <div className="flex items-center justify-between">
                  <RatingStars rating={review.rating} size={14} />
                  <span className="font-telemetry-xs text-telemetry-xs text-outline">{formatDate(review.date)}</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{review.title}</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{review.body}</p>
                <footer className="flex items-center gap-space-xs pt-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-outline">
                  <span className="text-on-surface">{review.author}</span>
                  {review.verified && (
                    <span className="flex items-center gap-space-2xs text-primary">
                      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">verified</span> ĐÃ MUA TẠI LUMINA
                    </span>
                  )}
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="rate_review"
            title="Chưa có đánh giá chi tiết"
            description={`Sản phẩm mới được cập nhật vault. Trở thành chủ nhân đầu tiên chia sẻ trải nghiệm về ${product.name}.`}
          />
        )}
      </section>

      {/* Complete your setup */}
      {completeSetup.length > 0 && (
        <section className="flex flex-col gap-space-md" aria-label="Hoàn thiện bộ thiết bị">
          <span className="section-telemetry">COMPLETE YOUR SETUP</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">Phụ Kiện Đồng Bộ Khuyến Nghị</h2>
          <div className="grid grid-cols-1 gap-space-xl md:grid-cols-3 xl:grid-cols-4">
            {completeSetup.map((r) => (
              <ProductCard key={r.product.id} product={r.product} />
            ))}
          </div>
        </section>
      )}

      {/* Similar */}
      {similar.length > 0 && (
        <section className="flex flex-col gap-space-md" aria-label="Sản phẩm tương tự">
          <span className="section-telemetry">YOU MAY ALSO LIKE</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">Tương Tự & Cùng Hệ Sinh Thái</h2>
          <div className="grid grid-cols-1 gap-space-xl md:grid-cols-3">
            {similar.map((r) => (
              <ProductCard key={r.product.id} product={r.product} />
            ))}
          </div>
        </section>
      )}

      <RecentlyViewedClient excludeId={product.id} />
    </div>
  );
}
