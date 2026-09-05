import { track } from "@/lib/analytics";

/**
 * Error reporting (client): bắt exception ở error boundary + window.onerror,
 * gửi về /api/metrics để server log có cấu trúc.
 *
 * SẢN XUẤT: Sentry-ready — thay captureException bằng Sentry.captureException
 * (hoặc GlitchTip tự host), các điểm gọi đã xong.
 */

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  track("client_error", {
    message: message.slice(0, 300),
    stack: error instanceof Error ? error.stack?.slice(0, 800) : undefined,
    ...context,
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("error", (e) => captureException(e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => captureException(e.reason));
}
