import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse, getSessionUserWithRole } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { couponCreateSchema, zodFieldErrors } from "@/lib/schemas";

/** GET /api/admin/coupons — danh sách mã giảm giá. POST — tạo mã mới. */

export async function GET() {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ coupons });
}

export async function POST(request: NextRequest) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = couponCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu mã giảm giá chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const exists = await prisma.coupon.findUnique({ where: { code: parsed.data.code } });
  if (exists) return NextResponse.json({ error: `Mã "${parsed.data.code}" đã tồn tại.` }, { status: 409 });

  const coupon = await prisma.coupon.create({
    data: {
      code: parsed.data.code,
      kind: parsed.data.kind,
      value: parsed.data.value,
      minSubtotal: parsed.data.minSubtotal,
      maxUses: parsed.data.maxUses ?? null,
      active: parsed.data.active,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });
  const admin = await getSessionUserWithRole();
  await logAudit(admin, "coupon.created", "Coupon", coupon.code, { kind: coupon.kind, value: coupon.value });
  return NextResponse.json({ coupon }, { status: 201 });
}
