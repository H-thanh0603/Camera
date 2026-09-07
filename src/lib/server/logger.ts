/**
 * Structured logger phía server — dòng JSON một hàng (grep/ingest được bởi
 * Datadog/Loki/CloudWatch). Level error còn forward sang Sentry khi có
 * SENTRY_DSN (production).
 */

import * as Sentry from "@sentry/nextjs";
import { scrubMeta } from "./scrub";

type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  // Scrub PII trước khi ghi log / forward Sentry (P0-5)
  const clean = (scrubMeta(meta ?? {}) ?? {}) as Record<string, unknown>;
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...clean,
  });
  if (level === "error") {
    console.error(line);
    if (process.env.SENTRY_DSN) {
      try {
        Sentry.captureMessage(`${message}`, { level: "error", extra: clean });
      } catch {
        // Sentry fail không được phá vỡ request
      }
    }
  } else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") write("debug", message, meta);
  },
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
