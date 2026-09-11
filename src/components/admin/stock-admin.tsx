"use client";

import { useState } from "react";
import type { Product } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

interface Movement {
  id: string;
  productId: string;
  variantId: string | null;
  type: string;
  quantity: number;
  balanceAfter: number | null;
  reason: string;
  refOrderId: string | null;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = { in: "Nhập", out: "Xuất", adjust: "Chỉnh" };

/** Sổ kho: phiếu nhập/xuất/chốt tồn + lịch sử biến động (đơn hàng tự ghi). */
export function StockAdmin({
  initialProducts,
  initialMovements,
}: {
  initialProducts: Product[];
  initialMovements: Movement[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [movements, setMovements] = useState(initialMovements);
  const [productId, setProductId] = useState(initialProducts[0]?.id ?? "");
  const [variantId, setVariantId] = useState("");
  const [mode, setMode] = useState<"in" | "out" | "set">("in");
  const [quantity, setQuantity] = useState("10");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const product = products.find((p) => p.id === productId);
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          variantId: variantId || null,
          mode,
          quantity: Number(quantity),
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không ghi được phiếu kho.");
        return;
      }
      setMessage(`Đã ghi phiếu (${mode === "in" ? "+" : mode === "out" ? "−" : "="}${quantity}). Tồn hiện tại: ${data.productStock}.`);
      setReason("");
      // Làm mới tồn hiển thị + lịch sử
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: data.productStock } : p)),
      );
      const list = await fetch(`/api/admin/stock?productId=${productId}&take=100`).then((r) => r.json());
      setMovements(list.movements ?? []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">WAREHOUSE OPS</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Quản Trị Kho Hàng</h1>
      </header>

      {message && <p className="rounded-lg bg-surface-container-low p-space-sm font-body-sm text-body-sm text-primary" role="status">{message}</p>}
      {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{error}</p>}

      <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl" aria-label="Phiếu kho">
        <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Phiếu Nhập / Xuất / Chốt Tồn</h2>
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="stock-product" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Sản phẩm</label>
            <select
              id="stock-product"
              value={productId}
              onChange={(e) => { setProductId(e.target.value); setVariantId(""); }}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (tồn {p.stock})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="stock-variant" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Variant (để trống = tổng SP)</label>
            <select
              id="stock-variant"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none"
            >
              <option value="">— Tổng sản phẩm —</option>
              {(product?.variants ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.name} (tồn {v.stock})</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="stock-mode" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Loại phiếu</label>
            <select
              id="stock-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as "in" | "out" | "set")}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none"
            >
              <option value="in">Nhập kho (+)</option>
              <option value="out">Xuất kho (−)</option>
              <option value="set">Chốt tồn (=)</option>
            </select>
          </div>
          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="stock-qty" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Số lượng</label>
            <input
              id="stock-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-col gap-space-2xs sm:col-span-2">
            <label htmlFor="stock-reason" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Lý do (bắt buộc)</label>
            <input
              id="stock-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="vd: nhập NCC tháng 9, kiểm kê lệch, hàng lỗi thanh lý…"
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-sm text-body-sm text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !productId}
          className="flex w-fit items-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
        >
          {busy && <Spinner className="border-on-primary border-t-transparent" />}
          Ghi phiếu kho
        </button>
      </section>

      <section className="flex flex-col gap-space-md rounded-xl bg-surface-container p-space-lg shadow-xl" aria-label="Lịch sử biến động">
        <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Lịch Sử Biến Động (100 dòng gần nhất)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <caption className="sr-only">Lịch sử biến động kho</caption>
            <thead>
              <tr className="border-b border-surface-container-highest">
                {["Thời gian", "Sản phẩm", "Loại", "SL", "Tồn sau", "Lý do"].map((h) => (
                  <th key={h} scope="col" className="p-space-md text-left font-telemetry-xs text-telemetry-xs uppercase text-outline">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-b border-surface-container-high last:border-b-0">
                  <td className="p-space-md font-telemetry-data text-telemetry-data text-on-surface-variant">{formatDate(m.createdAt)}</td>
                  <td className="p-space-md font-body-sm text-body-sm text-on-surface">{productName(m.productId)}{m.variantId ? " (variant)" : ""}</td>
                  <td className="p-space-md">
                    <span className={cn(
                      "rounded-lg px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase",
                      m.type === "in" ? "bg-primary/20 text-primary" : m.type === "out" ? "bg-surface-container-high text-on-surface-variant" : "bg-tertiary-container/30 text-tertiary",
                    )}>
                      {TYPE_LABEL[m.type] ?? m.type}
                    </span>
                  </td>
                  <td className={cn("p-space-md font-telemetry-data text-telemetry-data", m.quantity >= 0 ? "text-primary" : "text-error")}>
                    {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="p-space-md font-telemetry-data text-telemetry-data text-on-surface">{m.balanceAfter ?? "—"}</td>
                  <td className="max-w-64 truncate p-space-md font-body-sm text-body-sm text-on-surface-variant" title={m.reason}>{m.reason}{m.refOrderId ? " (đơn)" : ""}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={6} className="p-space-md text-center font-body-sm text-body-sm text-outline">Chưa có biến động nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
