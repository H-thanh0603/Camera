/**
 * Client IP đáng tin cho rate-limit.
 * Thứ tự ưu tiên:
 * 1. Header do edge platform đảm bảo (Cloudflare cf-connecting-ip,
 *    x-real-ip của LB) — attacker không tự đặt được khi đi qua proxy.
 * 2. X-Forwarded-For CHỈ khi TRUST_PROXY_COUNT>0 (deploy sau LB/Vercel):
 *    lấy entry PHẢI NHẤT (proxy của ta append — attacker không gỡ được).
 *    Không trust → fallback entry trái nhất (dev) — chấp nhận spoof được.
 * Đặt TRUST_PROXY_COUNT=1 ở production sau 1 lớp proxy.
 */

function firstHeader(headers: Headers, name: string): string | null {
  const v = headers.get(name)?.split(",")[0]?.trim();
  return v || null;
}

export function getClientIp(headers: Headers): string {
  const cf = firstHeader(headers, "cf-connecting-ip");
  if (cf) return cf;
  const real = firstHeader(headers, "x-real-ip");
  if (real) return real;

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const trusted = Number(process.env.TRUST_PROXY_COUNT ?? 0);
      if (trusted > 0) return parts[parts.length - 1]!;
      return parts[0]!;
    }
  }
  return "unknown";
}
