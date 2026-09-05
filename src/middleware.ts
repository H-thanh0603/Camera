import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/utils/rate-limit";

/**
 * Middleware bảo mật biên.
 *
 * Rate limiting áp cho các request GHI (POST/PATCH/DELETE) trên /api/* —
 * GET (auth/me, products/snapshot…) được gọi mỗi lần load trang nên không
 * tính. Endpoint nhạy cảm (login, register, orders, reviews) còn có limiter
 * riêng chặt hơn trong route handler.
 *
 * LƯU Ý SẢN XUẤT: limiter in-memory chỉ đúng cho 1 instance. Khi deploy
 * đa instance, thay bằng Redis/Upstash trong rate-limit.ts (interface giữ nguyên).
 */

const mutationLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") && request.method !== "GET") {
    const result = mutationLimiter.check(clientIp(request));
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
