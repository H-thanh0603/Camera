"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { formatVND, formatDate, cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";
import { AppImage } from "@/components/ui/app-image";

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
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const { data, isLoading, error } = useQuery<{ orders: Order[]; total: number; totalPages: number }>({
    queryKey: ["admin", "orders", page, filter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orders?status=${filter}&page=${page}&pageSize=20`);
      if (!res.ok) throw new Error("Không tải được đơn hàng.");
      return res.json();
    },
  });
  const orders = data?.orders ?? [];
  const totalPages = data?.totalPages ?? 1;

  const saveTracking = useMutation({
    mutationFn: async ({ id, trackingCode, carrier }: { id: string; trackingCode: string; carrier: string }) => {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingCode, carrier }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Lưu vận đơn thất bại.");
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<{ orders: Order[]; total: number; totalPages: number }>(
        ["admin", "orders", page, filter],
        (prev) =>
          prev
            ? {
                ...prev,
                orders: prev.orders.map((o) =>
                  o.id === variables.id
                    ? { ...o, trackingCode: variables.trackingCode || undefined, carrier: variables.carrier as Order["carrier"] }
                    : o,
                ),
              }
            : prev,
      );
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
      queryClient.setQueryData<{ orders: Order[]; total: number; totalPages: number }>(
        ["admin", "orders", page, filter],
        (prev) =>
          prev
            ? { ...prev, orders: prev.orders.map((o) => (o.id === variables.id ? { ...o, status: variables.status } : o)) }
            : prev,
      );
    },
  });

  const refundVnpay = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/orders/${id}/refund`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Hoàn tiền thất bại.");
      }
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<{ orders: Order[]; total: number; totalPages: number }>(
        ["admin", "orders", page, filter],
        (prev) =>
          prev
            ? { ...prev, orders: prev.orders.map((o) => (o.id === id ? { ...o, status: "refunded" as OrderStatus } : o)) }
            : prev,
      );
    },
  });

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex flex-col gap-space-2xs">
          <span className="section-telemetry">ORDER OPS</span>
          <h1 className="font-headline-md text-headline-md text-on-surface">Quản Trị Đơn Hàng</h1>
        </div>
        <a
          href={`/api/admin/orders/export?status=${filter}`}
          download
          className="rounded-lg bg-surface-container-high px-space-md py-space-xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface transition-colors hover:bg-primary hover:text-on-primary"
        >
          Xuất CSV
        </a>
      </header>

      <div className="flex flex-wrap gap-space-xs" role="tablist" aria-label="Lọc đơn theo trạng thái">
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={filter === s}
            onClick={() => {
              setFilter(s);
              setPage(1);
            }}
            className={cn(
              "rounded-lg px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase transition-colors",
              filter === s ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant hover:text-on-surface",
            )}
          >
            {s === "all" ? "Tất cả" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{(error as Error).message}</p>}
      {isLoading ? (
        <div className="flex justify-center py-space-lg"><Spinner className="border-primary border-t-transparent" /></div>
      ) : orders.length === 0 ? (
        <p className="rounded-xl bg-surface-container p-space-lg font-body-md text-body-md text-on-surface-variant">Không có đơn hàng nào trong mục này.</p>
      ) : (
        <>
        <ul className="flex flex-col gap-space-md">
          {orders.map((o) => (
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
                  {o.status === "paid" && o.payment === "vnpay" && (
                    <button
                      type="button"
                      disabled={refundVnpay.isPending}
                      onClick={() => {
                        if (window.confirm(`Hoàn tiền VNPay ${formatVND(o.totals.total)} cho đơn ${o.number}? Tiền về tài khoản khách qua VNPay.`)) {
                          refundVnpay.mutate(o.id, {
                            onError: (err) => window.alert(err.message),
                          });
                        }
                      }}
                      className="rounded-lg bg-error-container/30 px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-error transition-colors hover:bg-error-container/50 disabled:opacity-40"
                    >
                      {refundVnpay.isPending ? "Đang hoàn…" : "Hoàn tiền VNPay"}
                    </button>
                  )}
                  {changeStatus.isPending && <Spinner className="border-primary border-t-transparent" />}
                </div>
              </div>
              <ul className="flex flex-wrap gap-space-sm">
                {o.lines.map((l) => (
                  <li key={`${l.productId}-${l.variantId ?? ""}`} className="flex items-center gap-space-2xs rounded-lg bg-surface-container-low p-space-2xs">
                    <AppImage src={l.image} alt="" width={40} height={40} className="h-10 w-10 rounded object-contain" />
                    <span className="font-telemetry-xs text-telemetry-xs text-on-surface">
                      {l.name}{l.variantName ? ` — ${l.variantName}` : ""} × {l.quantity}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={cn("font-telemetry-xs text-telemetry-xs uppercase text-outline")}>
                Giao nhận: {o.delivery} • Thanh toán: {o.payment} • Địa chỉ: {o.shipping.address}, {o.shipping.district}, {o.shipping.city}
                {o.shipping.companyName ? ` • VAT: ${o.shipping.companyName} (MST ${o.shipping.taxCode})` : ""}
              </p>
              <TrackingEditor order={o} onSave={(trackingCode, carrier) => saveTracking.mutate({ id: o.id, trackingCode, carrier })} saving={saveTracking.isPending} />
            </li>
          ))}
        </ul>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-space-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface disabled:opacity-40">
              ← Trước
            </button>
            <span className="font-telemetry-xs text-telemetry-xs text-outline">Trang {page}/{totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface disabled:opacity-40">
              Sau →
            </button>
          </div>
        )}
        </>
      )}
    </div>
  );
}

function TrackingEditor({
  order,
  onSave,
  saving,
}: {
  order: Order;
  onSave: (trackingCode: string, carrier: string) => void;
  saving: boolean;
}) {
  const [code, setCode] = useState(order.trackingCode ?? "");
  const [carrier, setCarrier] = useState<string>(order.carrier ?? "manual");
  const dirty = code !== (order.trackingCode ?? "") || carrier !== (order.carrier ?? "manual");
  return (
    <form
      className="flex flex-wrap items-center gap-space-xs"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(code.trim(), carrier);
      }}
    >
      <label className="sr-only" htmlFor={`carrier-${order.id}`}>Đơn vị vận chuyển {order.number}</label>
      <select
        id={`carrier-${order.id}`}
        value={carrier}
        onChange={(e) => setCarrier(e.target.value)}
        className="rounded-lg bg-surface-container-low px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface outline-none"
      >
        <option value="manual">Tự bàn giao</option>
        <option value="ghn">GHN</option>
        <option value="ghtk">GHTK</option>
      </select>
      <label className="sr-only" htmlFor={`tracking-${order.id}`}>Mã vận đơn {order.number}</label>
      <input
        id={`tracking-${order.id}`}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Mã vận đơn…"
        className="min-w-40 flex-1 rounded-lg bg-surface-container-low px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary"
      />
      <button
        type="submit"
        disabled={!dirty || saving}
        className="rounded-lg bg-surface-container-high px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface transition-colors hover:bg-primary hover:text-on-primary disabled:opacity-40"
      >
        {saving ? "Đang lưu…" : "Lưu vận đơn"}
      </button>
    </form>
  );
}
