/**
 * CSRF edge-check cho API mutations (cookie session, browser-only).
 * Same-origin fetch luôn gửi Origin (POST) — form cũ gửi Referer.
 * Request cross-site từ trình duyệt nạn nhân không được set Origin/Referer
 * (forged), nên host lệch hoặc vắng mặt → chặn 403.
 * Edge-safe: chỉ dùng URL parsing, không import node-only deps.
 */

export function requestHost(request: { headers: Headers; url: string }): string {
  return new URL(request.url).host;
}

function headerHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
}

/**
 * true khi request đổi trạng thái được phép đi tiếp:
 * - GET/HEAD/OPTIONS luôn pass (không đổi trạng thái).
 * - Ngược lại: Origin khớp host, hoặc (vắng Origin) Referer khớp host.
 */
export function isSameOriginRequest(request: { method: string; headers: Headers; url: string }): boolean {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return true;
  const host = requestHost(request);
  const origin = request.headers.get("origin");
  if (origin) return headerHost(origin) === host;
  // fetch same-origin không Origin (rất hiếm) + form submit → kiểm Referer
  const referer = request.headers.get("referer");
  if (referer) return headerHost(referer) === host;
  return false;
}
