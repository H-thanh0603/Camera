"use client";

import Link from "next/link";
import { useStore } from "@/state/store";
import { formatVND } from "@/lib/utils/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/services/cart-service";
import { EmptyState } from "@/components/ui/states";
import { AVAILABILITY_CLASS, AVAILABILITY_LABEL } from "@/lib/utils/availability";
import { cn } from "@/lib/utils/format";

export default function CartPage() {
  const { cartSnapshot, setQuantity, removeFromCart, clearCart, hydrated } = useStore();
  const { lines, totals } = cartSnapshot;
  const progress = Math.min(100, (totals.subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  if (!hydrated) {
    return <div className="container-page py-space-3xl"><EmptyState icon="hourglass_empty" title="Đang tải giỏ hàng..." /></div>;
  }

  return (
    <div className="container-page flex flex-col gap-space-xl py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">PRECISION CHECKOUT • BƯỚC ĐẦU TIÊN</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Giỏ Hàng Của Bạn</h1>
      </header>

      {lines.length === 0 ? (
        <EmptyState
          icon="shopping_bag"
          title="Giỏ hàng trống"
          description="Khám phá thế giới nhiếp ảnh — từ flagship 61MP tới ống kính anamorphic kinh điển."
          action={
            <Link href="/products" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
              Khám phá thiết bị
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-12">
          <div className="flex flex-col gap-space-md lg:col-span-8">
            {totals.amountToFreeShipping > 0 ? (
              <div className="rounded-xl bg-surface-container-low p-space-md">
                <p className="font-body-sm text-body-sm text-on-surface">
                  Bạn chỉ còn <strong className="text-primary">{formatVND(totals.amountToFreeShipping)}</strong> để được miễn phí vận chuyển
                </p>
                <div className="mt-space-2xs h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <p className="rounded-xl bg-surface-container-low p-space-md font-body-sm text-body-sm text-primary" role="status">
                Đơn của bạn được MIỄN PHÍ vận chuyển toàn quốc.
              </p>
            )}

            <ul className="flex flex-col gap-space-md">
              {lines.map((line) => (
                <li key={`${line.productId}::${line.variantId ?? ""}`} className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-md sm:flex-row">
                  <Link href={`/products/${line.product.slug}`} className="flex items-center justify-center rounded-lg bg-surface-container-low p-space-sm sm:w-40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={line.product.thumbnail.url} alt={line.product.thumbnail.alt} loading="lazy" className="h-24 w-full object-contain" />
                  </Link>
                  <div className="flex flex-1 flex-col justify-between gap-space-sm">
                    <div className="flex items-start justify-between gap-space-sm">
                      <div className="flex flex-col gap-space-2xs">
                        <Link href={`/products/${line.product.slug}`} className="font-headline-sm text-headline-sm text-on-surface transition-colors hover:text-primary">
                          {line.product.name}
                        </Link>
                        {line.variant && <span className="font-telemetry-xs text-telemetry-xs text-outline">{line.variant.name} • {line.variant.sku}</span>}
                        <span className={cn("font-telemetry-xs text-telemetry-xs uppercase", AVAILABILITY_CLASS[line.product.availability])}>
                          {AVAILABILITY_LABEL[line.product.availability]}
                        </span>
                      </div>
                      <span className="font-telemetry-data text-telemetry-data font-bold text-primary">{formatVND(line.lineTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-xs">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.variantId, line.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest"
                          aria-label={`Giảm số lượng ${line.product.name}`}
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-telemetry-data text-telemetry-data text-on-surface" aria-live="polite">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.variantId, line.quantity + 1)}
                          disabled={line.quantity >= line.maxQuantity}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40"
                          aria-label={`Tăng số lượng ${line.product.name}`}
                        >
                          +
                        </button>
                        <span className="ml-space-xs font-telemetry-xs text-telemetry-xs text-outline">{formatVND(line.unitPrice)}/sp</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.productId, line.variantId)}
                        className="flex items-center gap-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface-variant transition-colors hover:text-error"
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span> Xóa
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex justify-between">
              <Link href="/products" className="flex items-center gap-space-2xs font-telemetry-data text-telemetry-data uppercase text-on-surface-variant transition-colors hover:text-primary">
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_back</span> Tiếp tục khám phá
              </Link>
              <button type="button" onClick={clearCart} className="font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-error">
                Xóa toàn bộ giỏ
              </button>
            </div>
          </div>

          {/* Order summary */}
          <aside className="flex h-fit flex-col gap-space-md rounded-xl bg-surface-container p-space-xl shadow-xl lg:col-span-4" aria-label="Tổng kết đơn hàng">
            <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Tổng Kết Đơn</h2>
            <dl className="flex flex-col gap-space-xs font-body-sm text-body-sm">
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Tạm tính ({totals.itemCount} sản phẩm)</dt>
                <dd className="font-telemetry-data text-telemetry-data text-on-surface">{formatVND(totals.subtotal)}</dd>
              </div>
              {totals.savings > 0 && (
                <div className="flex justify-between text-primary">
                  <dt>Tiết kiệm</dt>
                  <dd className="font-telemetry-data text-telemetry-data">−{formatVND(totals.savings)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-on-surface-variant">Vận chuyển</dt>
                <dd className="font-telemetry-data text-telemetry-data text-on-surface">
                  {totals.shipping === 0 ? "Miễn phí" : formatVND(totals.shipping)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-surface-container-high pt-space-sm">
                <dt className="font-headline-sm text-headline-sm text-on-surface">Tổng cộng</dt>
                <dd className="font-telemetry-data text-[20px] font-bold text-primary">{formatVND(totals.total)}</dd>
              </div>
            </dl>
            <p className="font-telemetry-xs text-telemetry-xs uppercase leading-relaxed text-outline">
              Giá đã bao gồm VAT. Số tiền cuối cùng được xác nhận trong bước thanh toán.
            </p>
            <Link
              href="/checkout"
              className="flex items-center justify-center gap-space-2xs rounded-lg bg-primary py-space-sm font-headline-sm text-telemetry-data uppercase text-on-primary shadow-[0_8px_32px_rgba(212,175,55,0.15)] transition-colors hover:bg-primary-fixed-dim"
            >
              <span>Tiến hành thanh toán</span>
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
