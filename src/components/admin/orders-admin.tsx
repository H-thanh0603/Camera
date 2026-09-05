"use client";

import { useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { formatVND, formatDate, cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

const STATUSES: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  processing: "Đang xử lý",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
};

export function OrdersAdmin() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => setError("Không tải được đơn hàng."));
  }, []);

  const changeStatus = async (id: string, status: OrderStatus) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setOrders((prev) => prev?.map((o) => (o.id === id ? { ...o, status } : o)) ?? prev);
      } else {
        const data = await res.json();
        setError(data.error ?? "Cập nhật thất bại.");
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">ORDER OPS</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Quản Trị Đơn Hàng</h1>
      </header>

      {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{error}</p>}
      {orders === null && !error ? (
        <div className="flex justify-center py-space-lg"><Spinner className="border-primary border-t-transparent" /></div>
      ) : (orders ?? []).length === 0 ? (
        <p className="rounded-xl bg-surface-container p-space-lg font-body-md text-body-md text-on-surface-variant">Chưa có đơn hàng nào.</p>
      ) : (
        <ul className="flex flex-col gap-space-md">
          {(orders ?? []).map((o) => (
            <li key={o.id} className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-space-sm">
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-on-surface">{o.number}</span>
                  <span className="font-telemetry-xs text-telemetry-xs text-outline">
                    {formatDate(o.createdAt)} • {o.contact.fullName} • {o.contact.phone}
                  </span>
                </div>
                <div className="flex items-center gap-space-sm">
                  <span className="font-telemetry-data text-telemetry-data font-bold text-primary">{formatVND(o.totals.total)}</span>
                  <label className="sr-only" htmlFor={`status-${o.id}`}>Trạng thái đơn {o.number}</label>
                  <select
                    id={`status-${o.id}`}
                    value={o.status}
                    disabled={updatingId === o.id}
                    onChange={(e) => changeStatus(o.id, e.target.value as OrderStatus)}
                    className="rounded-lg bg-surface-container-low px-space-sm py-space-2xs font-telemetry-data text-telemetry-data uppercase text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  {updatingId === o.id && <Spinner className="border-primary border-t-transparent" />}
                </div>
              </div>
              <ul className="flex flex-wrap gap-space-sm">
                {o.lines.map((l) => (
                  <li key={`${l.productId}-${l.variantId ?? ""}`} className="flex items-center gap-space-2xs rounded-lg bg-surface-container-low p-space-2xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={l.image} alt="" loading="lazy" className="h-10 w-10 rounded object-contain" />
                    <span className="font-telemetry-xs text-telemetry-xs text-on-surface">
                      {l.name}{l.variantName ? ` — ${l.variantName}` : ""} × {l.quantity}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={cn("font-telemetry-xs text-telemetry-xs uppercase text-outline")}>
                Giao nhận: {o.delivery} • Thanh toán: {o.payment} • Địa chỉ: {o.shipping.address}, {o.shipping.district}, {o.shipping.city}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
