"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log để monitoring thu thập; không hiển thị raw error cho người dùng
    console.error("[LUMINA] Unhandled app error:", error);
  }, [error]);

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center gap-space-md py-space-3xl text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-high">
        <span className="material-symbols-outlined text-[40px] text-error" aria-hidden="true">error</span>
      </div>
      <span className="section-telemetry">LỖI HỆ THỐNG</span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Có Gì Đó Không Ổn</h1>
      <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
        Đã xảy ra lỗi khi tải trang. Đội ngũ Lumina đã được thông báo — bạn có thể thử lại ngay.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim"
      >
        Thử lại
      </button>
    </div>
  );
}
