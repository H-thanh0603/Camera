"use client";

import Link from "next/link";
import { useState } from "react";
import { getProductById, getCatalog } from "@/lib/repositories/product-repository";
import { useStore } from "@/state/store";
import { formatVND, cn } from "@/lib/utils/format";
import { EmptyState } from "@/components/ui/states";
import { AppImage } from "@/components/ui/app-image";
import type { Category, Product } from "@/lib/types";

/**
 * #19 Kit Builder — gom giỏ hàng thành bộ kit (body + lens + phụ kiện),
 * tổng tiền + gợi ý tối ưu rule-based (không AI).
 */

const GROUPS: { key: string; label: string; icon: string; categories: Category[] }[] = [
  { key: "body", label: "Thân máy", icon: "photo_camera", categories: ["camera"] },
  { key: "lens", label: "Ống kính", icon: "camera", categories: ["lens"] },
  { key: "power", label: "Năng lượng & lưu trữ", icon: "battery_charging_full", categories: ["battery", "storage"] },
  { key: "other", label: "Phụ kiện khác", icon: "backpack", categories: ["lighting", "tripod", "bag", "accessory"] },
];

interface Suggestion {
  product: Product;
  reason: string;
}

function buildSuggestions(items: Product[]): Suggestion[] {
  const out: Suggestion[] = [];
  const inKit = new Set(items.map((p) => p.id));
  const bodies = items.filter((p) => p.category === "camera");
  const lenses = items.filter((p) => p.category === "lens");
  const hasPower = items.some((p) => p.category === "battery" || p.category === "storage");

  // 1. Body thiếu lens → lens rẻ nhất cùng style
  for (const body of bodies) {
    if (lenses.length > 0) break;
    const shared = (l: Product) => l.tags.filter((t) => body.tags.includes(t) && !t.startsWith("sensor:") && !t.startsWith("size:") && !t.startsWith("exp:")).length;
    const best = getCatalog()
      .filter((p) => p.category === "lens" && !inKit.has(p.id))
      .sort((a, b) => shared(b) - shared(a) || a.price - b.price)[0];
    if (best) out.push({ product: best, reason: `Đi kèm ${body.name} — cùng hệ sinh thái, tối ưu cho ${shared(best) > 0 ? "phong cách của body" : "đa dụng"}.` });
  }

  // 2. Nhiều Prime mà không Zoom → gợi ý zoom đa dụng thay thế
  const primes = lenses.filter((l) => l.subcategory === "Prime");
  if (primes.length >= 2 && !lenses.some((l) => l.subcategory === "Zoom")) {
    const zoom = getProductById("p-lumina-2470");
    if (zoom && !inKit.has(zoom.id)) {
      out.push({ product: zoom, reason: `Bạn có ${primes.length} lens prime — một zoom 24-70mm gọn hơn cho du lịch, đỡ thay lens ngoài trời.` });
    }
  }

  // 3. Body thiếu pin/lưu trữ → đồ tương thích
  for (const body of bodies) {
    if (hasPower) break;
    const compat = (body.compatibleWith ?? [])
      .map((id) => getProductById(id))
      .find((p) => p && (p.category === "battery" || p.category === "storage") && !inKit.has(p.id));
    if (compat) out.push({ product: compat, reason: `Phụ kiện chính hãng tương thích ${body.name} — đi shoot xa không lo hết pin/thẻ.` });
  }

  return out.slice(0, 3);
}

