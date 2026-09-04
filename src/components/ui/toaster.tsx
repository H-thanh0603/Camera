"use client";

import Link from "next/link";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils/format";

export function Toaster() {
  const { toasts, dismissToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-space-md left-1/2 z-[80] flex w-full max-w-md -translate-x-1/2 flex-col gap-space-xs px-space-md" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-highest px-space-md py-space-sm shadow-2xl animate-fade-in-up",
            toast.tone === "error" && "border border-error/40",
          )}
        >
          <span className="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface">
            <span
              className={cn(
                "material-symbols-outlined text-[18px]",
                toast.tone === "success" && "text-primary",
                toast.tone === "error" && "text-error",
                toast.tone === "info" && "text-tertiary",
              )}
              aria-hidden="true"
            >
              {toast.tone === "success" ? "check_circle" : toast.tone === "error" ? "error" : "info"}
            </span>
            {toast.message}
          </span>
          {toast.action && (
            <Link href={toast.action.href} className="shrink-0 font-telemetry-xs text-telemetry-xs uppercase text-primary hover:underline" onClick={() => dismissToast(toast.id)}>
              {toast.action.label}
            </Link>
          )}
          <button type="button" onClick={() => dismissToast(toast.id)} className="text-on-surface-variant transition-colors hover:text-on-surface" aria-label="Đóng thông báo">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}
