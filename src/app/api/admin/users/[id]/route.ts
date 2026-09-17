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

  // Hạ cấp admin cuối cùng (sang staff hay customer đều chặn).
  // Chống TOCTOU race (L5): check count + update trong transaction (trên
  // Postgres SERIALIZABLE-ish row-lock xếp hàng), và verify sau commit —
  // nếu 2 demote song song lọt qua count, bên nào thấy 0 admin sẽ tự khôi
  // phục target về admin (hội tụ về trạng thái an toàn).
  if (target.role === "admin" && parsed.data.role && parsed.data.role !== "admin") {
    let blocked = false;
    const updated = await prisma
      .$transaction(async (tx) => {
        const adminCount = await tx.user.count({ where: { role: "admin" } });
        if (adminCount <= 1) {
          blocked = true;
          return target;
        }
        return tx.user.update({ where: { id }, data: parsed.data });
      })
      .catch(() => null);
    if (blocked || updated === null) {
      return NextResponse.json({ error: "Phải giữ ít nhất 1 tài khoản admin." }, { status: 409 });
    }
    const remaining = await prisma.user.count({ where: { role: "admin" } });
    if (remaining === 0) {
      // Race: demote song song lọt qua — khôi phục ngay, báo 409.
      await prisma.user.update({ where: { id }, data: { role: "admin" } });
      await logAudit(actor, "user.last_admin_race_restored", "User", id, {});
      return NextResponse.json(
        { error: "Xung đột hạ cấp admin song song — đã khôi phục. Thử lại." },
        { status: 409 },
      );
    }
    if (parsed.data.isBanned === true) {
      await prisma.session.deleteMany({ where: { userId: id } });
    }
    await logAudit(actor, "user.updated", "User", id, parsed.data as Record<string, unknown>);
    return NextResponse.json({
      user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, isBanned: updated.isBanned },
    });
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
    // L5: xóa + kiểm tra trong transaction; verify sau commit, khôi phục
    // nếu race để lại 0 admin (hội tụ an toàn như PATCH).
    let blocked = false;
    const deleted = await prisma
      .$transaction(async (tx) => {
        const adminCount = await tx.user.count({ where: { role: "admin" } });
        if (adminCount <= 1) {
          blocked = true;
          return target;
        }
        return tx.user.delete({ where: { id } });
      })
      .catch(() => null);
    if (blocked || deleted === null) {
      return NextResponse.json({ error: "Phải giữ ít nhất 1 tài khoản admin." }, { status: 409 });
    }
    const remaining = await prisma.user.count({ where: { role: "admin" } });
    if (remaining === 0) {
      await prisma.user.create({
        data: { email: target.email, name: target.name, passwordHash: target.passwordHash, role: "admin" },
      });
      await logAudit(actor, "user.last_admin_race_restored", "User", id, { email: target.email });
      return NextResponse.json(
        { error: "Xung đột xóa admin song song — đã khôi phục. Thử lại." },
        { status: 409 },
      );
    }
    await logAudit(actor, "user.deleted", "User", id, { email: target.email });
    return NextResponse.json({ ok: true });
  }
  await prisma.user.delete({ where: { id } });
  await logAudit(actor, "user.deleted", "User", id, { email: target.email });
  return NextResponse.json({ ok: true });
}
