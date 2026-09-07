/**
 * fetch có timeout cho mọi gọi outbound (Resend, Google, Upstash REST…).
 * Không AbortSignal = request treo tới TCP timeout khi bên thứ ba chậm,
 * giữ chân server thread/connection của chính mình.
 */

export const OUTBOUND_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = OUTBOUND_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
