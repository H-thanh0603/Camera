"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { formatVND } from "@/lib/utils/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/services/cart-service";
import { useStore } from "@/state/store";
import { EmptyState } from "@/components/ui/states";

export function CartDrawer() {
  const { cartDrawerOpen, setCartDrawerOpen, cartSnapshot, setQuantity, removeFromCart } = useStore();
  const pathname = usePathname();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCartDrawerOpen(false);
    };
    if (cartDrawerOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartDrawerOpen, setCartDrawerOpen]);

  // Đóng drawer khi điều hướng xong — KHÔNG đóng trong onClick của Link:
  // unmount Link ngay khi click khiến App Router hủy navigation.
  useEffect(() => {
    setCartDrawerOpen(false);
  }, [pathname, setCartDrawerOpen]);

  if (!cartDrawerOpen) return null;

  const { lines, totals } = cartSnapshot;
  const progress = Math.min(100, (totals.subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Giỏ hàng">
      <button
        type="button"
        className="absolute inset-0 bg-surface-container-lowest/90 backdrop-blur-sm"
        aria-label="Đóng giỏ hàng"
        onClick={() => setCartDrawerOpen(false)}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-in-right flex-col gap-space-md bg-surface-container p-space-lg shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            Giỏ hàng <span className="font-telemetry-data text-telemetry-data text-primary">({totals.itemCount})</span>
          </h2>
          <button
            type="button"
            onClick={() => setCartDrawerOpen(false)}
            className="p-space-2xs text-on-surface-variant transition-colors hover:text-on-surface"
            aria-label="Đóng giỏ hàng"
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        {lines.length === 0 ? (
          <EmptyState
            icon="shopping_bag"
            title="Giỏ hàng trống"
            description="Khám phá thế giới nhiếp ảnh — từ flagship 61MP tới ống kính anamorphic."
            action={
              <Link
                href="/products"
                className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim"
              >
                Khám phá thiết bị
              </Link>
            }
          />
        ) : (
          <>
            {/* Free shipping progress */}
            <div className="rounded-lg bg-surface-container-low p-space-sm">
              <p className="font-telemetry-xs text-telemetry-xs uppercase text-on-surface-variant">
                {totals.amountToFreeShipping > 0
                  ? `Bạn chỉ còn ${formatVND(totals.amountToFreeShipping)} để được miễn phí vận chuyển`
                  : "Đơn của bạn được MIỄN PHÍ vận chuyển"}
              </p>
              <div className="mt-space-2xs h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ul className="flex flex-1 flex-col gap-space-sm overflow-y-auto">
              {lines.map((line) => (
                <li key={lineKey(line)} className="flex gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={line.product.thumbnail.url} alt={line.product.thumbnail.alt} loading="lazy" className="h-20 w-20 shrink-0 rounded-lg object-contain" />
                  <div className="flex flex-1 flex-col gap-space-2xs">
                    <div className="flex items-start justify-between gap-space-xs">
                      <div>
                        <p className="font-headline-sm text-headline-sm text-on-surface">{line.product.name}</p>
                        {line.variant && <p className="font-telemetry-xs text-telemetry-xs text-outline">{line.variant.name}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.productId, line.variantId)}
                        className="text-on-surface-variant transition-colors hover:text-error"
                        aria-label={`Xóa ${line.product.name} khỏi giỏ`}
                      >
                        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-space-xs">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.variantId, line.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
                          aria-label="Giảm số lượng"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-telemetry-data text-telemetry-data text-on-surface" aria-live="polite">{line.quantity}</span>
                        <button
                          type="button"
                          disabled={line.quantity >= line.maxQuantity}
                          onClick={() => setQuantity(line.productId, line.variantId, line.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                          aria-label="Tăng số lượng"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-telemetry-data text-telemetry-data font-bold text-primary">{formatVND(line.lineTotal)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-space-xs border-t border-surface-container-high pt-space-sm">
              <div className="flex justify-between font-body-sm text-body-sm text-on-surface-variant">
                <span>Tạm tính</span>
                <span className="font-telemetry-data text-telemetry-data text-on-surface">{formatVND(totals.subtotal)}</span>
              </div>
              {totals.savings > 0 && (
                <div className="flex justify-between font-body-sm text-body-sm text-primary">
                  <span>Tiết kiệm</span>
                  <span className="font-telemetry-data text-telemetry-data">−{formatVND(totals.savings)}</span>
                </div>
              )}
              <div className="flex justify-between font-headline-sm text-headline-sm text-on-surface">
                <span>Tổng cộng</span>
                <span className="text-primary">{formatVND(totals.total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-space-xs pt-space-2xs">
                <Link
                  href="/cart"
                  className="rounded-lg bg-surface-container-high py-space-xs text-center font-headline-sm text-telemetry-data uppercase text-on-surface transition-colors hover:bg-surface-container-highest"
                >
                  Xem giỏ hàng
                </Link>
                <Link
                  href="/checkout"
                  className="rounded-lg bg-primary py-space-xs text-center font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim"
                >
                  Thanh toán
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function lineKey(l: { productId: string; variantId?: string }) {
  return `${l.productId}::${l.variantId ?? ""}`;
}
