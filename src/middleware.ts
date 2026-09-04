import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/utils/rate-limit";

/**
 * Middleware bảo mật biên.
 *
 * Rate limiting áp cho /api/* (endpoint hiện chưa tồn tại — khung sẵn sàng
 * cho giai đoạn nối backend: login, submit order, submit review...).
 *
 * LƯU Ý SẢN XUẤT: limiter in-memory chỉ đúng cho 1 instance. Khi deploy
 * đa instance, thay bằng Redis/Upstash trong rate-limit.ts (interface giữ nguyên).
 */

const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const result = apiLimiter.check(clientIp(request));
    if (!result.allowed) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
      );
    }
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
