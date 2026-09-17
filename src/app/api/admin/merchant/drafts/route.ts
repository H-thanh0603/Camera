import { NextResponse, type NextRequest } from "next/server";
import { adminRateLimit } from "@/lib/server/rate-limit-redis";
import { adminGuardResponse } from "@/lib/server/admin";
import { isSameOriginRequest } from "@/lib/csrf";
import { generateMerchantDraft, listMerchantDrafts, MerchantDraftError } from "@/lib/server/merchant-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  try {
    return NextResponse.json({ drafts: await listMerchantDrafts() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof MerchantDraftError ? error.message : "Không tải được bản nháp." },
      { status: error instanceof MerchantDraftError ? error.status : 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const limited = await adminRateLimit(request, "merchant-drafts-post");
  if (limited) return limited;
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Yêu cầu bị chặn (CSRF)." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ." }, { status: 400 }); }
  try {
    return NextResponse.json({ draft: await generateMerchantDraft(body) }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof MerchantDraftError ? error.message : "Không tạo được bản nháp." },
      { status: error instanceof MerchantDraftError ? error.status : 500 });
  }
}
