"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDate, cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

/**
 * Quản trị bản nháp mô tả sản phẩm do AI sinh (MerchantDescriptionDraft).
 * API: GET /api/admin/merchant/drafts (danh sách 100 mới nhất),
 * POST { productId } (sinh nháp mới), PATCH /:id { decision } (duyệt/từ chối).
 * Duyệt = ghi description vào sản phẩm (server tự verify + chống đua).
 */

interface MerchantDraft {
  id: string;
  productId: string;
  productName: string;
  before: string;
  after: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface AdminProductLite {
  id: string;
  name: string;
}

const QUERY_KEY = ["admin", "merchant-drafts"];

const STATUS_LABEL: Record<MerchantDraft["status"], string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
};
const STATUS_CLASS: Record<MerchantDraft["status"], string> = {
  pending: "bg-secondary-container/30 text-secondary",
  approved: "bg-primary/20 text-primary",
  rejected: "bg-error-container/30 text-error",
};

export function MerchantDraftsAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<{ drafts: MerchantDraft[] }>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await fetch("/api/admin/merchant/drafts");
      if (!res.ok) throw new Error("Không tải được bản nháp.");
      return res.json();
    },
  });
  const drafts = data?.drafts ?? [];

  // Danh sách sản phẩm cho ô chọn "tạo nháp mới"
  const { data: productsData } = useQuery<{ products: AdminProductLite[] }>({
    queryKey: ["admin", "products-lite"],
    queryFn: async () => {
      const res = await fetch("/api/admin/products");
      if (!res.ok) throw new Error("Không tải được sản phẩm.");
      return res.json();
    },
  });
  const products = productsData?.products ?? [];

  const [productId, setProductId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/merchant/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error ?? "Tạo bản nháp thất bại.");
    },
    onSuccess: () => {
      setProductId("");
      setActionError(null);
      invalidate();
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approve" | "reject" }) => {
      const res = await fetch(`/api/admin/merchant/drafts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error ?? "Xử lý bản nháp thất bại.");
    },
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  });
  const busyId = decide.isPending ? (decide.variables as { id: string } | undefined)?.id ?? null : null;

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">MERCHANT COPILOT</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Bản Nháp Mô Tả AI</h1>
      </header>

      {/* Tạo bản nháp mới */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (productId) generate.mutate();
        }}
        className="flex flex-wrap items-end gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-space-2xs">
          <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Sản phẩm cần viết lại mô tả</span>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">— Chọn sản phẩm —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={generate.isPending || !productId}
          className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
        >
          {generate.isPending ? "AI đang viết…" : "Tạo bản nháp"}
        </button>
      </form>

      {actionError && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{actionError}</p>}
      {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{(error as Error).message}</p>}

      {isLoading ? (
        <div className="flex justify-center py-space-lg"><Spinner className="border-primary border-t-transparent" /></div>
      ) : drafts.length === 0 ? (
        <p className="rounded-xl bg-surface-container p-space-lg font-body-md text-body-md text-on-surface-variant">Chưa có bản nháp nào. Chọn sản phẩm ở trên để AI viết mô tả.</p>
      ) : (
        <ul className="flex flex-col gap-space-sm">
          {drafts.map((d) => (
            <li key={d.id} className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-md shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-space-sm">
                <span className="font-headline-sm text-headline-sm text-on-surface">{d.productName}</span>
                <div className="flex items-center gap-space-xs">
                  <span className={cn("rounded-lg px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase", STATUS_CLASS[d.status])}>
                    {STATUS_LABEL[d.status]}
                  </span>
                  <span className="font-telemetry-xs text-telemetry-xs text-outline">{formatDate(d.createdAt)}</span>
                </div>
              </div>
              <div className="grid gap-space-sm lg:grid-cols-2">
                <div className="rounded-lg bg-surface-container-low p-space-sm">
                  <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Mô tả hiện tại</span>
                  <p className="mt-space-2xs whitespace-pre-line font-body-sm text-body-sm text-on-surface-variant">{d.before || "—"}</p>
                </div>
                <div className="rounded-lg bg-primary/5 p-space-sm ring-1 ring-primary/20">
                  <span className="font-telemetry-xs text-telemetry-xs uppercase text-primary">Bản nháp AI</span>
                  <p className="mt-space-2xs whitespace-pre-line font-body-sm text-body-sm text-on-surface">{d.after}</p>
                </div>
              </div>
              {d.status === "pending" && (
                <div className="flex gap-space-xs">
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => decide.mutate({ id: d.id, decision: "approve" })}
                    className="rounded-lg bg-primary px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-primary disabled:opacity-60"
                  >
                    {busyId === d.id ? "Đang xử lý…" : "Duyệt — ghi vào sản phẩm"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => decide.mutate({ id: d.id, decision: "reject" })}
                    className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface hover:text-error"
                  >
                    Từ chối
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
