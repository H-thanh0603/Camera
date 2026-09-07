import { createHash } from "node:crypto";

/**
 * Scrub PII trước khi log/Sentry — mọi meta qua logger đều đi qua đây.
 * Quy tắc: key nhạy cảm → [REDACTED]; email/SĐT trong string → che giữa.
 */

const SENSITIVE_KEY = /passw|passwd|secret|token|api[_-]?key|card|cvv|otp/i;
const PII_KEY = /^(to|cc|bcc|email|e-mail|phone|tel|mobile|address|ward|district|city|notes|fullName)$/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const VN_PHONE_RE = /(\+84|0)\d{8,10}/g;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "[REDACTED]";
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

function scrubString(key: string | null, value: string): string {
  if (key && SENSITIVE_KEY.test(key)) return "[REDACTED]";
  return value.replace(EMAIL_RE, (m) => maskEmail(m)).replace(VN_PHONE_RE, (m) => `${m.slice(0, 3)}***${m.slice(-2)}`);
}

export function scrubMeta(input: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (typeof input === "string") return scrubString(null, input);
  if (Array.isArray(input)) return input.map((v) => scrubMeta(v, depth + 1));
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = "[REDACTED]";
      } else if (PII_KEY.test(k) && typeof v === "string") {
        out[k] = k.toLowerCase() === "email" || k.toLowerCase() === "to" ? maskEmail(v) : "[REDACTED]";
      } else {
        out[k] = scrubMeta(v, depth + 1);
      }
    }
    return out;
  }
  return input;
}

/** Hash định danh để tương quan log mà không lộ PII (vd: email → 12 ký tự). */
export function hashId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
