"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDate, cn } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
  _count: { orders: number; reviews: number };
}

const PAGE_SIZE = 20;

export function UsersAdmin() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");

  const { data, isLoading, error } = useQuery<{
    users: AdminUser[];
    total: number;
    totalPages: number;
  }>({
    queryKey: ["admin", "users", page, query],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users?page=${page}&pageSize=${PAGE_SIZE}&q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Không tải được tài khoản.");
      return res.json();
    },
  });
  const users = data?.users ?? [];
  const totalPages = data?.totalPages ?? 1;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const act = useMutation({
    mutationFn: async ({ id, body, method = "PATCH" }: { id: string; body?: unknown; method?: "PATCH" | "DELETE" }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((payload as { error?: string }).error ?? "Thao tác thất bại.");
    },
    onSuccess: invalidate,
    onError: (e: Error) => alert(e.message),
  });
  const busyId = act.isPending ? (act.variables as { id: string } | undefined)?.id ?? null : null;

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">ACCESS CONTROL</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Tài Khoản & Phân Quyền</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q.trim());
        }}
        className="flex gap-space-xs"
      >
        <label htmlFor="user-search" className="sr-only">Tìm theo email hoặc tên</label>
        <input
          id="user-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm email / tên…"
          className="min-w-0 flex-1 rounded-lg bg-surface-container px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none placeholder:text-outline focus:ring-1 focus:ring-primary"
        />
        <button type="submit" className="rounded-lg bg-surface-container-high px-space-md py-space-xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface hover:bg-surface-container-highest">
          Tìm
        </button>
      </form>

      {error && <p className="rounded-lg border border-error/40 bg-error-container/20 p-space-sm font-body-sm text-body-sm text-error" role="alert">{(error as Error).message}</p>}
      {isLoading ? (
        <div className="flex justify-center py-space-lg"><Spinner className="border-primary border-t-transparent" /></div>
      ) : users.length === 0 ? (
        <p className="rounded-xl bg-surface-container p-space-lg font-body-md text-body-md text-on-surface-variant">Không tìm thấy tài khoản nào.</p>
      ) : (
        <ul className="flex flex-col gap-space-sm">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-surface-container p-space-md shadow-xl">
              <div className="flex min-w-0 flex-col gap-space-2xs">
                <span className="truncate font-headline-sm text-headline-sm text-on-surface">{u.name} <span className="font-body-sm text-body-sm text-outline">({u.email})</span></span>
                <span className="font-telemetry-xs text-telemetry-xs text-outline">
                  {u._count.orders} đơn • {u._count.reviews} review • từ {formatDate(u.createdAt)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-space-xs">
                <span className={cn("rounded-lg px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase", u.role === "admin" ? "bg-primary/20 text-primary" : "bg-surface-container-high text-on-surface-variant")}>
                  {u.role === "admin" ? "Admin" : "Khách"}
                </span>
                {u.isBanned && (
                  <span className="rounded-lg bg-error-container/30 px-space-xs py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-error">Bị khóa</span>
                )}
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => act.mutate({ id: u.id, body: { role: u.role === "admin" ? "customer" : "admin" } })}
                  className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface hover:bg-surface-container-highest"
                >
                  {u.role === "admin" ? "Hạ quyền" : "Cấp admin"}
                </button>
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => act.mutate({ id: u.id, body: { isBanned: !u.isBanned } })}
                  className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface hover:text-secondary"
                >
                  {u.isBanned ? "Mở khóa" : "Khóa"}
                </button>
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => {
                    if (window.confirm(`Xóa tài khoản ${u.email}? Đơn/review giữ lại dưới dạng khách vãng lai.`)) {
                      act.mutate({ id: u.id, method: "DELETE" });
                    }
                  }}
                  className="rounded-lg bg-surface-container-high px-space-md py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-outline hover:text-error"
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

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
    </div>
  );
}
