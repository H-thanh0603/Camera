import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { prisma } from "@/lib/server/prisma";
import { zodFieldErrors } from "@/lib/schemas";
import { staffGuardResponse } from "@/lib/server/admin";

/**
 * POST /api/trade-in — form thu cũ đổi mới (public, 3/phút/IP).
 * GET /api/trade-in — admin xem leads (?status=).
 * PATCH /api/trade-in { id, status } — admin cập nhật trạng thái.
 */

const limiter = getRequestLimiter({ windowMs: 60_000, max: 3 });

const leadSchema = z.object({
  name: z.string().trim().min(2, "Vui lòng nhập họ tên."),
  phone: z.string().trim().min(9, "Số điện thoại chưa đúng.").max(15),
  email: z.string().trim().email("Email chưa đúng.").optional().or(z.literal("")),
  deviceBrand: z.string().trim().min(1, "Chọn hãng máy.").max(40),
  deviceModel: z.string().trim().min(1, "Nhập model máy.").max(80),
  condition: z.enum(["like_new", "good", "fair", "broken"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

const STATUS = ["new", "contacted", "quoted", "done", "dropped"] as const;

export async function POST(request: NextRequest) {
  const limit = await limiter.check(`tradein:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Gửi quá nhiều. Thử lại sau." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Thông tin chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) }, { status: 422 });
  }
  const lead = await prisma.tradeInLead.create({ data: { ...parsed.data, email: parsed.data.email ?? "", note: parsed.data.note ?? "" } });
  return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const denied = await staffGuardResponse();
  if (denied) return denied;
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const leads = await prisma.tradeInLead.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ leads });
}

export async function PATCH(request: NextRequest) {
  const denied = await staffGuardResponse();
  if (denied) return denied;
  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  if (!body.id || !(STATUS as readonly string[]).includes(body.status ?? "")) {
    return NextResponse.json({ error: "Trạng thái chưa hợp lệ." }, { status: 422 });
  }
  await prisma.tradeInLead.update({ where: { id: body.id }, data: { status: body.status! } });
  return NextResponse.json({ ok: true });
}
