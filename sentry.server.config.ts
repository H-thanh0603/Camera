import * as Sentry from "@sentry/nextjs";

/**
 * Sentry server — bắt lỗi API routes / server components khi có SENTRY_DSN.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: Boolean(process.env.SENTRY_DSN),
});
