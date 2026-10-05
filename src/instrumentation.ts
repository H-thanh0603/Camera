import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation hook — nguồn trung tâm cho lỗi server runtime.
 * `onRequestError` bắt mọi uncaught/unhandled error trong API routes và
 * server components (kể cả route không có try/catch + logger riêng) rồi
 * forward lên Sentry; Sentry.init nằm ở sentry.server.config.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
