/**
 * Structured logger phía server — dòng JSON một hàng (grep/ingest được bởi
 * Datadog/Loki/CloudWatch). Production: thêm sink (Sentry, log tail) bằng cách
 * mở rộng write() — mọi API route đã đi qua đây.
 */

type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
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
