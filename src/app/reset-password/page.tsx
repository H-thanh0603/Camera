"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/states";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="container-page py-space-3xl"><EmptyState icon="hourglass_empty" title="Đang tải..." /></div>}>
      <ResetForm />
    </Suspense>
  );
}

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Đặt lại thất bại.");
        return;
      }
      setDone(true);
    } catch {
      setError("Không kết nối được server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page flex justify-center py-space-3xl">
      <div className="flex w-full max-w-md flex-col gap-space-md rounded-xl bg-surface-container p-space-2xl shadow-xl">
        <span className="section-telemetry">ACCOUNT RECOVERY</span>
        <h1 className="font-headline-md text-headline-md text-on-surface">Đặt mật khẩu mới</h1>
        {!token ? (
          <p className="font-body-md text-body-md text-error" role="alert">Link thiếu token — hãy bấm lại link trong email.</p>
        ) : done ? (
          <p className="font-body-md text-body-md text-on-surface-variant">
            Mật khẩu đã được đặt lại và mọi phiên cũ đã đăng xuất. Hãy đăng nhập lại.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-space-sm">
            <label className="flex flex-col gap-space-2xs">
              <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Mật khẩu mới (≥ 8 ký tự)</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            {error && <p className="font-body-sm text-body-sm text-error" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
            >
              {busy ? "Đang xử lý..." : "Đặt lại mật khẩu"}
            </button>
          </form>
        )}
        <Link href="/account" className="font-telemetry-data text-telemetry-data uppercase text-on-surface-variant hover:text-primary">
          ← Quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
}
