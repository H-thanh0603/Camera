import { track } from "@/lib/analytics";

/**
 * Error reporting (client): gửi về /api/metrics (sendBeacon) — server log
 * qua logger.error("client_error") và forward sang Sentry ở phía server.
 * Zero-cost bundle: không nhúng SDK vào client.
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
