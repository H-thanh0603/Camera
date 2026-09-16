import { NextResponse, type NextRequest } from "next/server";
import { adminGuardResponse } from "@/lib/server/admin";
import { isSameOriginRequest } from "@/lib/csrf";
import { decideMerchantDraft, MerchantDraftError } from "@/lib/server/merchant-drafts";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Yêu cầu bị chặn (CSRF)." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 }); }
  try {
    const { id } = await params;
    return NextResponse.json({ draft: await decideMerchantDraft(id, body) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof MerchantDraftError ? error.message : "Không xử lý được bản nháp." },
      { status: error instanceof MerchantDraftError ? error.status : 500 });
  }
}
