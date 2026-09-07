import { NextResponse, type NextRequest } from "next/server";
import { getEdgeRateLimiter } from "@/lib/edge-rate-limit";
import { getClientIp } from "@/lib/server/client-ip";

/**
 * Middleware bảo mật biên.
 *
 * Rate limiting áp cho các request GHI (POST/PATCH/DELETE) trên /api/* —
 * GET (auth/me, products/snapshot…) được gọi mỗi lần load trang nên không
 * tính. Endpoint nhạy cảm (login, register, orders, reviews) còn có limiter
 * riêng chặt hơn trong route handler.
 *
 * Backend: Upstash Redis sliding-window khi có UPSTASH_* env (đa instance),
 * fallback in-memory fail-open khi chưa cấu hình.
 */

const mutationLimiter = getEdgeRateLimiter(
  { windowMs: 60_000, max: 60 },
  (reason) => console.warn(JSON.stringify({ level: "warn", message: reason })),
);

function clientIp(request: NextRequest): string {
  return getClientIp(request.headers);
}

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") && request.method !== "GET") {
    // Telemetry (metrics) fire-and-forget với tần suất cao — không thuộc lớp cần bảo vệ
    if (!pathname.startsWith("/api/metrics") && !pathname.startsWith("/api/health")) {
      const result = await mutationLimiter.check(clientIp(request));
      if (!result.allowed) {
        return NextResponse.json(
          { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
          { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
        );
      }
      const response = NextResponse.next();
      response.headers.set("X-RateLimit-Remaining", String(result.remaining));
      response.headers.set("x-request-id", crypto.randomUUID());
      return applySecurityHeaders(response);
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-request-id", crypto.randomUUID());
  return applySecurityHeaders(response);
}

export const config = {
  matcher: ["/api/:path*"],
};
