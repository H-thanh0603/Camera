"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  const queryClient = useQueryClient();
  const { data: orders, isLoading, error } = useQuery<{ orders: Order[] }>({
    queryKey: ["admin", "orders"],
    queryFn: async () => {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error("Không tải được đơn hàng.");
      return res.json();
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Cập nhật thất bại.");
      }
    },
    onSuccess: (_data, variables) => {
      // Optimistic update trong cache — không cần refetch
      queryClient.setQueryData<{ orders: Order[] }>(["admin", "orders"], (prev) =>
        prev ? { orders: prev.orders.map((o) => (o.id === variables.id ? { ...o, status: variables.status } : o)) } : prev,
      );
    },
  });

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">ORDER OPS</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Quản Trị Đơn Hàng</h1>
      </header>

      {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{(error as Error).message}</p>}
      {isLoading ? (
        <div className="flex justify-center py-space-lg"><Spinner className="border-primary border-t-transparent" /></div>
      ) : (orders?.orders ?? []).length === 0 ? (
        <p className="rounded-xl bg-surface-container p-space-lg font-body-md text-body-md text-on-surface-variant">Chưa có đơn hàng nào.</p>
      ) : (
        <ul className="flex flex-col gap-space-md">
          {(orders?.orders ?? []).map((o) => (
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
                    disabled={changeStatus.isPending}
                    onChange={(e) => changeStatus.mutate({ id: o.id, status: e.target.value as OrderStatus })}
                    className="rounded-lg bg-surface-container-low px-space-sm py-space-2xs font-telemetry-data text-telemetry-data uppercase text-on-surface outline-none focus:ring-1 focus:ring-primary"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  {changeStatus.isPending && <Spinner className="border-primary border-t-transparent" />}
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
