import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse, getSessionUserWithRole } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { zodFieldErrors } from "@/lib/schemas";

/**
 * PATCH /api/admin/users/:id — đổi role (customer|staff|admin), khóa/mở khóa.
 * DELETE — xóa tài khoản (orders/reviews giữ lại, userId set null).
 * Không tự sửa chính mình; luôn giữ ít nhất 1 admin.
 */

const updateSchema = z.object({
  role: z.enum(["customer", "staff", "admin"]).optional(),
  isBanned: z.boolean().optional(),
});

async function guardSelfTarget(actorId: string, targetId: string): Promise<NextResponse | null> {
  if (actorId === targetId) {
    return NextResponse.json({ error: "Không thể thao tác trên chính tài khoản của mình." }, { status: 409 });
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const actor = await getSessionUserWithRole();
  const { id } = await params;
  const selfBlock = actor ? await guardSelfTarget(actor.id, id) : null;
  if (selfBlock) return selfBlock;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      { error: "Dữ liệu chưa hợp lệ.", fieldErrors: parsed.success ? undefined : zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });

  // Hạ cấp admin cuối cùng (sang staff hay customer đều chặn)
  if (target.role === "admin" && parsed.data.role && parsed.data.role !== "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Phải giữ ít nhất 1 tài khoản admin." }, { status: 409 });
    }
  }
  const updated = await prisma.user.update({ where: { id }, data: parsed.data });
  if (parsed.data.isBanned === true) {
    // Đá mọi phiên của tài khoản bị khóa
    await prisma.session.deleteMany({ where: { userId: id } });
  }
  await logAudit(actor, "user.updated", "User", id, parsed.data as Record<string, unknown>);
  return NextResponse.json({
    user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, isBanned: updated.isBanned },
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const actor = await getSessionUserWithRole();
  const { id } = await params;
  const selfBlock = actor ? await guardSelfTarget(actor.id, id) : null;
  if (selfBlock) return selfBlock;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
  if (target.role === "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Phải giữ ít nhất 1 tài khoản admin." }, { status: 409 });
    }
  }
  await prisma.user.delete({ where: { id } });
  await logAudit(actor, "user.deleted", "User", id, { email: target.email });
  return NextResponse.json({ ok: true });
}
