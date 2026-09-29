import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { exportAccountData, AccountError } from "@/lib/server/account";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

// L7: GET không nằm trong limiter mutation của proxy — giới hạn nhịp xuất
// PII (session đánh cắp không được export hàng loạt). 5 lần/phút/IP.
const limiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

/** GET /api/account/export — tải toàn bộ dữ liệu cá nhân (JSON). */
export async function GET(request: NextRequest) {
  const limit = await limiter.check(`account-export:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Đăng nhập để tiếp tục." }, { status: 401 });
  try {
    const data = await exportAccountData(user.id);
    return NextResponse.json(data, {
      headers: { "Content-Disposition": `attachment; filename="lumina-data-${user.id}.json"` },
    });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
