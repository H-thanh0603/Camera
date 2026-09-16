import { NextResponse } from "next/server";
import { staffGuardResponse } from "@/lib/server/admin";
import { getInventoryHealth } from "@/lib/server/merchant-insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await staffGuardResponse();
  if (denied) return denied;
  try {
    return NextResponse.json({ inventory: await getInventoryHealth() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Không tải được cảnh báo tồn kho. Vui lòng thử lại." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
