import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAG } from "@/lib/server/product-db";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import { dbProductToDomain } from "@/lib/server/product-db";
import { validateProductPayload, validateVariants, sanitizeProductJson, buildTagString } from "@/lib/server/product-validation";
import { Prisma } from "@/generated/prisma/client";

/** PUT /api/admin/products/:id — cập nhật; DELETE — xóa (cascade variants). */

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  // Cùng luật validate với POST — slug/SKU/brand/giá sai đều 422 rõ lý do
  const { error, data } = validateProductPayload(body);
  if (error || !data) return NextResponse.json({ error }, { status: 422 });

  try {
    const variantData = validateVariants(body, Number(data.price));
    const json = sanitizeProductJson(body);

    const row = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        ...json,
        tagString: buildTagString((json.tags ?? []) as string[]),
        variants: { deleteMany: {}, create: variantData },
      },
      include: { variants: true },
    });
    revalidatePath("/", "layout");
    revalidateTag(CATALOG_TAG, "max");
    await logAudit(await getSessionUser(), "product.update", "product", row.id, { name: row.name, price: row.price });
    return NextResponse.json({ product: dbProductToDomain(row) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
    }
    return NextResponse.json({ error: "Không cập nhật được sản phẩm." }, { status: 409 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const { id } = await params;
  // Chính sách orphan: SP đã có đơn/review thì CẤM xóa (giữ lịch sử toàn vẹn).
  // Muốn ngừng bán: availability="contact" hoặc "out_of_stock".
  const [lineCount, reviewCount] = await Promise.all([
    prisma.orderLine.count({ where: { productId: id } }),
    prisma.review.count({ where: { productId: id } }),
  ]);
  if (lineCount > 0 || reviewCount > 0) {
    return NextResponse.json(
      {
        error: `Không thể xóa: sản phẩm đã có ${lineCount} dòng đơn và ${reviewCount} đánh giá. Hãy chuyển availability sang "contact" để ngừng bán mà vẫn giữ lịch sử.`,
      },
      { status: 409 },
    );
  }
  try {
    await prisma.product.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Không tìm thấy sản phẩm." }, { status: 404 });
    }
    throw e;
  }
  revalidatePath("/", "layout");
    revalidateTag(CATALOG_TAG, "max");
  await logAudit(await getSessionUser(), "product.delete", "product", id);
  return NextResponse.json({ ok: true });
}
