"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Gửi yêu cầu thất bại.");
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
        <h1 className="font-headline-md text-headline-md text-on-surface">Quên mật khẩu</h1>
        {done ? (
          <p className="font-body-md text-body-md text-on-surface-variant">
            Nếu email tồn tại trong hệ thống, link đặt lại (hiệu lực 60 phút) đã được gửi. Kiểm tra hộp thư của bạn.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-space-sm">
            <label className="flex flex-col gap-space-2xs">
              <span className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Email đăng ký</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            {error && <p className="font-body-sm text-body-sm text-error" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-primary py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
            >
              {busy ? "Đang gửi..." : "Gửi link đặt lại"}
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
