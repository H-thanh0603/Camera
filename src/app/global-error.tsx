"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Global error boundary — bắt lỗi render crash toàn app.
 * Phải tự render <html><body> riêng, không dùng layout chung.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="vi">
      <body style={{ margin: 0, background: "#10141a", color: "#f5f1e6", fontFamily: "system-ui, sans-serif" }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 12, letterSpacing: 4, color: "#f2ca50" }}>LUMINA OPTICS</p>
          <h1 style={{ fontSize: 28, margin: 0 }}>Đã xảy ra sự cố</h1>
          <p style={{ opacity: 0.7, maxWidth: 480 }}>
            Trang gặp lỗi không mong đợi. Đội ngũ kỹ thuật đã được thông báo tự động.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#f2ca50",
              color: "#10141a",
              border: 0,
              borderRadius: 8,
              padding: "12px 32px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
