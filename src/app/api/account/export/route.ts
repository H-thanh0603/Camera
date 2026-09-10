import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { exportAccountData, AccountError } from "@/lib/server/account";

/** GET /api/account/export — tải toàn bộ dữ liệu cá nhân (JSON). */
export async function GET() {
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
