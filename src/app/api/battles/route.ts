import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { prisma } from "@/lib/server/prisma";

/**
 * GET /api/battles — battles đã lưu của user.
 * POST /api/battles { name?, productIds[2..4] } — lưu battle (tối đa 20/user).
 * DELETE /api/battles?id= — xóa battle của chính mình.
 * Share không cần login: URL /compare?ids= vốn đã public.
 */

const saveSchema = z.object({
  name: z.string().trim().max(80).optional(),
  productIds: z.array(z.string().min(1)).min(2).max(4),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Đăng nhập để xem battle đã lưu." }, { status: 401 });
  const battles = await prisma.savedBattle.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({ battles });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Đăng nhập để lưu battle." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Battle cần 2–4 sản phẩm." }, { status: 422 });
  const ids = [...new Set(parsed.data.productIds)];
  if (ids.length < 2) return NextResponse.json({ error: "Battle cần ít nhất 2 sản phẩm khác nhau." }, { status: 422 });
  const count = await prisma.product.count({ where: { id: { in: ids } } });
  if (count !== ids.length) return NextResponse.json({ error: "Có sản phẩm không tồn tại." }, { status: 422 });

  const total = await prisma.savedBattle.count({ where: { userId: user.id } });
  if (total >= 20) return NextResponse.json({ error: "Đã lưu tối đa 20 battle." }, { status: 422 });

  const battle = await prisma.savedBattle.create({
    data: { userId: user.id, name: parsed.data.name ?? "", productIds: ids },
  });
  return NextResponse.json({ battle }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Đăng nhập để xóa battle." }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const row = await prisma.savedBattle.findUnique({ where: { id } });
  if (!row || row.userId !== user.id) return NextResponse.json({ error: "Không tìm thấy battle." }, { status: 404 });
  await prisma.savedBattle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