export default function KitPage() {
  const { cartSnapshot, hydrated, addToCart, user } = useStore();
  const [mailState, setMailState] = useState<"idle" | "sending" | "done" | "error">("idle");

  if (!hydrated) {
    return <div className="container-page py-space-3xl"><EmptyState icon="hourglass_empty" title="Đang tải..." /></div>;
  }

  const items = cartSnapshot.lines
    .map((l) => getProductById(l.productId))
    .filter((p): p is Product => Boolean(p));
  const total = cartSnapshot.totals.total;
  const suggestions = buildSuggestions(items);

  return (
    <div className="container-page flex flex-col gap-space-xl py-space-xl">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">MY CAMERA KIT</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Bộ Kit Của Bạn</h1>
        <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
          Mọi thứ trong giỏ, gom theo vai trò — kèm tổng tiền và gợi ý tối ưu từ chuyên gia.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon="backpack"
          title="Kit còn trống"
          description="Thêm thân máy, ống kính và phụ kiện vào giỏ — trang này sẽ ráp thành bộ kit hoàn chỉnh."
          action={
            <Link href="/products?category=camera" className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary">
              Chọn thân máy
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-space-xl lg:grid-cols-12">
          <div className="flex flex-col gap-space-md lg:col-span-7">
            {GROUPS.map((g) => {
              const groupItems = items.filter((p) => g.categories.includes(p.category));
              if (!groupItems.length) return null;
              return (
                <section key={g.key} aria-label={g.label} className="rounded-xl bg-surface-container p-space-lg shadow-xl">
                  <div className="mb-space-sm flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">{g.icon}</span>
                    <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">{g.label}</h2>
                  </div>
                  <ul className="flex flex-col gap-space-xs">
                    {groupItems.map((p) => (
                      <li key={p.id} className="flex items-center gap-space-sm rounded-lg bg-surface-container-low p-space-xs">
                        <AppImage src={p.thumbnail.url} alt={p.thumbnail.alt} width={56} height={56} className="h-14 w-14 rounded bg-surface-container object-contain p-1" />
                        <Link href={`/products/${p.slug}`} className="flex-1 font-body-md text-body-md text-on-surface hover:text-primary">{p.name}</Link>
                        <span className="font-telemetry-data text-telemetry-data font-bold text-primary">{formatVND(p.price)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <div className="flex flex-col gap-space-md lg:col-span-5">
            <section aria-label="Tổng kit" className="rounded-xl bg-primary p-space-lg text-on-primary shadow-xl">
              <span className="font-telemetry-xs text-telemetry-xs uppercase opacity-80">Tổng giá trị kit ({items.length} món)</span>
              <p className="font-headline-lg text-headline-lg">{formatVND(total)}</p>
              <Link href="/cart" className="mt-space-sm inline-flex items-center gap-space-xs rounded-lg bg-surface-container-lowest px-space-lg py-space-xs font-headline-sm text-headline-sm uppercase text-on-surface">
                <span>Xem giỏ & thanh toán</span>
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
              </Link>
              {user ? (
                <button
                  type="button"
                  disabled={mailState === "sending" || mailState === "done"}
                  onClick={async () => {
                    setMailState("sending");
                    try {
                      const res = await fetch("/api/kit/share-email", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          items: cartSnapshot.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
                        }),
                      });
                      setMailState(res.ok ? "done" : "error");
                    } catch {
                      setMailState("error");
                    }
                  }}
                  className="mt-space-xs inline-flex items-center gap-space-xs rounded-lg bg-surface-container-lowest/20 px-space-lg py-space-xs font-headline-sm text-headline-sm uppercase text-on-primary disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">mail</span>
                  <span>{mailState === "done" ? "Đã gửi vào email" : mailState === "sending" ? "Đang gửi…" : mailState === "error" ? "Gửi lỗi — thử lại" : "Gửi kit qua email"}</span>
                </button>
              ) : (
                <Link href="/account" className="mt-space-xs inline-flex items-center gap-space-xs font-body-sm text-body-sm text-on-primary underline">
                  Đăng nhập để gửi kit qua email
                </Link>
              )}
            </section>

            <section aria-label="Tối ưu kit" className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">auto_awesome</span>
                <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Optimize My Kit</h2>
              </div>
              {suggestions.length === 0 ? (
                <p className="font-body-md text-body-md text-on-surface-variant">Kit đã cân đối tốt — đủ body, lens và năng lượng. Xách máy lên và đi shoot thôi.</p>
              ) : (
                suggestions.map(({ product: p, reason }) => (
                  <article key={p.id} className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-sm">
                    <div className="flex items-center gap-space-sm">
                      <AppImage src={p.thumbnail.url} alt={p.thumbnail.alt} width={48} height={48} className="h-12 w-12 rounded bg-surface-container object-contain p-1" />
                      <div className="flex flex-1 flex-col">
                        <Link href={`/products/${p.slug}`} className="font-headline-sm text-headline-sm text-on-surface hover:text-primary">{p.name}</Link>
                        <span className="font-telemetry-data text-telemetry-data text-primary">{formatVND(p.price)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => addToCart(p)}
                        className={cn("rounded-lg bg-primary px-space-sm py-space-2xs font-headline-sm text-telemetry-data uppercase text-on-primary hover:bg-primary-fixed-dim")}
                      >
                        + Giỏ
                      </button>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">{reason}</p>
                  </article>
                ))
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
