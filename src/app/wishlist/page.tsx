"use client";

import Link from "next/link";
import { useStore } from "@/state/store";
import { getProductsByIds } from "@/lib/repositories/product-repository";
import { formatVND, cn } from "@/lib/utils/format";
import { AVAILABILITY_CLASS, AVAILABILITY_LABEL, canPurchase } from "@/lib/utils/availability";
import { EmptyState } from "@/components/ui/states";
import { RatingStars } from "@/components/ui/rating-stars";

export default function WishlistPage() {
  const { wishlist, removeWishlist, addToCart, hydrated } = useStore();

  if (!hydrated) {
    return <div className="container-page py-space-3xl"><EmptyState icon="hourglass_empty" title="Đang tải..." /></div>;
  }

  const entries = wishlist
    .map((entry) => ({ entry, product: getProductsByIds([entry.productId])[0] }))
    .filter((e): e is { entry: (typeof wishlist)[number]; product: NonNullable<(typeof e)["product"]> } => Boolean(e.product));

  return (
    <div className="container-page flex flex-col gap-space-xl py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">DANH SÁCH ƯA THÍCH</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Bộ Sưu Tập Của Bạn</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">Những thiết bị bạn đã đánh dấu — giá và tình trạng hàng được cập nhật trực tiếp từ vault.</p>
      </header>

      {entries.length === 0 ? (
        <EmptyState
          icon="favorite"
          title="Wishlist trống"
          description="Nhấn vào trái tim trên bất kỳ sản phẩm nào để lưu lại cho lần khám phá tiếp theo."
          action={
            <Link href="/products" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary">
              Khám phá thiết bị
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-space-md">
          {entries.map(({ entry, product }) => {
            const priceChanged = product.price < entry.priceAtAdd;
            return (
              <li key={entry.productId} className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-md sm:flex-row sm:items-center">
                <Link href={`/products/${product.slug}`} className="flex items-center justify-center rounded-lg bg-surface-container-low p-space-sm sm:w-36">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.thumbnail.url} alt={product.thumbnail.alt} loading="lazy" className="h-20 w-full object-contain" />
                </Link>
                <div className="flex flex-1 flex-col gap-space-2xs">
                  <Link href={`/products/${product.slug}`} className="font-headline-sm text-headline-sm text-on-surface transition-colors hover:text-primary">
                    {product.name}
                  </Link>
                  <span className="flex items-center gap-space-sm">
                    <RatingStars rating={product.rating} size={14} />
                    <span className={cn("font-telemetry-xs text-telemetry-xs uppercase", AVAILABILITY_CLASS[product.availability])}>
                      {AVAILABILITY_LABEL[product.availability]}
                    </span>
                  </span>
                  <div className="flex items-center gap-space-sm">
                    <span className="font-telemetry-data text-telemetry-data font-bold text-primary">{formatVND(product.price)}</span>
                    {priceChanged && (
                      <span className="rounded bg-primary/20 px-space-xs py-0.5 font-telemetry-xs text-telemetry-xs uppercase text-primary">
                        Giảm giá — đã hạ từ {formatVND(entry.priceAtAdd)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-space-xs">
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    disabled={!canPurchase(product.availability)}
                    className={cn(
                      "rounded-lg px-space-md py-space-xs font-headline-sm text-telemetry-data uppercase transition-colors",
                      canPurchase(product.availability) ? "bg-primary text-on-primary hover:bg-primary-fixed-dim" : "cursor-not-allowed bg-surface-container-high text-outline",
                    )}
                  >
                    Chuyển vào giỏ
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWishlist(product.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant transition-colors hover:text-error"
                    aria-label={`Bỏ ${product.name} khỏi yêu thích`}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
