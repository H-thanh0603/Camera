"use client";

import { useEffect, useState } from "react";
import { formatDate, cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

interface AdminReview {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  approved: boolean;
  verified: boolean;
  createdAt: string;
  product: { name: string; slug: string } | null;
}

type Tab = "pending" | "approved" | "all";

export function ReviewsAdmin() {
  const [tab, setTab] = useState<Tab>("pending");
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = (t: Tab) => {
    setReviews(null);
    setError(null);
    fetch(`/api/admin/reviews?status=${t}`)
      .then((r) => r.json())
      .then((d) => setReviews(d.reviews ?? []))
      .catch(() => setError("Không tải được đánh giá."));
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const act = async (id: string, action: "approve" | "unapprove" | "delete") => {
    setBusyId(id);
    try {
      const res =
        action === "delete"
          ? await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" })
          : await fetch(`/api/admin/reviews/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ approved: action === "approve" }),
            });
      if (res.ok) setReviews((prev) => prev?.filter((r) => r.id !== id) ?? prev);
      else setError("Thao tác thất bại.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">COMMUNITY MODERATION</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Kiểm Duyệt Đánh Giá</h1>
      </header>

      <div className="flex w-fit rounded-lg bg-surface-container p-space-2xs" role="tablist" aria-label="Lọc đánh giá">
        {(["pending", "approved", "all"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded px-space-md py-space-2xs font-telemetry-data text-telemetry-data uppercase transition-colors",
              tab === t ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {t === "pending" ? "Chờ duyệt" : t === "approved" ? "Đã duyệt" : "Tất cả"}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{error}</p>}
      {reviews === null && !error ? (
        <div className="flex justify-center py-space-lg"><Spinner className="border-primary border-t-transparent" /></div>
      ) : (reviews ?? []).length === 0 ? (
        <p className="rounded-xl bg-surface-container p-space-lg font-body-md text-body-md text-on-surface-variant">Không có đánh giá nào trong mục này.</p>
      ) : (
        <ul className="flex flex-col gap-space-md">
          {(reviews ?? []).map((r) => (
            <li key={r.id} className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-space-sm">
                <div className="flex flex-col">
                  <span className="font-headline-sm text-headline-sm text-on-surface">{r.title}</span>
                  <span className="font-telemetry-xs text-telemetry-xs text-outline">
                    {r.author} • {formatDate(r.createdAt)} • {r.product?.name ?? r.productId}
                  </span>
                </div>
                <span className={cn("rounded-lg px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase", r.approved ? "bg-primary/20 text-primary" : "bg-surface-container-high text-secondary")}>
                  {r.approved ? "Đã duyệt" : "Chờ duyệt"}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{r.body}</p>
              <div className="flex gap-space-xs pt-space-2xs">
                {r.approved ? (
                  <button type="button" disabled={busyId === r.id} onClick={() => act(r.id, "unapprove")} className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface transition-colors hover:bg-surface-container-highest">
                    Hủy duyệt
                  </button>
                ) : (
                  <button type="button" disabled={busyId === r.id} onClick={() => act(r.id, "approve")} className="rounded-lg bg-primary px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim">
                    Duyệt hiển thị
                  </button>
                )}
                <button type="button" disabled={busyId === r.id} onClick={() => act(r.id, "delete")} className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-outline transition-colors hover:text-error">
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
