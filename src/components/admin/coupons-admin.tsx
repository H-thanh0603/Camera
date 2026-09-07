"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatVND, formatDate, cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

interface AdminCoupon {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  maxUses: number | null;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
}

const QUERY_KEY = ["admin", "coupons"];

function valueLabel(c: AdminCoupon): string {
  return c.kind === "percent" ? `${c.value}%` : formatVND(c.value);
}

export function CouponsAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<{ coupons: AdminCoupon[] }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/admin/coupons");
      if (!res.ok) throw new Error("Không tải được mã giảm giá.");
      return res.json();
    },
  });
  const coupons = data?.coupons ?? [];

  const [formError, setFormError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [minSubtotal, setMinSubtotal] = useState("5000000");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const create = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          kind,
          value: Number(value),
          minSubtotal: Number(minSubtotal) || 0,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error ?? "Tạo mã thất bại.");
    },
    onSuccess: () => {
      setCode("");
      setValue("10");
      setMinSubtotal("5000000");
      setFormError(null);
      invalidate();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (c: AdminCoupon) => {
      const res = await fetch(`/api/admin/coupons/${c.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !c.active }),
      });
      if (!res.ok) throw new Error("Đổi trạng thái thất bại.");
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (c: AdminCoupon) => {
      const res = await fetch(`/api/admin/coupons/${c.code}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Xóa mã thất bại.");
    },
    onSuccess: invalidate,
  });

  const busyCode = (toggle.isPending ? (toggle.variables as AdminCoupon | undefined)?.code : null)
    ?? (remove.isPending ? (remove.variables as AdminCoupon | undefined)?.code : null);

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">SALES PROMOTION</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Mã Giảm Giá</h1>
      </header>

      {/* Tạo mã mới */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl"
      >
        <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Tạo mã mới</h2>
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-space-2xs">
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Mã</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="VD: TET2026"
              required
              minLength={3}
              maxLength={32}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-telemetry-data text-telemetry-data uppercase text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-space-2xs">
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Loại</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "percent" | "fixed")}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="percent">Phần trăm (%)</option>
              <option value="fixed">Số tiền cố định (₫)</option>
            </select>
          </label>
          <label className="flex flex-col gap-space-2xs">
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">
              Giá trị {kind === "percent" ? "(1–90)" : "(₫)"}
            </span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type="number"
              min={1}
              max={kind === "percent" ? 90 : undefined}
              required
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
          <label className="flex flex-col gap-space-2xs">
            <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Đơn tối thiểu (₫)</span>
            <input
              value={minSubtotal}
              onChange={(e) => setMinSubtotal(e.target.value)}
              type="number"
              min={0}
              className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        </div>
        {formError && <p className="font-body-sm text-body-sm text-error" role="alert">{formError}</p>}
        <button
          type="submit"
          disabled={create.isPending}
          className="self-start rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
        >
          {create.isPending ? "Đang tạo..." : "Tạo mã"}
        </button>
      </form>

      {/* Danh sách */}
      {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{(error as Error).message}</p>}
      {isLoading ? (
        <div className="flex justify-center py-space-lg"><Spinner className="border-primary border-t-transparent" /></div>
      ) : coupons.length === 0 ? (
        <p className="rounded-xl bg-surface-container p-space-lg font-body-md text-body-md text-on-surface-variant">Chưa có mã giảm giá nào.</p>
      ) : (
        <ul className="flex flex-col gap-space-sm">
          {coupons.map((c) => (
            <li key={c.code} className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-surface-container p-space-md shadow-xl">
              <div className="flex flex-col gap-space-2xs">
                <span className="font-telemetry-data text-telemetry-data text-primary">{c.code}</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Giảm {valueLabel(c)} • Đơn từ {formatVND(c.minSubtotal)} • Đã dùng {c.usedCount}{c.maxUses != null ? `/${c.maxUses}` : ""}
                  {c.expiresAt ? ` • Hết hạn ${formatDate(c.expiresAt)}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                <span className={cn("rounded-lg px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase", c.active ? "bg-primary/20 text-primary" : "bg-surface-container-high text-outline")}>
                  {c.active ? "Đang bật" : "Đã tắt"}
                </span>
                <button
                  type="button"
                  disabled={busyCode === c.code}
                  onClick={() => toggle.mutate(c)}
                  className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface transition-colors hover:bg-surface-container-highest"
                >
                  {c.active ? "Tắt" : "Bật"}
                </button>
                <button
                  type="button"
                  disabled={busyCode === c.code}
                  onClick={() => {
                    if (window.confirm(`Xóa mã ${c.code}? Đơn đã dùng mã vẫn giữ nguyên tổng tiền.`)) remove.mutate(c);
                  }}
                  className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-error"
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
