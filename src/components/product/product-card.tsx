"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { discountPercent, formatVND } from "@/lib/utils/format";
import { AVAILABILITY_CLASS, AVAILABILITY_LABEL } from "@/lib/utils/availability";
import { RatingStars } from "@/components/ui/rating-stars";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils/format";

/**
 * ProductCard chuẩn hóa từ card "Vault" trong prototype — giữ nguyên style.
 * Component chỉ nhận data, không chứa business logic.
 */
export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const { addToCart, toggleWishlist, isWishlisted, toggleCompare, isCompared, setCartDrawerOpen } = useStore();
  const [hovered, setHovered] = useState(false);
  const discount = discountPercent(product.price, product.compareAtPrice);
  const secondaryImage = product.images[1];

  const ctaLabel =
    product.availability === "contact"
      ? "Yêu Cầu Báo Giá"
      : product.availability === "pre_order"
        ? "Đặt Trước"
        : "Thêm Vào Giỏ";

  return (
    <article
      className="group flex flex-col justify-between overflow-hidden rounded-xl bg-surface-container shadow-xl transition-all hover:shadow-[0_12px_40px_rgba(242,202,80,0.1)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-surface-container-low p-space-md">
        <Link
          href={`/products/${product.slug}`}
          className="flex h-full w-full items-center justify-center"
          aria-label={`Xem chi tiết ${product.name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hovered && secondaryImage ? secondaryImage.url : product.thumbnail.url}
            alt={hovered && secondaryImage ? secondaryImage.alt : product.thumbnail.alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-contain transition-opacity duration-300"
          />
        </Link>

        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
          {(discount !== null ? [...product.badges.slice(0, 1), `GIẢM ${discount}%`] : product.badges.slice(0, 2)).map(
            (badge) => (
              <span
                key={badge}
                className="rounded bg-surface-container-high/90 px-space-xs py-0.5 font-telemetry-xs text-[10px] font-bold uppercase text-primary"
              >
                {badge}
              </span>
            ),
          )}
          <span className={cn("rounded bg-surface-container-low/80 px-space-xs py-0.5 font-telemetry-xs text-[10px]", AVAILABILITY_CLASS[product.availability])}>
            {AVAILABILITY_LABEL[product.availability]}
          </span>
        </div>

        <div className="absolute right-3 top-3 flex flex-col gap-space-2xs">
          <button
            type="button"
            onClick={() => toggleWishlist(product)}
            aria-label={isWishlisted(product.id) ? `Bỏ ${product.name} khỏi yêu thích` : `Lưu ${product.name} vào yêu thích`}
            aria-pressed={isWishlisted(product.id)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high/90 transition-colors",
              isWishlisted(product.id) ? "text-primary" : "text-on-surface hover:text-primary",
            )}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {isWishlisted(product.id) ? "favorite" : "favorite_border"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => toggleCompare(product.id)}
            aria-label={isCompared(product.id) ? `Bỏ ${product.name} khỏi so sánh` : `Thêm ${product.name} vào so sánh`}
            aria-pressed={isCompared(product.id)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high/90 transition-colors",
              isCompared(product.id) ? "text-primary" : "text-on-surface hover:text-primary",
            )}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              {isCompared(product.id) ? "done" : "compare_arrows"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-space-md p-space-lg">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{product.brand} • {product.subcategory}</span>
            <span className="flex items-center gap-1 font-telemetry-xs text-telemetry-xs text-outline">
              <RatingStars rating={product.rating} size={14} />
              <span>({product.reviewCount})</span>
            </span>
          </div>
          <h3 className="font-headline-sm text-headline-sm text-on-surface transition-colors group-hover:text-primary">
            <Link href={`/products/${product.slug}`}>{product.name}</Link>
          </h3>
          <p className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{product.shortDescription}</p>
        </div>

        <div className="flex flex-col gap-space-sm pt-space-xs">
          <div className="flex items-baseline justify-between">
            <span className="font-telemetry-data text-[20px] font-bold text-primary">{formatVND(product.price)}</span>
            {product.monthlyFrom && (
              <span className="font-telemetry-xs text-telemetry-xs text-outline">Từ {formatVND(product.monthlyFrom)}/tháng</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-space-xs">
            <button
              type="button"
              onClick={() => {
                if (product.availability === "contact") {
                  setCartDrawerOpen(false);
                  window.location.href = `mailto:concierge@luminaoptics.vn?subject=Báo giá ${product.sku}`;
                  return;
                }
                addToCart(product);
              }}
              disabled={product.availability === "out_of_stock"}
              className={cn(
                "flex items-center justify-center gap-1 rounded-lg px-space-sm py-space-xs font-headline-sm text-telemetry-data uppercase transition-colors",
                product.availability === "out_of_stock"
                  ? "cursor-not-allowed bg-surface-container-high text-outline"
                  : "bg-primary text-on-primary hover:bg-primary-fixed-dim",
              )}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                {product.availability === "contact" ? "support_agent" : product.availability === "pre_order" ? "schedule" : "shopping_bag"}
              </span>
              <span>{product.availability === "out_of_stock" ? "Tạm Hết" : ctaLabel}</span>
            </button>
            <Link
              href={`/products/${product.slug}`}
              className="flex items-center justify-center rounded-lg bg-surface-container-high px-space-sm py-space-xs font-headline-sm text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              Chi Tiết
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
