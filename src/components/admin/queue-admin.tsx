"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/lib/utils/format";
import { Spinner } from "@/components/ui/states";

interface DeadMail {
  id: string;
  kind: string;
  to: string;
  subject: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

interface QueueState {
  redis: boolean;
  email: { waiting?: number; active?: number };
  outbox: { pending: number; dead: number };
  dead: DeadMail[];
}

/** Trang vận hành mail: độ sâu queue + mail dead + nút hồi sinh cho worker gửi lại. */
export function QueueAdmin() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<QueueState>({
    queryKey: ["admin", "queue"],
    queryFn: async () => {
      const res = await fetch("/api/admin/queue");
      if (!res.ok) throw new Error("Không tải được trạng thái queue.");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const retry = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry-dead" }),
      });
      if (!res.ok) throw new Error("Hồi sinh thất bại.");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "queue"] }),
  });

  return (
    <div className="flex flex-col gap-space-lg">
      <header className="flex flex-col gap-space-2xs">
        <span className="section-telemetry">OPS · EMAIL</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Hàng Đợi Email</h1>
      </header>

      {isLoading && <Spinner />}
      {error && <p className="text-error" role="alert">Không tải được trạng thái queue.</p>}

      {data && (
        <>
          <section className="grid grid-cols-2 gap-space-md lg:grid-cols-4" aria-label="Độ sâu queue">
            <Stat label="Redis fast-lane" value={data.redis ? "Bật" : "Tắt (chỉ outbox DB)"} />
            <Stat label="Outbox chờ gửi" value={String(data.outbox.pending)} alert={data.outbox.pending > 50} />
            <Stat label="Mail dead (hết lượt)" value={String(data.outbox.dead)} alert={data.outbox.dead > 0} />
            <Stat label="Redis waiting" value={String(data.email?.waiting ?? "—")} />
          </section>
          {!data.redis && (
            <p className="rounded-xl border border-error/40 bg-error-container/20 p-space-md text-error" role="alert">
              Redis chưa cấu hình — rate-limit/budget/agent-stream đang chạy memory fail-open.
              Production phải bật Upstash Redis (xem .env.example).
            </p>
          )}

          <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm uppercase text-on-surface">Mail Dead Mới Nhất</h2>
              <button
                type="button"
                onClick={() => retry.mutate()}
                disabled={retry.isPending || data.outbox.dead === 0}
                className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary disabled:opacity-60"
              >
                {retry.isPending ? "Đang hồi sinh…" : `Hồi sinh ${data.outbox.dead} mail`}
              </button>
            </div>
            {data.dead.length === 0 ? (
              <p className="text-on-surface-variant">Không có mail dead. Worker đang xử lý tốt.</p>
            ) : (
              <ul className="flex flex-col gap-space-xs">
                {data.dead.map((m) => (
                  <li key={m.id} className="rounded-lg bg-surface-container-low p-space-sm">
                    <p className="font-body-sm text-body-sm text-on-surface">{m.subject}</p>
                    <p className="font-telemetry-xs text-telemetry-xs text-outline">
                      {m.kind} · {m.to.replace(/(.{2}).+(@.+)/, "$1…$2")} · {m.attempts} lượt · {formatDate(m.createdAt)}
                      {m.lastError ? ` · lỗi: ${m.lastError.slice(0, 120)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex flex-col gap-space-2xs rounded-xl bg-surface-container p-space-lg">
      <span className={`font-headline-sm text-headline-sm ${alert ? "text-error" : "text-on-surface"}`}>{value}</span>
      <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">{label}</span>
    </div>
  );
}
