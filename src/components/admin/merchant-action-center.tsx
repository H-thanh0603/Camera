"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InventoryHealth } from "@/lib/server/merchant-insights";

/** Proactive dashboard evidence: loads without waiting for a chat question. */
export function MerchantActionCenter() {
  const [inventory, setInventory] = useState<InventoryHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/admin/merchant/inventory", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Không tải được tồn kho.");
        if (!controller.signal.aborted) setInventory(data.inventory);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Không tải được tồn kho.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision]);

  return (
    <section aria-label="Merchant Action Center" aria-busy={loading} className="flex flex-col gap-space-md rounded-xl bg-surface-container p-space-lg shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">Merchant Action Center</h2>
        <button type="button" disabled={loading} onClick={() => { setLoading(true); setError(null); setInventory(null); setRevision((n) => n + 1); }} className="rounded-lg border border-outline px-space-sm py-space-xs text-primary disabled:opacity-50">Làm mới tồn kho</button>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">Cảnh báo theo tồn hiện tại: hết hàng ≤ 0, tồn thấp 1–5. Đây không phải dự báo ngày hết hàng; chưa phân tích riêng biến thể.</p>
      {loading && <p role="status">Đang kiểm tra tồn kho…</p>}
      {error && <p role="alert" className="text-error">{error}</p>}
      {!loading && inventory && <>
        <p role="status" className="font-body-sm text-body-sm">
          Hết hàng: {inventory.counts.critical} · Tồn thấp: {inventory.counts.low} · Trên ngưỡng: {inventory.counts.healthy}
        </p>
        <p className="text-outline text-body-sm">Đối chiếu lúc {new Date(inventory.observedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (giờ Việt Nam)</p>
        {inventory.items.length === 0 ? <p>Không có sản phẩm tồn kho dưới ngưỡng cảnh báo.</p> : <ul className="flex flex-col gap-space-xs">
          {inventory.items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
            <span>{item.name} <span className="text-outline">({item.sku})</span></span>
            <strong className={item.stock <= 0 ? "text-error" : "text-secondary"}>{item.stock <= 0 ? "Hết hàng" : "Tồn thấp"} · {item.stock}</strong>
          </li>)}
        </ul>}
        {inventory.truncated && <p>Hiển thị 20 sản phẩm tồn thấp nhất trong {inventory.counts.critical + inventory.counts.low} sản phẩm cần kiểm tra.</p>}
        <Link href="/admin/stock" className="text-primary underline">Kiểm tra và nhập kho</Link>
      </>}
    </section>
  );
}
