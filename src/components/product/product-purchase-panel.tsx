"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { maxQuantityOf, resolveVariant, unitCompareAtPriceOf, unitPriceOf } from "@/lib/services/cart-service";
import { discountPercent, formatVND, cn } from "@/lib/utils/format";
import { AVAILABILITY_CLASS, AVAILABILITY_LABEL, canPurchase } from "@/lib/utils/availability";
import { RatingStars } from "@/components/ui/rating-stars";
import { useStore } from "@/state/store";
import { track } from "@/lib/analytics";

/**
 * PurchasePanel — gallery, variant selector, quantity, CTA.
 * Đổi variant không reload trang: image/SKU/price/stock đều cập nhật từ state.
 * Trên mobile có sticky purchase bar.
 */
export function ProductPurchasePanel({ product }: { product: Product }) {
  const router = useRouter();
  const { addToCart, toggleWishlist, isWishlisted, toggleCompare, isCompared, trackView } = useStore();

  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState<string | undefined>(product.variants?.[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [zoom, setZoom] = useState(false);

  const variant = resolveVariant(product, variantId);
  const price = unitPriceOf(product, variant);
  const compareAt = unitCompareAtPriceOf(product, variant);
  const discount = discountPercent(price, compareAt);
  const maxQuantity = maxQuantityOf(product, variant);
  const effectiveMax = Math.max(1, Math.min(maxQuantity, 10));
  const availability = variant?.availability ?? product.availability;
  const purchasable = maxQuantity > 0 && canPurchase(availability);
  const sku = variant?.sku ?? product.sku;

  // Ghi nhận lượt xem cho Recently Viewed + analytics
  useEffect(() => {
    trackView(product.id);
    track("view_item", { productId: product.id, price: product.price, category: product.category });
  }, [product.id, product.price, product.category, trackView]);

  const displayImage = useMemo(() => {
    if (variant?.image) return variant.image;
    return product.images[activeImage] ?? product.thumbnail;
  }, [variant, activeImage, product]);

  const handleAddToCart = (buyNow = false) => {
    const ok = addToCart(product, variantId, quantity);
    if (ok && buyNow) router.push("/checkout");
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-12">
        {/* Gallery */}
        <div className="flex flex-col gap-space-sm lg:col-span-7">
          <div
            className="relative flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-surface-container-low p-space-lg shadow-xl"
            onClick={() => setZoom(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && setZoom(true)}
            aria-label="Phóng to ảnh sản phẩm (NHẤP ĐỂ ZOOM)"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayImage.url} alt={displayImage.alt} className="h-full w-full object-contain" />
            <span className="absolute bottom-space-sm right-space-sm rounded bg-surface-container-highest/80 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs text-outline backdrop-blur">
              <span className="material-symbols-outlined align-middle text-[14px]" aria-hidden="true">zoom_in</span> NHẤP ĐỂ ZOOM
            </span>
            {discount !== null && (
              <span className="absolute left-space-sm top-space-sm rounded-lg bg-primary px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs font-bold uppercase text-on-primary">
                GIẢM {discount}%
              </span>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-space-sm" role="tablist" aria-label="Ảnh sản phẩm">
              {product.images.map((image, i) => (
                <button
                  key={image.url}
                  type="button"
                  role="tab"
                  aria-selected={activeImage === i}
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    "flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border p-1 transition-colors",
                    activeImage === i ? "border-primary" : "border-surface-container-highest hover:border-outline",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.alt} loading="lazy" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info + Purchase */}
        <div className="flex flex-col gap-space-md lg:col-span-5">
          <div className="flex flex-col gap-space-xs">
            <span className="font-telemetry-xs text-telemetry-xs uppercase tracking-wider text-outline">{product.brand} • {product.subcategory}</span>
            <h1 className="font-headline-lg text-headline-lg-mobile text-on-surface lg:text-headline-lg">{product.name}</h1>
            <div className="flex items-center gap-space-sm">
              <RatingStars rating={product.rating} />
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {product.rating.toFixed(1)} • {product.reviewCount} đánh giá
              </span>
              <span className={cn("font-telemetry-xs text-telemetry-xs uppercase", AVAILABILITY_CLASS[availability])}>
                ● {AVAILABILITY_LABEL[availability]}
              </span>
            </div>
          </div>

          <p className="font-body-md text-body-md text-on-surface-variant">{product.shortDescription}</p>

          {/* Price block */}
          <div className="flex flex-col gap-space-2xs rounded-xl bg-surface-container p-space-md">
            <div className="flex items-baseline gap-space-sm">
              <span className="font-telemetry-data text-[28px] font-bold text-primary">{formatVND(price)}</span>
              {compareAt && compareAt > price && (
                <span className="font-telemetry-data text-telemetry-data text-outline line-through">{formatVND(compareAt)}</span>
              )}
            </div>
            {product.monthlyFrom && (
              <span className="font-telemetry-xs text-telemetry-xs text-outline">Trả góp 0% từ {formatVND(product.monthlyFrom)}/tháng qua thẻ tín dụng VIP</span>
            )}
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-on-surface-variant">SKU: {sku}</span>
          </div>

          {/* Variant selector */}
          {product.variants && product.variants.length > 0 && (
            <fieldset className="flex flex-col gap-space-xs">
              <legend className="mb-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-outline">Phiên bản</legend>
              <div className="flex flex-col gap-space-2xs">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVariantId(v.id);
                      setQuantity(1);
                    }}
                    aria-pressed={variantId === v.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-space-sm py-space-xs text-left transition-colors",
                      variantId === v.id ? "bg-primary/15 ring-1 ring-primary" : "bg-surface-container hover:bg-surface-container-high",
                    )}
                  >
                    <span className="flex flex-col">
                      <span className="font-body-sm text-body-sm font-semibold text-on-surface">{v.name}</span>
                      <span className="font-telemetry-xs text-telemetry-xs text-on-surface-variant">{v.sku}</span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="font-telemetry-data text-telemetry-data font-bold text-primary">{formatVND(v.price)}</span>
                      <span className={cn("font-telemetry-xs text-telemetry-xs", AVAILABILITY_CLASS[v.availability])}>{AVAILABILITY_LABEL[v.availability]}</span>
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Quantity + CTA (desktop) */}
          <div className="hidden flex-col gap-space-sm lg:flex">
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-space-xs">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                  aria-label="Giảm số lượng"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={effectiveMax || 1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(Number(e.target.value) || 1, effectiveMax || 1)))}
                  className="w-16 rounded-lg bg-surface-container py-space-xs text-center font-telemetry-data text-telemetry-data text-on-surface outline-none"
                  aria-label="Số lượng"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(effectiveMax || 1, q + 1))}
                  disabled={quantity >= effectiveMax}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                  aria-label="Tăng số lượng"
                >
                  +
                </button>
              </div>
              {effectiveMax > 0 && effectiveMax <= 5 && (
                <span className="font-telemetry-xs text-telemetry-xs uppercase text-secondary">Chỉ còn {effectiveMax} sản phẩm</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-space-sm">
              <button
                type="button"
                onClick={() => handleAddToCart(false)}
                disabled={!purchasable}
                className={cn(
                  "flex items-center justify-center gap-space-2xs rounded-lg py-space-sm font-headline-sm text-telemetry-data uppercase transition-colors",
                  purchasable ? "bg-primary text-on-primary hover:bg-primary-fixed-dim" : "cursor-not-allowed bg-surface-container-high text-outline",
                )}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">shopping_bag</span>
                Thêm Vào Giỏ
              </button>
              <button
                type="button"
                onClick={() => handleAddToCart(true)}
                disabled={!purchasable}
                className={cn(
                  "flex items-center justify-center gap-space-2xs rounded-lg py-space-sm font-headline-sm text-telemetry-data uppercase transition-colors",
                  purchasable ? "bg-primary-container text-on-primary-container hover:bg-primary" : "cursor-not-allowed bg-surface-container-high text-outline",
                )}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">bolt</span>
                Mua Ngay
              </button>
            </div>

            <div className="flex gap-space-sm">
              <button
                type="button"
                onClick={() => toggleWishlist(product)}
                aria-pressed={isWishlisted(product.id)}
                className="flex flex-1 items-center justify-center gap-space-2xs rounded-lg bg-surface-container-high py-space-xs font-telemetry-data text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{isWishlisted(product.id) ? "favorite" : "favorite_border"}</span>
                Yêu thích
              </button>
              <button
                type="button"
                onClick={() => toggleCompare(product.id)}
                aria-pressed={isCompared(product.id)}
                className="flex flex-1 items-center justify-center gap-space-2xs rounded-lg bg-surface-container-high py-space-xs font-telemetry-data text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">compare_arrows</span>
                So sánh
              </button>
            </div>
          </div>

          <ul className="flex flex-col gap-space-2xs rounded-xl bg-surface-container-low p-space-md font-body-sm text-body-sm text-on-surface-variant">
            <li className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">verified_user</span> Bảo hành 5 năm tận nơi, vệ sinh sensor trọn đời</li>
            <li className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">change_circle</span> Đổi mới 30 ngày không cần lý do</li>
            <li className="flex items-center gap-space-xs"><span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">apartment</span> Đặt lịch test 1:1 tại Studio Quận 1 & Hoàn Kiếm</li>
          </ul>
        </div>
      </div>

      {/* Zoom modal */}
      {zoom && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-surface-container-lowest/95 p-space-md" role="dialog" aria-modal="true" aria-label="Ảnh phóng to" onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displayImage.url} alt={displayImage.alt} className="max-h-[90vh] max-w-[90vw] object-contain" />
          <button type="button" onClick={() => setZoom(false)} className="absolute right-space-md top-space-md rounded-full bg-surface-container-high p-space-xs text-on-surface" aria-label="Đóng zoom">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      {/* Sticky mobile purchase bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-space-sm border-t border-surface-container-highest bg-surface-container-lowest/95 p-space-sm backdrop-blur-xl lg:hidden">
        <div className="flex flex-col">
          <span className="font-telemetry-data text-telemetry-data font-bold text-primary">{formatVND(price * quantity)}</span>
          <span className="font-telemetry-xs text-telemetry-xs text-outline">{AVAILABILITY_LABEL[availability]}</span>
        </div>
        <div className="flex items-center gap-space-xs">
          <button
            type="button"
            onClick={() => toggleWishlist(product)}
            aria-pressed={isWishlisted(product.id)}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-on-surface"
            aria-label="Yêu thích"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{isWishlisted(product.id) ? "favorite" : "favorite_border"}</span>
          </button>
          <button
            type="button"
            onClick={() => handleAddToCart(false)}
            disabled={!purchasable}
            className={cn(
              "flex items-center gap-space-2xs rounded-lg px-space-md py-space-xs font-headline-sm text-telemetry-data uppercase transition-colors",
              purchasable ? "bg-primary text-on-primary" : "bg-surface-container-high text-outline",
            )}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">shopping_bag</span>
            Thêm giỏ
          </button>
          <button
            type="button"
            onClick={() => handleAddToCart(true)}
            disabled={!purchasable}
            className={cn(
              "rounded-lg px-space-md py-space-xs font-headline-sm text-telemetry-data uppercase transition-colors",
              purchasable ? "bg-primary-container text-on-primary-container" : "bg-surface-container-high text-outline",
            )}
          >
            Mua ngay
          </button>
        </div>
      </div>
    </>
  );
}
