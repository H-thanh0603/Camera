import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse, getSessionUserWithRole } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { couponUpdateSchema, zodFieldErrors } from "@/lib/schemas";

/** PATCH /api/admin/coupons/:code — sửa mã. DELETE — xóa mã. */

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const { code } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = couponUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  if (parsed.data.kind === "percent" && parsed.data.value != null && parsed.data.value > 90) {
    return NextResponse.json({ error: "Phần trăm giảm tối đa 90%." }, { status: 422 });
  }
  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy mã giảm giá." }, { status: 404 });

  const coupon = await prisma.coupon.update({
    where: { code },
    data: {
      ...(parsed.data.kind !== undefined ? { kind: parsed.data.kind } : {}),
      ...(parsed.data.value !== undefined ? { value: parsed.data.value } : {}),
      ...(parsed.data.minSubtotal !== undefined ? { minSubtotal: parsed.data.minSubtotal } : {}),
      ...(parsed.data.maxUses !== undefined ? { maxUses: parsed.data.maxUses } : {}),
      ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
      ...(parsed.data.expiresAt !== undefined
        ? { expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null }
        : {}),
    },
  });
  const admin = await getSessionUserWithRole();
  await logAudit(admin, "coupon.updated", "Coupon", code, parsed.data as Record<string, unknown>);
  return NextResponse.json({ coupon });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const { code } = await params;
  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (!existing) return NextResponse.json({ error: "Không tìm thấy mã giảm giá." }, { status: 404 });

  await prisma.coupon.delete({ where: { code } });
  const admin = await getSessionUserWithRole();
  await logAudit(admin, "coupon.deleted", "Coupon", code);
  return NextResponse.json({ ok: true });
}
