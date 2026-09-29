"use client";

import { useState } from "react";
import type { Metadata } from "next";
import type { Order } from "@/lib/types";
import { apiLookupOrder, ApiError } from "@/lib/api-client";
import { formatVND, formatDate } from "@/lib/utils/format";
import { EmptyState, Spinner } from "@/components/ui/states";

export const metadata: Metadata = { title: "Tra cứu đơn hàng — Lumina Optics" };

/**
 * Trang tra cứu đơn cho khách vãng lai (không cần login).
 * Gọi POST /api/orders/lookup {number, token} — token sở hữu đơn được cấp
 * 1 lần ở màn xác nhận đặt hàng (không qua email vì đó là yếu tố sở hữu).
 */

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  paid: "Đã thanh toán",
  processing: "Đang xử lý",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
};
const STATUS_CLASS: Record<string, string> = {
  pending: "text-secondary",
  paid: "text-primary",
  processing: "text-tertiary",
  shipped: "text-tertiary",
  delivered: "text-primary",
  cancelled: "text-error",
  refunded: "text-error",
};

export default function OrderLookupPage() {
  const [number, setNumber] = useState("");
  const [token, setToken] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOrder(null);
    try {
      setOrder(await apiLookupOrder(number.trim(), token.trim()));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không tra cứu được đơn hàng.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page flex flex-col items-center gap-space-lg py-space-3xl">
      <div className="flex w-full max-w-lg flex-col gap-space-md rounded-xl bg-surface-container p-space-xl shadow-xl">
        <div className="flex flex-col gap-space-2xs text-center">
          <span className="section-telemetry">ORDER TRACKING</span>
          <h1 className="font-headline-md text-headline-md text-on-surface">Tra Cứu Đơn Hàng</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Dành cho đơn đặt không cần tài khoản. Mã bảo mật đơn (token) được cấp ngay sau khi đặt —
            giữ nó như hóa đơn giấy. Đã có tài khoản?{" "}
            <a href="/account" className="underline text-primary">Xem đơn trong Tài khoản</a>.
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-space-sm">
          <label className="flex flex-col gap-space-2xs">
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Mã đơn hàng (VD: LUM-…)</span>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value.toUpperCase())}
              required
              maxLength={64}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-telemetry-data text-telemetry-data uppercase text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-space-2xs">
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Mã bảo mật đơn</span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              maxLength={128}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-telemetry-data text-telemetry-data text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={busy || !number.trim() || !token.trim()}
            className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
          >
            {busy ? <Spinner className="mx-auto border-on-primary border-t-transparent" /> : "Tra cứu"}
          </button>
        </form>
      </div>

      {order && (
        <div className="flex w-full max-w-lg flex-col gap-space-md rounded-xl bg-surface-container p-space-xl shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <span className="font-telemetry-data text-telemetry-data text-primary">{order.number}</span>
            <span className={`font-telemetry-xs text-telemetry-xs uppercase ${STATUS_CLASS[order.status] ?? ""}`}>
              {STATUS_LABEL[order.status] ?? order.status}
            </span>
          </div>
          <span className="font-telemetry-xs text-telemetry-xs text-outline">Đặt lúc {formatDate(order.createdAt)}</span>
          {"trackingCode" in order && order.trackingCode && (
            <p className="rounded-lg bg-surface-container-low p-space-sm font-body-sm text-body-sm text-on-surface">
              Mã vận đơn: <strong className="text-primary">{order.trackingCode}</strong>
              {order.carrier ? ` • ${order.carrier}` : ""}
            </p>
          )}
          <ul className="flex flex-col gap-space-2xs">
            {order.lines.map((l) => (
              <li key={`${l.productId}-${l.variantId ?? ""}`} className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low px-space-sm py-space-2xs font-body-sm text-body-sm">
                <span className="text-on-surface">{l.name}{l.variantName ? ` — ${l.variantName}` : ""} × {l.quantity}</span>
                <span className="text-on-surface-variant">{formatVND(l.unitPrice * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="font-body-md text-body-md text-on-surface">
            Tổng cộng: <strong className="text-primary">{formatVND(order.totals.total)}</strong>
          </p>
        </div>
      )}

      {!order && !busy && (
        <EmptyState icon="receipt_long" title="Chưa có đơn nào được tra cứu" description="Nhập mã đơn + mã bảo mật ở trên để xem trạng thái." />
      )}
    </div>
  );
}
