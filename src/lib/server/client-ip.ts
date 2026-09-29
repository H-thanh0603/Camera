/**
 * Client IP đáng tin cho rate-limit.
 *
 * Thứ tự ưu tiên (M1):
 * 1. TRUST_PROXY_COUNT>0 (deploy sau LB/proxy): lấy entry X-Forwarded-For do
 *    LỚP PROXY TRUSTED NGOÀI CÙNG append — đếm từ phải `TRUST_PROXY_COUNT`
 *    bước. Proxy luôn APPEND nên attacker tự chèn đầu XFF không dịch được vị
 *    trí này. KHÔNG tin cf-connecting-ip/x-real-ip client tự đặt được khi
 *    proxy không strip — từng là vector bypass toàn bộ limiter per-IP.
 * 2. Vercel (VERCEL=1, không set TRUST_PROXY_COUNT): platform append IP thật
 *    vào cuối XFF + tự ghi đè x-real-ip — entry phải nhất là đáng tin.
 * 3. XFF rỗng sau proxy (cấu hình lạ): chỉ nhận header edge (cf-connecting-ip)
 *    — tốt hơn "unknown" gộp chung bucket.
 * 4. Không trust (dev): entry trái nhất XFF — chấp nhận spoof được.
 */

function firstHeader(headers: Headers, name: string): string | null {
  const v = headers.get(name)?.split(",")[0]?.trim();
  return v || null;
}

export function getClientIp(headers: Headers): string {
  const trustCount = Number(process.env.TRUST_PROXY_COUNT ?? 0) || 0;
  const behindProxy = trustCount > 0 || Boolean(process.env.VERCEL);

  const xff = headers.get("x-forwarded-for");
  const parts = xff ? xff.split(",").map((p) => p.trim()).filter(Boolean) : [];

  if (behindProxy && parts.length > 0) {
    const idx = parts.length - (trustCount > 0 ? trustCount : 1);
    if (idx >= 0) return parts[idx]!;
  }
  if (behindProxy) {
    // XFF rỗng/ít entry hơn số lớp proxy: chỉ nhận header do edge platform
    // tự sinh (Cloudflare ghi đè cf-connecting-ip, Vercel ghi đè x-real-ip).
    const cf = firstHeader(headers, "cf-connecting-ip");
    if (cf) return cf;
    const real = firstHeader(headers, "x-real-ip");
    if (real) return real;
    return "unknown";
  }
  return parts[0] ?? "unknown";
}
