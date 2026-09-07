import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import { dbProductToDomain } from "@/lib/server/product-db";
import { validateProductPayload, validateVariants } from "@/lib/server/product-validation";
import { Prisma } from "@prisma/client";

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

    const row = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        images: (body.images ?? []) as Prisma.InputJsonValue,
        thumbnail: (body.thumbnail ?? { url: "", alt: "" }) as Prisma.InputJsonValue,
        specifications: (body.specifications ?? {}) as Prisma.InputJsonValue,
        tags: (body.tags ?? []) as Prisma.InputJsonValue,
        badges: (body.badges ?? []) as Prisma.InputJsonValue,
        highlights: (body.highlights ?? null) as Prisma.InputJsonValue,
        inTheBox: (body.inTheBox ?? null) as Prisma.InputJsonValue,
        compatibleWith: (body.compatibleWith ?? null) as Prisma.InputJsonValue,
        variants: { deleteMany: {}, create: variantData },
      },
      include: { variants: true },
    });

    revalidatePath("/", "layout");
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
  await prisma.product.delete({ where: { id } });
  revalidatePath("/", "layout");
  await logAudit(await getSessionUser(), "product.delete", "product", id);
  return NextResponse.json({ ok: true });
}
